import { z } from "zod";
import { environmentSchema } from "@/lib/scene/composition";

export const analysisSchema = z.object({
  sceneType: z.string().min(1).max(80),
  summary: z.string().min(1).max(600),
  environment: environmentSchema,
  objects: z.array(z.object({
    candidateId: z.string().regex(/^candidate-[1-5]$/),
    label: z.string().min(1).max(80),
    category: z.enum(["bed", "seating", "table", "lighting", "storage", "decor"]),
    segmentationConcept: z.string().min(1).max(80),
    bbox: z.object({
      xMin: z.number().int().nonnegative(), yMin: z.number().int().nonnegative(),
      xMax: z.number().int().positive(), yMax: z.number().int().positive()
    }).strict(),
    support: z.enum(["floor", "tabletop", "wall", "unknown"]),
    notes: z.string().max(300)
  }).strict()).max(5)
}).strict();
export type PhotoAnalysis = z.infer<typeof analysisSchema>;
export type ImageSize = { width: number; height: number };

export function validateAnalysis(value: unknown, size: ImageSize): PhotoAnalysis {
  const result = analysisSchema.parse(value);
  const ids = new Set<string>();
  for (const object of result.objects) {
    if (ids.has(object.candidateId)) throw new Error("Duplicate candidate ID");
    ids.add(object.candidateId);
    const box = object.bbox;
    if (box.xMin >= box.xMax || box.yMin >= box.yMax || box.xMax > size.width || box.yMax > size.height) {
      throw new Error("Candidate box is outside the normalized image");
    }
  }
  return result;
}

// SAM's raster covers its half-open bounding box, not the entire source frame.
export function placeMask(raster: Uint8Array, crop: ImageSize,
  bounds: { left: number; top: number; right: number; bottom: number }, frame: ImageSize) {
  const values = [crop.width, crop.height, frame.width, frame.height, bounds.left, bounds.top, bounds.right, bounds.bottom];
  if (!values.every(Number.isSafeInteger) || crop.width < 1 || crop.height < 1 || frame.width < 1 || frame.height < 1 ||
    frame.width * frame.height > 2_560_000 || bounds.left < 0 || bounds.top < 0 || bounds.right > frame.width || bounds.bottom > frame.height ||
    bounds.right - bounds.left !== crop.width || bounds.bottom - bounds.top !== crop.height || raster.length !== crop.width * crop.height) {
    throw new Error("Mask dimensions or bounds do not match the normalized image");
  }
  const full = Buffer.alloc(frame.width * frame.height);
  let area = 0;
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const value = raster[y * crop.width + x];
    if (value !== 0 && value !== 1) throw new Error("Mask must be binary");
    full[(bounds.top + y) * frame.width + bounds.left + x] = value * 255;
    area += value;
  }
  if (!area) throw new Error("Mask is empty");
  return { pixels: full, area };
}
