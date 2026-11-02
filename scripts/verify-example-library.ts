/** Read-only verification of the generated batch against Neon and approved local copies. No inference. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getDb } from "../src/lib/db";
import {
  exampleProducts,
  exampleSceneProducts,
  exampleScenes,
} from "../src/lib/demo/example-batch";
import { demoProducts } from "../src/lib/demo/catalog";
import models from "../src/lib/demo/catalog-models.json";
import { record } from "../src/lib/services/composition";
import { readGlb } from "../src/lib/appearance/bake";
import { inspectGlb } from "../src/lib/ai/glb";
import { decimalToCents } from "../src/lib/shopping/listing";
const db = getDb(),
  folder = "test-results/demo-expansion-v1";
try {
  const owner = (
    await db.scene.findUniqueOrThrow({
      where: { id: "6800b8a2-7c39-4a52-8fde-790eb03ab46c" },
      select: { ownerId: true },
    })
  ).ownerId;
  const rows = await db.product.findMany({
    where: {
      catalogKey: { in: demoProducts.map((p) => p.id) },
      catalogRole: "SOURCE",
      catalogStatus: "READY",
    },
    include: {
      modelAsset: true,
      imageAsset: true,
      scene: { select: { ownerId: true, archivedAt: true } },
    },
  });
  assert.equal(rows.length, demoProducts.length);
  for (const p of demoProducts) {
    const row = rows.find((r) => r.catalogKey === p.id)!,
      model = models.find((m) => m.id === p.id)!;
    assert.equal(row.scene.ownerId, owner);
    assert.equal(row.scene.archivedAt, null);
    assert.equal(row.name, p.name);
    assert.equal(decimalToCents(row.price!.toFixed(2)), p.price);
    assert.equal(row.currency, "USD");
    assert.equal(row.modelAsset?.status, "READY");
    assert.equal(row.modelAsset.sha256, model.digest);
    assert.equal(row.imageAsset?.status, "READY");
    for (const field of [
      "materials",
      "dimensions",
      "care",
      "category",
      "colors",
    ])
      assert.deepEqual(
        record(row.inferredDetails)[field],
        p[field as keyof typeof p],
      );
  }
  const stats = [];
  for (const p of [...exampleProducts, ...exampleSceneProducts]) {
    const row = rows.find((r) => r.catalogKey === p.id)!,
      model = models.find((m) => m.id === p.id)!,
      bytes = await readFile(`${folder}/approved/${p.id}.glb`);
    assert.equal(row.modelAsset!.sceneId, row.sceneId);
    assert.equal(row.imageAsset!.sceneId, row.sceneId);
    assert.equal(record(row.imageAsset!.provenance).source, "muse-image-1.0");
    assert.equal(row.sourceProductId === null, false);
    inspectGlb(bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      model.digest,
    );
    const g = readGlb(bytes).json;
    assert(g.images.length > 0);
    assert(
      g.meshes.every(
        (m: {
          primitives: {
            attributes: {
              POSITION: number;
              TEXCOORD_0?: number;
              NORMAL?: number;
            };
          }[];
        }) =>
          m.primitives.every(
            (p) =>
              p.attributes.TEXCOORD_0 !== undefined &&
              p.attributes.NORMAL !== undefined,
          ),
      ),
    );
    const triangles = g.meshes.reduce(
      (
        n: number,
        m: {
          primitives: { indices?: number; attributes: { POSITION: number } }[];
        },
      ) =>
        n +
        m.primitives.reduce(
          (sum, p) =>
            sum + g.accessors[p.indices ?? p.attributes.POSITION].count / 3,
          0,
        ),
      0,
    );
    assert(triangles > 1000);
    stats.push({
      id: p.id,
      triangles,
      bytes: model.bytes,
      sha256: model.digest,
    });
  }
  for (const p of [...exampleProducts, ...exampleScenes]) {
    const state = JSON.parse(
      await readFile(`${folder}/${p.id}-build.json`, "utf8"),
    );
    assert(state.complete);
    const s = await db.scene.findUniqueOrThrow({
      where: { id: state.sceneId },
      include: { objects: { include: { product: true, model: true } } },
    });
    assert.equal(s.ownerId, owner);
    assert.equal(s.status, "READY");
    assert.equal(record(s.settings).exampleKey, p.id);
    assert(
      s.objects.every(
        (o) =>
          o.status === "READY" &&
          o.model?.status === "READY" &&
          o.productId &&
          o.product?.imageAssetId,
      ),
    );
  }
  await writeFile(
    `${folder}/readiness.json`,
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        listings: rows.length,
        newModels: stats.length,
        readyBuilds: 38,
        stats,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      readyBuilds: 38,
      approvedDatabaseListings: rows.length,
      newTexturedModels: stats.length,
      minimumTriangles: Math.min(...stats.map((s) => s.triangles)),
      maximumBytes: Math.max(...stats.map((s) => s.bytes)),
    }),
  );
} finally {
  await db.$disconnect();
}
