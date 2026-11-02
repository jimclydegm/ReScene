/** Reviewed location correction only for known no-match candidates; one new SAM call per missing mask. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getDb } from "../src/lib/db";
import {
  reserveRun,
  claimRun,
  segmentRunObject,
  finishAnalysis,
} from "../src/lib/services/generation";
import { record } from "../src/lib/services/composition";
import { pixelBoxSchema } from "../src/lib/ai/controls";
const id = process.argv[2];
if (!id) throw new Error("Reviewed example key required");
const file = `test-results/demo-expansion-v1/${id}-build.json`,
  state = JSON.parse(await readFile(file, "utf8")),
  db = getDb();
try {
  let scene = await db.scene.findUniqueOrThrow({
    where: { id: state.sceneId },
    include: { objects: true },
  });
  if (
    record(scene.settings).curationBatch !== "demo-expansion-v1" ||
    record(scene.settings).exampleKey !== id ||
    scene.objects.some((o) => o.modelAssetId)
  )
    throw new Error("Not an outline-only curated example");
  for (const o of scene.objects.filter(
    (o) => !o.maskAssetId && o.lastErrorCode === "NO_MATCH",
  )) {
    const box = pixelBoxSchema.parse(o.imageBounds),
      keyFile = `test-results/demo-expansion-v1/${id}-${o.id}-spatial.json`;
    let attempt;
    try {
      attempt = JSON.parse(await readFile(keyFile, "utf8"));
    } catch {
      attempt = { key: randomUUID(), revision: scene.revision };
      await writeFile(keyFile, JSON.stringify(attempt), { mode: 0o600 });
    }
    const run = await reserveRun(scene.id, scene.ownerId, {
      kind: "SEGMENT_OBJECT",
      expectedRevision: attempt.revision,
      idempotencyKey: attempt.key,
      segmentation: {
        objectId: o.id,
        label: o.label,
        concept: "",
        mode: "spatial",
        box,
        points: [],
      },
    });
    if (run.status !== "QUEUED")
      throw new Error("Inspect the saved spatial attempt before resuming");
    await claimRun(run.id, `curation:${run.id}:spatial`);
    await segmentRunObject(run.id, o.id);
    await finishAnalysis(run.id);
    const fixed = await db.sceneObject.findUniqueOrThrow({
      where: { id: o.id },
    });
    if (!fixed.maskAssetId)
      throw new Error("Location mask still requires review");
    scene = await db.scene.findUniqueOrThrow({
      where: { id: state.sceneId },
      include: { objects: true },
    });
    console.log(`${id}: accepted location mask for ${o.label}`);
  }
  if (scene.objects.some((o) => !o.maskAssetId))
    throw new Error("Missing masks remain");
  delete state.error;
  state.complete = false;
  await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
} finally {
  await db.$disconnect();
}
