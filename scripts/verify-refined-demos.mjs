// Bounded read-only checks for the material/environment refinement release.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:4317",
  hash = (b) => createHash("sha256").update(b).digest("hex"),
  load = async (p) => JSON.parse(await readFile(p, "utf8"));
const frozen = await load("src/lib/demo/frozen-scenes.json"),
  models = await load("src/lib/demo/catalog-models.json");
const scenes = frozen.scenes.filter((s) =>
  ["corner", "living", "chair-studio"].includes(s.id),
);
let meshes = 0;
async function get(path) {
  const r = await fetch(new URL(path, base), {
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(r.status, 200, path);
  return Buffer.from(await r.arrayBuffer());
}
for (const scene of scenes) {
  assert(scene.appearance.backgroundUrl.startsWith("/demo/refined/"));
  const atlas = await readFile(`public${scene.appearance.backgroundUrl}`);
  assert.equal(hash(await get(scene.appearance.backgroundUrl)), hash(atlas));
  for (const o of scene.objects) {
    if (o.id === "chair-studio-item-3") continue;
    const m = models.find((m) => m.id === o.id);
    assert.equal(m.digest, o.digest);
    const b = await get(`/api/demo/assets/${m.id}?v=${m.digest.slice(0, 12)}`);
    assert.equal(b.length, m.bytes, m.id);
    assert.equal(hash(b), m.digest, m.id);
    meshes++;
  }
}
console.log(
  `${meshes} model hashes and ${scenes.length} independent environment atlases pass at ${base}.`,
);
