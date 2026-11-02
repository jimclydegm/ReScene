import { describe, it, expect, vi } from "vitest";
const create = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/meta", () => ({
  getMetaClient: () => ({ chat: { completions: { create } } }),
  metaModels: { analysis: () => "muse-spark-1.3" },
}));
import { shoppingIntent } from "../src/lib/ai/shopping-stylist";
import { demoScenes, initialArrangement } from "../src/lib/demo/scenes";
import type { StylistInput } from "../src/lib/shopping/contracts";
const scene = demoScenes.find((s) => s.id === "workspace")!,
  input: StylistInput = {
    key: crypto.randomUUID(), sceneId: scene.id, text: "Two different mice under $100",
    budgetCents: 10000, selected: "workspace-item-4", keep: [], draft: initialArrangement(scene),
  };
describe("Spark shopping response diagnostics", () => {
  it("retains safe length/token evidence with no automatic retry and enough reasoning allowance", async () => {
    create.mockResolvedValueOnce({ choices: [{ finish_reason: "length", message: { content: "private partial text" } }], usage: { completion_tokens: 8000 } });
    await expect(shoppingIntent(input)).rejects.toMatchObject({ code: "SHOPPING_RESPONSE_LENGTH", diagnostic: { finishReason: "length", usage: { completion_tokens: 8000 } } });
    const [request, options] = create.mock.calls.at(-1)!;
    expect(request.max_completion_tokens).toBe(8000);
    expect(options).toEqual({ maxRetries: 0, timeout: 90000 });
  });
  it("treats malformed JSON as a known response and omits its text from diagnostics", async () => {
    create.mockResolvedValueOnce({ choices: [{ finish_reason: "stop", message: { content: "private invalid output" } }], usage: {} });
    const error = await shoppingIntent(input).catch((e) => e);
    expect(error.code).toBe("SHOPPING_RESPONSE_INVALID");
    expect(JSON.stringify(error)).not.toContain("private invalid output");
  });
});
