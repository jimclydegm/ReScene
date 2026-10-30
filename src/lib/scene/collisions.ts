import { Matrix4, Quaternion, Vector3 } from "three";
import { geometry } from "@/lib/appearance/bake";
import type { ModelPlacement } from "./composition";
export type CollisionMesh = {
  id: string;
  points: Vector3[][];
  parentId?: string | null;
};
export function occupied(points: Vector3[][], cell: number) {
  const columns = new Map<string, number[]>();
  for (const [a, b, c] of points) {
    const area = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(area) < 1e-10) continue;
    const minX = Math.floor(Math.min(a.x, b.x, c.x) / cell),
      maxX = Math.floor(Math.max(a.x, b.x, c.x) / cell),
      minZ = Math.floor(Math.min(a.z, b.z, c.z) / cell),
      maxZ = Math.floor(Math.max(a.z, b.z, c.z) / cell);
    if ((maxX - minX + 1) * (maxZ - minZ + 1) > 40000)
      throw new Error("COLLISION_RANGE");
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        const px = (x + 0.5) * cell,
          pz = (z + 0.5) * cell,
          u = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / area,
          v = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / area,
          w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const key = `${x},${z}`,
          ys = columns.get(key) ?? [];
        ys.push(u * a.y + v * b.y + w * c.y);
        columns.set(key, ys);
      }
  }
  const result = new Set<string>();
  for (const [key, ys] of columns) {
    ys.sort((a, b) => a - b);
    const levels = ys.filter((y, i) => !i || y - ys[i - 1] > cell * 0.03);
    if (levels.length % 2) continue;
    for (let i = 0; i < levels.length; i += 2)
      for (
        let y = Math.ceil(levels[i] / cell);
        (y + 0.5) * cell < levels[i + 1] - cell * 0.1;
        y++
      ) {
        result.add(`${key},${y}`);
        if (result.size > 200000) throw new Error("COLLISION_COMPLEXITY");
      }
  }
  return result;
}
export function collisionPairs(meshes: CollisionMesh[], cell = 0.055) {
  const voxels = meshes.map((m) => occupied(m.points, cell)),
    pairs: { a: string; b: string; cells: number }[] = [];
  for (let i = 0; i < meshes.length; i++)
    for (let j = i + 1; j < meshes.length; j++) {
      if (
        meshes[i].parentId === meshes[j].id ||
        meshes[j].parentId === meshes[i].id ||
        (meshes[i].parentId && meshes[i].parentId === meshes[j].parentId)
      )
        continue;
      let cells = 0;
      for (const key of voxels[i]) if (voxels[j].has(key)) cells++;
      if (cells >= 3) pairs.push({ a: meshes[i].id, b: meshes[j].id, cells });
    }
  return pairs;
}
type Placement = {
  id: string;
  position: [number, number, number];
  placement: ModelPlacement;
};
export function separateLayout(
  objects: Placement[],
  inputs: {
    id: string;
    bytes: Buffer;
    parentId?: string | null;
    supportedById?: string | null;
  }[],
) {
  const parsed = new Map(
    inputs.map((i) => [i.id, geometry(i.bytes, new Matrix4(), 0, false)]),
  );
  const meshes = () =>
    objects.flatMap((o) => {
      const input = inputs.find((i) => i.id === o.id);
      if (!input) return [];
      const p = o.placement,
        m = new Matrix4()
          .makeTranslation(...o.position)
          .multiply(new Matrix4().makeTranslation(...p.offset))
          .multiply(
            new Matrix4().compose(
              new Vector3(),
              new Quaternion(...p.rotation),
              new Vector3(...p.scale),
            ),
          );
      return [
        {
          id: o.id,
          parentId: input.parentId,
          points: parsed
            .get(input.id)!
            .map((t) => t.points.map((p) => p.clone().applyMatrix4(m))),
        },
      ];
    });
  const initial = collisionPairs(meshes()),
    moved = new Set<string>();
  for (let pass = 0; pass < 6; pass++) {
    const current = collisionPairs(meshes());
    if (!current.length) break;
    const pair = current[0],
      a = objects.find((o) => o.id === pair.a)!,
      b = objects.find((o) => o.id === pair.b)!;
    // Move the smaller independent subject and its supported descendants as a
    // unit. Never separate attached garment/assembly regions or lift off support.
    const volume = (o: Placement) =>
        o.placement.size.reduce((v, n) => v * n, 1),
      item = volume(a) < volume(b) ? a : b;
    const parent = inputs.find((i) => i.id === item.id)?.supportedById;
    if (parent === a.id || parent === b.id) break;
    const group = new Set([item.id]);
    for (let i = 0; i < 10; i++)
      for (const input of inputs)
        if (
          group.has(input.supportedById ?? "") ||
          group.has(input.parentId ?? "")
        )
          group.add(input.id);
    const saved = objects
      .filter((o) => group.has(o.id))
      .map((o) => ({ o, p: [...o.position] as [number, number, number] }));
    let best: { dx: number; dz: number; score: number } | null = null;
    const score = current.reduce((s, p) => s + p.cells, 0);
    for (const distance of [0.055, 0.11, 0.22, 0.44, 0.66])
      for (const [x, z] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const support = objects.find((o) => o.id === parent);
        if (
          support &&
          ([0, 2] as const).some(
            (axis) =>
              Math.abs(
                saved.find(s=>s.o.id===item.id)!.p[axis] +
                  (axis === 0 ? x : z) * distance -
                  support.position[axis],
              ) >
              Math.max(
                0,
                (support.placement.size[axis] - item.placement.size[axis]) / 2,
              ),
          )
        )
          continue;
        for (const { o, p } of saved) {
          o.position[0] = p[0] + x * distance;
          o.position[2] = p[2] + z * distance;
        }
        const next = collisionPairs(meshes()).reduce((s, p) => s + p.cells, 0);
        if (next < score && (!best || next < best.score))
          best = { dx: x * distance, dz: z * distance, score: next };
        if (best?.score === 0) break;
      }
    for (const { o, p } of saved) {
      o.position = p;
      if (best) {
        o.position[0] += best.dx;
        o.position[2] += best.dz;
        moved.add(o.id);
      }
    }
    if (!best) break;
  }
  return {
    initial: initial.length,
    remaining: collisionPairs(meshes()),
    adjusted: [...moved],
  };
}
