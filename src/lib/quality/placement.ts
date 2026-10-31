import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { z } from "zod";
import { readMesh } from "./mesh";
import { footprint, seatHeight } from "@/lib/appearance/contact";
import { collisionPairs, occupied, separateLayout } from "@/lib/scene/collisions";
import { maskOverlap, render, renderMesh } from "./render";
import { backgroundCamera } from "@/lib/scene/background";
import type { ModelPlacement, SceneComposition } from "@/lib/scene/composition";

export type Placed = { id: string; position: [number, number, number]; placement: ModelPlacement };
export type PlacementInput = { id: string; label: string; bytes: Buffer; mask: Uint8Array; support: string; supportedById?: string | null; parentId?: string | null };
export const contactSchema = z.object({
  id: z.string(), label: z.string(), support: z.string(), contacts: z.number().int(), gap: z.number(), penetration: z.number(), stable: z.boolean().nullable(),
  floating: z.boolean(), wallPenetration: z.number(), duplicateOf: z.string().nullable(), collisions: z.array(z.string()), baseTilt: z.number(), iou: z.number()
}).strict();
export type ContactEntry = z.infer<typeof contactSchema>;

export function placementMatrix(o: Placed) {
  const p = o.placement;
  return new Matrix4().makeTranslation(...o.position).multiply(new Matrix4().makeTranslation(...p.offset)).multiply(new Matrix4().compose(new Vector3(), new Quaternion(...p.rotation), new Vector3(...p.scale)));
}
type Cached = { points: Vector3[]; triangles: [Vector3, Vector3, Vector3][]; doc: ReturnType<typeof readMesh> };
function localMesh(bytes: Buffer): Cached {
  const doc = readMesh(bytes), triangles: [Vector3, Vector3, Vector3][] = [];
  for (const p of doc.primitives) for (let i = 0; i < p.indices.length; i += 3) triangles.push([0, 1, 2].map(k => new Vector3().fromArray(p.positions, p.indices[i + k] * 3)) as [Vector3, Vector3, Vector3]);
  const step = Math.max(1, Math.ceil(triangles.length * 3 / 6000)), points = triangles.flat().filter((_, i) => i % step === 0);
  return { points, triangles, doc };
}
const transform = (items: Vector3[], m: Matrix4) => items.map(v => v.clone().applyMatrix4(m));

// Height field of a support's upward-facing surface; a vertical ray picks the
// real top under a point, not a handle or headboard maximum elsewhere.
export function surfaceSampler(triangles: [Vector3, Vector3, Vector3][]) {
  const up = triangles.filter(([a, b, c]) => Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).normalize().y) >= .65);
  return (x: number, z: number) => {
    let height = -Infinity;
    for (const [a, b, c] of up) {
      const area = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(area) < 1e-12) continue;
      const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / area, v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / area, w = 1 - u - v;
      if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) height = Math.max(height, u * a.y + v * b.y + w * c.y);
    }
    return Number.isFinite(height) ? height : null;
  };
}

function hullContains(points: { x: number; z: number }[], q: { x: number; z: number }) {
  if (points.length < 3) return false;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z), cross = (o: typeof q, a: typeof q, b: typeof q) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x), hull: typeof q[] = [];
  for (const p of [...sorted, ...sorted.slice(0, -1).reverse()]) { while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop(); hull.push(p); }
  hull.pop();
  if (hull.length < 3) return false;
  return hull.every((a, i) => cross(a, hull[(i + 1) % hull.length], q) >= -1e-9);
}

