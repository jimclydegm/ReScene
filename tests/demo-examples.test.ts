import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import sharp from "sharp";
import {
  exampleProducts,
  exampleScenes,
  exampleSceneProducts,
} from "../src/lib/demo/example-batch";
import {
  demoProducts,
  collectionIds,
  collectionProducts,
} from "../src/lib/demo/catalog";
import models from "../src/lib/demo/catalog-models.json";
import media from "../src/lib/demo/example-media.json";
import {
  demoScenes,
  initialArrangement,
  collectionLayouts,
  validateArrangement,
} from "../src/lib/demo/scenes";
import { productAlbum, productCover, sceneAlbum } from "../src/lib/demo/albums";
import {
  stylistInputSchema,
  type ShoppingIntent,
} from "../src/lib/shopping/contracts";
import {
  buildCandidates,
  merchandiseTotal,
  stylistCompatible,
} from "../src/lib/shopping/engine";
import { voiceCommandInput } from "../src/lib/voice/contracts";

describe("Muse-generated example library", () => {
  it("offers five distinct photographed and modeled products in all six requested categories", () => {
    for (const kind of ["chair", "drawer", "mouse", "sofa", "shoes", "mug"]) {
      const batch = exampleProducts.filter((p) => p.kind === kind);
      expect(batch).toHaveLength(5);
      const selected = batch.map((p) => {
        const listing = demoProducts.find((v) => v.id === p.id)!,
          model = models.find((v) => v.id === p.id)!;
        expect(listing).toMatchObject({ role: kind, price: p.price });
        expect(listing.description.length).toBeGreaterThan(40);
        expect(listing.materials).toBeTruthy();
        expect(listing.dimensions).toBeTruthy();
        expect(listing.colors.length).toBeGreaterThanOrEqual(6);
        expect(model.bytes).toBeLessThanOrEqual(16 * 1024 * 1024);
        return model.digest;
      });
      expect(new Set(selected).size).toBe(5);
    }
  });
  it("uses new high-resolution Muse photographs, never cropped product cards or mesh screenshots", async () => {
    const ids = [...exampleProducts, ...exampleSceneProducts].map((p) => p.id);
    expect(ids).toHaveLength(58);
    const hashes = new Set<string>();
    for (const id of ids) {
      const first = productAlbum(id)[0];
      expect(first.kind).toBe("generated");
      expect(first.id).toBe("studio");
      expect(first.model).toBe("muse-image-1.0");
      expect(first.path).toMatch(/^\/demo\/expansion\//);
      expect(productCover(id)).toBe(first.path);
      const bytes = readFileSync(`public${first.path}`),
        digest = createHash("sha256").update(bytes).digest("hex"),
        info = await sharp(bytes).metadata();
      expect(digest).toBe(first.sha256);
      expect(info.width).toBeGreaterThanOrEqual(1600);
      expect(info.height).toBeGreaterThanOrEqual(1600);
      hashes.add(digest);
    }
    expect(hashes.size).toBe(58);
  });
  it("makes all eight attached scene concepts available as real interactive collections", () => {
    for (const definition of exampleScenes) {
      const scene = demoScenes.find((s) => s.id === definition.id)!;
      expect(scene).toBeDefined();
      expect(collectionIds).toContain(definition.id);
      expect(scene.objects).toHaveLength(definition.concepts.length);
      expect(scene.objects.map((o) => o.id)).toEqual(
        collectionProducts[definition.id],
      );
      expect(sceneAlbum(scene.id)[0]).toMatchObject({
        kind: "generated",
        model: "muse-image-1.0",
      });
      expect(existsSync(`public/demo/images/${scene.id}.webp`)).toBe(true);
      for (const draft of Object.values(collectionLayouts(scene)))
        expect(
          validateArrangement(scene, initialArrangement(scene), draft),
        ).toBeNull();
    }
    expect(demoScenes).toHaveLength(11);
    expect(demoProducts).toHaveLength(72);
    expect(models).toHaveLength(72);
  });
  it("publishes only approved render data and product fields", () => {
    const text = JSON.stringify(media);
    expect(text).not.toMatch(
      /ownerId|storageKey|\/Users\/|referencePath|providerRequest|api.key|LLM_|postgresql|https:\/\//i,
    );
    expect(Object.keys(media.products)).toHaveLength(58);
    expect(Object.keys(media.scenes)).toHaveLength(8);
    for (const p of [...exampleProducts, ...exampleSceneProducts])
      expect(models.some((m) => m.id === p.id)).toBe(true);
  });
  const intent: ShoppingIntent = {
    summary: "Coordinate the collection",
    palette: "warm",
    keep: [],
    excludedProductIds: [],
    requireStorage: false,
    budgetCents: null,
    strictBudget: false,
    lighting: null,
    background: null,
    layout: "original",
    clarification: null,
  };
  it("uses the new collections in voice and stylist requests while rejecting private scene IDs", () => {
    for (const definition of exampleScenes) {
      const scene = demoScenes.find((s) => s.id === definition.id)!,
        input = {
          key: crypto.randomUUID(),
          sceneId: scene.id,
          text: "Coordinate this collection",
          selected: scene.objects[0].id,
          keep: [],
          budgetCents: 999900,
          draft: initialArrangement(scene),
        };
      expect(stylistInputSchema.safeParse(input).success).toBe(true);
      expect(
        voiceCommandInput.safeParse({
          attemptId: crypto.randomUUID(),
          sceneId: scene.id,
          text: input.text,
          selected: input.selected,
          draft: input.draft,
        }).success,
      ).toBe(true);
      expect(
        stylistInputSchema.safeParse({ ...input, sceneId: crypto.randomUUID() })
          .success,
      ).toBe(false);
    }
  });
  it("keeps product roles distinct and produces affordable replacement combinations", () => {
    for (const [sceneId, slot, kind] of [
      ["workspace", "workspace-item-4", "mouse"],
      ["playtime", "playtime-item-2", "mug"],
      ["city-style", "city-style-item-2", "shoes"],
    ]) {
      const scene = demoScenes.find((s) => s.id === sceneId)!,
        draft = initialArrangement(scene);
      for (const [id, item] of Object.entries(draft.items))
        if (id !== slot) item.owned = true;
      const request = {
        key: crypto.randomUUID(),
        sceneId,
        text: `Choose a coordinated ${kind}`,
        selected: slot,
        keep: [],
        budgetCents: 15000,
        draft,
      };
      const offered = exampleProducts.filter((p) => p.kind === kind);
      for (const p of offered)
        expect(
          stylistCompatible(
            scene,
            slot,
            demoProducts.find((v) => v.id === p.id)!,
            intent,
          ),
        ).toBe(true);
      expect(
        stylistCompatible(
          scene,
          slot,
          demoProducts.find((v) => v.id === "cloud-ivory-sofa")!,
          intent,
        ),
      ).toBe(false);
      const result = buildCandidates(request, intent);
      expect(result.candidates.length).toBeGreaterThan(1);
      for (const c of result.candidates) {
        expect(c.subtotalCents).toBe(merchandiseTotal(c.draft));
        expect(c.subtotalCents).toBeLessThanOrEqual(15000);
        expect(
          demoProducts.find((p) => p.id === c.draft.items[slot].productId)
            ?.role,
        ).toBe(kind);
      }
    }
  });
});
