/** Reviewed demo-material rebuild. Existing Meta geometry, original photos and
 * public SAM selections remain stable. Paid stages retain no-retry receipts. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { createHash } from "node:crypto";
import scenes from "../src/lib/demo/frozen-scenes.json";
import masks from "../src/lib/demo/photo-shopping.json";
import {
  planObjectQuality,
  generateMaterialSample,
  reviewMaterialSample,
} from "../src/lib/ai/quality";
const folder = "test-results/demo-polish-nov3",
  hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
await mkdir(folder, { recursive: true });
const targets = scenes.scenes
  .filter((s) => ["corner", "living", "chair-studio"].includes(s.id))
  .flatMap((scene) =>
    scene.objects
      .filter((o) => o.id !== "chair-studio-item-3")
      .map((object) => ({ scene, object })),
  );
const stage = process.argv[2];
if (process.env.DEMO_PRODUCTS) {
  const ids = new Set(process.env.DEMO_PRODUCTS.split(","));
  targets.splice(
    0,
    targets.length,
    ...targets.filter((t) => ids.has(t.object.id)),
  );
}
async function exists(path: string) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}
async function paid<T>(file: string, kind: string, fn: () => Promise<T>) {
  const prior = await exists(file);
  if (prior) {
    if (prior.status !== "SUCCEEDED")
      throw new Error(`Saved ${kind} attempt needs review; no resubmission`);
    return prior.result as T;
  }
  await writeFile(
    file,
    JSON.stringify({
      status: "SUBMITTING",
      kind,
      startedAt: new Date().toISOString(),
    }),
    { flag: "wx", mode: 0o600 },
  );
  try {
    const result = await fn();
    await writeFile(
      file,
      JSON.stringify({ status: "SUCCEEDED", kind, result }),
      { mode: 0o600 },
    );
    return result;
  } catch (e) {
    await writeFile(
      file,
      JSON.stringify({
        status: "FAILED_OR_UNCERTAIN",
        kind,
        errorType: e instanceof Error ? e.name : "unknown",
      }),
      { mode: 0o600 },
    );
    throw e;
  }
}
const queue = [...targets];
async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    const { scene, object } = job,
      selection = masks.scenes.find((s) => s.id === scene.id)!,
      mask = selection.products.find((p) => p.id === object.id)!;
    const photo = await sharp(`public${selection.photo.path}`)
      .resize(selection.width, selection.height)
      .webp({ quality: 98 })
      .toBuffer();
    const file = `${folder}/${object.id}-plan.json`;
    if (stage === "plan") {
      const overlay = await sharp(photo)
        .composite([
          {
            input: await sharp(`public${mask.maskPath}`)
              .linear([1, 1, 1, 0.22], [0, 0, 0, 0])
              .png()
              .toBuffer(),
            left: mask.bounds[0],
            top: mask.bounds[1],
          },
        ])
        .png()
        .toBuffer();
      const diagnostics = await readFile(`${folder}/${object.id}-before.png`);
      await paid(file, "muse-spark-material-plan", () =>
        planObjectQuality(photo, overlay, diagnostics, {
          label: object.id,
          findings: [
            "The first diagnostic tile is a generated product photograph; the other six are actual mesh front/right/back/left/top/underside. Use the original scene photo as authority for material color. Side/rear faces currently lack detailed material texture. Preserve real construction seams, openings, wood legs and source color. No logos are being added.",
          ],
          bounds: {
            xMin: mask.bounds[0],
            yMin: mask.bounds[1],
            xMax: mask.bounds[0] + mask.bounds[2],
            yMax: mask.bounds[1] + mask.bounds[3],
            imageWidth: selection.width,
            imageHeight: selection.height,
          },
        }),
      );
      console.log(`${object.id}: reviewed-photo Spark material plan saved`);
    } else if (stage === "samples") {
      const plan = (await exists(file))?.result?.value;
      if (!plan) throw new Error("Run plan first");
      for (const material of plan.materials
        .filter(
          (m: { finish: string }) =>
            !["metallic", "translucent"].includes(m.finish),
        )
        .slice(0, 3)) {
        const e = material.evidence,
          left = Math.floor(e.x0 * selection.width),
          top = Math.floor(e.y0 * selection.height),
          width = Math.min(
            selection.width - left,
            Math.max(1, Math.ceil((e.x1 - e.x0) * selection.width)),
          ),
          height = Math.min(
            selection.height - top,
            Math.max(1, Math.ceil((e.y1 - e.y0) * selection.height)),
          ),
          crop = await sharp(photo)
            .extract({ left, top, width, height })
            .png()
            .toBuffer();
        const samplePath = `${folder}/${object.id}-${material.id}.png`;
        await paid(
          `${samplePath}.json`,
          "muse-image-material-sample",
          async () => {
            const out = await generateMaterialSample(material, crop);
            await writeFile(samplePath, out.bytes, { mode: 0o600 });
            const meta = await sharp(out.bytes).metadata();
            return {
              model: out.model,
              sha256: hash(out.bytes),
              width: meta.width,
              height: meta.height,
            };
          },
        );
        const sample = await readFile(samplePath),
          review = await paid(
            `${samplePath}.review.json`,
            "muse-spark-material-review",
            () => reviewMaterialSample(material, crop, sample),
          );
        console.log(
          `${object.id}/${material.id}: sample review ${review.value.accepted ? "accepted" : "rejected"}`,
        );
      }
    } else throw new Error("Use plan or samples");
  }
}
await Promise.all([worker(), worker()]);
