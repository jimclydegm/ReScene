/** Local export only: reviewed, immutable demo derivatives. No paid calls or DB writes. */
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { compositionSchema } from "../src/lib/scene/composition";
import { inspectGlb } from "../src/lib/ai/glb";
const folder = "test-results/demo-polish-nov3",
  hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const catalog = JSON.parse(
    await readFile("src/lib/demo/catalog-models.json", "utf8"),
  ),
  frozen = JSON.parse(
    await readFile("src/lib/demo/frozen-scenes.json", "utf8"),
  );
for (const [file, data] of [
  ["catalog-models-before.json", catalog],
  ["frozen-before.json", frozen],
] as const) {
  try {
    await writeFile(`${folder}/${file}`, JSON.stringify(data), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
}
const environments = JSON.parse(
  await readFile(`${folder}/environments-ready.json`, "utf8"),
);
let count = 0;
await mkdir(".judge/objects/judge/demo/store-v1", { recursive: true });
for (const env of environments) {
  const scene = frozen.scenes.find((s: { id: string }) => s.id === env.id);
  if (!scene) throw Error("Unknown approved scene");
  if (
    hash(await readFile(`public${env.appearance.backgroundUrl}`)) !== env.sha256
  )
    throw Error("Changed environment atlas");
  scene.composition = compositionSchema.parse(env.composition);
  scene.appearance = env.appearance;
  for (const object of scene.objects) {
    let report;
    try {
      report = JSON.parse(
        await readFile(`${folder}/${object.id}-bake.json`, "utf8"),
      );
    } catch {
      continue;
    }
    if (!report.geometryPreserved || report.coverage.unmapped > 0)
      throw Error("Incomplete reviewed mesh");
    const path = `${folder}/approved/${object.id}.glb`,
      bytes = await readFile(path);
    inspectGlb(bytes);
    if (bytes.length !== report.bytes || hash(bytes) !== report.digest)
      throw Error("Changed reviewed mesh");
    const model = catalog.find((m: { id: string }) => m.id === object.id);
    if (!model) throw Error("Unknown approved product");
    for (const entry of [model, object]) {
      entry.digest = report.digest;
      entry.bytes = report.bytes;
    }
    await copyFile(
      path,
      `.judge/objects/judge/demo/store-v1/${report.digest}.glb`,
    );
    count++;
  }
}
// Keep large hull point clouds on one line, as in the existing snapshot.
const hulls: string[] = [];
const serialized = JSON.stringify(
  catalog,
  (key, value) =>
    key === "clearanceHull"
      ? `HULL_${hulls.push(JSON.stringify(value)) - 1}`
      : value,
  2,
).replace(/"HULL_(\d+)"/g, (_, index) => hulls[Number(index)]);
await writeFile("src/lib/demo/catalog-models.json", serialized + "\n");
await writeFile(
  "src/lib/demo/frozen-scenes.json",
  JSON.stringify(frozen, null, 2) + "\n",
);
console.log(
  `Exported ${count} reviewed material bakes and ${environments.length} environments; original photographs, selections and transforms preserved.`,
);
