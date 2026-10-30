import { api, AppError } from "@/lib/http";
import { readLimited, storagePrefix } from "@/lib/storage/r2";
import frozen from "@/lib/demo/frozen-scenes.json";
export const dynamic = "force-dynamic";
export const GET = async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const response = await api(async () => {
    const { id } = await context.params;
    // Explicit frozen catalog only. No database join, arbitrary key, URL or source ID.
    const asset = frozen.scenes
      .flatMap((s) => s.objects)
      .find((o) => o.id === id);
    if (!asset)
      throw new AppError(404, "NOT_FOUND", "Demo product unavailable.");
    const bytes = await readLimited(
      `${storagePrefix()}/demo/store-v1/${asset.digest}.glb`,
      4 * 1024 * 1024,
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(bytes.length),
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
