import "server-only";
import sharp from "sharp";
import { randomUUID, createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { readLimited, putObject, bucket, storagePrefix } from "@/lib/storage/r2";
// Owner/scene/revision validation happens in saveObjects before calling this helper.
export async function productThumbnail(sceneId: string, objectId: string) {
  const db = getDb();
  const object = await db.sceneObject.findFirstOrThrow({ where: { id: objectId, sceneId }, include: { mask: true, scene: { include: { normalizedAsset: true } } } });
  const photo = object.scene.normalizedAsset, mask = object.mask;
  if (!photo || !mask || photo.sceneId !== sceneId || mask.sceneId !== sceneId || photo.status !== "READY" || mask.status !== "READY") return null;
  const cached = await db.asset.findFirst({ where: { sceneId, kind: "PRODUCT_IMAGE", status: "READY", derivedFromId: mask.id } });
  if (cached) return cached.id;
  const [photoBytes, maskBytes] = await Promise.all([readLimited(photo.storageKey, 4 * 1024 * 1024), readLimited(mask.storageKey, 4 * 1024 * 1024)]);
  const rgb = await sharp(photoBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = await sharp(maskBytes).resize(rgb.info.width, rgb.info.height).removeAlpha().greyscale().raw().toBuffer();
  const bytes = await sharp(rgb.data, { raw: rgb.info }).joinChannel(alpha, { raw: { width: rgb.info.width, height: rgb.info.height, channels: 1 } }).trim().resize(384, 384, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
  const id = randomUUID(), key = `${storagePrefix()}/scenes/${sceneId}/products/${id}.webp`;
  await putObject(key, bytes, "image/webp");
  await db.asset.create({ data: { id, sceneId, kind: "PRODUCT_IMAGE", status: "READY", bucket: bucket(), storageKey: key, mimeType: "image/webp", byteSize: bytes.length, width: 384, height: 384, sha256: createHash("sha256").update(bytes).digest("hex"), derivedFromId: mask.id, readyAt: new Date(), provenance: { sourcePhotoId: photo.id, objectId, method: "reviewed-mask-cutout-v1" } } });
  return id;
}
