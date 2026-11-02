import {resolvedDemoObject,type DemoScene} from "./scenes";
import type { Arrangement } from "./state";
import { findDemoProduct, itemProductId } from "./catalog";
import type { SceneComposition } from "@/lib/scene/composition";

export const roomFinishes = [
  { id: "original", name: "Original", wall: "#eee8de", floor: "#b68d63" },
  { id: "linen", name: "Warm linen", wall: "#e9dfcf", floor: "#b69b7a" },
  { id: "clay", name: "Soft clay", wall: "#d5ae97", floor: "#c7b59c" },
  { id: "sage", name: "Quiet sage", wall: "#b5c0b0", floor: "#b7a285" },
  { id: "gallery", name: "Dark gallery", wall: "#394441", floor: "#727975" },
  { id: "studio", name: "White studio", wall: "#f0f0eb", floor: "#d9dcda" },
] as const;
export function roomColors(
  scene: DemoScene,
  draft: Pick<Arrangement, "background">,
) {
  const preset =
      roomFinishes.find((p) => p.id === draft.background?.preset) ??
      roomFinishes[0],
    b = scene.composition.background;
  const original = {
    wall:
      b?.materials?.wall.color ??
      b?.geometry?.surfaces.find((s) => s.role === "wall")?.color ??
      scene.composition.environment.wallColor,
    floor:
      b?.materials?.ground.color ??
      b?.geometry?.surfaces.find((s) => s.role === "floor")?.color ??
      scene.composition.environment.floorColor,
  };
  const wall =
      draft.background?.wall ??
      (preset.id === "original" ? original.wall : preset.wall),
    floor =
      draft.background?.floor ??
      (preset.id === "original" ? original.floor : preset.floor);
  return continuousBackdrop(scene, draft)
    ? {
        wall: draft.background?.wall ?? draft.background?.floor ?? wall,
        floor: draft.background?.wall ?? draft.background?.floor ?? wall,
      }
    : { wall, floor };
}
export const continuousBackdrop = (
  scene: DemoScene,
  draft: Pick<Arrangement, "background">,
) =>
  draft.background?.preset === "studio" ||
  scene.composition.background?.transition === "curve";
export function demoRoomAppearance(
  scene: DemoScene,
  draft: Pick<Arrangement, "background"> & Partial<Pick<Arrangement,"items">>,
) {
  const settings = draft.background;
  if (
    !settings ||
    (settings.preset === "original" &&
      !settings.wall &&
      !settings.floor &&
      settings.keepFloor !== false)
  )
    return { composition: scene.composition, appearance: scene.appearance };
  const keepFloor = settings.keepFloor ?? settings.preset === "original";
  const colors = roomColors(scene, draft),
    original = scene.composition,
    b = original.background;
  const composition: SceneComposition = {
    ...original,
    environment: {
      ...original.environment,
      wallColor: colors.wall,
      floorColor: colors.floor,
    },
  };
  if (settings.preset === "studio") {
    const dx=original.camera.target[0]-original.camera.position[0],dz=original.camera.target[2]-original.camera.position[2],length=Math.hypot(dx,dz)||1,forward=[dx/length,dz/length];
    const height = Math.max(...scene.objects.map((o) => o.placement.size[1])),
      rear =
        Math.max(
          0.5,
          ...scene.objects.map(
            (o) =>
              ((draft.items?.[o.id]?.x??o.position[0])-original.camera.target[0])*forward[0]+
              ((draft.items?.[o.id]?.z??o.position[2])-original.camera.target[2])*forward[1]+
              (draft.items?Math.max(...resolvedDemoObject(scene,draft as Arrangement,o.id).placement.size):Math.max(...o.placement.size)),
          ),
        ) +
        height * 0.6;
    composition.background = {
      kind: "seamless",
      groundVisible: true,
      boundary: null,
      description: "Visitor-selected seamless studio",
      surfaceMode: "materials",
      transition: "curve",
      spatial: {
        rearDistance: rear,
        curveRadius: Math.max(0.25, height * 0.4),
        confidence: 0.25,
        source: "subject-relative-fallback",
      },
      materials: {
        ground: { color: colors.floor, roughness: 0.85, tileSize: 1 },
        wall: { color: colors.wall, roughness: 0.9, tileSize: 1 },
      },
    };
    return {
      composition,
      appearance: {
        ...scene.appearance,
        floorUrl: null,
        wallUrl: null,
        backgroundUrl: null,
      },
    };
  }
  if (b?.geometry) {
    composition.background = {
      ...b,
      geometry: {
        ...b.geometry,
        surfaces: b.geometry.surfaces.map((s) =>
          s.role === "window" ||
          s.role === "opening" ||
          (s.role === "floor" && keepFloor)
            ? s
            : {
                ...s,
                color:
                  s.role === "floor" || s.role === "surface"
                    ? colors.floor
                    : colors.wall,
                textured: false,
              },
        ),
      },
    };
  } else
    composition.background = {
      kind: b?.kind ?? "seamless",
      groundVisible: true,
      boundary: b?.boundary ?? null,
      description: "Visitor-selected showroom finish",
      surfaceMode: "materials",
      transition: b?.transition ?? (b?.kind === "planes" ? "open" : "curve"),
      ...(b?.spatial ? { spatial: b.spatial } : {}),
      ...(b?.junctions
        ? { junctions: b.junctions }
        : b?.boundary
          ? {
              junctions: [
                { x: 0, y: b.boundary.leftY },
                { x: 1, y: b.boundary.rightY },
              ],
            }
          : {}),
      materials: {
        ground: { color: colors.floor, roughness: 0.85, tileSize: 1 },
        wall: { color: colors.wall, roughness: 0.9, tileSize: 1 },
      },
    };
  return {
    composition,
    appearance: {
      ...scene.appearance,
      floorUrl: keepFloor ? scene.appearance.floorUrl : null,
      wallUrl: null,
      backgroundUrl: b?.geometry ? scene.appearance.backgroundUrl : null,
    },
  };
}
export function shuffleFinishes(
  draft: Arrangement,
  random = Math.random,
): Arrangement {
  return {
    ...draft,
    items: Object.fromEntries(
      Object.entries(draft.items).map(([id, item]) => {
        const product = findDemoProduct(itemProductId(id, item))!,
          choices = product.colors
            .map((_, i) => i)
            .filter((i) => i !== item.color),
          index = Math.max(
            0,
            Math.min(choices.length - 1, Math.floor(random() * choices.length)),
          );
        return [id, { ...item, color: choices[index] ?? item.color }];
      }),
    ),
  };
}
export const arrangementProducts = (draft: Arrangement) =>
  Object.entries(draft.items)
    .filter(([, item]) => item.included !== false && !item.owned)
    .map(([id, item]) => ({ id: itemProductId(id, item), color: item.color }));
