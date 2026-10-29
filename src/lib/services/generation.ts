import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { productSchema } from "@/lib/validation/products";
import { productThumbnail } from "./product-thumbnail";
import { ownedScene } from "./scenes";
import { bucket, storagePrefix, putObject, signRead, readLimited } from "@/lib/storage/r2";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2 } from "@/lib/storage/r2";
import { analyzePhoto } from "@/lib/ai/analyze";
import { segmentConcept } from "@/lib/ai/segment";
import { getSam3dClient } from "@/lib/ai/sam3d";
import { downloadFalArtifact, inspectGlb } from "@/lib/ai/glb";
import { composeRoom, compositionSchema, glbBounds, modelPlacementSchema, type CompositionInput } from "@/lib/scene/composition";
import { defaultLighting, lightingSchema } from "@/lib/scene/lighting";
import { record, sceneEnvironment } from "./composition";
import { runInputSchema, objectEditsSchema } from "@/lib/validation/generation";
import type { z } from "zod";
import type { Prisma, AssetKind } from "@/generated/prisma/client";

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const active = ["QUEUED", "RUNNING", "WAITING"] as const;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export async function reserveRun(sceneId: string, ownerId: string, input: z.infer<typeof runInputSchema>) {
  if (process.env.GENERATION_ENABLED !== "true") throw new AppError(503, "GENERATION_DISABLED", "Generation is not enabled yet.");
  const db = getDb();
  await ownedScene(sceneId, ownerId);
  return db.$transaction(async tx => {
    // Serialize generation starts/restarts, including concurrent accounts.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
    const scene = await tx.scene.findFirstOrThrow({ where: { id: sceneId, ownerId, archivedAt: null } });
    const prior = await tx.generationRun.findUnique({ where: { sceneId_idempotencyKey: { sceneId, idempotencyKey: input.idempotencyKey } } });
    if (prior) {
      if (prior.status === "CANCELED" || prior.inputRevision < Number(record(scene.settings).resetRevision ?? 0)) throw new AppError(409, "RUN_SUPERSEDED", "That attempt belongs to an earlier version of this scene. Start the step again.");
      if (prior.kind !== input.kind || prior.inputRevision !== input.expectedRevision || JSON.stringify((prior.input as { objectIds?: string[] }).objectIds ?? []) !== JSON.stringify(input.objectIds ?? [])) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This request key was used for different inputs.");
      return prior;
    }
    if (scene.revision !== input.expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "Reload this scene before starting.");
    if (!scene.normalizedAssetId) throw new AppError(400, "PHOTO_REQUIRED", "Upload a photo first.");
    const userActive = await tx.generationRun.count({ where: { scene: { ownerId }, status: { in: [...active] } } });
    if (userActive) throw new AppError(409, "RUN_ACTIVE", "Your generation is already running. Open it to see progress.");
    const allowed = input.kind === "ANALYZE" ? ["DRAFT"] : ["REVIEW"];
    if (!allowed.includes(scene.status)) throw new AppError(409, "SCENE_STATE", "This scene is not ready for that operation.");
    if (input.kind === "RECONSTRUCT") {
      const objects = await tx.sceneObject.findMany({ where: { sceneId, id: { in: input.objectIds }, maskAssetId: { not: null }, modelAssetId: null } });
      if (objects.length !== input.objectIds!.length) throw new AppError(400, "INVALID_OBJECTS", "Select objects with reviewed masks.");
    }
    const reserved = input.kind === "ANALYZE" ? 1.42 : 1;
    // Historical estimates remain auditable; Jim removed the app's cumulative spending cap.
    const run = await tx.generationRun.create({ data: { sceneId, kind: input.kind, idempotencyKey: input.idempotencyKey,
      inputRevision: scene.revision, input: { objectIds: input.objectIds ?? [], normalizedAssetId: scene.normalizedAssetId }, reservedCostUsd: reserved,
      expiresAt: new Date(Date.now() + 15 * 60_000), currentStage: "Waiting to start" } });
    await tx.scene.update({ where: { id: sceneId }, data: { status: input.kind === "ANALYZE" ? "ANALYZING" : "RECONSTRUCTING", lastErrorCode: null } });
    return run;
  }, { timeout: 20_000 });
}

