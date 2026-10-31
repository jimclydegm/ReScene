import "server-only";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { Quaternion, Vector3 } from "three";
import { z } from "zod";
import type { Prisma, SceneObject, Asset } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { bucket, putObject, readLimited, storagePrefix } from "@/lib/storage/r2";
import { inspectGlb } from "@/lib/ai/glb";
import { isBackgroundSurface } from "@/lib/scene/surface-role";
import { compositionSchema, modelPlacementSchema } from "@/lib/scene/composition";
import { layoutReviewSchema } from "@/lib/scene/layout-review";
import { pixelBoxSchema } from "@/lib/ai/controls";
import { qualityPlanObservationSchema, qualityReviewObservationSchema, type QualityPlanObservation } from "@/lib/quality/contracts";
import { objectReviewSchema, mergeSparkReview } from "@/lib/quality/review";
import { contactSchema, type Placed } from "@/lib/quality/placement";
import { readMesh, geometryDigest } from "@/lib/quality/mesh";
import { diagnoseMesh } from "@/lib/quality/diagnostics";
import { inspectionView, referenceView, runQualityPipeline, type PipelineObject } from "@/lib/quality/pipeline";
import type { PixelImage4 } from "@/lib/quality/render";
import { ownedScene } from "./scenes";
import { record } from "./composition";

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const active = ["QUEUED", "RUNNING", "WAITING"] as const;
export const qualityInput = z.object({ action: z.enum(["IMPROVE", "RESTORE"]), expectedRevision: z.number().int().nonnegative() }).strict();
export const inspectionQuery = z.object({ objectId: z.uuid().optional(), mode: z.enum(["wireframe", "normals", "unlit", "neutral"]).default("neutral"), view: z.coerce.number().int().min(0).max(5).default(0), source: z.enum(["current", "previous"]).default("current") }).strict();

const transformSchema = z.object({ id: z.uuid(), modelAssetId: z.uuid().nullable(), maskAssetId: z.uuid().nullable(), initialTransform: z.unknown(), positionX: z.number(), positionY: z.number(), positionZ: z.number(), rotationX: z.number(), rotationY: z.number(), rotationZ: z.number(), rotationW: z.number(), scaleX: z.number(), scaleY: z.number(), scaleZ: z.number() });
export const qualityStateSchema = z.object({
  version: z.literal("coordinated-quality-v1"), appliedAt: z.string(), runId: z.string().nullable(),
  backup: z.object({ appearance: z.unknown(), layoutReview: z.unknown(), objects: z.array(transformSchema).max(10) }),
  objects: z.array(z.object({
    objectId: z.uuid(), previousModelAssetId: z.uuid(), sourceModelAssetId: z.uuid(), modelAssetId: z.uuid(), maskAssetId: z.uuid().nullable(), changed: z.boolean(), reverted: z.boolean(),
    geometry: z.object({ attempted: z.boolean(), accepted: z.boolean(), reasons: z.array(z.string()), operations: z.record(z.string(), z.number()) }),
    bake: z.object({ observed: z.number(), generated: z.number(), inferred: z.number(), unmapped: z.number(), protected: z.number(), seamBefore: z.number(), seamAfter: z.number() }).nullable(), bakeError: z.string().nullable(),
    findings: z.array(z.string()).max(30), review: objectReviewSchema
  })).max(10),
  placement: z.object({ accepted: z.boolean(), moved: z.array(z.string()), tilted: z.array(z.string()), contacts: z.array(contactSchema) }),
  plan: z.object({ planned: z.number().int(), samples: z.number().int(), masks: z.number().int() }).nullable(),
  spark: z.object({ summary: z.string(), corrections: z.record(z.string(), z.string()) }).nullable()
});
export type QualityState = z.infer<typeof qualityStateSchema>;
const planStoreSchema = z.object({ version: z.literal("quality-plan-v1"), entries: z.array(z.object({ objectId: z.uuid(), sourceModelAssetId: z.uuid(), maskAssetId: z.uuid(), plan: qualityPlanObservationSchema, samples: z.record(z.string(), z.uuid()) })).max(10) });

type Row = SceneObject & { model: Asset | null; mask: Asset | null };
async function rgbPhoto(asset: { storageKey: string }) {
  const raw = await sharp(await readLimited(asset.storageKey, 4 * 1024 * 1024)).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(raw.data), width: raw.info.width, height: raw.info.height, channels: 3 as const };
}
async function maskPixels(asset: { storageKey: string }, size: { width: number; height: number }) {
  const m = await sharp(await readLimited(asset.storageKey, 4 * 1024 * 1024)).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (m.info.width !== size.width || m.info.height !== size.height) throw new AppError(422, "MASK_SIZE", "A mask does not match the photo.");
  return new Uint8Array(m.data);
}
// Editor yaw/scale are folded into the saved placement, matching selective retries.
function placementOf(o: SceneObject): Placed {
  const p = modelPlacementSchema.parse(o.initialTransform), q = new Quaternion(o.rotationX, o.rotationY, o.rotationZ, o.rotationW);
  return { id: o.id, position: [o.positionX, o.positionY, o.positionZ], placement: { ...p, rotation: q.clone().multiply(new Quaternion(...p.rotation)).toArray() as [number, number, number, number], offset: new Vector3(...p.offset).multiplyScalar(o.scaleX).applyQuaternion(q).toArray() as [number, number, number], scale: p.scale.map(v => v * o.scaleX) as [number, number, number], size: p.size.map(v => v * o.scaleX) as [number, number, number] } };
}

