import { Matrix4, Vector3, type PerspectiveCamera } from "three";
import { weld, writeGlb, readMesh } from "./mesh";
import { components, diagnoseMesh, type MeshDiagnostics } from "./diagnostics";
import { render, renderMesh, maskOverlap } from "./render";
import {fairSmoothSurfaces} from "./surface-fairing";

// Constraints come from a Spark plan with image evidence. Only "planar" changes
// geometry today; the rest are recorded so placement/review can use them.
export type StructuralConstraint = { id: string; kind: "planar" | "smooth" | "straight" | "symmetric" | "upright" | "opening" | "thin-part"; box: [number, number, number, number]; confidence: number };
export type Evidence = { camera: PerspectiveCamera; matrix: Matrix4; mask: Uint8Array; width: number; height: number };
export type RepairResult = { bytes: Buffer; changed: boolean; operations: Record<string, number>; maxDisplacement: number; skipped: string[]; smoothingImproved?:boolean };

function project(evidence: Evidence, p: Vector3) {
  const v = p.clone().applyMatrix4(evidence.matrix).project(evidence.camera);
  return [(v.x + 1) / 2, (1 - v.y) / 2] as const;
}
function insideMask(evidence: Evidence, p: Vector3, radius = 3) {
  const [x, y] = project(evidence, p), px = Math.floor(x * evidence.width), py = Math.floor(y * evidence.height);
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const ix = px + dx * 2, iy = py + dy * 2;
    if (ix >= 0 && iy >= 0 && ix < evidence.width && iy < evidence.height && evidence.mask[iy * evidence.width + ix] > 127) return true;
  }
  return false;
}

