import "server-only";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { uuidSchema } from "@/lib/validation/scenes";

export async function ownedScene(sceneId: string, ownerId: string) {
  if (!uuidSchema.safeParse(sceneId).success) throw new AppError(404, "NOT_FOUND", "Scene not found.");
  const scene = await getDb().scene.findFirst({
    where: { id: sceneId, ownerId, archivedAt: null },
    include: { normalizedAsset: true, sourceAsset: true, _count: { select: { objects: true } } }
  });
  if (!scene) throw new AppError(404, "NOT_FOUND", "Scene not found.");
  return scene;
}

export function sceneSummary(scene: {
  id: string; title: string; description: string | null; status: string;
  revision: number; createdAt: Date; updatedAt: Date; normalizedAssetId: string | null;
}) {
  return {
    id: scene.id, title: scene.title, description: scene.description,
    status: scene.status, revision: scene.revision,
    hasImage: Boolean(scene.normalizedAssetId),
    createdAt: scene.createdAt.toISOString(), updatedAt: scene.updatedAt.toISOString()
  };
}
