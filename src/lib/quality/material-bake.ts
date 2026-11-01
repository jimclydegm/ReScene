import { Matrix4, Vector3, type PerspectiveCamera } from "three";
import { weld, type MeshDocument } from "./mesh";
import type { PixelImage4 } from "./render";

// Deterministic full-surface base-color bake. Pixels come from three sources,
// tracked per texel: observed (de-lit, aligned source photo), generated (a
// Muse material sample mapped through grain-aligned triplanar coordinates) and
// inferred (the provider's own atlas). Muse never produces the atlas itself;
// it only supplies flat material swatches sampled here into validated UVs.
export type MaterialRegion = { id: string; color: [number, number, number]; sample: PixelImage4 | null; tileScale: number; grain: "none" | "along-part" | "across-part"; repeating: boolean;evidence?:[number,number,number,number] };
export type Photo = { data: Uint8Array; width: number; height: number; channels: 3 | 4 };
export type BakeInput = {
  doc: MeshDocument; textures: Map<number, PixelImage4>; object: number;
  photo: Photo; mask: Uint8Array; camera: PerspectiveCamera; visible: { depth: Float32Array; owners: Int16Array; width: number; height: number };
  photoStrength?:number;
  // Low-frequency provider color, used only to retain relief-like detail
  // (joinery, controls, folds) without restoring its broad baked lighting.
  providerLowFrequency?:Map<number,PixelImage4>;
  regions: MaterialRegion[]; protectedBoxes: [number, number, number, number][];
  registration?: { scaleX: number; scaleY: number; offsetX: number; offsetY: number };
};
export const provenanceCodes = { none: 0, observed: 1, generated: 2, inferred: 3, padding: 4 } as const;
export type Coverage = { observed: number; generated: number; inferred: number; unmapped: number; protected: number; regions: Record<string, number> };
export type BakeResult = { textures: Map<number, PixelImage4>; provenance: Map<number, Uint8Array>; coverage: Coverage; seams: { edges: number; before: number; after: number }; labels: Int16Array[] };

const lab = (c: ArrayLike<number>) => {
  const f = (v: number) => { v /= 255; v = v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; return v; };
  const [r, g, b] = [f(c[0]), f(c[1]), f(c[2])], x = (.4124 * r + .3576 * g + .1805 * b) / .9505, y = .2126 * r + .7152 * g + .0722 * b, z = (.0193 * r + .1192 * g + .9505 * b) / 1.089;
  const h = (v: number) => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
  return [116 * h(y) - 16, 500 * (h(x) - h(y)), 200 * (h(y) - h(z))];
};
const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// Shading changes lightness much more than chroma. Full Lab distance can turn
// shaded green cloth into the nearest light-brown wood material.
export const materialDistance=(a:number[],b:number[])=>Math.hypot((a[0]-b[0])*.25,a[1]-b[1],a[2]-b[2]);

