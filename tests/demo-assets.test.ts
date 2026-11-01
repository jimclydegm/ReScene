import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({
  readLimited: vi.fn(),
  getR2: vi.fn(),
  bucket: () => "rescene",
  storagePrefix: () => "prototype",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/r2", () => storage);
vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("Demo requests must not access the database");
  },
}));
import { GET } from "../src/app/api/demo/assets/[id]/route";
import frozen from "../src/lib/demo/frozen-scenes.json";
import models from "../src/lib/demo/catalog-models.json";
describe("anonymous demo asset boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.readLimited.mockResolvedValue(Buffer.from("approved demo bytes"));
  });
  it("delivers only the allowlisted frozen copy without signed source URLs or database access", async () => {
    const a = frozen.scenes[0].objects[0];
    const res = await GET(
      new Request(`http://localhost/api/demo/assets/${a.id}`),
      { params: Promise.resolve({ id: a.id }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("model/gltf-binary");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(await res.text()).toBe("approved demo bytes");
    expect(storage.readLimited).toHaveBeenCalledWith(
      `prototype/demo/store-v1/${a.digest}.glb`,
      4 * 1024 * 1024,
    );
  });
  it("rejects arbitrary scene IDs, storage paths, URLs and prototype property names without storage access", async () => {
    for (const id of [
      "f2848b95-8447-41eb-9544-0d72dd605565",
      "../source",
      "https://example.com",
      "__proto__",
      "toString",
    ]) {
      const res = await GET(
        new Request("http://localhost/api/demo/assets/unknown"),
        { params: Promise.resolve({ id }) },
      );
      expect(res.status).toBe(404);
    }
    expect(storage.readLimited).not.toHaveBeenCalled();
  });
  it("streams larger approved models without a buffered Content-Length response or private redirect", async () => {
    const asset = models.find((m) => m.bytes > 4 * 1024 * 1024)!;
    expect(asset).toBeDefined();
    const send = vi.fn().mockResolvedValue({
      ContentLength: asset.bytes,
      Body: {
        transformToWebStream: () =>
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(asset.bytes));
              controller.close();
            },
          }),
      },
    });
    storage.getR2.mockReturnValue({ send });
    const response = await GET(
      new Request("http://localhost/api/demo/assets/" + asset.id),
      { params: Promise.resolve({ id: asset.id }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect((await response.arrayBuffer()).byteLength).toBe(asset.bytes);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "rescene",
      Key: `prototype/demo/store-v1/${asset.digest}.glb`,
    });
    expect(storage.readLimited).not.toHaveBeenCalled();
  });
});