// Shared loader for the free pass, the paid run steps and inspection views.
async function qualityContext(scene: Awaited<ReturnType<typeof ownedScene>>) {
  const db = getDb(), settings = record(scene.settings), composition = compositionSchema.safeParse(scene.stage);
  if (!scene.normalizedAsset) throw new AppError(422, "PHOTO_REQUIRED", "The reference photo is unavailable.");
  if (!composition.success || composition.data.layoutSource === "manual-stage") throw new AppError(422, "LAYOUT_REQUIRED", "Use Match photo layout before the quality pass.");
  const size = { width: scene.normalizedAsset.width!, height: scene.normalizedAsset.height! };
  const all = await db.sceneObject.findMany({ where: { sceneId: scene.id }, include: { model: true, mask: true }, orderBy: { sortOrder: "asc" } });
  if (all.some(o => record(o.provenance).replacementBackup)) throw new AppError(409, "REPLACEMENTS_ACTIVE", "Restore original objects before the quality pass.");
  const objects = all.filter(o => o.status === "READY" && o.visible && o.model?.status === "READY" && o.model.sceneId === scene.id && o.mask?.status === "READY" && o.mask.sceneId === scene.id && !isBackgroundSurface(o, size)) as (Row & { model: Asset; mask: Asset })[];
  if (!objects.length || objects.length > 10) throw new AppError(422, "QUALITY_INPUTS", "The quality pass needs one to ten saved meshes with reviewed masks.");
  const state = qualityStateSchema.safeParse(settings.quality).data, appearance = record(settings.appearance), baked = Array.isArray(appearance.models) ? appearance.models.map(record) : [];
  // Start from the meshes before any earlier quality pass or photo bake, so
  // repeated runs never stack bakes on bakes.
  const sources = await Promise.all(objects.map(async o => {
    const id = state?.objects.find(e => e.objectId === o.id && e.modelAssetId === o.modelAssetId)?.sourceModelAssetId ?? (baked.find(m => m.objectId === o.id && m.bakedId === o.modelAssetId)?.originalId as string | undefined) ?? o.modelAssetId!;
    const asset = id === o.model.id ? o.model : await db.asset.findFirst({ where: { id, sceneId: scene.id, kind: "MODEL_GLB", status: "READY" } });
    if (!asset) throw new AppError(422, "ORIGINAL_UNAVAILABLE", "A source mesh is unavailable.");
    const bytes = await readLimited(asset.storageKey, 40 * 1024 * 1024); inspectGlb(bytes);
    return { asset, bytes };
  }));
  const ids = new Set(objects.map(o => o.id)), rootOf = (o: SceneObject) => { const p = record(o.provenance).parentObjectId; return typeof p === "string" && ids.has(p) ? p : null; };
  const roots = objects.filter(o => !rootOf(o));
  return { settings, state, composition: composition.data, size, objects, sources, roots, rootOf, placements: roots.map(placementOf) };
}

