// Explicit --live submits paid inference. Without it, tests local upload/ownership only.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.JUDGE_BASE_URL ?? "http://127.0.0.1:4317";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const call = (p, body) =>
  fetch(base + p, {
    ...(body
      ? {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json", Origin: base },
        }
      : {}),
    signal: AbortSignal.timeout(60000),
  });
await mkdir(".judge/proof", { recursive: true });
let state;
try {
  state = JSON.parse(await readFile(".judge/proof/run.json", "utf8"));
} catch {
  const r = await call("/api/scenes", {
    title: "Local judge reconstruction proof",
  });
  const b = await r.json();
  assert.equal(r.status, 201, JSON.stringify(b));
  state = { scene: b.scene.id };
  await writeFile(".judge/proof/run.json", JSON.stringify(state), {
    mode: 0o600,
  });
}
let ws = await (await call(`/api/scenes/${state.scene}/workspace`)).json();
if (!ws.image) {
  const image = await readFile("public/demo/expansion/line-oak-chair.webp");
  const r = await call(`/api/scenes/${state.scene}/uploads`, {
    contentType: "image/webp",
    byteSize: image.length,
    expectedRevision: ws.revision,
  });
  const upload = await r.json();
  assert.equal(r.status, 201, JSON.stringify(upload));
  const put = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: image,
  });
  assert.equal(put.status, 200);
  const done = await call(
    `/api/scenes/${state.scene}/uploads/${upload.assetId ?? upload.id}/complete`,
    { expectedRevision: ws.revision },
  );
  assert.equal(done.status, 200, await done.text());
  ws = await (await call(`/api/scenes/${state.scene}/workspace`)).json();
}
assert.equal((await fetch(ws.image.url)).status, 200);
assert.equal(
  (await fetch(ws.image.url.replace(/sig=[a-f0-9]+/, "sig=" + "0".repeat(64))))
    .status,
  404,
);
console.log(
  "Isolated local create/upload/normalize/read/signature guards pass.",
);
if (process.argv.includes("--live")) {
  for (const kind of ["ANALYZE", "RECONSTRUCT"]) {
    ws = await (await call(`/api/scenes/${state.scene}/workspace`)).json();
    if (
      (kind === "ANALYZE" && ws.objects.length) ||
      (kind === "RECONSTRUCT" && ws.objects.some((o) => o.status === "READY"))
    )
      continue;
    const saved = state[kind];
    if (!saved) {
      const r = await call(`/api/scenes/${state.scene}/runs`, {
        kind,
        expectedRevision: ws.revision,
        idempotencyKey: crypto.randomUUID(),
      });
      const b = await r.json();
      assert.equal(r.status, 202, JSON.stringify(b));
      state[kind] = b.runId;
      await writeFile(".judge/proof/run.json", JSON.stringify(state), {
        mode: 0o600,
      });
    }
    let lastStage = "";
    for (let i = 0; i < 675; i++) {
      ws = await (await call(`/api/scenes/${state.scene}/workspace`)).json();
      if (ws.run?.stage !== lastStage) {
        lastStage = ws.run?.stage ?? "";
        console.log(`${kind}: ${lastStage}`);
      }
      if (["SUCCEEDED", "PARTIAL", "FAILED"].includes(ws.run?.status)) break;
      await new Promise((r) => setTimeout(r, 4000));
    }
    assert(
      ["SUCCEEDED", "PARTIAL"].includes(ws.run?.status),
      JSON.stringify({
        phase: kind,
        status: ws.run?.status,
        error: ws.run?.errorCode,
      }),
    );
    console.log(`${kind}: ${ws.run.status}; ${ws.objects.length} objects.`);
  }
  assert(ws.objects.some((o) => o.status === "READY" && o.modelUrl));
  console.log(
    "Fresh local Meta/SAM/fal reconstruction and persisted workspace pass.",
  );
}