// Remove low-frequency photographed shading inside the mask while keeping
// texture detail. Clipped specular pixels are marked unreliable instead of
// being copied into the albedo. This is an estimate, not measured albedo.
export function delightPhoto(photo: Photo, mask: Uint8Array) {
  const { width, height } = photo, n = width * height, lum = new Float64Array(n), cluster = new Int8Array(n).fill(-1);
  // Group mask pixels by chromaticity, which shading changes far less than
  // brightness, plus a weak lightness term so black and silver neutrals split.
  // A white top and dark legs are never normalized together.
  const chroma = (i: number) => { const at = i * photo.channels, r = photo.data[at], g = photo.data[at + 1], b = photo.data[at + 2], s = r + g + b + 1, max = Math.max(r, g, b), min = Math.min(r, g, b); return [r / s, g / s, (max - min) / (max + 1) * .5, Math.log(lum[i] + 8) * .08]; };
  const samples: number[][] = [];
  for (let i = 0; i < n; i++) { const at = i * photo.channels; lum[i] = .2126 * photo.data[at] + .7152 * photo.data[at + 1] + .0722 * photo.data[at + 2]; if (mask[i] > 127 && i % 7 === 0) samples.push(chroma(i)); }
  const k = Math.min(4, samples.length), centers = Array.from({ length: k }, (_, i) => samples[Math.floor((i + .5) * samples.length / k)]);
  const nearest = (c: number[]) => { let best = 0, d = Infinity; centers.forEach((m, i) => { const e = c.reduce((sum, v, j) => sum + (v - m[j]) ** 2, 0); if (e < d) { d = e; best = i; } }); return best; };
  for (let pass = 0; pass < 8 && k; pass++) { const sums = centers.map(() => [0, 0, 0, 0, 0]); for (const c of samples) { const j = nearest(c); c.forEach((v, q) => { sums[j][q] += v; }); sums[j][4]++; } sums.forEach((v, j) => { if (v[4]) centers[j] = v.slice(0, 4).map(x => x / v[4]); }); }
  for (let i = 0; i < n; i++) if (mask[i] > 127 && k) cluster[i] = nearest(chroma(i));
  const r = Math.max(4, Math.round(Math.max(width, height) * .03)), rgb = new Float32Array(n * 3), reliable = new Uint8Array(n), shading = new Float32Array(n).fill(1);
  for (let c = 0; c < k; c++) {
    const sl = new Float64Array((width + 1) * (height + 1)), sm = new Float64Array((width + 1) * (height + 1)), values: number[] = [];
    for (let y = 0; y < height; y++) { let rowL = 0, rowM = 0; for (let x = 0; x < width; x++) { const i = y * width + x, inside = cluster[i] === c ? 1 : 0; rowL += lum[i] * inside; rowM += inside; if (inside && i % 3 === 0) values.push(lum[i]); sl[(y + 1) * (width + 1) + x + 1] = sl[y * (width + 1) + x + 1] + rowL; sm[(y + 1) * (width + 1) + x + 1] = sm[y * (width + 1) + x + 1] + rowM; } }
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)] ?? 128;
    const box = (s: Float64Array, x: number, y: number) => { const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(width, x + r + 1), y1 = Math.min(height, y + r + 1); return s[y1 * (width + 1) + x1] - s[y0 * (width + 1) + x1] - s[y1 * (width + 1) + x0] + s[y0 * (width + 1) + x0]; };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x; if (cluster[i] !== c) continue;
      const count = box(sm, x, y); if (count < r) continue;
      shading[i] = Math.min(1.6, Math.max(.6, box(sl, x, y) / count / Math.max(1, median)));
    }
  }
  for (let i = 0; i < n; i++) {
    if (mask[i] <= 127) continue;
    const at = i * photo.channels, max = Math.max(photo.data[at], photo.data[at + 1], photo.data[at + 2]), min = Math.min(photo.data[at], photo.data[at + 1], photo.data[at + 2]);
    reliable[i] = Number(!(lum[i] > 232 && shading[i] > 1.25 && (max - min) / Math.max(1, max) < .12));
    for (let j = 0; j < 3; j++) rgb[i * 3 + j] = Math.min(255, photo.data[at + j] / shading[i]);
  }
  return { rgb, reliable, shading };
}

function backgroundColor(photo: Photo, mask: Uint8Array) {
  const { width, height } = photo, values: number[][] = [[], [], []];
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    if (mask[y * width + x] > 127) continue;
    let near = false; for (let d = 4; d <= 12 && !near; d += 4) near = [[d, 0], [-d, 0], [0, d], [0, -d]].some(([dx, dy]) => { const ix = x + dx, iy = y + dy; return ix >= 0 && iy >= 0 && ix < width && iy < height && mask[iy * width + ix] > 127; });
    if (near) for (let k = 0; k < 3; k++) values[k].push(photo.data[(y * width + x) * photo.channels + k]);
  }
  return values.map(v => { v.sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? -999; });
}

function texel(image: PixelImage4, u: number, v: number, out: number[], mirror = false) {
  const wrap = (c: number) => { if (!mirror) return ((c % 1) + 1) % 1; const f = ((c % 2) + 2) % 2; return f > 1 ? 2 - f : f; };
  const x = wrap(u) * image.width - .5, y = wrap(v) * image.height - .5, x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x))), y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.min(image.width - 1, x0 + 1), y1 = Math.min(image.height - 1, y0 + 1), fx = Math.min(1, Math.max(0, x - x0)), fy = Math.min(1, Math.max(0, y - y0));
  for (let k = 0; k < 3; k++) out[k] = (image.data[(y0 * image.width + x0) * 4 + k] * (1 - fx) + image.data[(y0 * image.width + x1) * 4 + k] * fx) * (1 - fy) + (image.data[(y1 * image.width + x0) * 4 + k] * (1 - fx) + image.data[(y1 * image.width + x1) * 4 + k] * fx) * fy;
  return out;
}