export async function improveSceneQuality(sceneId: string, ownerId: string, expectedRevision: number, extra: { runId?: string; plans?: Map<string, { plan: QualityPlanObservation; samples: Map<string, PixelImage4> }>; masks?: Map<string, string>; planStats?: QualityState["plan"]; planStore?: unknown } = {}) {
  const scene = await ownedScene(sceneId, ownerId), db = getDb();
  if (scene.status !== "READY" || scene.revision !== expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "Reload the ready scene before the quality pass.");
  if (!extra.runId && await db.generationRun.count({ where: { sceneId, status: { in: [...active] } } })) throw new AppError(409, "RUN_ACTIVE", "Wait for generation to finish.");
  const ctx = await qualityContext(scene), photo = await rgbPhoto(scene.normalizedAsset!);
  const maskIds = new Map(ctx.objects.map(o => [o.id, extra.masks?.get(o.id) ?? o.maskAssetId!]));
  const maskAssets = await db.asset.findMany({ where: { id: { in: [...maskIds.values()] }, sceneId, kind: "MASK", status: "READY" } });
  const objects: PipelineObject[] = await Promise.all(ctx.objects.map(async (o, i) => {
    const p = record(o.provenance), asset = maskAssets.find(a => a.id === maskIds.get(o.id)); if (!asset) throw new AppError(422, "MASK_UNAVAILABLE", "A reviewed mask is unavailable.");
    const plan = extra.plans?.get(o.id);
    return { id: o.id, label: o.label, bytes: ctx.sources[i].bytes, mask: await maskPixels(asset, ctx.size), support: String(p.support ?? "unknown"), supportedById: typeof p.supportedByObjectId === "string" ? p.supportedByObjectId : null,
      rootId: ctx.rootOf(o), repairable: !ctx.rootOf(o) && !ctx.objects.some(c => ctx.rootOf(c) === o.id) && typeof p.assemblyBaseAssetId !== "string", plan: plan?.plan ?? null, samples: plan?.samples ?? new Map() };
  }));
  const result = await runQualityPipeline({ objects, placements: ctx.placements, composition: ctx.composition, photo });
  const created = new Map<string, string>();
  for (const [i, r] of result.objects.entries()) {
    if (!r.changed) continue;
    inspectGlb(r.bytes);
    const id = randomUUID(), key = `${storagePrefix()}/scenes/${sceneId}/quality/${id}.glb`, digest = geometryDigest(readMesh(r.bytes), sha);
    await putObject(key, r.bytes, "model/gltf-binary");
    await db.asset.create({ data: { id, sceneId, kind: "MODEL_GLB", status: "READY", bucket: bucket(), storageKey: key, mimeType: "model/gltf-binary", byteSize: r.bytes.length, sha256: sha(r.bytes), readyAt: new Date(), derivedFromId: ctx.sources[i].asset.id,
      provenance: json({ source: "coordinated-quality-v1", runId: extra.runId ?? null, sourceModelAssetId: ctx.sources[i].asset.id, photoId: scene.normalizedAssetId, maskAssetId: maskIds.get(r.id), geometrySha: digest.geometry, uvSha: digest.uv, geometryRepaired: r.geometry.accepted, bake: "coverage" in r.bake ? r.bake.coverage : null }) } });
    created.set(r.id, id);
  }
  const previous = ctx.state?.backup ?? { appearance: ctx.settings.appearance ?? null, layoutReview: ctx.settings.layoutReview ?? null, objects: ctx.objects.map(o => transformSchema.parse(o)) };
  const moved = new Set(result.placement.moved), byId = new Map(result.placements.map(p => [p.id, p]));
  const state: QualityState = {
    version: "coordinated-quality-v1", appliedAt: new Date().toISOString(), runId: extra.runId ?? null, backup: previous,
    objects: result.objects.map((r, i) => ({ objectId: r.id, previousModelAssetId: ctx.objects[i].modelAssetId!, sourceModelAssetId: ctx.sources[i].asset.id, modelAssetId: created.get(r.id) ?? ctx.sources[i].asset.id, maskAssetId: maskIds.get(r.id) ?? null, changed: r.changed, reverted: r.reverted,
      geometry: { attempted: r.geometry.attempted, accepted: r.geometry.accepted, reasons: r.geometry.reasons.slice(0, 6), operations: r.geometry.operations },
      bake: "coverage" in r.bake ? { ...r.bake.coverage, seamBefore: r.bake.seams.before, seamAfter: r.bake.seams.after, regions: undefined } : null, bakeError: "error" in r.bake ? r.bake.error : null,
      findings: r.diagnostics.before.findings.map(f => `${f.layer}:${f.code}`).slice(0, 30), review: r.review })),
    placement: { accepted: result.placement.accepted, moved: result.placement.moved, tilted: result.placement.tilted, contacts: result.placement.after },
    plan: extra.planStats ?? null, spark: null
  };
  for (const entry of state.objects) if (entry.bake) delete (entry.bake as Record<string, unknown>).regions;
  const roots = new Set(ctx.roots.map(r => r.id));
  const layoutReview = { version: "mask-layout-v1" as const, objects: result.placement.after.filter(c => roots.has(c.id)).map(c => { const b = result.placement.before.find(e => e.id === c.id); return { id: c.id, label: c.label, before: b?.iou ?? c.iou, after: c.iou, adjusted: moved.has(c.id), orientationAdjusted: result.placement.tilted.includes(c.id), collision: c.collisions.length > 0, needsReview: c.iou < .65 || c.collisions.length > 0 }; }), needsReview: false };
  layoutReview.needsReview = layoutReview.objects.some(o => o.needsReview);
  await db.$transaction(async tx => {
    const changed = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: expectedRevision, status: "READY", archivedAt: null }, data: {
      settings: json({ ...ctx.settings, quality: state, appearance: surfacesOnly(previous.appearance), layoutBackup: null, layoutReview: layoutReviewSchema.parse(layoutReview), ...(extra.planStore ? { qualityPlan: extra.planStore } : {}) }), revision: { increment: 1 } } });
    if (!changed.count) throw new AppError(409, "REVISION_CONFLICT", "The scene changed during the quality pass. Its saved models are unchanged.");
    for (const o of ctx.objects) {
      const entry = state.objects.find(e => e.objectId === o.id)!, root = ctx.rootOf(o) ?? o.id, pose = moved.has(root) ? byId.get(root) : undefined;
      if (entry.modelAssetId === o.modelAssetId && !pose && entry.maskAssetId === o.maskAssetId) continue;
      const update = await tx.sceneObject.updateMany({ where: { id: o.id, sceneId, modelAssetId: o.modelAssetId }, data: { modelAssetId: entry.modelAssetId, ...(entry.maskAssetId && entry.maskAssetId !== o.maskAssetId ? { maskAssetId: entry.maskAssetId } : {}),
        ...(pose ? { positionX: pose.position[0], positionY: pose.position[1], positionZ: pose.position[2], rotationX: 0, rotationY: 0, rotationZ: 0, rotationW: 1, scaleX: 1, scaleY: 1, scaleZ: 1, initialTransform: json(pose.placement) } : {}) } });
      if (!update.count) throw new AppError(409, "MODEL_CHANGED", "A mesh changed during the quality pass. Reload and try again.");
    }
  }, { timeout: 20_000 });
  return state;
}

