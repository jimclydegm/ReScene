/** Resumable, one-active-user-run curation batch. Uses the application's paid receipts and storage. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { getDb } from "../src/lib/db";
import { Prisma } from "../src/generated/prisma/client";
import { exampleScenes, exampleProducts } from "../src/lib/demo/example-batch";
import {
  reserveRun,
  claimRun,
  analyzeRun,
  segmentRunObject,
  finishAnalysis,
  segmentRequestedObject,
  submitReconstruction,
  pollReconstruction,
  ingestRun,
  failRun,
} from "../src/lib/services/generation";
import { putObject, storagePrefix, bucket } from "../src/lib/storage/r2";
import { syncSceneProducts } from "../src/lib/services/product-library";
import { record } from "../src/lib/services/composition";
const db = getDb(),
  folder = "test-results/demo-expansion-v1",
  json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
await mkdir(folder, { recursive: true });
type State = {
  sceneId: string;
  analysisRunId?: string;
  objectIds?: string[];
  reconstructionRunId?: string;
  backgroundRunId?: string;
  qualityComplete?: boolean;
  complete?: boolean;
  error?: string;
};
const jobs = [
  ...exampleProducts.map((p) => ({
    id: p.id,
    title: p.name,
    product: p,
    scene: null,
  })),
  ...exampleScenes.map((s) => ({
    id: s.id,
    title: s.title,
    product: null,
    scene: s,
  })),
].filter(
  (j) =>
    (!process.env.EXAMPLE_ONLY ||
      process.env.EXAMPLE_ONLY.split(",").includes(j.id)) &&
    (!process.env.EXAMPLE_KIND ||
      (process.env.EXAMPLE_KIND === "product") === !!j.product),
);
const owner = (
  await db.scene.findUniqueOrThrow({
    where: { id: "6800b8a2-7c39-4a52-8fde-790eb03ab46c" },
    select: { ownerId: true },
  })
).ownerId;
const save = (id: string, state: State) =>
  writeFile(`${folder}/${id}-build.json`, JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function prepare(job: (typeof jobs)[number], state: State) {
  let scene = await db.scene.findUnique({ where: { id: state.sceneId } });
  if (!scene) {
    scene = await db.scene.create({
      data: {
        id: state.sceneId,
        ownerId: owner,
        title: job.title,
        description: job.product?.description ?? job.scene!.caption,
        settings: { curationBatch: "demo-expansion-v1", exampleKey: job.id },
      },
    });
  }
  if (scene.ownerId !== owner || record(scene.settings).exampleKey !== job.id)
    throw new Error("CURATION_OWNERSHIP_MISMATCH");
  if (scene.normalizedAssetId) return;
  const receipt = JSON.parse(
    await readFile(`${folder}/${job.id}-image.json`, "utf8"),
  );
  if (receipt.status !== "SUCCEEDED") throw new Error("MUSE_PHOTO_NOT_READY");
  const bytes = await readFile(`public${receipt.path}`),
    normalized = await sharp(bytes)
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 95 })
      .toBuffer({ resolveWithObject: true });
  const sourceId = randomUUID(),
    photoId = randomUUID(),
    sourceKey = `${storagePrefix()}/scenes/${scene.id}/muse/${sourceId}.webp`,
    photoKey = `${storagePrefix()}/scenes/${scene.id}/normalized/${photoId}.webp`;
  await putObject(sourceKey, bytes, "image/webp");
  await putObject(photoKey, normalized.data, "image/webp");
  const observation = {
    version: "environment-observation-v1",
    topology: "cyclorama",
    surfaces: [
      {
        id: "studio-floor",
        role: "floor",
        polygon: [
          { x: 0, y: 0.7 },
          { x: 1, y: 0.7 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        finish: "plain",
        color: "#f5f3ee",
        roughness: 0.85,
        material: "Seamless warm-white photographic studio",
        appearance: "uniform",
        confidence: 1,
      },
    ],
    openings: [],
    expectedWallCount: 0,
    lightingEffects: ["Soft photographic contact shadow"],
    explanation:
      "Known authored studio setting from the Muse Image generation brief; no architectural room is asserted.",
  };
  await db.$transaction(async (tx) => {
    const metadata = {
      model: "muse-image-1.0",
      source: "curated-muse-photograph",
      referenceSha256: receipt.referenceSha256,
      exampleKey: job.id,
    };
    await tx.asset.create({
      data: {
        id: sourceId,
        sceneId: scene.id,
        kind: "SOURCE_IMAGE",
        status: "READY",
        bucket: bucket(),
        storageKey: sourceKey,
        mimeType: "image/webp",
        byteSize: bytes.length,
        width: receipt.width,
        height: receipt.height,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        readyAt: new Date(),
        provenance: metadata,
      },
    });
    await tx.asset.create({
      data: {
        id: photoId,
        sceneId: scene.id,
        kind: "NORMALIZED_IMAGE",
        status: "READY",
        bucket: bucket(),
        storageKey: photoKey,
        mimeType: "image/webp",
        byteSize: normalized.data.length,
        width: normalized.info.width,
        height: normalized.info.height,
        sha256: createHash("sha256").update(normalized.data).digest("hex"),
        derivedFromId: sourceId,
        readyAt: new Date(),
        provenance: { source: "image-normalization" },
      },
    });
    await tx.scene.update({
      where: { id: scene.id, revision: 0, sourceAssetId: null },
      data: {
        sourceAssetId: sourceId,
        normalizedAssetId: photoId,
        revision: 1,
        settings: json({
          ...record(scene.settings),
          ...(job.product
            ? {
                preferredBackdrop: "studio",
                environment: {
                  floorColor: "#f5f3ee",
                  wallColor: "#f5f3ee",
                  floorMaterial: "plain",
                  lightDirection: "diffuse",
                  lightWarmth: "neutral",
                  sideWall: "none",
                },
                backgroundPlan: {
                  kind: "seamless",
                  groundVisible: true,
                  boundary: null,
                  description: "Muse Image studio photograph",
                  plainColor: "#f5f3ee",
                },
                environmentObservation: {
                  version: "environment-observation-v1",
                  photoId,
                  analysis: observation,
                },
              }
            : {}),
        }),
      },
    });
    await tx.contentItem.create({
      data: {
        ownerId: owner,
        assetId: sourceId,
        title: job.title,
        category: job.product?.category ?? "Scene examples",
        kind: "GENERATED",
        provenance: {
          source: "muse-image-1.0",
          exampleKey: job.id,
          publicApproved: true,
        },
      },
    });
  });
}
async function waitForJob(
  runId: string,
  requestId: string,
  poll: (id: string, request: string) => Promise<boolean>,
) {
  for (let i = 0; i < 180; i++) {
    if (await poll(runId, requestId)) return;
    if (i % 6 === 0)
      console.log("Known provider job processing; no resubmission");
    await delay(5000);
  }
  throw new Error("KNOWN_PROVIDER_JOB_STILL_RUNNING");
}
async function processJob(job: (typeof jobs)[number], state: State) {
  await prepare(job, state);
  if (!state.analysisRunId) {
    const scene = await db.scene.findUniqueOrThrow({
      where: { id: state.sceneId },
    });
    const input = job.product
      ? {
          kind: "SEGMENT_OBJECT" as const,
          segmentation: {
            label: job.product.name,
            concept:
              (
                {
                  drawer: "chest of drawers",
                  mouse: "computer mouse",
                  shoes: "shoe",
                } as Record<string, string>
              )[job.product.kind] ?? job.product.kind,
            mode: "text" as const,
            points: [],
          },
        }
      : {
          kind: "ANALYZE" as const,
          analysis: {
            focus: "products" as const,
            maxObjects: job.scene!.concepts.length,
            instructions:
              `Identify exactly the visible complete standalone products in this known inventory: ${job.scene!.inventory}. One candidate per complete product, not handles, cushions, illustrations, wheel, bottle cap, shoe laces or drawer fronts. The broad tabletop/floor/wall is background. Keep repeated products separate by image location. No worn-body parts.`.slice(
                0,
                600,
              ),
          },
        };
    const run = await reserveRun(scene.id, owner, {
      ...input,
      expectedRevision: scene.revision,
      idempotencyKey: `example-${job.id}-analysis-v1`,
    });
    state.analysisRunId = run.id;
    await save(job.id, state);
  }
  const analysis = await db.generationRun.findUniqueOrThrow({
    where: { id: state.analysisRunId },
  });
  if (analysis.status === "QUEUED")
    await claimRun(analysis.id, `curation:${analysis.id}:analysis`);
  if (!["SUCCEEDED", "PARTIAL"].includes(analysis.status)) {
    if (analysis.status === "FAILED")
      throw new Error("ANALYSIS_ATTEMPT_FAILED_INSPECT_RECEIPT");
    if (!state.objectIds) {
      if (job.product)
        state.objectIds = [await segmentRequestedObject(analysis.id)];
      else {
        const prior = await db.generationStep.findFirst({
          where: { runId: analysis.id, key: "spark" },
        });
        if (prior)
          throw new Error("ANALYSIS_ALREADY_SUBMITTED_INSPECT_RECEIPT");
        state.objectIds = await analyzeRun(analysis.id);
      }
      await save(job.id, state);
    }
    for (const id of state.objectIds) {
      const step = await db.generationStep.findUnique({
        where: {
          runId_key_attempt: {
            runId: analysis.id,
            key: `sam-${id}`,
            attempt: 1,
          },
        },
      });
      if (step?.status === "SUCCEEDED") continue;
      if (step) throw new Error("MASK_ALREADY_SUBMITTED_INSPECT_RECEIPT");
      console.log(`${job.id}: Meta outline`);
      await segmentRunObject(analysis.id, id);
    }
    if (job.product)
      await db.sceneObject.updateMany({
        where: { id: { in: state.objectIds } },
        data: {
          category: (
            {
              chair: "seating",
              drawer: "storage",
              sofa: "seating",
              mouse: "electronics",
              shoes: "footwear",
              mug: "decor",
            } as Record<string, string>
          )[job.product.kind],
          provenance: json({
            ...record(
              (
                await db.sceneObject.findUniqueOrThrow({
                  where: { id: state.objectIds[0] },
                })
              ).provenance,
            ),
            support: "floor",
            surfaceRole: "object",
          }),
        },
      });
    await finishAnalysis(analysis.id);
  }
  const objects = await db.sceneObject.findMany({
    where: { sceneId: state.sceneId },
    orderBy: { sortOrder: "asc" },
  });
  if (objects.some((o) => !o.maskAssetId) || !objects.length)
    throw new Error("MASK_REVIEW_REQUIRED");
  if (!state.reconstructionRunId) {
    const scene = await db.scene.findUniqueOrThrow({
        where: { id: state.sceneId },
      }),
      run = await reserveRun(scene.id, owner, {
        kind: "RECONSTRUCT",
        expectedRevision: scene.revision,
        idempotencyKey: `example-${job.id}-mesh-v1`,
        reconstruction: { seed: 42, refineOpenings: false },
      });
    state.reconstructionRunId = run.id;
    await save(job.id, state);
  }
  const run = await db.generationRun.findUniqueOrThrow({
    where: { id: state.reconstructionRunId },
  });
  if (!["SUCCEEDED", "PARTIAL"].includes(run.status)) {
    if (run.status === "FAILED")
      throw new Error("RECONSTRUCTION_PAUSED_INSPECT_KNOWN_JOB");
    if (run.status === "QUEUED")
      await claimRun(run.id, `curation:${run.id}:mesh`);
    const prior = await db.generationStep.findUnique({
      where: {
        runId_key_attempt: { runId: run.id, key: "sam3d-submit", attempt: 1 },
      },
    });
    if (prior && !prior.providerRequestId)
      throw new Error("MESH_SUBMISSION_UNCERTAIN");
    console.log(`${job.id}: Meta SAM 3D reconstruction`);
    const requestId =
      prior?.providerRequestId ?? (await submitReconstruction(run.id));
    await waitForJob(run.id, requestId, pollReconstruction);
    await ingestRun(run.id, requestId);
  }
  if (job.scene && !state.qualityComplete) {
    const scene = await db.scene.findUniqueOrThrow({
      where: { id: state.sceneId },
    });
    try {
      await (
        await import("../src/lib/services/quality")
      ).improveSceneQuality(scene.id, owner, scene.revision);
    } catch (e) {
      console.log(
        `${job.id}: retained source reconstruction; quality review ${e instanceof Error ? e.message.slice(0, 100) : "unavailable"}`,
      );
    }
    state.qualityComplete = true;
    await save(job.id, state);
  }
  if (job.scene) {
    if (!state.backgroundRunId) {
      const scene = await db.scene.findUniqueOrThrow({
          where: { id: state.sceneId },
        }),
        run = await reserveRun(scene.id, owner, {
          kind: "IMAGE_EDIT",
          expectedRevision: scene.revision,
          idempotencyKey: `example-${job.id}-background-v1`,
          background: { mode: "reference" },
        });
      state.backgroundRunId = run.id;
      await save(job.id, state);
    }
    const background = await db.generationRun.findUniqueOrThrow({
      where: { id: state.backgroundRunId },
    });
    if (!["SUCCEEDED", "PARTIAL"].includes(background.status)) {
      if (background.status === "FAILED")
        throw new Error("BACKGROUND_PAUSED_INSPECT_RECEIPTS");
      if (background.status === "QUEUED")
        await claimRun(background.id, `curation:${background.id}:background`);
      console.log(`${job.id}: reconstructing Meta environment`);
      const b = await import("../src/lib/services/background-environment"),
        s = await import("../src/lib/services/environment-surfaces");
      const depth = await b.prepareEnvironmentDepth(background.id);
      if (depth) await waitForJob(background.id, depth, b.pollEnvironmentDepth);
      const clean = await s.prepareCleanEnvironmentDepth(background.id);
      if (clean)
        await waitForJob(background.id, clean, (id, req) =>
          b.pollEnvironmentDepth(id, req, "environment-clean-depth"),
        );
      for (const i of await s.environmentMaterialTargets(background.id))
        await s.buildEnvironmentSurfaceMaterial(background.id, i);
      await (
        await import("../src/lib/services/background")
      ).finishSceneBackground(background.id);
      const finished = await db.generationRun.findUniqueOrThrow({
        where: { id: background.id },
        select: { status: true },
      });
      if (!["SUCCEEDED", "PARTIAL"].includes(finished.status))
        throw new Error("BACKGROUND_PAUSED_INSPECT_RECEIPTS");
    }
  }
  await syncSceneProducts(state.sceneId);
  if (job.product) {
    const object = await db.sceneObject.findFirstOrThrow({
      where: {
        sceneId: state.sceneId,
        status: "READY",
        modelAssetId: { not: null },
      },
    });
    if (!object.productId) throw new Error("PRODUCT_LINK_MISSING");
    const p = job.product;
    await db.product.update({
      where: { id: object.productId },
      data: {
        name: p.name,
        description: p.description,
        brand: "ReScene Living",
        sku: `RS-${p.id.toUpperCase()}`,
        price: (p.price / 100).toFixed(2),
        currency: "USD",
        catalogStatus: "READY",
        inferredDetails: json({
          ...p,
          publicApproved: true,
          styles: ["modern", "minimal"],
          listingOrigin: "authored-catalog",
          colors: [
            { name: "Original", value: null, swatch: "#aaa291" },
            { name: "Warm ivory", value: "#dfd5bf", swatch: "#dfd5bf" },
            { name: "Forest", value: "#789b82", swatch: "#789b82" },
            { name: "Clay", value: "#c9967a", swatch: "#c9967a" },
            { name: "Deep blue", value: "#829bb9", swatch: "#829bb9" },
            { name: "Charcoal", value: "#737d78", swatch: "#737d78" },
          ],
          independent: true,
        }),
      },
    });
  }
  state.complete = true;
  state.error = undefined;
  await save(job.id, state);
  console.log(`${job.id}: 3D example READY`);
}
try {
  for (const job of jobs) {
    let state: State;
    try {
      state = JSON.parse(
        await readFile(`${folder}/${job.id}-build.json`, "utf8"),
      );
    } catch {
      state = { sceneId: randomUUID() };
      await save(job.id, state);
    }
    if (state.complete) {
      console.log(`${job.id}: saved complete example retained`);
      continue;
    }
    if (state.error && !process.argv.includes("--resume-reviewed")) {
      console.log(`${job.id}: stopped attempt retained for review`);
      continue;
    }
    console.log(`Building ${job.id}`);
    try {
      await processJob(job, state);
    } catch (error) {
      state.error =
        error instanceof Error
          ? error.message.slice(0, 200)
          : "CURATION_FAILED";
      await save(job.id, state);
      const active = await db.generationRun.findFirst({
        where: {
          sceneId: state.sceneId,
          status: { in: ["QUEUED", "RUNNING", "WAITING"] },
        },
      });
      if (active) await failRun(active.id);
      console.log(`${job.id}: ${state.error}; completed paid results retained`);
      if (state.error.includes("RUN_ACTIVE")) break;
    }
  }
} finally {
  await db.$disconnect();
}
