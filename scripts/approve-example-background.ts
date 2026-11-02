/** Explicit curation: source-photo geometry wins over architecture invented by an empty plate.
 * Retains original paid outputs and creates an INTERNAL approved view. No inference.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getDb } from "../src/lib/db";
import { Prisma } from "../src/generated/prisma/client";
import { exampleScenes } from "../src/lib/demo/example-batch";
import { record } from "../src/lib/services/composition";
import { environmentObservationSchema } from "../src/lib/scene/environment-plan";
const db = getDb(),
  json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const watching = process.argv.includes("--watch");
const reviewed = process.argv.includes("--apply-reviewed");
try {
  for (let round = 0; round < (watching ? 180 : 1); round++) {
    let terminal = 0;
    for (const example of exampleScenes.filter(
      (e) => !process.argv[2] || watching || e.id === process.argv[2],
    )) {
      let state;
      try {
        state = JSON.parse(
          await readFile(
            `test-results/demo-expansion-v1/${example.id}-build.json`,
            "utf8",
          ),
        );
      } catch {
        continue;
      }
      if (state.complete || state.error) terminal++;
      if (!state.backgroundRunId) continue;
      const run = await db.generationRun.findUniqueOrThrow({
        where: { id: state.backgroundRunId },
        include: { scene: true, steps: true },
      });
      if (
        record(run.scene.settings).curationBatch !== "demo-expansion-v1" ||
        record(run.scene.settings).exampleKey !== example.id
      )
        throw new Error("Not a curated source");
      const material = run.steps.find(
        (s) => s.key === "environment-source-materials",
      );
      if (
        !material ||
        material.status !== "SUCCEEDED" ||
        (material.provider === "INTERNAL" && !reviewed) ||
        (!run.steps.some(
          (s) =>
            s.key === "environment-clean-depth" &&
            ["RUNNING", "WAITING"].includes(s.status),
        ) &&
          run.status !== "FAILED") ||
        run.steps.some(
          (s) => s.key === "environment-geometry" && s.status === "SUCCEEDED",
        )
      )
        continue;
      const source = environmentObservationSchema.parse(
          record(record(run.scene.settings).environmentObservation).analysis,
        ),
        generated = environmentObservationSchema.parse(material.output);
      let plan = {
        ...source,
        surfaces: source.surfaces.map((s) => {
          const m = generated.surfaces.find((m) => m.id === s.id);
          return m
            ? {
                ...s,
                color: m.color,
                roughness: m.roughness,
                material: m.material,
                appearance: m.appearance,
                finish: m.finish,
              }
            : s;
        }),
      };
      let reason =
        "Curated source evidence: retain the original photograph's architectural polygons, topology, wall count and openings. Empty-plate generation may expose occluded materials but may not invent room corners, windows or borders. Reuse generated material classifications only for matching source surface IDs.";
      if (reviewed) {
        const approval = JSON.parse(
          await readFile(
            `test-results/demo-expansion-v1/${example.id}-background-review/approved-plan.json`,
            "utf8",
          ),
        );
        plan = environmentObservationSchema.parse(approval.plan);
        reason = String(approval.reason);
      }
      await db.$transaction(async (tx) => {
        await tx.generationStep.update({
          where: { id: material.id, key: "environment-source-materials" },
          data: {
            key:
              material.provider === "INTERNAL"
                ? `environment-source-materials-approval-${material.id.slice(0, 8)}`
                : "environment-source-materials-raw",
          },
        });
        await tx.generationStep.create({
          data: {
            runId: run.id,
            key: "environment-source-materials",
            attempt: 1,
            provider: "INTERNAL",
            modelId: "source-geometry-approved-v1",
            status: "SUCCEEDED",
            input: json({
              ...record(material.input),
              geometryApproval: {
                reason,
                sourcePlanHash: createHash("sha256")
                  .update(JSON.stringify(source))
                  .digest("hex"),
                originalStepId: material.id,
              },
            }),
            output: json(plan),
            completedAt: new Date(),
          },
        });
      });
      console.log(
        `${example.id}: source architecture approved; paid outputs preserved`,
      );
    }
    if (!watching || terminal === exampleScenes.length) break;
    await new Promise((r) => setTimeout(r, 20000));
  }
} finally {
  await db.$disconnect();
}