// Object bakes are replaced; photographed floor/wall surfaces stay published.
function surfacesOnly(appearance: unknown) {
  const a = record(appearance), floorId = typeof a.floorId === "string" ? a.floorId : null, wallId = typeof a.wallId === "string" ? a.wallId : null;
  return floorId || wallId ? { floorId, wallId } : null;
}

export async function restoreSceneQuality(sceneId: string, ownerId: string, expectedRevision: number) {
  const scene = await ownedScene(sceneId, ownerId), db = getDb(), settings = record(scene.settings), state = qualityStateSchema.safeParse(settings.quality);
  if (!state.success) throw new AppError(409, "NO_QUALITY_BACKUP", "No quality pass is applied.");
  if (scene.status !== "READY" || scene.revision !== expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "Reload the ready scene before restoring.");
  if (await db.generationRun.count({ where: { sceneId, status: { in: [...active] } } })) throw new AppError(409, "RUN_ACTIVE", "Wait for generation to finish.");
  let skipped = 0;
  await db.$transaction(async tx => {
    const changed = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: expectedRevision, status: "READY", archivedAt: null }, data: { settings: json({ ...settings, quality: null, appearance: state.data.backup.appearance ?? null, layoutReview: state.data.backup.layoutReview ?? null }), revision: { increment: 1 } } });
    if (!changed.count) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before restoring.");
    for (const saved of state.data.backup.objects) {
      const entry = state.data.objects.find(e => e.objectId === saved.id);
      // An object retried or edited into another model since keeps that model.
      const { id, initialTransform, ...fields } = saved;
      const update = await tx.sceneObject.updateMany({ where: { id, sceneId, ...(entry ? { modelAssetId: entry.modelAssetId } : {}) }, data: { ...fields, initialTransform: json(initialTransform) } });
      if (!update.count) skipped++;
    }
  }, { timeout: 20_000 });
  return { skipped };
}

// Private PNG views for the owner. Source photos and masks are never returned.
export async function qualityInspection(sceneId: string, ownerId: string, query: z.infer<typeof inspectionQuery>) {
  const scene = await ownedScene(sceneId, ownerId), ctx = await qualityContext(scene);
  if (!query.objectId) {
    const objects = await Promise.all(ctx.objects.map(async (o, i) => ({ bytes: query.source === "previous" ? ctx.sources[i].bytes : await readLimited(o.model.storageKey, 40 * 1024 * 1024), placement: ctx.placements.find(p => p.id === (ctx.rootOf(o) ?? o.id))! })));
    const width = Math.min(960, ctx.size.width), height = Math.round(width * ctx.size.height / ctx.size.width);
    return referenceView(objects, ctx.composition, width, height, query.mode === "neutral" ? "neutral" : query.mode);
  }
  const index = ctx.objects.findIndex(o => o.id === query.objectId);
  if (index < 0) throw new AppError(404, "NOT_FOUND", "Object not found.");
  const bytes = query.source === "previous" ? ctx.sources[index].bytes : await readLimited(ctx.objects[index].model.storageKey, 40 * 1024 * 1024);
  return inspectionView(bytes, query.mode, query.view);
}

