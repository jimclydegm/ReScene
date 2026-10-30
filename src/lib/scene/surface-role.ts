type SurfaceCandidate = { category?: string | null; imageBounds?: unknown; provenance?: unknown; productId?: string | null };
function fields(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// Modern analysis marks background explicitly. The fallback only repairs legacy
// unlisted surface candidates spanning the frame; bounded tables/rugs/boards stay objects.
export function isBackgroundSurface(object: SurfaceCandidate, size: { width: number; height: number }) {
  const p = fields(object.provenance);
  if (object.productId || p.parentObjectId || p.surfaceRole === "object") return false;
  if (p.surfaceRole === "background") return true;
  if (object.category !== "surface" || size.width <= 0 || size.height <= 0) return false;
  const b = fields(object.imageBounds);
  const x0 = Number(b.xMin), x1 = Number(b.xMax), y0 = Number(b.yMin), y1 = Number(b.yMax);
  if (![x0, x1, y0, y1].every(Number.isFinite) || x0 < 0 || y0 < 0 || x1 > size.width || y1 > size.height) return false;
  return x0 <= size.width * .02 && x1 >= size.width * .98 && y1 - y0 >= size.height * .18 &&
    (y1 >= size.height * .98 || y0 <= size.height * .02);
}
