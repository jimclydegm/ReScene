export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    // Next's internal request URL can use localhost even when the browser uses
    // 127.0.0.1. Host is the browser's actual request destination; compare it
    // exactly and never trust a caller-supplied X-Forwarded-Host here.
    return parsed.origin === origin && parsed.host === host.toLowerCase()
      && parsed.protocol === new URL(request.url).protocol;
  } catch { return false; }
}
