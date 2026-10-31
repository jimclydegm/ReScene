import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fitReferenceViewport } from "../src/lib/demo/presentation";
import { referenceFov } from "../src/lib/scene/reference-framing";
import { demoScenes } from "../src/lib/demo/scenes";
import {
  productInspiration,
  sceneInspiration,
} from "../src/lib/demo/inspiration";
const css = readFileSync("src/app/design.css", "utf8");
const palette = Object.fromEntries(
  [
    ...css.matchAll(
      /--shop-([\w-]+):\s*light-dark\((#[\da-f]{6}),\s*(#[\da-f]{6})\)/g,
    ),
  ].map((m) => [m[1], [m[2], m[3]]]),
);
function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe("demo presentation contracts", () => {
  for (const [mode, index] of [
    ["light", 0],
    ["dark", 1],
  ] as const)
    it(`${mode} theme keeps normal text at WCAG AA contrast`, () => {
      for (const [text, surface] of [
        ["ink", "bg"],
        ["ink", "surface"],
        ["ink", "raised"],
        ["ink", "selected"],
        ["muted", "surface"],
        ["muted", "raised"],
        ["muted", "selected"],
        ["link", "surface"],
        ["on-accent", "accent"],
      ])
        expect(
          contrast(palette[text][index], palette[surface][index]),
          `${text} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
    });
  it("fits saved reference cameras without widening their field of view on narrow or short displays", () => {
    for (const scene of demoScenes)
      for (const [w, h] of [
        [900, 340],
        [360, 250],
        [650, 220],
        [1200, 500],
      ]) {
        const camera = structuredClone(scene.composition.camera),
          fit = fitReferenceViewport(w, h, camera.aspect);
        expect(fit.width).toBeLessThanOrEqual(w);
        expect(fit.height).toBeLessThanOrEqual(h + 0.000001);
        expect(fit.width / fit.height).toBeCloseTo(camera.aspect, 12);
        expect(
          referenceFov(camera.fov, camera.aspect, fit.width / fit.height),
        ).toBeCloseTo(camera.fov, 12);
        expect(scene.composition.camera).toEqual(camera);
      }
    expect(fitReferenceViewport(0, 200, 1.5)).toEqual({ width: 0, height: 0 });
    expect(fitReferenceViewport(400, 200, NaN)).toEqual({
      width: 0,
      height: 0,
    });
  });
  it("reuses twelve existing public sample photos without private source or model URLs", () => {
    const photos = [...productInspiration, ...sceneInspiration];
    expect(photos).toHaveLength(12);
    expect(new Set(photos.map((p) => p.path)).size).toBe(12);
    for (const p of photos) {
      expect(p.path).toMatch(/^\/samples\/v[123]\/[\w-]+\.webp$/);
      expect(existsSync(`public${p.path}`)).toBe(true);
    }
  });
});
