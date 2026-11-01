import sharp from "sharp";
import { Matrix4 } from "three";
import { decodeGlb, readMesh, writeGlb, type MeshDocument } from "./mesh";
import { diagnoseMesh, type MeshDiagnostics } from "./diagnostics";
import { compareGeometry, repairGeometry, type StructuralConstraint } from "./geometry";
import { bakeMaterials, delightPhoto, type MaterialRegion, type Photo, type Coverage } from "./material-bake";
import { evaluatePlacement, placementMatrix, solvePlacement, type ContactEntry, type Placed } from "./placement";
import { boundsOf, maskOverlap, orbitCameras, render, renderMesh, type PixelImage4, type RenderMode } from "./render";
import { appearanceDifference, mergeSparkReview, numericReview, type ObjectReview } from "./review";
import {automaticMaterialTargets,type QualityPlanObservation,type QualityReviewObservation} from "./contracts";
import { photoCamera } from "@/lib/appearance/bake";
import type { SceneComposition } from "@/lib/scene/composition";

// One coordinated pass: diagnose → conservative geometry → joint placement →
// full-surface bake on the accepted mesh at its final pose → review of the
// actual final render → one bounded correction. Pure apart from image codecs;
// the service owns storage, revision guards and paid model calls.
export type PipelineObject = {
  id: string; label: string; bytes: Buffer; mask: Uint8Array; support: string; supportedById: string | null;
  rootId: string | null; repairable: boolean; plan: QualityPlanObservation | null; samples: Map<string, PixelImage4>;
};
export type PipelineInput = { objects: PipelineObject[]; placements: Placed[]; composition: SceneComposition; photo: Photo; spark?: QualityReviewObservation | null; materialOptions?: {textureSize:number;photoStrength:number} };
export type PipelineObjectResult = {
  id: string; bytes: Buffer; changed: boolean; reverted: boolean;
  geometry: { attempted: boolean; accepted: boolean; reasons: string[]; operations: Record<string, number>; skipped: string[] };
  bake: { coverage: Coverage; seams: { edges: number; before: number; after: number } } | { error: string };
  diagnostics: { before: MeshDiagnostics; after: MeshDiagnostics };
  review: ObjectReview;
};

export async function decodeTextures(doc: MeshDocument, targetSize?:number) {
  const out = new Map<number, PixelImage4>(), alpha = new Set<number>();
  for (const [index, roles] of doc.roles) {
    if (!roles.includes("baseColor")) continue;
    const image = doc.json.images[index], view = doc.views[image.bufferView];
    const decoder=sharp(view);
    if(targetSize){if(roles.some(r=>r!=="baseColor"))throw new Error("SHARED_TEXTURE_ROLES");const meta=await sharp(view).metadata();const scale=targetSize/Math.max(meta.width??targetSize,meta.height??targetSize);decoder.resize(Math.max(1,Math.round((meta.width??targetSize)*scale)),Math.max(1,Math.round((meta.height??targetSize)*scale)),{kernel:"lanczos3"});}
    const raw = await decoder.toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (raw.info.width > 4096 || raw.info.height > 4096) throw new Error("TEXTURE_TOO_LARGE");
    const data = new Uint8Array(raw.data); out.set(index, { data, width: raw.info.width, height: raw.info.height });
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { alpha.add(index); break; }
  }
  return { textures: out, alpha };
}
const hex = (value: string): [number, number, number] => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
const box = (b: { x0: number; y0: number; x1: number; y1: number }) => [b.x0, b.y0, b.x1, b.y1] as [number, number, number, number];
export function planConstraints(plan: QualityPlanObservation | null): StructuralConstraint[] {
  // Deformable and organic subjects never get manufactured-surface repair.
  if (!plan || plan.construction === "deformable" || plan.construction === "organic") return [];
  return plan.constraints.map(c => ({ id: c.id, kind: c.kind, box: box(c.evidence), confidence: c.confidence }));
}
export function planRegions(plan: QualityPlanObservation | null, samples: Map<string, PixelImage4>): MaterialRegion[] {
  const clean=new Set(plan?automaticMaterialTargets(plan):[]);
  return (plan?.materials ?? []).filter(m => m.confidence >= .4).map(m => ({ id: m.id, color: hex(m.color), sample: samples.get(m.id) ?? null, tileScale: m.patternScale, grain: m.grain, repeating: m.repeating,evidence:box(m.evidence),preserveProviderDetail:!clean.has(m.id) }));
}

