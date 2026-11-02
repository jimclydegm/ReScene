import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartSchema,
  cartTotal,
  footprintOverlap,
  persistedDemoSchema,
} from "../src/lib/demo/state";
import { demoProducts, demoImage } from "../src/lib/demo/catalog";
import {
  demoScenes,
  initialArrangement,
  startingLayouts,
  collectionLayouts,
  changeArrangement,
  supportOf,
} from "../src/lib/demo/scenes";
import frozen from "../src/lib/demo/frozen-scenes.json";
import { existsSync } from "node:fs";

describe("curated retail demo", () => {
  it("merges matching variants, preserves distinct colors, rejects overflow and uses integer totals", () => {
    let cart = addToCart([], "sage-chair", 0, 2);
    cart = addToCart(cart, "sage-chair", 0, 1);
    cart = addToCart(cart, "sage-chair", 1, 1);
    expect(cart).toHaveLength(2);
    expect(cart[0].quantity).toBe(3);
    expect(cartTotal(cart)).toBe(99600);
    expect(() => addToCart(cart, "sage-chair", 0, 20)).toThrow(/20/);
    expect(cart[0].quantity).toBe(3);
  });
  it("rejects unknown listings, invalid variants, duplicate lines, untrusted totals and malformed local storage", () => {
    expect(() => addToCart([], "private-object")).toThrow();
    expect(() => addToCart([], "oak-dresser", 99)).toThrow();
    expect(() => addToCart([], "sage-chair", 0, -1)).toThrow();
    expect(
      cartSchema.safeParse([
        { productId: "sage-chair", color: 0, quantity: 1, price: 1 },
      ]).success,
    ).toBe(false);
    const line = { productId: "sage-chair", color: 0, quantity: 1 };
    expect(cartSchema.safeParse([line, line]).success).toBe(false);
    expect(
      persistedDemoSchema.safeParse({ version: 2, cart: [], layouts: null })
        .success,
    ).toBe(false);
  });
  it("round-trips saved A/B layouts with valid catalog references and rejects missing/unknown members", () => {
    const layouts = startingLayouts();
    layouts.A.items["sage-chair"].color = 2;
    const saved = { version: 1, cart: addToCart([], "round-table"), layouts };
    expect(
      persistedDemoSchema.parse(JSON.parse(JSON.stringify(saved))),
    ).toEqual({ ...saved, collections: {} });
    delete layouts.A.items["round-table"];
    expect(persistedDemoSchema.safeParse(saved).success).toBe(false);
    expect(startingLayouts().A.items["sage-chair"].color).toBe(0);
  });
  it("keeps both starting room arrangements clear of conservative rotated product footprints", () => {
    const scene = demoScenes.find((s) => s.id === "space")!;
    for (const layout of Object.values(startingLayouts()))
      for (let i = 0; i < scene.objects.length; i++)
        for (let j = i + 1; j < scene.objects.length; j++) {
          const a = scene.objects[i],
            b = scene.objects[j];
          expect(
            footprintOverlap(
              {
                ...layout.items[a.id],
                width: a.placement.size[0],
                depth: a.placement.size[2],
              },
              {
                ...layout.items[b.id],
                width: b.placement.size[0],
                depth: b.placement.size[2],
              },
            ),
            `${a.id}/${b.id}`,
          ).toBe(false);
        }
    const box = { x: 0, z: 0, width: 2, depth: 1, yaw: 0 };
    expect(footprintOverlap(box, { ...box, x: 0.5, yaw: Math.PI / 2 })).toBe(
      true,
    );
    expect(footprintOverlap(box, { ...box, x: 2 })).toBe(false);
  });
  it("contains only bounded render state and unique approved meshes; no source keys or credentials", () => {
    const text = JSON.stringify(frozen);
    expect(text).not.toMatch(
      /ownerId|storageKey|sourceAsset|normalizedAsset|maskAsset|provider|LLM_|postgresql|https:\/\//i,
    );
    expect(text).not.toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}/i);
    expect(frozen.scenes.flatMap((s) => s.objects)).toHaveLength(39);
    expect(
      new Set(frozen.scenes.flatMap((s) => s.objects.map((o) => o.id))).size,
    ).toBe(39);
    for (const s of demoScenes) {
      expect(Object.keys(initialArrangement(s).items)).toEqual(
        s.objects.map((o) => o.id),
      );
      for (const o of s.objects)
        expect(demoProducts.some((p) => p.id === o.id)).toBe(true);
    }
    for (const s of frozen.scenes)
      for (const o of s.objects) {
        expect(o.bytes).toBeGreaterThan(100000);
        expect(o.bytes).toBeLessThanOrEqual(16 * 1024 * 1024);
        expect(o.digest).toMatch(/^[0-9a-f]{64}$/);
        expect(existsSync(`public${demoImage(o.id)}`)).toBe(true);
      }
  });
});

it("saves six layouts per collection without mixing products or losing a legacy bag", () => {
  const collections = Object.fromEntries(
    demoScenes.map((scene) => [scene.id, collectionLayouts(scene)]),
  );
  const parsed = persistedDemoSchema.parse({
    version: 1,
    cart: addToCart([], "corner-chair", 2, 2),
    layouts: null,
    collections,
  });
  expect(parsed.cart[0].quantity).toBe(2);
  expect(Object.keys(parsed.collections.corner)).toEqual([
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
  ]);
  expect(parsed.collections.corner.A.items["sage-chair"]).toBeUndefined();
  expect(
    persistedDemoSchema.safeParse({
      ...parsed,
      collections: { bad: collections.corner },
    }).success,
  ).toBe(false);
  expect(
    cartSchema.safeParse([{ productId: "unknown", color: 0, quantity: 1 }])
      .success,
  ).toBe(false);
});
it("keeps the vase on its cabinet while moving/rotating the parent and rejects unsupported accessory moves", () => {
  const scene = demoScenes.find((s) => s.id === "corner")!,
    initial = initialArrangement(scene),
    vase = "corner-vase",
    cabinet = "corner-cabinet";
  expect(supportOf(scene, vase)).toBe(cabinet);
  const result = changeArrangement(scene, initial, cabinet, { x: 3, yaw: 0.4 });
  expect(result.error).toBeNull();
  expect(result.draft.items[vase].x).not.toBe(initial.items[vase].x);
  expect(result.draft.items[vase].yaw).toBeCloseTo(0.4);
  expect(initial.items[cabinet].yaw).toBe(0);
  expect(
    changeArrangement(scene, initial, vase, { x: 5 }).error,
  ).not.toBeNull();
  const hidden = changeArrangement(scene, initial, cabinet, { visible: false });
  expect(hidden.draft.items[vase].visible).toBe(false);
  for (const layout of Object.values(collectionLayouts(scene))) {
    expect(
      changeArrangement(scene, layout, vase, { color: 1 }).error,
    ).toBeNull();
  }
});
it("guards against a new overlap in every editable scene while leaving the accepted state intact", () => {
  for (const scene of demoScenes) {
    const draft = initialArrangement(scene),
      [a, b] = scene.objects;
    const result = changeArrangement(scene, draft, a.id, {
      x: draft.items[b.id].x,
      z: draft.items[b.id].z,
    });
    expect(result.error).not.toBeNull();
    expect(result.draft).toBe(draft);
  }
});
