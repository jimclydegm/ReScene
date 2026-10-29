import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import sharp from "sharp";
import { photoCamera, transferPixels, visibility, cleanPatch, type Triangle } from "../src/lib/appearance/bake";
import { lightingSchema, defaultLighting } from "../src/lib/scene/lighting";
const camera = photoCamera({ position: [0, 0, 0], target: [0, 0, -1], fov: 90, aspect: 1 });
const triangle: Triangle = { object: 0, image: 0, points: [new Vector3(-1, -1, -2), new Vector3(1, -1, -2), new Vector3(-1, 1, -2)], uv: [[0, 1], [1, 1], [0, 0]] };
const photo = { width: 64, height: 64, data: new Uint8Array(64 * 64 * 3).fill(190) };
const texture = { width: 16, height: 16, data: new Uint8Array(16 * 16 * 3).fill(30) };
describe("Photo texture transfer boundaries", () => {
  it("copies visible masked pixels and retains the existing texture elsewhere", () => {
    const mask = new Uint8Array(4096).fill(255);
    const result = transferPixels([triangle], 0, texture, photo, mask, camera, visibility([triangle], camera, 64, 64));
    expect(result.copied).toBeGreaterThan(30);
    expect(result.data.some(v => v === 190)).toBe(true);
    expect(result.data.some(v => v === 30)).toBe(true);
    expect(texture.data.every(v => v === 30)).toBe(true);
  });
  it("does not copy background or pixels occluded by another object", () => {
    const hidden: Triangle = { ...triangle, object: 1, points: triangle.points.map(v => v.clone().multiplyScalar(0.5)) as Triangle["points"] };
    expect(transferPixels([triangle], 0, texture, photo, new Uint8Array(4096), camera, visibility([triangle], camera, 64, 64)).copied).toBe(0);
    expect(transferPixels([triangle], 0, texture, photo, new Uint8Array(4096).fill(255), camera, visibility([triangle, hidden], camera, 64, 64)).copied).toBe(0);
  });
  it("rejects back-facing surfaces and preserves the generated fallback", () => {
    const back: Triangle = { ...triangle, points: [triangle.points[0], triangle.points[2], triangle.points[1]] };
    expect(transferPixels([back], 0, texture, photo, new Uint8Array(4096).fill(255), camera, visibility([back], camera, 64, 64)).copied).toBe(0);
  });
  it("uses only foreground-free room patches", async () => {
    const b = await cleanPatch(photo, [new Uint8Array(4096)], "floor");
    const m = await sharp(b).metadata(); expect(m.width).toBeLessThan(photo.width);
    await expect(cleanPatch(photo, [new Uint8Array(4096).fill(255)], "wall")).rejects.toThrow("No clean");
  });
});
describe("Lighting settings", () => {
  it("accepts two bounded source positions/intensities and ambient fill", () => {
    const lights = defaultLighting(null);
    expect(lightingSchema.safeParse(lights).success).toBe(true);
    expect(lightingSchema.safeParse({ ...lights, ambient: -1 }).success).toBe(false);
    expect(lightingSchema.safeParse({ ...lights, key: { intensity: 10, position: [0, 2, 0] } }).success).toBe(false);
    expect(lightingSchema.safeParse({ ...lights, fill: { intensity: 1, position: [Infinity, 2, 0] } }).success).toBe(false);
  });
});
