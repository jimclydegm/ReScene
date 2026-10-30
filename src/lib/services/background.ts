import { isBackgroundSurface } from "@/lib/scene/surface-role";
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { bucket, storagePrefix, putObject, readLimited } from "@/lib/storage/r2";
import { analyzeBackground, fillBackground } from "@/lib/ai/background";
import { plainBackground } from "@/lib/appearance/plain";
import { fallbackBackground, backgroundPlanSchema } from "@/lib/scene/background";
import { compositionSchema, manualBackgroundComposition } from "@/lib/scene/composition";
import { backgroundFootprint, compositeBackground } from "@/lib/appearance/background";
import { record, sceneEnvironment } from "./composition";

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function buildSceneBackground(runId: string) {
  const db = getDb(), run = await db.generationRun.findUniqueOrThrow({ where: { id: runId }, include: { scene: { include: { normalizedAsset: true } } } });
  const scene = run.scene, savedComposition = compositionSchema.safeParse(scene.stage);
  if (!["RUNNING", "WAITING"].includes(run.status) || scene.status !== "READY" || scene.archivedAt || run.expiresAt < new Date() || !scene.normalizedAsset || scene.normalizedAssetId !== record(run.input).normalizedAssetId) throw new Error("BACKGROUND_RUN_STALE");
  if (run.kind === "IMAGE_EDIT" && scene.revision !== run.inputRevision) throw new Error("BACKGROUND_REVISION_CHANGED");
  const objects = (await db.sceneObject.findMany({ where: { sceneId: scene.id, status: "READY", modelAssetId: { not: null } }, include: { mask: true } })).filter(o=>!isBackgroundSurface(o,{width:scene.normalizedAsset!.width!,height:scene.normalizedAsset!.height!}));
  if (!objects.length || objects.some(o => !o.mask || o.mask.sceneId !== scene.id || o.mask.kind !== "MASK" || o.mask.status !== "READY")) throw new Error("BACKGROUND_MASKS_REQUIRED");
  const environment = savedComposition.success ? null : await sceneEnvironment(scene);
  const composition = savedComposition.success ? savedComposition.data : manualBackgroundComposition(
    { width: scene.normalizedAsset!.width!, height: scene.normalizedAsset!.height! }, environment!.environment, environment!.environmentSource, Math.min(0, ...objects.map(o => o.positionY)));
  const photo = await readLimited(scene.normalizedAsset.storageKey, 4 * 1024 * 1024);
  const raw = await sharp(photo).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const image = { data: raw.data, width: raw.info.width, height: raw.info.height };
  const masks = await Promise.all(objects.map(async o => {
    const mask = await sharp(await readLimited(o.mask!.storageKey, 4 * 1024 * 1024)).greyscale().raw().toBuffer({ resolveWithObject: true });
    if (mask.info.width !== image.width || mask.info.height !== image.height) throw new Error("BACKGROUND_MASK_SIZE");
    return mask.data;
  }));
  const settings = record(scene.settings);
  let plan = backgroundPlanSchema.safeParse(settings.backgroundPlan).data;
  const plain = plainBackground(image, masks);
  if (plain) {
    const observed = { ...(plan ?? fallbackBackground), kind: "seamless" as const, boundary: null, plainColor: plain.color };
    await db.$transaction(async tx => {
      const current = await tx.generationRun.findFirst({ where: { id: runId, status: { in: ["RUNNING", "WAITING"] } } });
      if (!current) throw new AppError(409, "RUN_STALE", "The background request is no longer active.");
      const saved = await tx.scene.updateMany({ where: { id: scene.id, revision: scene.revision, status: "READY", archivedAt: null }, data: {
        stage: json({ ...composition, background: observed }), ...(!savedComposition.success ? { camera: json(composition.camera) } : {}), settings: json({ ...settings, backgroundPlan: observed, background: null }), revision: { increment: 1 }
      } });
      if (!saved.count) throw new Error("BACKGROUND_REVISION_CHANGED");
    });
    return;
  }
  // A previous classification is not evidence for the current mask set.
  if (plan?.plainColor) plan = backgroundPlanSchema.omit({ plainColor: true }).parse(Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "plainColor")));
  const footprint = await backgroundFootprint(image, masks);
  async function step(key: string, modelId: string) {
    // An existing attempt is never submitted again, even after a workflow crash.
    return db.generationStep.create({ data: { runId, key, attempt: 1, provider: "META", modelId, status: "RUNNING", startedAt: new Date() } });
  }
  if (!plan) {
    await db.generationRun.update({ where: { id: runId }, data: { currentStage: "Understanding the background", progress: 93 } });
    const analysis = await step("background-analysis", process.env.META_ANALYSIS_MODEL ?? "muse-spark-1.3");
    const result = await analyzeBackground(`data:image/webp;base64,${photo.toString("base64")}`);
    plan = result.plan;
    await db.generationStep.update({ where: { id: analysis.id }, data: { status: "SUCCEEDED", providerRequestId: result.requestId, inputTokens: result.usage?.prompt_tokens, outputTokens: result.usage?.completion_tokens, completedAt: new Date() } });
  }
  await db.generationRun.update({ where: { id: runId }, data: { currentStage: "Restoring the photo background", progress: 96 } });
  const edit = await step("background-fill", process.env.META_IMAGE_MODEL ?? "muse-image-1.0");
  const generated = await fillBackground(photo, footprint.guide, plan, image);
  // Record the completed provider call before compositing; later processing
  // failures must never automatically resubmit a charged image request.
  const responseId=randomUUID(),responseKey=`${storagePrefix()}/scenes/${scene.id}/runs/${runId}/${responseId}.png`;
  await putObject(responseKey,generated.bytes,"image/png");
  await db.asset.create({data:{id:responseId,sceneId:scene.id,kind:"PROVIDER_RESPONSE",status:"READY",bucket:bucket(),storageKey:responseKey,mimeType:"image/png",byteSize:generated.bytes.length,sha256:createHash("sha256").update(generated.bytes).digest("hex"),readyAt:new Date(),provenance:{source:"muse-background-fill",runId}}});
  await db.generationStep.update({ where: { id: edit.id }, data: { status: "SUCCEEDED", responseAssetId:responseId,imageCount:1,costUsd: .01, completedAt: new Date() } });
  const bytes = await compositeBackground(image, generated.bytes, footprint.mask,plan);
  const id = randomUUID(), key = `${storagePrefix()}/scenes/${scene.id}/background/${id}.png`;
  await putObject(key, bytes, "image/png");
  await db.asset.create({ data: { id, sceneId: scene.id, kind: "SURFACE_TEXTURE", status: "READY", bucket: bucket(), storageKey: key,
    mimeType: "image/png", byteSize: bytes.length, width: image.width, height: image.height, sha256: createHash("sha256").update(bytes).digest("hex"), readyAt: new Date(), derivedFromId: scene.normalizedAssetId,
    provenance: { source: "photo-background-v1", model: generated.model, runId, removedObjectIds: objects.map(o => o.id), maskIds: objects.map(o => o.maskAssetId), preservedVisiblePixels: true } } });
  await db.$transaction(async tx => {
    const current = await tx.generationRun.findFirst({ where: { id: runId, status: { in: ["RUNNING", "WAITING"] } } });
    if (!current) throw new AppError(409, "RUN_STALE", "The background request is no longer active.");
    const changed = await tx.scene.updateMany({ where: { id: scene.id, revision: scene.revision, status: "READY", archivedAt: null }, data: {
      stage: json({ ...composition, background: plan }), ...(!savedComposition.success ? { camera: json(composition.camera) } : {}), settings: json({ ...settings, backgroundPlan: plan, background: { version: "photo-background-v1", assetId: id, photoId: scene.normalizedAssetId, model: generated.model } }), revision: { increment: 1 }
    } });
    if (!changed.count) throw new AppError(409, "REVISION_CONFLICT", "The scene changed during background generation. Your saved background was kept.");
  });
}

