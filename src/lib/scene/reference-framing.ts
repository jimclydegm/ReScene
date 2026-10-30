// Preserve the complete photographed field of view in a differently shaped
// viewer. OrbitControls remains free to rotate, pan and zoom afterward.
export function referenceFov(
  fov: number,
  sourceAspect: number,
  viewportAspect: number,
) {
  return Math.min(
    140,
    (2 *
      Math.atan(
        Math.tan((fov * Math.PI) / 360) *
          Math.max(1, sourceAspect / viewportAspect),
      ) *
      180) /
      Math.PI,
  );
}
