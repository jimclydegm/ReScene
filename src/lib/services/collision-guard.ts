import "server-only";
import { Matrix4, Quaternion, Vector3 } from "three";
import { collisionPairs, type CollisionMesh } from "@/lib/scene/collisions";
import { geometry } from "@/lib/appearance/bake";
import { flattenTransform } from "@/lib/scene/manifest";
import { glbBounds } from "@/lib/scene/composition";
import { readLimited } from "@/lib/storage/r2";
import { AppError } from "@/lib/http";
import { record } from "./composition";
import type { SceneObject, Asset } from "@/generated/prisma/client";
export async function guardCollisions(
  objects: (SceneObject & { model: Asset | null })[],
  next?: SceneObject[],
) {
  const files = await Promise.all(
    objects.map(async (o) =>
      o.model ? await readLimited(o.model.storageKey, 40 * 1024 * 1024) : null,
    ),
  );
  function meshes(items: SceneObject[]) {
    return items.flatMap((o, i): CollisionMesh[] => {
      if (!o.visible || !files[i]) return [];
      const t = flattenTransform(o, glbBounds(files[i]!)),
        m = new Matrix4().compose(
          new Vector3(...t.position),
          new Quaternion(...t.rotation),
          new Vector3(...t.scale),
        );
      return [
        {
          id: o.id,
          parentId:
            typeof record(o.provenance).assemblyRootId === "string"
              ? String(record(o.provenance).assemblyRootId)
              : typeof record(o.provenance).parentObjectId === "string"
                ? String(record(o.provenance).parentObjectId)
                : null,
          points: geometry(files[i]!, m, 0, false).map((t) => t.points),
        },
      ];
    });
  }
  const before = collisionPairs(meshes(objects)),
    after = next ? collisionPairs(meshes(next)) : before;
  if (
    after.some(
      (p) =>
        p.cells >
        (next
          ? (before.find((b) => b.a === p.a && b.b === p.b)?.cells ?? 0)
          : 0),
    )
  )
    throw new AppError(
      422,
      "OBJECT_COLLISION",
      "Objects intersect. Adjust their position or size, or use Refine placement before saving or publishing.",
    );
  return after;
}
