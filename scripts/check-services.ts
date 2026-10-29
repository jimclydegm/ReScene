import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { fal } from "@fal-ai/client";
import { randomUUID } from "node:crypto";

config({ path: ".env.local", quiet: true });

const results: { service: string; ok: boolean; detail: string }[] = [];

async function check(service: string, action: () => Promise<string>) {
  try { results.push({ service, ok: true, detail: await action() }); }
  catch (error) {
    // Never print SDK errors, URLs, headers, or credentials.
    const safe = error as { name?: string; status?: number; $metadata?: { httpStatusCode?: number } };
    results.push({ service, ok: false, detail: `Failed (${safe.name ?? "Error"}${safe.status ?? safe.$metadata?.httpStatusCode ? `, HTTP ${safe.status ?? safe.$metadata?.httpStatusCode}` : ""})` });
  }
}

await check("Neon Postgres", async () => {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('AppUser','Scene','Asset','Product','SceneObject','GenerationRun','GenerationStep','ScenePublication')`;
  if (rows[0].count !== 8) throw new Error("Application schema is not initialized");
  return "Connected; all 8 application tables exist";
});

await check("Neon Auth", async () => {
  const response = await fetch(`${process.env.NEON_AUTH_BASE_URL}/ok`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Auth endpoint unavailable");
  const jwks = await fetch(process.env.NEON_AUTH_JWKS_URL!, { signal: AbortSignal.timeout(15_000) });
  if (!jwks.ok || !Array.isArray((await jwks.json()).keys)) throw new Error("Invalid JWKS endpoint");
  return "Auth service and canonical JWKS endpoint respond";
});

await check("Cloudflare R2", async () => {
  const client = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! }, requestChecksumCalculation: "WHEN_REQUIRED" });
  const Bucket = process.env.R2_BUCKET;
  const Key = `${process.env.R2_PREFIX ?? "prototype"}/staging/check-${randomUUID()}.txt`;
  let created = false;
  try {
    await client.send(new PutObjectCommand({ Bucket, Key, Body: "rescene-storage-check", ContentType: "text/plain" }));
    created = true;
    const result = await client.send(new GetObjectCommand({ Bucket, Key }));
    if (await result.Body?.transformToString() !== "rescene-storage-check") throw new Error("Storage read mismatch");
    return "Authenticated object write/read/delete round trip";
  } finally {
    if (created) await client.send(new DeleteObjectCommand({ Bucket, Key }));
    client.destroy();
  }
});

await check("Meta Model API", async () => {
  const response = await fetch(`${process.env.META_API_BASE_URL}/models`, { headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Meta authentication failed");
  const models = (await response.json()).data.map((model: { id: string }) => model.id) as string[];
  if (!models.includes("muse-spark-1.3") || !models.includes("sam-3.1")) throw new Error("Required models unavailable");
  return "Authenticated; Spark 1.3 and SAM 3.1 available (no inference performed)";
});

await check("fal queue", async () => {
  fal.config({ credentials: process.env.FAL_KEY });
  try {
    await fal.queue.status(process.env.SAM3D_MODEL ?? "fal-ai/sam-3/3d-objects", { requestId: randomUUID() });
    return "Queue status endpoint responds; inference still unverified";
  } catch (error) {
    if ((error as { status?: number }).status === 404) return "Queue read returned expected missing-job response; inference still unverified";
    throw error;
  }
});

console.table(results);
if (results.some(result => !result.ok)) process.exitCode = 1;
