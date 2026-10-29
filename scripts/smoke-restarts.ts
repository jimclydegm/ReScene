// Owner-only integration fixture copied from an existing QA scene. No model submissions.
import dotenv from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { getDb } from "../src/lib/db";
import { bucket, storagePrefix, readLimited, putObject } from "../src/lib/storage/r2";
import type { SceneWorkspace } from "../src/components/scene/types";
import type { Prisma } from "../src/generated/prisma/client";
dotenv.config({ path: ".env.local", quiet: true });
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const qa = JSON.parse(await readFile(process.env.QA_CREDENTIAL_FILE!, "utf8"));
const sourceState = JSON.parse(await readFile(process.env.GENERATION_QA_FILE ?? "test-results/generation-production-inline-qa.json", "utf8"));
const db = getDb();
const cookies = new Map<string, string>();
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function request(path: string, method = "GET", body?: unknown, origin = base) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Origin: origin,
    Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0], at = pair.indexOf("="); if (at > 0) cookies.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function ok(path: string, method = "GET", body?: unknown) {
  const r = await request(path, method, body);
  assert(r.status < 300, `${path}: HTTP ${r.status}, ${r.data?.error?.code ?? "unknown"}`); return r.data;
}
await ok("/api/auth/sign-in/email", "POST", qa.owner);
const source = await db.scene.findUniqueOrThrow({ where: { id: sourceState.sceneId }, include: { normalizedAsset: true, sourceAsset: true,
  objects: { include: { mask: true, model: true }, where: { status: "READY" } } } });
