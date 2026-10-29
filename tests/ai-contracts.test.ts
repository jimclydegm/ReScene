import { describe, expect, it } from "vitest";
import { validateAnalysis, placeMask } from "../src/lib/ai/contracts";

const object = { candidateId: "candidate-1", label: "chair", category: "seating", segmentationConcept: "chair",
  bbox: { xMin: 2, yMin: 3, xMax: 8, yMax: 9 }, support: "floor", notes: "" };
const input = { sceneType: "bedroom", summary: "A chair.", objects: [object], environment: {
  floorColor: "#bfa385", wallColor: "#ded6cc", floorMaterial: "wood", lightDirection: "left", lightWarmth: "warm", sideWall: "left"
} };
describe("Model output boundaries", () => {
  it("rejects off-image, inverted, and duplicate candidate boxes/IDs", () => {
    expect(() => validateAnalysis(input, { width: 7, height: 10 })).toThrow();
    expect(() => validateAnalysis({ ...input, objects: [{ ...object, bbox: { ...object.bbox, xMin: 8 } }] }, { width: 10, height: 10 })).toThrow();
    expect(() => validateAnalysis({ ...input, objects: [object, object] }, { width: 10, height: 10 })).toThrow();
  });
  it("allows no-match analysis without fabricating candidates", () => {
    expect(validateAnalysis({ ...input, objects: [] }, { width: 10, height: 10 }).objects).toEqual([]);
  });
  it("validates room colors and bounded lighting observations", () => {
    expect(() => validateAnalysis({ ...input, environment: { ...input.environment, floorColor: "url(private-photo)" } }, { width: 10, height: 10 })).toThrow();
    expect(() => validateAnalysis({ ...input, environment: { ...input.environment, lightDirection: "anywhere" } }, { width: 10, height: 10 })).toThrow();
    expect(validateAnalysis(input, { width: 10, height: 10 }).environment.floorMaterial).toBe("wood");
  });
  it("places a cropped binary mask at its source-pixel offset", () => {
    const result = placeMask(new Uint8Array([1, 0, 0, 1]), { width: 2, height: 2 },
      { left: 1, top: 1, right: 3, bottom: 3 }, { width: 4, height: 3 });
    expect([...result.pixels]).toEqual([0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0]);
    expect(result.area).toBe(2);
  });
  it("rejects mask dimension mismatch, empty foreground, and out-of-frame placement", () => {
    const frame = { width: 4, height: 3 };
    expect(() => placeMask(new Uint8Array([1]), { width: 1, height: 1 }, { left: 0, top: 0, right: 2, bottom: 1 }, frame)).toThrow();
    expect(() => placeMask(new Uint8Array([0]), { width: 1, height: 1 }, { left: 0, top: 0, right: 1, bottom: 1 }, frame)).toThrow();
    expect(() => placeMask(new Uint8Array([1]), { width: 1, height: 1 }, { left: 4, top: 0, right: 5, bottom: 1 }, frame)).toThrow();
  });
});
