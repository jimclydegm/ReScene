// Uses existing QA objects only. No inference calls or new accounts; restores the starting transforms.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import type { SceneWorkspace, SceneObjectView } from "../src/components/scene/types";
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const qa = JSON.parse(await readFile(process.env.QA_CREDENTIAL_FILE!, "utf8"));
const state = JSON.parse(await readFile(process.env.GENERATION_QA_FILE ?? "test-results/generation-qa.json", "utf8"));
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
const path = `/api/scenes/${state.sceneId}`;
const load = () => ok(`${path}/workspace`) as Promise<SceneWorkspace>;
const transforms = (objects: SceneObjectView[]) => objects.map(o => ({ id: o.id, positionX: o.positionX, positionY: o.positionY,
  positionZ: o.positionZ, yaw: o.yaw, scale: o.scale, placement: o.placement }));
await ok("/api/auth/sign-in/email", "POST", qa.owner);
const before = await load();
assert.equal(before.status, "READY");
let applied = false;
try {
  await ok(`${path}/composition`, "POST", { action: "MATCH_PHOTO", expectedRevision: before.revision }); applied = true;
  const matched = await load();
  assert.equal(matched.revision, before.revision + 1);
  assert.equal(matched.composition?.version, "sam3d-room-v1");
  assert.equal(matched.composition.camera.aspect, matched.image!.width / matched.image!.height);
  assert(matched.canRestoreLayout && matched.objects.every(o => !o.modelUrl || o.placement?.version === "sam3d-layout-v1"));
  assert(matched.composition.projectionError < 0.12, "Saved QA poses do not match their photo rectangles");
  const heights = matched.objects.filter(o => o.placement).map(o => o.placement!.size[1]);
  assert(Math.max(...heights) / Math.min(...heights) > 1.4, "Objects were independently resized to the same height");
  assert.equal((await request(`${path}/composition`, "POST", { action: "MATCH_PHOTO", expectedRevision: before.revision })).status, 409);
  assert.equal((await request(`${path}/composition`, "POST", { action: "MATCH_PHOTO", expectedRevision: matched.revision }, "https://untrusted.example")).status, 403);
  const edits = matched.objects.filter(o => o.modelUrl).map(o => ({ id: o.id, label: o.label, positionX: o.positionX, positionY: o.positionY,
    positionZ: o.positionZ, yaw: o.yaw + 0.1, scale: 1.1, visible: o.visible }));
  await ok(`${path}/objects`, "PATCH", { expectedRevision: matched.revision, objects: edits });
  const edited = await load();
  assert.deepEqual(edited.objects.map(o => o.placement), matched.objects.map(o => o.placement), "An edit destroyed the imported full rotation/scale");
  assert.equal(edited.objects[0].scale, 1.1);
  const page = await fetch(`${base}/scenes/${state.sceneId}`, { headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } });
  const html = await page.text();
  assert.equal(page.status, 200);
  assert(html.includes("Expand reference photo") && html.includes("Close reference photo") && html.includes("Match photo layout"), "Reference/editor controls missing from the page");
  cookies.clear(); await ok("/api/auth/sign-in/email", "POST", qa.other);
  assert.equal((await request(`${path}/composition`, "POST", { action: "MATCH_PHOTO", expectedRevision: edited.revision })).status, 404);
  assert.equal((await request(`${path}/composition`, "POST", { action: "RESTORE", expectedRevision: edited.revision })).status, 404);
  console.log(JSON.stringify({ matched: true, commonScale: true, basePosePreservedAfterSave: true, referenceControlsRendered: true,
    projectionError: matched.composition.projectionError, staleRevisionRejected: true, crossOriginRejected: true, secondAccountRejected: true }));
} finally {
  cookies.clear(); await ok("/api/auth/sign-in/email", "POST", qa.owner);
  if (applied) {
    const current = await load();
    await ok(`${path}/composition`, "POST", { action: "RESTORE", expectedRevision: current.revision });
    const restored = await load();
    assert.deepEqual(transforms(restored.objects), transforms(before.objects));
    assert.deepEqual(restored.composition, before.composition);
    assert.equal(restored.canRestoreLayout, false);
    console.log("Previous composition and object transforms restored exactly.");
  }
}
