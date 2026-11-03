import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { getDb } from "../../src/lib/db";
import { judgeMode } from "../../src/lib/judge/config";
import { Prisma } from "../../src/generated/prisma/client";
import { productCover } from "../../src/lib/demo/albums";
import { putObject } from "../../src/lib/storage/r2";
if (judgeMode() !== "live")
  throw new Error("Local live configuration required");
const db = getDb(),
  products = JSON.parse(
    await readFile("src/lib/demo/catalog-data.json", "utf8"),
  ),
  models = JSON.parse(
    await readFile("src/lib/demo/catalog-models.json", "utf8"),
  );
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
try {
  const user = await db.appUser.upsert({
    where: { authSubject: "local-judge" },
    create: { authSubject: "local-judge", displayName: "Local reviewer" },
    update: {},
  });
  const scene = await db.scene.upsert({
    where: { id: "00000000-0000-4000-8000-000000000010" },
    create: {
      id: "00000000-0000-4000-8000-000000000010",
      ownerId: user.id,
      title: "Approved showroom catalog",
      status: "DRAFT",
    },
    update: {},
  });
  for (const p of products) {
    const m = models.find((m: { id: string }) => m.id === p.id)!;
    const asset = await db.asset.upsert({
      where: {
        bucket_storageKey: {
          bucket: "local-judge",
          storageKey: `judge/demo/store-v1/${m.digest}.glb`,
        },
      },
      create: {
        sceneId: scene.id,
        kind: "MODEL_GLB",
        status: "READY",
        bucket: "local-judge",
        storageKey: `judge/demo/store-v1/${m.digest}.glb`,
        sha256: m.digest,
        byteSize: m.bytes,
        mimeType: "model/gltf-binary",
        readyAt: new Date(),
      },
      update: {},
    });
    const photo = await readFile(`public${productCover(p.id)}`);
    const digest = createHash("sha256").update(photo).digest("hex");
    const storageKey = `judge/demo/photos/${digest}.webp`;
    const metadata = await sharp(photo).metadata();
    await putObject(storageKey, photo, "image/webp");
    const image = await db.asset.upsert({
      where: { bucket_storageKey: { bucket: "local-judge", storageKey } },
      create: {
        sceneId: scene.id, kind: "PRODUCT_IMAGE", status: "READY",
        bucket: "local-judge", storageKey, sha256: digest, byteSize: photo.length,
        mimeType: "image/webp", width: metadata.width, height: metadata.height, readyAt: new Date(),
        provenance: { source: "approved-catalog-photograph" },
      },
      update: {},
    });
    const data = {
      name: p.name,
      description: p.description,
      price: new Prisma.Decimal(p.price).div(100),
      currency: "USD",
      modelAssetId: asset.id,
      imageAssetId: image.id,
      brand: "ReScene Collection",
      attributes: json({ Material: p.materials, Dimensions: p.dimensions, Care: p.care }),
      inferredDetails: json(p),
      catalogRole: "SOURCE" as const,
      catalogStatus: "READY" as const,
    };
    await db.product.upsert({
      where: { catalogKey: p.id },
      create: { ...data, sceneId: scene.id, catalogKey: p.id },
      update: data,
    });
  }
  console.log(
    `Seeded ${products.length} priced approved listings into the isolated local database. No inference.`,
  );
} finally {
  await db.$disconnect();
}
