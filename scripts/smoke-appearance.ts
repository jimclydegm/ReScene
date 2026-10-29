// Explicit QA clone of an authorized scene. Copies saved assets, submits no inference.
import dotenv from "dotenv"; dotenv.config({ path: ".env.local", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { getDb } from "../src/lib/db";
import { readLimited, putObject, storagePrefix } from "../src/lib/storage/r2";
import { updateAppearance } from "../src/lib/services/appearance";
import { workspace } from "../src/lib/services/generation";
import { inspectGlb } from "../src/lib/ai/glb";
import type { Prisma } from "../src/generated/prisma/client";
const db = getDb(), json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const source = await db.scene.findUniqueOrThrow({ where: { id: process.env.APPEARANCE_SOURCE_SCENE! }, include: { sourceAsset: true, normalizedAsset: true,
  objects: { include: { model: true, mask: true }, where: { modelAssetId: { not: null } } } } });
const qa = await db.scene.findUniqueOrThrow({ where: { id: "a7a84a20-7295-4082-bfd9-1e2968b48241" } });
const copy = process.env.APPEARANCE_QA_SCENE ? await db.scene.findUniqueOrThrow({ where: { id: process.env.APPEARANCE_QA_SCENE } }) : await db.scene.create({ data: { ownerId: qa.ownerId, title: "Photo textures — chair, cabinet and vase QA", status: "READY", stage: json(source.stage), camera: json(source.camera), settings: json(source.settings) } });
async function asset(a: NonNullable<typeof source.normalizedAsset>) {
  const id = randomUUID(), key = `${storagePrefix()}/scenes/${copy.id}/appearance-qa/${id}`;
  await putObject(key, await readLimited(a.storageKey, 40 * 1024 * 1024), a.mimeType);
  await db.asset.create({ data: { id, sceneId: copy.id, kind: a.kind, status: "READY", bucket: a.bucket, storageKey: key, mimeType: a.mimeType,
    width: a.width, height: a.height, byteSize: a.byteSize, sha256: a.sha256, readyAt: new Date() } }); return id;
}
try {
  if (!process.env.APPEARANCE_QA_SCENE) {
  await db.scene.update({ where: { id: copy.id }, data: { sourceAssetId: await asset(source.sourceAsset!), normalizedAssetId: await asset(source.normalizedAsset!) } });
  for (const o of source.objects) await db.sceneObject.create({ data: { sceneId: copy.id, sourceOrdinal: o.sourceOrdinal, sortOrder: o.sortOrder, label: o.label, category: o.category,
    status: "READY", representation: "MESH", imageBounds: json(o.imageBounds), maskAssetId: await asset(o.mask!), modelAssetId: await asset(o.model!),
    positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ, rotationX: o.rotationX, rotationY: o.rotationY, rotationZ: o.rotationZ, rotationW: o.rotationW,
    scaleX: o.scaleX, scaleY: o.scaleY, scaleZ: o.scaleZ, initialTransform: json(o.initialTransform), provenance: json(o.provenance) } });
  }
  const before = await workspace(copy.id, copy.ownerId);
  const t = Date.now();
  await updateAppearance(copy.id, copy.ownerId, { action: "APPLY", expectedRevision: before.revision });
  let after = await workspace(copy.id, copy.ownerId);
  assert(after.appearance.applied && after.appearance.floorUrl && after.appearance.wallUrl);
  assert.deepEqual(after.objects.map(o => o.placement), before.objects.map(o => o.placement));
  await assert.rejects(updateAppearance(copy.id, copy.ownerId, { action: "RESTORE", expectedRevision: before.revision }));
  await assert.rejects(updateAppearance(copy.id, randomUUID(), { action: "RESTORE", expectedRevision: after.revision }));
  const lights = { key: { position: [-4, 6, 7] as [number, number, number], intensity: 1.1 }, fill: { position: [5, 3, 3] as [number, number, number], intensity: 0.3 }, ambient: 1 };
  await updateAppearance(copy.id, copy.ownerId, { action: "LIGHTING", expectedRevision: after.revision, lighting: lights });
  after = await workspace(copy.id, copy.ownerId); assert.deepEqual(after.lighting, lights);
  const model = await db.sceneObject.findFirstOrThrow({ where: { sceneId: copy.id, modelAssetId: { not: null } }, include: { model: true } });
  inspectGlb(await readLimited(model.model!.storageKey, 40 * 1024 * 1024));
  await updateAppearance(copy.id, copy.ownerId, { action: "RESTORE", expectedRevision: after.revision });
  after = await workspace(copy.id, copy.ownerId);
  assert(!after.appearance.applied && !after.appearance.floorUrl); assert.deepEqual(after.lighting, lights);
  // Leave the QA copy textured for browser comparison. All source meshes remain unchanged.
  await updateAppearance(copy.id, copy.ownerId, { action: "APPLY", expectedRevision: after.revision });
  await writeFile("test-results/appearance-qa.json", JSON.stringify({ sceneId: copy.id, base: "http://localhost:3000" }), { mode: 0o600 });
  console.log(JSON.stringify({ sceneId: copy.id, savedTextures: true, exactGeometryPreserved: true, lightingPersists: true, staleAndOwnershipRejected: true, restorePassed: true, milliseconds: Date.now() - t }));
} finally { await db.$disconnect(); }
