import { describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/validation/origin";

describe("mutation origin validation", () => {
  it("accepts the actual host when Next normalizes a loopback URL", () => {
    const request = new Request("http://localhost:3000/api/scenes", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } });
    expect(isSameOrigin(request)).toBe(true);
  });
  it("ignores a spoofed forwarded host", () => {
    const request = new Request("https://rescene-eta.vercel.app/api/scenes", { headers: { host: "rescene-eta.vercel.app", origin: "https://attacker.example", "x-forwarded-host": "attacker.example" } });
    expect(isSameOrigin(request)).toBe(false);
  });
  it("rejects absent, malformed, and mismatched-scheme origins", () => {
    for (const origin of [null, "null", "http://rescene-eta.vercel.app", "https://rescene-eta.vercel.app/unexpected-path"]) {
      const headers = new Headers({ host: "rescene-eta.vercel.app" });
      if (origin !== null) headers.set("origin", origin);
      expect(isSameOrigin(new Request("https://rescene-eta.vercel.app/api/scenes", { headers }))).toBe(false);
    }
  });
});
