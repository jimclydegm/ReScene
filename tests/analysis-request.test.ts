import { beforeEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
const mock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/meta", () => ({
  getMetaClient: () => ({ chat: { completions: { create: mock.create } } }),
  metaModels: { analysis: () => "muse-spark-1.3" },
}));
import { analyzePhoto, analysisResponseSchema } from "../src/lib/ai/analyze";
import { analysisSchema } from "../src/lib/ai/contracts";
import {
  backgroundPlanSchema,
  backgroundObservationSchema,
} from "../src/lib/scene/background";
import {
  assertStrictSchema,
  strictResponseFormat,
} from "../src/lib/ai/structured-output";
import {
  classifyAnalysisFailure,
  ProviderResultError,
} from "../src/lib/ai/provider-failure";
const response = (content: string) => ({
  id: "receipt",
  model: "muse-spark-1.3",
  choices: [{ finish_reason: "stop", message: { content } }],
  usage: { prompt_tokens: 12, completion_tokens: 24 },
});
beforeEach(() => vi.resetAllMocks());
describe("Meta analysis response contract", () => {
  it("keeps renderer geometry out and requires all observation properties", () => {
    const format = strictResponseFormat("analysis", analysisResponseSchema),
      schema = format.json_schema.schema as {
        properties: Record<
          string,
          { properties: Record<string, unknown>; required: string[] }
        >;
      };
    expect(Object.keys(schema.properties.background.properties).sort()).toEqual(
      ["boundary", "description", "groundVisible", "kind"],
    );
    expect(schema.properties.background.required.sort()).toEqual(
      Object.keys(schema.properties.background.properties).sort(),
    );
    expect(() => assertStrictSchema(format.json_schema.schema)).not.toThrow();
    expect(() =>
      strictResponseFormat("background", backgroundObservationSchema),
    ).not.toThrow();
  });
  it("catches the actual optional-render-geometry regression before inference", () => {
    const broken = analysisSchema.extend({
      background: backgroundPlanSchema.omit({
        plainColor: true,
        surfaceMode: true,
        transition: true,
        junctions: true,
        materials: true,
      }),
    });
    expect(() => strictResponseFormat("broken", broken)).toThrow(
      "all properties must be required",
    );
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("checks nested objects and rejects unsupported schema unions", () => {
    expect(() =>
      strictResponseFormat(
        "optional",
        z
          .object({
            nested: z.object({ value: z.string().optional() }).strict(),
          })
          .strict(),
      ),
    ).toThrow();
    expect(() =>
      assertStrictSchema({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
        oneOf: [],
      }),
    ).toThrow();
  });
  it("persists a received result before parsing an invalid model answer", async () => {
    mock.create.mockResolvedValue(response("broken JSON"));
    const events = { onRequest: vi.fn(), onResponse: vi.fn() };
    await expect(
      analyzePhoto(
        "data:image/webp;base64,dGVzdA==",
        { width: 100, height: 100 },
        undefined,
        events,
      ),
    ).rejects.toBeInstanceOf(ProviderResultError);
    expect(events.onRequest).toHaveBeenCalledTimes(1);
    expect(events.onResponse).toHaveBeenCalledWith(
      expect.objectContaining({ id: "receipt", choices: expect.any(Array) }),
    );
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.create.mock.calls[0][1].maxRetries).toBe(0);
  });
  it("stops before the provider if recording the request phase fails", async () => {
    await expect(
      analyzePhoto("photo", { width: 100, height: 100 }, undefined, {
        onRequest: async () => {
          throw new Error("DB unavailable");
        },
      }),
    ).rejects.toThrow("DB unavailable");
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("separates rejected requests, local errors, invalid output and connection uncertainty", () => {
    expect(
      classifyAnalysisFailure(
        Object.assign(new Error("Invalid schema"), { status: 400 }),
        "requesting",
      ),
    ).toMatchObject({ status: "FAILED", errorCode: "META_HTTP_400" });
    expect(
      classifyAnalysisFailure(new Error("Connection lost"), "requesting"),
    ).toMatchObject({
      status: "SUBMISSION_UNCERTAIN",
      errorCode: "SUBMISSION_UNCERTAIN",
    });
    expect(
      classifyAnalysisFailure(new Error("Storage unavailable"), "preparing")
        .status,
    ).toBe("FAILED");
    expect(
      classifyAnalysisFailure(
        new ProviderResultError("Invalid result"),
        "responded",
      ).errorCode,
    ).toBe("ANALYSIS_RESULT_INVALID");
    expect(
      classifyAnalysisFailure(
        new Error(
          "Photo https://private.example/signed data:image/webp;base64,abc",
        ),
        "preparing",
      ).errorMessage,
    ).not.toContain("private.example");
  });
});
