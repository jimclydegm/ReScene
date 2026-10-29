import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { ownedScene } from "./scenes";
import { record } from "./composition";
import type { restartInputSchema } from "@/lib/validation/generation";
import type { z } from "zod";

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function restartScene(sceneId: string, ownerId: string, input: z.infer<typeof restartInputSchema>) {
  await ownedScene(sceneId, ownerId);
  return getDb().$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
    const scene = await tx.scene.findFirstOrThrow({ where: { id: sceneId, ownerId, archivedAt: null } });
    if (scene.revision !== input.expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before restarting a step.");
    const running = await tx.generationRun.count({ where: { sceneId, status: { in: ["QUEUED", "RUNNING", "WAITING", "CANCEL_REQUESTED"] } } });
    if (running || ["ANALYZING", "RECONSTRUCTING"].includes(scene.status)) throw new AppError(409, "RUN_ACTIVE", "Wait for the current generation to finish before restarting a step.");
    if (!scene.normalizedAssetId) throw new AppError(409, "PHOTO_REQUIRED", "Save a photo before restarting a step.");
    const objects = await tx.sceneObject.findMany({ where: { sceneId } });
    if (input.target === "RECONSTRUCTION" && !objects.some(o => o.maskAssetId)) throw new AppError(409, "MASKS_REQUIRED", "Analyze the photo and review object outlines first.");
    const revision = scene.revision + 1;
    const previousSettings = record(scene.settings);
    const settings = input.target === "RECONSTRUCTION"
      ? { ...Object.fromEntries(["environment","analysisOptions","analysisSummary","sceneType","preferredBackdrop","reconstructionOptions"].filter(k=>k in previousSettings).map(k=>[k,previousSettings[k]])), resetRevision: revision }
      : { resetRevision: revision };
    const updated = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, archivedAt: null }, data: {
      status: input.target === "RECONSTRUCTION" ? "REVIEW" : "DRAFT", revision,
      camera: {}, stage: {}, settings: asJson(settings), posterAssetId: null, lastErrorCode: null,
      ...(input.target === "PHOTO" ? { sourceAssetId: null, normalizedAssetId: null } : {})
    } });
    if (updated.count !== 1) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before restarting.");
    // Disable old failed-job resume while preserving charged requests and usage history.
    await tx.generationRun.updateMany({ where: { sceneId, status: { in: ["FAILED", "PARTIAL"] } }, data: {
      status: "CANCELED", errorCode: "STEP_RESTARTED", errorMessage: "A previous step was restarted. This attempt cannot be resumed."
    } });
    if (input.target === "RECONSTRUCTION") {
      for (const object of objects) {
        const provenance = record(object.provenance);
        // Keep only source/segmentation facts; the old provider pose belongs to the deleted mesh.
        const retained = Object.fromEntries(["model", "promptVersion", "support", "requestLocalId", "foregroundArea", "maskAlternatives", "segmentationOptions", "segmentationModel", "parentObjectId", "supportedByObjectId"].filter(k => k in provenance).map(k => [k, provenance[k]]));
        await tx.sceneObject.update({ where: { id: object.id, sceneId }, data: {
          modelAssetId: null, productId: null, status: object.maskAssetId ? "CONFIRMED" : "FAILED", representation: "PROXY",
          positionX: 0, positionY: 0, positionZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0, rotationW: 1,
          scaleX: 1, scaleY: 1, scaleZ: 1, visible: true, initialTransform: Prisma.DbNull, localBounds: Prisma.DbNull,
          provenance: asJson(retained), lastErrorCode: object.maskAssetId ? null : object.lastErrorCode
        } });
      }
    } else await tx.sceneObject.deleteMany({ where: { sceneId } });
    // Future product/publication work is invalidated too. Historical provider responses are retained privately.
    await tx.product.deleteMany({ where: { sceneId } });
    await tx.scenePublication.updateMany({ where: { sceneId, revokedAt: null }, data: { revokedAt: new Date() } });
    const kinds = input.target === "PHOTO"
      ? ["SOURCE_IMAGE", "NORMALIZED_IMAGE", "MASK", "CUTOUT", "MODEL_GLB", "PRODUCT_IMAGE", "POSTER", "SURFACE_TEXTURE", "UPLOAD_STAGING"] as const
      : input.target === "ANALYSIS" ? ["MASK", "CUTOUT", "MODEL_GLB", "PRODUCT_IMAGE", "POSTER", "SURFACE_TEXTURE"] as const
      : ["MODEL_GLB", "PRODUCT_IMAGE", "POSTER", "SURFACE_TEXTURE"] as const;
    // Logical deletion immediately prevents new signing/attachment. No bucket-wide lifecycle change.
    await tx.asset.updateMany({ where: { sceneId, kind: { in: [...kinds] }, status: { not: "DELETED" } }, data: { status: "DELETED", deletedAt: new Date() } });
    return { revision, status: input.target === "RECONSTRUCTION" ? "REVIEW" : "DRAFT" };
  }, { timeout: 20_000 });
}
