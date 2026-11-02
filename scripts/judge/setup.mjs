import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
const live = process.argv.includes("--live");
await mkdir(".judge", { recursive: true });
try {
  await readFile(".judge/config.json");
} catch {
  await writeFile(
    ".judge/config.json",
    JSON.stringify({ secret: randomBytes(32).toString("hex") }),
    { mode: 0o600 },
  );
}
const models = JSON.parse(
  await readFile("src/lib/demo/catalog-models.json", "utf8"),
);
const version = "judge-assets-v1";
for (const m of models) {
  const key = `judge/demo/store-v1/${m.digest}.glb`,
    path = `.judge/objects/${key}`;
  await mkdir(".judge/objects/judge/demo/store-v1", { recursive: true });
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {}
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== m.digest) {
    const url = `https://github.com/jimclydegm/ReScene/releases/download/${version}/${m.digest}.glb`;
    const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!r.ok)
      throw new Error(
        `Approved asset download failed (${r.status}); see docs/JUDGE_SETUP.md.`,
      );
    bytes = Buffer.from(await r.arrayBuffer());
    if (
      bytes.length !== m.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== m.digest
    )
      throw new Error("Sample checksum mismatch");
    await writeFile(path, bytes, { mode: 0o600 });
  }
  await writeFile(`${path}.mime`, "model/gltf-binary", { mode: 0o600 });
}
console.log(
  `Verified ${models.length} approved models. No inference was submitted.`,
);
if (live) {
  try {
    await readFile(".judge/keys.env");
  } catch {
    await writeFile(".judge/keys.env", "MODEL_API_KEY=\nFAL_KEY=\n", {
      mode: 0o600,
    });
  }
  if (!process.argv.includes("--existing-postgres")) {
    const r = spawnSync(
      "docker",
      ["compose", "-f", "compose.judge.yaml", "up", "-d", "--wait"],
      { stdio: "inherit" },
    );
    if (r.status !== 0)
      throw new Error("Start Docker and rerun setup:judge -- --live.");
  }
  for (const flag of ["--migrate", "--seed"]) {
    const r = spawnSync(
      process.execPath,
      ["scripts/judge/run.mjs", "--live", flag],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          MODEL_API_KEY: process.env.MODEL_API_KEY ?? "setup-no-inference",
          FAL_KEY: process.env.FAL_KEY ?? "setup-no-inference",
        },
      },
    );
    if (r.status !== 0) throw new Error("Local database setup failed.");
  }
  console.log(
    "Local live database seeded. Add your two keys to .judge/keys.env, then npm run dev:judge:live.",
  );
} else
  console.log("Run npm run dev:judge, then open http://127.0.0.1:3000/demo.");
