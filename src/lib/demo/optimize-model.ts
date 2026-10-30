import sharp from "sharp";
import { inspectGlb } from "@/lib/ai/glb";
import { readGlb } from "@/lib/appearance/bake";
/** Repack embedded buffers and encode opaque albedo as high-quality JPEG.
 * No geometry, UVs, transforms or texture dimensions are changed. Demo copies only.
 */
export async function optimizeDemoModel(bytes: Buffer) {
  inspectGlb(bytes);
  const { json: g, binary } = readGlb(bytes);
  const replacements = new Map<number, Buffer>();
  if (
    g.materials.some(
      (m: { alphaMode?: string }) => m.alphaMode && m.alphaMode !== "OPAQUE",
    )
  )
    throw new Error("Demo optimizer requires opaque materials");
  for (const image of g.images ?? []) {
    const view = g.bufferViews[image.bufferView];
    const input = binary.subarray(
      view.byteOffset ?? 0,
      (view.byteOffset ?? 0) + view.byteLength,
    );
    replacements.set(
      image.bufferView,
      await sharp(input)
        .removeAlpha()
        .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
        .toBuffer(),
    );
    image.mimeType = "image/jpeg";
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for (const [i, view] of g.bufferViews.entries()) {
    const chunk =
      replacements.get(i) ??
      binary.subarray(
        view.byteOffset ?? 0,
        (view.byteOffset ?? 0) + view.byteLength,
      );
    const pad = Buffer.alloc((4 - (size % 4)) % 4);
    chunks.push(pad);
    size += pad.length;
    view.byteOffset = size;
    view.byteLength = chunk.length;
    chunks.push(chunk);
    size += chunk.length;
  }
  g.buffers[0].byteLength = size;
  const json = Buffer.from(JSON.stringify(g)),
    jpad = Buffer.alloc((4 - (json.length % 4)) % 4, 32),
    bpad = Buffer.alloc((4 - (size % 4)) % 4),
    header = Buffer.alloc(20),
    bh = Buffer.alloc(8);
  header.write("glTF");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + jpad.length + size + bpad.length, 8);
  header.writeUInt32LE(json.length + jpad.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  bh.writeUInt32LE(size + bpad.length);
  bh.writeUInt32LE(0x004e4942, 4);
  const result = Buffer.concat([header, json, jpad, bh, ...chunks, bpad]);
  inspectGlb(result);
  if (result.length > 4 * 1024 * 1024)
    throw new Error("Curated demo exceeds the delivery limit");
  return result;
}
