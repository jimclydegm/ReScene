import { describe, it, expect } from "vitest";
import {
  demoScenes,
  initialArrangement,
  changeArrangement,
  resolvedDemoObject,
  collectionLayouts,
  resetItemPatch,
} from "../src/lib/demo/scenes";
import { demoRenderObjects } from "../src/lib/demo/render-objects";
import {
  arrangementProducts,
  demoRoomAppearance,
  shuffleFinishes,
  roomFinishes,
} from "../src/lib/demo/room-appearance";
import {
  addToCart,
  cartTotal,
  persistedDemoSchema,
  arrangementSchema,
} from "../src/lib/demo/state";
import {
  editHistory,
  recordEdit,
  undoEdit,
  redoEdit,
} from "../src/lib/editor/history";
import { compositionSchema } from "../src/lib/scene/composition";
const corner = demoScenes.find((s) => s.id === "corner")!;
describe("Customizable shopping showroom", () => {
  it("replaces the real asset and product while keeping the slot, pose and uniform proportions", () => {
    const original = initialArrangement(corner);
    original.items["corner-chair"].color = 3;
    original.items["corner-chair"].yaw = 0.15;
    const result = changeArrangement(corner, original, "corner-chair", {
      productId: "dining-chair",
    });
    expect(result.error).toBeNull();
    const rendered = demoRenderObjects(corner, result.draft).find(
        (o) => o.id === "corner-chair",
      )!,
      source = demoScenes
        .flatMap((s) => s.objects)
        .find((o) => o.id === "dining-chair")!;
    expect(rendered.modelUrl).toContain("/dining-chair?v=");
    expect(rendered.label).toBe("Line Dining Chair");
    expect(rendered.positionX).toBe(original.items["corner-chair"].x);
    expect(rendered.yaw).toBe(0.15);
    expect(result.draft.items["corner-chair"].color).toBe(0);
    const factors = rendered.placement!.scale.map(
      (v, k) => v / source.placement.scale[k],
    );
    expect(factors[0]).toBeCloseTo(factors[1]);
    expect(factors[1]).toBeCloseTo(factors[2]);
    expect(original.items["corner-chair"].productId).toBeUndefined();
  });
  it("keeps accessories on a replacement table and carries them when it moves", () => {
    const initial = initialArrangement(corner),
      replacement = changeArrangement(corner, initial, "corner-cabinet", {
        productId: "round-table",
      });
    expect(replacement.error).toBeNull();
    const parent = resolvedDemoObject(
        corner,
        replacement.draft,
        "corner-cabinet",
      ),
      child = resolvedDemoObject(corner, replacement.draft, "corner-vase");
    expect(child.position[1]).toBeCloseTo(
      parent.position[1] + parent.placement.size[1],
    );
    const moved = changeArrangement(
      corner,
      replacement.draft,
      "corner-cabinet",
      { x: 2.5, yaw: 0.25 },
    );
    expect(moved.error).toBeNull();
    expect(moved.draft.items["corner-vase"].x).not.toBe(
      initial.items["corner-vase"].x,
    );
    expect(
      changeArrangement(
        corner,
        moved.draft,
        "corner-vase",
        resetItemPatch(corner, moved.draft, "corner-vase"),
      ).error,
    ).toBeNull();
    expect(
      changeArrangement(corner, initial, "corner-cabinet", {
        productId: "dining-chair",
      }).error,
    ).toContain("supports");
    expect(
      changeArrangement(corner, initial, "corner-vase", {
        productId: "cloud-sofa",
      }).error,
    ).toContain("accessory");
  });
  it("uses replacement prices and identities in the bag and excludes hidden pieces", () => {
    const replaced = changeArrangement(
        corner,
        initialArrangement(corner),
        "corner-chair",
        { productId: "dining-chair" },
      ).draft,
      lines = arrangementProducts(replaced);
    expect(lines.map((l) => l.id)).toEqual([
      "dining-chair",
      "corner-cabinet",
      "corner-vase",
    ]);
    const cart = lines.reduce(
      (cart, l) => addToCart(cart, l.id, l.color),
      addToCart([], "dining-chair"),
    );
    expect(cart.find((l) => l.productId === "dining-chair")?.quantity).toBe(2);
    expect(cartTotal(cart)).toBe(61600);
    const hidden = changeArrangement(corner, replaced, "corner-chair", {
      visible: false,
    }).draft;
    expect(
      arrangementProducts(hidden).some((l) => l.id === "dining-chair"),
    ).toBe(false);
  });
  it("rejects larger replacement collisions and leaves the accepted arrangement unchanged", () => {
    const living = demoScenes.find((s) => s.id === "living")!,
      draft = initialArrangement(living),
      result = changeArrangement(living, draft, "ceramic-vase", {
        productId: "cloud-sofa",
      });
    expect(result.error).toContain("overlaps");
    expect(result.draft).toBe(draft);
  });
  it("locks placement while allowing finish edits and supports one-step undo for a color shuffle", () => {
    let draft = changeArrangement(
      corner,
      initialArrangement(corner),
      "corner-chair",
      { locked: true },
    ).draft;
    expect(
      changeArrangement(corner, draft, "corner-chair", { x: 2 }).error,
    ).toContain("Unlock");
    expect(
      changeArrangement(corner, draft, "corner-chair", { locked: false, x: -2 })
        .error,
    ).toBeNull();
    draft = changeArrangement(corner, draft, "corner-chair", {
      color: 2,
    }).draft;
    const shuffled = shuffleFinishes(draft, () => 0.99);
    for (const [id, item] of Object.entries(draft.items)) {
      expect(shuffled.items[id].color).not.toBe(item.color);
      expect(shuffled.items[id].x).toBe(item.x);
      expect(shuffled.items[id].locked).toBe(item.locked);
    }
    const history = recordEdit(editHistory(draft), shuffled);
    expect(undoEdit(history).present).toEqual(draft);
    expect(redoEdit(undoEdit(history)).present).toEqual(shuffled);
  });
  it("repaints actual backgrounds without changing camera, geometry or frozen source content", () => {
    for (const scene of demoScenes) {
      const snapshot = JSON.stringify(scene),
        draft = initialArrangement(scene);
      expect(demoRoomAppearance(scene, draft).composition).toBe(
        scene.composition,
      );
      for (const p of roomFinishes) {
        const result = demoRoomAppearance(scene, {
          background: { preset: p.id },
        });
        expect(compositionSchema.safeParse(result.composition).success).toBe(
          true,
        );
        expect(result.composition.camera).toBe(scene.composition.camera);
        if (p.id === "studio") {
          expect(result.composition.background?.transition).toBe("curve");
          expect(result.composition.background?.geometry).toBeUndefined();
        } else if (scene.composition.background?.geometry)
          expect(
            result.composition.background?.geometry?.surfaces.map(
              (s) => s.vertices,
            ),
          ).toEqual(
            scene.composition.background.geometry.surfaces.map(
              (s) => s.vertices,
            ),
          );
      }
      expect(JSON.stringify(scene)).toBe(snapshot);
    }
    const living = demoScenes.find((s) => s.id === "living")!,
      room = demoRoomAppearance(living, {
        background: { preset: "sage", keepFloor: true },
      }),
      floor = living.composition.background!.geometry!.surfaces.find(
        (s) => s.role === "floor",
      )!;
    expect(
      room.composition.background!.geometry!.surfaces.find(
        (s) => s.role === "floor",
      ),
    ).toBe(floor);
    expect(
      room.composition.background!.geometry!.surfaces.find(
        (s) => s.role === "wall",
      )?.color,
    ).toBe("#b5c0b0");
  });
  it("round-trips new saved choices alongside legacy bags and rejects unknown products, finishes and backgrounds", () => {
    const layouts = collectionLayouts(corner);
    layouts.A = changeArrangement(corner, layouts.A, "corner-chair", {
      productId: "dining-chair",
      locked: true,
    }).draft;
    layouts.A.background = {
      preset: "linen",
      wall: "#eeccaa",
      keepFloor: true,
    };
    const state = {
      version: 1,
      cart: addToCart([], "sage-chair", 2),
      layouts: null,
      collections: { corner: layouts },
    };
    expect(
      persistedDemoSchema.parse(JSON.parse(JSON.stringify(state))),
    ).toEqual(state);
    expect(
      arrangementSchema.safeParse({
        ...layouts.A,
        background: { preset: "untrusted-url" },
      }).success,
    ).toBe(false);
    const bad = structuredClone(layouts.A);
    bad.items["corner-chair"].productId = "private-model";
    expect(arrangementSchema.safeParse(bad).success).toBe(false);
    bad.items["corner-chair"].productId = "dining-chair";
    bad.items["corner-chair"].color = 15;
    expect(arrangementSchema.safeParse(bad).success).toBe(false);
  });
});
