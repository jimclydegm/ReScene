/** Recover the ten approved pre-refinement material assets. No inference or geometry edits. */
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readMesh } from "../src/lib/quality/mesh";
import { diagnoseMesh } from "../src/lib/quality/diagnostics";
const folder = "test-results/demo-polish-nov3",
  models = JSON.parse(
    await readFile("src/lib/demo/catalog-models.json", "utf8"),
  ),
  originals = JSON.parse(
    await readFile(`${folder}/catalog-models-before.json`, "utf8"),
  ),
  frozen = JSON.parse(
    await readFile("src/lib/demo/frozen-scenes.json", "utf8"),
  );
const ids = frozen.scenes
  .filter((s: { id: string }) =>
    ["corner", "living", "chair-studio"].includes(s.id),
  )
  .flatMap((s: { objects: { id: string }[] }) => s.objects.map((o) => o.id))
  .filter((id: string) => id !== "chair-studio-item-3");
for (const id of ids) {
  const old = originals.find((m: { id: string }) => m.id === id),
    path = `.judge/objects/judge/demo/store-v1/${old.digest}.glb`,
    b = await readFile(path),
    digest = createHash("sha256").update(b).digest("hex");
  if (digest !== old.digest || b.length !== old.bytes)
    throw Error("Original asset hash mismatch");
  const doc = readMesh(b),
    current = readMesh(
      await readFile(
        `test-results/texture-fidelity-fix/previous-bakes/${id}.glb`,
      ),
    );
  for (const [p, mesh] of doc.primitives.entries()) {
    const q = current.primitives[p];
    for (const key of ["positions", "indices", "uv"] as const)
      if (
        !mesh[key] ||
        !q[key] ||
        !Buffer.from(mesh[key]!.buffer).equals(Buffer.from(q[key]!.buffer))
      )
        throw Error("Geometry changed");
  }
  const diagnostics = diagnoseMesh(doc);
  if (diagnostics.findings.some((f) => f.code === "UV_MISSING"))
    throw Error("Missing mapping");
  await copyFile(path, `${folder}/approved/${id}.glb`);
  await writeFile(
    `${folder}/${id}-bake.json`,
    JSON.stringify({
      sourceDigest: old.digest,
      digest,
      bytes: b.length,
      geometryPreserved: true,
      referenceRecovery: true,
      coverage: { unmapped: 0 },
      note: "Restore approved pre-refinement reference texture; observed/generated shares not remeasured.",
    }),
  );
  for (const m of [
    models.find((m: { id: string }) => m.id === id),
    ...frozen.scenes.flatMap((s: { objects: { id: string }[] }) =>
      s.objects.filter((o) => o.id === id),
    ),
  ]) {
    m.digest = digest;
    m.bytes = b.length;
  }
  console.log(`${id}: original reference texture restored`);
}
const hulls: string[] = [];
await writeFile(
  "src/lib/demo/catalog-models.json",
  JSON.stringify(
    models,
    (key, v) =>
      key === "clearanceHull" ? `HULL_${hulls.push(JSON.stringify(v)) - 1}` : v,
    2,
  ).replace(/"HULL_(\d+)"/g, (_, i) => hulls[Number(i)]) + "\n",
);
await writeFile(
  "src/lib/demo/frozen-scenes.json",
  JSON.stringify(frozen, null, 2) + "\n",
);
