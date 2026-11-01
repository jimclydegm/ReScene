import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  db: {
    product: { findMany: vi.fn(), findFirst: vi.fn() },
    scene: { findFirst: vi.fn(), updateMany: vi.fn() },
    sceneObject: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  owned: vi.fn(),
  read: vi.fn(),
  put: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => m.db }));
vi.mock("@/lib/services/scenes", () => ({ ownedScene: m.owned }));
vi.mock("@/lib/storage/r2", () => ({
  readLimited: m.read,
  putObject: m.put,
  signRead: m.sign,
  bucket: () => "private",
  storagePrefix: () => "prototype",
}));
import { catalog, replaceObject } from "../src/lib/services/catalog";
beforeEach(() => {
  vi.resetAllMocks();
  m.owned.mockResolvedValue({ status: "READY", revision: 4 });
  m.db.$transaction.mockImplementation((fn) => fn(m.db));
  m.db.scene.updateMany.mockResolvedValue({ count: 1 });
  m.db.product.findFirst.mockResolvedValue(null);
  m.sign.mockResolvedValue("owned-image-url");
});
describe("Owned generated catalog", () => {
  it("queries reusable ready products through owner membership and validates same-source asset membership", async () => {
    m.db.product.findMany.mockResolvedValue([
      {
        id: "valid",
        name: "My chair",
        sceneId: "source",
        modelAsset: { sceneId: "source", status: "READY", kind: "MODEL_GLB" },
        imageAsset: { sceneId: "source", status: "READY" },
      },
      {
        id: "foreign-model",
        name: "Wrong binding",
        sceneId: "source",
        modelAsset: { sceneId: "other", status: "READY", kind: "MODEL_GLB" },
      },
    ]);
    expect(await catalog("target", "owner")).toEqual([
      { id: "valid", name: "My chair", imageUrl: "owned-image-url" },
    ]);
    expect(m.db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scene: { ownerId: "owner", archivedAt: null },
        }),
      }),
    );
  });
  it("cannot import another owner's source or read its bytes", async () => {
    m.db.sceneObject.findFirst.mockResolvedValue({
      id: "object",
      provenance: {},
      modelAssetId: "original",
      initialTransform: {},
    });
    await expect(
      replaceObject("target", "owner", {
        action: "REPLACE",
        expectedRevision: 4,
        objectId: crypto.randomUUID(),
        productId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "INVALID_PRODUCT" });
    expect(m.db.product.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          catalogRole: "SOURCE",
          catalogStatus: "READY",
          scene: { ownerId: "owner", archivedAt: null },
        }),
      }),
    );
    expect(m.read).not.toHaveBeenCalled();
    expect(m.put).not.toHaveBeenCalled();
  });
});
