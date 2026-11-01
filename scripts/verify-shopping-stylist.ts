/** Read-only by default. --live makes one recoverable two-stage Spark request, never mesh/image generation. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { demoProducts } from "../src/lib/demo/catalog";
import models from "../src/lib/demo/catalog-models.json";
import { demoScenes, initialArrangement } from "../src/lib/demo/scenes";
import { shoppingResultSchema } from "../src/lib/shopping/contracts";
import { merchandiseTotal } from "../src/lib/shopping/engine";
import type { Prisma } from "../src/generated/prisma/client";
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:4317";
let cookie = "";
async function call(path: string, options: RequestInit = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { Cookie: cookie, ...options.headers },
    signal: AbortSignal.timeout(30000),
  });
  const c = response.headers
    .getSetCookie()
    .find((c) => c.includes("rescene-voice="));
  if (c) cookie = c.split(";")[0];
  return response;
}
const post = (path: string, body: unknown) =>
  call(path, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const root = "/api/voice/stylist";
assert.equal(
  (
    await call(root, {
      method: "POST",
      headers: { Origin: "https://untrusted.example" },
    })
  ).status,
  403,
);
assert.equal((await post(root, {})).status, 400);
assert.equal(
  (await call(root + "/00000000-0000-4000-8000-000000000001")).status,
  404,
);
for (const p of demoProducts) {
  const response = await call(`/demo/product/${p.id}`);
  assert.equal(response.status, 200);
  assert((await response.text()).includes(p.name), p.id);
}
for (const id of [
  "sol-ceramic-lamp",
  "cove-accent-chair",
  "terra-side-table",
]) {
  const m = models.find((m) => m.id === id)!;
  assert(m);
  const r = await call(`/api/demo/assets/${id}?v=${m.digest.slice(0, 12)}`);
  assert.equal(r.status, 200);
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), m.digest);
  assert.equal(bytes.length, m.bytes);
}
console.log(
  "Fourteen product pages, three newly curated model hashes and stylist origin/input/guest guards pass.",
);
if (process.argv.includes("--replay")) {
  const saved = JSON.parse(
    await readFile("test-results/stylist/live-http.json", "utf8"),
  );
  const input = { ...saved.input, key: crypto.randomUUID() };
  // Exercise deployed workflow dispatch with an impossible kept budget: zero model calls.
  const r = await post(root, {
    ...input,
    key: crypto.randomUUID(),
    budgetCents: 1,
    text: "Keep the selected chair within a one-cent budget.",
  });
  const reservation = await r.json();
  assert.equal(r.status, 202, JSON.stringify(reservation));
  let preflight;
  for (let i = 0; i < 60; i++) {
    preflight = await (await call(`${root}/${reservation.id}`)).json();
    if (
      ["SUCCEEDED", "FAILED", "SUBMISSION_UNCERTAIN"].includes(preflight.status)
    )
      break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(
    preflight.status,
    "SUCCEEDED",
    preflight.error ?? preflight.phase,
  );
  assert.equal(preflight.result.options.length, 0);
  assert.equal(preflight.result.checked, 0);
  const { getDb } = await import("../src/lib/db");
  const { shoppingCatalogRevision } = await import(
    "../src/lib/services/shopping-stylist"
  );
  const { canonicalJson } = await import("../src/lib/shopping/canonical");
  const db = getDb();
  try {
    const actor = await db.shoppingStylistRequest.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.deepEqual(actor.usage, {});
    const source = await db.shoppingStylistRequest.findUniqueOrThrow({
      where: { id: saved.id },
    });
    assert.equal(source.status, "SUCCEEDED");
    const result = shoppingResultSchema.parse(source.result),
      revision = shoppingCatalogRevision();
    const row = await db.shoppingStylistRequest.create({
      data: {
        actorHash: actor.actorHash,
        networkHash: actor.networkHash,
        requestKey: input.key,
        inputHash: createHash("sha256")
          .update(canonicalJson(input))
          .digest("hex"),
        catalogRevision: revision,
        input: input as Prisma.InputJsonValue,
        intent: source.intent as Prisma.InputJsonValue,
        status: "SUCCEEDED",
        phase: "READY",
        result: {
          ...result,
          catalogRevision: revision,
        } as Prisma.InputJsonValue,
        usage: { reusedPaidResult: true },
        expiresAt: new Date(Date.now() + 15 * 60000),
      },
    });
    const duplicate = await post(root, input);
    assert.equal(duplicate.status, 202);
    assert.equal((await duplicate.json()).id, row.id);
    for (const option of result.options) {
      const applied = await post(`${root}/${row.id}`, {
        optionId: option.id,
        draft: input.draft,
      });
      const body = await applied.json();
      assert.equal(applied.status, 200, JSON.stringify(body));
      assert.deepEqual(body.draft, option.draft);
      assert.equal(merchandiseTotal(body.draft), option.subtotalCents);
    }
    const altered = structuredClone(input.draft);
    altered.items["corner-chair"].color = 1;
    assert.equal(
      (
        await post(`${root}/${row.id}`, {
          optionId: result.options[0].id,
          draft: altered,
        })
      ).status,
      409,
    );
    cookie = "";
    assert.equal((await call(`${root}/${row.id}`)).status, 404);
    console.log(
      JSON.stringify({
        workflow: "zero-inference budget preflight passed",
        reusedOptions: result.options.map((o) => ({
          title: o.title,
          subtotalCents: o.subtotalCents,
        })),
        checks:
          "HTTP Apply, duplicate reservation, stale draft and cross-guest isolation passed; no paid resubmission or merchant-scene mutation",
      }),
    );
  } finally {
    await db.$disconnect();
  }
}
if (process.argv.includes("--live")) {
  const scene = demoScenes.find((s) => s.id === "corner")!,
    input = {
      key: crypto.randomUUID(),
      sceneId: "corner",
      text: "Keep this chair. Make this corner warmer, and keep the merchandise subtotal under $500.",
      budgetCents: 50000,
      selected: "corner-chair",
      keep: ["corner-chair"],
      draft: initialArrangement(scene),
    };
  const started = await post(root, input),
    data = await started.json();
  assert.equal(started.status, 202, JSON.stringify(data));
  const duplicate = await post(root, input);
  assert.equal(duplicate.status, 202);
  assert.equal((await duplicate.json()).id, data.id);
  let state:
    | { status: string; phase: string; error: string; result: unknown }
    | undefined;
  for (let i = 0; i < 100; i++) {
    const response = await call(`${root}/${data.id}`);
    assert.equal(response.status, 200);
    state = await response.json();
    if (["SUCCEEDED", "FAILED", "SUBMISSION_UNCERTAIN"].includes(state!.status))
      break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  await mkdir("test-results/stylist", { recursive: true });
  await writeFile(
    "test-results/stylist/live-http.json",
    JSON.stringify({ id: data.id, input, state }, null, 2),
  );
  assert.equal(state?.status, "SUCCEEDED", state?.error ?? state?.phase);
  const result = shoppingResultSchema.parse(state.result);
  assert.equal(result.options.length, 2);
  for (const option of result.options) {
    assert(option.subtotalCents < 50000);
    assert.equal(option.subtotalCents, merchandiseTotal(option.draft));
    assert.equal(option.draft.items["corner-chair"].productId, "corner-chair");
    const applied = await post(`${root}/${data.id}`, {
      optionId: option.id,
      draft: input.draft,
    });
    assert.equal(applied.status, 200);
    assert.deepEqual((await applied.json()).draft, option.draft);
  }
  const altered = structuredClone(input.draft);
  altered.items["corner-chair"].color = 1;
  assert.equal(
    (
      await post(`${root}/${data.id}`, {
        optionId: result.options[0].id,
        draft: altered,
      })
    ).status,
    409,
  );
  const old = cookie;
  cookie = "";
  assert.equal((await call(`${root}/${data.id}`)).status, 404);
  cookie = old;
  console.log(
    JSON.stringify({
      live: "Spark intent and ranking passed",
      options: result.options.map((o) => ({
        title: o.title,
        subtotalCents: o.subtotalCents,
        changes: o.changes,
      })),
      checks:
        "duplicate reuse, canonical Apply, stale-scene and cross-guest isolation; no merchant-scene mutation",
    }),
  );
}
