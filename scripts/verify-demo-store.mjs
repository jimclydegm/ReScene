// Bounded read-only smoke. No auth, database mutation, browser automation or inference.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = new URL(process.env.DEMO_BASE_URL ?? "http://localhost:4317");
assert(
  base.protocol === "https:" ||
    ["localhost", "127.0.0.1"].includes(base.hostname),
);
const frozen = JSON.parse(
  await readFile(
    new URL("../src/lib/demo/frozen-scenes.json", import.meta.url),
    "utf8",
  ),
);
async function get(path) {
  return fetch(new URL(path, base), {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
}
for (const path of [
  "/demo",
  "/demo/products",
  "/demo/spaces",
  "/demo/scenes",
  "/demo/space?collection=corner",
  "/demo/space?collection=space",
  "/demo/shop-the-scene?collection=corner",
  "/demo/shop-the-scene?collection=space",
  "/demo/space",
  "/demo/shop-the-scene",
  ...frozen.scenes.flatMap((s) =>
    s.objects.map((o) => `/demo/product/${o.id}`),
  ),
]) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert(html.includes("ReScene"), path);
  assert(
    !/\.r2\.cloudflarestorage\.com|postgresql:\/\/|LLM_/.test(html),
    "Private credentials/storage URL in demo HTML",
  );
  console.log(`PASS ${path}`);
}
for (const path of [
  "/demo/product/not-in-catalog",
  "/api/demo/assets/not-in-catalog",
])
  assert.equal((await get(path)).status, 404, path);
const assets = frozen.scenes.flatMap((s) => s.objects);
// Two concurrent reads keep this a bounded check rather than a load test.
for (let i = 0; i < assets.length; i += 2)
  await Promise.all(
    assets.slice(i, i + 2).map(async (asset) => {
      const response = await get(
        `/api/demo/assets/${asset.id}?v=${asset.digest.slice(0, 12)}`,
      );
      assert.equal(response.status, 200, asset.id);
      assert.equal(response.headers.get("content-type"), "model/gltf-binary");
      assert(
        response.headers.get("cache-control")?.includes("public"),
        "Approved assets should be cacheable",
      );
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length, asset.bytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        asset.digest,
      );
      console.log(`PASS ${asset.id} frozen GLB hash`);
    }),
  );
for (const path of [
  "/demo/images/space.webp",
  "/demo/images/living.webp",
  "/demo/images/corner.webp",
  ...assets.map((a) => `/demo/images/${a.id}.webp`),
  ...frozen.scenes.flatMap((s) =>
    Object.values(s.appearance).filter((v) => typeof v === "string"),
  ),
]) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
  assert(response.headers.get("content-type")?.startsWith("image/"), path);
  await response.arrayBuffer();
}
console.log(
  "PASS demo routes, unknown-ID rejection, 11 GLB hashes and all approved images. Native browser controls are not covered.",
);
