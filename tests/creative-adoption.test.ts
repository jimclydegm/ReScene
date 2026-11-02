import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
const m = vi.hoisted(() => ({
  db: {
    contentItem: { findFirst: vi.fn() },
    asset: { findFirst: vi.fn(), create: vi.fn() },
    scene: { count: vi.fn(), create: vi.fn(), update: vi.fn() },
    contentAdoption: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  storage: {
    readLimited: vi.fn(),
    putObject: vi.fn(),
    bucket: () => "test",
    storagePrefix: () => "test",
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => m.db }));
vi.mock("@/lib/storage/r2", () => m.storage);
import { adoptCreative } from "../src/lib/services/creative";
const itemId = randomUUID(),
  assetId = randomUUID(),
  sceneId = randomUUID();
describe("generated library adoption", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    m.db.contentItem.findFirst.mockResolvedValue({ id: itemId, assetId });
    m.db.asset.findFirst.mockResolvedValue({
      id: assetId,
      storageKey: "private/source.webp",
      provenance: { source: "curated-muse-photograph" },
    });
    m.db.scene.count.mockResolvedValue(80);
    m.db.scene.create.mockResolvedValue({ id: sceneId });
    m.db.asset.create.mockImplementation(async ({ data }) => data);
    m.db.$transaction.mockImplementation(async (calls) => Promise.all(calls));
    m.storage.readLimited.mockResolvedValue(
      await sharp({
        create: { width: 32, height: 32, channels: 3, background: "#ddd" },
      })
        .webp()
        .toBuffer(),
    );
  });
  it("follows the image FK and records the library item FK even when their IDs differ", async () => {
    expect(await adoptCreative("owner", itemId, "Fresh example")).toBe(sceneId);
    expect(m.db.asset.findFirst.mock.calls[0][0].where).toMatchObject({
      id: assetId,
      kind: "SOURCE_IMAGE",
      status: "READY",
      scene: { ownerId: "owner", archivedAt: null },
    });
    expect(m.db.contentAdoption.create).toHaveBeenCalledWith({
      data: { sceneId, contentItemId: itemId },
    });
    const copies = m.db.asset.create.mock.calls.map(([v]) => v.data);
    expect(copies.map((v) => v.kind)).toEqual([
      "SOURCE_IMAGE",
      "NORMALIZED_IMAGE",
    ]);
    expect(copies.every((v) => v.sceneId === sceneId)).toBe(true);
    expect(copies[0].id).not.toBe(copies[1].id);
  });
  it("continues to accept the original generated-image identity convention", async () => {
    m.db.contentItem.findFirst.mockResolvedValue({ id: assetId, assetId });
    m.db.asset.findFirst.mockResolvedValue({
      id: assetId,
      storageKey: "private/legacy.webp",
      provenance: { source: "muse-scene-composition" },
    });
    await adoptCreative("owner", assetId, "Legacy");
    expect(
      m.db.contentAdoption.create.mock.calls[0][0].data.contentItemId,
    ).toBe(assetId);
  });
  it("rejects unavailable library items and foreign/archived source scenes before copying bytes", async () => {
    m.db.contentItem.findFirst.mockResolvedValue(null);
    await expect(adoptCreative("owner", itemId, "X")).rejects.toMatchObject({
      code: "IMAGE_UNAVAILABLE",
    });
    expect(m.db.asset.findFirst).not.toHaveBeenCalled();
    expect(m.db.contentItem.findFirst.mock.calls[0][0].where).toMatchObject({
      ownerId: "owner",
      kind: "GENERATED",
      archivedAt: null,
    });
    m.db.contentItem.findFirst.mockResolvedValue({ id: itemId, assetId });
    m.db.asset.findFirst.mockResolvedValue(null);
    await expect(adoptCreative("owner", itemId, "X")).rejects.toMatchObject({
      code: "IMAGE_UNAVAILABLE",
    });
    expect(m.storage.readLimited).not.toHaveBeenCalled();
    expect(m.db.scene.create).not.toHaveBeenCalled();
  });
  it("rejects unapproved source provenance and keeps a bounded active-project allowance", async () => {
    m.db.asset.findFirst.mockResolvedValue({
      id: assetId,
      provenance: { source: "other-upload" },
    });
    await expect(adoptCreative("owner", itemId, "X")).rejects.toMatchObject({
      code: "IMAGE_UNAVAILABLE",
    });
    m.db.asset.findFirst.mockResolvedValue({
      id: assetId,
      provenance: { source: "curated-muse-photograph" },
    });
    m.db.scene.count.mockResolvedValue(200);
    await expect(adoptCreative("owner", itemId, "X")).rejects.toMatchObject({
      code: "SCENE_LIMIT",
    });
    expect(m.storage.readLimited).not.toHaveBeenCalled();
    expect(m.db.scene.create).not.toHaveBeenCalled();
  });
});
