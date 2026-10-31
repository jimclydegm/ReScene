import { z } from "zod";
import { weld, type MeshDocument, type Topology } from "./mesh";
import type { PixelImage4 } from "./render";

// Findings name the layer a defect belongs to, so repair work targets the
// cause: a white atlas texel is not missing geometry and a dark top face is
// not a reconstruction error.
export const findingSchema = z.object({
  code: z.string().max(60), layer: z.enum(["geometry", "mapping", "lighting", "placement", "material"]),
  severity: z.enum(["info", "warn", "error"]), value: z.number().finite(), detail: z.string().max(240)
}).strict();
export type Finding = z.infer<typeof findingSchema>;
export const meshDiagnosticsSchema = z.object({
  triangles: z.number().int(), vertices: z.number().int(), primitives: z.number().int(), materials: z.number().int(),
  degenerate: z.number().int(), duplicateFaces: z.number().int(), components: z.number().int(), fragmentArea: z.number(),
  boundaryEdges: z.number().int(), smallHoles: z.number().int(), openings: z.number().int(), nonManifoldEdges: z.number().int(),
  windingConflicts: z.number().int(), foldedEdges: z.number().int(), flippedNormals: z.number(),
  uv: z.object({ present: z.number(), degenerate: z.number(), flipped: z.number(), outOfRange: z.number(), overlap: z.number(), occupancy: z.number(), stretch: z.number() }).strict(),
  appearance: z.object({ baseColorImages: z.number().int(), dataImages: z.number().int(), alpha: z.boolean(), lightingCorrelation: z.number(), transforms: z.boolean() }).strict(),
  findings: z.array(findingSchema)
}).strict();
export type MeshDiagnostics = z.infer<typeof meshDiagnosticsSchema>;

function edgeMaps(topology: Topology) {
  const edges = new Map<string, { count: number; forward: number; faces: [number, number][] }>();
  topology.welded.forEach((w, p) => {
    for (let t = 0; t < w.length; t += 3) {
      if (topology.areas[p][t / 3] <= 0) continue;
      for (let k = 0; k < 3; k++) {
        const a = w[t + k], b = w[t + (k + 1) % 3]; if (a === b) continue;
        const key = a < b ? `${a},${b}` : `${b},${a}`, entry = edges.get(key) ?? { count: 0, forward: 0, faces: [] };
        entry.count++; if (a < b) entry.forward++; entry.faces.push([p, t / 3]); edges.set(key, entry);
      }
    }
  });
  return edges;
}
export function components(topology: Topology) {
  const parent = new Map<number, number>(), find = (x: number): number => { let r = x; while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
  for (const w of topology.welded) for (let t = 0; t < w.length; t += 3) { const a = find(w[t]); for (const v of [w[t + 1], w[t + 2]]) { const b = find(v); if (a !== b) parent.set(b, a); } }
  const area = new Map<number, number>(), faces = topology.welded.map(w => new Int32Array(w.length / 3));
  topology.welded.forEach((w, p) => { for (let t = 0; t < w.length; t += 3) { const r = find(w[t]); faces[p][t / 3] = r; area.set(r, (area.get(r) ?? 0) + topology.areas[p][t / 3]); } });
  return { faces, area };
}

function boundaryLoops(edges: ReturnType<typeof edgeMaps>, points: Map<number, number[]>, diagonal: number) {
  const next = new Map<number, number[]>();
  for (const [key, e] of edges) if (e.count === 1) { const [a, b] = key.split(",").map(Number); next.set(a, [...(next.get(a) ?? []), b]); next.set(b, [...(next.get(b) ?? []), a]); }
  const seen = new Set<string>(); let small = 0, large = 0;
  for (const start of next.keys()) {
    for (const first of next.get(start)!) {
      const k0 = start < first ? `${start},${first}` : `${first},${start}`; if (seen.has(k0)) continue;
      let prev = start, current = first, length = 0, steps = 0; seen.add(k0);
      const dist = (a: number, b: number) => { const p = points.get(a), q = points.get(b); return p && q ? Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) : 0; };
      length += dist(start, first);
      while (current !== start && steps++ < 100_000) {
        const candidates = (next.get(current) ?? []).filter(v => v !== prev), to = candidates[0]; if (to === undefined) break;
        const key = current < to ? `${current},${to}` : `${to},${current}`; if (seen.has(key)) break; seen.add(key);
        length += dist(current, to); prev = current; current = to;
      }
      // A short closed boundary is a pinhole/tear candidate; a long one is a
      // possible real opening (cup rim, shoe collar, window). Neither is filled.
      if (length < diagonal * .04) small++; else large++;
    }
  }
  return { small, large };
}

