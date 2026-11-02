import "server-only";
import { Matrix4, Quaternion, Vector3 } from "three";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { readLimited } from "@/lib/storage/r2";
import { compositionSchema, glbBounds } from "@/lib/scene/composition";
import { flattenTransform } from "@/lib/scene/manifest";
import { backgroundSupportLift, fitBackgroundClearance, backgroundPenetration, levelBackgroundSupports } from "@/lib/scene/environment-clearance";
import { readMesh } from "@/lib/quality/mesh";
import { isBackgroundSurface } from "@/lib/scene/surface-role";
import { captureAppearance, recordAppearance } from "./appearance-history";
import { record } from "./composition";
import { ownedScene } from "./scenes";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
/** No inference. Final full-vertex check after the background exists. The
 * models, material maps, products and horizontal placements stay unchanged. */
export async function repairBackgroundClearance(sceneId: string, ownerId: string, revision: number, coalesce = false, runId?: string) {
  const db = getDb(), scene = await ownedScene(sceneId,ownerId);
  if (scene.revision !== revision || scene.status !== "READY") throw new AppError(409,"REVISION_CONFLICT","Reload the saved scene before checking background clearance.");
  let composition = compositionSchema.parse(scene.stage);
  const rows = (await db.sceneObject.findMany({where:{sceneId,status:"READY",visible:true,modelAssetId:{not:null}},include:{model:true}})).filter(o=>!isBackgroundSurface(o,{width:scene.normalizedAsset?.width??0,height:scene.normalizedAsset?.height??0}));
  const points = new Map<string, Vector3[]>();
  for (const o of rows) {
    if (!o.model || o.model.sceneId !== sceneId || o.model.status !== "READY") throw new Error("ENVIRONMENT_MODEL_UNAVAILABLE");
    const bytes = await readLimited(o.model.storageKey,40*1024*1024), t = flattenTransform(o,glbBounds(bytes)),
      matrix = new Matrix4().compose(new Vector3(...t.position),new Quaternion(...t.rotation),new Vector3(...t.scale)), doc = readMesh(bytes,matrix);
    points.set(o.id,doc.primitives.flatMap(p => Array.from({length:p.positions.length/3},(_,i) => new Vector3().fromArray(p.positions,i*3))));
  }
  const parent = (id: string) => {
    const p = record(rows.find(o => o.id === id)!.provenance);
    const candidate = p.parentObjectId ?? p.supportedByObjectId;
    return typeof candidate === "string" && rows.some(o => o.id === candidate) ? candidate : null;
  };
  const root = (id: string) => { const seen = new Set<string>(); let current = id; while (parent(current) && !seen.has(current)) {seen.add(current);current=parent(current)!;} return current; };
  const lifts = new Map<string,number>();
  const leveled=levelBackgroundSupports(composition,rows.map(o=>({id:o.id,points:points.get(o.id)!,support:String(record(o.provenance).support??"unknown")})));
  composition=leveled.composition;
  for (const o of rows.filter(o => root(o.id) === o.id)) {
    const members = rows.filter(r => root(r.id) === o.id), all = members.flatMap(r => points.get(r.id)!),
      lift = backgroundSupportLift(all,composition,String(record(o.provenance).support??"unknown"));
    if (lift > 0) for (const member of members) {lifts.set(member.id,lift); for (const p of points.get(member.id)!) p.y+=lift;}
  }
  const fitted = fitBackgroundClearance(composition,rows.map(o => ({id:o.id,points:points.get(o.id)!}))),
    next = compositionSchema.parse(fitted.composition),
    remaining = rows.flatMap(o => backgroundPenetration(points.get(o.id)!,next).filter(p => p.depth>.001).map(p => ({id:o.id,role:p.role,depth:p.depth})));
  if (remaining.length) throw new Error("ENVIRONMENT_CLEARANCE_UNRESOLVED");
  const report = {version:"background-clearance-v1",wallsAdjusted:fitted.changes,supportsLeveled:leveled.changes,objectsSeated:[...lifts].map(([id,distance])=>({id,distance})),remaining:0};
  if (!lifts.size && !fitted.changes.length && !leveled.changes.length) return {changed:false,report};
  await db.$transaction(async tx => {
    const before = await captureAppearance(tx,sceneId);
    if (runId && !(await tx.generationRun.findFirst({where:{id:runId,sceneId,status:{in:["RUNNING","WAITING"]},expiresAt:{gt:new Date()}}}))) throw new Error("BACKGROUND_RUN_STALE");
    if (!runId && await tx.generationRun.count({where:{sceneId,status:{in:["QUEUED","RUNNING","WAITING"]}}})) throw new AppError(409,"RUN_ACTIVE","Wait for generation to finish before repairing the background.");
    const changed = await tx.scene.updateMany({where:{id:sceneId,ownerId,revision,status:"READY",archivedAt:null},data:{stage:json(next),settings:json({...record(scene.settings),backgroundPlan:next.background,background:{...record(record(scene.settings).background),clearance:report}}),revision:{increment:1}}});
    if (!changed.count) throw new AppError(409,"REVISION_CONFLICT","The scene changed during the background check. Reload before continuing.");
    for (const [id,lift] of lifts) await tx.sceneObject.update({where:{id,sceneId},data:{positionY:{increment:lift}}});
    await recordAppearance(tx,sceneId,before,"Clear background overlaps",coalesce);
  },{timeout:30000});
  return {changed:true,report};
}