export function bakeMaterials(input: BakeInput): BakeResult {
  const { doc, photo, mask, camera } = input, topology = weld(doc), registration = input.registration ?? { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
  for (const p of doc.primitives) if (p.image !== null && !p.uv) throw new Error("BAKE_UV_MISSING");
  if (doc.issues.some(i => i.startsWith("TEXTURE_TRANSFORM"))) throw new Error("BAKE_TEXTURE_TRANSFORM_UNSUPPORTED");
  if (mask.length !== photo.width * photo.height || input.visible.width !== photo.width || input.visible.height !== photo.height) throw new Error("BAKE_FRAME");
  for (const r of input.regions) if (r.sample && (r.sample.width > 2048 || r.sample.height > 2048)) throw new Error("BAKE_SAMPLE_SIZE");
  camera.updateMatrixWorld();
  const clip = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements, view = camera.matrixWorldInverse.elements, eye = camera.position;
  const delit = delightPhoto(photo, mask), bg = backgroundColor(photo, mask), { width: W, height: H } = photo;
  const depthTolerance = Math.max(topology.diagonal * .006, 1e-4);
  // Rims, silhouettes and occlusion edges are where a few pixels of pose or
  // shape error put photo pixels on the wrong surface. Skip a band around them.
  const edge = (() => {
    const raw = new Uint8Array(W * H), r = Math.max(2, Math.round(Math.max(W, H) * .006));
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, o = input.visible.owners[i], d = input.visible.depth[i];
      if (o !== input.object) continue;
      // Owner change or a depth break (second difference), not a smooth slope.
      if ([i - 1, i + 1, i - W, i + W].some(n => input.visible.owners[n] !== o) || Math.abs(input.visible.depth[i - 1] + input.visible.depth[i + 1] - 2 * d) > depthTolerance * 2 || Math.abs(input.visible.depth[i - W] + input.visible.depth[i + W] - 2 * d) > depthTolerance * 2) raw[i] = 1;
    }
    const sum = new Uint32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += raw[y * W + x]; sum[(y + 1) * (W + 1) + x + 1] = sum[y * (W + 1) + x + 1] + row; } }
    const near = (x: number, y: number, k: number) => { const x0 = Math.max(0, x - k), y0 = Math.max(0, y - k), x1 = Math.min(W, x + k + 1), y1 = Math.min(H, y + k + 1); return sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0] > 0; };
    // 0 inside the band, a soft step just outside it, 1 beyond.
    return (x: number, y: number) => near(x, y, r) ? 0 : near(x, y, r * 2) ? .4 : near(x, y, r * 3) ? .75 : 1;
  })();
  // Observed sample at a world point, or null when hidden, off-mask or unreliable.
  const observe = (x: number, y: number, z: number, out: number[], detail=true) => {
    const w = clip[3] * x + clip[7] * y + clip[11] * z + clip[15], depth = -(view[2] * x + view[6] * y + view[10] * z + view[14]);
    if (depth <= 0 || w <= 0) return false;
    const ox = ((clip[0] * x + clip[4] * y + clip[8] * z + clip[12]) / w + 1) * W / 2, oy = (1 - (clip[1] * x + clip[5] * y + clip[9] * z + clip[13]) / w) * H / 2;
    if (ox < 0 || oy < 0 || ox >= W || oy >= H) return false;
    const at0 = Math.floor(oy) * W + Math.floor(ox);
    // Thin walls (cup rims, shells) put two surfaces millimetres apart, so the
    // depth tolerance follows object size rather than camera distance.
    if (input.visible.owners[at0] !== input.object || Math.abs(input.visible.depth[at0] - depth) > depthTolerance ) return false;
    const edgeWeight = detail?edge(Math.floor(ox), Math.floor(oy)):1; if (!edgeWeight) return false;
    const sx = ox * registration.scaleX + registration.offsetX, sy = oy * registration.scaleY + registration.offsetY, px = Math.floor(sx), py = Math.floor(sy);
    if (px < 3 || py < 3 || px >= W - 3 || py >= H - 3) return false;
    const at = py * W + px;
    // Eroded mask and depth/owner agreement keep neighboring objects and the
    // backdrop out of the albedo.
    if ((detail?[at, at - 2, at + 2, at - 2 * W, at + 2 * W]:[at]).some(i => mask[i] < 200) || !delit.reliable[at]) return false;
    const fx = sx - px, fy = sy - py;
    for (let k = 0; k < 3; k++) out[k] = (delit.rgb[at * 3 + k] * (1 - fx) + delit.rgb[(at + 1) * 3 + k] * fx) * (1 - fy) + (delit.rgb[(at + W) * 3 + k] * (1 - fx) + delit.rgb[(at + W + 1) * 3 + k] * fx) * fy;
    out[3] = sx / W; out[4] = sy / H; out[5] = edgeWeight;
    return true;
  };

  // Label every triangle with a material region from observed color where
  // visible and provider color elsewhere, then smooth over mesh adjacency.
  const labels = doc.primitives.map(p => new Int16Array(p.indices.length / 3).fill(-1)), regionLab = input.regions.map(r => lab(r.color)), tmp = [0, 0, 0, 0, 0, 1];
  const centroid = (p: number, t: number) => { const prim = doc.primitives[p], i = prim.indices; return [0, 1, 2].map(k => (prim.positions[i[t * 3] * 3 + k] + prim.positions[i[t * 3 + 1] * 3 + k] + prim.positions[i[t * 3 + 2] * 3 + k]) / 3); };
  const uvCentroid = (p: number, t: number) => { const prim = doc.primitives[p], i = prim.indices, uv = prim.uv!; return [(uv[i[t * 3] * 2] + uv[i[t * 3 + 1] * 2] + uv[i[t * 3 + 2] * 2]) / 3, (uv[i[t * 3] * 2 + 1] + uv[i[t * 3 + 1] * 2 + 1] + uv[i[t * 3 + 2] * 2 + 1]) / 3]; };
  if (input.regions.length) {
    doc.primitives.forEach((prim, p) => { const image = prim.image === null ? undefined : input.textures.get(prim.image); for (let t = 0; t < labels[p].length; t++) {
      const [x, y, z] = centroid(p, t);
      // Color classification tolerates silhouette proximity; copying detailed
      // pixels still uses the strict band. Otherwise thin parts and dark
      // upholstery inherit the provider's incorrect material labels.
      let color: number[] | null = observe(x, y, z, tmp,false) ? tmp.slice(0, 3) : null;
      if (!color && image && prim.uv) { const [u, v] = uvCentroid(p, t); color = texel(image, u, v, [0, 0, 0]); }
      if (!color) continue;
      const c = lab(color),w=clip[3]*x+clip[7]*y+clip[11]*z+clip[15],sx=((clip[0]*x+clip[4]*y+clip[8]*z+clip[12])/w+1)/2,sy=(1-(clip[1]*x+clip[5]*y+clip[9]*z+clip[13])/w)/2;
      const evidence=input.regions.map(r=>{const b=r.evidence;return !!b&&w>0&&sx>=b[0]&&sx<=b[2]&&sy>=b[1]&&sy<=b[3];}),single=evidence.filter(Boolean).length===1;
      const score=(r:number)=>materialDistance(c,regionLab[r])+(single&&!evidence[r]?18:0);
      let best = 0; regionLab.forEach((_, i) => { if (score(i)<score(best)) best = i; }); labels[p][t] = best;
    } });
    const neighbors = new Map<string, number[]>();
    topology.welded.forEach((w, p) => { for (let t = 0; t < w.length; t += 3) for (let k = 0; k < 3; k++) { const a = w[t + k], b = w[t + (k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; neighbors.set(key, [...(neighbors.get(key) ?? []), p, t / 3]); } });
    for (let pass = 0; pass < 2; pass++) {
      const next = labels.map(l => Int16Array.from(l));
      topology.welded.forEach((w, p) => { for (let t = 0; t < w.length; t += 3) {
        const votes = new Map<number, number>();
        for (let k = 0; k < 3; k++) { const a = w[t + k], b = w[t + (k + 1) % 3], list = neighbors.get(a < b ? `${a},${b}` : `${b},${a}`) ?? []; for (let i = 0; i < list.length; i += 2) if (list[i] !== p || list[i + 1] !== t / 3) { const l = labels[list[i]][list[i + 1]]; votes.set(l, (votes.get(l) ?? 0) + 1); } }
        for (const [label, count] of votes) if (count >= 2 && label !== labels[p][t / 3]) next[p][t / 3] = label;
      } });
      next.forEach((l, p) => labels[p].set(l));
    }
  }

  // Grain frame per region: dominant axis of that region's surface.
  const frames = input.regions.map((region, r) => {
    const points: number[][] = [], weights: number[] = [];
    doc.primitives.forEach((_, p) => labels[p].forEach((l, t) => { if (l === r) { points.push(centroid(p, t)); weights.push(topology.areas[p][t]); } }));
    const total = weights.reduce((a, b) => a + b, 0) || 1, mean = [0, 1, 2].map(k => points.reduce((s, q, i) => s + q[k] * weights[i], 0) / total);
    const axis = new Vector3(.3, 1, .2).normalize(), cov = new Matrix4(), v = new Array(16).fill(0);
    points.forEach((q, i) => { for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) v[a * 4 + b] += (q[a] - mean[a]) * (q[b] - mean[b]) * weights[i]; });
    cov.set(v[0], v[1], v[2], 0, v[4], v[5], v[6], 0, v[8], v[9], v[10], 0, 0, 0, 0, 1);
    for (let i = 0; i < 20 && points.length > 2; i++) { axis.applyMatrix4(cov); if (axis.lengthSq() < 1e-20) { axis.set(0, 1, 0); break; } axis.normalize(); }
    if (region.grain === "across-part") { const other = Math.abs(axis.y) < .9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0); axis.copy(other.sub(axis.clone().multiplyScalar(other.dot(axis))).normalize()); }
    return region.grain === "none" ? null : axis;
  });
  let diagonal = topology.diagonal;
  if (!Number.isFinite(diagonal) || diagonal <= 0) diagonal = 1;

  // Match each sample's mean color to the observed (or planned) region color
  // so generated and photographed texels meet without a visible step.
  const observedMeans = input.regions.map(() => [0, 0, 0, 0]);
  // Calibrate from Spark's actual source-material evidence, independent of
  // whether a thin mesh part survives the strict detail-copy edge exclusion.
  input.regions.forEach((r,l)=>{if(!r.evidence)return;const [x0,y0,x1,y1]=r.evidence;for(let y=Math.max(0,Math.floor(y0*H));y<Math.min(H,y1*H);y+=3)for(let x=Math.max(0,Math.floor(x0*W));x<Math.min(W,x1*W);x+=3){const at=y*W+x;if(mask[at]<200||!delit.reliable[at])continue;const c=lab(delit.rgb.subarray(at*3,at*3+3));if(regionLab.some((other,j)=>j!==l&&materialDistance(c,other)+3<materialDistance(c,regionLab[l])))continue;for(let k=0;k<3;k++)observedMeans[l][k]+=delit.rgb[at*3+k];observedMeans[l][3]++;}});
  const calibrated=observedMeans.map(v=>v[3]>=12);
  doc.primitives.forEach((prim, p) => { for (let t = 0; t < labels[p].length; t++) { const l = labels[p][t]; if (l < 0||calibrated[l]) continue; const [x, y, z] = centroid(p, t); if (observe(x, y, z, tmp,false)) { for (let k = 0; k < 3; k++) observedMeans[l][k] += tmp[k] * topology.areas[p][t]; observedMeans[l][3] += topology.areas[p][t]; } } });
  const gains = input.regions.map((region, r) => {
    if (!region.sample) return [1, 1, 1];
    const target = observedMeans[r][3] > 0 ? observedMeans[r].slice(0, 3).map(v => v / observedMeans[r][3]) : region.color, mean = [0, 0, 0];
    for (let i = 0; i < region.sample.width * region.sample.height; i++) for (let k = 0; k < 3; k++) mean[k] += region.sample.data[i * 4 + k];
    return mean.map((v, k) => Math.min(2, Math.max(.5, (target[k] + 1) / (v / (region.sample!.width * region.sample!.height) + 1))));
  });
  const sampleRegion = (r: number, x: number, y: number, z: number, nx: number, ny: number, nz: number, out: number[]) => {
    const region = input.regions[r], sample = region.sample!, tile = Math.max(1e-4, region.tileScale * diagonal), axis = frames[r];
    let wx = nx ** 4, wy = ny ** 4, wz = nz ** 4; const total = wx + wy + wz || 1; wx /= total; wy /= total; wz /= total;
    const acc = [0, 0, 0], c = [0, 0, 0];
    const plane = (weight: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      if (weight < 1e-3) return;
      // Orient the planar projection so its v axis follows the part's grain.
      let vx = bx, vy = by, vz = bz, ux = ax, uy = ay, uz = az;
      if (axis) { const pu = axis.x * ax + axis.y * ay + axis.z * az, pv = axis.x * bx + axis.y * by + axis.z * bz, l = Math.hypot(pu, pv); if (l > .3) { const cu = pu / l, cv = pv / l; vx = ax * cu + bx * cv; vy = ay * cu + by * cv; vz = az * cu + bz * cv; ux = ax * cv - bx * cu; uy = ay * cv - by * cu; uz = az * cv - bz * cu; } }
      texel(sample, (x * ux + y * uy + z * uz) / tile, (x * vx + y * vy + z * vz) / tile, c, !region.repeating);
      for (let k = 0; k < 3; k++) acc[k] += c[k] * weight;
    };
    plane(wx, 0, 0, 1, 0, 1, 0); plane(wy, 1, 0, 0, 0, 0, 1); plane(wz, 1, 0, 0, 0, 1, 0);
    for (let k = 0; k < 3; k++) out[k] = Math.min(255, acc[k] * gains[r][k]);
  };

  // Provider texels on unseen surfaces carry the provider's lighting and color
  // estimate. A per-region gain measured where both exist keeps them
  // consistent with the observed, de-lit texels, so seams do not step.
  const pairs = new Map<number, number[]>();
  doc.primitives.forEach((prim, p) => { const image = prim.image === null ? undefined : input.textures.get(prim.image); if (!image || !prim.uv) return; for (let t = 0; t < labels[p].length; t++) {
    const [x, y, z] = centroid(p, t); if (!observe(x, y, z, tmp)) continue;
    const [u, v] = uvCentroid(p, t), provider = texel(image, u, v, [0, 0, 0]), entry = pairs.get(labels[p][t]) ?? [0, 0, 0, 0, 0, 0, 0], a = topology.areas[p][t];
    for (let k = 0; k < 3; k++) { entry[k] += tmp[k] * a; entry[k + 3] += provider[k] * a; } entry[6] += a; pairs.set(labels[p][t], entry);
  } });
  const harmony = new Map([...pairs].map(([label, e]) => [label, [0, 1, 2].map(k => Math.min(1.6, Math.max(.6, (e[k] + e[6]) / (e[k + 3] + e[6]))))]));
  const textures = new Map<number, PixelImage4>(), provenance = new Map<number, Uint8Array>();
  for (const [index, image] of input.textures) { if (!doc.roles.get(index)?.includes("baseColor")) continue; textures.set(index, { ...image, data: new Uint8Array(image.data) }); provenance.set(index, new Uint8Array(image.width * image.height)); }
  const coverage: Coverage = { observed: 0, generated: 0, inferred: 0, unmapped: 0, protected: 0, regions: Object.fromEntries(input.regions.map(r => [r.id, 0])) };
  let totalArea = 0;
  const base = [0, 0, 0], obs = [0, 0, 0, 0, 0, 1];
  doc.primitives.forEach((prim, p) => {
    const out = prim.image === null ? undefined : textures.get(prim.image), source = prim.image === null ? undefined : input.textures.get(prim.image), codes = prim.image === null ? undefined : provenance.get(prim.image), i = prim.indices;
    for (let t = 0; t < labels[p].length; t++) {
      const area = topology.areas[p][t]; totalArea += area;
      if (!out || !source || !codes || !prim.uv) { coverage.unmapped += area; continue; }
      const P = [0, 1, 2].map(k => [prim.positions[i[t * 3 + k] * 3], prim.positions[i[t * 3 + k] * 3 + 1], prim.positions[i[t * 3 + k] * 3 + 2]]);
      const UV = [0, 1, 2].map(k => [prim.uv![i[t * 3 + k] * 2] * out.width, prim.uv![i[t * 3 + k] * 2 + 1] * out.height]);
      const uvArea = (UV[1][0] - UV[0][0]) * (UV[2][1] - UV[0][1]) - (UV[2][0] - UV[0][0]) * (UV[1][1] - UV[0][1]);
      if (Math.abs(uvArea) < 1e-9) { coverage.unmapped += area; continue; }
      const nx = topology.normals[p][t * 3], ny = topology.normals[p][t * 3 + 1], nz = topology.normals[p][t * 3 + 2];
      const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cy = (P[0][1] + P[1][1] + P[2][1]) / 3, cz = (P[0][2] + P[1][2] + P[2][2]) / 3, el = Math.hypot(eye.x - cx, eye.y - cy, eye.z - cz) || 1;
      // Signed: only surfaces facing the camera can receive photo pixels. The
      // outside of a cup's far wall must never take the inside wall's pixels.
      const facing = (nx * (eye.x - cx) + ny * (eye.y - cy) + nz * (eye.z - cz)) / el, label = labels[p][t];
      const counts = [0, 0, 0, 0, 0]; let hits = 0, protectedHits = 0;
      const write = (x: number, y: number, a: number, b: number, c: number) => {
        const px = P[0][0] * a + P[1][0] * b + P[2][0] * c, py = P[0][1] * a + P[1][1] * b + P[2][1] * c, pz = P[0][2] * a + P[1][2] * b + P[2][2] * c, at = y * out.width + x;
        let weight = 0, isProtected = false;
        if (facing > .1 && observe(px, py, pz, obs)) {
          isProtected = input.protectedBoxes.some(b => obs[3] >= b[0] && obs[3] <= b[2] && obs[4] >= b[1] && obs[4] <= b[3]);
          const provider = [source.data[at * 4], source.data[at * 4 + 1], source.data[at * 4 + 2]];
          // Skip samples that look like backdrop rather than this surface.
          const contaminated = !isProtected && bg[0] >= 0 && distance(obs, bg) < 20 && distance(obs, provider) > 45;
          weight = contaminated ? 0 : isProtected ? 1 : (input.regions[label]?.sample?(input.photoStrength??1):1) * Math.min(1, Math.max(0, (facing - .18) / .1)) * obs[5];
        }
        let code: number = provenanceCodes.inferred;
        if (label >= 0 && input.regions[label].sample) {
          sampleRegion(label, px, py, pz, nx, ny, nz, base); code = provenanceCodes.generated;
          const low=prim.image===null?undefined:input.providerLowFrequency?.get(prim.image);
          if(low){const lum=(data:Uint8Array)=>.2126*data[at*4]+.7152*data[at*4+1]+.0722*data[at*4+2],ratio=Math.max(.55,Math.min(1.35,(lum(source.data)+8)/(lum(low.data)+8)));for(let k=0;k<3;k++)base[k]=Math.min(255,base[k]*ratio);}
        }
        else { const gain = harmony.get(label) ?? harmony.get(-1) ?? [1, 1, 1]; for (let k = 0; k < 3; k++) base[k] = Math.min(255, source.data[at * 4 + k] * gain[k]); }
        for (let k = 0; k < 3; k++) out.data[at * 4 + k] = Math.round(obs[k] * weight + base[k] * (1 - weight));
        if (weight >= .5) code = provenanceCodes.observed;
        codes[at] = code; counts[code]++; hits++; if (isProtected && weight >= .5) protectedHits++;
      };
      const x0 = Math.max(0, Math.floor(Math.min(UV[0][0], UV[1][0], UV[2][0]))), x1 = Math.min(out.width - 1, Math.ceil(Math.max(UV[0][0], UV[1][0], UV[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(UV[0][1], UV[1][1], UV[2][1]))), y1 = Math.min(out.height - 1, Math.ceil(Math.max(UV[0][1], UV[1][1], UV[2][1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + .5, py = y + .5;
        const a = ((UV[1][0] - px) * (UV[2][1] - py) - (UV[2][0] - px) * (UV[1][1] - py)) / uvArea, b = ((UV[2][0] - px) * (UV[0][1] - py) - (UV[0][0] - px) * (UV[2][1] - py)) / uvArea, c = 1 - a - b;
        if (a >= -1e-6 && b >= -1e-6 && c >= -1e-6) write(x, y, a, b, c);
      }
      // Sub-texel triangles still receive their centroid texel.
      if (!hits) write(Math.min(out.width - 1, Math.max(0, Math.floor((UV[0][0] + UV[1][0] + UV[2][0]) / 3))), Math.min(out.height - 1, Math.max(0, Math.floor((UV[0][1] + UV[1][1] + UV[2][1]) / 3))), 1 / 3, 1 / 3, 1 / 3);
      coverage.observed += area * counts[1] / hits; coverage.generated += area * counts[2] / hits; coverage.inferred += area * counts[3] / hits; coverage.protected += area * protectedHits / hits;
      if (label >= 0) coverage.regions[input.regions[label].id] += area;
    }
  });
  if(input.regions.some(r=>r.sample))stitchMaterialSeams(doc,textures,labels,provenance);
  // Mip-safe padding grows islands into unused texels only, never over
  // another island, so unrelated materials do not bleed into each other.
  for (const [index, out] of textures) {
    const codes = provenance.get(index)!;
    for (let pass = 0; pass < Math.max(4,Math.round(out.width/256)); pass++) {
      const fill: [number, number[]][] = [];
      for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
        const at = y * out.width + x; if (codes[at]) continue;
        const sum = [0, 0, 0]; let count = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ix = x + dx, iy = y + dy; if (ix < 0 || iy < 0 || ix >= out.width || iy >= out.height) continue; const n = iy * out.width + ix; if (!codes[n]) continue; for (let k = 0; k < 3; k++) sum[k] += out.data[n * 4 + k]; count++; }
        if (count) fill.push([at, sum.map(v => v / count)]);
      }
      for (const [at, color] of fill) { for (let k = 0; k < 3; k++) out.data[at * 4 + k] = Math.round(color[k]); codes[at] = provenanceCodes.padding; }
    }
  }
  const share = (v: number) => totalArea ? v / totalArea : 0;
  return {
    textures, provenance, labels,
    coverage: { observed: share(coverage.observed), generated: share(coverage.generated), inferred: share(coverage.inferred), unmapped: share(coverage.unmapped), protected: share(coverage.protected), regions: Object.fromEntries(Object.entries(coverage.regions).map(([k, v]) => [k, share(v)])) },
    seams: seamDifference(doc, input.textures, textures)
  };
}

/** Reconcile paired UV-island borders on the same material. Feather inward
 * only inside the owning triangle; real material boundaries stay separate. */
function stitchMaterialSeams(doc:MeshDocument,textures:Map<number,PixelImage4>,labels:Int16Array[],provenance:Map<number,Uint8Array>){
 const topology=weld(doc),edges=new Map<string,{p:number;t:number;a:number;b:number}[]>();
 doc.primitives.forEach((prim,p)=>{if(!prim.uv||prim.image===null)return;for(let t=0;t<prim.indices.length/3;t++)for(let k=0;k<3;k++){let a=prim.indices[t*3+k],b=prim.indices[t*3+(k+1)%3],wa=topology.welded[p][t*3+k],wb=topology.welded[p][t*3+(k+1)%3];if(wa>wb){[a,b]=[b,a];[wa,wb]=[wb,wa];}const key=`${wa},${wb}`;edges.set(key,[...(edges.get(key)??[]),{p,t,a,b}]);}});
 const changes=new Map<number,Map<number,number[]>>(),color=[0,0,0],other=[0,0,0];
 for(const list of edges.values()){
  if(list.length!==2)continue;const [a,b]=list,pa=doc.primitives[a.p],pb=doc.primitives[b.p],ia=textures.get(pa.image!),ib=textures.get(pb.image!);if(!ia||!ib||labels[a.p][a.t]<0||labels[a.p][a.t]!==labels[b.p][b.t])continue;
  const uv=(p:typeof pa,i:number)=>[p.uv![i*2],p.uv![i*2+1]],a0=uv(pa,a.a),a1=uv(pa,a.b),b0=uv(pb,b.a),b1=uv(pb,b.b);
  if(Math.hypot(a0[0]-b0[0],a0[1]-b0[1])+Math.hypot(a1[0]-b1[0],a1[1]-b1[1])<1e-6)continue;
  const steps=Math.min(256,Math.max(2,Math.ceil(Math.max(Math.hypot((a1[0]-a0[0])*ia.width,(a1[1]-a0[1])*ia.height),Math.hypot((b1[0]-b0[0])*ib.width,(b1[1]-b0[1])*ib.height)))));
  for(let n=1;n<steps;n++){const f=n/steps;texel(ia,a0[0]*(1-f)+a1[0]*f,a0[1]*(1-f)+a1[1]*f,color);texel(ib,b0[0]*(1-f)+b1[0]*f,b0[1]*(1-f)+b1[1]*f,other);const mean=color.map((v,k)=>(v+other[k])/2);
   for(const [e,p,image,v0,v1]of [[a,pa,ia,a0,a1],[b,pb,ib,b0,b1]] as const){const x=(v0[0]*(1-f)+v1[0]*f)*image.width,y=(v0[1]*(1-f)+v1[1]*f)*image.height,c=uvCentroidForSeam(p,e.t,image),dx=c[0]-x,dy=c[1]-y,len=Math.hypot(dx,dy)||1,updates=changes.get(p.image!)??new Map<number,number[]>();changes.set(p.image!,updates);
    for(let d=0;d<4;d++){const xx=Math.floor(x+dx/len*(d+.5)),yy=Math.floor(y+dy/len*(d+.5));if(xx<0||yy<0||xx>=image.width||yy>=image.height||!insideUvTriangle(p,e.t,(xx+.5)/image.width,(yy+.5)/image.height))continue;const at=yy*image.width+xx;if(!provenance.get(p.image!)?.[at])continue;const w=(1-d/4)*.8,entry=updates.get(at)??[0,0,0,0];for(let k=0;k<3;k++)entry[k]+=mean[k]*w;entry[3]+=w;updates.set(at,entry);}
   }
  }
 }
 for(const [index,updates]of changes){const image=textures.get(index)!;for(const [at,sum]of updates){const w=Math.min(1,sum[3]);for(let k=0;k<3;k++)image.data[at*4+k]=Math.round(image.data[at*4+k]*(1-w)+sum[k]/sum[3]*w);}}
}
function uvCentroidForSeam(p:MeshDocument["primitives"][number],t:number,image:PixelImage4){return [0,1].map(k=>(p.uv![p.indices[t*3]*2+k]+p.uv![p.indices[t*3+1]*2+k]+p.uv![p.indices[t*3+2]*2+k])/3*(k===0?image.width:image.height));}
function insideUvTriangle(p:MeshDocument["primitives"][number],t:number,x:number,y:number){const uv=p.uv!,i=p.indices,ax=uv[i[t*3]*2],ay=uv[i[t*3]*2+1],bx=uv[i[t*3+1]*2],by=uv[i[t*3+1]*2+1],cx=uv[i[t*3+2]*2],cy=uv[i[t*3+2]*2+1],area=(bx-ax)*(cy-ay)-(cx-ax)*(by-ay);if(Math.abs(area)<1e-10)return false;const a=((bx-x)*(cy-y)-(cx-x)*(by-y))/area,b=((cx-x)*(ay-y)-(ax-x)*(cy-y))/area;return a>=0&&b>=0&&a+b<=1;}

// Color mismatch across UV seams: the same surface edge sampled from both
// islands. Lower is better; a large value is a visible seam.
export function seamDifference(doc: MeshDocument, before: Map<number, PixelImage4>, after: Map<number, PixelImage4>) {
  const topology = weld(doc), edges = new Map<string, [number, number, number][]>(), a = [0, 0, 0], b = [0, 0, 0];
  doc.primitives.forEach((prim, p) => { if (prim.image === null || !prim.uv) return; for (let t = 0; t < prim.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const wa = topology.welded[p][t + k], wb = topology.welded[p][t + (k + 1) % 3], key = wa < wb ? `${wa},${wb}` : `${wb},${wa}`, list = edges.get(key) ?? [];
    list.push(wa < wb ? [p, prim.indices[t + k], prim.indices[t + (k + 1) % 3]] : [p, prim.indices[t + (k + 1) % 3], prim.indices[t + k]]); edges.set(key, list);
  } });
  let count = 0, sumBefore = 0, sumAfter = 0;
  for (const list of edges.values()) {
    if (list.length !== 2) continue;
    const [[p0, a0, b0], [p1, a1, b1]] = list, u0 = doc.primitives[p0].uv!, u1 = doc.primitives[p1].uv!;
    if (Math.hypot(u0[a0 * 2] - u1[a1 * 2], u0[a0 * 2 + 1] - u1[a1 * 2 + 1]) + Math.hypot(u0[b0 * 2] - u1[b1 * 2], u0[b0 * 2 + 1] - u1[b1 * 2 + 1]) < 1e-4) continue;
    const i0 = doc.primitives[p0].image!, i1 = doc.primitives[p1].image!;
    for (const [images, add] of [[before, (v: number) => { sumBefore += v; }], [after, (v: number) => { sumAfter += v; }]] as const) {
      const x0 = images.get(i0), x1 = images.get(i1); if (!x0 || !x1) continue;
      let diff = 0;
      for (const f of [.25, .5, .75]) { texel(x0, u0[a0 * 2] * (1 - f) + u0[b0 * 2] * f, u0[a0 * 2 + 1] * (1 - f) + u0[b0 * 2 + 1] * f, a); texel(x1, u1[a1 * 2] * (1 - f) + u1[b1 * 2] * f, u1[a1 * 2 + 1] * (1 - f) + u1[b1 * 2 + 1] * f, b); diff += distance(a, b) / 3; }
      add(diff);
    }
    count++;
  }
  return { edges: count, before: count ? sumBefore / count : 0, after: count ? sumAfter / count : 0 };
}
