import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  db: {
    generationRun: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    generationStep: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    asset: { findFirst: vi.fn(), create: vi.fn() },
  },
  submit: vi.fn(),
  status: vi.fn(),
  result: vi.fn(),
  read: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => m.db }));
vi.mock("@/lib/ai/sam3d", () => ({
  getSam3dClient: () => ({
    client: { queue: { submit: m.submit, status: m.status, result: m.result } },
  }),
}));
vi.mock("@/lib/storage/r2", () => ({
  readLimited: m.read,
  putObject: vi.fn(),
  bucket: () => "private",
  storagePrefix: () => "test",
}));
import {
  prepareEnvironmentDepth,
  pollEnvironmentDepth,
  environmentContext,
} from "../src/lib/services/background-environment";
const plan = {
  version: "environment-observation-v1",
  topology: "room",
  surfaces: [
    {
      id: "floor",
      role: "floor",
      polygon: [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      finish: "textured",
      color: "#cccccc",
      roughness: 0.9,
      material: "Wood",
      confidence: 1,
    },
  ],
  openings: [],
  expectedWallCount: 0,
  lightingEffects: [],
  explanation: "One observed floor",
};
const run = () => ({
  id: "run",
  sceneId: "scene",
  kind: "IMAGE_EDIT",
  status: "RUNNING",
  inputRevision: 8,
  input: { normalizedAssetId: "photo", background: { mode: "reference" } },
  expiresAt: new Date(Date.now() + 60000),
  scene: {
    id: "scene",
    revision: 8,
    status: "READY",
    archivedAt: null,
    normalizedAssetId: "photo",
    normalizedAsset: {
      id: "photo",
      width: 1600,
      height: 900,
      storageKey: "photo",
    },
    settings: { environmentObservation: { photoId: "photo", analysis: plan } },
  },
});
describe("Paid background depth safeguards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.db.generationRun.findUniqueOrThrow.mockResolvedValue(run());
    m.db.generationStep.create.mockResolvedValue({ id: "step" });
    m.submit.mockResolvedValue({ request_id: "saved-job" });
    m.read.mockResolvedValue(Buffer.from("photo"));
  });
  it("reuses completed same-photo depth without another submission", async () => {
    m.db.generationStep.findFirst.mockResolvedValue({
      status: "SUCCEEDED",
      response: {},
    });
    expect(await prepareEnvironmentDepth("run")).toBeNull();
    expect(m.submit).not.toHaveBeenCalled();
  });
  it("resumes a saved provider job without submitting it again", async () => {
    m.db.generationStep.findUnique.mockResolvedValue({
      providerRequestId: "saved-job",
      status: "WAITING",
    });
    expect(await prepareEnvironmentDepth("run")).toBe("saved-job");
    expect(m.submit).not.toHaveBeenCalled();
  });
  it("retrieves an unfinished same-photo job from an earlier run instead of charging again", async () => {
    m.db.generationStep.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "earlier-step",
        providerRequestId: "earlier-job",
      });
    expect(await prepareEnvironmentDepth("run")).toBe("earlier-job");
    expect(m.submit).not.toHaveBeenCalled();
    expect(m.db.generationStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerRequestId: "earlier-job",
          status: "WAITING",
        }),
      }),
    );
  });
  it("does not resubmit an uncertain attempt without a saved request ID", async () => {
    m.db.generationStep.findUnique.mockResolvedValue({
      status: "RUNNING",
      providerRequestId: null,
    });
    await expect(prepareEnvironmentDepth("run")).rejects.toThrow(
      "ALREADY_ATTEMPTED",
    );
    expect(m.submit).not.toHaveBeenCalled();
  });
  it("records the request immediately and polls only that saved job", async () => {
    expect(await prepareEnvironmentDepth("run")).toBe("saved-job");
    expect(m.submit).toHaveBeenCalledTimes(1);
    expect(m.db.generationStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "WAITING", providerRequestId: "saved-job" },
      }),
    );
    m.db.generationStep.findUnique.mockResolvedValue({
      status: "WAITING",
      providerRequestId: "saved-job",
    });
    m.db.generationStep.findUniqueOrThrow.mockResolvedValue({
      status: "WAITING",
      providerRequestId: "saved-job",
    });
    m.status.mockResolvedValue({ status: "IN_QUEUE" });
    expect(await pollEnvironmentDepth("run", "saved-job")).toBe(false);
    await expect(pollEnvironmentDepth("run", "different-job")).rejects.toThrow(
      "MISMATCH",
    );
    expect(m.submit).toHaveBeenCalledTimes(1);
  });
  it("rejects cancellation, changed photos, expiry and revision changes before paid work", async () => {
    const base = run();
    for (const r of [
      { ...base, status: "CANCELED" },
      { ...base, expiresAt: new Date(0) },
      { ...base, scene: { ...base.scene, revision: 9 } },
      { ...base, scene: { ...base.scene, normalizedAssetId: "other" } },
    ]) {
      m.db.generationRun.findUniqueOrThrow.mockResolvedValue(r);
      await expect(environmentContext("run")).rejects.toThrow("STALE");
    }
    expect(m.submit).not.toHaveBeenCalled();
  });
  it("does not start depth jobs for explicitly selected legacy modes", async () => {
    m.db.generationRun.findUniqueOrThrow.mockResolvedValue({
      ...run(),
      input: { normalizedAssetId: "photo", background: { mode: "materials" } },
    });
    expect(await prepareEnvironmentDepth("run")).toBeNull();
    expect(m.submit).not.toHaveBeenCalled();
  });
});
