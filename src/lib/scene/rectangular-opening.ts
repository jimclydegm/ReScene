import { ShapeUtils, Vector2, Vector3 } from "three";
import {
  environmentGeometrySchema,
  type EnvironmentGeometry,
} from "./environment-plan";

/** Explicitly reviewed rectangular architecture only. A photo crop edge is
 * not a physical window edge. Extend it before rebuilding the adjacent wall. */
export function completeRectangularOpening(
  input: EnvironmentGeometry,
  index: number,
  eye: readonly number[],
  extension: { left?: number; right?: number; top?: number } = {},
) {
  const geometry = structuredClone(input),
    opening = geometry.surfaces[index];
  if (!opening || opening.role !== "window" || opening.vertices.length !== 4)
    throw new Error("Reviewed four-corner window required");
  const points = opening.vertices.map((p) => new Vector3(...p)),
    center = points
      .reduce((v, p) => v.add(p), new Vector3())
      .multiplyScalar(0.25);
  const normal = points[1]
    .clone()
    .sub(points[0])
    .cross(points[2].clone().sub(points[0]))
    .normalize();
  if (Math.abs(normal.y) > 0.15)
    throw new Error("Window is not on a vertical architectural plane");
  normal.y = 0;
  normal.normalize();
  if (normal.dot(new Vector3(...eye).sub(center)) < 0) normal.negate();
  const up = new Vector3(0, 1, 0),
    right = up.clone().cross(normal).normalize();
  const local = (p: Vector3) =>
    new Vector2(p.clone().sub(center).dot(right), p.y);
  const world = (u: number, y: number, depth = 0) =>
    center
      .clone()
      .addScaledVector(right, u)
      .setY(y)
      .addScaledVector(normal, depth)
      .toArray() as [number, number, number];
  const uv = points.map(local),
    width = Math.max(...uv.map((p) => p.x)) - Math.min(...uv.map((p) => p.x));
  let left = Math.min(...uv.map((p) => p.x)) - (extension.left ?? 0),
    rightEdge = Math.max(...uv.map((p) => p.x)) + (extension.right ?? 0);
  const bottom = Math.min(...uv.map((p) => p.y)),
    top = Math.max(...uv.map((p) => p.y)) + (extension.top ?? 0);
  if (
    !Number.isFinite(width) ||
    width <= 0.01 ||
    [left, rightEdge, bottom, top].some((v) => !Number.isFinite(v)) ||
    top <= bottom
  )
    throw new Error("Invalid window extents");
  const wall = geometry.surfaces
    .filter((s) => s.role === "wall")
    .map((s) => ({
      s,
      d: Math.max(
        ...s.vertices
          .slice(0, 4)
          .map((p) => Math.abs(new Vector3(...p).sub(center).dot(normal))),
      ),
    }))
    .sort((a, b) => a.d - b.d)[0];
  if (!wall || wall.d > 0.15) throw new Error("No matching wall plane");
  if (
    geometry.surfaces.some(
      (s, i) =>
        i !== index &&
        (s.role === "window" || s.role === "opening") &&
        s.vertices.every(
          (p) => Math.abs(new Vector3(...p).sub(center).dot(normal)) < 0.15,
        ),
    )
  )
    throw new Error("Multiple openings require a joint wall rebuild");
  center.addScaledVector(
    normal,
    wall.s.vertices
      .slice(0, 4)
      .reduce((sum, p) => sum + new Vector3(...p).sub(center).dot(normal), 0) /
      4,
  );
  const bounds = wall.s.vertices.map((p) => local(new Vector3(...p))),
    minU = Math.min(...bounds.map((p) => p.x)),
    maxU = Math.max(...bounds.map((p) => p.x)),
    minY = Math.min(...bounds.map((p) => p.y)),
    maxY = Math.max(...bounds.map((p) => p.y));
  left = Math.max(minU + 0.001, left);
  rightEdge = Math.min(maxU - 0.001, rightEdge);
  if (bottom <= minY || top >= maxY || rightEdge - left <= 0.01)
    throw new Error("Window must remain inside the extended wall");
  const border = [
      new Vector2(minU, minY),
      new Vector2(maxU, minY),
      new Vector2(maxU, maxY),
      new Vector2(minU, maxY),
    ],
    hole = [
      new Vector2(left, bottom),
      new Vector2(left, top),
      new Vector2(rightEdge, top),
      new Vector2(rightEdge, bottom),
    ];
  const contour = [...border, ...hole];
  wall.s.vertices = contour.map((p) => world(p.x, p.y));
  wall.s.triangles = ShapeUtils.triangulateShape(border, [hole]).flat();
  delete wall.s.photoUv;
  const a = new Vector3(...wall.s.vertices[wall.s.triangles[0]]),
    b = new Vector3(...wall.s.vertices[wall.s.triangles[1]]),
    c = new Vector3(...wall.s.vertices[wall.s.triangles[2]]);
  if (b.sub(a).cross(c.sub(a)).dot(normal) < 0)
    for (let i = 0; i < wall.s.triangles.length; i += 3)
      [wall.s.triangles[i + 1], wall.s.triangles[i + 2]] = [
        wall.s.triangles[i + 2],
        wall.s.triangles[i + 1],
      ];
  opening.vertices = [
    world(left, bottom, -0.035),
    world(rightEdge, bottom, -0.035),
    world(rightEdge, top, -0.035),
    world(left, top, -0.035),
  ];
  opening.triangles = [0, 1, 2, 0, 2, 3];
  opening.photoUv = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  delete opening.tile;
  // Replace floating legacy sill strips; architectural baseboards remain.
  geometry.surfaces = geometry.surfaces.filter(
    (s) =>
      s.role !== "trim" ||
      Math.min(...s.vertices.map((p) => p[1])) < bottom * 0.8 ||
      s.vertices.some(
        (p) => Math.abs(new Vector3(...p).sub(center).dot(normal)) > 0.3,
      ),
  );
  function bar(
    u0: number,
    u1: number,
    y0: number,
    y1: number,
    d0: number,
    d1: number,
    color = "#F7F5F0",
  ) {
    const vertices = [
      world(u0, y0, d0),
      world(u1, y0, d0),
      world(u1, y1, d0),
      world(u0, y1, d0),
      world(u0, y0, d1),
      world(u1, y0, d1),
      world(u1, y1, d1),
      world(u0, y1, d1),
    ];
    const triangles = [
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0,
      4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
    ];
    geometry.surfaces.push({
      role: "trim",
      vertices,
      triangles,
      color,
      roughness: 0.65,
      textured: false,
    });
  }
  const thickness = Math.min(0.065, (rightEdge - left) * 0.045),
    middle = (left + rightEdge) / 2;
  bar(left - thickness, left, bottom, top, 0.005, 0.075);
  bar(rightEdge, rightEdge + thickness, bottom, top, 0.005, 0.075);
  bar(
    left - thickness,
    rightEdge + thickness,
    top,
    top + thickness,
    0.005,
    0.075,
  );
  bar(
    left - thickness * 1.5,
    rightEdge + thickness * 1.5,
    bottom - thickness,
    bottom,
    -0.015,
    0.15,
  );
  bar(
    middle - thickness * 0.35,
    middle + thickness * 0.35,
    bottom,
    top,
    0.005,
    0.055,
  );
  return environmentGeometrySchema.parse(geometry);
}