export async function finishSceneBackground(runId: string) {
  const db = getDb();
  try {
    await buildSceneBackground(runId);
    const run = await db.generationRun.findUniqueOrThrow({ where: { id: runId } });
    await db.generationRun.updateMany({ where: { id: runId, status: { in: ["RUNNING", "WAITING"] } }, data: { status: run.errorMessage ? "PARTIAL" : "SUCCEEDED", progress: 100, currentStage: "Your 3D scene is ready", completedAt: new Date() } });
  } catch (error) {
    const status=typeof record(error).status==="number"?Number(record(error).status):null;
    const pending = await db.generationStep.count({ where: { runId, key: { startsWith: "background-" }, status: "RUNNING" } });
    const uncertain=Boolean(pending&&!(status&&status>=400&&status<500));
    const detail=error instanceof Error?error.message.replace(/data:[^\s"']+|https?:\/\/[^\s"']+/g,"[redacted]").slice(0,900):"Unknown background failure";
    const code=error instanceof AppError?error.code:status?`META_HTTP_${status}`:error instanceof Error?error.name:"BACKGROUND_FAILED";
    await db.generationStep.updateMany({ where: { runId, key: { startsWith: "background-" }, status: "RUNNING" }, data: { status: uncertain?"SUBMISSION_UNCERTAIN":"FAILED",errorCode:code,errorMessage:detail,completedAt:new Date() } });
    // Preflight/compositing can fail without a pending provider request. Keep an
    // internal diagnostic instead of losing the cause or implying a paid submit.
    if (!pending) await db.generationStep.upsert({ where: { runId_key_attempt: { runId, key: "background-local", attempt: 1 } },
      create: { runId, key: "background-local", attempt: 1, provider: "INTERNAL", status: "FAILED", errorCode: code, errorMessage: detail, completedAt: new Date() },
      update: { status: "FAILED", errorCode: code, errorMessage: detail, completedAt: new Date() } });
    await db.generationRun.updateMany({ where: { id: runId, status: { in: ["RUNNING", "WAITING"] } }, data: { status: "PARTIAL", progress: 100, currentStage: "3D ready · background kept", errorCode: uncertain ? "SUBMISSION_UNCERTAIN" : "BACKGROUND_UNAVAILABLE", errorMessage: uncertain ? "Background generation was interrupted and may have been charged. It will not retry automatically. Your 3D objects and saved background are kept." : "The photo background could not be updated. Your 3D objects and saved background are kept. You can start a new background request in Textures.", completedAt: new Date() } });
  }
}
