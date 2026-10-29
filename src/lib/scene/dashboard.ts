// Dashboard progress describes saved workflow stages, not reconstruction accuracy.
export const SCENES_PER_PAGE = 6;
export function dashboardPage(raw: string | string[] | undefined, total: number) {
  const pages = Math.max(1, Math.ceil(total / SCENES_PER_PAGE));
  const value = typeof raw === "string" && /^\d{1,6}$/.test(raw) ? Number(raw) : 1;
  const page = Math.min(pages, Math.max(1, value));
  return { page, pages, skip: (page - 1) * SCENES_PER_PAGE };
}
export function dashboardProgress(scene: {
  status: string; normalizedAssetId: string | null; hasMasks: boolean;
  run: { status: string; currentStage: string | null; progress: number } | null;
}) {
  const running = ["ANALYZING", "RECONSTRUCTING"].includes(scene.status);
  const activeRun = running && scene.run && ["QUEUED", "RUNNING", "WAITING"].includes(scene.run.status) ? scene.run : null;
  const completed = scene.status === "READY" ? 3 : (scene.hasMasks && scene.status !== "ANALYZING") ? 2 : scene.normalizedAssetId ? 1 : 0;
  const label = scene.status === "READY" ? "Ready to edit" : scene.status === "FAILED" ? "Needs attention" : scene.status === "REVIEW" ? "Review objects" : scene.status === "ANALYZING" ? "Finding objects" : scene.status === "RECONSTRUCTING" ? "Building 3D" : scene.normalizedAssetId ? "Photo ready" : "New draft";
  const next = scene.status === "READY" ? "Edit your scene" : scene.status === "FAILED" ? "Open scene to continue" : activeRun?.currentStage ?? (running ? "Generation in progress" : scene.status === "REVIEW" ? "Choose objects to build" : scene.normalizedAssetId ? "Next: find objects" : "Next: upload a photo");
  return { completed, label, next, running, attention: scene.status === "FAILED", runProgress: activeRun ? Math.max(0, Math.min(100, activeRun.progress)) : null };
}
export function dashboardQuery(query:{q?:string|string[];view?:string|string[];filter?:string|string[]}){
 const q=typeof query.q==="string"?query.q.trim().slice(0,100):"";
 const archived=query.view==="archived";
 const filter=!archived&&typeof query.filter==="string"&&["READY","GENERATING","FAILED","PUBLISHED"].includes(query.filter)?query.filter:"ALL";
 return {q,archived,filter};
}
