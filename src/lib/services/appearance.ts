import "server-only";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { Matrix4, Quaternion, Vector3 } from "three";
import { z } from "zod";
import type { Prisma, AssetKind } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { ownedScene } from "./scenes";
import { record } from "./composition";
import { bucket, storagePrefix, readLimited, putObject } from "@/lib/storage/r2";
import { inspectGlb } from "@/lib/ai/glb";
import { composeRoom, compositionSchema, glbBounds } from "@/lib/scene/composition";
import { lightingSchema } from "@/lib/scene/lighting";
import { bakeGlb, geometry, photoCamera, visibility, cleanPatch } from "@/lib/appearance/bake";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export const appearanceInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPLY"), expectedRevision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("RESTORE"), expectedRevision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("LIGHTING"), expectedRevision: z.number().int().nonnegative(), lighting: lightingSchema }).strict()
]);
const backupSchema = z.object({ version: z.literal("photo-bake-v1"), models: z.array(z.object({ objectId: z.uuid(), originalId: z.uuid(), bakedId: z.uuid(), copied: z.number() })), floorId: z.uuid().nullable(), wallId: z.uuid().nullable() });
export async function updateAppearance(sceneId: string, ownerId: string, input: z.infer<typeof appearanceInput>) {
  const scene = await ownedScene(sceneId, ownerId), db = getDb();
  if (input.action !== "LIGHTING" && (await db.sceneObject.findMany({ where: { sceneId }, select: { provenance: true } })).some(o => record(o.provenance).replacementBackup)) throw new AppError(409, "REPLACEMENTS_ACTIVE", "Restore original objects before changing photo textures.");
  if (scene.status !== "READY" || scene.revision !== input.expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "Reload the ready scene before changing its appearance.");
  const settings = record(scene.settings);
  if (input.action === "LIGHTING") {
    const result = await db.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, status: "READY", archivedAt: null }, data: {
      settings: json({ ...settings, lighting: input.lighting }), revision: { increment: 1 }
    } });
    if (!result.count) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before saving the lighting.");
    return;
  }
  const backup = backupSchema.safeParse(settings.appearance);
  if (input.action === "RESTORE") {
    if (!backup.success) throw new AppError(409, "NO_TEXTURE_BACKUP", "Original textures are already selected.");
    await db.$transaction(async tx => {
      const changed = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, status: "READY", archivedAt: null }, data: {
        settings: json({ ...settings, appearance: null }), revision: { increment: 1 }
      } });
      if (!changed.count) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before restoring.");
      for (const model of backup.data.models) {
        const asset = await tx.asset.findFirst({ where: { id: model.originalId, sceneId, kind: "MODEL_GLB", status: "READY" } });
        if (!asset) throw new AppError(409, "ORIGINAL_UNAVAILABLE", "The original mesh is unavailable.");
        const update = await tx.sceneObject.updateMany({ where: { id: model.objectId, sceneId, modelAssetId: model.bakedId }, data: { modelAssetId: model.originalId } });
        if (!update.count) throw new AppError(409, "MODEL_CHANGED", "A mesh changed. Reload before restoring.");
      }
    }); return;
  }
  if (backup.success) throw new AppError(409, "ALREADY_TEXTURED", "Photo textures are already applied. Restore the AI textures before trying again.");
  const composition = compositionSchema.safeParse(scene.stage);
  if (!composition.success || !scene.normalizedAsset) throw new AppError(422, "LAYOUT_REQUIRED", "Use Match photo layout before transferring textures.");
  const objects = await db.sceneObject.findMany({ where: { sceneId, status: "READY", modelAssetId: { not: null } }, include: { model: true, mask: true }, orderBy: { sortOrder: "asc" } });
  if (!objects.length || objects.length > 3 || objects.some(o => !o.model || !o.mask || o.model.status !== "READY" || o.mask.status !== "READY" || o.model.sceneId !== sceneId || o.mask.sceneId !== sceneId)) throw new AppError(422, "TEXTURE_INPUTS", "Photo transfer requires saved meshes and their reviewed masks.");
  const files = await Promise.all(objects.map(o => readLimited(o.model!.storageKey, 40 * 1024 * 1024)));
  files.forEach(inspectGlb);
  const raw = await sharp(await readLimited(scene.normalizedAsset.storageKey, 4 * 1024 * 1024)).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const photo = { data: raw.data, width: raw.info.width, height: raw.info.height };
  const masks = await Promise.all(objects.map(async o => {
    const m = await sharp(await readLimited(o.mask!.storageKey, 4 * 1024 * 1024)).greyscale().raw().toBuffer({ resolveWithObject: true });
    if (m.info.width !== photo.width || m.info.height !== photo.height) throw new AppError(422, "MASK_SIZE", "The mask does not match the photo.");
    return m.data;
  }));
  const initial = composeRoom(objects.map((o, i) => ({ id: o.id, metadata: record(o.provenance).metadata, bounds: glbBounds(files[i]), imageBounds: o.imageBounds,
    support: String(record(o.provenance).support ?? (["seating", "storage", "table", "bed"].includes(o.category) ? "floor" : "unknown")) })), photo, composition.data.environment, composition.data.environmentSource);
  const camera = photoCamera(initial.composition.camera);
  const triangles = objects.map((o, i) => {
    const base = initial.objects.find(p => p.id === o.id)!;
    return geometry(files[i], new Matrix4().compose(new Vector3(...base.position).add(new Vector3(...base.placement.offset)), new Quaternion(...base.placement.rotation), new Vector3(...base.placement.scale)), i);
  });
  const depth = visibility(triangles.flat(), camera, photo.width, photo.height);
  async function asset(bytes: Buffer, kind: AssetKind, mimeType: string, purpose: string, derivedFromId?: string) {
    const id = randomUUID(), key = `${storagePrefix()}/scenes/${sceneId}/appearance/${id}`;
    await putObject(key, bytes, mimeType);
    return db.asset.create({ data: { id, sceneId, kind, status: "READY", bucket: bucket(), storageKey: key, mimeType, byteSize: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"), readyAt: new Date(), derivedFromId,
      provenance: { source: "photo-bake-v1", photoId: scene.normalizedAssetId, purpose } } });
  }
  const models: z.infer<typeof backupSchema>["models"] = [];
  for (const [i, o] of objects.entries()) {
    const baked = await bakeGlb(files[i], triangles[i], photo, masks[i], camera, depth);
    inspectGlb(baked.bytes);
    const stored = await asset(baked.bytes, "MODEL_GLB", "model/gltf-binary", "visible-photo-detail", o.modelAssetId!);
    models.push({ objectId: o.id, originalId: o.modelAssetId!, bakedId: stored.id, copied: baked.copied });
  }
  const floor = await cleanPatch(photo, masks, "floor").then(b => asset(b, "SURFACE_TEXTURE", "image/png", "floor-patch", scene.normalizedAssetId!)).catch(() => null);
  const wall = await cleanPatch(photo, masks, "wall").then(b => asset(b, "SURFACE_TEXTURE", "image/png", "wall-patch", scene.normalizedAssetId!)).catch(() => null);
  await db.$transaction(async tx => {
    const result = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, status: "READY", archivedAt: null }, data: {
      settings: json({ ...settings, appearance: { version: "photo-bake-v1", models, floorId: floor?.id ?? null, wallId: wall?.id ?? null } }), revision: { increment: 1 }
    } });
    if (!result.count) throw new AppError(409, "REVISION_CONFLICT", "The scene changed while textures were baking. Its saved appearance is unchanged.");
    for (const m of models) {
      const changed = await tx.sceneObject.updateMany({ where: { id: m.objectId, sceneId, modelAssetId: m.originalId }, data: { modelAssetId: m.bakedId } });
      if (!changed.count) throw new AppError(409, "MODEL_CHANGED", "A mesh changed. Reload before transferring textures.");
    }
  }, { timeout: 20_000 });
}
