// Bounded read-only smoke. No auth, database mutation, browser automation or inference.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const presentationOnly = process.argv.includes("--presentation");
const styles = new Set();
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
const albums = JSON.parse(
  await readFile(
    new URL("../src/lib/demo/photography.json", import.meta.url),
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
  assert(html.includes("Theme"), "Missing appearance control");
  for (const [tag] of html.matchAll(/<link\b[^>]*>/g))
    if (tag.includes('rel="stylesheet"')) {
      const href = tag.match(/href="([^"]+)"/);
      if (href) styles.add(href[1]);
    }
  if (path.startsWith("/demo/product/")) {
    assert(
      html.includes("Album mode") && html.includes("3D mode"),
      "Product media mode controls missing",
    );
    assert(
      html.includes('class="shopping-album"'),
      "Album is not the default product media",
    );
    assert(
      !html.includes('class="shopping-optional-3d"'),
      "3D should be opt-in",
    );
  }
  console.log(`PASS ${path}`);
}
for (const path of [
  "/demo/product/not-in-catalog",
  "/api/demo/assets/not-in-catalog",
])
  assert.equal((await get(path)).status, 404, path);
const assets = frozen.scenes.flatMap((s) => s.objects);
// Two concurrent reads keep this a bounded check rather than a load test.
for (let i = 0; !presentationOnly && i < assets.length; i += 2)
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
const sampleImages = [
  "black-dining-chair",
  "white-shell-chair",
  "writing-desk",
  "dome-desk-lamp",
  "travel-tumbler",
  "navy-bottle",
  "ceramic-canister",
  "metal-storage-tin",
  "graphite-desk-wide",
  "walnut-table-wide",
  "bedroom-wide",
  "kitchen-wide",
].map((id) => `/samples/v3/${id}.webp`);
for (const path of [
  ...sampleImages,
  ...(presentationOnly
    ? []
    : [
        "/demo/images/space.webp",
        "/demo/images/living.webp",
        "/demo/images/corner.webp",
        ...assets.map((a) => `/demo/images/${a.id}.webp`),
        ...frozen.scenes.flatMap((s) =>
          Object.values(s.appearance).filter((v) => typeof v === "string"),
        ),
      ]),
]) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
  assert(response.headers.get("content-type")?.startsWith("image/"), path);
  await response.arrayBuffer();
}
let css = "";
for (const path of styles) {
  assert(path.startsWith("/_next/static/"), "Unexpected stylesheet host");
  const response = await get(path);
  assert.equal(response.status, 200, path);
  css += await response.text();
}
assert(
  css.includes("--shop-bg") &&
    (css.includes("light-dark(") || css.includes("--lightningcss-dark")),
  "Theme palette missing from delivered styles",
);
assert(
  css.includes("demo-reference-frame"),
  "Compact reference frame styles missing",
);
const albumImages = [
  ...Object.values(albums.products),
  ...Object.values(albums.scenes),
].flat();
for (let i = 0; i < albumImages.length; i += 6)
  await Promise.all(
    albumImages.slice(i, i + 6).map(async (image) => {
      assert(image.path.startsWith("/demo/photography/"));
      const response = await get(image.path);
      assert.equal(response.status, 200, image.path);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        image.sha256,
        image.path,
      );
    }),
  );
console.log(
  `PASS ${albumImages.length} album image hashes and default Album mode.`,
);
console.log(
  presentationOnly
    ? "PASS demo pages, theme/compact CSS and sample photos. Unchanged GLB downloads skipped."
    : "PASS demo pages, theme/compact CSS, model and image hashes. Native browser controls are not covered.",
);
