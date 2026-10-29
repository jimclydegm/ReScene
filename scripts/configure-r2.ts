import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { S3Client, GetBucketCorsCommand, PutBucketCorsCommand, type CORSRule } from "@aws-sdk/client-s3";

config({ path: ".env.local", quiet: true });
const Bucket = process.env.R2_BUCKET;
const client = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! } });
const wanted = JSON.parse(await readFile(new URL("../config/r2-cors.json", import.meta.url), "utf8")) as CORSRule[];

try {
  let rules: CORSRule[] = [];
  try { rules = (await client.send(new GetBucketCorsCommand({ Bucket }))).CORSRules ?? []; }
  catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error; }
  for (const rule of wanted) {
    if (!rules.some(existing => rule.AllowedOrigins?.every(origin => existing.AllowedOrigins?.includes(origin)) && rule.AllowedMethods?.every(method => existing.AllowedMethods?.includes(method)))) rules.push(rule);
  }
  await client.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: rules } }));
  console.log("R2 browser origins configured; existing rules preserved.");
  // Jim chose to leave staging auto-deletion disabled. Never change lifecycle here.
  console.log("Bucket lifecycle unchanged; automatic staging deletion remains disabled.");
} catch (error) {
  const safe = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  console.error("R2 configuration failed:", safe.name ?? "Error", safe.$metadata?.httpStatusCode ?? "");
  process.exitCode = 1;
} finally { client.destroy(); }
