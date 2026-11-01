import { describe, it, expect } from "vitest";
import {
  demoScenes,
  initialArrangement,
  changeArrangement,
  validateArrangement,
  resolvedDemoObject,
} from "../src/lib/demo/scenes";
import {
  demoProducts,
  findDemoProduct,
  itemProductId,
  money,
} from "../src/lib/demo/catalog";
import {
  buildCandidates,
  checkCombination,
  merchandiseTotal,
  purchaseLines,
  stylistCompatible,
} from "../src/lib/shopping/engine";
import { decimalToCents, listingProfile } from "../src/lib/shopping/listing";
import {
  stylistInputSchema,
  shoppingIntentSchema,
  type ShoppingIntent,
  type StylistInput,
} from "../src/lib/shopping/contracts";
import {
  editHistory,
  recordEdit,
  undoEdit,
  redoEdit,
} from "../src/lib/editor/history";
import { strictResponseFormat } from "../src/lib/ai/structured-output";
const scene = demoScenes.find((s) => s.id === "corner")!;
const input = (): StylistInput => ({
  key: crypto.randomUUID(),
  sceneId: "corner",
  selected: "corner-chair",
  text: "Keep this chair and make this corner warmer under $500",
  budgetCents: 50000,
  keep: ["corner-chair"],
  draft: initialArrangement(scene),
});
const intent = (): ShoppingIntent => ({
  summary: "A warmer corner",
  palette: "warm",
  keep: ["corner-chair"],
  excludedProductIds: [],
  requireStorage: false,
  budgetCents: 50000,
  strictBudget: true,
  lighting: "Dusk",
  background: "linen",
  layout: "original",
  clarification: null,
});
describe("Budget-aware shopping combinations", () => {
  it("uses exact minor units and displays cents without rounding a quote", () => {
    expect(decimalToCents("249.01")).toBe(24901);
    expect(decimalToCents("0.09")).toBe(9);
    expect(decimalToCents("4.5")).toBe(450);
    expect(() => decimalToCents("1.001")).toThrow();
    expect(money(24901)).toBe("$249.01");
  });
  it("finds affordable whole arrangements and preserves kept products, finishes and required items", () => {
    const before = input();
    before.draft.items["corner-chair"].color = 3;
    before.draft.items["corner-chair"].locked = true;
    const result = buildCandidates(before, intent());
    expect(result.candidates.length).toBeGreaterThan(1);
    for (const c of result.candidates) {
      expect(c.subtotalCents).toBeLessThan(50000);
      expect(c.subtotalCents).toBe(merchandiseTotal(c.draft));
      expect(c.draft.items["corner-chair"]).toMatchObject(
        before.draft.items["corner-chair"],
      );
      expect(checkCombination(before, intent(), c.draft)).toBeNull();
      expect(Object.keys(c.draft.items)).toHaveLength(3);
    }
  });
  it("uses saved generated products beyond the original eleven", () => {
    const result = buildCandidates(input(), intent());
    expect(demoProducts.length).toBeGreaterThan(11);
    expect(
      result.candidates.some((c) =>
        Object.entries(c.draft.items).some(
          ([s, i]) => itemProductId(s, i) === "sol-ceramic-lamp",
        ),
      ),
    ).toBe(true);
  });
  it("does not invent an affordable option when kept purchases already exceed the limit", () => {
    const request = input();
    request.keep.push("corner-cabinet");
    expect(buildCandidates(request, intent()).candidates).toHaveLength(0);
  });
  it("excludes explicitly owned pieces from the purchase subtotal and bag while retaining their identity", () => {
    const request = input();
    request.draft.items["corner-chair"].owned = true;
    request.budgetCents = 25000;
    const parsed = { ...intent(), budgetCents: 25000 };
    const result = buildCandidates(request, parsed);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const c of result.candidates) {
      expect(c.draft.items["corner-chair"].owned).toBe(true);
      expect(c.subtotalCents).toBeLessThan(25000);
      expect(purchaseLines(c.draft).some((l) => l.id === "corner-chair")).toBe(
        false,
      );
    }
  });
  it("counts hidden purchases and repeated product instances correctly", () => {
    const d = initialArrangement(scene);
    d.items["corner-chair"].visible = false;
    expect(merchandiseTotal(d)).toBe(62700);
    expect(purchaseLines(d)).toHaveLength(3);
    d.items["corner-chair"].included = false;
    expect(merchandiseTotal(d)).toBe(37800);
    const two = {
      lighting: "Original" as const,
      items: {
        a: {
          ...d.items["corner-chair"],
          included: true,
          productId: "corner-chair",
        },
        b: {
          ...d.items["corner-chair"],
          included: true,
          productId: "corner-chair",
        },
      },
    };
    expect(merchandiseTotal(two)).toBe(49800);
    expect(purchaseLines(two)).toHaveLength(2);
  });
  it("rejects attempts to bypass a budget or change ownership/inclusion to make a look cheaper", () => {
    const request = input(),
      proposal = structuredClone(request.draft);
    expect(checkCombination(request, intent(), proposal)).toContain("budget");
    proposal.items["corner-chair"].owned = true;
    expect(checkCombination(request, intent(), proposal)).toContain(
      "purchase selection",
    );
  });
  it("keeps seating and storage requirements compatible", () => {
    expect(
      stylistCompatible(
        scene,
        "corner-chair",
        findDemoProduct("ceramic-vase")!,
        intent(),
      ),
    ).toBe(false);
    expect(
      stylistCompatible(
        scene,
        "corner-cabinet",
        findDemoProduct("round-table")!,
        { ...intent(), requireStorage: true },
      ),
    ).toBe(false);
  });
  it("prevents moving a position-locked accessory indirectly with its support", () => {
    const d = initialArrangement(scene);
    d.items["corner-vase"].locked = true;
    const r = changeArrangement(scene, d, "corner-cabinet", {
      x: d.items["corner-cabinet"].x + 0.1,
    });
    expect(r.error).toContain("Unlock");
    expect(r.draft).toEqual(d);
  });
  it("validates a final swap without requiring an invalid intermediate collision", () => {
    const s = demoScenes.find((s) => s.id === "space")!,
      d = initialArrangement(s);
    for (const i of Object.values(d.items)) i.visible = false;
    d.items["sage-chair"] = {
      ...d.items["sage-chair"],
      visible: true,
      x: -3,
      z: 3,
    };
    d.items["dining-chair"] = {
      ...d.items["dining-chair"],
      visible: true,
      x: 3,
      z: 3,
    };
    expect(
      changeArrangement(s, d, "sage-chair", { x: 3 }).error,
    ).not.toBeNull();
    const final = structuredClone(d);
    final.items["sage-chair"].x = 3;
    final.items["dining-chair"].x = -3;
    expect(validateArrangement(s, d, final)).toBeNull();
  });
  it("uses observed wall planes to reject new placement through a room boundary", () => {
    const s = demoScenes.find((s) => s.id === "living")!,
      d = initialArrangement(s),
      after = structuredClone(d);
    after.items["cloud-sofa"].z = -5;
    expect(validateArrangement(s, d, after,{roomBounds:true})).toContain("walls");
  });
  it("applies an entire recommendation in one undo/redo entry", () => {
    const before = input(),
      option = buildCandidates(before, intent()).candidates[0];
    const timeline = recordEdit(editHistory(before.draft), option.draft);
    expect(timeline.past).toHaveLength(1);
    expect(undoEdit(timeline).present).toEqual(before.draft);
    expect(redoEdit(undoEdit(timeline)).present).toEqual(option.draft);
  });
  it("rejects unknown models rather than rendering the previous product under a new label", () => {
    const d = initialArrangement(scene);
    d.items["corner-chair"].productId = "missing-model";
    expect(() => resolvedDemoObject(scene, d, "corner-chair")).toThrow();
    expect(stylistInputSchema.safeParse({ ...input(), draft: d }).success).toBe(
      false,
    );
  });
  it("keeps Meta intent contracts strict and supports general catalog categories", () => {
    expect(() =>
      strictResponseFormat("intent", shoppingIntentSchema),
    ).not.toThrow();
    expect(listingProfile("red running shoe").category).toBe("Footwear");
    expect(listingProfile("cotton shirt").category).toBe("Clothing");
    expect(listingProfile("ceramic table lamp").category).toBe(
      "Home accessories",
    );
  });
});
