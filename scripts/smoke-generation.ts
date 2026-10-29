// Explicit integration runner. start/reconstruct consume inference; status/save do not.
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const phase = process.argv[2] ?? "status";
const file = process.env.GENERATION_QA_FILE ?? "test-results/generation-qa.json";
const qa = JSON.parse(await readFile(process.env.QA_CREDENTIAL_FILE!, "utf8"));
const cookies = new Map<string, string>();
async function request(path: string, method = "GET", body?: unknown, origin = base) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Origin: origin,
    Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0], at = pair.indexOf("="); if (at > 0) cookies.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function ok(path: string, method = "GET", body?: unknown) {
  const result = await request(path, method, body);
  assert(result.status < 300, `${path}: HTTP ${result.status}, ${result.data?.error?.code ?? "unknown"}`);
  return result.data;
}
type State = { sceneId: string; analysisKey: string; reconstructKey: string; base: string };
let state: State;
await ok("/api/auth/sign-in/email", "POST", qa.owner);
if (phase === "prepare") {
  const scene = await ok("/api/scenes", "POST", { title: "Bedroom — live Meta generation QA" });
  state = { sceneId: scene.scene.id, analysisKey: randomUUID(), reconstructKey: randomUUID(), base };
  await writeFile(file, JSON.stringify(state), { mode: 0o600 });
  const image = await readFile("test-results/inputs/bedroom-test-wide.png");
  const upload = await ok(`/api/scenes/${state.sceneId}/uploads`, "POST", { expectedRevision: 0, contentType: "image/png", byteSize: image.length });
  assert.equal((await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: image })).status, 200);
  await ok(`/api/scenes/${state.sceneId}/uploads/${upload.assetId}/complete`, "POST", { expectedRevision: 0 });
  console.log(JSON.stringify({ prepared: state.sceneId }));
} else {
  state = JSON.parse(await readFile(file, "utf8"));
  assert.equal(state.base, base);
  const path = `/api/scenes/${state.sceneId}`;
  let workspace = await ok(`${path}/workspace`);
  if (phase === "start" || phase === "reconstruct") {
    const body = { kind: phase === "start" ? "ANALYZE" : "RECONSTRUCT", expectedRevision: workspace.revision,
      idempotencyKey: phase === "start" ? state.analysisKey : state.reconstructKey,
      ...(phase === "reconstruct" ? { objectIds: workspace.objects.filter((o: { maskUrl: string | null }) => o.maskUrl).map((o: { id: string }) => o.id) } : {}) };
    const first = await ok(`${path}/runs`, "POST", body);
    const repeat = await ok(`${path}/runs`, "POST", body);
    assert.equal(first.runId, repeat.runId, "Idempotency must return the same run");
    console.log(JSON.stringify({ phase, idempotent: true, runId: first.runId }));
  } else if (phase === "save") {
    const edits = workspace.objects.filter((o: { modelUrl: string | null }) => o.modelUrl).map((o: Record<string, unknown>) => ({
      id: o.id, label: o.label, positionX: Number(o.positionX) + 0.2, positionY: o.positionY, positionZ: o.positionZ,
      yaw: o.yaw, scale: o.scale, visible: o.visible
    }));
    assert(edits.length > 0, "No real models to save");
    await ok(`${path}/objects`, "PATCH", { expectedRevision: workspace.revision, objects: edits });
    assert.equal((await request(`${path}/objects`, "PATCH", { expectedRevision: workspace.revision, objects: edits })).status, 409);
    const reloaded = await ok(`${path}/workspace`);
    assert.equal(reloaded.objects.find((o: { id: string }) => o.id === edits[0].id).positionX, edits[0].positionX);
    assert.equal((await request(`${path}/objects`, "PATCH", { expectedRevision: reloaded.revision, objects: edits }, "https://untrusted.example")).status, 403);
    cookies.clear(); await ok("/api/auth/sign-in/email", "POST", qa.other);
    assert.equal((await request(`${path}/workspace`)).status, 404);
    assert.equal((await request(`${path}/objects`, "PATCH", { expectedRevision: reloaded.revision, objects: edits })).status, 404);
    console.log("Model edits persist; stale revision, cross-origin, and second-account access denied.");
  }
  workspace = await ok(`${path}/workspace`).catch(() => null);
  if (workspace) console.log(JSON.stringify({ sceneId: state.sceneId, revision: workspace.revision, sceneStatus: workspace.status,
    objects: workspace.objects.map((o: { id: string; label: string; maskUrl: string | null; modelUrl: string | null }) => ({ id: o.id, label: o.label, mask: Boolean(o.maskUrl), model: Boolean(o.modelUrl) })), run: workspace.run }, null, 2));
}
