/** Existing model/data reuse only. --apply persists listings; --export publishes only explicit curated derivatives. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { getDb } from "../src/lib/db";
import { syncSceneProducts } from "../src/lib/services/product-library";
import {
  readLimited,
  putObject,
  headObject,
  storagePrefix,
  bucket,
} from "../src/lib/storage/r2";
import { optimizeDemoModel } from "../src/lib/demo/optimize-model";
import { flattenTransform } from "../src/lib/scene/manifest";
import { glbBounds } from "../src/lib/scene/composition";
import { inspectGlb } from "../src/lib/ai/glb";
import { decimalToCents, listingProfile } from "../src/lib/shopping/listing";
import { Prisma } from "../src/generated/prisma/client";
import type { DemoProduct } from "../src/lib/demo/catalog";
import { productCover } from "../src/lib/demo/albums";
const db = getDb(),
  apply = process.argv.includes("--apply"),
  exporting = process.argv.includes("--export"),
  json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const protectedId = "f2848b95-8447-41eb-9544-0d72dd605565";
const sourceScenes: Record<string, string> = {
  corner: "6800b8a2-7c39-4a52-8fde-790eb03ab46c",
  space: "41f2f4b8-5f05-4834-a5f3-0345f9015c39",
  living: "eb34c54c-3795-4cb0-a17a-3264f29c753e",
};
const extraScene = "56e639ae-0d13-463b-897b-93b18791fb72";
try {
  const frozen = JSON.parse(
      await readFile("src/lib/demo/frozen-scenes.json", "utf8"),
    ),
    products: DemoProduct[] = JSON.parse(
      await readFile("src/lib/demo/catalog-data.json", "utf8"),
    ),
    models = JSON.parse(
      await readFile("src/lib/demo/catalog-models.json", "utf8"),
    );
  const roots = await db.scene.findMany({
      where: { id: { in: Object.values(sourceScenes) } },
      select: { ownerId: true },
    }),
    owners = new Set(roots.map((s) => s.ownerId));
  if (owners.size !== 1)
    throw new Error("Curated catalog must have one verified owner");
  const ownerId = [...owners][0],
    scenes = await db.scene.findMany({
      where: {
        ownerId,
        id: { not: protectedId },
        status: "READY",
        archivedAt: null,
        runs: {
          none: {
            status: {
              in: ["RUNNING", "QUEUED", "WAITING", "CANCEL_REQUESTED"],
            },
          },
        },
      },
      select: {
        id: true,
        revision: true,
        objects: { select: { id: true, productId: true, modelAssetId: true } },
      },
    });
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      scenes: scenes.length,
      readyObjects: scenes.reduce(
        (n, s) => n + s.objects.filter((o) => o.modelAssetId).length,
        0,
      ),
      approvedProducts: products.length,
    }),
  );
  if (!apply) process.exit(0);
  await mkdir("test-results/stylist", { recursive: true });
  const backup = `test-results/stylist/catalog-before-${Date.now()}.json`;
  await writeFile(
    backup,
    JSON.stringify(
      {
        scenes,
        products: await db.product.findMany({ where: { scene: { ownerId } } }),
      },
      null,
      2,
    ),
  );
  let saved = 0;
  for (const [index, s] of (process.argv.includes("--export-only") ||
  process.argv.includes("--details-only")
    ? []
    : scenes
  ).entries()) {
    saved += (await syncSceneProducts(s.id)).saved;
    if ((index + 1) % 8 === 0)
      console.log(`Prepared ${index + 1}/${scenes.length} projects`);
  }
  if (process.argv.includes("--details-only")) {
    const rows = await db.product.findMany({
      where: { scene: { ownerId, archivedAt: null, id: { not: protectedId } } },
    });
    let enriched = 0;
    for (const row of rows) {
      const profile = listingProfile(row.name),
        details = row.inferredDetails as Record<string, unknown>,
        attrs = row.attributes as Record<string, unknown>;
      const data = {
        description:
          !row.description ||
          row.description.startsWith("Original ReScene demo asset")
            ? profile.description
            : row.description,
        brand:
          !row.brand || row.brand === "ReScene Demo"
            ? "ReScene Living"
            : row.brand,
        sku: row.sku ?? `RS-${row.id.slice(0, 8).toUpperCase()}`,
        price: row.price ?? profile.price,
        currency: row.currency ?? "USD",
        inferredDetails: json({
          ...profile,
          ...details,
          version: 1,
          listingOrigin: "authored-catalog",
        }),
        ...(attrs.catalogVersion === "demo-v1"
          ? { catalogRole: "TEMPLATE" as const }
          : {}),
      };
      const changed = await db.product.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data,
      });
      enriched += changed.count;
    }
    console.log(JSON.stringify({ enriched, backup }));
    process.exit(0);
  }
  // Register already public approved copies without changing live source objects.
  for (const p of products) {
    const model = models.find((m: { id: string }) => m.id === p.id);
    if (!model) throw new Error("Approved product model missing");
    const collection = frozen.scenes.find((s: { objects: { id: string }[] }) =>
      s.objects.some((o) => o.id === p.id),
    );
    if (!collection) continue;
    const sceneId = sourceScenes[collection.id],
      key = `${storagePrefix()}/demo/store-v1/${model.digest}.glb`;
    const registered = await db.asset.findUnique({
      where: { bucket_storageKey: { bucket: bucket(), storageKey: key } },
    });
    if (!registered) {
      const info = await headObject(key);
      if (info.ContentLength !== model.bytes)
        throw new Error("Approved model size mismatch");
    }
    const asset = await db.asset.upsert({
      where: { bucket_storageKey: { bucket: bucket(), storageKey: key } },
      update: {},
      create: {
        sceneId,
        kind: "MODEL_GLB",
        status: "READY",
        bucket: bucket(),
        storageKey: key,
        mimeType: "model/gltf-binary",
        byteSize: model.bytes,
        sha256: model.digest,
        readyAt: new Date(),
        provenance: { source: "approved-shopping-release" },
      },
    });
    const imagePath = productCover(p.id),
      imageBytes = await readFile(`public${imagePath}`),
      imageHash = createHash("sha256").update(imageBytes).digest("hex"),
      imageKey = `${storagePrefix()}/scenes/${sceneId}/catalog-images/${imageHash}.webp`;
    let image = await db.asset.findUnique({
      where: { bucket_storageKey: { bucket: bucket(), storageKey: imageKey } },
    });
    if (!image) {
      await putObject(imageKey, imageBytes, "image/webp");
      image = await db.asset.create({
        data: {
          sceneId,
          kind: "PRODUCT_IMAGE",
          status: "READY",
          bucket: bucket(),
          storageKey: imageKey,
          mimeType: "image/webp",
          byteSize: imageBytes.length,
          sha256: imageHash,
          readyAt: new Date(),
          provenance: {
            source: "approved-shopping-photography",
            publicPath: imagePath,
          },
        },
      });
    }
    const data = {
      sceneId,
      name: p.name,
      description: p.description,
      brand: "ReScene Living",
      sku: `RS-${p.id.toUpperCase()}`,
      price: (p.price / 100).toFixed(2),
      currency: "USD",
      modelAssetId: asset.id,
      imageAssetId: image.id,
      catalogRole: "SOURCE" as const,
      catalogStatus: "READY" as const,
      inferredDetails: json({
        ...p,
        publicApproved: true,
        publicModelDigest: model.digest,
        listingOrigin: "authored-catalog",
      }),
    };
    await db.product.upsert({
      where: { catalogKey: p.id },
      create: { ...data, catalogKey: p.id },
      update: { imageAssetId: image.id },
    });
  }
  if (exporting) {
    const scene = await db.scene.findFirstOrThrow({
      where: { id: extraScene, ownerId, archivedAt: null, status: "READY" },
      include: {
        objects: {
          where: { status: "READY" },
          include: { product: { include: { imageAsset: true } }, model: true },
        },
      },
    });
    const selections = [
      {
        key: "sol-ceramic-lamp",
        pattern: /lamp/i,
        name: "Sol Ceramic Table Lamp",
        subtitle: "A softer glow for your everyday.",
        price: 7900,
      },
      {
        key: "cove-accent-chair",
        pattern: /armchair/i,
        name: "Cove Upholstered Armchair",
        subtitle: "Sink into a warmer corner.",
        price: 21900,
      },
      {
        key: "terra-side-table",
        pattern: /side table/i,
        name: "Terra Wood Side Table",
        subtitle: "A useful surface, beautifully simple.",
        price: 9900,
      },
    ];
    await mkdir("public/demo/images", { recursive: true });
    for (const selection of selections) {
      const o = scene.objects.find((o) => selection.pattern.test(o.label));
      if (!o?.model || !o.product?.imageAsset)
        throw new Error("Curated generated product is incomplete");
      const origin = o.provenance as Record<string, unknown>;
      if (origin.assemblyRootId || origin.parentObjectId)
        throw new Error(
          "Shared-atlas subject parts require separate public approval",
        );
      const details = o.product.inferredDetails as Record<string, unknown>,
        bytes = await optimizeDemoModel(
          await readLimited(o.model.storageKey, 40 * 1024 * 1024),
          16 * 1024 * 1024,
        );
      inspectGlb(bytes);
      if (bytes.length > 16 * 1024 * 1024)
        throw new Error("Curated model exceeds delivery bound");
      const digest = createHash("sha256").update(bytes).digest("hex"),
        key = `${storagePrefix()}/demo/store-v1/${digest}.glb`;
      if (
        !models.some(
          (m: { id: string; digest: string }) =>
            m.id === selection.key && m.digest === digest,
        )
      )
        await putObject(key, bytes, "model/gltf-binary");
      const bounds = glbBounds(bytes),
        t = flattenTransform(o, bounds),
        matrix = new Matrix4().compose(
          new Vector3(...t.position),
          new Quaternion(...t.rotation),
          new Vector3(...t.scale),
        ),
        world = new Box3(
          new Vector3(...bounds.min),
          new Vector3(...bounds.max),
        ).applyMatrix4(matrix),
        center = world.getCenter(new Vector3()),
        size = world.getSize(new Vector3());
      const model = {
        id: selection.key,
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
      };
      const photo = await readLimited(
        o.product.imageAsset.storageKey,
        4 * 1024 * 1024,
      );
      await writeFile(`public/demo/images/${selection.key}.webp`, photo);
      const asset = await db.asset.upsert({
        where: { bucket_storageKey: { bucket: bucket(), storageKey: key } },
        update: {},
        create: {
          sceneId: scene.id,
          kind: "MODEL_GLB",
          status: "READY",
          bucket: bucket(),
          storageKey: key,
          mimeType: "model/gltf-binary",
          byteSize: bytes.length,
          sha256: digest,
          readyAt: new Date(),
          derivedFromId: o.model.id,
          provenance: { source: "approved-shopping-release" },
        },
      });
      const listing = {
        id: selection.key,
        name: selection.name,
        subtitle: selection.subtitle,
        price: selection.price,
        category: String(details.category),
        description: o.product.description!,
        materials: String(details.materials),
        dimensions: String(details.dimensions),
        care: String(details.care),
        colors: details.colors as DemoProduct["colors"],
      };
      await db.product.upsert({
        where: { catalogKey: selection.key },
        create: {
          sceneId: scene.id,
          catalogKey: selection.key,
          catalogRole: "SOURCE",
          catalogStatus: "READY",
          name: listing.name,
          description: listing.description,
          price: (listing.price / 100).toFixed(2),
          currency: "USD",
          brand: "ReScene Living",
          modelAssetId: asset.id,
          imageAssetId: o.product.imageAssetId,
          sourceProductId: o.product.id,
          inferredDetails: json({
            ...listing,
            publicApproved: true,
            publicModelDigest: digest,
            listingOrigin: "authored-catalog",
          }),
        },
        update: {},
      });
      const at = models.findIndex(
        (m: { id: string }) => m.id === selection.key,
      );
      if (at >= 0) models[at] = model;
      else models.push(model);
    }
    const rows = await db.product.findMany({
      where: {
        catalogRole: "SOURCE",
        catalogStatus: "READY",
        catalogKey: { in: models.map((m: { id: string }) => m.id) },
      },
      include: { modelAsset: true },
    });
    const snapshot = models.map((m: { id: string; digest: string }) => {
      const row = rows.find((p) => p.catalogKey === m.id);
      if (
        !row?.price ||
        row.currency !== "USD" ||
        row.modelAsset?.sha256 !== m.digest
      )
        throw new Error("Catalog and approved mesh are out of sync");
      const d = row.inferredDetails as unknown as DemoProduct;
      return {
        ...d,
        id: row.catalogKey!,
        name: row.name,
        description: row.description ?? "",
        price: decimalToCents(row.price.toFixed(2)),
      };
    });
    // Project only render/listing fields. No private source references or ownership data.
    const safe = snapshot.map((p: DemoProduct) => ({
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      price: p.price,
      category: p.category,
      description: p.description,
      materials: p.materials,
      dimensions: p.dimensions,
      care: p.care,
      colors: p.colors,
    }));
    await writeFile(
      "src/lib/demo/catalog-data.json",
      JSON.stringify(safe, null, 2) + "\n",
    );
    await writeFile(
      "src/lib/demo/catalog-models.json",
      JSON.stringify(models, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        catalogProducts: safe.length,
        generatedAdditions: selections.length,
      }),
    );
  }
  console.log(JSON.stringify({ savedListings: saved, backup }));
} finally {
  await db.$disconnect();
}
