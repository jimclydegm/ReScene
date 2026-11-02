import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  demoScenes,
  initialArrangement,
  changeArrangement,
  collectionLayouts,
  resolveCollectionLayouts,
} from "../src/lib/demo/scenes";
import albumData from "../src/lib/demo/photography.json";
import exampleMedia from "../src/lib/demo/example-media.json";
import { demoProducts } from "../src/lib/demo/catalog";
import { productAlbum, sceneAlbum } from "../src/lib/demo/albums";
import { demoRenderObjects } from "../src/lib/demo/render-objects";
import { persistedDemoSchema, addToCart } from "../src/lib/demo/state";
describe("shopping albums and scene controls", () => {
  it("uses real Muse Image generations from reference photos, retains originals and verifies every image", async () => {
    expect(albumData.model).toMatch(/^muse-image-/);
    for (const p of demoProducts) {
      const album = productAlbum(p.id);
      if (!Object.hasOwn(albumData.products, p.id)) {
        expect(album[0].kind).toBe(
          Object.hasOwn(exampleMedia.products, p.id) ? "generated" : "photo",
        );
        expect(
          (await sharp(readFileSync(`public${album[0].path}`)).metadata())
            .width,
        ).toBeGreaterThan(0);
        continue;
      }
      expect(album[0].kind).toBe("generated");
      expect(album[0].id).toBe("studio");
      expect(album.length).toBeGreaterThanOrEqual(5);
      expect(album.some((i) => i.kind === "photo")).toBe(true);
      const generated = album.filter((i) => i.kind === "generated");
      expect(
        new Set(generated.map((i) => i.color)).size,
      ).toBeGreaterThanOrEqual(2);
      for (const entry of generated) {
        expect(entry.path).toMatch(/^\/demo\/photography\//);
        expect(entry.model).toMatch(/^muse-image-/);
        expect(entry.referencePath).toMatch(/^\/demo\/images\//);
        expect(
          createHash("sha256")
            .update(readFileSync(`public${entry.referencePath}`))
            .digest("hex"),
        ).toBe(entry.referenceSha256);
        expect(entry.prompt).toContain("PHOTOGRAPH");
        const bytes = readFileSync(`public${entry.path}`);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(
          entry.sha256,
        );
        const info = await sharp(bytes).metadata();
        expect([info.width, info.height]).toEqual([entry.width, entry.height]);
        expect(info.width).toBeGreaterThanOrEqual(768);
      }
    }
    for (const scene of demoScenes) {
      const album = sceneAlbum(scene.id);
      const fresh = Object.hasOwn(exampleMedia.scenes, scene.id);
      expect(album[0].kind).toBe(fresh ? "generated" : "photo");
      expect(album).toHaveLength(fresh ? 1 : 3);
      expect(album.filter((i) => i.kind === "generated")).toHaveLength(
        fresh ? 1 : 2,
      );
    }
  });
  it("offers six safe front-facing presets, preserves custom layouts and repairs the old auto back view", () => {
    for (const scene of demoScenes) {
      const layouts = collectionLayouts(scene);
      expect(Object.keys(layouts)).toEqual(["A", "B", "C", "D", "E", "F"]);
      for (const layout of Object.values(layouts))
        for (const item of Object.values(layout.items))
          expect(Math.abs(item.yaw)).toBeLessThan(Math.PI / 4);
      const custom = structuredClone(layouts);
      custom.A.items[scene.objects[0].id].color = 4;
      custom.D = initialArrangement(scene);
      for (const item of Object.values(custom.D.items)) {
        item.x = -item.x;
        item.z = -item.z;
        item.yaw = Math.PI;
        item.color = 3;
      }
      const resolved = resolveCollectionLayouts(scene, custom);
      expect(resolved.A.items[scene.objects[0].id].color).toBe(4);
      expect(resolved.D.items[scene.objects[0].id].color).toBe(3);
      expect(Math.abs(resolved.D.items[scene.objects[0].id].yaw)).toBeLessThan(
        Math.PI / 4,
      );
      const { E: _e, F: _f, ...old } = custom;
      void _e;
      void _f;
      expect(resolveCollectionLayouts(scene, old).F).toBeDefined();
    }
  });
  it("hides and restores the actual mesh in both the room and individual inspection views", () => {
    for (const scene of demoScenes) {
      const id = scene.objects[0].id,
        initial = initialArrangement(scene),
        hidden = changeArrangement(scene, initial, id, { visible: false });
      expect(hidden.error).toBeNull();
      expect(
        demoRenderObjects(scene, hidden.draft).find((o) => o.id === id)!
          .visible,
      ).toBe(false);
      expect(
        demoRenderObjects(scene, hidden.draft, { individual: id })[0].visible,
      ).toBe(false);
      const shown = changeArrangement(scene, hidden.draft, id, {
        visible: true,
      });
      expect(shown.error).toBeNull();
      expect(
        demoRenderObjects(scene, shown.draft, { individual: id })[0].visible,
      ).toBe(true);
    }
  });
  it("restores hidden furniture in each supplied preset without introducing a new pose", () => {
    for (const scene of demoScenes)
      for (const draft of Object.values(collectionLayouts(scene)))
        for (const o of scene.objects) {
          const hidden = changeArrangement(scene, draft, o.id, {
            visible: false,
          });
          expect(hidden.error).toBeNull();
          const shown = changeArrangement(scene, hidden.draft, o.id, {
            visible: true,
          });
          expect(shown.error, `${scene.id}/${o.id}`).toBeNull();
        }
  });
  it("rejects restoring a hidden item moved deeper into another product", () => {
    const scene = demoScenes.find((s) => s.id === "workspace")!,
      draft = initialArrangement(scene),
      hidden = changeArrangement(scene, draft, "workspace-item-2", { visible: false }).draft;
    hidden.items["workspace-item-2"].x = hidden.items["workspace-item-3"].x;
    hidden.items["workspace-item-2"].z = hidden.items["workspace-item-3"].z;
    expect(changeArrangement(scene, hidden, "workspace-item-2", { visible: true }).error).toContain("overlaps");
  });
  it("round-trips the expanded finishes and six layout slots without changing earlier variant indices", () => {
    for (const p of demoProducts) {
      expect(p.colors.length).toBeGreaterThanOrEqual(
        Object.hasOwn(albumData.products, p.id) ? 7 : 5,
      );
      expect(p.colors[0].value).toBeNull();
    }
    const scene = demoScenes.find((s) => s.id === "corner")!,
      layouts = collectionLayouts(scene);
    layouts.E.items["corner-chair"].color = 6;
    const saved = {
      version: 1,
      cart: addToCart([], "corner-chair", 6),
      layouts: null,
      collections: { corner: layouts },
    };
    expect(persistedDemoSchema.parse(saved)).toEqual(saved);
  });
});
