import frozen from "./frozen-scenes.json";
import {environmentBoundaries,boundaryPenetration} from "@/lib/scene/environment-clearance";
import {Matrix4,Quaternion,Vector3} from "three";
import catalogModels from "./catalog-models.json";
import {
  compositionSchema,
  modelPlacementSchema,
} from "@/lib/scene/composition";
import { lightingSchema } from "@/lib/scene/lighting";
import { footprintOverlap, footprintPenetration, type Arrangement, type ItemDraft } from "./state";
import { findDemoProduct, itemProductId, demoListingHeight } from "./catalog";
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
export function productCollection(id: string) {
  const existing = demoScenes.find((s) => s.objects.some((o) => o.id === id));
  if (existing) return existing.id;
  const product = findDemoProduct(id);
  const preferred: Record<string, string> = {
    chair: "chair-studio",
    drawer: "home-essentials",
    mouse: "workspace",
    sofa: "living",
    shoes: "city-style",
    mug: "playtime",
  };
  const target = product?.role ? preferred[product.role] : "corner";
  return demoScenes.find((s) => s.id === target)?.id ?? "corner";
}
const catalogSources = new Map(
  catalogModels.map((o) => [
    o.id,
    {
      ...o,
      modelVersion: o.digest.slice(0, 12),
      position: o.position as [number, number, number],
      placement: modelPlacementSchema.parse(o.placement),
    },
  ]),
);
export function demoProductScene(id: string): DemoScene {
  const existing = demoScenes.find((s) => s.objects.some((o) => o.id === id));
  if (existing) return existing;
  const model = catalogModels.find((o) => o.id === id);
  if (!model) throw new Error("Product model unavailable");
  return {
    ...demoScenes[0],
    objects: [
      {
        id,
        modelVersion: model.digest.slice(0, 12),
        position: [0, 0, 0],
        placement: modelPlacementSchema.parse(model.placement),
      },
    ],
  };
}
export function resolvedDemoObject(
  scene: DemoScene,
  draft: Arrangement,
  id: string,
): DemoScene["objects"][number] & { productId: string } {
  const slot = scene.objects.find((o) => o.id === id)!;
  const productId = itemProductId(id, draft.items[id]);
  const source = catalogSources.get(productId);
  if (!source) throw new Error("The selected product model is unavailable.");
  // Single-photo scales differ. Use the existing fictional listing heights to
  // keep demo proportions, then check the new footprint. Never squash a sofa
  // into a vase-sized box or stretch the replacement geometry.
  const heightRatio =
    (demoListingHeight(source.id) ?? 1) / (demoListingHeight(slot.id) ?? 1);
  const factor =
    source.id === slot.id
      ? 1
      : (slot.placement.size[1] * heightRatio) / source.placement.size[1];
  const placement =
    source.id === slot.id
      ? slot.placement
      : {
          ...source.placement,
          scale: source.placement.scale.map((v) => v * factor) as [
            number,
            number,
            number,
          ],
          offset: source.placement.offset.map((v) => v * factor) as [
            number,
            number,
            number,
          ],
          size: source.placement.size.map((v) => v * factor) as [
            number,
            number,
            number,
          ],
        };
  const parentId = supportOf(scene, id),
    parent = parentId ? resolvedDemoObject(scene, draft, parentId) : null;
  const y = parent
    ? parent.position[1] + parent.placement.size[1]
    : slot.position[1];
  return {
    ...slot,
    modelVersion: source.modelVersion,
    placement,
    productId,
    position: [
      slot.position[0],
      source.id === slot.id &&
      (!parent || itemProductId(parentId!, draft.items[parentId!]) === parentId)
        ? slot.position[1]
        : y,
      slot.position[2],
    ],
  };
}
export function replacementError(
  scene: DemoScene,
  id: string,
  productId: string,
) {
  const slot = scene.objects.find((o) => o.id === id),
    product = findDemoProduct(productId);
  if (!slot || !product) return "Choose an available product.";
  if (
    supportOf(scene, id) &&
    ![
      "Home accessories",
      "Mugs",
      "Computer mice",
      "Fragrances",
      "Drinkware",
    ].includes(product.category)
  )
    return "Choose an accessory that fits on this supporting surface.";
  if (
    scene.objects.some((o) => supportOf(scene, o.id) === id) &&
    !["Storage", "Side tables", "Coffee tables"].includes(product.category)
  )
    return "This piece supports an accessory. Choose a cabinet or table with a top surface.";
  return null;
}
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
export function resetItemPatch(
  scene: DemoScene,
  draft: Arrangement,
  id: string,
): Partial<ItemDraft> {
  const original = initialArrangement(scene),
    reset = { ...original.items[id], productId: id, locked: false },
    parentId = supportOf(scene, id);
  if (!parentId) return reset;
  const parent = draft.items[parentId],
    base = original.items[parentId],
    dx = reset.x - base.x,
    dz = reset.z - base.z;
  return {
    ...reset,
    x: parent.x + dx * Math.cos(parent.yaw) + dz * Math.sin(parent.yaw),
    z: parent.z - dx * Math.sin(parent.yaw) + dz * Math.cos(parent.yaw),
    yaw: parent.yaw,
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
const presetCache=new WeakMap<DemoScene,import("./state").CompleteLayoutSet>();
export function collectionLayouts(scene:DemoScene){
 let defaults=presetCache.get(scene);if(!defaults){defaults=buildCollectionLayouts(scene);presetCache.set(scene,defaults);}return structuredClone(defaults);
}
function buildCollectionLayouts(
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
      draft = constrainDemoBackground(scene,draft) ?? structuredClone(A);
      if (newCollision(scene, A, draft))
        throw new Error(`Invalid ${scene.id} preset collision`);
      return { ...draft, lighting };
    };
  const roots = scene.objects.filter((o) => !supportOf(scene, o.id));
  if (!["corner", "space", "living"].includes(scene.id)) {
    const variant = (
      spread: number,
      turn: number,
      lighting: Arrangement["lighting"] = "Original",
    ) => {
      const draft = structuredClone(A),
        center = {
          x: roots.reduce((n, o) => n + o.position[0], 0) / roots.length,
          z: roots.reduce((n, o) => n + o.position[2], 0) / roots.length,
        };
      for (const root of roots) {
        const item = draft.items[root.id];
        item.x = center.x + (item.x - center.x) * spread;
        item.z = center.z + (item.z - center.z) * spread;
        item.yaw = turn;
      }
      for (const child of scene.objects) {
        const parentId = supportOf(scene, child.id);
        if (!parentId) continue;
        const old = A.items[parentId],
          p = draft.items[parentId],
          c = A.items[child.id],
          dx = c.x - old.x,
          dz = c.z - old.z;
        draft.items[child.id] = {
          ...c,
          x: p.x + dx * Math.cos(turn) + dz * Math.sin(turn),
          z: p.z - dx * Math.sin(turn) + dz * Math.cos(turn),
          yaw: turn,
        };
      }
      draft.lighting = lighting;
      const fitted=constrainDemoBackground(scene,draft);
      if(fitted)return fitted;
      return validateArrangement(scene, A, draft)
        ? { ...structuredClone(A), lighting }
        : draft;
    };
    return {
      A,
      B: variant(1.03, 0),
      C: variant(1.06, 0),
      D: variant(1.1, 0),
      E: variant(1.04, 0.05),
      F: variant(1, 0, "Dusk"),
    };
  }
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
  for(const key of ["A","B","C","D","E","F"] as const)
    result[key]=constrainDemoBackground(scene,result[key])??defaults[key];
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
  if (
    before.locked &&
    patch.locked !== false &&
    ["x", "z", "yaw"].some(
      (k) =>
        k in patch &&
        patch[k as keyof ItemDraft] !== before[k as keyof ItemDraft],
    )
  )
    return { draft, error: "Unlock this item's position before moving it." };
  if (patch.productId) {
    const error = replacementError(scene, id, patch.productId);
    if (error) return { draft, error };
  }
  items[id] = { ...before, ...patch };
  if (patch.productId && patch.productId !== before.productId)
    items[id].color = 0;
  const product = findDemoProduct(itemProductId(id, items[id]));
  if (!product || items[id].color >= product.colors.length)
    return { draft, error: "Choose an available finish." };
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
  for (const childId of [id, ...descendants.map((o) => o.id)]) {
    const parentId = supportOf(scene, childId);
    if (parentId && items[childId].visible) {
      const parent = resolvedDemoObject(scene, { ...draft, items }, parentId),
        child = resolvedDemoObject(scene, { ...draft, items }, childId),
        p = items[parentId],
        d = items[childId],
        dx = d.x - p.x,
        dz = d.z - p.z;
      const x = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw),
        z = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
      if (
        Math.abs(x) >
          (parent.placement.size[0] - child.placement.size[0]) * 0.5 + 0.02 ||
        Math.abs(z) >
          (parent.placement.size[2] - child.placement.size[2]) * 0.5 + 0.02
      )
        return {
          draft,
          error:
            "Keep this accessory on its supporting surface. Move the supporting piece to move them together.",
        };
      items[parentId].visible = true;
    }
  }
  const proposed = { ...draft, items };
  const error = validateArrangement(scene, draft, proposed);
  if (error) return { draft, error };
  return { draft: { ...draft, items }, error: null };
}

