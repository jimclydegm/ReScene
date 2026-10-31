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
): import("./state").CompleteLayoutSet {
  const A = initialArrangement(scene),
    preset = (
      poses: Record<string, [number, number, number]>,
      lighting: Arrangement["lighting"] = "Original",
    ): Arrangement => {
      let draft = initialArrangement(scene);
      // Hide roots temporarily so changing a complete layout does not collide with
      // intermediate positions. Restore each root plus its supported accessories.
      for (const item of Object.values(draft.items)) item.visible = false;
      for (const [id, [x, z, yaw]] of Object.entries(poses)) {
        const result = changeArrangement(scene, draft, id, {
          x,
          z,
          yaw,
          visible: false,
        });
        if (result.error)
          throw new Error(`Invalid ${scene.id} preset: ${id}: ${result.error}`);
        draft = result.draft;
      }
      for (const item of Object.values(draft.items)) item.visible = true;
      if (newCollision(scene, A, draft))
        throw new Error(`Invalid ${scene.id} preset collision`);
      return { ...draft, lighting };
    };
  const roots = scene.objects.filter((o) => !supportOf(scene, o.id));
  const original = Object.fromEntries(
    roots.map((o) => [
      o.id,
      [o.position[0], o.position[2], 0] as [number, number, number],
    ]),
  );
  if (scene.id === "corner")
    return {
      A,
      B: preset({
        "corner-chair": [-1.45, 0.25, 0.13],
        "corner-cabinet": [1.45, -0.45, -0.07],
      }),
      C: preset({
        "corner-chair": [-1.5, -0.35, 0],
        "corner-cabinet": [1.45, -0.35, 0],
      }),
      D: preset({
        "corner-chair": [-1.45, 0.45, 0.22],
        "corner-cabinet": [1.5, -0.65, -0.06],
      }),
      E: preset({
        "corner-chair": [1.35, 0.1, -0.18],
        "corner-cabinet": [-1.55, -0.2, 0.04],
      }),
      F: preset(
        {
          "corner-chair": [-1.45, 0.25, 0.13],
          "corner-cabinet": [1.45, -0.45, -0.07],
        },
        "Dusk",
      ),
    };
  if (scene.id === "space")
    return {
      A,
      B: preset({
        "oak-dresser": [-2.15, -0.8, 0],
        "sage-chair": [-0.4, 0.1, 0.15],
        "round-table": [1.15, 0.1, 0],
        "dining-chair": [2.15, -1.1, -0.18],
      }),
      C: preset(
        Object.fromEntries(roots.map((o) => [o.id, [o.position[0], -0.6, 0]])),
      ),
      D: preset({
        "oak-dresser": [-1.9, -0.8, 0],
        "sage-chair": [-1, 0.8, 0.15],
        "round-table": [0.8, 0.8, 0],
        "dining-chair": [2, -0.8, -0.18],
      }),
      E: preset(
        Object.fromEntries(
          roots.map((o) => [o.id, [-o.position[0], o.position[2], 0]]),
        ),
      ),
      F: preset(original, "Dusk"),
    };
  return {
    A,
    B: preset({
      "cloud-sofa": [-0.15, -0.7, 0],
      "coffee-table": [-0.45, 1.15, 0],
      "wood-stool": [2.5, 0.6, 0],
      "ceramic-vase": [-2.4, 0.1, 0],
    }),
    C: preset({
      "cloud-sofa": [-0.1, -0.85, 0],
      "coffee-table": [0.4, 1, 0],
      "wood-stool": [-2.25, 0.8, 0],
      "ceramic-vase": [2.25, 0.35, 0],
    }),
    D: preset({
      "cloud-sofa": [0.1, -1.1, 0],
      "coffee-table": [-0.35, 0.85, 0],
      "wood-stool": [2.2, 0.4, 0],
      "ceramic-vase": [-2.3, 0.4, 0],
    }),
    E: preset(
      Object.fromEntries(
        roots.map((o) => [o.id, [-o.position[0], o.position[2], 0]]),
      ),
    ),
    F: preset(original, "Dusk"),
  };
}
export function resolveCollectionLayouts(
  scene: DemoScene,
  saved?: import("./state").LayoutSet,
): import("./state").CompleteLayoutSet {
  const defaults = collectionLayouts(scene);
  if (!saved) return defaults;
  const result = {
    ...defaults,
    ...saved,
    E: saved.E ?? defaults.E,
    F: saved.F ?? defaults.F,
  };
  const legacyBack = scene.objects.every((o) => {
    const d = saved.D.items[o.id];
    return (
      d &&
      Math.abs(d.yaw - Math.PI) < 0.00001 &&
      Math.abs(d.x + o.position[0]) < 0.00001 &&
      Math.abs(d.z + o.position[2]) < 0.00001
    );
  });
  if (legacyBack)
    result.D = {
      ...defaults.D,
      lighting: saved.D.lighting,
      items: Object.fromEntries(
        Object.entries(defaults.D.items).map(([id, item]) => [
          id,
          {
            ...item,
            color: saved.D.items[id].color,
            visible: saved.D.items[id].visible,
          },
        ]),
      ),
    };
  return result;
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
  const proposed = { ...draft, items };
  if (newCollision(scene, draft, proposed))
    return {
      draft,
      error:
        "That move overlaps another product. Try another direction or remove an item first.",
    };
  return { draft: { ...draft, items }, error: null };
}

function newCollision(
  scene: DemoScene,
  before: Arrangement,
  after: Arrangement,
) {
  const overlaps = (
    a: DemoScene["objects"][number],
    b: DemoScene["objects"][number],
    values: Arrangement["items"],
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
      if (overlaps(a, b, after.items) && !overlaps(a, b, before.items)) {
        // Saved meshes can share conservative footprint boxes without solid
        // intersection. Hiding/re-showing their accepted relative pose is safe.
        const original = initialArrangement(scene),
          aa = after.items[a.id],
          bb = after.items[b.id],
          oa = original.items[a.id],
          ob = original.items[b.id];
        const sameRelative =
          (Math.abs(aa.x - bb.x - (oa.x - ob.x)) < 0.00001 ||
            Math.abs(aa.x - bb.x + (oa.x - ob.x)) < 0.00001) &&
          Math.abs(aa.z - bb.z - (oa.z - ob.z)) < 0.00001 &&
          Math.abs(aa.yaw - oa.yaw) < 0.00001 &&
          Math.abs(bb.yaw - ob.yaw) < 0.00001;
        if (!sameRelative || !overlaps(a, b, original.items)) return true;
      }
    }
  return false;
}
