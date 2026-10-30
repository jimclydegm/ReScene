import { describe, expect, it } from "vitest";
import { plainBackground, refineOpenings } from "../src/lib/appearance/plain";
import { reconstructionOptionsSchema } from "../src/lib/ai/controls";
import { backgroundPlanSchema } from "../src/lib/scene/background";

function fixture(background = 255, subject = 80) {
  const width = 128, height = 128, data = new Uint8Array(width * height * 3).fill(background), mask = new Uint8Array(width * height);
  function rect(x: number, y: number, w: number, h: number, value: number, foreground = false) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = yy * width + xx;
      data.fill(value, i * 3, i * 3 + 3);
      if (foreground) mask[i] = 255;
    }
  }
  rect(24, 24, 80, 72, subject, true);
  return { photo: { data, width, height }, mask, rect };
}
describe("Plain backgrounds and reconstruction evidence", () => {
  it("uses the dominant plain color without baking the minority cast shadow", () => {
    const f = fixture(); f.rect(28, 96, 72, 8, 150);
    expect(plainBackground(f.photo, [f.mask])?.color).toBe("#ffffff");
    const dark = fixture(32); expect(plainBackground(dark.photo, [dark.mask])?.color).toBe("#202020");
  });
  it("keeps gradients, patterned and distant context as photographic backgrounds", () => {
    const f = fixture();
    for (let i = 0; i < f.mask.length; i++) if (!f.mask[i]) f.photo.data.fill(80 + Math.floor(i / 128), i * 3, i * 3 + 3);
    expect(plainBackground(f.photo, [f.mask])).toBeNull();
    for (let i = 0; i < f.mask.length; i++) if (!f.mask[i]) f.photo.data.fill(Math.floor(i / 16) % 2 ? 100 : 220, i * 3, i * 3 + 3);
    expect(plainBackground(f.photo, [f.mask])).toBeNull();
  });
  it("uses the union of all subjects and rejects mismatched/oversized pixel buffers", () => {
    const f = fixture(), extra = new Uint8Array(f.mask.length);
    f.rect(0, 0, 32, 128, 0);
    for (let y = 0; y < 128; y++) extra.fill(255, y * 128, y * 128 + 32);
    expect(plainBackground(f.photo, [f.mask])).toBeNull();
    expect(plainBackground(f.photo, [f.mask, extra])?.color).toBe("#ffffff");
    expect(() => refineOpenings(f.photo, new Uint8Array(1))).toThrow("BACKGROUND_PIXEL_SIZE");
    expect(() => plainBackground({ ...f.photo, width: 1e9 }, [])).toThrow();
  });
  it("recovers an enclosed opening with a dark interior rim without mutating the reviewed mask", () => {
    const f = fixture(); f.rect(40, 40, 20, 16, 15); f.rect(43, 43, 14, 10, 255);
    const before = new Uint8Array(f.mask), r = refineOpenings(f.photo, f.mask);
    expect(r.openings).toBe(1); expect(r.removed).toBe(140); expect(r.pixels[48 * 128 + 48]).toBe(0); expect(f.mask).toEqual(before);
  });
  it("preserves white subjects, small bright print and regions touching an outer silhouette", () => {
    const white = fixture(255, 255); expect(refineOpenings(white.photo, white.mask).removed).toBe(0);
    const print = fixture(255, 10); print.rect(45, 45, 4, 4, 255); expect(refineOpenings(print.photo, print.mask).removed).toBe(0);
    const outer = fixture(255, 10); outer.rect(24, 40, 14, 10, 255); expect(refineOpenings(outer.photo, outer.mask).removed).toBe(0);
  });
  it("does not carve a large pale highlight or infer openings against textured/dark backgrounds", () => {
    const f = fixture(); f.rect(40, 40, 14, 10, 255); expect(refineOpenings(f.photo, f.mask).removed).toBe(0);
    const dark = fixture(32, 0); dark.rect(40, 40, 14, 10, 32); expect(refineOpenings(dark.photo, dark.mask).removed).toBe(0);
  });
  it("persists refinement opt-out and only accepts safe solid colors in render contracts", () => {
    expect(reconstructionOptionsSchema.parse({}).refineOpenings).toBe(false);
    expect(reconstructionOptionsSchema.parse({ refineOpenings: false }).refineOpenings).toBe(false);
    const plan = { kind: "seamless", groundVisible: true, boundary: null, description: "Plain", plainColor: "#ffffff" };
    expect(backgroundPlanSchema.safeParse(plan).success).toBe(true);
    expect(backgroundPlanSchema.safeParse({ ...plan, plainColor: "url(private-photo)" }).success).toBe(false);
  });
});