/** Validate a complete draft atomically, including indirect support-child moves. */
export function validateArrangement(
  scene: DemoScene,
  before: Arrangement,
  after: Arrangement,
  options: { roomBounds?: boolean } = {},
): string | null {
  if (
    JSON.stringify(Object.keys(after.items).sort()) !==
    JSON.stringify(scene.objects.map((o) => o.id).sort())
  )
    return "This arrangement belongs to a different collection.";
  for (const o of scene.objects) {
    const a = before.items[o.id],
      b = after.items[o.id],
      product = findDemoProduct(itemProductId(o.id, b));
    if (
      !product ||
      !catalogModels.some((m) => m.id === product.id) ||
      b.color < 0 ||
      b.color >= product.colors.length
    )
      return "The selected product or finish is unavailable.";
    const reason = replacementError(scene, o.id, product.id);
    if (reason) return reason;
    if (
      a.locked &&
      b.locked !== false &&
      (a.x !== b.x || a.z !== b.z || a.yaw !== b.yaw)
    )
      return "Unlock the item's position before moving it or its supporting piece.";
    const parentId = supportOf(scene, o.id);
    if (parentId && b.visible) {
      if (!after.items[parentId].visible)
        return "Show the supporting piece before adding its accessory.";
      const parent = resolvedDemoObject(scene, after, parentId),
        child = resolvedDemoObject(scene, after, o.id),
        p = after.items[parentId],
        dx = b.x - p.x,
        dz = b.z - p.z;
      if (
        Math.abs(dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw)) >
          (parent.placement.size[0] - child.placement.size[0]) * 0.5 + 0.02 ||
        Math.abs(dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) >
          (parent.placement.size[2] - child.placement.size[2]) * 0.5 + 0.02
      )
        return "Keep the accessory within its supporting surface.";
    }
  }
  if (options.roomBounds !== false) {
    const wallError = wallClearance(scene, before, after);
    if (wallError) return wallError;
  }
  return newCollision(scene, before, after)
    ? "That arrangement overlaps another product. Try a different placement."
    : null;
}

