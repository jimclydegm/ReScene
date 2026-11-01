import {captureAppearance,recordAppearance} from "./appearance-history";
import "server-only";
import { randomUUID, createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { ownedScene } from "./scenes";
import { record } from "./composition";
import { bucket, storagePrefix, putObject, readLimited, signRead } from "@/lib/storage/r2";
import { compositionSchema } from "@/lib/scene/composition";
import { backgroundPlanSchema } from "@/lib/scene/background";

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export type BackgroundVariantView = {
  id: string;
  name: string;
  prompt: string | null;
  textureAssetId: string | null;
  previewUrl: string | null;
  createdAt: string;
  active: boolean;
};

function settingsBackground(settings: unknown) {
  return record(record(settings).background);
}

function activeVariantId(settings: unknown): string | null {
  const id = record(settings).activeBackgroundId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function textureUrl(sceneId: string, id: unknown) {
  if (typeof id !== "string") return null;
  const asset = await getDb().asset.findFirst({ where: { id, sceneId, kind: "SURFACE_TEXTURE", status: "READY" } });
  return asset ? signRead(asset) : null;
}

export async function ensureOriginalVariant(sceneId: string) {
  const db = getDb();
  const scene = await db.scene.findUniqueOrThrow({ where: { id: sceneId }, include: { normalizedAsset: true } });
  const existing = await db.sceneBackground.findMany({ where: { sceneId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  if (existing.length) return existing;
  const settings = record(scene.settings);
  const background = settingsBackground(scene.settings);
  const stage = compositionSchema.safeParse(scene.stage).data;
  const hasBackground = Boolean(background.assetId || background.floorId || background.wallId || stage?.background);
  if (!hasBackground) return existing;
  const id = randomUUID();
  const stageBackground = stage?.background ?? backgroundPlanSchema.safeParse(record(settings).backgroundPlan).data ?? null;
  await db.sceneBackground.create({
    data: {
      id,
      sceneId,
      name: "Original",
      textureAssetId: typeof background.assetId === "string" ? background.assetId : null,
      geometry: json(stageBackground ?? {}),
      prompt: null,
      provenance: json({ source: "original-background-v1", settingsBackground: background })
    }
  });
  await db.scene.update({
    where: { id: sceneId },
    data: { settings: json({ ...settings, activeBackgroundId: id }) }
  });
  return db.sceneBackground.findMany({ where: { sceneId, deletedAt: null }, orderBy: { createdAt: "asc" } });
}

export async function listBackgroundVariants(sceneId: string, ownerId: string): Promise<{ variants: BackgroundVariantView[]; activeId: string | null }> {
  await ownedScene(sceneId, ownerId);
  const db = getDb();
  const scene = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
  let rows = await db.sceneBackground.findMany({ where: { sceneId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  let activeId = activeVariantId(scene.settings);
  if (!rows.length) {
    rows = await ensureOriginalVariant(sceneId);
    if (rows.length) {
      const refreshed = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
      activeId = activeVariantId(refreshed.settings);
    }
  }
  if (rows.length && !activeId) {
    activeId = rows[0].id;
  }
  const variants: BackgroundVariantView[] = await Promise.all(
    rows.map(async (v) => ({
      id: v.id,
      name: v.name,
      prompt: typeof v.prompt === "string" ? v.prompt : null,
      textureAssetId: v.textureAssetId,
      previewUrl: await textureUrl(sceneId, v.textureAssetId),
      createdAt: v.createdAt.toISOString(),
      active: v.id === activeId
    }))
  );
  return { variants, activeId };
}

export async function selectBackgroundVariant(sceneId: string, ownerId: string, variantId: string, expectedRevision: number) {
  const scene = await ownedScene(sceneId, ownerId);
  if (scene.revision !== expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "Reload this scene before switching backgrounds.");
  if (scene.status !== "READY") throw new AppError(409, "SCENE_STATE", "Build your 3D objects before switching backgrounds.");
  const db = getDb();
  const variant = await db.sceneBackground.findFirst({ where: { id: variantId, sceneId, deletedAt: null } });
  if (!variant) throw new AppError(404, "NOT_FOUND", "Background variant not found.");
  if (await db.generationRun.count({ where: { sceneId, status: { in: ["QUEUED", "RUNNING", "WAITING"] } } })) {
    throw new AppError(409, "RUN_ACTIVE", "Wait for generation to finish before switching backgrounds.");
  }
  if (variant.textureAssetId) {
    const texture = await db.asset.findFirst({ where: { id: variant.textureAssetId, sceneId, kind: "SURFACE_TEXTURE", status: "READY" } });
    if (!texture) throw new AppError(422, "INVALID_ASSET", "This background texture is unavailable.");
  }
  const stage = compositionSchema.safeParse(scene.settings ? scene.stage : null);
  void stage;
  const currentStage = compositionSchema.safeParse(scene.stage);
  if (!currentStage.success) throw new AppError(422, "LAYOUT_UNAVAILABLE", "Build your 3D scene before switching backgrounds.");
  const variantGeometry = backgroundPlanSchema.safeParse(variant.geometry);
  const storedSettingsBackground = record(variant.provenance).settingsBackground;
  const nextSettingsBackground =
    storedSettingsBackground && typeof storedSettingsBackground === "object"
      ? storedSettingsBackground
      : variant.textureAssetId
        ? { version: "reference-environment-v1", assetId: variant.textureAssetId, photoId: scene.normalizedAssetId, variantId: variant.id }
        : {};
  const nextStageBackground = variantGeometry.success ? variantGeometry.data : currentStage.data.background;
  await db.$transaction(async (tx) => {
    const appearanceBefore=await captureAppearance(tx,sceneId);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
    const changed = await tx.scene.updateMany({
      where: { id: sceneId, ownerId, revision: expectedRevision, status: "READY", archivedAt: null },
      data: {
        stage: json({ ...currentStage.data, background: nextStageBackground }),
        settings: json({ ...record(scene.settings), background: nextSettingsBackground, backgroundPlan: nextStageBackground ?? null, activeBackgroundId: variant.id }),
        revision: { increment: 1 }
      }
    });
    if (!changed.count) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before switching backgrounds.");

    await recordAppearance(tx,sceneId,appearanceBefore,"Select background");
});
}

export async function deleteBackgroundVariant(sceneId: string, ownerId: string, variantId: string, expectedRevision: number) {
  const scene = await ownedScene(sceneId, ownerId);
  if (scene.revision !== expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "Reload this scene before deleting a background.");
  const db = getDb();
  const variant = await db.sceneBackground.findFirst({ where: { id: variantId, sceneId, deletedAt: null } });
  if (!variant) throw new AppError(404, "NOT_FOUND", "Background variant not found.");
  const currentActive = activeVariantId(scene.settings);
  const settingsBackgroundId = settingsBackground(scene.settings).assetId;
  const isActive = currentActive ? currentActive === variant.id : settingsBackgroundId === variant.textureAssetId;
  if (isActive) throw new AppError(409, "VARIANT_ACTIVE", "Switch to another background before deleting this one.");
  const publications = await db.scenePublication.findMany({ where: { sceneId, revokedAt: null }, select: { assetIds: true } });
  for (const p of publications) {
    const ids = Array.isArray(p.assetIds) ? p.assetIds : [];
    if (variant.textureAssetId && ids.includes(variant.textureAssetId)) {
      throw new AppError(409, "VARIANT_PUBLISHED", "This background is used by a live share link. Revoke that link before deleting.");
    }
  }
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
    const current = await tx.scene.findFirst({ where: { id: sceneId, ownerId, archivedAt: null, revision: expectedRevision } });
    if (!current) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before deleting.");
    await tx.sceneBackground.updateMany({ where: { id: variantId, sceneId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (variant.textureAssetId) {
      await tx.asset.updateMany({ where: { id: variant.textureAssetId, sceneId, status: "READY" }, data: { status: "DELETED", deletedAt: new Date() } });
    }
    await tx.scene.updateMany({ where: { id: sceneId, revision: expectedRevision }, data: { revision: { increment: 1 } } });
  });
}

export async function generateBackgroundVariantRun(runId: string) {
  const db = getDb();
  const run = await db.generationRun.findUniqueOrThrow({ where: { id: runId }, include: { scene: { include: { normalizedAsset: true } } } });
  const scene = run.scene;
  const input = record(run.input);
  const variantInput = record(input.backgroundVariant);
  if (run.kind !== "IMAGE_EDIT" || !variantInput) throw new Error("BACKGROUND_VARIANT_INPUT_REQUIRED");
  if (!["RUNNING", "WAITING"].includes(run.status) || scene.status !== "READY" || scene.archivedAt || !scene.normalizedAsset || scene.normalizedAssetId !== input.normalizedAssetId || run.expiresAt < new Date()) {
    throw new Error("BACKGROUND_RUN_STALE");
  }
  if (run.kind === "IMAGE_EDIT" && scene.revision !== run.inputRevision) throw new Error("BACKGROUND_REVISION_CHANGED");
  await db.generationRun.update({ where: { id: runId }, data: { currentStage: "Analyzing the current background", progress: 20 } });
  const step = await db.generationStep.create({
    data: { runId, key: "background-variant", attempt: 1, provider: "META", modelId: process.env.META_IMAGE_MODEL ?? "muse-image-1.0", status: "RUNNING", startedAt: new Date(), input: json({ stylePrompt: variantInput.stylePrompt ?? null, name: variantInput.name ?? null }) }
  });
  try {
    const stage = compositionSchema.safeParse(scene.stage);
    if (!stage.success) throw new Error("LAYOUT_UNAVAILABLE");
    const settings = record(scene.settings);
    const background = settingsBackground(scene.settings);
    const photo = scene.normalizedAsset;
    const size = { width: photo.width!, height: photo.height! };
    let reference: Buffer;
    let referenceSource = "photo";
    if (typeof background.assetId === "string") {
      const texture = await db.asset.findFirst({ where: { id: background.assetId, sceneId: scene.id, kind: "SURFACE_TEXTURE", status: "READY" } });
      if (texture) {
        reference = await readLimited(texture.storageKey, 12 * 1024 * 1024);
        referenceSource = "background-texture";
      } else {
        reference = await readLimited(photo.storageKey, 8 * 1024 * 1024);
      }
    } else {
      reference = await readLimited(photo.storageKey, 8 * 1024 * 1024);
    }
    await db.generationRun.update({ where: { id: runId }, data: { currentStage: "Generating a new background design", progress: 60 } });
    const { restyleBackgroundVariant } = await import("@/lib/ai/background");
    const planDescription = typeof stage.data.background?.description === "string" ? stage.data.background.description : typeof record(settings.backgroundPlan).description === "string" ? String(record(settings.backgroundPlan).description) : "photo-matched 3D background";
    const generated = await restyleBackgroundVariant(reference, size, typeof variantInput.stylePrompt === "string" ? variantInput.stylePrompt : undefined, planDescription);
    const sharp = (await import("sharp")).default;
    const normalized = await sharp(generated.bytes, { limitInputPixels: 24_000_000 }).webp({ quality: 95 }).toBuffer();
    const meta = await sharp(normalized).metadata();
    const responseId = randomUUID();
    const responseKey = `${storagePrefix()}/scenes/${scene.id}/runs/${runId}/${responseId}.png`;
    await putObject(responseKey, generated.bytes, "image/png");
    await db.asset.create({
      data: { id: responseId, sceneId: scene.id, kind: "PROVIDER_RESPONSE", status: "READY", bucket: bucket(), storageKey: responseKey, mimeType: "image/png", byteSize: generated.bytes.length, sha256: digest(generated.bytes), readyAt: new Date(), provenance: { source: "background-variant", runId } }
    });
    const textureId = randomUUID();
    const textureKey = `${storagePrefix()}/scenes/${scene.id}/background-variants/${textureId}.webp`;
    await putObject(textureKey, normalized, "image/webp");
    await db.asset.create({
      data: {
        id: textureId, sceneId: scene.id, kind: "SURFACE_TEXTURE", status: "READY", bucket: bucket(), storageKey: textureKey, mimeType: "image/webp",
        byteSize: normalized.length, sha256: digest(normalized), width: meta.width ?? size.width, height: meta.height ?? size.height, readyAt: new Date(),
        derivedFromId: typeof background.assetId === "string" ? background.assetId : scene.normalizedAssetId,
        provenance: { source: "background-variant-v1", runId, model: generated.model, photoId: scene.normalizedAssetId, referenceSource }
      }
    });
    await db.generationStep.update({ where: { id: step.id }, data: { status: "SUCCEEDED", responseAssetId: responseId, imageCount: 1, costUsd: 0.01, completedAt: new Date() } });
    await ensureOriginalVariant(scene.id);
    const count = await db.sceneBackground.count({ where: { sceneId: scene.id } });
    const name = typeof variantInput.name === "string" && variantInput.name.trim() ? variantInput.name.trim().slice(0, 120) : `Variant ${count + 1}`;
    await db.sceneBackground.create({
      data: {
        sceneId: scene.id,
        name,
        textureAssetId: textureId,
        geometry: json(stage.data.background ?? {}),
        prompt: typeof variantInput.stylePrompt === "string" ? variantInput.stylePrompt.slice(0, 2000) : null,
        provenance: json({
          source: "background-variant-v1",
          runId,
          model: generated.model,
          photoId: scene.normalizedAssetId,
          referenceSource,
          settingsBackground: { version: "reference-environment-v1", assetId: textureId, photoId: scene.normalizedAssetId, variantName: name }
        })
      }
    });
    await db.generationRun.update({ where: { id: runId }, data: { status: "SUCCEEDED", progress: 100, currentStage: "New background variant ready", completedAt: new Date() } });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/data:[^\s"']+|https?:\/\/[^\s"']+/g, "[redacted]").slice(0, 900) : "Unknown background error";
    const code = message.startsWith("BACKGROUND_") || message.startsWith("LAYOUT_") || message.startsWith("ENVIRONMENT_") ? message.split(":")[0] : "BACKGROUND_VARIANT_FAILED";
    await db.generationStep.updateMany({ where: { id: step.id, status: "RUNNING" }, data: { status: "FAILED", errorCode: code, errorMessage: message, completedAt: new Date() } });
    throw error;
  }
}