type Wall = { normal: Vector3; origin: Vector3; polygon: [number, number][]; holes: [number, number][][]; u: Vector3; v: Vector3 };
// Observed walls from the reference environment. Openings are holes: an
// object may pass through a window/door gap, never through the wall itself.
export function environmentWalls(composition: SceneComposition): Wall[] {
  const surfaces = composition.background?.geometry?.surfaces ?? [], eye = new Vector3(...composition.camera.position), walls: Wall[] = [];
  for (const s of surfaces.filter(s => s.role === "wall")) {
    const vertices = s.vertices.map(v => new Vector3(...v)), origin = vertices.reduce((a, b) => a.add(b), new Vector3()).multiplyScalar(1 / vertices.length), normal = new Vector3();
    for (let i = 0; i < vertices.length; i++) { const a = vertices[i], b = vertices[(i + 1) % vertices.length]; normal.x += (a.y - b.y) * (a.z + b.z); normal.y += (a.z - b.z) * (a.x + b.x); normal.z += (a.x - b.x) * (a.y + b.y); }
    if (normal.lengthSq() < 1e-12) continue;
    normal.normalize(); if (normal.dot(eye.clone().sub(origin)) < 0) normal.negate();
    const u = Math.abs(normal.y) < .9 ? new Vector3(0, 1, 0).cross(normal).normalize() : new Vector3(1, 0, 0), v = normal.clone().cross(u);
    const flat = (p: Vector3) => [p.clone().sub(origin).dot(u), p.clone().sub(origin).dot(v)] as [number, number];
    const holes = surfaces.filter(o => o.role === "window" || o.role === "opening").map(o => o.vertices.map(p => new Vector3(...p))).filter(o => o.every(p => Math.abs(p.clone().sub(origin).dot(normal)) < .08)).map(o => o.map(flat));
    walls.push({ normal, origin, polygon: vertices.map(flat), holes, u, v });
  }
  return walls;
}
const inside = (p: [number, number], polygon: [number, number][]) => { let r = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const [xi, yi] = polygon[i], [xj, yj] = polygon[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi || 1e-12) + xi) r = !r; } return r; };
export function wallPenetration(points: Vector3[], walls: Wall[]) {
  let worst = 0, push = new Vector3();
  for (const wall of walls) {
    let depth = 0;
    for (const p of points) {
      const d = p.clone().sub(wall.origin).dot(wall.normal); if (d >= 0) continue;
      const q = p.clone().sub(wall.origin), flat: [number, number] = [q.dot(wall.u), q.dot(wall.v)];
      if (!inside(flat, wall.polygon) || wall.holes.some(h => inside(flat, h))) continue;
      depth = Math.max(depth, -d);
    }
    if (depth > worst) { worst = depth; push = wall.normal.clone().multiplyScalar(depth); }
  }
  return { depth: worst, push };
}