// Conservative repair: never smooths, fills holes, re-meshes or touches UVs.
// It removes provably redundant faces, debris the reference mask does not
// support, fixes inconsistent winding, and flattens surfaces only where a
// cited constraint and the mesh itself already agree they are planar.
export function repairGeometry(bytes: Buffer, options: { evidence?: Evidence; constraints?: StructuralConstraint[] } = {}): RepairResult {
  const doc = readMesh(bytes), topology = weld(doc), operations: Record<string, number> = { degenerate: 0, duplicate: 0, fragments: 0, rewound: 0, planarVertices: 0 }, skipped: string[] = [];
  const keep = doc.primitives.map(p => new Uint8Array(p.indices.length / 3).fill(1)), flip = doc.primitives.map(p => new Uint8Array(p.indices.length / 3));
  const tiny = topology.diagonal * topology.diagonal * 1e-12, seen = new Set<string>();
  topology.welded.forEach((w, p) => { for (let t = 0; t < w.length; t += 3) {
    if (topology.areas[p][t / 3] <= tiny || w[t] === w[t + 1] || w[t + 1] === w[t + 2] || w[t] === w[t + 2]) { keep[p][t / 3] = 0; operations.degenerate++; continue; }
    const key = [w[t], w[t + 1], w[t + 2]].sort((a, b) => a - b).join(","); if (seen.has(key)) { keep[p][t / 3] = 0; operations.duplicate++; } seen.add(key);
  } });
  const comps = components(topology), total = [...comps.area.values()].reduce((a, b) => a + b, 0), largest = Math.max(...comps.area.values());
  if (options.evidence && comps.area.size > 1) {
    // A separate piece survives when the reviewed mask covers it: chair legs,
    // shoelaces and handles are often disconnected yet real.
    const centroid = new Map<number, [Vector3, number]>();
    doc.primitives.forEach((prim, p) => { for (let t = 0; t < prim.indices.length; t += 3) {
      const r = comps.faces[p][t / 3], c = new Vector3().fromArray(prim.positions, prim.indices[t] * 3).add(new Vector3().fromArray(prim.positions, prim.indices[t + 1] * 3)).add(new Vector3().fromArray(prim.positions, prim.indices[t + 2] * 3)).multiplyScalar(1 / 3);
      const a = topology.areas[p][t / 3], e = centroid.get(r) ?? [new Vector3(), 0]; e[0].addScaledVector(c, a); e[1] += a; centroid.set(r, e);
    } });
    let removed = 0; const drop = new Set<number>();
    for (const [root, area] of comps.area) {
      if (area === largest || area > total * .004 || removed + area > total * .03) continue;
      const [sum, weight] = centroid.get(root)!; if (!weight || insideMask(options.evidence, sum.clone().multiplyScalar(1 / weight))) continue;
      drop.add(root); removed += area;
    }
    doc.primitives.forEach((_, p) => comps.faces[p].forEach((r, t) => { if (drop.has(r) && keep[p][t]) { keep[p][t] = 0; operations.fragments++; } }));
  } else if (comps.area.size > 1) skipped.push("fragments-without-mask-evidence");

  // Breadth-first winding agreement over manifold edges, then outward
  // orientation for closed shells by signed volume.
  const faceEdges = new Map<string, [number, number, number, number][]>();
  topology.welded.forEach((w, p) => { for (let t = 0; t < w.length; t += 3) { if (!keep[p][t / 3]) continue; for (let k = 0; k < 3; k++) { const a = w[t + k], b = w[t + (k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; const list = faceEdges.get(key) ?? []; list.push([p, t / 3, a, b]); faceEdges.set(key, list); } } });
  const visited = doc.primitives.map(p => new Uint8Array(p.indices.length / 3));
  doc.primitives.forEach((_, p0) => { for (let s = 0; s < visited[p0].length; s++) {
    if (visited[p0][s] || !keep[p0][s]) continue;
    const shell: [number, number][] = [[p0, s]], queue: [number, number][] = [[p0, s]]; visited[p0][s] = 1; let closed = true;
    while (queue.length) {
      const [p, t] = queue.pop()!, w = topology.welded[p];
      for (let k = 0; k < 3; k++) {
        const a0 = w[t * 3 + k], b0 = w[t * 3 + (k + 1) % 3], [a, b] = flip[p][t] ? [b0, a0] : [a0, b0], list = faceEdges.get(a < b ? `${a},${b}` : `${b},${a}`) ?? [];
        if (list.length === 1) closed = false;
        if (list.length !== 2) continue;
        const [q, u, c, d] = list[0][0] === p && list[0][1] === t ? list[1] : list[0];
        if (visited[q][u]) continue;
        visited[q][u] = 1; if (c === a && d === b) flip[q][u] = 1; shell.push([q, u]); queue.push([q, u]);
      }
    }
    let flippedArea = 0, area = 0, volume = 0;
    for (const [p, t] of shell) {
      const prim = doc.primitives[p], ids = flip[p][t] ? [2, 1, 0] : [0, 1, 2], [a, b, c] = ids.map(k => new Vector3().fromArray(prim.positions, prim.indices[t * 3 + k] * 3));
      area += topology.areas[p][t]; if (flip[p][t]) flippedArea += topology.areas[p][t]; volume += a.dot(b.cross(c)) / 6;
    }
    // Keep the majority orientation of open shells; closed shells face outward.
    const invert = closed ? volume < 0 : flippedArea > area / 2;
    for (const [p, t] of shell) { if (invert) flip[p][t] ^= 1; if (flip[p][t]) operations.rewound++; }
  } });

  let maxDisplacement = 0;
  const moved = doc.primitives.map(p => new Float32Array(p.positions)), weldedOf = doc.primitives.map((prim, p) => { const m = new Uint32Array(prim.positions.length / 3); prim.indices.forEach((v, i) => { m[v] = topology.welded[p][i]; }); return m; });
  for (const constraint of options.constraints ?? []) {
    if (constraint.kind !== "planar") { if(constraint.kind!=="smooth")skipped.push(`${constraint.kind}:${constraint.id}`); continue; }
    if (!options.evidence || constraint.confidence < .6) { skipped.push(`planar-low-evidence:${constraint.id}`); continue; }
    const faces: [number, number][] = [], normal = new Vector3();
    doc.primitives.forEach((prim, p) => { for (let t = 0; t < prim.indices.length; t += 3) {
      if (!keep[p][t / 3]) continue;
      const c = new Vector3().fromArray(prim.positions, prim.indices[t] * 3).add(new Vector3().fromArray(prim.positions, prim.indices[t + 1] * 3)).add(new Vector3().fromArray(prim.positions, prim.indices[t + 2] * 3)).multiplyScalar(1 / 3), [x, y] = project(options.evidence!, c);
      if (x >= constraint.box[0] && x <= constraint.box[2] && y >= constraint.box[1] && y <= constraint.box[3]) faces.push([p, t / 3]);
    } });
    const n = topology.normals, s = (p: number, t: number) => (flip[p][t] ? -1 : 1), eye = options.evidence.camera.position;
    const faceNormal = (p: number, t: number) => new Vector3(n[p][t * 3], n[p][t * 3 + 1], n[p][t * 3 + 2]).multiplyScalar(s(p, t));
    // Only surfaces the photo shows can carry this evidence, and only the
    // dominant orientation inside the cited region forms the plane.
    const seen = faces.filter(([p, t]) => {
      const prim = doc.primitives[p], c = new Vector3().fromArray(prim.positions, prim.indices[t * 3] * 3).add(new Vector3().fromArray(prim.positions, prim.indices[t * 3 + 1] * 3)).add(new Vector3().fromArray(prim.positions, prim.indices[t * 3 + 2] * 3)).multiplyScalar(1 / 3).applyMatrix4(options.evidence!.matrix);
      return faceNormal(p, t).transformDirection(options.evidence!.matrix).dot(eye.clone().sub(c)) > 0;
    });
    const cos = Math.cos(20 * Math.PI / 180), seeds = seen.filter((_, i) => i % Math.max(1, Math.floor(seen.length / 64)) === 0);
    let best = 0;
    for (const [p, t] of seeds) { const seed = faceNormal(p, t); let area = 0; for (const [q, u] of seen) if (faceNormal(q, u).dot(seed) > cos) area += topology.areas[q][u]; if (area > best) { best = area; normal.copy(seed); } }
    if (!best) { skipped.push(`planar-no-surface:${constraint.id}`); continue; }
    const aligned = seen.filter(([p, t]) => faceNormal(p, t).dot(normal) > cos);
    normal.set(0, 0, 0); for (const [p, t] of aligned) normal.addScaledVector(faceNormal(p, t), topology.areas[p][t]); normal.normalize();
    const vertices = new Map<string, [number, number]>(), offset = new Vector3(); let weight = 0;
    for (const [p, t] of aligned) for (let k = 0; k < 3; k++) { const v = doc.primitives[p].indices[t * 3 + k]; vertices.set(`${p}:${v}`, [p, v]); offset.add(new Vector3().fromArray(doc.primitives[p].positions, v * 3)); weight++; }
    if (aligned.length < 8) { skipped.push(`planar-too-few-faces:${constraint.id}`); continue; }
    offset.multiplyScalar(1 / weight);
    const residual = Math.sqrt([...vertices.values()].reduce((sum, [p, v]) => sum + new Vector3().fromArray(doc.primitives[p].positions, v * 3).sub(offset).dot(normal) ** 2, 0) / vertices.size);
    // Only noise on an already-flat surface is removed; a curved or slanted
    // design element has a large residual and stays untouched.
    const extent = Math.sqrt([...vertices.values()].reduce((sum, [p, v]) => { const d = new Vector3().fromArray(doc.primitives[p].positions, v * 3).sub(offset); return sum + d.lengthSq() - d.dot(normal) ** 2; }, 0) / vertices.size);
    if (residual > topology.diagonal * .012 || residual > extent * .02) { skipped.push(`planar-curved:${constraint.id}`); continue; }
    // Interior vertices only: every welded neighbor face must be in the set,
    // so creases and silhouettes keep their sharp edges.
    const inSet = new Set(aligned.map(([p, t]) => `${p}:${t}`)), ownedBy = new Map<number, boolean>();
    topology.welded.forEach((w, p) => { for (let t = 0; t < w.length; t += 3) for (let k = 0; k < 3; k++) { const id = w[t + k], ok = inSet.has(`${p}:${t / 3}`) || !keep[p][t / 3]; ownedBy.set(id, (ownedBy.get(id) ?? true) && ok); } });
    for (const [p, v] of vertices.values()) {
      if (!ownedBy.get(weldedOf[p][v])) continue;
      const point = new Vector3().fromArray(moved[p], v * 3), d = point.clone().sub(offset).dot(normal);
      if (Math.abs(d) > topology.diagonal * .025) continue;
      point.addScaledVector(normal, -d).toArray(moved[p], v * 3); maxDisplacement = Math.max(maxDisplacement, Math.abs(d) / topology.diagonal); operations.planarVertices++;
    }
  }

  const changed = Object.values(operations).some(Boolean);
  if (!changed) {const fair=fairSmoothSurfaces(bytes,options.evidence,options.constraints??[]);return {bytes:fair.bytes,changed:fair.improved,operations:{...operations,smoothedVertices:fair.vertices},maxDisplacement,skipped,smoothingImproved:fair.improved};}
  const primitives = new Map<string, { local?: Float32Array; indices?: Uint32Array }>();
  doc.primitives.forEach((prim, p) => {
    const indices: number[] = [];
    for (let t = 0; t < prim.indices.length; t += 3) if (keep[p][t / 3]) indices.push(...(flip[p][t / 3] ? [prim.indices[t], prim.indices[t + 2], prim.indices[t + 1]] : [prim.indices[t], prim.indices[t + 1], prim.indices[t + 2]]));
    const local = new Float32Array(prim.local), inverse = prim.matrix.clone().invert(), v = new Vector3();
    let positionsChanged = false;
    for (let i = 0; i < moved[p].length; i += 3) if (moved[p][i] !== prim.positions[i] || moved[p][i + 1] !== prim.positions[i + 1] || moved[p][i + 2] !== prim.positions[i + 2]) { v.fromArray(moved[p], i).applyMatrix4(inverse).toArray(local, i); positionsChanged = true; }
    if (!indices.length) throw new Error("REPAIR_REMOVED_PRIMITIVE");
    primitives.set(prim.key, { indices: Uint32Array.from(indices), ...(positionsChanged ? { local } : {}) });
  });
  const fair=fairSmoothSurfaces(writeGlb(doc,{primitives}),options.evidence,options.constraints??[]);
  return { bytes:fair.bytes,changed,operations:{...operations,smoothedVertices:fair.vertices},maxDisplacement,skipped,smoothingImproved:fair.improved };
}

export type GeometryComparison = { accepted: boolean; reasons: string[]; before: { iou: number | null; diagnostics: MeshDiagnostics }; after: { iou: number | null; diagnostics: MeshDiagnostics } };
function silhouette(bytes: Buffer, evidence: Evidence) {
  const width = 192, height = Math.max(32, Math.round(width * evidence.height / evidence.width));
  const frame = render([renderMesh(readMesh(bytes), evidence.matrix, 0)], evidence.camera, width, height, "unlit");
  return maskOverlap(frame.owners, width, height, evidence.mask, evidence.width, evidence.height, 0).iou;
}
// A replacement must beat the previous model on structure without losing
// reference agreement, surface or extent. Otherwise the previous mesh stays.
export function compareGeometry(before: Buffer, after: Buffer, evidence?: Evidence,smoothingImproved=false): GeometryComparison {
  const a = diagnoseMesh(readMesh(before)), b = diagnoseMesh(readMesh(after)), reasons: string[] = [];
  const area = (bytes: Buffer) => { const t = weld(readMesh(bytes)); return t.areas.reduce((s, v) => s + v.reduce((x, y) => x + y, 0), 0); };
  const size = (bytes: Buffer) => { const d = readMesh(bytes), min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity), v = new Vector3(); for (const p of d.primitives) for (let i = 0; i < p.positions.length; i += 3) { v.fromArray(p.positions, i); min.min(v); max.max(v); } return { min, max, diagonal: max.distanceTo(min) }; };
  const areaRatio = area(after) / Math.max(area(before), 1e-12), sa = size(before), sb = size(after);
  if (areaRatio < .97 || areaRatio > 1.001) reasons.push(`surface-area ${areaRatio.toFixed(3)}`);
  if (sa.min.distanceTo(sb.min) > sa.diagonal * .015 || sa.max.distanceTo(sb.max) > sa.diagonal * .015) reasons.push("extent-changed");
  for (const key of ["windingConflicts", "degenerate", "duplicateFaces", "nonManifoldEdges", "components"] as const) if (b[key] > a[key]) reasons.push(`${key}-worse`);
  if (b.uv.present < a.uv.present - 1e-6 || b.uv.degenerate > a.uv.degenerate + 1e-6) reasons.push("uv-worse");
  const ia = evidence ? silhouette(before, evidence) : null, ib = evidence ? silhouette(after, evidence) : null;
  if (ia !== null && ib !== null && ib < ia - .005) reasons.push(`silhouette ${ia.toFixed(3)}→${ib.toFixed(3)}`);
  const improved = b.windingConflicts < a.windingConflicts || b.degenerate < a.degenerate || b.duplicateFaces < a.duplicateFaces || b.fragmentArea < a.fragmentArea - 1e-4 || b.foldedEdges < a.foldedEdges || (ia !== null && ib !== null && ib > ia + .002);
  if (!improved && !smoothingImproved && !reasons.length) reasons.push("no-measured-improvement");
  return { accepted: !reasons.length, reasons, before: { iou: ia, diagnostics: a }, after: { iou: ib, diagnostics: b } };
}
