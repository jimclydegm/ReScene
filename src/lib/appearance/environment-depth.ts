import { z } from "zod";
const array = z.object({
  data: z.string().max(8_000_000),
  shape: z.array(z.number().int().positive().max(2048)).min(1).max(4),
  dtype: z.string(),
});
const prediction = z.object({
  depth: array,
  depth_conf: array,
  intrinsic: array,
  original_image: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
});
export interface DepthGrid {
  width: number;
  height: number;
  data: Float32Array;
  confidence: Float32Array;
  sourceWidth: number;
  sourceHeight: number;
  content: { left: number; top: number; width: number; height: number };
  intrinsic: number[];
}
function floats(a: z.infer<typeof array>, count: number) {
  if (a.dtype !== "float32" || a.shape.reduce((p, n) => p * n, 1) !== count)
    throw new Error("ENVIRONMENT_DEPTH_SHAPE");
  const b = Buffer.from(a.data, "base64");
  if (b.length !== count * 4) throw new Error("ENVIRONMENT_DEPTH_BYTES");
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = b.readFloatLE(i * 4);
  return out;
}
// fal uses Meta's pad loader: longest side 518, other side rounded to a
// multiple of 14, then centered. Never sample the white padding as scene depth.
export function decodeEnvironmentDepth(raw: unknown): DepthGrid {
  const p = prediction.parse(raw),
    [height, width] = p.depth.shape;
  if (width !== 518 || height !== 518 || p.intrinsic.shape.join() !== "3,3")
    throw new Error("ENVIRONMENT_DEPTH_FRAME");
  const sw = p.original_image.width,
    sh = p.original_image.height;
  const w =
      sw >= sh ? 518 : Math.max(14, Math.round(((sw / sh) * 518) / 14) * 14),
    h = sh >= sw ? 518 : Math.max(14, Math.round(((sh / sw) * 518) / 14) * 14);
  const intrinsic = Array.from(floats(p.intrinsic, 9));
  if (
    !intrinsic.every(Number.isFinite) ||
    intrinsic[0] <= 0 ||
    intrinsic[4] <= 0
  )
    throw new Error("ENVIRONMENT_INTRINSIC_INVALID");
  return {
    width,
    height,
    data: floats(p.depth, width * height),
    confidence: floats(p.depth_conf, width * height),
    sourceWidth: sw,
    sourceHeight: sh,
    content: {
      left: Math.floor((518 - w) / 2),
      top: Math.floor((518 - h) / 2),
      width: w,
      height: h,
    },
    intrinsic,
  };
}
export function depthAt(grid: DepthGrid, x: number, y: number) {
  const c = grid.content,
    px = Math.max(
      c.left,
      Math.min(c.left + c.width - 1, Math.floor(c.left + x * c.width)),
    ),
    py = Math.max(
      c.top,
      Math.min(c.top + c.height - 1, Math.floor(c.top + y * c.height)),
    ),
    i = py * grid.width + px;
  const depth = grid.data[i],
    confidence = grid.confidence[i];
  return Number.isFinite(depth) &&
    depth > 0 &&
    Number.isFinite(confidence) &&
    confidence > 1.05
    ? { depth, confidence }
    : null;
}