function silhouetteIoU(doc: ReturnType<typeof readMesh>, o: Placed, mask: Uint8Array, composition: SceneComposition, size: { width: number; height: number }) {
  if (mask.length !== size.width * size.height) return 0;
  const w = 192, h = Math.max(32, Math.round(w * size.height / size.width)), frame = render([renderMesh(doc, placementMatrix(o), 0)], backgroundCamera(composition.camera), w, h, "depth");
  return maskOverlap(frame.owners, w, h, mask, size.width, size.height, 0).iou;
}
function hullArea(points: { x: number; z: number }[]) {
  if (points.length < 3) return 0;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z), cross = (o: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: typeof points = [], upper: typeof points = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...sorted].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  let area = 0; for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; area += a.x * b.z - b.x * a.z; }
  return Math.abs(area) / 2;
}
// An object resting on a level support sits on its broadest flat base, not on
// one low corner of a slightly mis-posed mesh. Search the smallest rotation
// (≤15°) whose real base contact area is near the best achievable, and that
// keeps the center of mass over the contacts. Round or uneven bases with no
// clearly better flat contact are left as they are.
export function flushRotation(points: Vector3[], pivot: Vector3, maxDegrees = 15) {
  const local = points.map(p => p.clone().sub(pivot)), center = local.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / local.length);
  let lo = Infinity, hi = -Infinity; for (const p of local) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  const tol = Math.max(.0015, (hi - lo) * .006);
  const score = (ax: number, az: number) => {
    const m = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromEuler(new Euler(ax * Math.PI / 180, 0, az * Math.PI / 180))).elements;
    const ys = new Float64Array(local.length); let min = Infinity;
    for (let i = 0; i < local.length; i++) { const p = local[i]; ys[i] = m[1] * p.x + m[5] * p.y + m[9] * p.z; min = Math.min(min, ys[i]); }
    const touching: { x: number; z: number }[] = [];
    for (let i = 0; i < local.length; i++) if (ys[i] < min + tol) { const p = local[i]; touching.push({ x: m[0] * p.x + m[4] * p.y + m[8] * p.z, z: m[2] * p.x + m[6] * p.y + m[10] * p.z }); }
    const c = { x: m[0] * center.x + m[4] * center.y + m[8] * center.z, z: m[2] * center.x + m[6] * center.y + m[10] * center.z };
    return { area: hullArea(touching), stable: hullContains(touching, c) };
  };
  const current = score(0, 0), found: { ax: number; az: number; area: number; stable: boolean }[] = [];
  for (let ax = -maxDegrees; ax <= maxDegrees; ax += 1) for (let az = -maxDegrees; az <= maxDegrees; az += 1) found.push({ ax, az, ...score(ax, az) });
  const coarse = found.reduce((a, b) => b.area > a.area ? b : a);
  for (let ax = coarse.ax - 1; ax <= coarse.ax + 1; ax += .25) for (let az = coarse.az - 1; az <= coarse.az + 1; az += .25) if (Math.hypot(ax, az) <= maxDegrees) found.push({ ax, az, ...score(ax, az) });
  const best = Math.max(...found.map(f => f.area));
  // A flat base must be a real share of the footprint, not an edge or a pole.
  if (!best || best < hullArea(local.map(p => ({ x: p.x, z: p.z }))) * .08 || current.area >= best * .85 && current.stable) return null;
  if (best < current.area * 1.5 && current.stable) return null;
  const pick = found.filter(f => f.stable && f.area >= best * .85).sort((a, b) => Math.hypot(a.ax, a.az) - Math.hypot(b.ax, b.az))[0];
  if (!pick || Math.hypot(pick.ax, pick.az) < .25) return null;
  return { rotation: new Quaternion().setFromEuler(new Euler(pick.ax * Math.PI / 180, 0, pick.az * Math.PI / 180)), degrees: Math.hypot(pick.ax, pick.az), area: pick.area, before: current.area, stableBefore: current.stable };
}
// After a physical constraint changes the pose, re-fit what the photo can
// still decide (sliding on the support, heading, relative scale) instead of
// comparing the constrained pose with an unconstrained fit.
export function refitOnSupport(o: Placed, score: (p: Placed) => number) {
  let best = structuredClone(o), value = score(best);
  const size = Math.max(...o.placement.size);
  for (const step of [.04, .02, .01, .005]) for (let pass = 0; pass < 2; pass++) for (const move of ["x", "z", "yaw", "scale"] as const) for (const sign of [-1, 1]) {
    const next = structuredClone(best);
    if (move === "x") next.position[0] += sign * step * size;
    else if (move === "z") next.position[2] += sign * step * size;
    else if (move === "yaw") { const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), sign * step * 1.5); next.placement.rotation = q.clone().multiply(new Quaternion(...next.placement.rotation)).toArray() as [number, number, number, number]; next.placement.offset = new Vector3(...next.placement.offset).applyQuaternion(q).toArray() as [number, number, number]; }
    else { const f = 1 + sign * step * .5; next.placement.scale = next.placement.scale.map(v => v * f) as [number, number, number]; next.placement.offset = next.placement.offset.map(v => v * f) as [number, number, number]; next.placement.size = next.placement.size.map(v => v * f) as [number, number, number]; }
    const v = score(next); if (v > value + 1e-4) { best = next; value = v; }
  }
  return { placed: best, score: value };
}
// Physical evaluation of one layout: support contacts, stability, floating,
// penetration of supports/walls/neighbors and duplicated geometry.
export function evaluatePlacement(objects: Placed[], inputs: PlacementInput[], composition: SceneComposition, size: { width: number; height: number }, cache = new Map<string, Cached>()) {
  const mesh = (id: string) => { let m = cache.get(id); if (!m) { m = localMesh(inputs.find(i => i.id === id)!.bytes); cache.set(id, m); } return m; };
  const walls = environmentWalls(composition), floorY = composition.floorY ?? 0;
  const world = new Map(objects.map(o => [o.id, { points: transform(mesh(o.id).points, placementMatrix(o)), triangles: mesh(o.id).triangles.map(t => transform(t, placementMatrix(o)) as [Vector3, Vector3, Vector3]) }]));
  const pairs = collisionPairs(objects.map(o => ({ id: o.id, parentId: inputs.find(i => i.id === o.id)?.parentId, points: world.get(o.id)!.triangles })));
  const voxels = new Map(objects.map(o => [o.id, occupied(world.get(o.id)!.triangles, .055)]));
  // Each object alone from the fixed reference camera, like the layout review.
  const iou = new Map(objects.map(o => [o.id, silhouetteIoU(mesh(o.id).doc, o, inputs.find(i => i.id === o.id)!.mask, composition, size)]));
  return objects.map((o): ContactEntry => {
    const input = inputs.find(i => i.id === o.id)!, points = world.get(o.id)!.points, base = footprint(points), tol = Math.max(.004, base.height * .012);
    const support = objects.find(s => s.id === input.supportedById), plane = input.support === "floor" ? floorY : base.minY, height = support ? surfaceSampler(world.get(support.id)!.triangles) : () => plane;
    const grounded = input.support === "floor" || input.support === "tabletop";
    const gaps = grounded ? base.points.map(p => { const s = height(p.x, p.z); return s === null ? null : p.y - s; }).filter((g): g is number => g !== null) : [];
    const centroid = points.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / points.length);
    const touching = grounded ? base.band.filter(p => { const s = height(p.x, p.z); return s !== null && p.y - s < tol; }) : [], contacts = base.points.filter(p => touching.includes(p)).length;
    // Stable when the center of mass projects inside the real contact hull.
    const stable = !grounded || !gaps.length ? null : hullContains(touching.map(p => ({ x: p.x, z: p.z })), centroid) || touching.length > 0 && touching.every(p => Math.hypot(p.x - centroid.x, p.z - centroid.z) < Math.max(tol * 3, base.height * .05));
    // How far the base is from lying flush: the tilt that would lay it flat.
    const baseTilt = grounded ? flushRotation(points, new Vector3(...o.position))?.degrees ?? 0 : 0;
    let duplicateOf: string | null = null;
    const own = voxels.get(o.id)!;
    for (const other of objects) {
      if (other.id === o.id || inputs.find(i => i.id === other.id)?.parentId === o.id || input.parentId === other.id) continue;
      const theirs = voxels.get(other.id)!; let shared = 0; for (const k of own) if (theirs.has(k)) shared++;
      if (own.size > 8 && shared / Math.min(own.size, theirs.size || 1) > .5) duplicateOf = other.id;
    }
    return {
      id: o.id, label: input.label, support: input.support, contacts, gap: gaps.length ? Math.min(...gaps) : 0, penetration: gaps.length ? Math.max(0, -Math.min(...gaps)) : 0, stable,
      floating: grounded && gaps.length > 0 && Math.min(...gaps) > tol, wallPenetration: wallPenetration(points, walls).depth, duplicateOf,
      collisions: pairs.filter(p => p.a === o.id || p.b === o.id).map(p => p.a === o.id ? p.b : p.a), baseTilt, iou: iou.get(o.id) ?? 0
    };
  });
}
const badness = (r: ContactEntry[]) => r.reduce((s, e) => s + Number(e.floating) * 2 + Number(e.stable === false) + Math.min(1, e.penetration * 20) + Math.min(1, e.wallPenetration * 20) * 2 + e.collisions.length * 2 + Number(Boolean(e.duplicateOf)), 0);

