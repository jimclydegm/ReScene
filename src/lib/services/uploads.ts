import "server-only";
import { randomUUID, createHash } from "node:crypto";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { uploadLimit } from "@/lib/env";
import { ownedScene } from "@/lib/services/scenes";
import { bucket, storagePrefix, signUpload, headObject, readLimited, putObject, removeStagingObject } from "@/lib/storage/r2";

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function reserveUpload(sceneId: string, ownerId: string, input: {
  contentType: string; byteSize: number; expectedRevision: number;
}) {
  const scene = await ownedScene(sceneId, ownerId);
  if (scene.revision !== input.expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "This scene changed. Reload it and try again.");
  if (scene.sourceAssetId || scene.status !== "DRAFT") throw new AppError(409, "SOURCE_EXISTS", "Create a new scene to use a different photo.");
  if (input.byteSize > uploadLimit()) throw new AppError(413, "IMAGE_TOO_LARGE", "Choose an image smaller than 12 MB.");
  const recent = await getDb().asset.count({ where: {
    sceneId, kind: "UPLOAD_STAGING", createdAt: { gte: new Date(Date.now() - 15 * 60_000) }
  } });
  if (recent >= 5) throw new AppError(429, "UPLOAD_LIMIT", "Too many upload attempts. Try again in a few minutes.");
  const id = randomUUID();
  const storageKey = `${storagePrefix()}/staging/${sceneId}/${id}`;
  const uploadUrl = await signUpload(storageKey, input.contentType);
  const expiresAt = new Date(Date.now() + 300_000);
  await getDb().asset.create({ data: {
    id, sceneId, kind: "UPLOAD_STAGING", bucket: bucket(), storageKey,
    mimeType: input.contentType, uploadExpiresAt: expiresAt,
    metadata: { requestedBytes: input.byteSize }
  } });
  return { assetId: id, uploadUrl, expiresAt: expiresAt.toISOString(), headers: { "Content-Type": input.contentType } };
}

export async function completeUpload(sceneId: string, assetId: string, ownerId: string, expectedRevision: number) {
  const db = getDb();
  const scene = await ownedScene(sceneId, ownerId);
  if (scene.sourceAssetId === assetId) return { sceneId, revision: scene.revision };
  if (scene.sourceAssetId || scene.status !== "DRAFT" || scene.revision !== expectedRevision) {
    throw new AppError(409, "REVISION_CONFLICT", "This scene changed. Reload it and try again.");
  }
  const asset = await db.asset.findFirst({ where: { id: assetId, sceneId, kind: "UPLOAD_STAGING" } });
  if (!asset) throw new AppError(404, "NOT_FOUND", "Upload not found.");
  if (!asset.uploadExpiresAt || asset.uploadExpiresAt.getTime() < Date.now()) {
    throw new AppError(400, "UPLOAD_EXPIRED", "This upload expired. Select the photo again.");
  }
  const claim = await db.asset.updateMany({ where: { id: assetId, sceneId, status: "PENDING" }, data: { status: "VALIDATING" } });
  if (claim.count !== 1) throw new AppError(409, "UPLOAD_BUSY", "This upload is already being processed. Reload the scene shortly.");
  try {
    const head = await headObject(asset.storageKey);
    if (!head.ContentLength || head.ContentLength > uploadLimit()) {
      throw new AppError(413, "IMAGE_TOO_LARGE", "Choose a nonempty image smaller than 12 MB.");
    }
    const source = await readLimited(asset.storageKey, uploadLimit());
    let metadata: Metadata;
    let normalized: { data: Buffer; info: OutputInfo };
    try {
      metadata = await sharp(source, { limitInputPixels: 24_000_000, animated: false }).metadata();
      if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) {
        throw new Error("Unsupported image");
      }
      normalized = await sharp(source, { limitInputPixels: 24_000_000 })
        .rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    } catch {
      throw new AppError(400, "INVALID_IMAGE", "This file could not be read. Choose a still JPEG, PNG, or WebP image.");
    }
    if (normalized.data.length > 4 * 1024 * 1024) throw new AppError(413, "IMAGE_TOO_COMPLEX", "Choose a smaller image and try again.");
    const attemptId = randomUUID();
    const normalizedId = randomUUID();
    const mimeType = `image/${metadata.format}`;
    const sourceKey = `${storagePrefix()}/scenes/${sceneId}/source/${attemptId}.${metadata.format}`;
    const normalizedKey = `${storagePrefix()}/scenes/${sceneId}/normalized/${normalizedId}.webp`;
    await putObject(sourceKey, source, mimeType);
    await putObject(normalizedKey, normalized.data, "image/webp");
    const readyAt = new Date();
    const revision = await db.$transaction(async tx => {
      await tx.asset.update({ where: { id: assetId }, data: {
        kind: "SOURCE_IMAGE", status: "READY", storageKey: sourceKey,
        mimeType, byteSize: source.length, width: metadata.width, height: metadata.height,
        sha256: digest(source), readyAt, uploadExpiresAt: null,
        provenance: { source: "merchant-upload", validationVersion: 1 }
      } });
      await tx.asset.create({ data: {
        id: normalizedId, sceneId, kind: "NORMALIZED_IMAGE", status: "READY",
        bucket: bucket(), storageKey: normalizedKey, mimeType: "image/webp",
        byteSize: normalized.data.length, width: normalized.info.width, height: normalized.info.height,
        sha256: digest(normalized.data), derivedFromId: assetId, readyAt,
        provenance: { source: "image-normalization", validationVersion: 1 },
        metadata: { exifRemoved: true, orientationApplied: true }
      } });
      const updated = await tx.scene.updateMany({
        where: { id: sceneId, ownerId, revision: expectedRevision, sourceAssetId: null, status: "DRAFT", archivedAt: null },
        data: { sourceAssetId: assetId, normalizedAssetId: normalizedId, revision: { increment: 1 } }
      });
      if (updated.count !== 1) throw new AppError(409, "REVISION_CONFLICT", "This scene changed. Reload it and try again.");
      return expectedRevision + 1;
    });
    await removeStagingObject(asset.storageKey).catch(() => {
      console.warn("Staging cleanup deferred", { assetId });
    });
    return { sceneId, revision };
  } catch (error) {
    const rejected = error instanceof AppError && [400, 413].includes(error.status);
    await db.asset.updateMany({ where: { id: assetId, status: "VALIDATING" }, data: { status: rejected ? "REJECTED" : "PENDING" } });
    throw error;
  }
}
