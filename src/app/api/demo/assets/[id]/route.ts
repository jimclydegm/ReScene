import { api, AppError } from "@/lib/http";
import { readLimited, storagePrefix, getR2, bucket } from "@/lib/storage/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import models from "@/lib/demo/catalog-models.json";
export const dynamic = "force-dynamic";
export const GET = async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const response = await api(async () => {
    const { id } = await context.params;
    // Explicit frozen catalog only. No database join, arbitrary key, URL or source ID.
    const asset = models.find((o) => o.id === id);
    if (!asset)
      throw new AppError(404, "NOT_FOUND", "Demo product unavailable.");
    const key = `${storagePrefix()}/demo/store-v1/${asset.digest}.glb`;
    let body: BodyInit;
    let contentLength: string | undefined;
    if (asset.bytes > 4 * 1024 * 1024) {
      if (asset.bytes > 16 * 1024 * 1024)
        throw new AppError(
          413,
          "MODEL_TOO_LARGE",
          "This model exceeds the showroom delivery limit.",
        );
      const result = await getR2().send(
        new GetObjectCommand({ Bucket: bucket(), Key: key }),
      );
      if (!result.Body || result.ContentLength !== asset.bytes)
        throw new AppError(
          404,
          "MODEL_UNAVAILABLE",
          "The approved model is unavailable.",
        );
      // A real stream avoids Vercel's buffered-response limit; never expose a private URL.
      let count = 0;
      body = result.Body.transformToWebStream().pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            count += chunk.byteLength;
            if (count > asset.bytes) throw new Error("MODEL_LENGTH_MISMATCH");
            controller.enqueue(chunk);
          },
          flush() {
            if (count !== asset.bytes) throw new Error("MODEL_LENGTH_MISMATCH");
          },
        }),
      );
    } else {
      const bytes = await readLimited(key, 4 * 1024 * 1024);
      body = new Uint8Array(bytes);
      contentLength = String(bytes.length);
    }
    return new Response(body, {
      headers: {
        "Content-Type": "model/gltf-binary",
        ...(contentLength ? { "Content-Length": contentLength } : {}),
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex",
      },
    });
  });
  // The general API helper disables caching for private workspaces. These frozen,
  // deliberately public copies use a versioned URL and can safely use the CDN.
  if (response.ok)
    response.headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400",
    );
  return response;
};