// ---- Explicit paid Meta steps. Each provider call is recorded before any
// scene write, is never resubmitted automatically, and saved results are
// reused for the same mesh and mask.
async function runContext(runId: string) {
  const db = getDb(), run = await db.generationRun.findUniqueOrThrow({ where: { id: runId }, include: { scene: true } });
  if (!["RUNNING", "WAITING"].includes(run.status) || run.scene.archivedAt || run.expiresAt < new Date()) throw new Error("QUALITY_RUN_STALE");
  return run;
}
async function step<T>(runId: string, key: string, provider: "META" | "INTERNAL", modelId: string | null, action: () => Promise<{ output: T; requestId?: string | null; responseAssetId?: string | null; imageCount?: number; usage?: { prompt_tokens?: number; completion_tokens?: number } | null }>) {
  const db = getDb(), prior = await db.generationStep.findUnique({ where: { runId_key_attempt: { runId, key, attempt: 1 } } });
  if (prior) { if (prior.status === "SUCCEEDED") return prior.output as T; throw new Error("SUBMISSION_UNCERTAIN"); }
  const created = await db.generationStep.create({ data: { runId, key, provider, modelId, status: "RUNNING", startedAt: new Date() } });
  try {
    const result = await action();
    await db.generationStep.update({ where: { id: created.id }, data: { status: "SUCCEEDED", output: json(result.output), providerRequestId: result.requestId ?? null, responseAssetId: result.responseAssetId ?? null, imageCount: result.imageCount, inputTokens: result.usage?.prompt_tokens, outputTokens: result.usage?.completion_tokens, completedAt: new Date() } });
    return result.output;
  } catch (e) {
    const status = typeof record(e).status === "number" ? Number(record(e).status) : null;
    await db.generationStep.update({ where: { id: created.id }, data: { status: provider === "META" && !(status && status >= 400 && status < 500) ? "SUBMISSION_UNCERTAIN" : "FAILED", errorCode: status ? `META_HTTP_${status}` : e instanceof Error ? e.message.slice(0, 80) : "QUALITY_STEP", errorMessage: e instanceof Error ? e.message.replace(/data:[^\s"']+|https?:\/\/[^\s"']+/g, "[redacted]").slice(0, 900) : null, completedAt: new Date() } });
    throw e;
  }
}
async function privateAsset(sceneId: string, runId: string, bytes: Buffer, kind: "PROVIDER_RESPONSE" | "SURFACE_TEXTURE" | "MASK", mimeType: string, purpose: string, size?: { width: number; height: number }) {
  const id = randomUUID(), key = `${storagePrefix()}/scenes/${sceneId}/runs/${runId}/${id}`;
  await putObject(key, bytes, mimeType);
  return getDb().asset.create({ data: { id, sceneId, kind, status: "READY", bucket: bucket(), storageKey: key, mimeType, byteSize: bytes.length, sha256: sha(bytes), readyAt: new Date(), ...size, provenance: { runId, source: "coordinated-quality-v1", purpose } } });
}
const runInput = (input: unknown) => z.object({ objectIds: z.array(z.uuid()).max(10).optional(), materials: z.boolean().default(true), masks: z.boolean().default(true), review: z.boolean().default(true) }).strict().parse(record(input).quality ?? {});

async function overlay(photo: Buffer, mask: Uint8Array, size: { width: number; height: number }) {
  const edge = Buffer.alloc(size.width * size.height * 4);
  for (let y = 1; y < size.height - 1; y++) for (let x = 1; x < size.width - 1; x++) {
    const i = y * size.width + x, inside = mask[i] > 127;
    if (inside && [i - 1, i + 1, i - size.width, i + size.width].some(n => mask[n] <= 127)) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) { const j = ((y + dy) * size.width + x + dx) * 4; edge[j] = 255; edge[j + 1] = 0; edge[j + 2] = 255; edge[j + 3] = 255; }
  }
  return sharp(photo).resize(size.width, size.height).composite([{ input: await sharp(edge, { raw: { ...size, channels: 4 } }).png().toBuffer() }]).resize({ width: 1024, height: 1024, fit: "inside" }).png().toBuffer();
}
async function diagnosticsSheet(bytes: Buffer) {
  const views = [["wireframe", 0], ["normals", 0], ["unlit", 0], ["neutral", 1], ["unlit", 4], ["unlit", 5]] as const;
  const tiles = await Promise.all(views.map(([mode, view]) => inspectionView(bytes, mode, view, 256)));
  return sharp({ create: { width: 768, height: 512, channels: 3, background: "#ffffff" } }).composite(tiles.map((input, i) => ({ input, left: (i % 3) * 256, top: Math.floor(i / 3) * 256 }))).png().toBuffer();
}

export async function planQualityRun(runId: string) {
  const run = await runContext(runId), scene = await ownedScene(run.sceneId, run.scene.ownerId), ctx = await qualityContext(scene), options = runInput(run.input);
  if (scene.revision !== run.inputRevision) throw new Error("QUALITY_REVISION_CHANGED");
  const store = planStoreSchema.safeParse(ctx.settings.qualityPlan).data, photoBytes = await readLimited(scene.normalizedAsset!.storageKey, 4 * 1024 * 1024);
  await getDb().generationRun.update({ where: { id: runId }, data: { currentStage: "Analyzing structure and materials", progress: 10 } });
  const { planObjectQuality } = await import("@/lib/ai/quality");
  const targets = ctx.objects.filter(o => !options.objectIds || options.objectIds.includes(o.id));
  for (const [n, o] of targets.entries()) {
    const i = ctx.objects.indexOf(o), source = ctx.sources[i].asset.id;
    if (store?.entries.some(e => e.objectId === o.id && e.sourceModelAssetId === source && e.maskAssetId === o.maskAssetId)) continue;
    await step(runId, `quality-plan-${o.id}`, "META", process.env.META_ANALYSIS_MODEL ?? "muse-spark-1.3", async () => {
      const mask = await maskPixels(o.mask, ctx.size), findings = diagnoseMesh(readMesh(ctx.sources[i].bytes)).findings.map(f => `${f.layer}:${f.code}:${f.value.toFixed(3)}`);
      const result = await planObjectQuality(await sharp(photoBytes).resize({ width: 1024, height: 1024, fit: "inside" }).webp().toBuffer(), await overlay(photoBytes, mask, ctx.size), await diagnosticsSheet(ctx.sources[i].bytes), { label: o.label, findings });
      const raw = await privateAsset(scene.id, runId, Buffer.from(result.raw), "PROVIDER_RESPONSE", "application/json", "quality-plan");
      return { output: { objectId: o.id, sourceModelAssetId: source, maskAssetId: o.maskAssetId, plan: result.value }, requestId: result.requestId, responseAssetId: raw.id, usage: result.usage };
    });
    await getDb().generationRun.update({ where: { id: runId }, data: { progress: 10 + Math.round(30 * (n + 1) / targets.length) } });
  }
}

const planOutput = z.object({ objectId: z.uuid(), sourceModelAssetId: z.uuid(), maskAssetId: z.uuid().nullable(), plan: qualityPlanObservationSchema });
async function runPlans(runId: string, ctx: Awaited<ReturnType<typeof qualityContext>>) {
  const steps = await getDb().generationStep.findMany({ where: { runId, status: "SUCCEEDED", key: { startsWith: "quality-plan-" } } });
  const store = planStoreSchema.safeParse(ctx.settings.qualityPlan).data, plans = new Map<string, { plan: QualityPlanObservation; samples: Record<string, string>; sourceModelAssetId: string; maskAssetId: string }>();
  for (const e of store?.entries ?? []) plans.set(e.objectId, { plan: e.plan, samples: e.samples, sourceModelAssetId: e.sourceModelAssetId, maskAssetId: e.maskAssetId });
  for (const s of steps) { const v = planOutput.safeParse(s.output); if (v.success && v.data.maskAssetId) plans.set(v.data.objectId, { plan: v.data.plan, samples: {}, sourceModelAssetId: v.data.sourceModelAssetId, maskAssetId: v.data.maskAssetId }); }
  // A saved plan only applies to the same source mesh and reviewed mask.
  for (const [id, p] of plans) { const i = ctx.objects.findIndex(o => o.id === id); if (i < 0 || ctx.sources[i].asset.id !== p.sourceModelAssetId || ctx.objects[i].maskAssetId !== p.maskAssetId) plans.delete(id); }
  return plans;
}

export async function refineQualityMasks(runId: string) {
  const run = await runContext(runId), scene = await ownedScene(run.sceneId, run.scene.ownerId), ctx = await qualityContext(scene), options = runInput(run.input);
  if (!options.masks) return;
  const plans = await runPlans(runId, ctx), photoBytes = await readLimited(scene.normalizedAsset!.storageKey, 4 * 1024 * 1024);
  const { segmentConcept } = await import("@/lib/ai/segment"), { render, renderMesh, maskOverlap } = await import("@/lib/quality/render"), { placementMatrix } = await import("@/lib/quality/placement"), { photoCamera } = await import("@/lib/appearance/bake");
  const candidates = [...plans].filter(([, p]) => p.plan.maskCorrections.length).slice(0, 3);
  for (const [id, p] of candidates) {
    const o = ctx.objects.find(v => v.id === id)!, i = ctx.objects.indexOf(o), bounds = pixelBoxSchema.safeParse(o.imageBounds).data;
    await getDb().generationRun.update({ where: { id: runId }, data: { currentStage: `Refining outline: ${o.label}`.slice(0, 120) } });
    await step(runId, `quality-mask-${id}`, "META", process.env.META_SEGMENTATION_MODEL ?? "sam-3.1", async () => {
      const points = p.plan.maskCorrections.map(c => ({ x: Math.min(ctx.size.width - 1, Math.round(c.x * ctx.size.width)), y: Math.min(ctx.size.height - 1, Math.round(c.y * ctx.size.height)), label: c.kind === "include" ? "positive" as const : "negative" as const }));
      const result = await segmentConcept(`data:image/webp;base64,${photoBytes.toString("base64")}`, o.label, ctx.size, { label: o.label.slice(0, 120), concept: "", mode: "spatial", points, ...(bounds ? { box: bounds } : {}) });
      const old = await maskPixels(o.mask, ctx.size), pose = ctx.placements.find(v => v.id === (ctx.rootOf(o) ?? o.id))!, w = 256, h = Math.round(w * ctx.size.height / ctx.size.width);
      const frame = render([renderMesh(readMesh(ctx.sources[i].bytes), placementMatrix(pose), 0)], photoCamera(ctx.composition.camera), w, h, "depth");
      const fit = (m: Uint8Array) => maskOverlap(frame.owners, w, h, m, ctx.size.width, ctx.size.height, 0).iou, area = (m: Uint8Array) => m.reduce((s, v) => s + Number(v > 127), 0);
      let accepted: string | null = null, best = fit(old);
      for (const mask of result.masks) {
        const pixels = new Uint8Array(await sharp(mask.png).greyscale().raw().toBuffer()), ratio = area(pixels) / Math.max(1, area(old)), score = fit(pixels);
        // A refined outline must agree better with the saved mesh and stay
        // close to the reviewed outline; otherwise the reviewed mask stays.
        if (ratio < .8 || ratio > 1.25 || score < best + .01) continue;
        const stored = await privateAsset(scene.id, runId, mask.png, "MASK", "image/png", "quality-mask-refinement", ctx.size); accepted = stored.id; best = score;
      }
      return { output: { objectId: id, maskAssetId: accepted, iouBefore: fit(old), iouAfter: best }, requestId: result.requestId ?? null, imageCount: 1 };
    });
  }
}

export async function sampleQualityMaterials(runId: string) {
  const run = await runContext(runId), scene = await ownedScene(run.sceneId, run.scene.ownerId), ctx = await qualityContext(scene), options = runInput(run.input);
  if (!options.materials) return;
  const plans = await runPlans(runId, ctx), photoBytes = await readLimited(scene.normalizedAsset!.storageKey, 4 * 1024 * 1024), { generateMaterialSample } = await import("@/lib/ai/quality");
  let total = 0;
  for (const [id, p] of plans) for (const material of p.plan.materials.filter(m => m.confidence >= .6).slice(0, 2)) {
    if (total >= 8 || p.samples[material.id]) continue; total++;
    await getDb().generationRun.update({ where: { id: runId }, data: { currentStage: `Generating material sample: ${material.name}`.slice(0, 120), progress: 50 + total * 3 } });
    await step(runId, `quality-sample-${id}-${material.id}`, "META", process.env.META_IMAGE_MODEL ?? "muse-image-1.0", async () => {
      const b = material.evidence, left = Math.max(0, Math.floor(b.x0 * ctx.size.width)), top = Math.max(0, Math.floor(b.y0 * ctx.size.height));
      const width = Math.max(16, Math.min(ctx.size.width - left, Math.ceil((b.x1 - b.x0) * ctx.size.width))), height = Math.max(16, Math.min(ctx.size.height - top, Math.ceil((b.y1 - b.y0) * ctx.size.height)));
      const crop = await sharp(photoBytes).extract({ left, top, width, height }).resize({ width: 512, height: 512, fit: "inside" }).png().toBuffer();
      const result = await generateMaterialSample(material, crop);
      const stored = await privateAsset(scene.id, runId, await sharp(result.bytes).resize({ width: 1024, height: 1024, fit: "inside" }).png().toBuffer(), "SURFACE_TEXTURE", "image/png", `quality-sample:${material.id}`);
      return { output: { objectId: id, regionId: material.id, assetId: stored.id }, responseAssetId: stored.id, imageCount: 1 };
    });
  }
}

export async function applyQualityRun(runId: string) {
  const run = await runContext(runId), scene = await ownedScene(run.sceneId, run.scene.ownerId), ctx = await qualityContext(scene), db = getDb();
  if (scene.revision !== run.inputRevision) throw new Error("QUALITY_REVISION_CHANGED");
  await db.generationRun.update({ where: { id: runId }, data: { currentStage: "Repairing, baking and placing", progress: 75 } });
  const plans = await runPlans(runId, ctx), steps = await db.generationStep.findMany({ where: { runId, status: "SUCCEEDED", key: { startsWith: "quality-" } } });
  for (const s of steps) { const o = record(s.output); if (typeof o.regionId === "string" && typeof o.assetId === "string") { const p = plans.get(String(o.objectId)); if (p) p.samples[o.regionId] = o.assetId; } }
  const masks = new Map<string, string>(); for (const s of steps) { const o = record(s.output); if (s.key.startsWith("quality-mask-") && typeof o.maskAssetId === "string") masks.set(String(o.objectId), o.maskAssetId); }
  const resolved = new Map<string, { plan: QualityPlanObservation; samples: Map<string, PixelImage4> }>();
  for (const [id, p] of plans) {
    const samples = new Map<string, PixelImage4>();
    for (const [region, assetId] of Object.entries(p.samples)) {
      const asset = await db.asset.findFirst({ where: { id: assetId, sceneId: scene.id, kind: "SURFACE_TEXTURE", status: "READY" } }); if (!asset) continue;
      const raw = await sharp(await readLimited(asset.storageKey, 16 * 1024 * 1024)).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      samples.set(region, { data: new Uint8Array(raw.data), width: raw.info.width, height: raw.info.height });
    }
    resolved.set(id, { plan: p.plan, samples });
  }
  const planStore = { version: "quality-plan-v1", entries: [...plans].map(([objectId, p]) => ({ objectId, sourceModelAssetId: p.sourceModelAssetId, maskAssetId: p.maskAssetId, plan: p.plan, samples: p.samples })) };
  await improveSceneQuality(scene.id, scene.ownerId, run.inputRevision, { runId, plans: resolved, masks, planStore, planStats: { planned: plans.size, samples: [...plans.values()].reduce((s, p) => s + Object.keys(p.samples).length, 0), masks: masks.size } });
}

// Spark reviews the persisted final output. Only numerically supported
// per-object reverts are applied, once, under the post-apply revision.
export async function reviewQualityRun(runId: string) {
  const run = await runContext(runId), db = getDb(), options = runInput(run.input), scene = await ownedScene(run.sceneId, run.scene.ownerId);
  const finish = (message: string | null, partial = false) => db.generationRun.update({ where: { id: runId }, data: { status: partial ? "PARTIAL" : "SUCCEEDED", progress: 100, currentStage: "Quality pass complete", errorMessage: message, completedAt: new Date() } });
  const state = qualityStateSchema.safeParse(record(scene.settings).quality).data;
  if (!state || state.runId !== runId || scene.revision !== run.inputRevision + 1) return finish("The quality pass was saved; the final review was skipped because the scene changed.", true);
  if (!options.review) return finish(state.objects.some(o => o.review.verdict !== "PASS") ? "Some objects still need a look. See the quality report." : null, state.objects.some(o => o.review.verdict !== "PASS"));
  await db.generationRun.update({ where: { id: runId }, data: { currentStage: "Reviewing final renders", progress: 92 } });
  const ctx = await qualityContext(scene), photo = await readLimited(scene.normalizedAsset!.storageKey, 4 * 1024 * 1024), ids = ctx.objects.map(o => o.id);
  const output = await step(runId, "quality-review", "META", process.env.META_ANALYSIS_MODEL ?? "muse-spark-1.3", async () => {
    const current = await Promise.all(ctx.objects.map(async o => readLimited(o.model.storageKey, 40 * 1024 * 1024)));
    const width = Math.min(960, ctx.size.width), height = Math.round(width * ctx.size.height / ctx.size.width);
    const images = [await sharp(photo).resize({ width: 1024, height: 1024, fit: "inside" }).webp().toBuffer(), await referenceView(ctx.objects.map((o, i) => ({ bytes: current[i], placement: ctx.placements.find(p => p.id === (ctx.rootOf(o) ?? o.id))! })), ctx.composition, width, height)];
    for (const bytes of current.slice(0, 4)) { const views = await Promise.all([0, 1, 2, 4, 5].map(v => inspectionView(bytes, "neutral", v, 192))); images.push(await sharp({ create: { width: 960, height: 192, channels: 3, background: "#ffffff" } }).composite(views.map((input, k) => ({ input, left: k * 192, top: 0 }))).png().toBuffer()); }
    const diagnostics = state.objects.map((o, k) => ({ id: `object-${k + 1}`, label: ctx.objects.find(v => v.id === o.objectId)?.label, verdict: o.review.verdict, metrics: o.review.metrics, issues: o.review.issues.map(i => i.type), contact: state.placement.contacts.find(c => c.id === o.objectId) ?? null }));
    const { reviewFinalRenders } = await import("@/lib/ai/quality"), result = await reviewFinalRenders(images, diagnostics);
    const raw = await privateAsset(scene.id, runId, Buffer.from(result.raw), "PROVIDER_RESPONSE", "application/json", "quality-review");
    return { output: result.value, requestId: result.requestId, responseAssetId: raw.id, usage: result.usage };
  });
  const review = qualityReviewObservationSchema.parse(output), reviews = state.objects.map(o => structuredClone(o.review)), corrections = mergeSparkReview(reviews, review, ids);
  const reverts = [...corrections].filter(([, c]) => c === "revert-object").map(([id]) => id);
  const next: QualityState = { ...state, objects: state.objects.map((o, k) => ({ ...o, review: reviews[k], ...(reverts.includes(o.objectId) ? { modelAssetId: o.sourceModelAssetId, reverted: true } : {}) })), spark: { summary: review.summary.slice(0, 400), corrections: Object.fromEntries(corrections) } };
  await db.$transaction(async tx => {
    const changed = await tx.scene.updateMany({ where: { id: scene.id, revision: run.inputRevision + 1, status: "READY", archivedAt: null }, data: { settings: json({ ...record(scene.settings), quality: next }), revision: { increment: 1 } } });
    if (!changed.count) throw new Error("QUALITY_REVIEW_STALE");
    for (const id of reverts) {
      // The pre-bake source mesh, consistent with the cleared photo-bake state.
      const entry = state.objects.find(o => o.objectId === id)!;
      const update = await tx.sceneObject.updateMany({ where: { id, sceneId: scene.id, modelAssetId: entry.modelAssetId }, data: { modelAssetId: entry.sourceModelAssetId } });
      if (!update.count) throw new Error("QUALITY_REVIEW_MODEL_CHANGED");
    }
  });
  const pending = next.objects.some(o => o.review.verdict !== "PASS");
  await finish(reverts.length ? `Review kept the previous model for ${reverts.length} object(s). Remaining notes are in the quality report.` : pending ? "Some objects still need a look. See the quality report." : null, pending);
}

export function qualitySummary(settings: unknown, labels: Map<string, string>) {
  const state = qualityStateSchema.safeParse(record(settings).quality).data;
  if (!state) return null;
  return { appliedAt: state.appliedAt, paid: Boolean(state.runId), plan: state.plan, spark: state.spark?.summary ?? null, placement: { moved: state.placement.moved.length, tilted: state.placement.tilted.length },
    objects: state.objects.map(o => ({ id: o.objectId, label: labels.get(o.objectId) ?? "Object", verdict: o.review.verdict, reverted: o.reverted, changed: o.changed, geometry: o.geometry.accepted ? Object.entries(o.geometry.operations).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ") || "checked" : "kept",
      coverage: o.bake ? { observed: o.bake.observed, generated: o.bake.generated, inferred: o.bake.inferred, unmapped: o.bake.unmapped } : null, iou: o.review.metrics.iou, notes: o.review.issues.filter(i => i.severity !== "info" || i.type === "reverted").map(i => i.detail).slice(0, 4) })) };
}
