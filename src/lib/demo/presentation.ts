/** Letterbox the saved photo view rather than widening its field of view. */
export function fitReferenceViewport(
  width: number,
  height: number,
  aspect: number,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(aspect) ||
    width <= 0 ||
    height <= 0 ||
    aspect <= 0
  )
    return { width: 0, height: 0 };
  const fittedWidth = Math.min(width, height * aspect);
  return { width: fittedWidth, height: fittedWidth / aspect };
}
