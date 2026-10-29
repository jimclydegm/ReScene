// Explicit integration check. Creates two isolated example.com QA accounts/scenes.
// No model inference. Credentials are saved only to an OS-temporary file for UI QA.
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const checks: string[] = [];
const stamp = randomUUID().slice(0, 8);
type Account = { email: string; password: string; cookies: Map<string, string> };

async function request(path: string, account?: Account, method = "GET", body?: unknown, origin = base) {
  const response = await fetch(base + path, {
    method, redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: origin,
      ...(account ? { Cookie: [...account.cookies].map(([key, value]) => `${key}=${value}`).join("; ") } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const index = pair.indexOf("=");
    if (account && index > 0) {
      if (pair.slice(index + 1)) account.cookies.set(pair.slice(0, index), pair.slice(index + 1));
      else account.cookies.delete(pair.slice(0, index));
    }
  }
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function register(label: string): Promise<Account> {
  const account: Account = { email: `rescene-qa-${stamp}-${label}@example.com`, password: randomUUID() + "aA1!", cookies: new Map() };
  const result = await request("/api/auth/sign-up/email", account, "POST", { name: "ReScene QA", email: account.email, password: account.password });
  assert.equal(result.response.status, 200, `QA sign-up failed (HTTP ${result.response.status})`);
  assert(account.cookies.size, "Sign-up did not establish a session");
  return account;
}

try {
  assert.equal((await request("/api/health")).response.status, 200); checks.push("Health endpoint");
  assert.equal((await request("/api/scenes")).response.status, 401); checks.push("Anonymous private API denied");
  const owner = await register("owner"); checks.push("Managed sign-up/session");
  const created = await request("/api/scenes", owner, "POST", { title: "Foundation QA — private test scene" });
  assert.equal(created.response.status, 201, `Create scene failed (HTTP ${created.response.status})`);
  const id = created.data.scene.id;
  assert.equal((await request(`/api/scenes/${id}`, owner)).response.status, 200); checks.push("Owner scene create/read");
  assert.equal((await request(`/api/scenes/${id}`, owner, "PATCH", { expectedRevision: 0, title: "QA saved scene" })).response.status, 200);
  assert.equal((await request(`/api/scenes/${id}`, owner, "PATCH", { expectedRevision: 0, title: "Stale overwrite" })).response.status, 409); checks.push("Stale save rejected");
  assert.equal((await request(`/api/scenes/${id}`, owner, "PATCH", { expectedRevision: 1, title: "Cross-origin" }, "https://untrusted.example")).response.status, 403); checks.push("Cross-origin mutation denied");
  const other = await register("other");
  assert.equal((await request(`/api/scenes/${id}`, other)).response.status, 404);
  assert.equal((await request(`/api/scenes/${id}`, other, "PATCH", { expectedRevision: 1, title: "Not owned" })).response.status, 404);
  assert.equal((await request(`/api/scenes/${id}/uploads`, other, "POST", { expectedRevision: 1, contentType: "image/png", byteSize: 100 })).response.status, 404); checks.push("Second-account read/edit/sign denied");
  const reloaded = await request(`/api/scenes/${id}`, owner);
  assert.equal(reloaded.data.scene.title, "QA saved scene"); checks.push("Saved draft persists");
  const path = join(tmpdir(), `rescene-qa-${stamp}.json`);
  await writeFile(path, JSON.stringify({ base, sceneId: id, owner: { email: owner.email, password: owner.password }, other: { email: other.email, password: other.password } }), { mode: 0o600 });
  const signedOut = await request("/api/auth/sign-out", other, "POST", {});
  assert.equal(signedOut.response.status, 200);
  assert.equal((await request("/api/scenes", other)).response.status, 401); checks.push("Sign-out ends browser session");
  console.log(JSON.stringify({ passed: checks, qaCredentialFile: path, modelInference: false }, null, 2));
} catch (error) {
  console.error("Foundation smoke check failed:", error instanceof Error ? error.message : "Unknown error");
  console.log("Passed before failure:", checks);
  process.exitCode = 1;
}
