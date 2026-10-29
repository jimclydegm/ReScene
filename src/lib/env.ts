import "server-only";

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export function uploadLimit(): number {
  const configured = Number(process.env.MAX_UPLOAD_BYTES ?? 12 * 1024 * 1024);
  return Number.isSafeInteger(configured) && configured > 0
    ? Math.min(configured, 12 * 1024 * 1024)
    : 12 * 1024 * 1024;
}
