import type { RenderObject } from "@/components/scene/types";
import type { DemoScene } from "./scenes";
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
        p = findDemoProduct(o.id)!;
      return {
        id: o.id,
        label: p.name,
        modelUrl: `/api/demo/assets/${o.id}?v=${o.modelVersion}`,
        tint: p.colors[d.color]?.value ?? null,
        placement: o.placement,
        positionX: individual ? 0 : d.x,
        positionY: individual ? 0 : o.position[1],
        positionZ: individual ? 0 : d.z,
        yaw: d.yaw,
        scale: 1,
        visible: d.visible && (!isolated || isolated === o.id),
      };
    });
}
