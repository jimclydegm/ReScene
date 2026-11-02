import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { ShoppingStylistRequest } from "../src/generated/prisma/client";
const m = vi.hoisted(() => ({
  db: {
    shoppingStylistRequest: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    product: { findMany: vi.fn() },
    voiceAttempt: { findFirst: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
  intent: vi.fn(),
  rank: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => m.db }));
vi.mock("@/lib/ai/shopping-stylist", () => ({
  shoppingIntent: m.intent,
  rankShopping: m.rank,
}));
import {
  reserveShopping,
  executeShopping,
  readShopping,
  applyShopping,
} from "../src/lib/services/shopping-stylist";
import { demoProducts } from "../src/lib/demo/catalog";
import models from "../src/lib/demo/catalog-models.json";
import { demoScenes, initialArrangement } from "../src/lib/demo/scenes";
import type { StylistInput } from "../src/lib/shopping/contracts";
import { ShoppingResponseError } from "../src/lib/ai/shopping-response";
const actor = { actorHash: "actor", networkHash: "network" },
  request = (): StylistInput => ({
    key: crypto.randomUUID(),
    sceneId: "corner",
    text: "Make it warmer",
    budgetCents: 50000,
    selected: "corner-chair",
    keep: ["corner-chair"],
    draft: initialArrangement(demoScenes.find((s) => s.id === "corner")!),
  });
let row: ShoppingStylistRequest | null;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GENERATION_ENABLED", "true");
  row = null;
  m.db.$transaction.mockImplementation((fn) => fn(m.db));
  m.db.shoppingStylistRequest.findUnique.mockImplementation(() => row);
  m.db.shoppingStylistRequest.findUniqueOrThrow.mockImplementation(() => row);
  m.db.shoppingStylistRequest.findFirst.mockImplementation(() => row);
  m.db.shoppingStylistRequest.count.mockResolvedValue(0);
  m.db.product.findMany.mockResolvedValue(
    demoProducts.map((p) => ({
      catalogKey: p.id,
      name: p.name,
      description: p.description,
      inferredDetails: p,
      currency: "USD",
      price: { toFixed: () => (p.price / 100).toFixed(2) },
      modelAsset: {
        status: "READY",
        sha256: models.find((m) => m.id === p.id)!.digest,
      },
    })),
  );
  m.db.shoppingStylistRequest.create.mockImplementation(({ data }) => {
    row = {
      id: crypto.randomUUID(),
      status: "PENDING",
      phase: "QUEUED",
      intent: null,
      result: null,
      usage: {},
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    return row;
  });
  m.db.shoppingStylistRequest.update.mockImplementation(({ data }) => {
    row = { ...row, ...data, updatedAt: new Date() } as ShoppingStylistRequest;
    return row;
  });
  m.db.shoppingStylistRequest.updateMany.mockImplementation(
    ({ where, data }) => {
      if (!row || (where.status && where.status !== row.status))
        return { count: 0 };
      row = {
        ...row,
        ...data,
        updatedAt: new Date(),
      } as ShoppingStylistRequest;
      return { count: 1 };
    },
  );
  m.intent.mockResolvedValue({
    value: {
      summary: "A warmer corner",
      palette: "warm",
      keep: ["corner-chair"],
      excludedProductIds: [],
      requireStorage: false,
      budgetCents: null,
      strictBudget: false,
      lighting: "Dusk",
      background: "linen",
      layout: "original",
      clarification: null,
    },
    usage: { prompt_tokens: 20 },
  });
  m.rank.mockImplementation(async (_input, _summary, candidates) => ({
    value: {
      options: candidates.slice(0, 2).map((c: { id: string }, i: number) => ({
        candidateId: c.id,
        title: `Look ${i + 1}`,
        reason: "Warm finishes coordinated with a useful table.",
      })),
    },
    usage: { prompt_tokens: 20 },
  }));
});
afterEach(() => vi.unstubAllEnvs());
describe("Durable shopping stylist", () => {
  it("reuses duplicate reservations and never repeats successful model calls", async () => {
    const input = request(),
      a = await reserveShopping(actor, input),
      b = await reserveShopping(actor, input);
    expect(a.id).toBe(b.id);
    await executeShopping(a.id);
    await executeShopping(a.id);
    expect(row!.status).toBe("SUCCEEDED");
    expect(m.intent).toHaveBeenCalledTimes(1);
    expect(m.rank).toHaveBeenCalledTimes(1);
    const result = row!.result as { options: { id: string }[] };
    expect(result.options).toHaveLength(2);
    expect(
      await applyShopping(actor, a.id, result.options[0].id, input.draft),
    ).toHaveProperty("subtotalCents");
  });
  it("rejects changed idempotent input, stale drafts and unauthorized recovery", async () => {
    const input = request(),
      a = await reserveShopping(actor, input);
    await expect(
      reserveShopping(actor, { ...input, text: "Different goal" }),
    ).rejects.toMatchObject({ code: "STYLIST_INPUT_CHANGED" });
    await executeShopping(a.id);
    const draft = structuredClone(input.draft);
    draft.items["corner-chair"].color = 2;
    await expect(
      applyShopping(
        actor,
        a.id,
        (row!.result as { options: { id: string }[] }).options[0].id,
        draft,
      ),
    ).rejects.toMatchObject({ code: "STYLIST_STALE" });
    m.db.shoppingStylistRequest.findFirst.mockResolvedValueOnce(null);
    await expect(
      readShopping({ ...actor, actorHash: "another-guest" }, a.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(m.db.shoppingStylistRequest.findFirst).toHaveBeenLastCalledWith({
      where: {
        id: a.id,
        actorHash: "another-guest",
        expiresAt: { gt: expect.any(Date) },
      },
    });
  });
  it("accepts equivalent drafts after Postgres JSONB reorders their object keys", async () => {
    const input = request(),
      a = await reserveShopping(actor, input);
    await executeShopping(a.id);
    const stored = row!.input as unknown as StylistInput;
    stored.draft.items = Object.fromEntries(
      Object.entries(stored.draft.items).reverse(),
    );
    row!.input = stored as unknown as ShoppingStylistRequest["input"];
    const result = row!.result as { options: { id: string }[] };
    await expect(
      applyShopping(actor, a.id, result.options[0].id, input.draft),
    ).resolves.toHaveProperty("subtotalCents");
  });
  it("stops an impossible kept purchase budget before paid inference", async () => {
    const input = request();
    input.keep.push("corner-cabinet");
    const r = await reserveShopping(actor, input);
    await executeShopping(r.id);
    expect(row!.status).toBe("SUCCEEDED");
    expect(row!.result).toMatchObject({ options: [], checked: 0 });
    expect(m.intent).not.toHaveBeenCalled();
    expect(m.rank).not.toHaveBeenCalled();
  });
  it("does not pay again after an interrupted provider response", async () => {
    const r = await reserveShopping(actor, request());
    m.intent.mockRejectedValueOnce(new Error("connection lost"));
    await executeShopping(r.id);
    await executeShopping(r.id);
    expect(row!.status).toBe("SUBMISSION_UNCERTAIN");
    expect(m.intent).toHaveBeenCalledTimes(1);
    expect(m.rank).not.toHaveBeenCalled();
  });
  it("records a known truncated response separately from an uncertain submission without retrying", async () => {
    const r = await reserveShopping(actor, request());
    m.intent.mockRejectedValueOnce(new ShoppingResponseError("SHOPPING_RESPONSE_LENGTH", { finishReason: "length", usage: { completion_tokens: 3000 } }));
    await executeShopping(r.id);
    await executeShopping(r.id);
    expect(row!.status).toBe("FAILED");
    expect(row!.errorCode).toBe("SHOPPING_RESPONSE_LENGTH");
    expect(row!.usage).toMatchObject({ failure: { finishReason: "length", usage: { completion_tokens: 3000 } } });
    expect(m.intent).toHaveBeenCalledTimes(1);
    expect(m.rank).not.toHaveBeenCalled();
  });
  it("checks canonical prices and voice ownership before reserving or applying", async () => {
    m.db.product.findMany.mockResolvedValueOnce([]);
    await expect(reserveShopping(actor, request())).rejects.toMatchObject({
      code: "CATALOG_CHANGED",
    });
    expect(m.intent).not.toHaveBeenCalled();
    await expect(
      reserveShopping(actor, {
        ...request(),
        voiceAttemptId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "VOICE_EXPIRED" });
    expect(m.db.voiceAttempt.findFirst).toHaveBeenCalledWith({
      where: {
        id: expect.any(String),
        actorHash: actor.actorHash,
        purpose: "showroom",
        status: "SUCCEEDED",
        expiresAt: { gt: expect.any(Date) },
      },
    });
  });
  it("rejects model-selected unknown/duplicate options without touching the scene", async () => {
    const r = await reserveShopping(actor, request());
    m.rank.mockResolvedValueOnce({
      value: {
        options: [{ candidateId: "invented", title: "Fake", reason: "Fake" }],
      },
      usage: {},
    });
    await executeShopping(r.id);
    expect(row!.status).toBe("FAILED");
    expect(row!.result).toBeNull();
  });
});
