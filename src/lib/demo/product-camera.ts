import { Vector3 } from "three";

/** Frame the complete product instead of placing every shape 2.3 widths away. */
export function productCamera(size: readonly number[], aspect = 1.12) {
  if (
    size.length !== 3 ||
    size.some((v) => !Number.isFinite(v) || v <= 0) ||
    !Number.isFinite(aspect) ||
    aspect <= 0
  )
    throw new Error("Invalid product framing bounds");
  const [width, height, depth] = size,
    fov = 38;
  const target = new Vector3(0, height / 2, 0);
  const direction = new Vector3(0.45, 0.22, 1).normalize();
  const right = new Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const tangent = Math.tan((fov * Math.PI) / 360),
    padding = 1 / 0.82;
  let distance = 0.01;
  for (const x of [-width / 2, width / 2])
    for (const y of [0, height])
      for (const z of [-depth / 2, depth / 2]) {
        const corner = new Vector3(x, y, z).sub(target),
          near = corner.dot(direction);
        distance = Math.max(
          distance,
          near + (padding * Math.abs(corner.dot(right))) / (tangent * aspect),
          near + (padding * Math.abs(corner.dot(up))) / tangent,
        );
      }
  return {
    position: target.clone().addScaledVector(direction, distance).toArray() as [
      number,
      number,
      number,
    ],
    target: target.toArray() as [number, number, number],
    fov,
    aspect,
  };
}
