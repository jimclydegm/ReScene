// Offline before/after evidence for the coordinated quality pass on saved
// fixture exports (state.json, source.webp, mask-N.png, model files). Reads
// local files only: no database writes, storage writes or inference.
// Usage: node --conditions=react-server --import tsx scripts/quality-evidence.ts <fixture-dir> <out-dir> [original-prefix]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { Quaternion, Vector3 } from "three";
import { runQualityPipeline, inspectionView, referenceView } from "../src/lib/quality/pipeline";
import { modelPlacementSchema, compositionSchema } from "../src/lib/scene/composition";
import type { Placed } from "../src/lib/quality/placement";

const [dir, out, originals] = process.argv.slice(2);
if (!dir || !out) throw new Error("fixture and output directories required");
const state = JSON.parse(readFileSync(`${dir}/state.json`, "utf8"));
if (state.id === "f2848b95-8447-41eb-9544-0d72dd605565") throw new Error("Protected listing fixture");
mkdirSync(out, { recursive: true, mode: 0o700 });
const record = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const composition = compositionSchema.parse(state.stage);
const raw = await sharp(readFileSync(`${dir}/source.webp`)).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
const photo = { data: new Uint8Array(raw.data), width: raw.info.width, height: raw.info.height, channels: 3 as const };
type Row = { id: string; label: string; modelAssetId: string | null; maskAssetId: string | null; provenance: unknown; initialTransform: unknown; positionX: number; positionY: number; positionZ: number; rotationX: number; rotationY: number; rotationZ: number; rotationW: number; scaleX: number };
const rows = (state.objects as Row[]).map((o, i) => ({ o, i })).filter(({ o, i }) => o.modelAssetId && existsSync(`${dir}/mask-${i}.png`));
const objects = await Promise.all(rows.map(async ({ o, i }) => {
  const p = record(o.provenance), file = originals && existsSync(`${originals}-${i}.glb`) ? `${originals}-${i}.glb` : `${dir}/model-${i}.glb`;
  const mask = await sharp(readFileSync(`${dir}/mask-${i}.png`)).greyscale().raw().toBuffer();
  const rootId = typeof p.parentObjectId === "string" ? p.parentObjectId : null, hasChildren = rows.some(r => record(r.o.provenance).parentObjectId === o.id);
  return { id: o.id, label: o.label, bytes: readFileSync(file), mask: new Uint8Array(mask), support: String(p.support ?? "unknown"), supportedById: typeof p.supportedByObjectId === "string" ? p.supportedByObjectId : null, rootId, repairable: !rootId && !hasChildren, plan: null, samples: new Map() };
}));
const placements: Placed[] = rows.filter(({ o }) => !record(o.provenance).parentObjectId).map(({ o }) => {
  const p = modelPlacementSchema.parse(o.initialTransform), q = new Quaternion(o.rotationX, o.rotationY, o.rotationZ, o.rotationW);
  return { id: o.id, position: [o.positionX, o.positionY, o.positionZ], placement: { ...p, rotation: q.clone().multiply(new Quaternion(...p.rotation)).toArray() as [number, number, number, number], offset: new Vector3(...p.offset).multiplyScalar(o.scaleX).applyQuaternion(q).toArray() as [number, number, number], scale: p.scale.map(v => v * o.scaleX) as [number, number, number], size: p.size.map(v => v * o.scaleX) as [number, number, number] } };
});
const started = Date.now(), result = await runQualityPipeline({ objects, placements, composition, photo });
const seconds = (Date.now() - started) / 1000;
const pose = (id: string, list: Placed[]) => list.find(p => p.id === (objects.find(o => o.id === id)!.rootId ?? id))!;
const w = Math.min(800, photo.width), h = Math.round(w * photo.height / photo.width);
const photoSmall = await sharp(Buffer.from(photo.data), { raw: { width: photo.width, height: photo.height, channels: 3 } }).resize(w, h).png().toBuffer();
const beforeRef = await referenceView(objects.map(o => ({ bytes: o.bytes, placement: pose(o.id, placements) })), composition, w, h);
const afterRef = await referenceView(result.objects.map(o => ({ bytes: o.bytes, placement: pose(o.id, result.placements) })), composition, w, h);
await sharp({ create: { width: w * 3, height: h, channels: 3, background: "#ffffff" } }).composite([{ input: photoSmall, left: 0, top: 0 }, { input: beforeRef, left: w, top: 0 }, { input: afterRef, left: w * 2, top: 0 }]).png().toFile(`${out}/reference-photo-before-after.png`);
for (const [index, o] of objects.entries()) {
  const after = result.objects[index].bytes, tiles: { input: Buffer; left: number; top: number }[] = [];
  for (const [row, bytes] of [o.bytes, after].entries()) for (const [col, [mode, view]] of ([["wireframe", 0], ["normals", 0], ["unlit", 0], ["unlit", 2], ["unlit", 4], ["unlit", 5], ["neutral", 1]] as const).entries())
    tiles.push({ input: await inspectionView(bytes, mode, view, 256), left: col * 256, top: row * 256 });
  await sharp({ create: { width: 256 * 7, height: 512, channels: 3, background: "#ffffff" } }).composite(tiles).png().toFile(`${out}/object-${index}-before-after.png`);
}
const report = { fixture: state.id, seconds, placement: result.placement, objects: result.objects.map(o => ({ id: o.id, label: objects.find(v => v.id === o.id)!.label, changed: o.changed, reverted: o.reverted, geometry: o.geometry, bake: o.bake, review: o.review,
  diagnostics: { before: { ...o.diagnostics.before, findings: o.diagnostics.before.findings.map(f => `${f.layer}:${f.code}=${+f.value.toFixed(4)}`) }, after: { ...o.diagnostics.after, findings: o.diagnostics.after.findings.map(f => `${f.layer}:${f.code}=${+f.value.toFixed(4)}`) } } })) };
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1), { mode: 0o600 });
console.log(JSON.stringify({ seconds, placement: { accepted: result.placement.accepted, moved: result.placement.moved.length }, objects: report.objects.map(o => ({ label: o.label, verdict: o.review.verdict, geometry: o.geometry.accepted, ops: o.geometry.operations, iou: [o.review.metrics.iouBefore, o.review.metrics.iou].map(v => +v.toFixed(3)), appearance: [o.review.metrics.appearanceBefore, o.review.metrics.appearanceAfter].map(v => v === null ? null : +v.toFixed(1)), coverage: o.review.metrics.coverage, seams: [o.review.metrics.seamBefore, o.review.metrics.seamAfter], issues: o.review.issues.map(i => i.type) })) }, null, 1));