/** Same rendered planes as generation. Never ratchet deeper on repeated edits. */
function demoBoundsPoints(scene:DemoScene,draft:Arrangement,id:string){
  const item=draft.items[id],model=resolvedDemoObject(scene,draft,id),source=catalogSources.get(model.productId)!;
  const matrix=new Matrix4().makeTranslation(item.x,model.position[1],item.z)
    .multiply(new Matrix4().makeRotationY(item.yaw)).multiply(new Matrix4().makeTranslation(...model.placement.offset))
    .multiply(new Matrix4().compose(new Vector3(),new Quaternion(...model.placement.rotation),new Vector3(...model.placement.scale)));
  return source.clearanceHull.map(p=>new Vector3(...p as [number,number,number]).applyMatrix4(matrix));
}

/** Repair old saved presets without allowing ordinary edits through a wall. */
export function constrainDemoBackground(scene:DemoScene,input:Arrangement):Arrangement|null{
  if(input.background?.preset==="studio")return input;
  const draft=structuredClone(input),original=initialArrangement(scene),boundaries=environmentBoundaries(scene.composition).filter(b=>b.role!=="floor"&&b.role!=="surface");
  for(let pass=0;pass<8;pass++){
    let moved=false;
    for(const b of boundaries)for(const o of scene.objects){
      if(!draft.items[o.id].visible)continue;
      const allowed=0,depth=boundaryPenetration(demoBoundsPoints(scene,draft,o.id),b);
      if(depth<=allowed+.0001)continue;
      const length=b.normal.x*b.normal.x+b.normal.z*b.normal.z;
      if(length<.0001)return null;
      const root=supportOf(scene,o.id)??o.id,amount=(depth-allowed+.001)/length;
      for(const target of scene.objects.filter(v=>v.id===root||supportOf(scene,v.id)===root)){
        draft.items[target.id].x+=b.normal.x*amount;draft.items[target.id].z+=b.normal.z*amount;
      }
      moved=true;
    }
    if(!moved)break;
  }
  return validateArrangement(scene,original,draft)?null:draft;
}
function wallClearance(scene: DemoScene, before: Arrangement, after: Arrangement) {
  if (after.background?.preset === "studio") return null;
  const boundaries=environmentBoundaries(scene.composition).filter(b=>b.role!=="floor"&&b.role!=="surface");
  const penetration=(id:string,draft:Arrangement,b:typeof boundaries[number])=>boundaryPenetration(demoBoundsPoints(scene,draft,id),b);
  for(const b of boundaries)for(const o of scene.objects){
    if(!after.items[o.id].visible)continue;
    const base=0;
    if(penetration(o.id,after,b)>base+.001)return "Keep products inside the observed room walls and background.";
  }
  return null;
}

