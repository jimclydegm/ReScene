import { describe, it, expect } from "vitest";
import {
  chooseEnvironmentDepth,
  usableEnvironment,
} from "../src/lib/scene/environment-selection";
const built = (walls: number, coverage: number, error: number) => ({
  report: { walls, expectedWalls: 1, coverage, projectionError: error },
});
describe("background depth evidence selection", () => {
  it("retains the complete source wall when clean-plate depth loses it", () => {
    const source = built(1, 1, 0.001),
      clean = built(0, 0.36, 0.001);
    expect(chooseEnvironmentDepth(source, clean)).toEqual({
      built: source,
      source: "original",
    });
  });
  it("uses clean depth when it recovers an otherwise missing source surface", () => {
    const source = built(0, 0.7, 0.06),
      clean = built(1, 1, 0.01);
    expect(chooseEnvironmentDepth(source, clean)).toEqual({
      built: clean,
      source: "clean",
    });
  });
  it("keeps usable clean geometry when source fitting throws and rejects two missing candidates", () => {
    const clean = built(1, 1, 0.01);
    expect(chooseEnvironmentDepth(null, clean)).toEqual({
      built: clean,
      source: "clean",
    });
    expect(() => chooseEnvironmentDepth(null, null)).toThrow(
      "ENVIRONMENT_STRUCTURE_INCOMPLETE",
    );
  });
  it("rejects excessive corner disagreement and prefers a materially better measured fit", () => {
    const source = built(1, 1, 0.01),
      clean = built(1, 1, 0.089);
    expect(usableEnvironment(clean.report)).toBe(false);
    expect(chooseEnvironmentDepth(source, clean).source).toBe("original");
    expect(
      chooseEnvironmentDepth(built(1, 0.95, 0.06), built(1, 1, 0.01)).source,
    ).toBe("clean");
  });
  it("keeps clean depth on equivalent evidence, preserves both inputs and exposes invalid results for the existing guard", () => {
    const source = built(1, 1, 0.01),
      clean = built(1, 1, 0.01),
      before = JSON.stringify({ source, clean });
    expect(chooseEnvironmentDepth(source, clean).source).toBe("clean");
    expect(JSON.stringify({ source, clean })).toBe(before);
    expect(chooseEnvironmentDepth(source, null).built).toBe(source);
    expect(
      usableEnvironment(
        chooseEnvironmentDepth(built(0, 0.5, 0.1), built(0, 0.6, 0.2)).built
          .report,
      ),
    ).toBe(false);
  });
});
