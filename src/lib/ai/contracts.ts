import { z } from "zod";
import { environmentSchema } from "@/lib/scene/composition";

export const analysisSchema = z.object({
  sceneType: z.string().min(1).max(80),
  summary: z.string().min(1).max(600),
  environment: environmentSchema,
  objects: z.array(z.object({
    candidateId: z.string().regex(/^candidate-(?:[1-9]|10)$/),
    label: z.string().min(1).max(80),
    category: z.enum(["bed", "seating", "table", "lighting", "storage", "decor", "clothing", "footwear", "accessory", "person", "vehicle", "plant", "electronics", "other"]),
    segmentationConcept: z.string().min(1).max(80),
    bbox: z.object({
      xMin: z.number().int().nonnegative(), yMin: z.number().int().nonnegative(),
      xMax: z.number().int().positive(), yMax: z.number().int().positive()
    }).strict(),
    support: z.enum(["floor", "tabletop", "wall", "unknown"]),
    notes: z.string().max(300),
      parentCandidateId: z.string().regex(/^candidate-(?:[1-9]|10)$/).nullable().optional()
  }).strict()).max(10)
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
  for (const object of result.objects) {
    if (!object.parentCandidateId) continue;
    const parent=result.objects.find(o=>o.candidateId===object.parentCandidateId);
    if (!parent || parent.parentCandidateId || parent.candidateId===object.candidateId) throw new Error("Invalid or nested subject relationship");
    const b=object.bbox,p=parent.bbox;
    const intersection=Math.max(0,Math.min(b.xMax,p.xMax)-Math.max(b.xMin,p.xMin))*Math.max(0,Math.min(b.yMax,p.yMax)-Math.max(b.yMin,p.yMin));
    if(intersection/((b.xMax-b.xMin)*(b.yMax-b.yMin))<.5)throw new Error("Part is outside its subject");
  }
  return result;
}

// SAM's raster covers its half-open bounding box, not the entire source frame.
export function placeMask(raster: Uint8Array, crop: ImageSize,
  bounds: { left: number; top: number; right: number; bottom: number }, frame: ImageSize) {
  const values = [crop.width, crop.height, frame.width, frame.height, bounds.left, bounds.top, bounds.right, bounds.bottom];
  if (!values.every(Number.isSafeInteger) || crop.width < 1 || crop.height < 1 || frame.width < 1 || frame.height < 1 ||
    frame.width * frame.height > 2_560_000 || bounds.left < 0 || bounds.top < 0 || bounds.right > frame.width || bounds.bottom > frame.height ||
    bounds.right <= bounds.left || bounds.bottom <= bounds.top || crop.width * crop.height > 2_560_000 || raster.length !== crop.width * crop.height) {
    throw new Error("Mask dimensions or bounds do not match the normalized image");
  }
  const full = Buffer.alloc(frame.width * frame.height);
  let area = 0;
  if (raster.some(v=>v!==0&&v!==1)) throw new Error("Mask must be binary");
  const width=bounds.right-bounds.left,height=bounds.bottom-bounds.top;
  // SAM may emit a lower-resolution raster covering the source-pixel box.
  // Nearest-neighbor mapping preserves binary labels and exact box coverage.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = raster[Math.floor(y*crop.height/height)*crop.width+Math.floor(x*crop.width/width)];
    full[(bounds.top + y) * frame.width + bounds.left + x] = value * 255;
    area += value;
  }
  if (!area) throw new Error("Mask is empty");
  return { pixels: full, area };
}