// Joint, bounded correction against the support graph, environment and
// neighbors. Supports are solved before dependents; dependents move with
// them. The fixed reference camera scores silhouettes. The candidate is kept
// only when physical problems drop and no object's photo fit regresses.
export function solvePlacement(objects: Placed[], inputs: PlacementInput[], composition: SceneComposition, size: { width: number; height: number }, frozen = new Set<string>()): { accepted: boolean; moved: string[]; tilted: string[]; before: ContactEntry[]; after: ContactEntry[]; rejected: string[]; reasons: Record<string, string> } {
  const cache = new Map<string, Cached>(), cached = (id: string) => { let m = cache.get(id); if (!m) { m = localMesh(inputs.find(i => i.id === id)!.bytes); cache.set(id, m); } return m; }, before = evaluatePlacement(objects, inputs, composition, size, cache), candidate = structuredClone(objects), moved = new Set<string>(), floorY = composition.floorY ?? 0, walls = environmentWalls(composition);
  const order: Placed[] = [], seen = new Set<string>(), tilted_ = new Set<string>();
  const visit = (o: Placed) => { if (seen.has(o.id)) return; seen.add(o.id); const s = candidate.find(c => c.id === inputs.find(i => i.id === o.id)?.supportedById); if (s) visit(s); order.push(o); };
  candidate.forEach(visit);
  const dependents = (id: string): string[] => inputs.filter(i => i.supportedById === id || i.parentId === id).flatMap(i => [i.id, ...dependents(i.id)]);
  const shift = (id: string, delta: Vector3) => { for (const target of [id, ...dependents(id)]) { const o = candidate.find(c => c.id === target); if (!o) continue; o.position = new Vector3(...o.position).add(delta).toArray() as [number, number, number]; moved.add(target); } };
  const worldPoints = (o: Placed) => transform(cached(o.id).points, placementMatrix(o));
  for (const o of order) {
    const input = inputs.find(i => i.id === o.id)!; if (input.parentId || frozen.has(o.id)) continue;
    const support = candidate.find(s => s.id === input.supportedById);
    // Floor items rest on the floor; tabletop items on their support mesh, or
    // on the estimated level desk/table plane when that surface is background.
    if (input.support === "floor" || input.support === "tabletop") {
      const supportTriangles = support ? cached(support.id).triangles.map(t => transform(t, placementMatrix(support)) as [Vector3, Vector3, Vector3]) : null;
      const plane = input.support === "floor" ? floorY : footprint(worldPoints(o)).minY, height = supportTriangles ? surfaceSampler(supportTriangles) : () => plane, bound = Math.max(.05, o.placement.size[1]);
      const lift = seatHeight(footprint(worldPoints(o)).points, height);
      if (lift !== null && Math.abs(lift) > 1e-4 && Math.abs(lift) < bound) shift(o.id, new Vector3(0, lift, 0));
      // Lay the object flat on its real base. The reference silhouette may
      // veto it, which preserves deliberate tilts the photo actually shows.
      const pivot = new Vector3(...o.position), flush = flushRotation(worldPoints(o), pivot), mask = input.mask;
      if (flush) {
        const q = flush.rotation, tilted = structuredClone(o); tilted.placement.rotation = q.clone().multiply(new Quaternion(...o.placement.rotation)).toArray() as [number, number, number, number]; tilted.placement.offset = new Vector3(...o.placement.offset).applyQuaternion(q).toArray() as [number, number, number];
        // Every candidate is scored while resting on the support, never hovering.
        const seated = (p: Placed) => { const lift = seatHeight(footprint(worldPoints(p)).points, height); const out = structuredClone(p); if (lift !== null && Math.abs(lift) < bound) out.position[1] += lift; return out; };
        const fit = (p: Placed) => silhouetteIoU(cached(o.id).doc, p, mask, composition, size), refit = refitOnSupport(seated(tilted), p => fit(seated(p))), placed = seated(refit.placed);
        // A pose that cannot physically stand must change; the photo then only
        // chooses among stable poses, within a wider but bounded tolerance.
        if (refit.score >= fit(o) - (flush.stableBefore ? .02 : .06)) {
          const delta = new Vector3(...placed.position).sub(new Vector3(...o.position));
          o.placement = placed.placement; tilted_.add(o.id); shift(o.id, delta); moved.add(o.id);
        }
      }
    }
    const wall = wallPenetration(worldPoints(o), walls);
    if (wall.depth > .004 && wall.depth < Math.max(o.placement.size[0], o.placement.size[2]) * .6) {
      const push = wall.push.clone().setLength(wall.depth + .004); push.y = 0;
      if (support) for (const axis of ["x", "z"] as const) { const i = axis === "x" ? 0 : 2, half = Math.max(0, (support.placement.size[i] - o.placement.size[i]) / 2); push[axis] = Math.max(support.position[i] - half - o.position[i], Math.min(support.position[i] + half - o.position[i], push[axis])); }
      shift(o.id, push);
    }
  }
  const separation = separateLayout(candidate.filter(c => !frozen.has(c.id)), inputs);
  separation.adjusted.forEach(id => moved.add(id));
  const after = evaluatePlacement(candidate, inputs, composition, size, cache);
  const why = (a: ContactEntry) => { const b = before.find(e => e.id === a.id)!; return a.iou < b.iou - (b.stable === false && a.stable ? .06 : .03) ? `photo fit ${b.iou.toFixed(3)}→${a.iou.toFixed(3)}` : a.collisions.length > b.collisions.length ? "new intersection" : a.wallPenetration > b.wallPenetration + .002 ? "wall" : a.floating && !b.floating ? "floating" : null; };
  const regressed = after.filter(a => why(a)), reasons = Object.fromEntries(regressed.map(a => [a.id, why(a)!]));
  // One bounded retry: hold regressed objects (and what they carry) at their
  // saved pose and keep the remaining corrections.
  if (regressed.length && !frozen.size) {
    const hold = new Set(regressed.flatMap(r => [r.id, ...dependents(r.id)]));
    const retry = solvePlacement(objects, inputs, composition, size, hold);
    return { ...retry, rejected: [...new Set([...regressed.map(r => r.id), ...retry.rejected])], reasons: { ...reasons, ...retry.reasons } };
  }
  const accepted = moved.size > 0 && !regressed.length && badness(after) <= badness(before);
  if (accepted) for (const o of objects) { const c = candidate.find(v => v.id === o.id)!; o.position = c.position; o.placement = c.placement; }
  return { accepted, moved: accepted ? [...moved] : [], tilted: accepted ? [...tilted_] : [], before, after: accepted ? after : before, rejected: regressed.map(r => r.id), reasons };
}
