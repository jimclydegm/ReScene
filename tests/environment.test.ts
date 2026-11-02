import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { Vector3, Ray, Plane } from "three";
import {
  decodeEnvironmentDepth,
  depthAt,
  type DepthGrid,
} from "../src/lib/appearance/environment-depth";
import {
  buildEnvironmentGeometry,
  insidePolygon,
  withinPolygon,
} from "../src/lib/scene/environment-geometry";
import {
  environmentObservationSchema,
  environmentGeometrySchema,
  type EnvironmentObservation,
} from "../src/lib/scene/environment-plan";
import { backgroundCamera } from "../src/lib/scene/background";
import { compositionSchema } from "../src/lib/scene/composition";
import { environmentAlbedo } from "../src/lib/appearance/environment-albedo";
import { environmentUsesTexture } from "../src/lib/scene/environment-material";
const camera = {
  position: [0, 2, 6],
  target: [0, 1, 0],
  fov: 50,
  aspect: 16 / 9,
};
const stage = () =>
  compositionSchema.parse({
    version: "sam3d-room-v1",
    floorY: 0,
    camera,
    room: { centerX: 0, centerZ: 0, width: 8, depth: 8, height: 4 },
    environment: {
      floorColor: "#bb9988",
      wallColor: "#eeeeee",
      floorMaterial: "wood",
      lightDirection: "right",
      lightWarmth: "neutral",
      sideWall: "none",
    },
    environmentSource: "spark",
    projectionError: 0,
    warnings: [],
  });
