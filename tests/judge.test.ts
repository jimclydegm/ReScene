import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { judgeMode, assertJudgeRequest } from "../src/lib/judge/config";
import { localPath, localUrl, verifyLocalUrl } from "../src/lib/judge/files";
afterEach(() => vi.unstubAllEnvs());
const local = () => {
  vi.stubEnv("RESCENE_JUDGE_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
  vi.stubEnv("DATABASE_URL", "postgresql://local@127.0.0.1:55432/rescene");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "a".repeat(64));
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
};
describe("Isolated local reviewer mode", () => {
  it("is off by default and rejects cloud deployment or remote database", () => {
    vi.stubEnv("RESCENE_JUDGE_MODE", "");
    expect(judgeMode()).toBeNull();
    local();
    expect(judgeMode()).toBe("live");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => judgeMode()).toThrow(/development/);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL", "1");
    expect(() => judgeMode()).toThrow(/Vercel/);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://remote.example/db");
    expect(() => judgeMode()).toThrow(/local database/);
  });
  it("rejects remote hosts and path traversal", () => {
    local();
    expect(() =>
      assertJudgeRequest(new Request("http://evil.example")),
    ).toThrow();
    expect(() =>
      assertJudgeRequest(
        new Request("http://127.0.0.1:3000", {
          headers: { host: "evil.example" },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertJudgeRequest(
        new Request("http://127.0.0.1:3000", {
          headers: { host: "[2001:db8::1]:3000" },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertJudgeRequest(
        new Request("http://[::1]:3000", { headers: { host: "[::1]:3000" } }),
      ),
    ).not.toThrow();
    for (const p of [
      "../secret",
      "judge/../secret",
      "/etc/passwd",
      "judge\\file",
    ])
      expect(() => localPath(p)).toThrow();
  });
  it("signs method-scoped expiring file links and rejects tampering", () => {
    local();
    const u = new URL(localUrl("judge/staging/file", "PUT"));
    expect(verifyLocalUrl(u, "PUT")).toBe("judge/staging/file");
    expect(() => verifyLocalUrl(u, "GET")).toThrow();
    const expired = new URL(u);
    expired.searchParams.set("expires", String(Date.now() - 1));
    expect(() => verifyLocalUrl(expired, "PUT")).toThrow();
    u.searchParams.set("key", "judge/staging/other");
    expect(() => verifyLocalUrl(u, "PUT")).toThrow();
  });
});
