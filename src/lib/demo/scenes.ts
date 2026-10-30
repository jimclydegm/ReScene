import frozen from "./frozen-scenes.json";
import {
  compositionSchema,
  modelPlacementSchema,
} from "@/lib/scene/composition";
import { lightingSchema } from "@/lib/scene/lighting";
import type { Arrangement } from "./state";
export const demoScenes = frozen.scenes.map((s) => ({
  id: s.id,
  composition: compositionSchema.parse(s.composition),
  lighting: lightingSchema.parse(s.lighting),
  appearance: s.appearance,
  objects: s.objects.map((o) => ({
    id: o.id,
    modelVersion: o.digest.slice(0, 12),
    position: o.position as [number, number, number],
    placement: modelPlacementSchema.parse(o.placement),
  })),
}));
export type DemoScene = (typeof demoScenes)[number];
export function initialArrangement(scene: DemoScene): Arrangement {
  return {
    lighting: "Original",
    items: Object.fromEntries(
      scene.objects.map((o) => [
        o.id,
        { x: o.position[0], z: o.position[2], yaw: 0, visible: true, color: 0 },
      ]),
    ),
  };
}
export function startingLayouts() {
  const scene = demoScenes.find((s) => s.id === "space")!,
    A = initialArrangement(scene),
    B = initialArrangement(scene);
  // A second, deliberately separated showroom arrangement. Same meshes/scale.
  B.items["oak-dresser"] = { ...B.items["oak-dresser"], x: -2.2, z: -1.6 };
  B.items["sage-chair"] = {
    ...B.items["sage-chair"],
    x: -0.9,
    z: 1.2,
    yaw: -0.25,
  };
  B.items["round-table"] = { ...B.items["round-table"], x: 1.1, z: 1.2 };
  B.items["dining-chair"] = {
    ...B.items["dining-chair"],
    x: 2.3,
    z: -1.5,
    yaw: 0.25,
  };
  return { A, B };
}
