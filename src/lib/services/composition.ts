import "server-only";
import sharp from "sharp";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { readLimited } from "@/lib/storage/r2";
import { ownedScene } from "./scenes";
import { inspectGlb } from "@/lib/ai/glb";
import { composeRoom, environmentSchema, glbBounds, type CompositionInput, type Environment } from "@/lib/scene/composition";

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const compositionInputSchema = z.object({ expectedRevision: z.number().int().nonnegative(), action: z.enum(["MATCH_PHOTO", "RESTORE"]) }).strict();
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export async function sceneEnvironment(scene: { settings: unknown; normalizedAsset: { storageKey: string } | null }) {
  const saved = environmentSchema.safeParse(record(scene.settings).environment);
  if (saved.success) return { environment: saved.data, environmentSource: "spark" as const };
  if (!scene.normalizedAsset) throw new Error("PHOTO_REQUIRED");
  // Existing scenes predate room analysis. Sample only broad upper/lower photo regions;
  // this is a color fallback, not an unbilled AI analysis or an inferred texture.
  const { data, info } = await sharp(await readLimited(scene.normalizedAsset.storageKey, 12 * 1024 * 1024))
    .resize(32, 32, { fit: "fill" }).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  function color(top: number, bottom: number) {
    const channels = [0, 1, 2].map(channel => {
      const values: number[] = [];
      for (let y = top; y < bottom; y++) for (let x = 3; x < 29; x++) values.push(data[(y * 32 + x) * info.channels + channel]);
      values.sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)].toString(16).padStart(2, "0");
    });
    return `#${channels.join("")}`;
  }
  const environment: Environment = { floorColor: color(27, 32), wallColor: color(0, 7),
    floorMaterial: "plain", lightDirection: "diffuse", lightWarmth: "neutral", sideWall: "none" };
  return { environment, environmentSource: "photo-colors" as const };
}
export async function matchPhotoLayout(sceneId: string, ownerId: string, input: z.infer<typeof compositionInputSchema>) {
  const scene = await ownedScene(sceneId, ownerId);
  if (scene.status !== "READY") throw new AppError(409, "SCENE_STATE", "Build your 3D objects first.");
  if (scene.revision !== input.expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before matching the photo.");
  const objects = await getDb().sceneObject.findMany({ where: { sceneId, status: "READY", modelAssetId: { not: null } }, include: { model: true }, orderBy: { sortOrder: "asc" } });
  if ((await getDb().sceneObject.findMany({ where: { sceneId }, select: { provenance: true } })).some(o => record(o.provenance).replacementBackup)) throw new AppError(409, "REPLACEMENTS_ACTIVE", "Restore original objects before matching the photo layout.");
  if (input.action === "RESTORE") {
    const backup = backupSchema.safeParse(record(scene.settings).layoutBackup);
    if (!backup.success || backup.data.objects.length !== objects.length || backup.data.objects.some(o => !objects.some(current => current.id === o.id))) {
      throw new AppError(409, "LAYOUT_BACKUP_UNAVAILABLE", "The previous layout is unavailable.");
    }
    await getDb().$transaction(async tx => {
      const result = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, status: "READY", archivedAt: null }, data: {
        camera: asJson(backup.data.camera), stage: asJson(backup.data.stage), settings: asJson({ ...record(scene.settings), layoutBackup: null }), revision: { increment: 1 }
      } });
      if (result.count !== 1) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before restoring.");
      for (const object of backup.data.objects) {
        const { id, initialTransform, ...fields } = object;
        await tx.sceneObject.update({ where: { id, sceneId }, data: { ...fields, initialTransform: asJson(initialTransform) } });
      }
    });
    return;
  }
  let result: ReturnType<typeof composeRoom>;
  try {
    const inputs: CompositionInput[] = [];
    for (const object of objects) {
      if (!object.model || object.model.sceneId !== sceneId || object.model.status !== "READY") throw new Error("MODEL_UNAVAILABLE");
      const bytes = await readLimited(object.model!.storageKey, 40 * 1024 * 1024);
      inspectGlb(bytes);
      const provenance = record(object.provenance);
      inputs.push({ id: object.id, metadata: provenance.metadata, bounds: glbBounds(bytes), imageBounds: object.imageBounds,
        support: typeof provenance.support === "string" ? provenance.support : ["bed", "seating", "table", "storage"].includes(object.category ?? "") ? "floor" : "unknown" });
    }
    const environment = await sceneEnvironment(scene);
    result = composeRoom(inputs, { width: scene.normalizedAsset!.width!, height: scene.normalizedAsset!.height! }, environment.environment, environment.environmentSource);
  } catch {
    throw new AppError(422, "LAYOUT_UNAVAILABLE", "The saved reconstruction has no reliable room layout. Your current layout is unchanged.");
  }
  const backup = { camera: scene.camera, stage: scene.stage, objects: objects.map(o => ({ id: o.id, initialTransform: o.initialTransform,
    positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ, rotationX: o.rotationX, rotationY: o.rotationY, rotationZ: o.rotationZ, rotationW: o.rotationW,
    scaleX: o.scaleX, scaleY: o.scaleY, scaleZ: o.scaleZ })) };
  await getDb().$transaction(async tx => {
    const changed = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, status: "READY", archivedAt: null }, data: {
      camera: asJson(result.composition.camera), stage: asJson(result.composition), settings: asJson({ ...record(scene.settings), layoutBackup: backup }), revision: { increment: 1 }
    } });
    if (changed.count !== 1) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before matching the photo.");
    for (const o of result.objects) await tx.sceneObject.update({ where: { id: o.id, sceneId }, data: {
      positionX: o.position[0], positionY: o.position[1], positionZ: o.position[2],
      rotationX: 0, rotationY: 0, rotationZ: 0, rotationW: 1, scaleX: 1, scaleY: 1, scaleZ: 1, initialTransform: asJson(o.placement)
    } });
  });
}
const backupSchema = z.object({ camera: z.unknown(), stage: z.unknown(), objects: z.array(z.object({
  id: z.uuid(), initialTransform: z.unknown(), positionX: z.number().finite(), positionY: z.number().finite(), positionZ: z.number().finite(),
  rotationX: z.number().finite(), rotationY: z.number().finite(), rotationZ: z.number().finite(), rotationW: z.number().finite(),
  scaleX: z.number().positive(), scaleY: z.number().positive(), scaleZ: z.number().positive()
})).max(10) });