function newCollision(
  scene: DemoScene,
  before: Arrangement,
  after: Arrangement,
) {
  const overlaps = (
    a: DemoScene["objects"][number],
    b: DemoScene["objects"][number],
    arrangement: Arrangement,
  ) => {
    const values = arrangement.items;
    if (supportOf(scene, a.id) === b.id || supportOf(scene, b.id) === a.id)
      return false;
    const aa = resolvedDemoObject(scene, arrangement, a.id),
      bb = resolvedDemoObject(scene, arrangement, b.id);
    if (
      aa.position[1] + aa.placement.size[1] <= bb.position[1] + 0.04 ||
      bb.position[1] + bb.placement.size[1] <= aa.position[1] + 0.04
    )
      return false;
    return (
      values[a.id].visible &&
      values[b.id].visible &&
      footprintOverlap(
        {
          ...values[a.id],
          width: aa.placement.size[0],
          depth: aa.placement.size[2],
        },
        {
          ...values[b.id],
          width: bb.placement.size[0],
          depth: bb.placement.size[2],
        },
      )
    );
  };
  for (let i = 0; i < scene.objects.length; i++)
    for (let j = i + 1; j < scene.objects.length; j++) {
      const a = scene.objects[i],
        b = scene.objects[j];
      const changed = [a, b].some(
        (o) =>
          itemProductId(o.id, after.items[o.id]) !==
            itemProductId(o.id, before.items[o.id]) &&
          resolvedDemoObject(scene, after, o.id).placement.size.some(
            (v, k) =>
              k !== 1 &&
              v >
                resolvedDemoObject(scene, before, o.id).placement.size[k] *
                  1.05,
          ),
      );
      if (changed && overlaps(a, b, after)) return true;
      if (overlaps(a, b, after) && !overlaps(a, b, before)) {
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
        const penetration = (draft: Arrangement) =>
          footprintPenetration(
            { ...draft.items[a.id], width: a.placement.size[0], depth: a.placement.size[2] },
            { ...draft.items[b.id], width: b.placement.size[0], depth: b.placement.size[2] },
          );
        // Spreading an accepted layout can reduce its conservative box overlap.
        // Restore that pose, but reject a hidden item moved deeper into another.
        const noDeeper = penetration(after) <= penetration(original) + 0.00001;
        if (
          (!sameRelative && !noDeeper) ||
          itemProductId(a.id, aa) !== a.id ||
          itemProductId(b.id, bb) !== b.id ||
          !overlaps(a, b, original)
        )
          return true;
      }
    }
  return false;
}