export function diagnoseMesh(doc: MeshDocument, images: Map<number, PixelImage4> = new Map()): MeshDiagnostics {
  const topology = weld(doc), edges = edgeMaps(topology), findings: Finding[] = [], points = new Map<number, number[]>();
  doc.primitives.forEach((p, i) => { const w = topology.welded[i]; for (let t = 0; t < p.indices.length; t++) points.set(w[t], [p.positions[p.indices[t] * 3], p.positions[p.indices[t] * 3 + 1], p.positions[p.indices[t] * 3 + 2]]); });
  let degenerate = 0, totalArea = 0, duplicateFaces = 0, flippedNormals = 0, normalSamples = 0;
  const faceKeys = new Set<string>();
  topology.welded.forEach((w, p) => {
    for (let t = 0; t < w.length; t += 3) {
      const area = topology.areas[p][t / 3]; totalArea += area;
      if (area <= topology.diagonal * topology.diagonal * 1e-12 || w[t] === w[t + 1] || w[t + 1] === w[t + 2] || w[t] === w[t + 2]) { degenerate++; continue; }
      const key = [w[t], w[t + 1], w[t + 2]].sort((a, b) => a - b).join(","); if (faceKeys.has(key)) duplicateFaces++; faceKeys.add(key);
      const prim = doc.primitives[p];
      if (prim.normals) for (let k = 0; k < 3; k++) {
        const v = prim.indices[t + k], n = topology.normals[p];
        normalSamples++; if (prim.normals[v * 3] * n[t] + prim.normals[v * 3 + 1] * n[t + 1] + prim.normals[v * 3 + 2] * n[t + 2] < 0) flippedNormals++;
      }
    }
  });
  let boundaryEdges = 0, nonManifoldEdges = 0, windingConflicts = 0, foldedEdges = 0;
  for (const e of edges.values()) {
    if (e.count === 1) boundaryEdges++; else if (e.count > 2) nonManifoldEdges++;
    else {
      if (e.forward !== 1) windingConflicts++;
      const [[p0, t0], [p1, t1]] = e.faces, n0 = topology.normals[p0], n1 = topology.normals[p1];
      if (e.forward === 1 && n0[t0 * 3] * n1[t1 * 3] + n0[t0 * 3 + 1] * n1[t1 * 3 + 1] + n0[t0 * 3 + 2] * n1[t1 * 3 + 2] < -.985) foldedEdges++;
    }
  }
  const comps = components(topology), sorted = [...comps.area.values()].sort((a, b) => b - a), fragmentArea = totalArea ? 1 - (sorted[0] ?? 0) / totalArea : 0;
  const loops = boundaryLoops(edges, points, topology.diagonal);

  // UV evidence per material image; texel density spread approximates stretching.
  let uvPresent = 0, uvDegenerate = 0, uvFlipped = 0, outOfRange = 0, densityWeight = 0, densitySum = 0, densitySq = 0;
  const grid = 256, cover = new Uint8Array(grid * grid);
  doc.primitives.forEach((p, i) => {
    const signs: number[] = [];
    for (let t = 0; t < p.indices.length; t += 3) {
      const area = topology.areas[i][t / 3]; if (!p.uv) continue; uvPresent += area;
      const [a, b, c] = [p.indices[t], p.indices[t + 1], p.indices[t + 2]].map(v => [p.uv![v * 2], p.uv![v * 2 + 1]]);
      const uvArea = ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
      if ([a, b, c].some(v => v[0] < -1e-3 || v[0] > 1.001 || v[1] < -1e-3 || v[1] > 1.001)) outOfRange += area;
      if (Math.abs(uvArea) < 1e-10) { uvDegenerate += area; continue; }
      signs.push(Math.sign(uvArea) * area);
      const density = Math.sqrt(Math.abs(uvArea) / Math.max(area, 1e-12)); densityWeight += area; densitySum += density * area; densitySq += density * density * area;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) * grid)), x1 = Math.min(grid - 1, Math.floor(Math.max(a[0], b[0], c[0]) * grid));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) * grid)), y1 = Math.min(grid - 1, Math.floor(Math.max(a[1], b[1], c[1]) * grid));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = (x + .5) / grid, py = (y + .5) / grid, d = 2 * uvArea;
        const u = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / d, v = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / d;
        if (u >= 0 && v >= 0 && u + v <= 1) cover[y * grid + x] = Math.min(255, cover[y * grid + x] + 1);
      }
    }
    // Mirrored islands are legitimate; only a minority orientation is counted.
    const positive = signs.filter(s => s > 0).reduce((a, b) => a + b, 0), negative = -signs.filter(s => s < 0).reduce((a, b) => a + b, 0);
    uvFlipped += Math.min(positive, negative);
  });
  let covered = 0, overlapped = 0; for (const v of cover) { if (v) covered++; if (v > 1) overlapped++; }
  const mean = densityWeight ? densitySum / densityWeight : 0, stretch = mean ? Math.sqrt(Math.max(0, densitySq / densityWeight - mean * mean)) / mean : 0;

  // Baked lighting estimate: base-color luminance correlated with facing-up
  // normals means photographed light/shadow lives in the albedo.
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  doc.primitives.forEach((p, i) => {
    const image = p.image === null ? undefined : images.get(p.image); if (!image || !p.uv) return;
    for (let t = 0; t < p.indices.length; t += 3) {
      const w = topology.areas[i][t / 3]; if (w <= 0) continue;
      const u = (p.uv[p.indices[t] * 2] + p.uv[p.indices[t + 1] * 2] + p.uv[p.indices[t + 2] * 2]) / 3, v = (p.uv[p.indices[t] * 2 + 1] + p.uv[p.indices[t + 1] * 2 + 1] + p.uv[p.indices[t + 2] * 2 + 1]) / 3;
      const x = Math.min(image.width - 1, Math.max(0, Math.floor(u * image.width))), y = Math.min(image.height - 1, Math.max(0, Math.floor(v * image.height))), at = (y * image.width + x) * 4;
      const lum = (.2126 * image.data[at] + .7152 * image.data[at + 1] + .0722 * image.data[at + 2]) / 255, up = topology.normals[i][t + 1];
      n += w; sx += w * up; sy += w * lum; sxx += w * up * up; syy += w * lum * lum; sxy += w * up * lum;
    }
  });
  const cov = n ? sxy / n - sx * sy / n / n : 0, vx = n ? sxx / n - (sx / n) ** 2 : 0, vy = n ? syy / n - (sy / n) ** 2 : 0, lightingCorrelation = vx > 1e-9 && vy > 1e-9 ? cov / Math.sqrt(vx * vy) : 0;

  const baseImages = [...doc.roles].filter(([, r]) => r.includes("baseColor")).length, dataImages = [...doc.roles].filter(([, r]) => r.some(v => v !== "baseColor" && v !== "unknown")).length;
  const share = (v: number) => totalArea ? v / totalArea : 0, push = (f: Finding) => findings.push(f);
  if (degenerate) push({ code: "DEGENERATE_TRIANGLES", layer: "geometry", severity: degenerate > topology.triangleCount * .01 ? "warn" : "info", value: degenerate, detail: "Zero-area triangles add no surface and break normals." });
  if (duplicateFaces) push({ code: "DUPLICATE_FACES", layer: "geometry", severity: "warn", value: duplicateFaces, detail: "Coincident faces cause z-fighting and double-counted collisions." });
  if (fragmentArea > .002) push({ code: "DISCONNECTED_FRAGMENTS", layer: "geometry", severity: fragmentArea > .05 ? "warn" : "info", value: fragmentArea, detail: `${comps.area.size} components; fragments can be real separate parts or floating debris. Mask evidence decides.` });
  if (loops.small) push({ code: "SMALL_HOLES", layer: "geometry", severity: loops.small > 20 ? "warn" : "info", value: loops.small, detail: "Short boundary loops are tear candidates; they are reported, not filled." });
  if (loops.large) push({ code: "OPENINGS", layer: "geometry", severity: "info", value: loops.large, detail: "Long open boundaries can be real openings (rims, collars, frames). Preserved." });
  if (nonManifoldEdges) push({ code: "NON_MANIFOLD", layer: "geometry", severity: nonManifoldEdges > 50 ? "warn" : "info", value: nonManifoldEdges, detail: "Edges shared by more than two faces." });
  if (windingConflicts) push({ code: "WINDING_CONFLICTS", layer: "geometry", severity: windingConflicts > topology.triangleCount * .005 ? "warn" : "info", value: windingConflicts, detail: "Neighboring faces disagree on orientation, so shading and back-face culling flip." });
  if (foldedEdges) push({ code: "FOLDED_SURFACE", layer: "geometry", severity: foldedEdges > 30 ? "warn" : "info", value: foldedEdges, detail: "Adjacent faces fold back onto each other." });
  if (normalSamples && flippedNormals / normalSamples > .02) push({ code: "FLIPPED_NORMALS", layer: "geometry", severity: "warn", value: flippedNormals / normalSamples, detail: "Stored normals point against face winding." });
  if (share(uvPresent) < .999) push({ code: "UV_MISSING", layer: "mapping", severity: "error", value: 1 - share(uvPresent), detail: "Surface without texture coordinates cannot hold a baked material." });
  if (share(uvDegenerate) > .001) push({ code: "UV_DEGENERATE", layer: "mapping", severity: share(uvDegenerate) > .02 ? "warn" : "info", value: share(uvDegenerate), detail: "Faces collapsed to a point in UV space show one smeared color." });
  if (share(uvFlipped) > .02) push({ code: "UV_FLIPPED", layer: "mapping", severity: "info", value: share(uvFlipped), detail: "Mirrored UV islands; legitimate unless markings read backwards." });
  if (share(outOfRange) > .001) push({ code: "UV_OUT_OF_RANGE", layer: "mapping", severity: "warn", value: share(outOfRange), detail: "Coordinates outside the atlas wrap around." });
  if (covered && overlapped / covered > .08) push({ code: "UV_OVERLAP", layer: "mapping", severity: "warn", value: overlapped / covered, detail: "Islands overlap; a bake to one face also paints another." });
  if (stretch > .9) push({ code: "UV_STRETCH", layer: "mapping", severity: "warn", value: stretch, detail: "Texel density varies strongly across the surface." });
  if (Math.abs(lightingCorrelation) > .35) push({ code: "BAKED_LIGHTING", layer: "lighting", severity: Math.abs(lightingCorrelation) > .55 ? "warn" : "info", value: lightingCorrelation, detail: "Base color brightness follows surface direction, which suggests photographed light or shadow in the albedo." });
  if (doc.issues.some(i => i.startsWith("TEXTURE_TRANSFORM"))) push({ code: "TEXTURE_TRANSFORM", layer: "mapping", severity: "error", value: 1, detail: "Texture transforms are not baked; this mesh keeps its original appearance." });
  if (!baseImages) push({ code: "NO_BASE_COLOR_TEXTURE", layer: "material", severity: "warn", value: 0, detail: "No base-color texture is bound; appearance comes only from material factors." });
  if (doc.primitives.some(p => p.material === null)) push({ code: "UNBOUND_MATERIAL", layer: "material", severity: "warn", value: doc.primitives.filter(p => p.material === null).length, detail: "Some primitives have no material and render with defaults." });
  return {
    triangles: topology.triangleCount, vertices: doc.primitives.reduce((s, p) => s + p.positions.length / 3, 0), primitives: doc.primitives.length, materials: doc.json.materials?.length ?? 0,
    degenerate, duplicateFaces, components: comps.area.size, fragmentArea, boundaryEdges, smallHoles: loops.small, openings: loops.large, nonManifoldEdges, windingConflicts, foldedEdges,
    flippedNormals: normalSamples ? flippedNormals / normalSamples : 0,
    uv: { present: share(uvPresent), degenerate: share(uvDegenerate), flipped: share(uvFlipped), outOfRange: share(outOfRange), overlap: covered ? overlapped / covered : 0, occupancy: covered / cover.length, stretch },
    appearance: { baseColorImages: baseImages, dataImages, alpha: doc.primitives.some(p => p.alphaMode !== "OPAQUE"), lightingCorrelation, transforms: doc.issues.some(i => i.startsWith("TEXTURE_TRANSFORM")) },
    findings
  };
}
