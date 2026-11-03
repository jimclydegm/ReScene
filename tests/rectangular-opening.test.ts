import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { completeRectangularOpening } from "../src/lib/scene/rectangular-opening";
import { environmentGeometrySchema } from "../src/lib/scene/environment-plan";

const fixture = () =>
  environmentGeometrySchema.parse({
    version: "reference-environment-v1",
    surfaces: [
      {
        role: "wall",
        vertices: [
          [-5, 0, 0],
          [5, 0, 0],
          [5, 9, 0],
          [-5, 9, 0],
        ],
        triangles: [0, 1, 2, 0, 2, 3],
        color: "#eeeeee",
        roughness: 1,
        textured: false,
      },
      {
        role: "window",
        vertices: [
          [-1, 1, -0.025],
          [1, 1, -0.025],
          [0.9, 3, -0.025],
          [-0.8, 3.5, -0.025],
        ],
        triangles: [0, 1, 2, 0, 2, 3],
        color: "#ffffff",
        roughness: 1,
        textured: true,
      },
    ],
  });
describe("Reviewed cropped rectangular openings", () => {
  it("rebuilds straight edges, a matching wall hole and physical trim without mutating source geometry", () => {
    const source = fixture(),
      before = structuredClone(source),
      after = completeRectangularOpening(source, 1, [0, 2, 5], {
        left: 1,
        top: 1,
      });
    expect(source).toEqual(before);
    expect(environmentGeometrySchema.safeParse(after).success).toBe(true);
    const window = after.surfaces.find((s) => s.role === "window")!;
    expect(window.vertices[0][0]).toBe(window.vertices[3][0]);
    expect(window.vertices[1][0]).toBe(window.vertices[2][0]);
    expect(window.vertices[0][1]).toBe(window.vertices[1][1]);
    expect(window.vertices[2][1]).toBe(window.vertices[3][1]);
    expect(window.photoUv).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    const wall = after.surfaces[0];
    let area = 0;
    for (let t = 0; t < wall.triangles.length; t += 3) {
      const [a, b, c] = wall.triangles
        .slice(t, t + 3)
        .map((i) => new Vector3(...wall.vertices[i]));
      const n = b.sub(a).cross(c.sub(a));
      expect(n.z).toBeGreaterThan(0);
      area += n.length() / 2;
    }
    expect(area).toBeCloseTo(90 - 3 * 3.5);
    expect(after.surfaces.filter((s) => s.role === "trim").length).toBe(5);
  });
  it("rejects unsupported multiple openings rather than sealing an existing hole", () => {
    const source = fixture();
    source.surfaces.push(structuredClone(source.surfaces[1]));
    expect(() => completeRectangularOpening(source, 1, [0, 2, 5])).toThrow(
      "Multiple openings",
    );
  });
});
