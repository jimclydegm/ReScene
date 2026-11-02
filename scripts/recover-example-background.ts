/** Explicit reviewed repair. Reuses completed artifacts in a fresh reserved run; never repeats charged steps. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getDb } from "../src/lib/db";
import { Prisma } from "../src/generated/prisma/client";
import { reserveRun } from "../src/lib/services/generation";
import { record } from "../src/lib/services/composition";
const id = process.argv[2];
if (!id) throw new Error("Reviewed example key required");
const file = `test-results/demo-expansion-v1/${id}-build.json`,
  state = JSON.parse(await readFile(file, "utf8")),
  db = getDb(),
  json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
try {
  const old = await db.generationRun.findUniqueOrThrow({
    where: { id: state.backgroundRunId },
    include: { scene: true, steps: true },
  });
  if (
    old.status !== "FAILED" ||
    record(old.scene.settings).curationBatch !== "demo-expansion-v1" ||
    record(old.scene.settings).exampleKey !== id
  )
    throw new Error("Not a failed curated background");
  if (old.scene.revision !== old.inputRevision)
    throw new Error("The curated scene changed after the reviewed attempt");
  if (
    old.steps.some((s) =>
      ["RUNNING", "WAITING", "SUBMISSION_UNCERTAIN"].includes(s.status),
    )
  )
    throw new Error("Inspect or retrieve unfinished provider jobs first");
  if (process.argv.includes("--resume-unclaimed")) {
    if (
      !record(old.input).curationRecoveryOf ||
      old.workflowRunId ||
      old.startedAt ||
      old.steps.some(
        (s) => s.provider !== "INTERNAL" || s.status !== "SUCCEEDED",
      )
    )
      throw new Error("Only an unclaimed checkpoint copy can be requeued");
    if (
      await db.generationRun.count({
        where: {
          scene: { ownerId: old.scene.ownerId },
          status: { in: ["QUEUED", "RUNNING", "WAITING", "CANCEL_REQUESTED"] },
        },
      })
    )
      throw new Error("Another owned generation is active");
    const reset = await db.generationRun.updateMany({
      where: { id: old.id, status: "FAILED", workflowRunId: null },
      data: {
        status: "QUEUED",
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        expiresAt: new Date(Date.now() + 30 * 60000),
        input: json({
          ...record(old.input),
          dispatchRepair:
            "Use a unique per-run workflow identifier; no provider submission occurred.",
        }),
      },
    });
    if (reset.count !== 1) throw new Error("Unclaimed reservation changed");
    delete state.error;
    state.complete = false;
    await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
    console.log(`${id}: unclaimed reservation requeued without inference`);
  } else {
    const originalDepth = process.argv.includes("--original-depth");
    if (originalDepth) {
      let proof;
      try {
        proof = JSON.parse(
          await readFile(
            `test-results/demo-expansion-v1/${id}-background-review/approved-original.json`,
            "utf8",
          ),
        );
      } catch {
        proof = JSON.parse(
          await readFile(
            `test-results/demo-expansion-v1/${id}-background-review/source-original.json`,
            "utf8",
          ),
        );
      }
      const r = proof.built.report;
      if (
        r.coverage < 0.99 ||
        r.projectionError > 0.025 ||
        r.walls < r.expectedWalls
      )
        throw new Error("Original-depth geometry has not passed review");
    }
    if (!state.backgroundRecoveryKey) {
      state.backgroundRecoveryKey = randomUUID();
      await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
    }
    const prior = await db.generationRun.findFirst({
      where: {
        sceneId: old.sceneId,
        OR: [
          { input: { path: ["curationRecoveryOf"], equals: old.id } },
          { idempotencyKey: state.backgroundRecoveryKey },
        ],
      },
    });
    const run =
      prior ??
      (await reserveRun(old.sceneId, old.scene.ownerId, {
        kind: "IMAGE_EDIT",
        expectedRevision: old.scene.revision,
        idempotencyKey: state.backgroundRecoveryKey,
        background: { mode: "reference" },
      }));
    await db.$transaction(
      async (tx) => {
        await tx.generationRun.update({
          where: { id: run.id },
          data: {
            input: json({ ...record(run.input), curationRecoveryOf: old.id }),
          },
        });
        for (const step of old.steps.filter((s) => s.status === "SUCCEEDED")) {
          const key =
            originalDepth && step.key === "environment-clean-depth"
              ? "environment-clean-depth-rejected"
              : step.key;
          await tx.generationStep.upsert({
            where: {
              runId_key_attempt: { runId: run.id, key, attempt: 1 },
            },
            update: {},
            create: {
              runId: run.id,
              key,
              attempt: 1,
              provider: "INTERNAL",
              modelId: step.modelId,
              status: "SUCCEEDED",
              responseAssetId: step.responseAssetId,
              input: json({ ...record(step.input), reusedFromStepId: step.id }),
              output: json(step.output),
              costUsd: 0,
              completedAt: new Date(),
            },
          });
        }
        if (originalDepth)
          await tx.generationStep.upsert({
            where: {
              runId_key_attempt: {
                runId: run.id,
                key: "environment-clean-depth",
                attempt: 1,
              },
            },
            update: {},
            create: {
              runId: run.id,
              key: "environment-clean-depth",
              attempt: 1,
              provider: "INTERNAL",
              modelId: "validated-original-depth-v1",
              status: "SUCCEEDED",
              input: {
                selection: "original-depth",
                reason:
                  "The reviewed original-photo depth covers all required surfaces with lower corner disagreement. Preserve completed clean-depth results, but use the better validated source gauge.",
              },
              output: { selected: "original-depth", cleanDepth: false },
              completedAt: new Date(),
            },
          });
      },
      { timeout: 30000, maxWait: 10000 },
    );
    state.previousBackgroundRunId = old.id;
    state.backgroundRunId = run.id;
    state.complete = false;
    delete state.error;
    await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
    console.log(
      `${id}: reviewed recovery reserved with completed artifacts reused`,
    );
  }
} finally {
  await db.$disconnect();
}
