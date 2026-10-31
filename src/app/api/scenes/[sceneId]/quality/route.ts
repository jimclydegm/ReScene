import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { inspectionQuery, improveSceneQuality, qualityInput, qualityInspection, restoreSceneQuality } from "@/lib/services/quality";
export const maxDuration = 300;
// Owner-private diagnostic render (wireframe, normals, unlit, neutral, or the
// reference-camera composite). Never cached or shared.
export const GET = (request: Request, context: { params: Promise<{ sceneId: string }> }) => api(async () => {
  const user = await requireUser();
  const query = inspectionQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  const png = await qualityInspection((await context.params).sceneId, user.id, query);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
});
// Free deterministic pass over saved meshes, or restore. No inference.
export const POST = (request: Request, context: { params: Promise<{ sceneId: string }> }) => api(async () => {
  checkOrigin(request);
  const user = await requireUser(), sceneId = (await context.params).sceneId, input = qualityInput.parse(await readJson(request));
  if (input.action === "RESTORE") return Response.json(await restoreSceneQuality(sceneId, user.id, input.expectedRevision));
  const state = await improveSceneQuality(sceneId, user.id, input.expectedRevision);
  return Response.json({ saved: true, objects: state.objects.map(o => ({ id: o.objectId, verdict: o.review.verdict, changed: o.changed })) });
});
