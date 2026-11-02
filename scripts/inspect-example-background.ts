/** Offline geometry comparisons using existing paid results. No inference/mutations. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { getDb } from "../src/lib/db";
import { readLimited } from "../src/lib/storage/r2";
import { record } from "../src/lib/services/composition";
import {
  compositionSchema,
  modelPlacementSchema,
} from "../src/lib/scene/composition";
import { environmentObservationSchema } from "../src/lib/scene/environment-plan";
import { decodeEnvironmentDepth } from "../src/lib/appearance/environment-depth";
import { alignCleanDepth } from "../src/lib/appearance/clean-depth";
import { buildEnvironmentGeometry } from "../src/lib/scene/environment-geometry";
const id = process.argv[2];
if (!id) throw new Error("Example key required");
const dir = `test-results/demo-expansion-v1/${id}-background-review`,
  db = getDb();
await mkdir(dir, { recursive: true });
try {
  const state = JSON.parse(
      await readFile(`test-results/demo-expansion-v1/${id}-build.json`, "utf8"),
    ),
    run = await db.generationRun.findUniqueOrThrow({
      where: { id: state.backgroundRunId },
      include: {
        steps: { include: { response: true } },
        scene: {
          include: {
            normalizedAsset: true,
            objects: {
              where: { maskAssetId: { not: null } },
              include: { mask: true },
            },
          },
        },
      },
    }),
    s = run.scene,
    steps = run.steps;
  const masks = await Promise.all(
      s.objects.map(async (o) =>
        sharp(await readLimited(o.mask!.storageKey, 4 * 1024 * 1024))
          .greyscale()
          .raw()
          .toBuffer(),
      ),
    ),
    original = decodeEnvironmentDepth(
      JSON.parse(
        (
          await readLimited(
            steps.find((s) => s.key === "environment-depth")!.response!
              .storageKey,
            8 * 1024 * 1024,
          )
        ).toString(),
      ),
    ),
    clean = decodeEnvironmentDepth(
      JSON.parse(
        (
          await readLimited(
            steps.find((s) => s.key === "environment-clean-depth")!.response!
              .storageKey,
            8 * 1024 * 1024,
          )
        ).toString(),
      ),
    ),
    sourcePlan = environmentObservationSchema.parse(
      record(record(s.settings).environmentObservation).analysis,
    ),
    platePlan = environmentObservationSchema.parse(
      steps.find((s) => s.key === "environment-source-materials")!.output,
    ),
    composition = compositionSchema.parse(s.stage),
    anchors = s.objects.flatMap((o, i) => {
      const p = modelPlacementSchema.safeParse(o.initialTransform);
      return p.success
        ? [
            {
              mask: masks[i],
              position: [o.positionX, o.positionY, o.positionZ] as [
                number,
                number,
                number,
              ],
              size: p.data.size,
            },
          ]
        : [];
    });
  await writeFile(
    `${dir}/source.webp`,
    await readLimited(s.normalizedAsset!.storageKey, 4 * 1024 * 1024),
    { mode: 0o600 },
  );
  await writeFile(
    `${dir}/empty-plate.png`,
    await readLimited(
      steps.find((s) => s.key === "environment-albedo")!.response!.storageKey,
      24 * 1024 * 1024,
    ),
    { mode: 0o600 },
  );
  const reports = [];
  const plans: [string, typeof sourcePlan][] = [
    ["source", sourcePlan],
    ["plate", platePlan],
  ];
  try {
    plans.push([
      "approved",
      environmentObservationSchema.parse(
        JSON.parse(await readFile(`${dir}/approved-plan.json`, "utf8")).plan,
      ),
    ]);
  } catch {}
  for (const [name, plan] of plans)
    for (const mode of ["original", "aligned"]) {
      let grid = original;
      if (mode === "aligned")
        try {
          grid = alignCleanDepth(original, clean, masks, plan).grid;
        } catch {
          continue;
        }
      const built = buildEnvironmentGeometry(
        plan,
        composition,
        grid,
        mode === "aligned" ? [] : masks,
        anchors,
        original,
      );
      await writeFile(
        `${dir}/${name}-${mode}.json`,
        JSON.stringify({ plan, composition, built }, null, 2),
        { mode: 0o600 },
      );
      reports.push({ plan: name, depth: mode, report: built.report });
    }
  console.log(JSON.stringify(reports));
} finally {
  await db.$disconnect();
}
