// Publish already-approved, hash-verified meshes. No inference or source exports.
import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const release = "judge-assets-v1", folder = "test-results/catalog-release";
await mkdir(folder, { recursive: true });
const models = JSON.parse(await readFile("src/lib/demo/catalog-models.json", "utf8"));
const products = JSON.parse(await readFile("src/lib/demo/catalog-data.json", "utf8"));
if (models.length !== products.length || new Set(models.map(m=>m.id)).size !== models.length)
  throw new Error("Incomplete approved catalog");
const existing = JSON.parse(execFileSync("gh", ["release", "view", release, "--json", "assets"], { encoding: "utf8" })).assets;
const additions = [];
for (const m of models) {
  if (!/^[a-f0-9]{64}$/.test(m.digest)) throw new Error("Invalid model digest");
  const candidates = [
    `test-results/demo-polish-nov3/approved/${m.id}.glb`,
    `test-results/catalog-prices-v2/approved/${m.id}.glb`,
    `test-results/demo-expansion-v1/approved/${m.id}.glb`,
    `.judge/objects/judge/demo/store-v1/${m.digest}.glb`,
  ];
  let path, bytes;
  for (const candidate of candidates) {
    try {
      const data=await readFile(candidate);
      if(data.length!==m.bytes || createHash("sha256").update(data).digest("hex")!==m.digest)continue;
      bytes=data;path=candidate;break;
    } catch {}
  }
  if (!bytes || bytes.length !== m.bytes || createHash("sha256").update(bytes).digest("hex") !== m.digest)
    throw new Error(`Missing or changed approved model: ${m.id}`);
  const name = `${m.digest}.glb`, remote = existing.find(a=>a.name===name);
  if (remote) {
    if (remote.size !== m.bytes) throw new Error("Release model size mismatch");
  } else {
    const target = `${folder}/${name}`;
    await copyFile(path, target);
    additions.push(target);
  }
}
for (let i=0; i<additions.length; i+=8) {
  execFileSync("gh", ["release", "upload", release, ...additions.slice(i,i+8)], { stdio: "inherit" });
  console.log(`Published ${Math.min(i+8,additions.length)}/${additions.length} new approved models`);
}
if (!process.argv.includes("--models-only")) {
  const manifest = models.map(({id,digest,bytes})=>({id,digest,bytes}));
  await writeFile(`${folder}/manifest.json`, JSON.stringify(manifest,null,2)+"\n");
  execFileSync("gh", ["release", "upload", release, `${folder}/manifest.json`, "--clobber"], { stdio:"inherit" });
}
console.log(`Release ready: ${models.length} approved models; ${additions.length} additions. No inference.`);
