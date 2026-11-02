// Isolated launcher: never reads the maintainer's .env.local cloud credentials.
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
const live = process.argv.includes("--live"),
  port = process.env.JUDGE_PORT ?? "3000";
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k]) =>
      !/^DATABASE_URL|^DIRECT_URL|^NEON_|^R2_|^MODEL_API_KEY$|^FAL_KEY$|^META_|^SAM3D_|^GENERATION_|^RESCENE_JUDGE|^NEXT_PUBLIC_|^VERCEL|^WORKFLOW_/.test(
        k,
      ),
  ),
);
Object.assign(env, {
  RESCENE_JUDGE_MODE: live ? "live" : "samples",
  NEXT_PUBLIC_LOCAL_JUDGE: "true",
  NEXT_PUBLIC_JUDGE_SAMPLES: live ? "false" : "true",
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
  DATABASE_URL: "postgresql://rescene:rescene@127.0.0.1:55432/rescene",
  DIRECT_URL: "postgresql://rescene:rescene@127.0.0.1:55432/rescene",
  R2_PREFIX: "judge",
  WORKFLOW_TARGET_WORLD: "local",
  WORKFLOW_LOCAL_DATA_DIR: ".judge/workflows",
  WORKFLOW_LOCAL_BASE_URL: `http://127.0.0.1:${port}`,
  NEON_AUTH_BASE_URL: "http://127.0.0.1:1/unavailable",
  NEON_AUTH_JWKS_URL: "http://127.0.0.1:1/unavailable",
  R2_ACCOUNT_ID: "local-unused",
  R2_ACCESS_KEY_ID: "local-unused",
  R2_SECRET_ACCESS_KEY: "local-unused",
  R2_BUCKET: "local-judge",
  META_API_BASE_URL: "https://api.meta.ai/v1",
  META_ANALYSIS_MODEL: "muse-spark-1.3",
  META_SEGMENTATION_MODEL: "sam-3.1",
  META_IMAGE_MODEL: "muse-image-1.0",
  META_TRANSCRIPTION_MODEL: "muse-voice-transcribe-1.0",
  SAM3D_MODEL: "fal-ai/sam-3/3d-objects",
  MODEL_API_KEY: "",
  FAL_KEY: "",
  GENERATION_ENABLED: live ? "true" : "false",
});
let local = {};
try {
  local = JSON.parse(await readFile(".judge/config.json", "utf8"));
} catch {}
env.NEON_AUTH_COOKIE_SECRET = local.secret ?? randomBytes(32).toString("hex");
if (live) {
  let keys = "";
  try {
    keys = await readFile(".judge/keys.env", "utf8");
  } catch {}
  for (const line of keys.split("\n")) {
    const m = line.match(/^(MODEL_API_KEY|FAL_KEY)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  for (const name of ["MODEL_API_KEY", "FAL_KEY"]) {
    env[name] ||= process.env[name] ?? "";
    if (!env[name])
      throw new Error(`Set ${name} in .judge/keys.env or your shell.`);
  }
}
const args = process.argv.includes("--seed")
  ? ["--conditions=react-server", "--import", "tsx", "scripts/judge/seed.ts"]
  : [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ];
if (process.argv.includes("--migrate"))
  args.splice(
    0,
    args.length,
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
  );
const child = spawn(process.execPath, args, { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
