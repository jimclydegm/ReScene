import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFalArtifact, inspectGlb } from "../src/lib/ai/glb";

function fixture(changes: Record<string, unknown> = {}) {
  const document = { asset: { version: "2.0" }, buffers: [{ byteLength: 4 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ componentType: 5126, count: 1, type: "VEC3" }], ...changes };
  const text = JSON.stringify(document);
  const json = Buffer.from(text.padEnd(Math.ceil(text.length / 4) * 4, " "));
  const bytes = Buffer.alloc(20 + json.length + 12);
  bytes.write("glTF"); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(json.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); json.copy(bytes, 20);
  bytes.writeUInt32LE(4, 20 + json.length); bytes.writeUInt32LE(0x004e4942, 24 + json.length);
  return bytes;
}
afterEach(() => vi.unstubAllGlobals());
describe("Provider artifact boundaries", () => {
  it("inventories an embedded mesh container and rejects truncation", () => {
    expect(inspectGlb(fixture()).meshes).toBe(1);
    expect(() => inspectGlb(fixture().subarray(0, -1))).toThrow();
  });
  it("rejects external textures and nonfinite transform/bounds values", () => {
    expect(() => inspectGlb(fixture({ images: [{ uri: "https://untrusted.example/image.png" }] }))).toThrow();
    expect(() => inspectGlb(fixture({ nodes: [{ translation: [null, 0, 0] }] }))).toThrow();
    expect(() => inspectGlb(fixture({ accessors: [{ min: [null, 0, 0] }] }))).toThrow();
  });
  it("blocks non-provider hosts before any fetch", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(downloadFalArtifact("https://127.0.0.1/private")).rejects.toThrow();
    await expect(downloadFalArtifact("https://fal.media.untrusted.example/file.glb")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("enforces declared byte limit and rejects redirect responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { headers: { "Content-Length": String(41 * 1024 * 1024) } })));
    await expect(downloadFalArtifact("https://v3.fal.media/object.glb")).rejects.toThrow("byte limit");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/" } })));
    await expect(downloadFalArtifact("https://v3.fal.media/object.glb")).rejects.toThrow();
  });
});