export async function claimRun(runId: string, workflowRunId: string) {
  const result = await getDb().generationRun.updateMany({ where: { id: runId, status: "QUEUED", workflowRunId: null },
    data: { status: "RUNNING", workflowRunId, startedAt: new Date(), currentStage: "Starting" } });
  return result.count === 1;
}
async function loadRun(runId: string) {
  const run = await getDb().generationRun.findUniqueOrThrow({ where: { id: runId }, include: { scene: { include: { normalizedAsset: true } } } });
  if (run.status === "CANCELED" || run.scene.archivedAt || run.scene.revision !== run.inputRevision || run.expiresAt < new Date()) throw new Error("RUN_STALE_OR_EXPIRED");
  return run;
}
async function providerInput(asset: { storageKey: string }) { return getSignedUrl(getR2(), new GetObjectCommand({ Bucket: bucket(), Key: asset.storageKey }), { expiresIn: 3600 }); }
// Inline bounded normalized bytes for Meta; avoids intermittent remote media-fetch rejection.
async function metaInput(asset: { storageKey: string }) {
  return `data:image/webp;base64,${(await readLimited(asset.storageKey, 4 * 1024 * 1024)).toString("base64")}`;
}
async function artifact(sceneId: string, runId: string, kind: AssetKind, bytes: Buffer, mimeType: string, size?: { width: number; height: number }) {
  const id = randomUUID();
  const storageKey = `${storagePrefix()}/scenes/${sceneId}/runs/${runId}/${id}`;
  await putObject(storageKey, bytes, mimeType);
  return getDb().asset.create({ data: { id, sceneId, kind, bucket: bucket(), storageKey, mimeType, status: "READY", byteSize: bytes.length,
    sha256: digest(bytes), readyAt: new Date(), ...size, provenance: { runId, source: "meta-generation" } } });
}
async function beginStep(runId: string, key: string, provider: "META" | "FAL", modelId: string) {
  const prior = await getDb().generationStep.findUnique({ where: { runId_key_attempt: { runId, key, attempt: 1 } } });
  if (prior) throw new Error("SUBMISSION_UNCERTAIN");
  return getDb().generationStep.create({ data: { runId, key, provider, modelId, status: "RUNNING", startedAt: new Date() } });
}

export async function analyzeRun(runId: string) {
  const run = await loadRun(runId);
  const image = run.scene.normalizedAsset!;
  await getDb().generationRun.update({ where: { id: runId }, data: { currentStage: "Identifying furniture", progress: 10 } });
  const step = await beginStep(runId, "spark", "META", process.env.META_ANALYSIS_MODEL ?? "muse-spark-1.3");
  const result = await analyzePhoto(await metaInput(image), { width: image.width!, height: image.height! });
  const response = await artifact(run.sceneId, runId, "PROVIDER_RESPONSE", Buffer.from(JSON.stringify(result.raw)), "application/json");
  // Three clear furniture candidates; model order is retained as the source ordinal.
  const candidates = [...result.analysis.objects].sort((a, b) => Number(a.category === "lighting") - Number(b.category === "lighting")).slice(0, 3);
  await getDb().$transaction(async tx => {
    await tx.generationStep.update({ where: { id: step.id }, data: { status: "SUCCEEDED", providerRequestId: result.requestId, responseAssetId: response.id,
      inputTokens: result.usage?.prompt_tokens, outputTokens: result.usage?.completion_tokens,
      costUsd: ((result.usage?.prompt_tokens ?? 0) * 1.25 + (result.usage?.completion_tokens ?? 0) * 4.25) / 1_000_000, completedAt: new Date() } });
    for (const [index, object] of candidates.entries()) await tx.sceneObject.create({ data: { sceneId: run.sceneId, originRunId: runId, sourceOrdinal: index,
      label: object.label, category: object.category, segmentationConcept: object.segmentationConcept, imageBounds: object.bbox, sortOrder: index,
      positionX: ((object.bbox.xMin + object.bbox.xMax) / 2 / image.width! - 0.5) * 5,
      provenance: { model: result.model, promptVersion: result.promptVersion, support: object.support, placement: "approximate-stage" } } });
    await tx.scene.update({ where: { id: run.sceneId }, data: { settings: asJson({ ...record(run.scene.settings), environment: result.analysis.environment }) } });
    await tx.generationRun.update({ where: { id: runId }, data: { currentStage: "Finding object outlines", progress: 25 } });
  });
  return (await getDb().sceneObject.findMany({ where: { sceneId: run.sceneId, originRunId: runId }, orderBy: { sourceOrdinal: "asc" } })).map(o => o.id);
}

