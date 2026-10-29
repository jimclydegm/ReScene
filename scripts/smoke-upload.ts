// Explicit deployed storage check. Uses disposable QA accounts from smoke-foundation.
// Creates synthetic image assets; never submits model inference or reads merchant photos.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

config({ path: ".env.local", quiet: true });
const checks: string[] = [];
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

try {
  assert(process.env.QA_CREDENTIAL_FILE, "Set QA_CREDENTIAL_FILE to the smoke-foundation output file");
  const qa = JSON.parse(await readFile(process.env.QA_CREDENTIAL_FILE, "utf8"));
  const base = process.env.SMOKE_BASE_URL ?? qa.base;
  const cookies = new Map<string, string>();
  async function api(path: string, method = "GET", body?: unknown) {
    const response = await fetch(base + path, {
      method, redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base,
        Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const separator = pair.indexOf("=");
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return { response, data: await response.json().catch(() => null) };
  }
  const login = await api("/api/auth/sign-in/email", "POST", qa.owner);
  assert.equal(login.response.status, 200, "QA account sign-in failed");
  assert(cookies.size, "QA account session missing");

  // Deliberately rotated, oversized, metadata-bearing input exercises server normalization.
  const fixture = await sharp({ create: { width: 2400, height: 1200, channels: 3,
    background: { r: 212, g: 224, b: 205 } } })
    .withMetadata({ orientation: 6 }).jpeg({ quality: 80 }).toBuffer();
  const created = await api("/api/scenes", "POST", { title: "Storage QA — synthetic image" });
  assert.equal(created.response.status, 201, "QA scene creation failed");
  const sceneId = created.data.scene.id;
  const reserve = await api(`/api/scenes/${sceneId}/uploads`, "POST", {
    contentType: "image/jpeg", byteSize: fixture.length, expectedRevision: 0
  });
  assert.equal(reserve.response.status, 201, "Upload reservation failed");
  const { uploadUrl, headers, assetId } = reserve.data;
  checks.push("Authenticated upload reservation");

  const preflight = await fetch(uploadUrl, { method: "OPTIONS", headers: {
    Origin: base, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type"
  } });
  assert(preflight.ok, `Browser PUT preflight failed (HTTP ${preflight.status})`);
  assert.equal(preflight.headers.get("access-control-allow-origin"), base);
  assert(preflight.headers.get("access-control-allow-methods")?.includes("PUT"));
  const deniedOrigin = await fetch(uploadUrl, { method: "OPTIONS", headers: {
    Origin: "https://untrusted.example", "Access-Control-Request-Method": "PUT"
  } });
  assert.notEqual(deniedOrigin.headers.get("access-control-allow-origin"), "https://untrusted.example");
  checks.push("Approved browser CORS; untrusted origin denied");

  const uploaded = await fetch(uploadUrl, { method: "PUT", headers: { ...headers, Origin: base }, body: fixture });
  assert.equal(uploaded.status, 200, "Signed R2 PUT failed");
  assert.equal(uploaded.headers.get("access-control-allow-origin"), base);
  const completed = await api(`/api/scenes/${sceneId}/uploads/${assetId}/complete`, "POST", { expectedRevision: 0 });
  assert.equal(completed.response.status, 200, `Upload completion failed (HTTP ${completed.response.status})`);
  assert.equal(completed.data.revision, 1);
  checks.push("Direct PUT and immutable upload completion");

  const reloaded = await api(`/api/scenes/${sceneId}`);
  assert.equal(reloaded.data.scene.hasImage, true);
  assert.equal(reloaded.data.scene.revision, 1);
  const preview = await fetch(reloaded.data.scene.previewUrl, { headers: { Origin: base } });
  assert.equal(preview.status, 200, "Signed owner preview failed");
  assert.equal(preview.headers.get("access-control-allow-origin"), base);
  const normalized = Buffer.from(await preview.arrayBuffer());
  const metadata = await sharp(normalized).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, 1600);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
  checks.push("Reload persistence; oriented 800×1600 WebP with metadata stripped");

  assert(process.env.DATABASE_URL);
  const sql = neon(process.env.DATABASE_URL);
  const assets = await sql`SELECT id, kind, status, "storageKey", "sha256", "byteSize", "derivedFromId"
    FROM "Asset" WHERE "sceneId" = ${sceneId}`;
  assert.equal(assets.length, 2);
  const source = assets.find(asset => asset.kind === "SOURCE_IMAGE");
  const derivative = assets.find(asset => asset.kind === "NORMALIZED_IMAGE");
  assert(source && derivative, "Expected source and normalized assets");
  assert.equal(source.status, "READY");
  assert.equal(derivative.status, "READY");
  assert.equal(source.sha256, hash(fixture));
  assert.equal(derivative.sha256, hash(normalized));
  assert.equal(derivative.derivedFromId, source.id);
  assert(!source.storageKey.includes("/staging/"));
  checks.push("Neon asset lineage, READY state, and checksums");

  const replay = await api(`/api/scenes/${sceneId}/uploads/${assetId}/complete`, "POST", { expectedRevision: 0 });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.revision, 1);
  checks.push("Completion replay does not duplicate assets or revision");
  const unsigned = new URL(reloaded.data.scene.previewUrl);
  unsigned.search = "";
  assert([400, 401, 403].includes((await fetch(unsigned)).status), "Unsigned object access must be denied");
  checks.push("Unsigned object storage access denied");

  assert(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
  const r2 = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: "WHEN_REQUIRED" });
  // An unexpired PUT can recreate staging, but must never mutate accepted input.
  const stagingKey = `${process.env.R2_PREFIX ?? "development"}/staging/${sceneId}/${assetId}`;
  try {
    assert.equal((await fetch(uploadUrl, { method: "PUT", headers, body: Buffer.from("changed staging bytes") })).status, 200);
    const accepted = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: source.storageKey }));
    assert(accepted.Body);
    assert.equal(hash(await accepted.Body.transformToByteArray()), hash(fixture));
    checks.push("Reused staging PUT cannot change accepted source");
  } finally {
    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: stagingKey }));
  }
  const invalidScene = await api("/api/scenes", "POST", { title: "Storage QA — invalid image check" });
  assert.equal(invalidScene.response.status, 201);
  const invalidId = invalidScene.data.scene.id;
  const invalidBytes = Buffer.from("This is not a JPEG image");
  const invalid = await api(`/api/scenes/${invalidId}/uploads`, "POST", {
    contentType: "image/jpeg", byteSize: invalidBytes.length, expectedRevision: 0
  });
  assert.equal(invalid.response.status, 201);
  const invalidKey = `${process.env.R2_PREFIX ?? "development"}/staging/${invalidId}/${invalid.data.assetId}`;
  try {
    assert.equal((await fetch(invalid.data.uploadUrl, { method: "PUT", headers: invalid.data.headers, body: invalidBytes })).status, 200);
    const rejected = await api(`/api/scenes/${invalidId}/uploads/${invalid.data.assetId}/complete`, "POST", { expectedRevision: 0 });
    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.data.error.code, "INVALID_IMAGE");
    const rejectedAssets = await sql`SELECT status FROM "Asset" WHERE id = ${invalid.data.assetId}`;
    assert.equal(rejectedAssets[0].status, "REJECTED");
    assert.equal((await api(`/api/scenes/${invalidId}`)).data.scene.hasImage, false);
    checks.push("Malformed image rejected before scene acceptance");
  } finally {
    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: invalidKey }));
    r2.destroy();
  }
  const report = join(tmpdir(), `rescene-storage-${sceneId}.json`);
  await writeFile(report, JSON.stringify({ base, sceneId, checks, modelInference: false }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ passed: checks, sceneId, report, modelInference: false }, null, 2));
} catch (error) {
  // Never print response bodies, SDK URLs, cookies, or arbitrary provider error text.
  console.error("Upload smoke failed:", error instanceof assert.AssertionError ? error.message : "Unexpected integration error; inspect the failing stage privately.");
  console.log("Passed before failure:", checks);
  process.exitCode = 1;
}