export async function runQualityPipeline(input: PipelineInput) {
  const { composition, photo } = input, size = { width: photo.width, height: photo.height }, camera = photoCamera(composition.camera);
  const placements = structuredClone(input.placements), rootOf = (o: PipelineObject) => o.rootId ?? o.id;
  const sourceDocs = new Map(input.objects.map(o => [o.id, readMesh(o.bytes)]));
  const before = new Map(input.objects.map(o => [o.id, diagnoseMesh(sourceDocs.get(o.id)!)]));
  // 1. Geometry, judged against the previous mesh at the saved pose.
  const geometry = new Map<string, PipelineObjectResult["geometry"] & { bytes: Buffer }>();
  for (const o of input.objects) {
    const pose = placements.find(p => p.id === rootOf(o));
    if (!o.repairable || !pose) { geometry.set(o.id, { attempted: false, accepted: false, reasons: [o.repairable ? "no-pose" : "shared-subject"], operations: {}, skipped: [], bytes: o.bytes }); continue; }
    const evidence = { camera, matrix: placementMatrix(pose), mask: o.mask, width: size.width, height: size.height };
    try {
      const repaired = repairGeometry(o.bytes, { evidence, constraints: planConstraints(o.plan) });
      const verdict = repaired.changed ? compareGeometry(o.bytes, repaired.bytes, evidence,repaired.smoothingImproved) : { accepted: false, reasons: ["no-change"] };
      geometry.set(o.id, { attempted: true, accepted: verdict.accepted, reasons: verdict.reasons, operations: repaired.operations, skipped: repaired.skipped, bytes: verdict.accepted ? repaired.bytes : o.bytes });
    } catch (e) { geometry.set(o.id, { attempted: true, accepted: false, reasons: [e instanceof Error ? e.message.slice(0, 60) : "repair-failed"], operations: {}, skipped: [], bytes: o.bytes }); }
  }
  // 2. Placement on the accepted meshes, jointly with supports and walls.
  const roots = input.objects.filter(o => !o.rootId && placements.some(p => p.id === o.id));
  const placementInputs = roots.map(o => ({ id: o.id, label: o.label, bytes: geometry.get(o.id)!.bytes, mask: o.mask, support: o.support, supportedById: o.supportedById, parentId: null }));
  const solved = solvePlacement(placements, placementInputs, composition, size);
  // 3. Bake every object at its final pose with one shared visibility buffer.
  const world = input.objects.map(o => readMesh(geometry.get(o.id)!.bytes, placementMatrix(placements.find(p => p.id === rootOf(o)) ?? placements[0])));
  const visible = render(world.map((doc, i) => renderMesh(doc, new Matrix4(), i)), camera, size.width, size.height, "depth");
  // No per-object silhouette registration here: the joint placement is already
  // fit to the reference camera, and measured shifts made visible color worse.
  const baked = new Map<string, { bytes: Buffer; result: PipelineObjectResult["bake"] }>();
  for (const [i, o] of input.objects.entries()) {
    const bytes = geometry.get(o.id)!.bytes;
    try {
      const { textures, alpha } = await decodeTextures(world[i],o.samples.size?input.materialOptions?.textureSize:undefined);
      if (!textures.size) throw new Error("BAKE_NO_BASE_COLOR");
      const providerLowFrequency=new Map<number,PixelImage4>();
      if(o.samples.size)for(const [index,image]of textures){const raw=await sharp(Buffer.from(image.data),{raw:{width:image.width,height:image.height,channels:4}}).blur(Math.max(.3,Math.min(32,Math.max(image.width,image.height)/64))).raw().toBuffer();providerLowFrequency.set(index,{...image,data:new Uint8Array(raw)});}
      const result = bakeMaterials({ doc: world[i], textures, object: i, photo, mask: o.mask, camera, visible: { depth: visible.depth, owners: visible.owners, width: size.width, height: size.height },
        providerLowFrequency,photoStrength:o.samples.size?input.materialOptions?.photoStrength:1, regions: planRegions(o.plan, o.samples), protectedBoxes: (o.plan?.protectedDetails ?? []).filter(d => d.confidence >= .5).map(d => box(d.evidence)) });
      const images = new Map<number, { bytes: Buffer; mimeType: string }>();
      for (const [index, image] of result.textures) {
        // Base color stays 8-bit sRGB; alpha is written back only when present.
        const channels = alpha.has(index) ? 4 : 3, data = channels === 4 ? Buffer.from(image.data) : Buffer.from(image.data.filter((_, k) => k % 4 !== 3));
        images.set(index, { bytes: await sharp(data, { raw: { width: image.width, height: image.height, channels } }).png({ compressionLevel: 9 }).toBuffer(), mimeType: "image/png" });
      }
      baked.set(o.id, { bytes: writeGlb(decodeGlb(bytes), { images }), result: { coverage: result.coverage, seams: result.seams } });
    } catch (e) { baked.set(o.id, { bytes, result: { error: e instanceof Error ? e.message.slice(0, 80) : "bake-failed" } }); }
  }
  // 4. Review the actual final output from the reference camera.
  const evaluate = async (bytesOf: (o: PipelineObject) => Buffer, poses: Placed[]) => {
    const w = Math.min(640, size.width), h = Math.round(w * size.height / size.width), meshes = await Promise.all(input.objects.map(async (o, i) => {
      const doc = readMesh(bytesOf(o), placementMatrix(poses.find(p => p.id === rootOf(o)) ?? poses[0])); return renderMesh(doc, new Matrix4(), i, (await decodeTextures(doc)).textures);
    }));
    return { frame: render(meshes, camera, w, h, "unlit"), w, h };
  };
  // Both sides use the final pose, so a model revert answers only for the
  // model; placement changes are judged by the placement solver.
  const delit = delightPhoto(photo, input.objects.reduce((m, o) => { for (let i = 0; i < m.length; i++) if (o.mask[i] > 127) m[i] = 255; return m; }, new Uint8Array(size.width * size.height))).rgb;
  const [first, last] = await Promise.all([evaluate(o => o.bytes, placements), evaluate(o => baked.get(o.id)!.bytes, placements)]);
  const contacts = new Map<string, ContactEntry>(solved.after.map(c => [c.id, c]));
  const reviews = input.objects.map((o, i) => {
    const mask = maskOverlap(last.frame.owners, last.w, last.h, o.mask, size.width, size.height, i), area = o.mask.reduce((s, v) => s + Number(v > 127), 0) * last.w * last.h / (size.width * size.height);
    const g = geometry.get(o.id)!, b = baked.get(o.id)!.result;
    return numericReview({ id: o.id, label: o.label, iou: mask.iou, iouBefore: maskOverlap(first.frame.owners, first.w, first.h, o.mask, size.width, size.height, i).iou, occluded: area ? mask.occluded / area : 0,
      appearanceBefore: appearanceDifference(first.frame.rgb, first.frame.owners, first.w, first.h, delit, o.mask, size.width, size.height, i),
      appearanceAfter: appearanceDifference(last.frame.rgb, last.frame.owners, last.w, last.h, delit, o.mask, size.width, size.height, i),
      coverage: "coverage" in b ? b.coverage : null, seams: "seams" in b ? b.seams : null, contact: contacts.get(rootOf(o)) ?? null, geometryRejected: g.attempted && !g.accepted && !g.reasons.includes("no-change") ? g.reasons : [] });
  });
  // 5. One bounded correction: revert objects whose own result regressed.
  const accepted = input.spark ? mergeSparkReview(reviews, input.spark, input.objects.map(o => o.id)) : new Map();
  const revert = new Set(reviews.filter(r => r.issues.some(i => i.source === "numeric" && i.severity === "error" && i.correction === "revert-object")).map(r => r.id));
  for (const [id, correction] of accepted) if (correction === "revert-object") revert.add(id);
  for (const r of reviews) if (revert.has(r.id)) { r.issues.push({ type: "reverted", severity: "info", value: 0, detail: "Previous model kept for this object after review.", source: "numeric", correction: "none" }); if (r.verdict === "REJECT") r.verdict = "NEEDS_REVIEW"; }
  const objects: PipelineObjectResult[] = input.objects.map(o => {
    const reverted = revert.has(o.id), bytes = reverted ? o.bytes : baked.get(o.id)!.bytes, g = geometry.get(o.id)!;
    return { id: o.id, bytes, changed: !bytes.equals(o.bytes), reverted, geometry: { attempted: g.attempted, accepted: g.accepted && !reverted, reasons: g.reasons, operations: g.operations, skipped: g.skipped },
      bake: baked.get(o.id)!.result, diagnostics: { before: before.get(o.id)!, after: diagnoseMesh(readMesh(bytes)) }, review: reviews.find(r => r.id === o.id)! };
  });
  return { objects, placements, placement: { accepted: solved.accepted, moved: solved.moved, tilted: solved.tilted, before: solved.before, after: solved.after, rejected: solved.rejected }, sparkCorrections: Object.fromEntries(accepted) };
}

