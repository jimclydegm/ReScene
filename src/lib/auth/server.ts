import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { requiredEnv } from "@/lib/env";

let instance: ReturnType<typeof createNeonAuth> | undefined;

export function getAuth() {
  instance ??= createNeonAuth({
    baseUrl: requiredEnv("NEON_AUTH_BASE_URL"),
    cookies: { secret: requiredEnv("NEON_AUTH_COOKIE_SECRET") }
  });
  return instance;
}
