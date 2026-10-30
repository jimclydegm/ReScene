import { isBackgroundSurface } from "@/lib/scene/surface-role";
import "server-only";
import {Quaternion,Vector3} from "three";
import sharp from "sharp";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { readLimited } from "@/lib/storage/r2";
import { ownedScene } from "./scenes";
import { inspectGlb } from "@/lib/ai/glb";
import { composeRoom, environmentSchema, glbBounds, modelPlacementSchema, type CompositionInput, type Environment } from "@/lib/scene/composition";

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const compositionInputSchema = z.object({ expectedRevision: z.number().int().nonnegative(), action: z.enum(["MATCH_PHOTO", "REVIEW_PHOTO", "RESTORE", "BACKGROUND"]),backdrop:z.enum(["room","studio","none"]).optional() }).strict().refine(v=>v.action!=="BACKGROUND"||v.backdrop!==undefined,"Choose a backdrop.");
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export async function sceneEnvironment(scene: { settings: unknown; normalizedAsset: { storageKey: string } | null }) {
  const saved = environmentSchema.safeParse(record(scene.settings).environment);
  if (saved.success) return { environment: saved.data, environmentSource: "spark" as const };
  if (!scene.normalizedAsset) throw new Error("PHOTO_REQUIRED");
  // Existing scenes predate room analysis. Sample only broad upper/lower photo regions;
  // this is a color fallback, not an unbilled AI analysis or an inferred texture.
  const { data, info } = await sharp(await readLimited(scene.normalizedAsset.storageKey, 12 * 1024 * 1024))
    .resize(32, 32, { fit: "fill" }).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  function color(top: number, bottom: number) {
    const channels = [0, 1, 2].map(channel => {
      const values: number[] = [];
      for (let y = top; y < bottom; y++) for (let x = 3; x < 29; x++) values.push(data[(y * 32 + x) * info.channels + channel]);
      values.sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)].toString(16).padStart(2, "0");
    });
    return `#${channels.join("")}`;
  }
  const environment: Environment = { floorColor: color(27, 32), wallColor: color(0, 7),
    floorMaterial: "plain", lightDirection: "diffuse", lightWarmth: "neutral", sideWall: "none" };
  return { environment, environmentSource: "photo-colors" as const };
}
export async function matchPhotoLayout(sceneId: string, ownerId: string, input: z.infer<typeof compositionInputSchema>) {
  const scene = await ownedScene(sceneId, ownerId);
  if(await getDb().generationRun.count({where:{sceneId,status:{in:["QUEUED","RUNNING","WAITING"]}}}))throw new AppError(409,"RUN_ACTIVE","Wait for generation to finish before changing the layout.");
  if(!scene.normalizedAsset)throw new AppError(422,"PHOTO_REQUIRED","The reference photo is unavailable.");
  if (scene.status !== "READY") throw new AppError(409, "SCENE_STATE", "Build your 3D objects first.");
  if (scene.revision !== input.expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before matching the photo.");
  if(input.action==="BACKGROUND"){
    const {compositionSchema}=await import("@/lib/scene/composition");
    const composition=compositionSchema.safeParse(scene.stage);
    if(!composition.success)throw new AppError(422,"LAYOUT_UNAVAILABLE","Match the photo layout before choosing a backdrop.");
    const saved=await getDb().scene.updateMany({where:{id:sceneId,ownerId,archivedAt:null,revision:input.expectedRevision,status:"READY"},data:{stage:asJson({...composition.data,backdrop:input.backdrop}),revision:{increment:1}}});
    if(!saved.count)throw new AppError(409,"REVISION_CONFLICT","The scene changed. Reload before saving.");
    return;
  }
  const objects = (await getDb().sceneObject.findMany({ where: { sceneId, status: "READY", modelAssetId: { not: null } }, include: { model: true, mask: true }, orderBy: { sortOrder: "asc" } })).filter(o=>!isBackgroundSurface(o,{width:scene.normalizedAsset?.width??0,height:scene.normalizedAsset?.height??0}));
  if ((await getDb().sceneObject.findMany({ where: { sceneId }, select: { provenance: true } })).some(o => record(o.provenance).replacementBackup)) throw new AppError(409, "REPLACEMENTS_ACTIVE", "Restore original objects before matching the photo layout.");
  if (input.action === "RESTORE") {
    const backup = backupSchema.safeParse(record(scene.settings).layoutBackup);
    if (!backup.success || backup.data.objects.length !== objects.length || backup.data.objects.some(o => !objects.some(current => current.id === o.id))) {
      throw new AppError(409, "LAYOUT_BACKUP_UNAVAILABLE", "The previous layout is unavailable.");
    }
    await getDb().$transaction(async tx => {
      const result = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, status: "READY", archivedAt: null }, data: {
        camera: asJson(backup.data.camera), stage: asJson(backup.data.stage), settings: asJson({ ...record(scene.settings), layoutBackup: null, ...(backup.data.appearance!==undefined?{appearance:backup.data.appearance}:{}), ...(backup.data.layoutReview!==undefined?{layoutReview:backup.data.layoutReview}:{}) }), revision: { increment: 1 }
      } });
      if (result.count !== 1) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before restoring.");
      for (const object of backup.data.objects) {
        const { id, initialTransform, provenance, modelAssetId, ...fields } = object;
        await tx.sceneObject.update({ where: { id, sceneId }, data: { ...fields, initialTransform: asJson(initialTransform), ...(modelAssetId?{modelAssetId}:{}), ...(provenance!==undefined?{provenance:asJson(provenance)}:{}) } });
      }
    });
    return;
  }
  const previousObjects=structuredClone(objects);
  const {prepareContainedAssemblies}=await import("./contained-assemblies");
  const savedEnvironment=await sceneEnvironment(scene);
  const prepared=await prepareContainedAssemblies(sceneId,objects,{width:scene.normalizedAsset!.width!,height:scene.normalizedAsset!.height!},savedEnvironment.environment,record(scene.settings).appearance);
  let result: ReturnType<typeof composeRoom>;
  let layoutReview:unknown;
  try {
    const inputs: CompositionInput[] = [];
    const meshBytes:Buffer[]=[];
    for (const object of objects.filter(o=>!record(o.provenance).parentObjectId)) {
      if (!object.model || object.model.sceneId !== sceneId || object.model.status !== "READY") throw new Error("MODEL_UNAVAILABLE");
      const baseId=record(object.provenance).assemblyBaseAssetId;
      const base=typeof baseId==="string"?await getDb().asset.findFirst({where:{id:baseId,sceneId,status:"READY",kind:"MODEL_GLB"}}):null;
      const bytes = await readLimited(base?.storageKey??object.model!.storageKey, 40 * 1024 * 1024);
      inspectGlb(bytes);meshBytes.push(bytes);
      const provenance = record(object.provenance);
      inputs.push({ id: object.id, metadata: provenance.metadata, bounds: glbBounds(bytes), imageBounds: provenance.layoutImageBounds ?? object.imageBounds,
        category:object.category,supportedById:typeof provenance.supportedByObjectId==="string"?provenance.supportedByObjectId:undefined,
        support: typeof provenance.support === "string" ? provenance.support : ["bed", "seating", "table", "storage"].includes(object.category ?? "") ? "floor" : "unknown" });
    }
    const roots=objects.filter(o=>!record(o.provenance).parentObjectId);
    const environment = await sceneEnvironment(scene);
    if(input.action!=="REVIEW_PHOTO")result = composeRoom(inputs, { width: scene.normalizedAsset!.width!, height: scene.normalizedAsset!.height! }, environment.environment, environment.environmentSource);
    else {
      const stage=(await import("@/lib/scene/composition")).compositionSchema.parse(scene.stage);
      result={composition:stage,objects:roots.map(o=>({id:o.id,position:[o.positionX,o.positionY,o.positionZ] as [number,number,number],placement:modelPlacementSchema.parse(o.initialTransform)}))};
    }
    if(input.action==="REVIEW_PHOTO")for(const entry of result.objects){const original=roots.find(o=>o.id===entry.id)!,p=entry.placement,q=new Quaternion(original.rotationX,original.rotationY,original.rotationZ,original.rotationW);p.rotation=q.clone().multiply(new Quaternion(...p.rotation)).toArray();p.offset=new Vector3(...p.offset).multiplyScalar(original.scaleX).applyQuaternion(q).toArray();p.scale=p.scale.map(v=>v*original.scaleX) as [number,number,number];p.size=p.size.map(v=>v*original.scaleX) as [number,number,number];}
    const {seatGeometry}=await import("@/lib/appearance/contact");
    for(const [i,object]of result.objects.entries())try{seatGeometry(meshBytes[i],object);}catch{/* Keep conservative bounds if mesh refinement is unsupported. */}
    const {reviewPreparedLayout}=await import("./layout-review");
    layoutReview=await reviewPreparedLayout(result,roots,meshBytes,{width:scene.normalizedAsset!.width!,height:scene.normalizedAsset!.height!});
    const {compositionSchema}=await import("@/lib/scene/composition");
    result.composition.backdrop=compositionSchema.safeParse(scene.stage).data?.backdrop ?? (record(scene.settings).preferredBackdrop === "studio" ? "studio" : "room");
    const {backgroundPlanSchema}=await import("@/lib/scene/background");
    result.composition.background=backgroundPlanSchema.safeParse(record(scene.settings).backgroundPlan).data;
  } catch {
    throw new AppError(422, "LAYOUT_UNAVAILABLE", "The saved reconstruction has no reliable room layout. Your current layout is unchanged.");
  }
  const backup = { camera: scene.camera, stage: scene.stage, appearance:record(scene.settings).appearance??null,layoutReview:record(scene.settings).layoutReview??null,objects: previousObjects.map(o => ({ id: o.id, modelAssetId:o.modelAssetId,provenance:o.provenance,initialTransform: o.initialTransform,
    positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ, rotationX: o.rotationX, rotationY: o.rotationY, rotationZ: o.rotationZ, rotationW: o.rotationW,
    scaleX: o.scaleX, scaleY: o.scaleY, scaleZ: o.scaleZ })) };
  await getDb().$transaction(async tx => {
    const changed = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, status: "READY", archivedAt: null }, data: {
      camera: asJson(result.composition.camera), stage: asJson(result.composition), settings: asJson({ ...record(scene.settings), layoutBackup: backup, layoutReview, appearance:prepared.appearance }), revision: { increment: 1 }
    } });
    if (changed.count !== 1) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before matching the photo.");
    for(const [id,change]of prepared.changes)await tx.sceneObject.update({where:{id,sceneId},data:{modelAssetId:change.modelAssetId,provenance:asJson(change.provenance)}});
    const placements=objects.map(object=>{const root=record(object.provenance).parentObjectId ?? object.id;const composed=result.objects.find(o=>o.id===root);if(!composed)throw new AppError(422,"ASSEMBLY_LAYOUT","The complete subject layout is unavailable.");return {...composed,id:object.id};});
    for (const o of placements) await tx.sceneObject.update({ where: { id: o.id, sceneId }, data: {
      positionX: o.position[0], positionY: o.position[1], positionZ: o.position[2],
      rotationX: 0, rotationY: 0, rotationZ: 0, rotationW: 1, scaleX: 1, scaleY: 1, scaleZ: 1, initialTransform: asJson(o.placement)
    } });
  });
}
const backupSchema = z.object({ appearance:z.unknown().optional(),layoutReview:z.unknown().optional(),camera: z.unknown(), stage: z.unknown(), objects: z.array(z.object({
  id: z.uuid(),modelAssetId:z.uuid().nullable().optional(),provenance:z.unknown().optional(),initialTransform: z.unknown(), positionX: z.number().finite(), positionY: z.number().finite(), positionZ: z.number().finite(),
  rotationX: z.number().finite(), rotationY: z.number().finite(), rotationZ: z.number().finite(), rotationW: z.number().finite(),
  scaleX: z.number().positive(), scaleY: z.number().positive(), scaleZ: z.number().positive()
})).max(10) });
