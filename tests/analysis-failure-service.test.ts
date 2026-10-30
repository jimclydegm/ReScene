import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  db: {
    generationRun: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    generationStep: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    scene: { updateMany: vi.fn() },
    asset: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  analyze: vi.fn(),
  read: vi.fn(),
  put: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => m.db }));
vi.mock("@/lib/ai/analyze", () => ({ analyzePhoto: m.analyze }));
vi.mock("@/lib/storage/r2", () => ({
  readLimited: m.read,
  putObject: m.put,
  bucket: () => "private",
  storagePrefix: () => "test",
}));
import { analyzeRun, failRun } from "../src/lib/services/generation";
import type { AnalysisEvents } from "../src/lib/ai/analyze";
import { ProviderResultError } from "../src/lib/ai/provider-failure";
const run = () => ({
  id: "run",
  kind: "ANALYZE",
  sceneId: "scene",
  inputRevision: 1,
  input: {},
  status: "RUNNING",
  expiresAt: new Date(Date.now() + 60000),
  scene: {
    id: "scene",
    revision: 1,
    archivedAt: null,
    normalizedAsset: {
      id: "photo",
      storageKey: "private/photo",
      width: 100,
      height: 100,
    },
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  m.db.generationRun.findUniqueOrThrow.mockResolvedValue(run());
  m.db.generationRun.findUnique.mockResolvedValue(run());
  m.db.generationStep.create.mockResolvedValue({ id: "step" });
  m.read.mockResolvedValue(Buffer.from("photo"));
  m.db.asset.create.mockResolvedValue({ id: "saved-response" });
  m.db.$transaction.mockImplementation(async (v) => Promise.all(v));
});
describe("Analysis failure receipts", () => {
  it("records HTTP rejection on the step and reports its actual cause on the run", async () => {
    m.analyze.mockImplementation(
      async (_image, _size, _options, hooks: AnalysisEvents) => {
        await hooks.onRequest?.();
        throw Object.assign(new Error("Missing geometry in required"), {
          status: 400,
        });
      },
    );
    await expect(analyzeRun("run")).rejects.toThrow("Missing geometry");
    expect(m.db.generationStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorCode: "META_HTTP_400",
          errorMessage: "Missing geometry in required",
        }),
      }),
    );
    m.db.generationStep.findMany.mockResolvedValue([
      {
        key: "spark",
        provider: "META",
        status: "FAILED",
        errorCode: "META_HTTP_400",
      },
    ]);
    await failRun("run");
    expect(m.db.generationRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: "META_HTTP_400",
          errorMessage: expect.stringContaining("format was invalid"),
        }),
      }),
    );
  });
  it("retains provider output even when result validation fails", async () => {
    m.analyze.mockImplementation(
      async (_image, _size, _options, hooks: AnalysisEvents) => {
        await hooks.onRequest?.();
        await hooks.onResponse?.({
          id: "receipt",
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        });
        throw new ProviderResultError("Invalid output");
      },
    );
    await expect(analyzeRun("run")).rejects.toThrow("Invalid output");
    expect(m.put).toHaveBeenCalledTimes(1);
    expect(m.db.generationStep.update).toHaveBeenCalledWith({
      where: { id: "step" },
      data: { responseAssetId: "saved-response" },
    });
    expect(m.db.generationStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorCode: "ANALYSIS_RESULT_INVALID",
        }),
      }),
    );
  });
  it("keeps uncertainty on repeated failure handling without another submit", async () => {
    m.db.generationStep.findMany.mockResolvedValue([
      {
        key: "spark",
        provider: "META",
        status: "SUBMISSION_UNCERTAIN",
        providerRequestId: null,
      },
    ]);
    await failRun("run");
    expect(m.db.generationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: "SUBMISSION_UNCERTAIN" }),
      }),
    );
    expect(m.analyze).not.toHaveBeenCalled();
  });
});
