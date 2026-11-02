// Bounded read-only release smoke. --ui omits image/model downloads. No inference.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.DEMO_BASE_URL ?? "http://localhost:4317",
  ui = process.argv.includes("--ui");
const load = async (file) =>
  JSON.parse(
    await readFile(new URL(`../src/lib/demo/${file}`, import.meta.url), "utf8"),
  );
const [products, collections, models, media] = await Promise.all([
  load("catalog-data.json"),
  load("collections-data.json"),
  load("catalog-models.json"),
  load("example-media.json"),
]);
assert.equal(products.length, 72);
assert.equal(collections.length, 11);
const get = (path) =>
  fetch(new URL(path, base), {
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
const routes = [
  "/demo",
  "/demo/products",
  "/demo/spaces",
  "/demo/scenes",
  ...collections.flatMap((c) => [
    `/demo/space?collection=${c.id}`,
    `/demo/shop-the-scene?collection=${c.id}`,
  ]),
  ...products.map((p) => `/demo/product/${p.id}`),
];
for (const path of routes) {
  const res = await get(path);
  assert.equal(res.status, 200, path);
  const html = await res.text();
  assert(html.includes("ReScene"), path);
  assert(
    !/ownerId|\.r2\.cloudflarestorage\.com|postgresql:\/\/|LLM_/.test(html),
    path,
  );
  if (path.startsWith("/demo/product/")) {
    assert(html.includes("Album mode") && html.includes("3D mode"), path);
    assert(html.includes('class="shopping-album"'), path);
  }
}
for (const path of [
  "/demo/space?collection=private-scene",
  "/demo/shop-the-scene?collection=__proto__",
  "/demo/product/not-in-catalog",
  "/api/demo/assets/not-in-catalog",
]) {
  const response = await get(path);
  // Next streams dynamic notFound boundaries after sending the shared shell.
  if (path.startsWith("/demo/") && response.status === 200) {
    const html = await response.text();
    assert(html.includes("NEXT_HTTP_ERROR_FALLBACK;404"), path);
    assert(!html.includes('class="shopping-showroom"'), path);
  } else assert.equal(response.status, 404, path);
}
console.log(
  `${routes.length} shopping pages, Album/3D controls and invalid collection/asset boundaries pass.`,
);
if (!ui) {
  const photos = Object.values(media.products)
      .flat()
      .concat(Object.values(media.scenes).flat()),
    approved = models.filter((m) => Object.hasOwn(media.products, m.id));
  for (let i = 0; i < photos.length; i += 2)
    await Promise.all(
      photos.slice(i, i + 2).map(async (p) => {
        const r = await get(p.path);
        assert.equal(r.status, 200, p.path);
        const bytes = Buffer.from(await r.arrayBuffer());
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          p.sha256,
          p.path,
        );
      }),
    );
  for (let i = 0; i < approved.length; i += 2)
    await Promise.all(
      approved.slice(i, i + 2).map(async (m) => {
        const r = await get(
          `/api/demo/assets/${m.id}?v=${m.digest.slice(0, 12)}`,
        );
        assert.equal(r.status, 200, m.id);
        assert.equal(r.headers.get("content-type"), "model/gltf-binary");
        assert.equal(r.headers.get("location"), null);
        const bytes = Buffer.from(await r.arrayBuffer());
        assert.equal(bytes.length, m.bytes, m.id);
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          m.digest,
          m.id,
        );
      }),
    );
  console.log(
    `${photos.length} new Muse photographs and ${approved.length} new immutable textured models delivered with exact hashes.`,
  );
}
