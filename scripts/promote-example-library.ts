/** Publish only this explicitly approved Muse/Meta batch. No inference and no source-scene edits.
 * Incremental --partial retains unfinished jobs; the final run requires all 38 builds.
 * node --conditions=react-server --import tsx scripts/promote-example-library.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { getDb } from "../src/lib/db";
import { Prisma } from "../src/generated/prisma/client";
import { exampleProducts, exampleScenes } from "../src/lib/demo/example-batch";
import { exampleListing } from "../src/lib/demo/example-listings";
import {
  readLimited,
  putObject,
  storagePrefix,
  bucket,
} from "../src/lib/storage/r2";
import { optimizeDemoModel } from "../src/lib/demo/optimize-model";
import {
  compositionSchema,
  glbBounds,
  type ModelPlacement,
} from "../src/lib/scene/composition";
import { flattenTransform } from "../src/lib/scene/manifest";
import { defaultLighting, lightingSchema } from "../src/lib/scene/lighting";
import { inspectGlb } from "../src/lib/ai/glb";
import { record } from "../src/lib/services/composition";
import { referenceView } from "../src/lib/quality/pipeline";
import { readMesh } from "../src/lib/quality/mesh";
import type { DemoProduct } from "../src/lib/demo/catalog";
const db = getDb(),
  folder = "test-results/demo-expansion-v1",
  partial = process.argv.includes("--partial"),
  json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Model = {
  id: string;
  digest: string;
  bytes: number;
  position: [number, number, number];
  placement: ModelPlacement;
};
type Receipt = {
  status: string;
  path: string;
  sha256: string;
  width: number;
  height: number;
  model: string;
  generatedAt: string;
};
const source = await db.scene.findUniqueOrThrow({
  where: { id: "6800b8a2-7c39-4a52-8fde-790eb03ab46c" },
  select: { ownerId: true },
});
const products: DemoProduct[] = JSON.parse(
    await readFile("src/lib/demo/catalog-data.json", "utf8"),
  ),
  models: Model[] = JSON.parse(
    await readFile("src/lib/demo/catalog-models.json", "utf8"),
  ),
  frozen = JSON.parse(
    await readFile("src/lib/demo/frozen-scenes.json", "utf8"),
  ),
  collections: {
    id: string;
    name: string;
    caption: string;
    products: string[];
  }[] = JSON.parse(
    await readFile("src/lib/demo/collections-data.json", "utf8"),
  );
let media: {
  version: number;
  model: string;
  products: Record<string, unknown[]>;
  scenes: Record<string, unknown[]>;
};
try {
  media = JSON.parse(await readFile("src/lib/demo/example-media.json", "utf8"));
} catch {
  media = { version: 1, model: "muse-image-1.0", products: {}, scenes: {} };
}
await mkdir(`${folder}/approved`, { recursive: true });
await mkdir("public/demo/images", { recursive: true });
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
async function photograph(id: string) {
  const r: Receipt = JSON.parse(
    await readFile(`${folder}/${id}-image.json`, "utf8"),
  );
  const bytes = await readFile(`public${r.path}`);
  if (
    r.status !== "SUCCEEDED" ||
    hash(bytes) !== r.sha256 ||
    r.model !== "muse-image-1.0"
  )
    throw new Error(`Muse photograph not ready: ${id}`);
  return { r, bytes };
}
function entry(id: string, r: Receipt, setting: string) {
  return {
    id: setting,
    title:
      setting === "studio" ? "Studio photograph" : "Reference scene photograph",
    path: r.path,
    kind: "generated",
    color: setting === "studio" ? 0 : null,
    setting,
    sha256: r.sha256,
    width: r.width,
    height: r.height,
    model: r.model,
  };
}
async function saveSnapshots() {
  for (const scene of frozen.scenes) {
    compositionSchema.parse(scene.composition);
    lightingSchema.parse(scene.lighting);
  }
  for (const [file, data] of [
    ["catalog-data.json", products],
    ["catalog-models.json", models],
    ["frozen-scenes.json", frozen],
    ["collections-data.json", collections],
    ["example-media.json", media],
  ] as const) {
    const name = `src/lib/demo/${file}`;
    await writeFile(`${name}.tmp`, JSON.stringify(data, null, 2) + "\n");
    await rename(`${name}.tmp`, name);
  }
}
type ObjectRow = Prisma.SceneObjectGetPayload<{
  include: { model: true; product: true };
}>;
type SceneRow = Prisma.SceneGetPayload<{
  include: { objects: { include: { model: true; product: true } } };
}>;
function placement(o: ObjectRow, bytes: Buffer, id: string): Model {
  const bounds = glbBounds(bytes),
    t = flattenTransform(o, bounds),
    matrix = new Matrix4().compose(
      new Vector3(...t.position),
      new Quaternion(...t.rotation),
      new Vector3(...t.scale),
    ),
    world = new Box3();
  const point = new Vector3();
  // Bounds after the true vertex transforms, not a rotated bounding box whose
  // empty corners can make replacements appear to float above their support.
  for (const primitive of readMesh(bytes, matrix).primitives)
    for (let i = 0; i < primitive.positions.length; i += 3)
      world.expandByPoint(point.fromArray(primitive.positions, i));
  const center = world.getCenter(new Vector3()),
    size = world.getSize(new Vector3());
  return {
    id,
    digest: hash(bytes),
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
  };
}
// Complete one-to-one noun + image-position match, not provider output order.
function matchObjects(
  scene: SceneRow,
  definition: (typeof exampleScenes)[number],
) {
  const objects = scene.objects.filter(
      (o) => o.visible && o.status === "READY" && o.modelAssetId,
    ),
    concepts = definition.concepts;
  if (objects.length !== concepts.length)
    throw new Error(`Inventory requires review: ${definition.id}`);
  const terms = (v: string) =>
    v
      .toLowerCase()
      .replace(/refrigerator/g, "fridge")
      .replace(/armchair/g, "chair upholstered")
      .replace(/chest of drawers/g, "drawer")
      .replace(/drawers|dresser/g, "drawer")
      .replace(/lunch box/g, "lunchbox")
      .replace(/molded|shell/g, "gray")
      .replace(/lace.up|leather shoe/g, "shoe")
      .replace(/perfume bottle/g, "perfume")
      .replace(/middle/g, "center")
      .split(/[^a-z]+/)
      .filter(
        (w) =>
          w &&
          ![
            "one",
            "the",
            "a",
            "of",
            "with",
            "and",
            "closed",
            "wooden",
            "metal",
            "red",
          ].includes(w),
      );
  let best: number[] | null = null,
    bestScore = -Infinity;
  const horizontalOrder = objects
    .map((o, index) => {
      const b = record(o.imageBounds);
      return { index, x: (Number(b.xMin) + Number(b.xMax)) / 2 };
    })
    .sort((a, b) => a.x - b.x);
  function visit(indices: number[], remaining: number[], score: number) {
    const i = indices.length;
    if (i === concepts.length) {
      if (score > bestScore) {
        bestScore = score;
        best = indices;
      }
      return;
    }
    const words = terms(concepts[i]);
    for (const index of remaining) {
      const o = objects[index],
        label = terms(o.label),
        x =
          (horizontalOrder.findIndex((p) => p.index === index) + 0.5) /
          objects.length;
      let local = words.reduce((n, w) => n + (label.includes(w) ? 5 : 0), 0);
      if (
        definition.id === "appliances" ||
        definition.id === "fragrance" ||
        definition.id === "chair-studio" ||
        definition.id === "home-essentials" ||
        definition.id === "city-style" ||
        definition.id === "daily-carry"
      )
        local -= Math.abs(
          (Number.isFinite(x) ? x : 0.5) - (i + 0.5) / concepts.length,
        );
      visit(
        [...indices, index],
        remaining.filter((v) => v !== index),
        score + local,
      );
    }
  }
  visit(
    [],
    objects.map((_, i) => i),
    0,
  );
  if (!best) throw new Error("Inventory mapping failed");
  return (best as number[]).map((i) => objects[i]);
}
async function promoteProduct(scene: SceneRow, o: ObjectRow, id: string) {
  if (
    !o.model ||
    o.model.sceneId !== scene.id ||
    o.model.status !== "READY" ||
    o.model.kind !== "MODEL_GLB" ||
    !o.productId ||
    record(o.provenance).assemblyRootId ||
    record(o.provenance).parentObjectId
  )
    throw new Error(`Independent source model required: ${id}`);
  const receiptPath = `${folder}/approved/${id}.json`,
    photo = await photograph(id),
    listing = exampleListing(id);
  let model: Model, assetId: string;
  let approved: {
    sourceAssetId: string;
    sourceRevision: number;
    imageHash: string;
    model: Model;
    assetId: string;
  } | null = null;
  try {
    approved = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch {}
  if (approved) {
    if (
      approved.sourceAssetId !== o.model.id ||
      approved.imageHash !== photo.r.sha256
    )
      throw new Error(
        `Approved source changed; review before replacing: ${id}`,
      );
    model = placement(o, await readFile(`${folder}/approved/${id}.glb`), id);
    if (model.digest !== approved.model.digest)
      throw new Error("Approved model copy changed");
    assetId = approved.assetId;
  } else {
    const bytes = await optimizeDemoModel(
      await readLimited(o.model.storageKey, 40 * 1024 * 1024),
      16 * 1024 * 1024,
    );
    inspectGlb(bytes);
    model = placement(o, bytes, id);
    const key = `${storagePrefix()}/demo/store-v1/${model.digest}.glb`,
      existing = await db.asset.findUnique({
        where: { bucket_storageKey: { bucket: bucket(), storageKey: key } },
      });
    if (existing && existing.sceneId !== scene.id)
      throw new Error("Public copy must retain scene ownership");
    if (!existing) await putObject(key, bytes, "model/gltf-binary");
    const asset =
      existing ??
      (await db.asset.create({
        data: {
          sceneId: scene.id,
          kind: "MODEL_GLB",
          status: "READY",
          bucket: bucket(),
          storageKey: key,
          mimeType: "model/gltf-binary",
          byteSize: bytes.length,
          sha256: model.digest,
          derivedFromId: o.model.id,
          readyAt: new Date(),
          provenance: {
            source: "approved-muse-demo-expansion",
            publicApproved: true,
          },
        },
      }));
    assetId = asset.id;
    await writeFile(`${folder}/approved/${id}.glb`, bytes, { mode: 0o600 });
    // Inspection only. These renders are NEVER product photography/public assets.
    try {
      const png = await referenceView(
        [
          {
            bytes,
            placement: {
              id,
              position: model.position,
              placement: model.placement,
            },
          },
        ],
        compositionSchema.parse(scene.stage),
        360,
        360,
      );
      await writeFile(`${folder}/approved/${id}-inspection.png`, png, {
        mode: 0o600,
      });
    } catch {
      console.log(`${id}: private render unavailable; binary validated`);
    }
  }
  const imageKey = `${storagePrefix()}/scenes/${scene.id}/catalog-images/${photo.r.sha256}.webp`;
  let image = await db.asset.findUnique({
    where: { bucket_storageKey: { bucket: bucket(), storageKey: imageKey } },
  });
  if (!image) {
    await putObject(imageKey, photo.bytes, "image/webp");
    image = await db.asset.create({
      data: {
        sceneId: scene.id,
        kind: "PRODUCT_IMAGE",
        status: "READY",
        bucket: bucket(),
        storageKey: imageKey,
        mimeType: "image/webp",
        byteSize: photo.bytes.length,
        width: photo.r.width,
        height: photo.r.height,
        sha256: photo.r.sha256,
        readyAt: new Date(),
        provenance: {
          source: "muse-image-1.0",
          publicPath: photo.r.path,
          publicApproved: true,
        },
      },
    });
  }
  const data = {
    sceneId: scene.id,
    name: listing.name,
    description: listing.description,
    brand: "ReScene Collection",
    sku: `RS-${id.toUpperCase()}`,
    price: (listing.price / 100).toFixed(2),
    currency: "USD",
    modelAssetId: assetId,
    imageAssetId: image.id,
    catalogRole: "SOURCE" as const,
    catalogStatus: "READY" as const,
    sourceProductId: o.productId,
    inferredDetails: json({
      ...listing,
      publicApproved: true,
      publicModelDigest: model.digest,
      independent: true,
      listingOrigin: "authored-catalog",
      curationBatch: "demo-expansion-v1",
    }),
  };
  const canonical = await db.product.findUnique({ where: { catalogKey: id } });
  if (
    canonical &&
    (canonical.sceneId !== scene.id ||
      record(canonical.inferredDetails).curationBatch !== "demo-expansion-v1")
  )
    throw new Error("Catalog key already belongs to another listing");
  await db.product.upsert({
    where: { catalogKey: id },
    create: { ...data, catalogKey: id },
    update: data,
  });
  // Source listing also gets the same authored specifications and Muse photo.
  await db.product.update({
    where: { id: o.productId, sceneId: scene.id },
    data: {
      name: listing.name,
      description: listing.description,
      brand: data.brand,
      price: data.price,
      currency: "USD",
      imageAssetId: image.id,
      inferredDetails: json({
        ...record(o.product?.inferredDetails),
        ...listing,
        independent: true,
        listingOrigin: "authored-catalog",
      }),
    },
  });
  const pi = products.findIndex((p) => p.id === id);
  if (pi < 0) products.push(listing);
  else products[pi] = listing;
  const mi = models.findIndex((m) => m.id === id);
  if (mi < 0) models.push(model);
  else models[mi] = model;
  media.products[id] = [entry(id, photo.r, "studio")];
  await writeFile(
    receiptPath,
    JSON.stringify(
      {
        sourceAssetId: o.model.id,
        sourceRevision: scene.revision,
        imageHash: photo.r.sha256,
        model,
        assetId,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(`${id}: approved photo, model and priced listing ready`);
  return model;
}
let complete = 0;
try {
  for (const job of [
    ...exampleProducts.map((p) => ({ id: p.id, scene: false })),
    ...exampleScenes.map((s) => ({ id: s.id, scene: true })),
  ].filter(
    (j) =>
      !process.env.EXAMPLE_ONLY ||
      process.env.EXAMPLE_ONLY.split(",").includes(j.id),
  )) {
    let state: {
      complete?: boolean;
      sceneId: string;
      backgroundRunId?: string;
    };
    try {
      state = JSON.parse(
        await readFile(`${folder}/${job.id}-build.json`, "utf8"),
      );
    } catch {
      if (partial) continue;
      throw new Error(`Build not started: ${job.id}`);
    }
    if (!state.complete) {
      if (partial) continue;
      throw new Error(`Build not complete: ${job.id}`);
    }
    if (job.scene) {
      const background = state.backgroundRunId
        ? await db.generationRun.findUnique({
            where: { id: state.backgroundRunId },
            select: { status: true },
          })
        : null;
      if (!background || !["SUCCEEDED", "PARTIAL"].includes(background.status))
        throw new Error(`Background requires review: ${job.id}`);
    }
    const scene = await db.scene.findFirstOrThrow({
      where: {
        id: state.sceneId,
        ownerId: source.ownerId,
        archivedAt: null,
        status: "READY",
        runs: {
          none: {
            status: {
              in: ["QUEUED", "RUNNING", "WAITING", "CANCEL_REQUESTED"],
            },
          },
        },
      },
      include: {
        objects: {
          include: { model: true, product: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (
      record(scene.settings).exampleKey !== job.id ||
      scene.id === "f2848b95-8447-41eb-9544-0d72dd605565"
    )
      throw new Error("Not a batch-owned example");
    if (!job.scene) {
      const rows = scene.objects.filter(
        (o) => o.visible && o.status === "READY" && o.modelAssetId,
      );
      if (rows.length !== 1)
        throw new Error(`Expected exactly one product: ${job.id}`);
      await promoteProduct(scene, rows[0], job.id);
    } else {
      const definition = exampleScenes.find((s) => s.id === job.id)!,
        rows = matchObjects(scene, definition),
        objects: Model[] = [];
      for (const [i, o] of rows.entries())
        objects.push(await promoteProduct(scene, o, `${job.id}-item-${i + 1}`));
      const photo = await photograph(job.id);
      await writeFile(`public/demo/images/${job.id}.webp`, photo.bytes);
      media.scenes[job.id] = [entry(job.id, photo.r, "reference")];
      const composition = compositionSchema.parse(scene.stage);
      composition.warnings = [];
      if (composition.background)
        composition.background.description = "Curated Muse Image environment.";
      const appearance: {
        applied: boolean;
        floorUrl: string | null;
        wallUrl: string | null;
        backgroundUrl: string | null;
      } = {
        applied: false,
        floorUrl: null,
        wallUrl: null,
        backgroundUrl: null,
      };
      const bg = record(record(scene.settings).background);
      for (const [field, sourceKey] of [
        ["floorUrl", "floorId"],
        ["wallUrl", "wallId"],
        ["backgroundUrl", "assetId"],
      ] as const) {
        const id = bg[sourceKey];
        if (typeof id !== "string") continue;
        const asset = await db.asset.findFirstOrThrow({
            where: {
              id,
              sceneId: scene.id,
              kind: "SURFACE_TEXTURE",
              status: "READY",
            },
          }),
          path = `/demo/images/${job.id}-${field}.webp`;
        await sharp(await readLimited(asset.storageKey, 32 * 1024 * 1024))
          .webp({ quality: 95 })
          .toFile(`public${path}`);
        appearance[field] = path;
        appearance.applied = true;
      }
      const snapshot = {
        id: job.id,
        composition,
        lighting:
          lightingSchema.safeParse(record(scene.settings).lighting).data ??
          defaultLighting(composition),
        appearance,
        objects,
      };
      const fi = frozen.scenes.findIndex(
        (s: { id: string }) => s.id === job.id,
      );
      if (fi < 0) frozen.scenes.push(snapshot);
      else frozen.scenes[fi] = snapshot;
      const info = {
          id: job.id,
          name: definition.title,
          caption: definition.caption,
          products: objects.map((o) => o.id),
        },
        ci = collections.findIndex((c) => c.id === job.id);
      if (ci < 0) collections.push(info);
      else collections[ci] = info;
    }
    complete++;
    await saveSnapshots();
  }
  console.log(
    JSON.stringify({
      completeBuildsPromoted: complete,
      approvedListings: products.length,
      collections: collections.length,
      allReady: complete === 38,
    }),
  );
} finally {
  await db.$disconnect();
}