const p = (x: number, y: number) => ({ x, y });
const face = (
  id: string,
  role: "wall" | "floor",
  polygon: { x: number; y: number }[],
) => ({
  id,
  role,
  polygon,
  finish: "plain" as const,
  color: "#bbbbbb",
  roughness: 0.8,
  material: "Matte material",
  confidence: 1,
});
function room(): EnvironmentObservation {
  const c = backgroundCamera(stage().camera),
    top = (x: number) => {
      const foot = new Ray(
        c.position,
        new Vector3(x * 2 - 1, 1 - 0.7 * 2, 0.5)
          .unproject(c)
          .sub(c.position)
          .normalize(),
      ).intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3())!;
      let lo = 0,
        hi = 30;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (new Vector3(foot.x, mid, foot.z).project(c).y < 1) lo = mid;
        else hi = mid;
      }
      const px = new Vector3(foot.x, (lo + hi) / 2, foot.z).project(c);
      return p((px.x + 1) / 2, 0);
    };
  const leftTop = top(0.2),
    rightTop = top(0.8);
  return {
    version: "environment-observation-v1",
    topology: "room",
    surfaces: [
      face("left", "wall", [p(0, 0), leftTop, p(0.2, 0.7), p(0, 0.9)]),
      face("back", "wall", [leftTop, rightTop, p(0.8, 0.7), p(0.2, 0.7)]),
      face("right", "wall", [rightTop, p(1, 0), p(1, 0.9), p(0.8, 0.7)]),
      face("floor", "floor", [
        p(0, 0.9),
        p(0.2, 0.7),
        p(0.8, 0.7),
        p(1, 0.9),
        p(1, 1),
        p(0, 1),
      ]),
    ],
    openings: [
      {
        surfaceId: "back",
        kind: "window",
        polygon: [p(0.4, 0.15), p(0.6, 0.15), p(0.6, 0.4), p(0.4, 0.4)],
      },
    ],
    expectedWallCount: 3,
    lightingEffects: ["Cast shadows"],
    explanation: "Three walls and an open cropped floor.",
  };
}
function grid(plan: EnvironmentObservation): DepthGrid {
  const c = backgroundCamera(stage().camera),
    data = new Float32Array(518 * 518),
    confidence = new Float32Array(518 * 518).fill(10),
    floor = new Plane(new Vector3(0, 1, 0), 0),
    ray = (x: number, y: number) =>
      new Ray(
        c.position,
        new Vector3(x * 2 - 1, 1 - y * 2, 0.5)
          .unproject(c)
          .sub(c.position)
          .normalize(),
      );
  const walls = plan.surfaces
    .filter((s) => s.role === "wall")
    .map((s) => {
      const b = s.polygon
        .slice(2, 4)
        .map((p) => ray(p.x, p.y).intersectPlane(floor, new Vector3())!);
      const n = new Vector3(b[1].z - b[0].z, 0, b[0].x - b[1].x).normalize();
      return { s, plane: new Plane(n, -n.dot(b[0])) };
    });
  for (let y = 0; y < 294; y++)
    for (let x = 0; x < 518; x++) {
      const px = (x + 0.5) / 518,
        py = (y + 0.5) / 294,
        r = ray(px, py),
        wall = walls.find((w) => insidePolygon(p(px, py), w.s.polygon)),
        hit = r.intersectPlane(wall?.plane ?? floor, new Vector3());
      data[(y + 112) * 518 + x] = hit
        ? hit
            .clone()
            .sub(c.position)
            .dot(new Vector3(0, 0, -1).applyQuaternion(c.quaternion))
        : 2;
    }
  return {
    width: 518,
    height: 518,
    sourceWidth: 1600,
    sourceHeight: 900,
    content: { left: 0, top: 112, width: 518, height: 294 },
    data,
    confidence,
    intrinsic: [500, 0, 259, 0, 500, 259, 0, 0, 1],
  };
}
describe("Reference environment geometry", () => {
  it("builds all observed walls with shared contacts, real window holes and cropped-plane extensions", () => {
    const plan = room(),
      before = structuredClone(stage()),
      result = buildEnvironmentGeometry(plan, before, grid(plan));
    expect(result.report.walls).toBe(3);
    expect(result.report.openings).toBe(1);
    expect(result.report.coverage).toBeGreaterThan(0.99);
    expect(result.report.projectionError).toBeLessThan(0.005);
    expect(result.report.warnings).toEqual([]);
    const back = result.geometry.surfaces[1];
    expect(back.vertices.length).toBeGreaterThan(8);
    expect(back.triangles.length).toBeGreaterThan(12); // hole + outside-crop continuation
    const ground = result.geometry.surfaces.find((s) => s.role === "floor")!;
    expect(ground.vertices.every((v) => Math.abs(v[1]) < 0.001)).toBe(true);
    expect(ground.vertices.some((v) => Math.abs(v[0]) > 20)).toBe(true);
    expect(before).toEqual(stage()); // no object/camera changes
  });
  it("uses one extended floor for open scenes without inventing walls or openings", () => {
    const plan = room();
    plan.topology = "open";
    plan.surfaces = [
      face("floor", "floor", [p(0, 0.5), p(1, 0.5), p(1, 1), p(0, 1)]),
    ];
    plan.openings = [];
    plan.expectedWallCount = 0;
    const result = buildEnvironmentGeometry(plan, stage(), grid(plan));
    expect(result.geometry.surfaces.map((s) => s.role)).toEqual(["floor"]);
    expect(result.report.walls).toBe(0);
  });
  it("reports missing surfaces instead of certifying an incomplete room", () => {
    const plan = room(),
      g = grid(plan);
    g.confidence.fill(1);
    const result = buildEnvironmentGeometry(plan, stage(), g);
    expect(result.report.walls).toBeLessThan(3);
    expect(result.report.warnings.join(" ")).toContain("observed walls");
  });
  it("anchors a confirmed plain wall to its visible support seam when wall depth is missing", () => {
    const plan: EnvironmentObservation = {
      ...room(),
      surfaces: [
        face("back", "wall", [p(0, 0), p(1, 0), p(1, 0.7), p(0, 0.7)]),
        face("floor", "floor", [p(0, 0.7), p(1, 0.7), p(1, 1), p(0, 1)]),
      ],
      openings: [],
      expectedWallCount: 1,
    };
    const g = grid(plan);
    for (let y = 0; y < Math.floor(294 * 0.7); y++)
      for (let x = 0; x < 518; x++) g.data[(y + 112) * 518 + x] = 0;
    const result = buildEnvironmentGeometry(plan, stage(), g);
    expect(result.report.walls).toBe(1);
    expect(result.report.seamAnchoredWalls).toBe(1);
    expect(result.report.coverage).toBeGreaterThan(0.99);
    expect(result.report.projectionError).toBeLessThan(0.005);
    plan.surfaces[0].finish = "textured";
    plan.surfaces[0].appearance = "microtexture";
    plan.surfaces[0].material = "Fine plaster paint";
    expect(buildEnvironmentGeometry(plan, stage(), g).report.walls).toBe(1);
    plan.surfaces[0].confidence = 0.6;
    const uncertain = buildEnvironmentGeometry(plan, stage(), g);
    expect(uncertain.report.walls).toBe(0);
    plan.surfaces[0].confidence = 1;
    plan.surfaces[0].material = "blurred shadow boundary";
    expect(buildEnvironmentGeometry(plan, stage(), g).report.walls).toBe(0);
  });
  it("rejects private data, invalid openings and unsafe geometry in render contracts", () => {
    const plan = room();
    expect(
      environmentObservationSchema.safeParse({
        ...plan,
        openings: [{ ...plan.openings[0], surfaceId: "missing" }],
      }).success,
    ).toBe(false);
    const result = buildEnvironmentGeometry(plan, stage(), grid(plan));
    expect(
      environmentGeometrySchema.safeParse({
        ...result.geometry,
        photoId: "private",
      }).success,
    ).toBe(false);
    expect(
      environmentGeometrySchema.safeParse({
        ...result.geometry,
        surfaces: [{ ...result.geometry.surfaces[0], triangles: [0, 1, 95] }],
      }).success,
    ).toBe(false);
  });
});
describe("Meta depth coordinates", () => {
  it("decodes the 14-pixel model resize and removes padding for landscape and portrait photos", () => {
    const floats = (data: Float32Array, shape: number[]) => ({
      shape,
      dtype: "float32",
      data: Buffer.from(data.buffer).toString("base64"),
    });
    const d = new Float32Array(518 * 518).fill(99),
      confidence = new Float32Array(d.length).fill(10);
    for (let y = 112; y < 406; y++)
      for (let x = 0; x < 518; x++) d[y * 518 + x] = 2;
    const raw = {
      depth: floats(d, [518, 518, 1]),
      depth_conf: floats(confidence, [518, 518]),
      intrinsic: floats(
        new Float32Array([500, 0, 259, 0, 500, 259, 0, 0, 1]),
        [3, 3],
      ),
      original_image: { width: 1600, height: 900 },
    };
    const g = decodeEnvironmentDepth(raw);
    expect(g.content).toEqual({ left: 0, top: 112, width: 518, height: 294 });
    expect(depthAt(g, 0.5, 0)?.depth).toBe(2);
    expect(depthAt(g, 0.5, 1)?.depth).toBe(2);
    const portrait = decodeEnvironmentDepth({
      ...raw,
      original_image: { width: 900, height: 1600 },
    });
    expect(portrait.content).toEqual({
      left: 112,
      top: 0,
      width: 294,
      height: 518,
    });
    expect(() =>
      decodeEnvironmentDepth({ ...raw, depth: { ...raw.depth, data: "abcd" } }),
    ).toThrow();
  });
});
describe("Intrinsic background materials", () => {
  it("keeps natural finish detail while respecting explicitly uniform surfaces", () => {
    const surface = room().surfaces[0];
    expect(
      environmentUsesTexture({
        ...surface,
        finish: "plain",
        material: "matte plaster paint",
      }),
    ).toBe(true);
    expect(
      environmentUsesTexture({
        ...surface,
        finish: "plain",
        material: "uniform smooth plaster paint",
      }),
    ).toBe(false);
    expect(
      environmentUsesTexture({
        ...surface,
        finish: "plain",
        material: "white painted panel",
      }),
    ).toBe(false);
  });
  it("keeps plain surfaces uniform despite shadows and prevents foreground pixels entering the albedo", async () => {
    const width = 80,
      height = 80,
      source = Buffer.alloc(width * height * 3, 220),
      fill = Buffer.alloc(source.length, 180),
      mask = new Uint8Array(width * height);
    for (let y = 30; y < 50; y++)
      for (let x = 30; x < 50; x++) {
        const i = y * width + x;
        source[i * 3] = 255;
        source[i * 3 + 1] = 0;
        source[i * 3 + 2] = 255;
        mask[i] = 255;
      }
    const png = (b: Buffer) =>
      sharp(b, { raw: { width, height, channels: 3 } })
        .png()
        .toBuffer();
    const plan = room();
    plan.surfaces = [
      face("plain", "floor", [p(0, 0), p(1, 0), p(1, 1), p(0, 1)]),
    ];
    plan.openings = [];
    plan.surfaces[0].color = "#bbbbbb";
    const out = await sharp(
      await environmentAlbedo(await png(source), await png(fill), mask, plan),
    )
      .raw()
      .toBuffer();
    for (const i of [0, 40 * width + 40, width * height - 1])
      expect(
        Array.from(out.subarray(i * 3, i * 3 + 3)).every(
          (v) => Math.abs(v - 187) <= 2,
        ),
      ).toBe(true);
  });
});
import { referenceFov } from "../src/lib/scene/reference-framing";
it("keeps the entire photographed view on narrow displays", () => {
  expect(referenceFov(45, 16 / 9, 16 / 9)).toBeCloseTo(45);
  expect(referenceFov(45, 16 / 9, 0.6)).toBeGreaterThan(90);
  expect(referenceFov(45, 0.6, 16 / 9)).toBeCloseTo(45);
});

