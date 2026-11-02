import { assertJudgeRequest } from "@/lib/judge/config";
import {
  verifyLocalUrl,
  localRead,
  localPut,
  localHead,
} from "@/lib/judge/files";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    assertJudgeRequest(request);
    const key = verifyLocalUrl(new URL(request.url), "GET"),
      h = await localHead(key),
      bytes = await localRead(key, 80 * 1024 * 1024);
    return new Response(bytes, {
      headers: {
        "Content-Type": h.ContentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 404 });
  }
}
export async function PUT(request: Request) {
  try {
    assertJudgeRequest(request);
    const key = verifyLocalUrl(new URL(request.url), "PUT");
    if (!key.startsWith("judge/staging/")) throw new Error("Staging only");
    const limit = 12 * 1024 * 1024;
    if (Number(request.headers.get("content-length")) > limit)
      return new Response("Too large", { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Empty upload");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        return new Response("Too large", { status: 413 });
      }
      chunks.push(value);
    }
    await localPut(
      key,
      Buffer.concat(chunks),
      request.headers.get("content-type") ?? "application/octet-stream",
    );
    return new Response(null, { status: 200 });
  } catch {
    return new Response("Unavailable", { status: 404 });
  }
}