// Owner-private inspection views: wireframe, normals, unlit base color and
// neutral light from six directions, or the composed reference-camera view.
export async function inspectionView(bytes: Buffer, mode: RenderMode, view: number, size = 512) {
  const doc = readMesh(bytes), mesh = renderMesh(doc, new Matrix4(), 0, mode === "unlit" || mode === "neutral" ? (await decodeTextures(doc)).textures : new Map());
  const cameras = orbitCameras(boundsOf([mesh])), frame = render([mesh], cameras[Math.max(0, Math.min(cameras.length - 1, view))].camera, size, size, mode);
  return sharp(Buffer.from(frame.rgb), { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}
export async function referenceView(objects: { bytes: Buffer; placement: Placed }[], composition: SceneComposition, width: number, height: number, mode: RenderMode = "unlit") {
  const camera = photoCamera(composition.camera), meshes = await Promise.all(objects.map(async (o, i) => { const doc = readMesh(o.bytes, placementMatrix(o.placement)); return renderMesh(doc, new Matrix4(), i, (await decodeTextures(doc)).textures); }));
  const frame = render(meshes, camera, width, height, mode);
  return sharp(Buffer.from(frame.rgb), { raw: { width, height, channels: 3 } }).png().toBuffer();
}
export { evaluatePlacement };