it("accepts openings clipped by an observed wall boundary", () => {
  const polygon = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)];
  expect(withinPolygon(p(1, 0.5), polygon)).toBe(true);
  expect(withinPolygon(p(0.5, 0), polygon)).toBe(true);
  expect(withinPolygon(p(1.1, 0.5), polygon)).toBe(false);
});

it("anchors a horizontal support surface without requiring the floor label", () => {
  const plan = room();
  plan.surfaces.find((s) => s.role === "floor")!.role = "surface" as never;
  const result = buildEnvironmentGeometry(plan, stage(), grid(plan));
  expect(result.report.projectionError).toBeLessThan(0.005);
  expect(
    result.report.warnings.some((w) => w.includes("No reliable ground")),
  ).toBe(false);
});

it("preserves Muse material contrast without reintroducing source shadows or crossing material boundaries", async () => {
  const w = 80,
    h = 80,
    source = Buffer.alloc(w * h * 3, 0),
    generated = Buffer.alloc(w * h * 3),
    mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++)
        generated[(y * w + x) * 3 + c] =
          (x < 40 ? 130 : 220) + (Math.floor(y / 8) % 2) * 20;
  const plan = room();
  plan.openings = [];
  plan.surfaces = [
    face("wood", "floor", [p(0, 0), p(0.5, 0), p(0.5, 1), p(0, 1)]),
    face("paint", "wall", [p(0.5, 0), p(1, 0), p(1, 1), p(0.5, 1)]),
  ];
  plan.surfaces[0].finish = "textured";
  plan.surfaces[1].color = "#eeeeee";
  const png = (b: Buffer) =>
    sharp(b, { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toBuffer();
  const out = await sharp(
    await environmentAlbedo(
      await png(source),
      await png(generated),
      mask,
      plan,
    ),
  )
    .removeAlpha()
    .raw()
    .toBuffer();
  expect(
    Math.abs(out[(12 * w + 20) * 3] - out[(20 * w + 20) * 3]),
  ).toBeGreaterThan(12);
  expect(out[(12 * w + 20) * 3]).toBeGreaterThan(120);
  expect(Math.abs(out[(20 * w + 60) * 3] - 238)).toBeLessThan(3);
});
