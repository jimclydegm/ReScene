import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, stat, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { judgeMode } from "./config";
export function localPath(key: string) {
  if (
    !judgeMode() ||
    !key ||
    key.includes("..") ||
    key.includes("\\") ||
    key.startsWith("/") ||
    !/^[-\w/.]+$/.test(key)
  )
    throw new Error("Invalid local asset key.");
  return resolve(process.cwd(), ".judge", "objects", key);
}
function signature(key: string, method: string, expires: number) {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Local session secret missing.");
  return createHmac("sha256", secret)
    .update(`${method}\n${expires}\n${key}`)
    .digest("hex");
}
export function localUrl(key: string, method = "GET") {
  localPath(key);
  const expires = Date.now() + 15 * 60000;
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/judge/files?${new URLSearchParams({ key, method, expires: String(expires), sig: signature(key, method, expires) })}`;
}
export function verifyLocalUrl(url: URL, method: string) {
  const key = url.searchParams.get("key") ?? "",
    expires = Number(url.searchParams.get("expires")),
    sig = url.searchParams.get("sig") ?? "";
  if (
    !Number.isSafeInteger(expires) ||
    expires < Date.now() ||
    expires > Date.now() + 16 * 60000 ||
    url.searchParams.get("method") !== method ||
    !/^[a-f0-9]{64}$/.test(sig)
  )
    throw new Error("Local asset link expired.");
  if (
    !timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(signature(key, method, expires), "hex"),
    )
  )
    throw new Error("Invalid local asset signature.");
  localPath(key);
  return key;
}
export async function localRead(key: string, limit: number) {
  const path = localPath(key),
    s = await stat(path);
  if (s.size > limit) throw new Error("Local file exceeds limit.");
  const b = await readFile(path);
  if (b.length > limit) throw new Error("Local file exceeds limit.");
  return b;
}
export async function localPut(key: string, bytes: Buffer, mime: string) {
  const path = localPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { mode: 0o600 });
  await writeFile(`${path}.mime`, mime, { mode: 0o600 });
}
export async function localHead(key: string) {
  const s = await stat(localPath(key));
  return {
    ContentLength: s.size,
    ContentType: await readFile(`${localPath(key)}.mime`, "utf8"),
  };
}
export async function localRemove(key: string) {
  await unlink(localPath(key)).catch(() => {});
  await unlink(`${localPath(key)}.mime`).catch(() => {});
}
