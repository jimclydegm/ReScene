/** One bounded real Spark request with a persisted key; subsequent runs reuse the result. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { getDb } from "../src/lib/db";
import { demoScenes, initialArrangement } from "../src/lib/demo/scenes";
import { findDemoProduct } from "../src/lib/demo/catalog";
import {
  reserveShopping,
  executeShopping,
  readShopping,
  applyShopping,
} from "../src/lib/services/shopping-stylist";
import {
  shoppingResultSchema,
  type StylistInput,
} from "../src/lib/shopping/contracts";
import { merchandiseTotal } from "../src/lib/shopping/engine";
import { editHistory, recordEdit, undoEdit } from "../src/lib/editor/history";
const db = getDb(),
  file = "test-results/demo-expansion-v1/stylist-live.json";
type Proof = {
  actor: { actorHash: string; networkHash: string };
  input: StylistInput;
  id?: string;
};
let proof: Proof;
try {
  proof = JSON.parse(await readFile(file, "utf8"));
} catch {
  const scene = demoScenes.find((s) => s.id === "workspace")!,
    draft = initialArrangement(scene);
  draft.items["workspace-item-2"].owned = true;
  draft.items["workspace-item-3"].owned = true;
  proof = {
    actor: {
      actorHash: createHash("sha256").update(randomUUID()).digest("hex"),
      networkHash: createHash("sha256")
        .update("rescene-curated-stylist-verification")
        .digest("hex"),
    },
    input: {
      key: randomUUID(),
      sceneId: scene.id,
      selected: "workspace-item-4",
      keep: ["workspace-item-1"],
      budgetCents: 10000,
      text: "Keep the tumbler. Suggest two different wireless mice that coordinate with a warm natural wood desk. Keep the merchandise subtotal at or below $100. The laptop and notebook are already owned.",
      draft,
    },
  };
  await writeFile(file, JSON.stringify(proof, null, 2), { mode: 0o600 });
}
try {
  if (!proof.id) {
    const row = await reserveShopping(proof.actor, proof.input);
    proof.id = row.id;
    await writeFile(file, JSON.stringify(proof, null, 2), { mode: 0o600 });
  }
  await executeShopping(proof.id);
  const row = await readShopping(proof.actor, proof.id);
  assert.equal(row.status, "SUCCEEDED", row.errorCode ?? row.phase);
  const result = shoppingResultSchema.parse(row.result);
  assert.equal(result.options.length, 2);
  const mouseIds = new Set<string>();
  for (const option of result.options) {
    assert(option.subtotalCents <= 10000);
    assert.equal(option.subtotalCents, merchandiseTotal(option.draft));
    const mouse = option.draft.items["workspace-item-4"].productId!;
    mouseIds.add(mouse);
    assert.equal(findDemoProduct(mouse)?.role, "mouse");
    for (const id of [
      "workspace-item-1",
      "workspace-item-2",
      "workspace-item-3",
    ])
      assert.deepEqual(option.draft.items[id], {
        ...proof.input.draft.items[id],
        productId: id,
      });
    const applied = await applyShopping(
      proof.actor,
      proof.id,
      option.id,
      proof.input.draft,
    );
    const history = recordEdit(
      editHistory(proof.input.draft),
      applied.draft,
      null,
    );
    assert.equal(history.past.length, 1);
    assert.deepEqual(undoEdit(history).present, proof.input.draft);
  }
  assert.equal(
    mouseIds.size,
    2,
    "The shopper asked for different mice, not only different tints.",
  );
  const duplicate = await reserveShopping(proof.actor, proof.input);
  assert.equal(duplicate.id, proof.id);
  await writeFile(
    "test-results/demo-expansion-v1/stylist-readiness.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        result,
        oneStepUndo: true,
        duplicateReused: true,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      status: "SUCCEEDED",
      options: result.options.map((o) => ({
        title: o.title,
        subtotalCents: o.subtotalCents,
        mouse: findDemoProduct(o.draft.items["workspace-item-4"].productId!)!
          .name,
      })),
      checks:
        "Exact budget, two distinct meshes, preserved owned/kept pieces, Apply, one-step Undo and duplicate receipt reuse",
    }),
  );
} finally {
  await db.$disconnect();
}
