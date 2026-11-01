import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    scene: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    sceneBackground: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    sceneObject: { findMany: vi.fn() },
    asset: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    generationRun: { findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    generationStep: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    scenePublication: { findMany: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn()
  },
  owned: vi.fn(),
  read: vi.fn(),
  put: vi.fn(),
  sign: vi.fn(),
  restyle: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/lib/services/scenes", () => ({ ownedScene: mocks.owned }));
vi.mock("@/lib/storage/r2", () => ({
  readLimited: mocks.read,
  putObject: mocks.put,
  bucket: () => "private",
  storagePrefix: () => "test",
  signRead: mocks.sign
}));
vi.mock("@/lib/ai/background", () => ({ restyleBackgroundVariant: mocks.restyle }));

import { runInputSchema } from "../src/lib/validation/generation";
import { backgroundVariantActionSchema } from "../src/lib/validation/background-variants";

describe("background variant request contracts", () => {
  it("accepts a confirmed variant run without a background mode", () => {
    const parsed = runInputSchema.safeParse({
      kind: "IMAGE_EDIT",
      expectedRevision: 3,
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      confirmed: true,
      backgroundVariant: { stylePrompt: "warm plaster" }
    });
    expect(parsed.success).toBe(true);
  });
  it("rejects variants mixed with other paid background work", () => {
    const parsed = runInputSchema.safeParse({
      kind: "IMAGE_EDIT",
      expectedRevision: 3,
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      confirmed: true,
      background: { mode: "reference" },
      backgroundVariant: {}
    });
    expect(parsed.success).toBe(false);
  });
  it("validates select/delete actions by variant id", () => {
    const id = "123e4567-e89b-12d3-a456-426614174001";
    expect(backgroundVariantActionSchema.safeParse({ action: "SELECT", expectedRevision: 1, variantId: id }).success).toBe(true);
    expect(backgroundVariantActionSchema.safeParse({ action: "DELETE", expectedRevision: 1, variantId: id }).success).toBe(true);
    expect(backgroundVariantActionSchema.safeParse({ action: "SELECT", expectedRevision: 1, variantId: "nope" }).success).toBe(false);
  });
});

describe("background variant guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sign.mockResolvedValue("https://signed.example/variant.webp");
  });

  it("blocks switching to a missing variant without touching the scene", async () => {
    const { selectBackgroundVariant } = await import("../src/lib/services/background-variants");
    mocks.owned.mockResolvedValue({ id: "scene", revision: 5, status: "READY", normalizedAssetId: "photo", normalizedAsset: { width: 64, height: 64 }, stage: {}, settings: {} });
    mocks.db.sceneBackground.findFirst.mockResolvedValue(null);
    mocks.db.generationRun.count.mockResolvedValue(0);
    await expect(selectBackgroundVariant("scene", "owner", "123e4567-e89b-12d3-a456-426614174001", 5)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.db.scene.updateMany).not.toHaveBeenCalled();
  });

  it("blocks deleting the active variant", async () => {
    const { deleteBackgroundVariant } = await import("../src/lib/services/background-variants");
    const variantId = "123e4567-e89b-12d3-a456-426614174002";
    mocks.owned.mockResolvedValue({ id: "scene", revision: 7, status: "READY", settings: { activeBackgroundId: variantId, background: { assetId: "texture" } } });
    mocks.db.sceneBackground.findFirst.mockResolvedValue({ id: variantId, sceneId: "scene", textureAssetId: "texture", deletedAt: null });
    await expect(deleteBackgroundVariant("scene", "owner", variantId, 7)).rejects.toMatchObject({ code: "VARIANT_ACTIVE" });
    expect(mocks.db.sceneBackground.updateMany).not.toHaveBeenCalled();
  });

  it("rejects invalid provider bytes without saving a variant or touching the scene", async () => {
    const { generateBackgroundVariantRun } = await import("../src/lib/services/background-variants");
    const scene = {
      id: "scene", revision: 4, status: "READY", archivedAt: null, normalizedAssetId: "photo",
      normalizedAsset: { storageKey: "photo", width: 64, height: 64 },
      stage: { version: "sam3d-room-v1", layoutSource: "sam3d", camera: { position: [0, 4, 8], target: [0, 1, 0], fov: 50, aspect: 1 }, room: { centerX: 0, centerZ: 0, width: 8, depth: 8, height: 4 }, environment: { floorColor: "#aaaaaa", wallColor: "#dddddd", floorMaterial: "plain", lightDirection: "diffuse", lightWarmth: "neutral", sideWall: "none" }, environmentSource: "spark", projectionError: 0, warnings: [] },
      settings: { background: { version: "reference-environment-v1", assetId: "current-texture", photoId: "photo" } }
    };
    mocks.db.generationRun.findUniqueOrThrow.mockResolvedValue({
      id: "run", kind: "IMAGE_EDIT", status: "RUNNING", inputRevision: 4, input: { normalizedAssetId: "photo", backgroundVariant: {} }, expiresAt: new Date(Date.now() + 60_000), scene
    });
    mocks.db.asset.findFirst.mockResolvedValue({ id: "current-texture", sceneId: "scene", kind: "SURFACE_TEXTURE", status: "READY", storageKey: "texture" });
    const sharp = (await import("sharp")).default;
    const referenceImage = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#aabbcc" } }).webp().toBuffer();
    mocks.read.mockResolvedValue(referenceImage);
    mocks.restyle.mockResolvedValue({ bytes: Buffer.from("not-an-image"), model: "muse-image-1.0" });
    mocks.db.generationStep.create.mockResolvedValue({ id: "step" });
    await expect(generateBackgroundVariantRun("run")).rejects.toThrow();
    expect(mocks.db.asset.create).not.toHaveBeenCalled();
    expect(mocks.db.sceneBackground.create).not.toHaveBeenCalled();
    expect(mocks.db.scene.update).not.toHaveBeenCalled();
    expect(mocks.db.scene.updateMany).not.toHaveBeenCalled();
  });

  it("creates new variants without changing the active background revision path for generation", async () => {
    const { generateBackgroundVariantRun } = await import("../src/lib/services/background-variants");
    const scene = {
      id: "scene", revision: 4, status: "READY", archivedAt: null, normalizedAssetId: "photo",
      normalizedAsset: { storageKey: "photo", width: 64, height: 64 },
      stage: { version: "sam3d-room-v1", layoutSource: "sam3d", camera: { position: [0, 4, 8], target: [0, 1, 0], fov: 50, aspect: 1 }, room: { centerX: 0, centerZ: 0, width: 8, depth: 8, height: 4 }, environment: { floorColor: "#aaaaaa", wallColor: "#dddddd", floorMaterial: "plain", lightDirection: "diffuse", lightWarmth: "neutral", sideWall: "none" }, environmentSource: "spark", projectionError: 0, warnings: [], background: { kind: "seamless", groundVisible: true, boundary: null, description: "plain" } },
      settings: { background: { version: "reference-environment-v1", assetId: "current-texture", photoId: "photo" } }
    };
    mocks.db.generationRun.findUniqueOrThrow.mockResolvedValue({
      id: "run", kind: "IMAGE_EDIT", status: "RUNNING", inputRevision: 4, input: { normalizedAssetId: "photo", backgroundVariant: { stylePrompt: "oak" } }, expiresAt: new Date(Date.now() + 60_000), scene
    });
    mocks.db.asset.findFirst.mockResolvedValue({ id: "current-texture", sceneId: "scene", kind: "SURFACE_TEXTURE", status: "READY", storageKey: "texture" });
    const sharp = (await import("sharp")).default;
    const referenceImage = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#aabbcc" } }).webp().toBuffer();
    const generatedImage = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#cbbbaa" } }).png().toBuffer();
    mocks.read.mockResolvedValue(referenceImage);
    mocks.restyle.mockResolvedValue({ bytes: generatedImage, model: "muse-image-1.0" });
    mocks.db.generationStep.create.mockResolvedValue({ id: "step" });
    mocks.db.scene.findUniqueOrThrow.mockResolvedValue(scene);
    mocks.db.sceneBackground.findMany.mockResolvedValue([]);
    mocks.db.sceneBackground.count.mockResolvedValue(1);
    mocks.db.sceneBackground.create.mockResolvedValue({ id: "new" });
    await expect(generateBackgroundVariantRun("run")).resolves.toBeUndefined();
    expect(mocks.restyle).toHaveBeenCalledTimes(1);
    expect(mocks.db.scene.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.sceneBackground.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sceneId: "scene" }) }));
  });
});
