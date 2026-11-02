/** Explicit paid local HTTP check with saved key; never starts a second attempt. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { demoScenes, initialArrangement } from "../../src/lib/demo/scenes";
const base = "http://127.0.0.1:4317",
  file = ".judge/proof/stylist.json";
let cookie = "";
const call = async (path: string, body?: unknown) => {
  const r = await fetch(base + path, {
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
  });
  const c = r.headers.getSetCookie().find((c) => c.includes("rescene-voice="));
  if (c) cookie = c.split(";")[0];
  return r;
};
let proof;
try {
  proof = JSON.parse(await readFile(file, "utf8"));
  cookie = proof.cookie ?? "";
} catch {
  const scene = demoScenes.find((s) => s.id === "workspace")!,
    draft = initialArrangement(scene);
  draft.items["workspace-item-2"].owned = true;
  draft.items["workspace-item-3"].owned = true;
  proof = {
    input: {
      key: crypto.randomUUID(),
      sceneId: scene.id,
      selected: "workspace-item-4",
      keep: ["workspace-item-1"],
      budgetCents: 10000,
      text: "Keep the tumbler. Suggest two different mice for this warm wood desk within $100. The laptop and notebook are owned.",
      draft,
    },
  };
}
if (!proof.id) {
  const r = await call("/api/voice/stylist", proof.input);
  const b = await r.json();
  assert.equal(r.status, 202, JSON.stringify(b));
  proof.id = b.id;
  proof.cookie = cookie;
  await writeFile(file, JSON.stringify(proof), { mode: 0o600 });
}
let state;
for (let i = 0; i < 80; i++) {
  state = await (await call(`/api/voice/stylist/${proof.id}`)).json();
  if (["SUCCEEDED", "FAILED", "SUBMISSION_UNCERTAIN"].includes(state.status))
    break;
  await new Promise((r) => setTimeout(r, 2000));
}
assert.equal(state.status, "SUCCEEDED", state.error);
assert.equal(state.result.options.length, 2);
for (const o of state.result.options) {
  assert(o.subtotalCents <= 10000);
  const r = await call(`/api/voice/stylist/${proof.id}`, {
    optionId: o.id,
    draft: proof.input.draft,
  });
  assert.equal(r.status, 200, await r.text());
}
await writeFile(
  ".judge/proof/stylist-result.json",
  JSON.stringify(state.result),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    localRealSpark: true,
    options: state.result.options.map(
      (o: { subtotalCents: number }) => o.subtotalCents,
    ),
    httpApply: true,
  }),
);
