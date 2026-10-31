/** Explicit curation command. No scene/DB writes and no inference. Run with
 * node --conditions=react-server --import tsx scripts/export-demo-store.ts
 * It creates immutable, approved demo copies of ONLY these selected render assets.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { getDb } from "../src/lib/db";
import { readLimited, putObject, storagePrefix } from "../src/lib/storage/r2";
import { inspectGlb } from "../src/lib/ai/glb";
import { glbBounds, compositionSchema } from "../src/lib/scene/composition";
import { flattenTransform } from "../src/lib/scene/manifest";
import { defaultLighting, lightingSchema } from "../src/lib/scene/lighting";
import { optimizeDemoModel } from "../src/lib/demo/optimize-model";

const selections = [
  {
    id: "6800b8a2-7c39-4a52-8fde-790eb03ab46c",
    slug: "corner",
    revision: 102,
    products: ["corner-chair", "corner-cabinet", "corner-vase"],
    objectIds: [
      "fb506dbc-8182-4125-af82-13255508c25f",
      "2354cd5f-793b-4a46-bea0-89ade18e3189",
      "85da158b-34e5-469d-8228-95ceb564e115",
    ],
  },
  {
    id: "41f2f4b8-5f05-4834-a5f3-0345f9015c39",
    slug: "space",
    revision: 13,
    products: ["oak-dresser", "sage-chair", "round-table", "dining-chair"],
    objectIds: [
      "eaf99f02-6148-42d4-942c-37556b58b475",
      "44df24a4-9f1d-4c4d-bcb4-5d200300226d",
      "126230a4-4378-48d1-911d-3efc41a4f0a5",
      "6aba43e0-7ca7-4d7e-8cce-fa149f32c32a",
    ],
  },
  {
    id: "eb34c54c-3795-4cb0-a17a-3264f29c753e",
    slug: "living",
    revision: 10,
    products: ["cloud-sofa", "coffee-table", "wood-stool", "ceramic-vase"],
    objectIds: [
      "c24acfa9-15cf-44b5-a857-7b7696008672",
      "d57a403a-1aeb-4d7c-9994-b2065d3f6e8d",
      "d1e26a0e-0562-437e-b208-c0dc67101e12",
      "b5666177-6bdf-4937-91ff-409d0213f5a2",
    ],
  },
];
const db = getDb();
await mkdir("public/demo/images", { recursive: true });
await mkdir("src/lib/demo", { recursive: true });
const exported: Array<{ id: string; [key: string]: unknown }> = [];
try {
  let owner: string | undefined;
  for (const selection of selections.filter(
    (s) =>
      !process.env.DEMO_COLLECTION || s.slug === process.env.DEMO_COLLECTION,
  )) {
    const scene = await db.scene.findUniqueOrThrow({
      where: { id: selection.id },
      include: {
        normalizedAsset: true,
        objects: {
          where: { status: "READY", modelAssetId: { not: null } },
          include: { model: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    owner ??= scene.ownerId;
    if (
      scene.ownerId !== owner ||
      scene.archivedAt ||
      scene.status !== "READY" ||
      scene.revision !== selection.revision ||
      scene.objects.length !== selection.products.length ||
      scene.objects.some((o, i) => o.id !== selection.objectIds[i]) ||
      !scene.normalizedAsset
    )
      throw new Error(
        "Curated scene changed; deliberately review the selection before exporting again.",
      );
    const photo = await readLimited(
      scene.normalizedAsset.storageKey,
      16 * 1024 * 1024,
    );
    // These are intentionally selected synthetic sample comparison copies.
    // Strip metadata and never expose the source asset URL, object IDs or masks.
    await sharp(photo)
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(`public/demo/images/${selection.slug}.webp`);
    const composition = compositionSchema.parse(scene.stage);
    composition.warnings = [];
    if (composition.background)
      composition.background.description = "Curated demo environment.";
    const appearance: {
      applied: boolean;
      floorUrl: string | null;
      wallUrl: string | null;
      backgroundUrl: string | null;
    } = { applied: false, floorUrl: null, wallUrl: null, backgroundUrl: null };
    const settings = scene.settings as Record<string, unknown>,
      bg = settings.background as Record<string, unknown> | undefined;
    for (const [field, source] of [
      ["floorUrl", "floorId"],
      ["wallUrl", "wallId"],
      ["backgroundUrl", "assetId"],
    ] as const) {
      const id = bg?.[source];
      if (typeof id !== "string") continue;
      const asset = await db.asset.findFirstOrThrow({
        where: {
          id,
          sceneId: scene.id,
          kind: "SURFACE_TEXTURE",
          status: "READY",
        },
      });
      const bytes = await readLimited(asset.storageKey, 16 * 1024 * 1024);
      const filename = `${selection.slug}-${field}.webp`;
      await sharp(bytes)
        .webp({ quality: 93 })
        .toFile(`public/demo/images/${filename}`);
      appearance[field] = `/demo/images/${filename}`;
      appearance.applied = true;
    }
    const objects = [];
    for (let i = 0; i < scene.objects.length; i++) {
      const o = scene.objects[i],
        id = selection.products[i];
      if (
        !o.model ||
        o.model.sceneId !== scene.id ||
        o.model.kind !== "MODEL_GLB" ||
        o.model.status !== "READY" ||
        (o.provenance as Record<string, unknown>).assemblyRootId
      )
        throw new Error(
          "Only complete independent approved models may be exported.",
        );
      const bytes = await optimizeDemoModel(
        await readLimited(o.model.storageKey, 40 * 1024 * 1024),
      );
      inspectGlb(bytes);
      const digest = createHash("sha256").update(bytes).digest("hex");
      await putObject(
        `${storagePrefix()}/demo/store-v1/${digest}.glb`,
        bytes,
        "model/gltf-binary",
      );
      const bounds = glbBounds(bytes),
        t = flattenTransform(o, bounds);
      const matrix = new Matrix4().compose(
        new Vector3(...t.position),
        new Quaternion(...t.rotation),
        new Vector3(...t.scale),
      );
      const world = new Box3(
          new Vector3(...bounds.min),
          new Vector3(...bounds.max),
        ).applyMatrix4(matrix),
        center = world.getCenter(new Vector3()),
        size = world.getSize(new Vector3());
      objects.push({
        id,
        digest,
        bytes: bytes.length,
        position: [center.x, world.min.y, center.z],
        placement: {
          version: "sam3d-layout-v1",
          rotation: t.rotation,
          scale: t.scale,
          offset: [
            t.position[0] - center.x,
            t.position[1] - world.min.y,
            t.position[2] - center.z,
          ],
          size: size.toArray(),
        },
      });
      const b = o.imageBounds as {
        xMin: number;
        yMin: number;
        xMax: number;
        yMax: number;
      };
      const meta = await sharp(photo).metadata(),
        pad = 16;
      const left = Math.max(0, b.xMin - pad),
        top = Math.max(0, b.yMin - pad),
        width = Math.min(meta.width! - left, b.xMax - b.xMin + pad * 2),
        height = Math.min(meta.height! - top, b.yMax - b.yMin + pad * 2);
      await sharp(photo)
        .extract({ left, top, width, height })
        .resize(700, 700, { fit: "contain", background: "#f3f0e9" })
        .webp({ quality: 90 })
        .toFile(`public/demo/images/${id}.webp`);
      console.log(`Curated ${id}: ${Math.round(bytes.length / 1024)} KB`);
    }
    exported.push({
      id: selection.slug,
      composition,
      appearance,
      lighting:
        lightingSchema.safeParse(settings.lighting).data ??
        defaultLighting(composition),
      objects,
    });
  }
  const previous = JSON.parse(
    await readFile("src/lib/demo/frozen-scenes.json", "utf8"),
  );
  const combined = [
    ...previous.scenes.filter(
      (s: { id: string }) => !exported.some((e) => e.id === s.id),
    ),
    ...exported,
  ];
  await writeFile(
    "src/lib/demo/frozen-scenes.json",
    JSON.stringify({ version: 1, scenes: combined }, null, 2) + "\n",
  );
  console.log(
    "Demo catalog frozen. Source scenes and merchant records unchanged.",
  );
} finally {
  await db.$disconnect();
}
