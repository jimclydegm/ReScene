import "server-only";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { isSameOrigin } from "@/lib/validation/origin";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function checkOrigin(request: Request): void {
  if (!isSameOrigin(request)) {
    throw new AppError(403, "INVALID_ORIGIN", "This request must come from ReScene.");
  }
}

export async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 128 * 1024) {
    throw new AppError(413, "BODY_TOO_LARGE", "This request is too large.");
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > 128 * 1024) {
    throw new AppError(413, "BODY_TOO_LARGE", "This request is too large.");
  }
  try { return JSON.parse(text); }
  catch { throw new AppError(400, "INVALID_JSON", "Send a valid JSON request."); }
}

export async function api(action: () => Promise<Response>): Promise<Response> {
  const requestId = randomUUID();
  try {
    const response = await action();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) {
    const known = error instanceof AppError;
    const invalid = error instanceof ZodError;
    const status = known ? error.status : invalid ? 400 : 500;
    const code = known ? error.code : invalid ? "INVALID_INPUT" : "INTERNAL_ERROR";
    const message = known ? error.message : invalid
      ? (error.issues[0]?.message ?? "Check the submitted values.")
      : "Something went wrong. Please try again.";
    if (!known && !invalid) {
      console.error("ReScene request failed", { requestId, errorType: error instanceof Error ? error.name : "UnknownError" });
    }
    return Response.json({ error: { code, message, retryable: status >= 500 }, requestId }, {
      status, headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId }
    });
  }
}
