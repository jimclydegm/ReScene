/** Explicit approved-catalog sync. Source scene/object state is never updated. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getDb } from "../src/lib/db";
import {
  putObject,
  readLimited,
  headObject,
  storagePrefix,
  bucket,
} from "../src/lib/storage/r2";
import type { Prisma } from "../src/generated/prisma/client";
const folder = "test-results/demo-polish-nov3",
  apply = process.argv.includes("--apply"),
  hash = (b: Buffer) => createHash("sha256").update(b).digest("hex"),
  json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const models = JSON.parse(
    await readFile("src/lib/demo/catalog-models.json", "utf8"),
  ),
  environments = JSON.parse(
    await readFile(`${folder}/environments-ready.json`, "utf8"),
  ),
  frozen = JSON.parse(
    await readFile("src/lib/demo/frozen-scenes.json", "utf8"),
  );
const targets: string[] = frozen.scenes
  .filter((s: { id: string }) =>
    environments.some((e: { id: string }) => e.id === s.id),
  )
  .flatMap((s: { objects: { id: string }[] }) => s.objects.map((o) => o.id))
  .filter((id: string) => id !== "chair-studio-item-3");
const db = getDb();
let originalRows: { id: string; modelAssetId: string | null }[] = [];
try {
  originalRows = JSON.parse(
    await readFile(`${folder}/sync-before.json`, "utf8"),
  ).rows;
} catch {}
try {
  const rows = await db.product.findMany({
    where: {
      catalogKey: { in: targets },
      catalogRole: "SOURCE",
      catalogStatus: "READY",
    },
    include: {
      modelAsset: true,
      scene: {
        select: {
          id: true,
          ownerId: true,
          archivedAt: true,
          stage: true,
          settings: true,
          revision: true,
        },
      },
    },
  });
  if (
    rows.length !== targets.length ||
    new Set(rows.map((p) => p.scene.ownerId)).size !== 1 ||
    rows.some(
      (p) =>
        p.scene.archivedAt ||
        p.sceneId === "f2848b95-8447-41eb-9544-0d72dd605565" ||
        p.modelAsset?.status !== "READY",
    )
  )
    throw Error("Approved catalog ownership/state mismatch");
  const before = await db.scene.findMany({
    where: { id: { in: [...new Set(rows.map((p) => p.sceneId))] } },
    include: { objects: true },
  });
  const jobs = await Promise.all(
    rows.map(async (row) => {
      const id = row.catalogKey!,
        m = models.find((m: { id: string }) => m.id === id),
        b = await readFile(`${folder}/approved/${id}.glb`),
        r = JSON.parse(await readFile(`${folder}/${id}-bake.json`, "utf8"));
      if (
        hash(b) !== m.digest ||
        b.length !== m.bytes ||
        !r.geometryPreserved ||
        r.coverage.unmapped
      )
        throw Error("Unverified model");
      return {
        row,
        m,
        b,
        r,
        key: `${storagePrefix()}/demo/store-v1/${m.digest}.glb`,
      };
    }),
  );
  console.log(
    `${apply ? "Apply" : "Dry run"}: ${jobs.length} approved models, ${environments.length} immutable environment atlases; source scenes preserved.`,
  );
  if (!apply) process.exit(0);
  try {
    await writeFile(
      `${folder}/sync-before.json`,
      JSON.stringify({ rows, before }),
      { flag: "wx", mode: 0o600 },
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  async function upload(key: string, bytes: Buffer, mime: string) {
    let exists = false;
    try {
      const head = await headObject(key);
      exists = true;
      if (head.ContentLength !== bytes.length)
        throw Error("Immutable key size mismatch");
    } catch (e) {
      if (
        exists ||
        !(
          e &&
          typeof e === "object" &&
          "$metadata" in e &&
          (e.$metadata as { httpStatusCode?: number }).httpStatusCode === 404
        )
      )
        throw e;
    }
    if (!exists) await putObject(key, bytes, mime);
    if (hash(await readLimited(key, 16 * 1024 * 1024)) !== hash(bytes))
      throw Error("R2 verification failed");
  }
  for (const j of jobs) {
    await upload(j.key, j.b, "model/gltf-binary");
  }
  const surfaces: {
    env: (typeof environments)[number];
    row: (typeof rows)[number];
    key: string;
    b: Buffer;
  }[] = [];
  for (const env of environments) {
    const scene = frozen.scenes.find((s: { id: string }) => s.id === env.id),
      row = rows.find((p) =>
        scene.objects.some((o: { id: string }) => o.id === p.catalogKey),
      );
    if (!row) throw Error("Background has no approved catalog scene");
    const b = await readFile(`public${env.appearance.backgroundUrl}`);
    if (hash(b) !== env.sha256) throw Error("Changed atlas");
    const key = `${storagePrefix()}/scenes/${row.sceneId}/demo-refinement/${env.sha256}.webp`;
    await upload(key, b, "image/webp");
    surfaces.push({ env, row, key, b });
  }
  await db.$transaction(
    async (tx) => {
      for (const { row, m, r, key } of jobs) {
        const asset = await tx.asset.upsert({
          where: { bucket_storageKey: { bucket: bucket(), storageKey: key } },
          create: {
            sceneId: row.sceneId,
            kind: "MODEL_GLB",
            status: "READY",
            bucket: bucket(),
            storageKey: key,
            mimeType: "model/gltf-binary",
            byteSize: m.bytes,
            sha256: m.digest,
            readyAt: new Date(),
            derivedFromId:
              originalRows.find((p) => p.id === row.id)?.modelAssetId ??
              row.modelAssetId,
            provenance: json({
              source: "reviewed-demo-materials-nov3",
              geometry: "Meta SAM 3D Objects",
              materials: "muse-image-1.0",
              analysis: "muse-spark-1.3",
              sourceDigest: r.sourceDigest,
              geometryPreserved: true,
            }),
            metadata: json({ coverage: r.coverage, publicApproved: true }),
          },
          update: {},
        });
        if (
          asset.sceneId !== row.sceneId ||
          asset.sha256 !== m.digest ||
          asset.status !== "READY"
        )
          throw Error("Asset identity mismatch");
        if (row.modelAssetId === asset.id) continue;
        const changed = await tx.product.updateMany({
          where: {
            id: row.id,
            updatedAt: row.updatedAt,
            modelAssetId: row.modelAssetId,
            catalogRole: "SOURCE",
            catalogStatus: "READY",
          },
          data: {
            modelAssetId: asset.id,
            inferredDetails: json({
              ...(row.inferredDetails as object),
              publicModelDigest: m.digest,
              materialRefinement: {
                version: "demo-materials-nov3",
                geometryPreserved: true,
                coverage: r.coverage,
              },
            }),
          },
        });
        if (changed.count !== 1)
          throw Error("Catalog changed during refinement");
      }
      for (const { env, row, key, b } of surfaces)
        await tx.asset.upsert({
          where: { bucket_storageKey: { bucket: bucket(), storageKey: key } },
          create: {
            sceneId: row.sceneId,
            kind: "SURFACE_TEXTURE",
            status: "READY",
            bucket: bucket(),
            storageKey: key,
            mimeType: "image/webp",
            byteSize: b.length,
            sha256: env.sha256,
            width: env.width,
            height: env.height,
            readyAt: new Date(),
            provenance: json({
              source: "reviewed-demo-environment-nov3",
              model: "muse-image-1.0",
              review: "muse-spark-1.3",
              approvedDemo: env.id,
            }),
            metadata: json({
              composition: env.composition,
              publicApproved: true,
              demoOnly: true,
            }),
          },
          update: {},
        });
    },
    { timeout: 60000 },
  );
  const after = await db.scene.findMany({
    where: { id: { in: before.map((s) => s.id) } },
    include: { objects: true },
  });
  const stable = (scenes: typeof before) =>
    JSON.stringify(
      scenes
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((s) => ({
          ...s,
          objects: s.objects.sort((a, b) => a.id.localeCompare(b.id)),
        })),
    );
  if (stable(before) !== stable(after))
    throw Error("Source scene changed during sync; inspect saved backup");
  const verified = await db.product.findMany({
    where: { catalogKey: { in: targets } },
    include: { modelAsset: true },
  });
  if (
    verified.some(
      (p) =>
        p.modelAsset?.sha256 !==
        models.find((m: { id: string }) => m.id === p.catalogKey).digest,
    )
  )
    throw Error("Catalog verification failed");
  await writeFile(
    `${folder}/sync-complete.json`,
    JSON.stringify({
      models: jobs.map((j) => ({ id: j.m.id, digest: j.m.digest })),
      environments: surfaces.map((s) => ({
        id: s.env.id,
        sha256: s.env.sha256,
      })),
      sourceStatePreserved: true,
    }),
    { mode: 0o600 },
  );
  console.log(
    "Neon/R2 verification passed; all merchant fields, product photos, source scenes and object transforms preserved.",
  );
} finally {
  await db.$disconnect();
}
