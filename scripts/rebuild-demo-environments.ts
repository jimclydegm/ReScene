/** Rebuild only the three approved demo backgrounds from reviewed Muse maps.
 * Original reference photos, object transforms and source scenes stay intact. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { Vector3 } from "three";
import { compositionSchema } from "../src/lib/scene/composition";
import {
  environmentGeometrySchema,
  type EnvironmentGeometry,
} from "../src/lib/scene/environment-plan";
import { backgroundSurfaces } from "../src/lib/scene/background";
import { environmentBoundaries } from "../src/lib/scene/environment-clearance";
import { completeRectangularOpening } from "../src/lib/scene/rectangular-opening";
import {
  packEnvironmentAtlas,
  prepareSurfaceTile,
} from "../src/lib/appearance/environment-atlas";
const folder = "test-results/demo-polish-nov3",
  source = JSON.parse(await readFile(`${folder}/snapshot-before.json`, "utf8")),
  output = [];
await mkdir("public/demo/refined", { recursive: true });
for (const s of source) {
  const composition = compositionSchema.parse(s.composition);
  let geometry: EnvironmentGeometry;
  if (composition.background?.geometry)
    geometry = structuredClone(composition.background.geometry);
  else {
    const layout = backgroundSurfaces(composition, 0),
      wall = layout.wall;
    if (!wall) throw Error("No verified corner wall");
    const c = new Vector3(...wall.position),
      u = new Vector3(
        Math.cos(wall.yaw),
        0,
        -Math.sin(wall.yaw),
      ).multiplyScalar(wall.width / 2),
      v = new Vector3(0, wall.height / 2, 0),
      vertices = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(
        ([x, y]) =>
          c.clone().addScaledVector(u, x).addScaledVector(v, y).toArray() as [
            number,
            number,
            number,
          ],
      );
    geometry = environmentGeometrySchema.parse({
      version: "reference-environment-v1",
      surfaces: [
        {
          role: "wall",
          vertices,
          triangles: [0, 1, 2, 0, 2, 3],
          color: composition.environment.wallColor,
          roughness: 0.9,
          textured: false,
        },
        {
          role: "floor",
          vertices: [
            [-160, 0, -160],
            [-160, 0, 160],
            [160, 0, 160],
            [160, 0, -160],
          ],
          triangles: [0, 1, 2, 0, 2, 3],
          color: "#CEB58C",
          roughness: 0.7,
          textured: true,
        },
      ],
    });
  }
  const windowIndex = geometry.surfaces.findIndex((s) => s.role === "window");
  if (windowIndex >= 0)
    geometry = completeRectangularOpening(
      geometry,
      windowIndex,
      composition.camera.position,
      s.id === "living" ? { top: 1.1 } : { left: 1.5, top: 1.05 },
    );
  // Baseboards are structural parts of a wall, even when their material differs.
  const walls = environmentBoundaries({
    ...composition,
    background: {
      ...composition.background!,
      geometry,
      surfaceMode: "reference",
    },
  }).filter((b) => b.role === "wall");
  const trims = geometry.surfaces.filter(
      (s) =>
        s.role === "trim" &&
        Math.min(...s.vertices.map((v) => v[1])) < 0.05 &&
        Math.max(...s.vertices.map((v) => v[1])) < 0.5,
    ),
    heights = trims
      .map((s) => Math.max(...s.vertices.map((v) => v[1])))
      .sort((a, b) => a - b),
    height = heights[Math.floor(heights.length / 2)] ?? 0.12;
  for (const wall of walls)
    for (const v of geometry.surfaces[wall.index].vertices)
      if (v[1] < 0.5) v[1] = height;
  if (!trims.length)
    for (const wall of walls) {
      const points = geometry.surfaces[wall.index].vertices,
        low = points.filter((p) => Math.abs(p[1] - height) < 1e-6);
      if (low.length < 2) continue;
      const a = new Vector3(...low[0]).addScaledVector(wall.normal, 0.004),
        b = new Vector3(...low[1]).addScaledVector(wall.normal, 0.004);
      geometry.surfaces.push({
        role: "trim",
        vertices: [
          a.clone().setY(0).toArray(),
          b.clone().setY(0).toArray(),
          b.clone().setY(height).toArray(),
          a.clone().setY(height).toArray(),
        ] as [number, number, number][],
        triangles: [0, 1, 2, 0, 2, 3],
        color: "#F7F5F0",
        roughness: 0.7,
        textured: false,
      });
    }
  for (const trim of trims) {
    const parent = walls
      .map((b) => ({
        b,
        d:
          trim.vertices
            .slice(0, 4)
            .reduce(
              (n, v) =>
                n + Math.abs(b.normal.dot(new Vector3(...v)) - b.constant),
              0,
            ) / 4,
      }))
      .sort((a, b) => a.d - b.d)[0]?.b;
    if (!parent) continue;
    trim.vertices = trim.vertices.map((v) => {
      const p = new Vector3(...v);
      p.addScaledVector(
        parent.normal,
        parent.constant + 0.004 - parent.normal.dot(p),
      );
      p.y = v[1] > 0.02 ? height : 0;
      return p.toArray() as [number, number, number];
    });
    trim.textured = false;
    trim.color = "#F7F5F0";
  }
  const floor = geometry.surfaces.find((s) => s.role === "floor")!;
  floor.textured = true;
  floor.materialIndex = 0;
  floor.materialOnly = true;
  floor.roughness = 0.75;
  floor.tile =
    s.id === "chair-studio"
      ? { origin: [0, 0, 0], u: [1.6, 0, 0], v: [0, 0, 3.5] }
      : { origin: [0, 0, 0], u: [0, 0, 1.6], v: [-3.5, 0, 0] };
  const maps = new Map<number, Buffer>();
  for (const kind of ["floor", ...(windowIndex >= 0 ? ["window"] : [])]) {
    const path = `${folder}/${s.id}-${kind}-new.png`,
      receipt = JSON.parse(await readFile(`${path}.json`, "utf8")),
      review = JSON.parse(await readFile(`${path}.review.json`, "utf8")),
      b = await readFile(path);
    if (
      receipt.status !== "SUCCEEDED" ||
      review.status !== "SUCCEEDED" ||
      !review.result.value.accepted ||
      createHash("sha256").update(b).digest("hex") !== receipt.result.sha256
    )
      throw Error("Unapproved surface image");
    if (kind === "window") {
      const m = await sharp(b).metadata(),
        rect =
          s.id === "living"
            ? [0.056, 0.045, 0.885, 0.9]
            : [0.063, 0.035, 0.88, 0.92];
      maps.set(
        geometry.surfaces.findIndex((x) => x.role === "window"),
        await sharp(b)
          .extract({
            left: Math.floor(rect[0] * m.width!),
            top: Math.floor(rect[1] * m.height!),
            width: Math.floor(rect[2] * m.width!),
            height: Math.floor(rect[3] * m.height!),
          })
          .png()
          .toBuffer(),
      );
    }
  }
  const tile = await prepareSurfaceTile(
      await readFile(`${folder}/${s.id}-floor-new.png`),
    ),
    blank = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer(),
    atlas = await packEnvironmentAtlas(
      blank,
      geometry,
      new Map([[0, tile]]),
      maps,
    ),
    digest = createHash("sha256").update(atlas.bytes).digest("hex"),
    path = `/demo/refined/${s.id}-environment-${digest.slice(0, 12)}.webp`;
  await writeFile(`public${path}`, atlas.bytes);
  composition.background = {
    ...composition.background!,
    kind: "planes",
    groundVisible: true,
    surfaceMode: "reference",
    boundary: null,
    geometry: atlas.geometry,
    description:
      "Reviewed Meta-generated material maps and complete rectangular window.",
  };
  compositionSchema.parse(composition);
  output.push({
    id: s.id,
    composition,
    appearance: {
      applied: true,
      floorUrl: null,
      wallUrl: null,
      backgroundUrl: path,
    },
    sha256: digest,
    width: atlas.width,
    height: atlas.height,
  });
  console.log(
    `${s.id}: ${geometry.surfaces.length} surfaces, separate floor/window mapping`,
  );
}
await writeFile(
  `${folder}/environments-ready.json`,
  JSON.stringify(output, null, 2),
);