const made = await ok("/api/scenes", "POST", { title: "Step restart — isolated QA copy" });
const sceneId = made.scene.id;
const path = `/api/scenes/${sceneId}`;
await writeFile("test-results/restart-qa.json", JSON.stringify({ sceneId, base }), { mode: 0o600 });
const clones = new Map<string, string>();
async function cloneAsset(asset: NonNullable<typeof source.normalizedAsset>) {
  if (clones.has(asset.id)) return clones.get(asset.id)!;
  const id = randomUUID(), key = `${storagePrefix()}/scenes/${sceneId}/restart-qa/${id}`;
  const bytes = await readLimited(asset.storageKey, 40 * 1024 * 1024);
  await putObject(key, bytes, asset.mimeType);
  await db.asset.create({ data: { id, sceneId, kind: asset.kind, status: "READY", bucket: bucket(), storageKey: key,
    mimeType: asset.mimeType, byteSize: bytes.length, sha256: asset.sha256, width: asset.width, height: asset.height,
    readyAt: new Date(), provenance: { source: "restart-qa-copy" } } });
  clones.set(asset.id, id); return id;
}
try {
  const sourceId = await cloneAsset(source.sourceAsset!);
  const normalizedId = await cloneAsset(source.normalizedAsset!);
  await db.scene.update({ where: { id: sceneId }, data: { sourceAssetId: sourceId, normalizedAssetId: normalizedId, status: "READY", revision: 1,
    camera: json(source.camera), stage: json(source.stage), settings: json(source.settings) } });
  for (const o of source.objects) await db.sceneObject.create({ data: { sceneId, sourceOrdinal: o.sourceOrdinal, label: o.label, category: o.category,
    status: "READY", representation: "MESH", imageBounds: json(o.imageBounds), maskAssetId: o.mask ? await cloneAsset(o.mask) : null,
    modelAssetId: o.model ? await cloneAsset(o.model) : null, positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ,
    rotationX: o.rotationX, rotationY: o.rotationY, rotationZ: o.rotationZ, rotationW: o.rotationW, scaleX: o.scaleX, scaleY: o.scaleY, scaleZ: o.scaleZ,
    initialTransform: json(o.initialTransform), provenance: json(o.provenance) } });
  const oldRun = await db.generationRun.create({ data: { sceneId, kind: "RECONSTRUCT", status: "FAILED", inputRevision: 1, idempotencyKey: randomUUID(),
    errorCode: "KNOWN_JOB_INTERRUPTED", reservedCostUsd: 0, input: { qaFixture: true }, expiresAt: new Date(Date.now() + 600_000) } });
  const load = () => ok(`${path}/workspace`) as Promise<SceneWorkspace>;
  const restart = (target: string, revision: number, confirmed = true) => request(`${path}/restart`, "POST", { target, expectedRevision: revision, confirmed });
  const first = await load();
  assert.equal((await restart("RECONSTRUCTION", first.revision, false)).status, 400);
  assert.equal((await request(`${path}/restart`, "POST", { target: "PHOTO", expectedRevision: first.revision, confirmed: true }, "https://untrusted.example")).status, 403);
  cookies.clear(); await ok("/api/auth/sign-in/email", "POST", qa.other);
  assert.equal((await restart("PHOTO", first.revision)).status, 404);
  cookies.clear(); await ok("/api/auth/sign-in/email", "POST", qa.owner);
  const active = await db.generationRun.create({ data: { sceneId, kind: "ANALYZE", status: "RUNNING", inputRevision: 1, idempotencyKey: randomUUID(),
    reservedCostUsd: 0, input: { qaFixture: true }, expiresAt: new Date(Date.now() + 600_000) } });
  assert.equal((await restart("PHOTO", first.revision)).status, 409);
  await db.generationRun.update({ where: { id: active.id }, data: { status: "CANCELED" } });
  const concurrent = await Promise.all([restart("RECONSTRUCTION", first.revision), restart("RECONSTRUCTION", first.revision)]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
  let current = await load();
  assert.equal(current.status, "REVIEW"); assert.equal(current.run, null); assert(current.image);
  assert(current.objects.every(o => o.maskUrl && !o.modelUrl && !o.placement));
  assert.equal(current.composition, null); assert.equal(current.canRestoreLayout, false);
  const modelIds = source.objects.filter(o => o.model).map(o => clones.get(o.model!.id)!);
  assert.equal(await db.asset.count({ where: { id: { in: modelIds }, status: "DELETED" } }), modelIds.length);
  assert.equal((await db.generationRun.findUniqueOrThrow({ where: { id: oldRun.id } })).status, "CANCELED");
  assert.equal((await request(`${path}/runs/${oldRun.id}/resume`, "POST", {})).status, 409);
  assert.equal((await request(`${path}/runs`, "POST", { kind: "RECONSTRUCT", expectedRevision: 1, idempotencyKey: oldRun.idempotencyKey, objectIds: first.objects.map(o => o.id) })).status, 409);
  assert.equal((await restart("RECONSTRUCTION", first.revision)).status, 409);
  assert.equal((await restart("ANALYSIS", current.revision)).status, 200);
  current = await load(); assert.equal(current.status, "DRAFT"); assert(current.image); assert.equal(current.objects.length, 0); assert.equal(current.run, null);
  const maskIds = source.objects.filter(o => o.mask).map(o => clones.get(o.mask!.id)!);
  assert.equal(await db.asset.count({ where: { id: { in: maskIds }, status: "DELETED" } }), maskIds.length);
  assert.equal((await restart("PHOTO", current.revision)).status, 200);
  current = await load(); assert.equal(current.image, null); assert.equal(current.objects.length, 0); assert.equal(current.status, "DRAFT");
  assert.equal(await db.asset.count({ where: { id: { in: [...clones.values()] }, status: { not: "DELETED" } } }), 0);
  const file = await readFile("test-results/inputs/bedroom-test-wide.png");
  const upload = await ok(`${path}/uploads`, "POST", { expectedRevision: current.revision, contentType: "image/png", byteSize: file.length });
  assert.equal((await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: file })).status, 200);
  await ok(`${path}/uploads/${upload.assetId}/complete`, "POST", { expectedRevision: current.revision });
  current = await load(); assert(current.image); assert.equal(current.id, sceneId);
  console.log(JSON.stringify({ sceneId, confirmationRequired: true, masksPreservedOn3dRestart: true, analysisClearsObjects: true,
    photoRestartAndReupload: true, laterAssetsInvalidated: true, staleResumeRejected: true, concurrentResetConflict: true,
    activeRunRejected: true, staleRevisionRejected: true, originAndOwnershipRejected: true }));
} finally { await db.$disconnect(); }
