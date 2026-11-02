import { describe, expect, it } from "vitest";
import { readDemoState } from "../src/lib/demo/persistence";
import { demoProducts } from "../src/lib/demo/catalog";
import { demoScenes, collectionLayouts } from "../src/lib/demo/scenes";

const line = { productId: demoProducts[0].id, color: 0, quantity: 2 };
describe("browser catalog state recovery", () => {
  it("keeps a valid bag when a removed collection or one corrupt line exists", () => {
    const result = readDemoState(JSON.stringify({ version: 1, cart: [line, {...line,productId:"removed"},line], layouts:null, collections:{removed:{}} }));
    expect(result.cart).toEqual([line]);
    expect(result.collections).toEqual({});
  });
  it("retains supported arrangements independently of a damaged collection", () => {
    const scene=demoScenes[0], layouts=collectionLayouts(scene);
    const result=readDemoState(JSON.stringify({version:1,cart:[line],layouts:null,collections:{[scene.id]:layouts,removed:{}}}));
    expect(result.collections[scene.id]).toEqual(layouts);
    expect(result.cart).toEqual([line]);
  });
  it("rejects malformed, unknown-version and oversized browser data", () => {
    for(const raw of [null,"{broken",JSON.stringify({version:2,cart:[line]}),"x".repeat(1_000_001)]) expect(readDemoState(raw).cart).toEqual([]);
  });
});
