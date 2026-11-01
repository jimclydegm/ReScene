import type { RenderObject } from "@/components/scene/types";
import { resolvedDemoObject, type DemoScene } from "./scenes";
import type { Arrangement } from "./state";
import { findDemoProduct } from "./catalog";
/** Isolation changes framing, never the user's visibility choice. */
export function demoRenderObjects(
  scene: DemoScene,
  draft: Arrangement,
  {
    individual,
    isolated,
  }: { individual?: string; isolated?: string | null } = {},
): RenderObject[] {
  return scene.objects
    .filter((o) => !individual || o.id === individual)
    .map((o) => {
      const d = draft.items[o.id],
        resolved = resolvedDemoObject(scene, draft, o.id),
        p = findDemoProduct(resolved.productId)!;
      return {
        id: o.id,
        label: p.name,
        modelUrl: `/api/demo/assets/${resolved.productId}?v=${resolved.modelVersion}`,
        tint: p.colors[d.color]?.value ?? null,
        placement: resolved.placement,
        positionX: individual ? 0 : d.x,
        positionY: individual ? 0 : resolved.position[1],
        positionZ: individual ? 0 : d.z,
        yaw: d.yaw,
        scale: 1,
        visible: d.visible && (!isolated || isolated === o.id),
      };
    });
}