export async function segmentRunObject(runId: string, objectId: string) {
  const run = await loadRun(runId);
  const object = await getDb().sceneObject.findFirstOrThrow({ where: { id: objectId, sceneId: run.sceneId, originRunId: runId } });
  const image = run.scene.normalizedAsset!;
  await getDb().generationRun.update({ where: { id: runId }, data: { currentStage: `Outlining ${object.label}`, progress: 30 + object.sourceOrdinal * 15 } });
  const step = await beginStep(runId, `sam-${objectId}`, "META", process.env.META_SEGMENTATION_MODEL ?? "sam-3.1");
  const result = await segmentConcept(await metaInput(image), object.segmentationConcept!, { width: image.width!, height: image.height! });
  const raw = await artifact(run.sceneId, runId, "PROVIDER_RESPONSE", Buffer.from(result.raw), "text/plain");
  // Never silently choose between multiple matches of the same concept.
  if (result.masks.length !== 1) {
    await getDb().sceneObject.update({ where: { id: objectId }, data: { status: "FAILED", lastErrorCode: result.masks.length ? "AMBIGUOUS_MASK" : "NO_MATCH" } });
  } else {
    const mask = result.masks[0];
    const stored = await artifact(run.sceneId, runId, "MASK", mask.png, "image/png", { width: image.width!, height: image.height! });
    await getDb().sceneObject.update({ where: { id: objectId }, data: { maskAssetId: stored.id, confidence: mask.confidence,
      imageBounds: { xMin: mask.bounds.left, yMin: mask.bounds.top, xMax: mask.bounds.right, yMax: mask.bounds.bottom },
      provenance: asJson({ ...record(object.provenance), model: result.model, requestLocalId: mask.objectId, foregroundArea: mask.area }) } });
  }
  await getDb().generationStep.update({ where: { id: step.id }, data: { status: "SUCCEEDED", providerRequestId: result.requestId, responseAssetId: raw.id, imageCount: 1, costUsd: 0.0025, completedAt: new Date() } });
}

export async function finishAnalysis(runId: string) {
  const run = await loadRun(runId);
  await getDb().$transaction(async tx => {
    await tx.scene.update({ where: { id: run.sceneId, revision: run.inputRevision }, data: { status: "REVIEW", revision: { increment: 1 } } });
    await tx.generationRun.update({ where: { id: runId }, data: { status: "SUCCEEDED", currentStage: "Review object outlines", progress: 100, completedAt: new Date() } });
  });
}

