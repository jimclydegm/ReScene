// Verify all approved photo-shopping files and page affordances; no inference.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base=process.env.DEMO_BASE_URL??"http://127.0.0.1:4317";
const data=JSON.parse(await readFile("src/lib/demo/photo-shopping.json","utf8"));
const photography=JSON.parse(await readFile("src/lib/demo/photography.json","utf8"));
const get=path=>fetch(new URL(path,base),{redirect:"error",signal:AbortSignal.timeout(30000)});
let masks=0,photos=0;
for(const scene of data.scenes){
  const page=await get(`/demo/shop-the-scene?collection=${scene.id}`);
  assert.equal(page.status,200);
  const html=await page.text();
  assert(html.includes("Shop in 2D")&&html.includes("Scene album"),scene.id);
  assert(!/ownerId|storageKey|maskAssetId|providerRequestId|\.r2\.cloudflarestorage\.com|LLM_|postgresql:\/\//.test(html),scene.id);
  for(const file of [scene.photo,...scene.products.map(p=>({path:p.maskPath,sha256:p.sha256})),...scene.products.flatMap(p=>(photography.products[p.id]??[]).filter(i=>i.path.startsWith("/demo/photo-shopping/albums/")))]){
    const r=await get(file.path);assert.equal(r.status,200,file.path);
    const b=Buffer.from(await r.arrayBuffer());assert.equal(createHash("sha256").update(b).digest("hex"),file.sha256,file.path);
    if(file.path.endsWith(".png"))masks++;else photos++;
  }
}
console.log(`${data.scenes.length} shop pages, ${masks} approved masks and ${photos} reference/product photographs verified. No inference.`);
