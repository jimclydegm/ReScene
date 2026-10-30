import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { demoGlb } from "../src/lib/scene/catalog";
import { readGlb } from "../src/lib/appearance/bake";
import { optimizeDemoModel } from "../src/lib/demo/optimize-model";
function pack(json: Record<string, unknown>, bytes: Buffer) {
  const raw = Buffer.from(JSON.stringify(json)),
    j = Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4, 32)]),
    bin = Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]),
    h = Buffer.alloc(28 + j.length);
  h.write("glTF");
  h.writeUInt32LE(2, 4);
  h.writeUInt32LE(h.length + bin.length, 8);
  h.writeUInt32LE(j.length, 12);
  h.writeUInt32LE(0x4e4f534a, 16);
  j.copy(h, 20);
  h.writeUInt32LE(bin.length, 20 + j.length);
  h.writeUInt32LE(0x004e4942, 24 + j.length);
  return Buffer.concat([h, bin]);
}
describe("demo model delivery optimization", () => {
  it("preserves geometry/accessor bytes, UVs and transforms while retaining image dimensions", async () => {
    const source = demoGlb([
      { center: [1, 2, 3], size: [2, 1, 0.5], color: "#789564" },
    ]).bytes;
    const original = readGlb(source),
      g = original.json;
    const image = await sharp({
      create: { width: 64, height: 32, channels: 3, background: "#789564" },
    })
      .png()
      .toBuffer();
    const imageView = g.bufferViews.length;
    g.bufferViews.push({
      buffer: 0,
      byteOffset: original.binary.length,
      byteLength: image.length,
    });
    g.images = [{ bufferView: imageView, mimeType: "image/png" }];
    g.buffers[0].byteLength = original.binary.length + image.length;
    g.nodes[0].translation = [0, 1, 0];
    const input = pack(g, Buffer.concat([original.binary, image])),
      saved = Buffer.from(input),
      output = readGlb(await optimizeDemoModel(input));
    expect(input.equals(saved)).toBe(true);
    expect(output.json.accessors).toEqual(g.accessors);
    expect(output.json.meshes).toEqual(g.meshes);
    expect(output.json.nodes).toEqual(g.nodes);
    for (let i = 0; i < imageView; i++) {
      const a = g.bufferViews[i],
        b = output.json.bufferViews[i];
      expect(
        output.binary
          .subarray(b.byteOffset ?? 0, (b.byteOffset ?? 0) + b.byteLength)
          .equals(
            original.binary.subarray(
              a.byteOffset ?? 0,
              (a.byteOffset ?? 0) + a.byteLength,
            ),
          ),
      ).toBe(true);
    }
    const v = output.json.bufferViews[imageView],
      meta = await sharp(
        output.binary.subarray(v.byteOffset, v.byteOffset + v.byteLength),
      ).metadata();
    expect(output.json.images[0].mimeType).toBe("image/jpeg");
    expect([meta.width, meta.height]).toEqual([64, 32]);
    g.materials[0].alphaMode = "MASK";
    await expect(
      optimizeDemoModel(pack(g, Buffer.concat([original.binary, image]))),
    ).rejects.toThrow("opaque");
  });
});
