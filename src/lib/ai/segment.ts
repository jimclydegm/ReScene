import "server-only";
import { parseImageStream, recordsOfKind, decodeMaskToRaster } from "@meta-sam/parser";
import sharp from "sharp";
import { getMetaClient, metaModels } from "./meta";
import { placeMask, type ImageSize } from "./contracts";
import { segmentationPrompt, type SegmentationOptions } from "./controls";

export async function segmentConcept(imageUrl: string, concept: string, size: ImageSize, options?: SegmentationOptions) {
  const started = Date.now();
  const events = await getMetaClient().responses.create({
    model: metaModels.segmentation(), stream: true,
    input: [{ role: "user", content: [
      { type: "input_text", text: options ? segmentationPrompt(options, size) : concept },
      { type: "input_image", image_url: imageUrl, detail: "auto" }
    ] }], metadata: { mask_encoding: "one_bit", include_confidence: "true" }
  }, { maxRetries: 0 });
  let requestId: string | undefined;
  let wireText = "";
  async function* tracked() {
    for await (const event of events) {
      if (event.type === "response.created") requestId = event.response.id;
      if (event.type === "response.output_text.delta") {
        wireText += event.delta;
        if (wireText.length > 16 * 1024 * 1024) throw new Error("Segmentation response exceeds byte allowance");
        // Guard decoder allocations before passing a completed mask to the parser.
        for (const match of wireText.matchAll(/data=(\d+),(\d+),/g)) {
          const area = Number(match[1]) * Number(match[2]);
          if (!Number.isSafeInteger(area) || area < 1 || area > size.width * size.height) throw new Error("Encoded mask exceeds input dimensions");
        }
      }
      yield event;
    }
  }
  const parsed = await parseImageStream(tracked()).finalResult;
  if (parsed.outcome.status !== "completed" || parsed.diagnostics.some(d => d.severity === "error")) {
    throw new Error("Segmentation incomplete or malformed; inspect the saved attempt before retrying");
  }
  for (const token of parsed.rawOutput.matchAll(/<\|box;([^|]+)\|>/g)) {
    const fields = Object.fromEntries(token[1].split(";").map(field => field.split("=")));
    if (Number(fields.w) !== size.width || Number(fields.h) !== size.height) throw new Error("SAM source frame differs from normalized input");
  }
  const records = recordsOfKind(parsed.records, "mask");
  if (records.length > 10) throw new Error("Too many segmentation instances");
  const masks = [];
  for (const record of records) {
    if (record.mask.width * record.mask.height > size.width * size.height) throw new Error("Mask exceeds image limits");
    const full = placeMask(decodeMaskToRaster(record.mask), record.mask, record.bounds, size);
    const png = await sharp(full.pixels, { raw: { ...size, channels: 1 } }).png().toBuffer();
    masks.push({ objectId: record.objectId, bounds: record.bounds, confidence: record.confidence, area: full.area, png });
  }
  return { masks, requestId, model: metaModels.segmentation(), durationMs: Date.now() - started, raw: parsed.rawOutput };
}
