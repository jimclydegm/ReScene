import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  db: {
    scene: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
    },
    sceneObject: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    asset: { updateMany: vi.fn() },
    scenePublication: { updateMany: vi.fn() },
    generationRun: { findUnique: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  thumbnail: vi.fn(),
  owned: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => m.db }));
vi.mock("@/lib/services/product-thumbnail", () => ({
  productThumbnail: m.thumbnail,
}));
vi.mock("@/lib/services/scenes", () => ({ ownedScene: m.owned }));
import {
  syncSceneProducts,
  syncGeneratedProducts,
} from "../src/lib/services/product-library";
import { restartScene } from "../src/lib/services/restart";
const object = () => ({
  id: crypto.randomUUID(),
  label: "ceramic table lamp",
  category: "lighting",
  sceneId: "scene",
  status: "READY",
  modelAssetId: "model",
  productId: null,
  product: null,
  model: { id: "model", sceneId: "scene", kind: "MODEL_GLB", status: "READY" },
  provenance: {},
});
beforeEach(() => {
  vi.resetAllMocks();
  m.db.$transaction.mockImplementation((fn) => fn(m.db));
  m.db.scene.updateMany.mockResolvedValue({ count: 1 });
  m.thumbnail.mockResolvedValue("thumbnail");
  m.db.product.findUnique.mockResolvedValue(null);
  m.db.product.create.mockImplementation(({ data }) => ({
    id: "product",
    ...data,
  }));
  m.db.product.update.mockImplementation(({ where, data }) => ({
    id: where.id,
    ...data,
  }));
});
describe("Reusable generated product persistence", () => {
  it("creates a complete source listing and attaches the existing mesh without inference", async () => {
    const o = object();
    m.db.scene.findFirst.mockResolvedValue({
      id: "scene",
      status: "READY",
      revision: 3,
      objects: [o],
      normalizedAsset: { width: 100, height: 100 },
    });
    m.db.sceneObject.findFirst.mockResolvedValue(o);
    expect(await syncSceneProducts("scene")).toEqual({ saved: 1 });
    expect(m.db.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sceneId: "scene",
        sourceObjectKey: o.id,
        catalogRole: "SOURCE",
        modelAssetId: "model",
        imageAssetId: "thumbnail",
        name: o.label,
        price: "79.00",
        description: expect.any(String),
      }),
    });
    expect(m.db.sceneObject.update).toHaveBeenCalledWith({
      where: { id: o.id },
      data: { productId: "product" },
    });
  });
  it("preserves merchant descriptions and an explicitly cleared price when the model changes", async () => {
    const o = {
      ...object(),
      productId: "merchant",
      product: {
        id: "merchant",
        sceneId: "scene",
        catalogRole: "SOURCE",
        catalogStatus: "DRAFT",
        name: "My lamp",
        description: "",
        price: null,
        currency: null,
        modelAssetId: "previous-model",
        imageAssetId: "thumbnail",
        inferredDetails: {},
      },
    };
    m.db.scene.findFirst.mockResolvedValue({
      revision: 3,
      objects: [o],
      normalizedAsset: { width: 100, height: 100 },
    });
    m.db.sceneObject.findFirst.mockResolvedValue(o);
    await syncSceneProducts("scene");
    expect(m.db.product.update).toHaveBeenCalledWith({
      where: { id: "merchant" },
      data: expect.objectContaining({
        name: "My lamp",
        description: "",
        price: null,
        currency: null,
        modelAssetId: "model",
      }),
    });
  });
  it("does not touch the protected fixture or attach a foreign model", async () => {
    expect(
      await syncSceneProducts("f2848b95-8447-41eb-9544-0d72dd605565"),
    ).toEqual({ saved: 0 });
    expect(m.db.scene.findFirst).not.toHaveBeenCalled();
    const o = object();
    o.model.sceneId = "another-scene";
    m.db.scene.findFirst.mockResolvedValue({ revision: 1, objects: [o] });
    expect(await syncSceneProducts("scene")).toEqual({ saved: 0 });
    expect(m.db.product.create).not.toHaveBeenCalled();
  });
  it("leaves paused known jobs resumable and respects deliberate card removal", async () => {
    m.db.generationRun.findUnique.mockResolvedValue({
      sceneId: "scene",
      status: "FAILED",
      errorCode: "KNOWN_BACKGROUND_JOB_INTERRUPTED",
    });
    await syncGeneratedProducts("run");
    expect(m.db.scene.findFirst).not.toHaveBeenCalled();
    const o = { ...object(), provenance: { catalogSuppressed: true } };
    m.db.scene.findFirst.mockResolvedValue({ revision: 1, objects: [o] });
    expect(await syncSceneProducts("scene")).toEqual({ saved: 0 });
  });
  it("retains source product assets and listings while invalidating restarted scene work", async () => {
    const scene = {
      id: "scene",
      ownerId: "owner",
      revision: 5,
      status: "READY",
      normalizedAssetId: "photo",
      settings: {},
    };
    m.db.scene.findFirstOrThrow.mockResolvedValue(scene);
    m.db.generationRun.count.mockResolvedValue(0);
    m.db.sceneObject.findMany.mockResolvedValue([]);
    m.db.product.findMany.mockResolvedValue([
      { modelAssetId: "retained-model", imageAssetId: "retained-thumbnail" },
    ]);
    await restartScene("scene", "owner", {
      target: "PHOTO",
      expectedRevision: 5,
      confirmed: true,
    });
    expect(m.db.product.deleteMany).toHaveBeenCalledWith({
      where: {
        sceneId: "scene",
        OR: [{ catalogRole: null }, { catalogRole: { not: "SOURCE" } }],
      },
    });
    expect(m.db.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ["retained-model", "retained-thumbnail"] },
        }),
        data: { status: "DELETED", deletedAt: expect.any(Date) },
      }),
    );
    expect(m.db.scenePublication.updateMany).toHaveBeenCalled();
  });
});
