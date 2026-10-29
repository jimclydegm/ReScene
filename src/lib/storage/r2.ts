import "server-only";
import {
  S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requiredEnv } from "@/lib/env";
import { AppError } from "@/lib/http";

let client: S3Client | undefined;

export function getR2(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY")
    },
    requestChecksumCalculation: "WHEN_REQUIRED"
  });
  return client;
}

export function bucket(): string { return requiredEnv("R2_BUCKET"); }
export function storagePrefix(): string {
  const value = process.env.R2_PREFIX ?? "development";
  if (!/^[a-z0-9-]+$/i.test(value)) throw new Error("Invalid storage environment prefix.");
  return value;
}

export async function signUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(getR2(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn: 300 });
}

export async function signRead(asset: { bucket: string; storageKey: string; status: string }): Promise<string> {
  if (asset.status !== "READY" || asset.bucket !== bucket() || !asset.storageKey.startsWith(`${storagePrefix()}/`)) {
    throw new AppError(404, "ASSET_UNAVAILABLE", "This image is unavailable.");
  }
  return getSignedUrl(getR2(), new GetObjectCommand({ Bucket: asset.bucket, Key: asset.storageKey }), { expiresIn: 900 });
}

export async function headObject(key: string) {
  return getR2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function readLimited(key: string, limit: number): Promise<Buffer> {
  const result = await getR2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!result.Body) throw new AppError(400, "EMPTY_UPLOAD", "The uploaded file is empty.");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    bytes += chunk.byteLength;
    if (bytes > limit) throw new AppError(413, "IMAGE_TOO_LARGE", "Choose an image smaller than 12 MB.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function putObject(key: string, bytes: Buffer, contentType: string) {
  await getR2().send(new PutObjectCommand({
    Bucket: bucket(), Key: key, Body: bytes, ContentType: contentType,
    CacheControl: "private, max-age=900"
  }));
}

export async function removeStagingObject(key: string) {
  if (!key.startsWith(`${storagePrefix()}/staging/`)) throw new Error("Only staging objects can be removed here.");
  await getR2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
