export function judgeMode(): "samples" | "live" | null {
  const mode = process.env.RESCENE_JUDGE_MODE;
  if (mode !== "samples" && mode !== "live") return null;
  if (process.env.NODE_ENV === "production")
    throw new Error("Judge mode runs with the local development server only.");
  if (process.env.VERCEL || process.env.VERCEL_ENV)
    throw new Error("Local judge mode cannot run on Vercel.");
  const url = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000",
  );
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Judge mode requires a loopback app URL.");
  if (mode === "live") {
    const db = new URL(
      process.env.DATABASE_URL ?? "postgresql://localhost/rescene",
    );
    if (!["localhost", "127.0.0.1", "[::1]"].includes(db.hostname))
      throw new Error("Judge mode requires a local database.");
  }
  return mode;
}
export function assertJudgeRequest(request: Request) {
  if (
    !judgeMode() ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
  )
    throw new Error("Local request required.");
  const host = request.headers.get("host");
  if (host && !/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(host))
    throw new Error("Local request required.");
}
