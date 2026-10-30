import { Matrix3, Plane, Ray, ShapeUtils, Vector2, Vector3 } from "three";
import { backgroundCamera } from "./background";
import type { SceneComposition } from "./composition";
import {
  environmentGeometrySchema,
  type EnvironmentGeometry,
  type EnvironmentObservation,
} from "./environment-plan";
import { depthAt, type DepthGrid } from "@/lib/appearance/environment-depth";
type Point = { x: number; y: number };
export function insidePolygon(p: Point, polygon: Point[]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export function withinPolygon(p: Point, polygon: Point[]) {
  if (insidePolygon(p, polygon)) return true;
  return polygon.some((a, i) => {
    const b = polygon[(i + 1) % polygon.length],
      dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) /
            Math.max(1e-12, dx * dx + dy * dy),
        ),
      );
    return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t) < 0.0001;
  });
}
const median = (n: number[]) => {
  const a = n.filter(Number.isFinite).sort((a, b) => a - b);
  return a[Math.floor(a.length / 2)];
};
function fitPlane(points: Vector3[], vertical: boolean) {
  if (points.length < 12) return null;
  let best: Vector3[] = [],
    plane: Plane | null = null;
  const tolerance = Math.max(
    0.025,
    median(points.map((p) => p.length())) * 0.018,
  );
  let seed = 173;
  const index = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % points.length;
  };
  for (let i = 0; i < 100; i++) {
    const a = points[index()],
      b = points[index()],
      c = points[index()],
      n = vertical
        ? new Vector3(b.z - a.z, 0, a.x - b.x)
        : b.clone().sub(a).cross(c.clone().sub(a));
    if (n.length() < 0.00001) continue;
    n.normalize();
    const test = new Plane(n, -n.dot(a)),
      inliers = points.filter(
        (p) => Math.abs(test.distanceToPoint(p)) < tolerance,
      );
    if (inliers.length > best.length) {
      best = inliers;
      plane = test;
    }
  }
  if (!plane || best.length < points.length * 0.35) return null;
  if (vertical) {
    const center = best
      .reduce((s, p) => s.add(p), new Vector3())
      .multiplyScalar(1 / best.length);
    let xx = 0,
      zz = 0,
      xz = 0;
    for (const p of best) {
      const x = p.x - center.x,
        z = p.z - center.z;
      xx += x * x;
      zz += z * z;
      xz += x * z;
    }
    const angle = 0.5 * Math.atan2(2 * xz, xx - zz),
      n = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
    plane = new Plane(n, -n.dot(center));
  }
  return {
    plane,
    residual: median(best.map((p) => Math.abs(plane!.distanceToPoint(p)))),
    inlierRatio: best.length / points.length,
  };
}
export function buildEnvironmentGeometry(
  observation: EnvironmentObservation,
  composition: SceneComposition,
  grid: DepthGrid,
  masks: Uint8Array[] = [],
) {
  if (
    grid.sourceWidth / grid.sourceHeight / composition.camera.aspect < 0.97 ||
    grid.sourceWidth / grid.sourceHeight / composition.camera.aspect > 1.03
  )
    throw new Error("ENVIRONMENT_DEPTH_ASPECT");
  const camera = backgroundCamera(composition.camera),
    origin = camera.position,
    floorY = composition.floorY ?? 0;
  const ray = (p: Point) =>
    new Vector3(p.x * 2 - 1, 1 - p.y * 2, 0.5)
      .unproject(camera)
      .sub(origin)
      .normalize();
  const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion),
    direction = (p: Point) => {
      const r = ray(p);
      return r.multiplyScalar(1 / r.dot(forward));
    };
  if (masks.some((m) => m.length !== grid.sourceWidth * grid.sourceHeight))
    throw new Error("ENVIRONMENT_MASK_SIZE");
  const hidden = (p: Point) => {
    const i =
      Math.min(grid.sourceHeight - 1, Math.floor(p.y * grid.sourceHeight)) *
        grid.sourceWidth +
      Math.min(grid.sourceWidth - 1, Math.floor(p.x * grid.sourceWidth));
    return masks.some((m) => m[i] > 127);
  };
  const floor = observation.surfaces.find((s) => s.role === "floor"),
    scales: number[] = [];
  if (floor)
    for (let y = 0.02; y < 1; y += 0.025)
      for (let x = 0.02; x < 1; x += 0.025) {
        const p = { x, y };
        if (!insidePolygon(p, floor.polygon) || hidden(p)) continue;
        const d = depthAt(grid, x, y),
          r = direction(p);
        if (d && r.y < -0.035) {
          const t = (floorY - origin.y) / r.y,
            s = t / d.depth;
          if (s > 0 && s < 1000) scales.push(s);
        }
      }
  const target = new Vector3(...composition.camera.target),
    scale =
      scales.length >= 12
        ? median(scales)
        : origin.distanceTo(target) /
          median(Array.from(grid.data).filter((_, i) => i % 251 === 0));
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1000)
    throw new Error("ENVIRONMENT_DEPTH_SCALE");
  const warnings: string[] =
    scales.length < 12
      ? [
          "No reliable ground anchor; background depth uses the saved scene scale.",
        ]
      : [];
  const planes = new Map<string, Plane>(),
    metrics: { role: string; inlierRatio: number; residual: number }[] = [];
  for (const surface of observation.surfaces) {
    const points: Vector3[] = [];
    for (let y = 0.01; y < 1; y += 0.018)
      for (let x = 0.01; x < 1; x += 0.018) {
        const p = { x, y };
        if (
          !insidePolygon(p, surface.polygon) ||
          hidden(p) ||
          observation.openings.some(
            (o) => o.surfaceId === surface.id && insidePolygon(p, o.polygon),
          )
        )
          continue;
        const d = depthAt(grid, x, y);
        if (d)
          points.push(
            origin.clone().addScaledVector(direction(p), d.depth * scale),
          );
      }
    if (surface.role === "floor") {
      planes.set(surface.id, new Plane(new Vector3(0, 1, 0), -floorY));
      continue;
    }
    const fit = fitPlane(
      points,
      surface.role === "wall" || surface.role === "trim",
    );
    if (!fit) {
      if (surface.role !== "trim")
        warnings.push(
          `${surface.role}: insufficient depth evidence; surface omitted.`,
        );
      continue;
    }
    let plane = fit.plane;
    if (surface.role === "wall" && floor) {
      // Physical floor/wall contact anchors the offset in the SAME saved frame.
      const bottom = surface.polygon.filter(
        (p) =>
          p.y >
          surface.polygon.reduce((sum, q) => sum + q.y, 0) /
            surface.polygon.length,
      );
      const contacts = bottom.flatMap((p) => {
        const q = floor.polygon
          .filter(
            (q) =>
              Math.abs(q.x - p.x) < 0.025 &&
              q.y >= p.y - 0.02 &&
              q.y - p.y < 0.18,
          )
          .sort((a, b) => Math.abs(a.y - p.y) - Math.abs(b.y - p.y))[0];
        return q ? [q] : [];
      });
      const seam = contacts
        .map((p) =>
          new Ray(origin, ray(p)).intersectPlane(
            new Plane(new Vector3(0, 1, 0), -floorY),
            new Vector3(),
          ),
        )
        .filter((v): v is Vector3 => !!v && v.distanceTo(origin) < 100);
      if (seam.length >= 2) {
        const a = seam[0],
          b = seam[seam.length - 1],
          n = new Vector3(b.z - a.z, 0, a.x - b.x).normalize();
        if (a.distanceTo(b) > 0.05) plane = new Plane(n, -n.dot(a));
      }
    }
    if (plane.distanceToPoint(origin) < 0) plane.negate();
    planes.set(surface.id, plane);
    metrics.push({
      role: surface.role,
      inlierRatio: fit.inlierRatio,
      residual: fit.residual,
    });
  }
  // Thin structural strips inherit the adjacent architectural plane. Fitting
  // a separate depth normal to a few baseboard pixels creates cracks and tilt.
  for (const trim of observation.surfaces.filter((s) => s.role === "trim")) {
    const walls = observation.surfaces.filter(
      (s) => s.role === "wall" && planes.has(s.id),
    );
    const ranked = walls
      .map((s) => ({
        s,
        shared: trim.polygon.filter((p) =>
          s.polygon.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.015),
        ).length,
      }))
      .sort((a, b) => b.shared - a.shared);
    const match =
      ranked[0]?.shared >= 2
        ? ranked[0].s
        : walls.find((s) =>
            insidePolygon(
              {
                x:
                  trim.polygon.reduce((v, p) => v + p.x, 0) /
                  trim.polygon.length,
                y:
                  trim.polygon.reduce((v, p) => v + p.y, 0) /
                  trim.polygon.length,
              },
              s.polygon,
            ),
          );
    if (match) planes.set(trim.id, planes.get(match.id)!.clone());
  }
  const surfaces: EnvironmentGeometry["surfaces"] = [],
    errors: number[] = [],
    builtIds = new Set<string>();
  function position(p: Point, plane: Plane, surfaceId: string) {
    let hit = new Ray(origin, ray(p)).intersectPlane(plane, new Vector3());
    if (!hit || hit.distanceTo(origin) > 160) return null;
    // Shared architectural corners solve all incident planes together rather
    // than independently drifting faces. Ray proximity constrains free axes.
    const incident = [
      plane,
      ...observation.surfaces
        .filter(
          (s) =>
            s.id !== surfaceId &&
            s.polygon.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.012),
        )
        .flatMap((s) => (planes.has(s.id) ? [planes.get(s.id)!] : [])),
    ];
    if (incident.length > 1) {
      const d = ray(p),
        a = new Matrix3().set(
          1 - d.x * d.x,
          -d.x * d.y,
          -d.x * d.z,
          -d.y * d.x,
          1 - d.y * d.y,
          -d.y * d.z,
          -d.z * d.x,
          -d.z * d.y,
          1 - d.z * d.z,
        ),
        rhs = origin.clone().addScaledVector(d, -origin.dot(d));
      for (const plane of incident) {
        const n = plane.normal,
          e = a.elements,
          w = 1000;
        e[0] += w * n.x * n.x;
        e[1] += w * n.y * n.x;
        e[2] += w * n.z * n.x;
        e[3] += w * n.x * n.y;
        e[4] += w * n.y * n.y;
        e[5] += w * n.z * n.y;
        e[6] += w * n.x * n.z;
        e[7] += w * n.y * n.z;
        e[8] += w * n.z * n.z;
        rhs.addScaledVector(n, -w * plane.constant);
      }
      if (Math.abs(a.determinant()) > 1e-8) hit = rhs.applyMatrix3(a.invert());
    }
    const projected = hit.clone().project(camera);
    errors.push(
      Math.hypot((projected.x + 1) / 2 - p.x, (1 - projected.y) / 2 - p.y),
    );
    return hit;
  }
  for (const s of observation.surfaces) {
    const plane = planes.get(s.id);
    if (!plane) continue;
    const holes = observation.openings.filter(
      (o) =>
        o.surfaceId === s.id &&
        o.polygon.every((p) => withinPolygon(p, s.polygon)),
    );
    if (
      holes.length !==
      observation.openings.filter((o) => o.surfaceId === s.id).length
    )
      warnings.push(
        `${s.role}: an opening outside its parent surface was omitted.`,
      );
    const polygons = [s.polygon, ...holes.map((h) => h.polygon)],
      points = polygons.flat(),
      positions = points.map((p) => position(p, plane, s.id));
    if (positions.some((p) => !p)) {
      warnings.push(
        `${s.role}: geometry beyond the supported camera range was omitted.`,
      );
      continue;
    }
    const vertices = positions.map(
      (p) => p!.toArray() as [number, number, number],
    );
    const triangles = ShapeUtils.triangulateShape(
      s.polygon.map((p) => new Vector2(p.x, p.y)),
      holes.map((h) => h.polygon.map((p) => new Vector2(p.x, p.y))),
    ).flat();
    // Orient the surfaces inward. Orbiting outside a room cuts away the near
    // wall instead of trapping the camera behind an opaque double-sided box.
    if (triangles.length) {
      const [a, b, c] = triangles,
        n = positions[b]!.clone()
          .sub(positions[a]!)
          .cross(positions[c]!.clone().sub(positions[a]!));
      if (n.dot(origin.clone().sub(positions[a]!)) < 0)
        for (let i = 0; i < triangles.length; i += 3)
          [triangles[i + 1], triangles[i + 2]] = [
            triangles[i + 2],
            triangles[i + 1],
          ];
    }
    // Extend only observed planes beyond the crop. This avoids finite floor or
    // tabletop corners without inventing side walls outside the photo.
    const center = positions
      .slice(0, s.polygon.length)
      .reduce<Vector3>((sum, p) => sum.add(p!), new Vector3())
      .multiplyScalar(1 / s.polygon.length);
    const extensions = new Map<number, Vector3[]>();
    for (let i = 0; s.role !== "floor" && i < s.polygon.length; i++) {
      const j = (i + 1) % s.polygon.length,
        a = s.polygon[i],
        b = s.polygon[j];
      if (
        !(["x", "y"] as const).some(
          (k) =>
            (a[k] < 0.008 && b[k] < 0.008) || (a[k] > 0.992 && b[k] > 0.992),
        )
      )
        continue;
      const pa = positions[i]!,
        pb = positions[j]!,
        tangent = pb.clone().sub(pa),
        out = tangent.clone().cross(plane.normal).normalize(),
        mid = pa.clone().add(pb).multiplyScalar(0.5);
      if (
        (s.role === "wall" || s.role === "trim") &&
        ((a.x < 0.008 && b.x < 0.008) || (a.x > 0.992 && b.x > 0.992))
      ) {
        out
          .copy(plane.normal)
          .cross(new Vector3(0, 1, 0))
          .normalize();
      }
      if (out.dot(mid.sub(center)) < 0) out.negate();
      const extent = Math.max(40, origin.distanceTo(target) * 8),
        va = pa.clone().addScaledVector(out, extent),
        vb = pb.clone().addScaledVector(out, extent),
        n = vertices.length;
      if (s.role === "wall" && a.y < 0.008 && b.y < 0.008) {
        va.copy(pa).setY(origin.y + extent);
        vb.copy(pb).setY(origin.y + extent);
      }
      extensions.set(i, [...(extensions.get(i) ?? []), va]);
      extensions.set(j, [...(extensions.get(j) ?? []), vb]);
      vertices.push(
        va.toArray() as [number, number, number],
        vb.toArray() as [number, number, number],
      );
      const extension = [i, j, n + 1, i, n + 1, n],
        normal = pb.clone().sub(pa).cross(vb.clone().sub(pa));
      if (normal.dot(origin.clone().sub(pa)) < 0)
        for (let q = 0; q < extension.length; q += 3)
          [extension[q + 1], extension[q + 2]] = [
            extension[q + 2],
            extension[q + 1],
          ];
      triangles.push(...extension);
    }
    for (const [i, outer] of extensions)
      if (outer.length === 2) {
        const a = outer[0],
          b = outer[1],
          corner = a.clone().add(b).sub(positions[i]!),
          n = vertices.length;
        vertices.push(
          a.toArray() as [number, number, number],
          corner.toArray() as [number, number, number],
          b.toArray() as [number, number, number],
        );
        const t = [i, n, n + 1, i, n + 1, n + 2],
          normal = a
            .clone()
            .sub(positions[i]!)
            .cross(corner.clone().sub(positions[i]!));
        if (normal.dot(origin.clone().sub(positions[i]!)) < 0)
          for (let q = 0; q < t.length; q += 3)
            [t[q + 1], t[q + 2]] = [t[q + 2], t[q + 1]];
        triangles.push(...t);
      }
    if (s.role === "floor") {
      const extent = Math.max(160, origin.distanceTo(target) * 16),
        x = composition.room.centerX,
        z = composition.room.centerZ;
      vertices.splice(
        0,
        vertices.length,
        [x - extent, floorY, z - extent],
        [x - extent, floorY, z + extent],
        [x + extent, floorY, z + extent],
        [x + extent, floorY, z - extent],
      );
      triangles.splice(0, triangles.length, 0, 1, 2, 0, 2, 3);
    }
    let tile:
      | {
          origin: [number, number, number];
          u: [number, number, number];
          v: [number, number, number];
        }
      | undefined;
    if (s.finish === "textured") {
      let best: {
        x: number;
        y: number;
        w: number;
        h: number;
        score: number;
      } | null = null;
      for (const w of [0.3, 0.2, 0.12, 0.07])
        for (const h of [0.2, 0.12, 0.07])
          for (let y = h / 2; y < 1 - h / 2; y += 0.04)
            for (let x = w / 2; x < 1 - w / 2; x += 0.04) {
              const samples = [-0.5, 0, 0.5].flatMap((dx) =>
                [-0.5, 0, 0.5].map((dy) => ({ x: x + dx * w, y: y + dy * h })),
              );
              if (
                samples.some(
                  (p) =>
                    !insidePolygon(p, s.polygon) ||
                    observation.openings.some(
                      (o) =>
                        o.surfaceId === s.id && insidePolygon(p, o.polygon),
                    ),
                )
              )
                continue;
              const score =
                w * h * (1 - samples.filter(hidden).length / samples.length);
              if (!best || score > best.score) best = { x, y, w, h, score };
            }
      if (best) {
        const p = best,
          a = new Ray(
            origin,
            ray({ x: p.x - p.w / 2, y: p.y - p.h / 2 }),
          ).intersectPlane(plane, new Vector3()),
          b = new Ray(
            origin,
            ray({ x: p.x + p.w / 2, y: p.y - p.h / 2 }),
          ).intersectPlane(plane, new Vector3()),
          d = new Ray(
            origin,
            ray({ x: p.x - p.w / 2, y: p.y + p.h / 2 }),
          ).intersectPlane(plane, new Vector3());
        if (a && b && d) {
          const u = b.sub(a),
            v = d.sub(a);
          if (u.clone().cross(v).length() > 0.001)
            tile = {
              origin: a.toArray() as [number, number, number],
              u: u.toArray() as [number, number, number],
              v: v.toArray() as [number, number, number],
            };
        }
      }
    }
    // Insets can overlay a parent wall, so offset trim very slightly to avoid
    // coplanar depth fighting while leaving the shared room junctions intact.
    if (s.role === "trim")
      for (const v of vertices) {
        v[0] += plane.normal.x * 0.004;
        v[1] += plane.normal.y * 0.004;
        v[2] += plane.normal.z * 0.004;
      }
    builtIds.add(s.id);
    surfaces.push({
      role: s.role,
      vertices,
      triangles,
      color: s.color,
      roughness: s.roughness,
      textured: s.finish === "textured",
      ...(tile ? { tile } : {}),
    });
    for (const hole of holes) {
      const v = hole.polygon.map((p) =>
        position(p, plane, s.id)?.addScaledVector(plane.normal, -0.025),
      );
      if (v.some((p) => !p)) continue;
      const t = ShapeUtils.triangulateShape(
        hole.polygon.map((p) => new Vector2(p.x, p.y)),
        [],
      ).flat();
      const n = v[t[1]]!.clone()
        .sub(v[t[0]]!)
        .cross(v[t[2]]!.clone().sub(v[t[0]]!));
      if (n.dot(origin.clone().sub(v[0]!)) < 0)
        for (let i = 0; i < t.length; i += 3)
          [t[i + 1], t[i + 2]] = [t[i + 2], t[i + 1]];
      surfaces.push({
        role: hole.kind === "window" ? "window" : "opening",
        vertices: v.map((p) => p!.toArray() as [number, number, number]),
        triangles: t,
        color: "#ffffff",
        roughness: 1,
        textured: true,
      });
    }
  }
  const walls = surfaces.filter((s) => s.role === "wall").length;
  if (walls < observation.expectedWallCount)
    warnings.push(
      `Only ${walls} of ${observation.expectedWallCount} observed walls could be built.`,
    );
  let covered = 0,
    total = 0;
  for (let y = 0.005; y < 1; y += 0.02)
    for (let x = 0.005; x < 1; x += 0.02) {
      const p = { x, y };
      if (hidden(p)) continue;
      total++;
      if (
        observation.surfaces.some(
          (s) => builtIds.has(s.id) && insidePolygon(p, s.polygon),
        )
      )
        covered++;
    }
  const coverage = covered / Math.max(1, total),
    projectionError = errors.length ? Math.max(...errors) : 1;
  if (coverage < 0.94)
    warnings.push(
      `${Math.round(coverage * 100)}% of the visible background is covered; inspect unmodeled regions.`,
    );
  if (projectionError > 0.025)
    warnings.push(
      "Some depth intersections disagree with the photographed corners; inspect the room seams.",
    );
  return {
    geometry: environmentGeometrySchema.parse({
      version: "reference-environment-v1",
      surfaces,
    }),
    report: {
      version: "environment-review-v1",
      walls,
      expectedWalls: observation.expectedWallCount,
      openings: surfaces.filter(
        (s) => s.role === "window" || s.role === "opening",
      ).length,
      coverage,
      projectionError,
      depthScale: scale,
      metrics,
      warnings,
    },
  };
}
