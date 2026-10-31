import frozen from "./frozen-scenes.json";
import {
  compositionSchema,
  modelPlacementSchema,
} from "@/lib/scene/composition";
import { lightingSchema } from "@/lib/scene/lighting";
import { footprintOverlap, type Arrangement, type ItemDraft } from "./state";
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

export function supportOf(scene: DemoScene, id: string) {
  const child = scene.objects.find((o) => o.id === id)!;
  return scene.objects
    .filter(
      (p) =>
        p.id !== id &&
        p.position[1] < child.position[1] - 0.1 &&
        Math.abs(p.position[1] + p.placement.size[1] - child.position[1]) <
          0.12 &&
        Math.abs(child.position[0] - p.position[0]) < p.placement.size[0] / 2 &&
        Math.abs(child.position[2] - p.position[2]) < p.placement.size[2] / 2,
    )
    .sort((a, b) => b.position[1] - a.position[1])[0]?.id;
}
export function collectionLayouts(
  scene: DemoScene,
): import("./state").LayoutSet {
  const A = initialArrangement(scene);
  const transform = (angle: number, dx: number, dz: number): Arrangement => ({
    lighting: "Original",
    items: Object.fromEntries(
      Object.entries(A.items).map(([id, d]) => [
        id,
        {
          ...d,
          x: d.x * Math.cos(angle) + d.z * Math.sin(angle) + dx,
          z: -d.x * Math.sin(angle) + d.z * Math.cos(angle) + dz,
          yaw: angle,
        },
      ]),
    ),
  });
  return {
    A,
    B: transform(0.35, 0, 0.35),
    C: transform(-0.45, 0, 0),
    D: transform(Math.PI, 0, 0),
  };
}

export function changeArrangement(
  scene: DemoScene,
  draft: Arrangement,
  id: string,
  patch: Partial<ItemDraft>,
): { draft: Arrangement; error: string | null } {
  const source = scene.objects.find((o) => o.id === id);
  if (!source) return { draft, error: "Choose a product first." };
  const items = structuredClone(draft.items),
    before = items[id];
  items[id] = { ...before, ...patch };
  const descendants = scene.objects.filter(
    (o) => supportOf(scene, o.id) === id,
  );
  for (const child of descendants) {
    const d = items[child.id],
      angle = items[id].yaw - before.yaw,
      dx = d.x - before.x,
      dz = d.z - before.z;
    items[child.id] = {
      ...d,
      x: items[id].x + dx * Math.cos(angle) + dz * Math.sin(angle),
      z: items[id].z - dx * Math.sin(angle) + dz * Math.cos(angle),
      yaw: Math.atan2(Math.sin(d.yaw + angle), Math.cos(d.yaw + angle)),
      ...("visible" in patch ? { visible: patch.visible! } : {}),
    };
  }
  const parentId = supportOf(scene, id);
  if (parentId && items[id].visible) {
    const parent = scene.objects.find((o) => o.id === parentId)!,
      p = items[parentId],
      d = items[id],
      dx = d.x - p.x,
      dz = d.z - p.z;
    const x = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw),
      z = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
    if (
      Math.abs(x) >
        (parent.placement.size[0] - source.placement.size[0]) * 0.5 + 0.02 ||
      Math.abs(z) >
        (parent.placement.size[2] - source.placement.size[2]) * 0.5 + 0.02
    )
      return {
        draft,
        error:
          "Keep this accessory on its supporting cabinet. Move the cabinet to move them together.",
      };
    items[parentId].visible = true;
  }
  const overlaps = (
    a: typeof source,
    b: typeof source,
    values: typeof items,
  ) => {
    if (supportOf(scene, a.id) === b.id || supportOf(scene, b.id) === a.id)
      return false;
    if (
      a.position[1] + a.placement.size[1] <= b.position[1] + 0.04 ||
      b.position[1] + b.placement.size[1] <= a.position[1] + 0.04
    )
      return false;
    return (
      values[a.id].visible &&
      values[b.id].visible &&
      footprintOverlap(
        {
          ...values[a.id],
          width: a.placement.size[0],
          depth: a.placement.size[2],
        },
        {
          ...values[b.id],
          width: b.placement.size[0],
          depth: b.placement.size[2],
        },
      )
    );
  };
  for (let i = 0; i < scene.objects.length; i++)
    for (let j = i + 1; j < scene.objects.length; j++) {
      const a = scene.objects[i],
        b = scene.objects[j];
      if (overlaps(a, b, items) && !overlaps(a, b, draft.items))
        return {
          draft,
          error:
            "That move overlaps another product. Try another direction or remove an item first.",
        };
    }
  return { draft: { ...draft, items }, error: null };
}