export async function submitReconstruction(runId: string) {
  const run = await loadRun(runId);
  const ids = (run.input as { objectIds: string[] }).objectIds;
  const found = await getDb().sceneObject.findMany({ where: { sceneId: run.sceneId, id: { in: ids } }, include: { mask: true } });
  const objects = ids.map(id => found.find(o => o.id === id)!);
  if (objects.some(o => !o?.mask || o.mask.status !== "READY")) throw new Error("MASK_UNAVAILABLE");
  const input = { image_url: await providerInput(run.scene.normalizedAsset!), mask_urls: await Promise.all(objects.map(o => providerInput(o.mask!))), export_textured_glb: true, seed: 42 };
  const step = await beginStep(runId, "sam3d-submit", "FAL", process.env.SAM3D_MODEL ?? "fal-ai/sam-3/3d-objects");
  await getDb().generationRun.update({ where: { id: runId }, data: { currentStage: "Reconstructing 3D objects", progress: 15 } });
  const { client, model } = getSam3dClient();
  const request = await client.queue.submit(model, { input, abortSignal: AbortSignal.timeout(60_000) });
  // Save provider ID immediately. Status/result retries can use this exact job.
  await getDb().generationStep.update({ where: { id: step.id }, data: { providerRequestId: request.request_id, status: "WAITING" } });
  await getDb().generationRun.update({ where: { id: runId }, data: { status: "WAITING", progress: 30 } });
  return request.request_id;
}
export async function pollReconstruction(runId: string, requestId: string) {
  await loadRun(runId);
  const { client, model } = getSam3dClient();
  const response = await client.queue.status(model, { requestId, logs: false, abortSignal: AbortSignal.timeout(30_000) });
  return response.status === "COMPLETED";
}
export async function ingestRun(runId: string, requestId: string) {
  const run = await loadRun(runId);
  const ids = (run.input as { objectIds: string[] }).objectIds;
  const { client, model } = getSam3dClient();
  const response = await client.queue.result(model, { requestId, abortSignal: AbortSignal.timeout(60_000) });
  const result = response.data as { individual_glbs?: { url: string }[]; model_glb?: { url: string }; metadata?: { object_index: number }[] };
  const files = ids.length === 1 ? [result.model_glb!] : result.individual_glbs;
  if (!files || files.length !== ids.length || files.some(f => !f?.url)) throw new Error("INDEPENDENT_MESHES_MISSING");
  await artifact(run.sceneId, runId, "PROVIDER_RESPONSE", Buffer.from(JSON.stringify(result)), "application/json");
  const assets: { id: string }[] = [];
  const layoutInputs: CompositionInput[] = [];
  const objects = await getDb().sceneObject.findMany({ where: { sceneId: run.sceneId, id: { in: ids } } });
  for (const file of files) {
    const bytes = await downloadFalArtifact(file.url);
    inspectGlb(bytes);
    assets.push(await artifact(run.sceneId, runId, "MODEL_GLB", bytes, "model/gltf-binary"));
    const index = assets.length - 1;
    const object = objects.find(o => o.id === ids[index])!;
    try { layoutInputs.push({ id: object.id, metadata: result.metadata?.find(m => m.object_index === index), bounds: glbBounds(bytes),
      imageBounds: object.imageBounds, support: String(record(object.provenance).support ?? "unknown") }); } catch { /* Layout is optional; do not discard a usable mesh. */ }
  }
  let layout: ReturnType<typeof composeRoom> | undefined;
  try {
    if (layoutInputs.length !== ids.length) throw new Error("LAYOUT_BOUNDS_MISSING");
    const environment = await sceneEnvironment(run.scene);
    layout = composeRoom(layoutInputs, { width: run.scene.normalizedAsset!.width!, height: run.scene.normalizedAsset!.height! }, environment.environment, environment.environmentSource);
  } catch { /* Keep independent meshes usable if a provider changes its pose contract. The UI offers manual placement. */ }
  await getDb().$transaction(async tx => {
    for (const [index, id] of ids.entries()) {
      const composed = layout?.objects[index];
      await tx.sceneObject.update({ where: { id, sceneId: run.sceneId }, data: {
      modelAssetId: assets[index].id, representation: "MESH", status: "READY", visible: true,
      ...(composed ? { positionX: composed.position[0], positionY: composed.position[1], positionZ: composed.position[2], rotationX: 0, rotationY: 0, rotationZ: 0, rotationW: 1, scaleX: 1, scaleY: 1, scaleZ: 1 } : {}),
      initialTransform: composed ? asJson(composed.placement) : { placement: "manual-stage", importer: "gltf-y-up-bottom-center-v1" },
      provenance: asJson({ ...record(objects.find(o => o.id === id)!.provenance), provider: "fal", model, requestId, maskInputIndex: index, metadata: result.metadata?.find(m => m.object_index === index), placement: composed ? "sam3d-layout-v1" : "manual-stage" })
    } }); }
    await tx.scene.update({ where: { id: run.sceneId, revision: run.inputRevision }, data: { status: "READY", revision: { increment: 1 },
      ...(layout ? { camera: asJson(layout.composition.camera), stage: asJson(layout.composition) } : {}) } });
    await tx.generationStep.updateMany({ where: { runId, key: "sam3d-submit" }, data: { status: "SUCCEEDED", completedAt: new Date() } });
    await tx.generationRun.update({ where: { id: runId }, data: { status: "SUCCEEDED", currentStage: "Your 3D scene is ready", progress: 100, completedAt: new Date() } });
  });
}
export async function failRun(runId: string) {
  const db = getDb();
  const run = await db.generationRun.findUnique({ where: { id: runId } });
  if (!run || run.status === "SUCCEEDED" || run.status === "CANCELED") return;
  const steps = await db.generationStep.findMany({ where: { runId } });
  const uncertain = steps.some(s => s.status === "RUNNING" && !s.providerRequestId);
  const knownJob = steps.some(s => s.key === "sam3d-submit" && s.providerRequestId && s.status !== "SUCCEEDED");
  await db.$transaction([
    db.generationStep.updateMany({ where: { runId, status: "RUNNING" }, data: { status: uncertain ? "SUBMISSION_UNCERTAIN" : "FAILED" } }),
    db.generationRun.update({ where: { id: runId }, data: { status: "FAILED", errorCode: uncertain ? "SUBMISSION_UNCERTAIN" : knownJob ? "KNOWN_JOB_INTERRUPTED" : "GENERATION_FAILED",
      errorMessage: uncertain ? "The provider response was interrupted. This attempt may have been charged; it will not be submitted again automatically." : knownJob ? "Generation paused. Resume will retrieve the existing job without another submission." : "Generation could not finish. Your photo and completed objects are saved.", completedAt: new Date() } }),
    db.scene.updateMany({ where: { id: run.sceneId, revision: run.inputRevision }, data: { status: "FAILED", lastErrorCode: "GENERATION_FAILED" } })
  ]);
}
export async function workspace(sceneId: string, ownerId: string) {
  const scene = await ownedScene(sceneId, ownerId);
  const [objects, run] = await Promise.all([
    getDb().sceneObject.findMany({ where: { sceneId }, include: { mask: true, model: true, product: { include: { imageAsset: true } } }, orderBy: { sortOrder: "asc" } }),
    getDb().generationRun.findFirst({ where: { sceneId, inputRevision: { gte: Number(record(scene.settings).resetRevision ?? 0) } }, orderBy: { createdAt: "desc" } })
  ]);
  if (run && active.includes(run.status as typeof active[number]) && run.expiresAt < new Date()) {
    await failRun(run.id);
    return workspace(sceneId, ownerId);
  }
  const applied = record(record(scene.settings).appearance);
  async function textureUrl(id: unknown) {
    if (typeof id !== "string") return null;
    const asset = await getDb().asset.findFirst({ where: { id, sceneId, kind: "SURFACE_TEXTURE", status: "READY" } });
    return asset ? signRead(asset) : null;
  }
  const stage = compositionSchema.safeParse(scene.stage).data ?? null;
  return { id: scene.id, title: scene.title, status: scene.status, revision: scene.revision,
    lighting: lightingSchema.safeParse(record(scene.settings).lighting).data ?? defaultLighting(stage),
    appearance: { applied: applied.version === "photo-bake-v1", floorUrl: await textureUrl(applied.floorId), wallUrl: await textureUrl(applied.wallId) },
    composition: compositionSchema.safeParse(scene.stage).data ?? null, canRestoreLayout: Boolean(record(scene.settings).layoutBackup),
    image: scene.normalizedAsset ? { url: await signRead(scene.normalizedAsset), width: scene.normalizedAsset.width!, height: scene.normalizedAsset.height! } : null,
    generationEnabled: process.env.GENERATION_ENABLED === "true", objects: await Promise.all(objects.map(async o => ({
      id: o.id, label: o.label, status: o.status, errorCode: o.lastErrorCode, canRestoreOriginal: Boolean(record(o.provenance).replacementBackup),
      product: o.product && o.product.sceneId === sceneId ? { name: o.product.name, description: o.product.description ?? "", brand: o.product.brand ?? "", price: o.product.price?.toString() ?? null, currency: productSchema.shape.currency.parse(o.product.currency ?? "USD"), productUrl: o.product.productUrl ?? "", imageUrl: o.product.imageAsset?.status === "READY" && o.product.imageAsset.sceneId === sceneId ? await signRead(o.product.imageAsset) : null } : null,
      maskUrl: o.mask ? await signRead(o.mask) : null, modelUrl: o.model ? await signRead(o.model) : null,
      placement: modelPlacementSchema.safeParse(o.initialTransform).data ?? null,
      positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ, yaw: Math.atan2(2 * o.rotationW * o.rotationY, 1 - 2 * o.rotationY * o.rotationY), scale: o.scaleX, visible: o.visible
    }))), run: run ? { id: run.id, kind: run.kind, status: run.status, stage: run.currentStage, progress: run.progress,
      errorCode: run.errorCode, errorMessage: run.errorMessage, canResume: run.status === "QUEUED" || (run.status === "FAILED" && run.errorCode === "KNOWN_JOB_INTERRUPTED") } : null };
}
export async function saveObjects(sceneId: string, ownerId: string, input: z.infer<typeof objectEditsSchema>) {
  const scene = await ownedScene(sceneId, ownerId);
  const thumbnails = new Map<string, string>();
  // Only new product cards need a cutout. Validate every object before any storage work.
  const originals = await getDb().sceneObject.findMany({ where: { sceneId, status: "READY", id: { in: input.objects.map(o => o.id) } } });
  if (originals.length !== input.objects.length) throw new AppError(400, "INVALID_OBJECT", "The selected object is unavailable.");
  if (scene.status !== "READY" || scene.revision !== input.expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before saving.");
  for (const edit of input.objects) {
    const original = originals.find(o => o.id === edit.id)!;
    if (edit.product && !original.productId) {
      const demo = record(original.provenance).replacementBackup ? await getDb().product.findFirst({ where: { sceneId, modelAssetId: original.modelAssetId, attributes: { path: ["catalogVersion"], equals: "demo-v1" } } }) : null;
      const id = demo?.imageAssetId ?? (record(original.provenance).replacementBackup ? null : await productThumbnail(sceneId, original.id));
      if (id) thumbnails.set(edit.id, id);
    }
  }
  await getDb().$transaction(async tx => {
    const count = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, status: "READY", archivedAt: null }, data: { revision: { increment: 1 }, ...(input.lighting ? { settings: asJson({ ...record(scene.settings), lighting: input.lighting }) } : {}) } });
    if (count.count !== 1) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before saving.");
    for (const edit of input.objects) {
      const original = originals.find(o => o.id === edit.id)!;
      let productId = original.productId;
      if (edit.product === null) productId = null;
      else if (edit.product) {
        const fields = { ...edit.product, price: edit.product.price, currency: edit.product.price === null ? null : edit.product.currency, productUrl: edit.product.productUrl || null };
        if (productId) {
          const updated = await tx.product.updateMany({ where: { id: productId, sceneId }, data: fields });
          if (updated.count !== 1) throw new AppError(400, "INVALID_PRODUCT", "The product is unavailable.");
        } else {
          const product = await tx.product.create({ data: { ...fields, sceneId, imageAssetId: thumbnails.get(edit.id) ?? null } });
          productId = product.id;
        }
      }
      const changed = await tx.sceneObject.updateMany({ where: { id: edit.id, sceneId, status: "READY" }, data: {
        productId, label: edit.label, positionX: edit.positionX, positionY: edit.positionY, positionZ: edit.positionZ,
        rotationX: 0, rotationY: Math.sin(edit.yaw / 2), rotationZ: 0, rotationW: Math.cos(edit.yaw / 2),
        scaleX: edit.scale, scaleY: edit.scale, scaleZ: edit.scale, visible: edit.visible
      } });
      if (changed.count !== 1) throw new AppError(400, "INVALID_OBJECT", "The selected object is unavailable.");
    }
  });
}
