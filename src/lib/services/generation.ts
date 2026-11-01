import {analysisFailureMessage,classifyAnalysisFailure,type ProviderPhase} from "@/lib/ai/provider-failure";
import {matchMask} from "@/lib/ai/mask-match";
import { objectAppearanceSchema } from "@/lib/scene/appearance";
import { isBackgroundSurface } from "@/lib/scene/surface-role";
import "server-only";
import {rotationControls,rotationAfterEdit} from "@/lib/editor/rotation";
import { randomUUID, createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { productSchema } from "@/lib/validation/products";
import { productThumbnail } from "./product-thumbnail";
import { ownedScene } from "./scenes";
import { bucket, storagePrefix, putObject, signRead, readLimited } from "@/lib/storage/r2";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2 } from "@/lib/storage/r2";
import { analyzePhoto } from "@/lib/ai/analyze";
import { segmentConcept } from "@/lib/ai/segment";
import { analysisOptionsSchema, maskAlternativeSchema, pixelBoxSchema, reconstructionOptionsSchema, segmentationOptionsSchema, segmentationPrompt } from "@/lib/ai/controls";
import { getSam3dClient } from "@/lib/ai/sam3d";
import { downloadFalArtifact, inspectGlb } from "@/lib/ai/glb";
import { composeRoom, compositionSchema, glbBounds, modelPlacementSchema, type CompositionInput } from "@/lib/scene/composition";
import { defaultLighting, lightingSchema } from "@/lib/scene/lighting";
import { record, sceneEnvironment } from "./composition";
import { runInputSchema, objectEditsSchema, maskSelectionSchema } from "@/lib/validation/generation";
import type { z } from "zod";
import type { Prisma, AssetKind } from "@/generated/prisma/client";
import { backgroundPlanSchema } from "@/lib/scene/background";

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const active = ["QUEUED", "RUNNING", "WAITING"] as const;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export async function reserveRun(sceneId: string, ownerId: string, input: z.infer<typeof runInputSchema>) {
  if (process.env.GENERATION_ENABLED !== "true") throw new AppError(503, "GENERATION_DISABLED", "Generation is not enabled yet.");
  const db = getDb();
  await ownedScene(sceneId, ownerId);
  return db.$transaction(async tx => {
    // Serialize generation starts/restarts, including concurrent accounts.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
    const scene = await tx.scene.findFirst({ where: { id: sceneId, ownerId, archivedAt: null } });
    if (!scene) throw new AppError(404, "NOT_FOUND", "Scene not found.");
    const options = { ...(input.background?{background:input.background}:{}), ...(input.quality?{quality:input.quality}:{}), ...(input.backgroundVariant?{backgroundVariant:input.backgroundVariant}:{}), ...(input.repair?{repair:true}:{}), ...(input.analysis ? {analysis:input.analysis} : {}), ...(input.segmentation ? {segmentation:input.segmentation} : {}), ...(input.reconstruction ? {reconstruction:input.reconstruction} : {}), objectIds:input.objectIds ?? [] };
    const requestHash = digest(Buffer.from(JSON.stringify(options)));
    const prior = await tx.generationRun.findUnique({ where: { sceneId_idempotencyKey: { sceneId, idempotencyKey: input.idempotencyKey } } });
    if (prior) {
      if (prior.status === "CANCELED" || prior.inputRevision < Number(record(scene.settings).resetRevision ?? 0)) throw new AppError(409, "RUN_SUPERSEDED", "That attempt belongs to an earlier version of this scene. Start the step again.");
      if (prior.kind !== input.kind || prior.inputRevision !== input.expectedRevision || (record(prior.input).requestHash ? record(prior.input).requestHash !== requestHash : JSON.stringify((prior.input as { objectIds?: string[] }).objectIds ?? []) !== JSON.stringify(input.objectIds ?? []))) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This request key was used for different inputs.");
      return prior;
    }
    if (scene.revision !== input.expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "Reload this scene before starting.");
    if (!scene.normalizedAssetId) throw new AppError(400, "PHOTO_REQUIRED", "Upload a photo first.");
    const userActive = await tx.generationRun.count({ where: { scene: { ownerId }, status: { in: [...active] } } });
    if (userActive) throw new AppError(409, "RUN_ACTIVE", "Your generation is already running. Open it to see progress.");
    const allowed = input.kind === "ANALYZE" ? ["DRAFT"] : input.kind === "SEGMENT_OBJECT" ? ["DRAFT", "REVIEW", "FAILED"] : input.kind === "IMAGE_EDIT" ? ["READY"] : input.repair?["READY"]:["REVIEW"];
    if (!allowed.includes(scene.status)) throw new AppError(409, "SCENE_STATE", "This scene is not ready for that operation.");
    let selectedIds=input.objectIds ?? [],rootIds=selectedIds;
    if (input.kind === "RECONSTRUCT") {
      if(input.repair){const stage=compositionSchema.safeParse(scene.stage);if(!stage.success||stage.data.layoutSource==="manual-stage")throw new AppError(409,"PHOTO_LAYOUT_REQUIRED","Match the photo layout before retrying individual objects.");}
      const frame=await tx.asset.findUniqueOrThrow({where:{id:scene.normalizedAssetId}});
      const available=(await tx.sceneObject.findMany({where:{sceneId,mask:{status:"READY",sceneId,kind:"MASK"},...(input.repair?{}:{modelAssetId:null})}})).filter(o=>!isBackgroundSurface(o,{width:frame.width!,height:frame.height!}));
      if(!selectedIds.length)selectedIds=available.map(o=>o.id);
      const all=await tx.sceneObject.findMany({where:{sceneId}});
      if(input.repair&&all.some(o=>selectedIds.includes(o.id)&&(record(o.provenance).parentObjectId||record(o.provenance).replacementBackup||all.some(c=>record(c.provenance).parentObjectId===o.id))))throw new AppError(409,"SHARED_SUBJECT","Shared subjects and catalog replacements require the full review/rebuild flow. Independent objects can retry here.");
      selectedIds=[...new Set(selectedIds.flatMap(id=>{const o=all.find(o=>o.id===id);const parent=record(o?.provenance).parentObjectId;return typeof parent === "string" ? [parent,id]:[id];}))];
      if(!selectedIds.length||selectedIds.length>10||selectedIds.some(id=>!available.some(o=>o.id===id)))throw new AppError(400,"INVALID_OBJECTS","Each selected item and its complete subject need an accepted outline.");
      rootIds=selectedIds.filter(id=>!record(available.find(o=>o.id===id)!.provenance).parentObjectId);
      if(!rootIds.length)throw new AppError(400,"SUBJECT_REQUIRED","Include complete subjects before reconstructing product parts.");
    }
    if(input.quality){const stage=compositionSchema.safeParse(scene.stage);if(!stage.success||stage.data.layoutSource==="manual-stage")throw new AppError(409,"PHOTO_LAYOUT_REQUIRED","Match the photo layout before the quality pass.");}
    if(input.backgroundVariant){const stage=compositionSchema.safeParse(scene.stage);if(!stage.success)throw new AppError(409,"LAYOUT_UNAVAILABLE","Build your 3D scene before generating a background variant.");}
    if (input.kind === "SEGMENT_OBJECT") {
      if (await tx.sceneObject.count({where:{sceneId,modelAssetId:{not:null}}})) throw new AppError(409,"MODELS_EXIST","Return to object review before changing outlines. This clears later 3D results after confirmation.");
      const image=await tx.asset.findFirstOrThrow({where:{id:scene.normalizedAssetId,sceneId,kind:"NORMALIZED_IMAGE",status:"READY"}});
      try { segmentationPrompt(input.segmentation!, {width:image.width!,height:image.height!}); }
      catch { throw new AppError(400,"INVALID_PROMPT","Keep the box and points inside your photo, and provide a short concept or a location prompt."); }
      if (input.segmentation!.objectId && !await tx.sceneObject.findFirst({where:{sceneId,id:input.segmentation!.objectId}})) throw new AppError(404,"NOT_FOUND","Object not found.");
      if (!input.segmentation!.objectId && await tx.sceneObject.count({where:{sceneId}}) >= 10) throw new AppError(409,"OBJECT_LIMIT","This scene already has ten candidates. Reanalyze to start a new object list.");
    }
    const reserved = input.kind === "ANALYZE" ? 1.42 : input.kind === "SEGMENT_OBJECT" ? 0.0025 : input.quality ? .5 : input.kind === "IMAGE_EDIT" ? .02 : 1;
    // Historical estimates remain auditable; Jim removed the app's cumulative spending cap.
    const run = await tx.generationRun.create({ data: { sceneId, kind: input.kind, idempotencyKey: input.idempotencyKey,
      inputRevision: scene.revision, input: asJson({ ...options, ...(input.kind==="RECONSTRUCT" ? {objectIds:selectedIds,reconstructionObjectIds:rootIds} : {}), requestHash, normalizedAssetId: scene.normalizedAssetId }), reservedCostUsd: reserved,
      expiresAt: new Date(Date.now() + (input.quality?90:input.kind==="IMAGE_EDIT"?30:15) * 60_000), currentStage: "Waiting to start" } });
    if (input.kind === "SEGMENT_OBJECT") {
      let objectId = input.segmentation!.objectId;
      if (!objectId) {
        const last = await tx.sceneObject.aggregate({where:{sceneId},_max:{sourceOrdinal:true}});
        const object = await tx.sceneObject.create({data:{sceneId,originRunId:run.id,sourceOrdinal:(last._max.sourceOrdinal ?? -1)+1,sortOrder:(last._max.sourceOrdinal ?? -1)+1,label:input.segmentation!.label,category:"other",segmentationConcept:input.segmentation!.concept || input.segmentation!.label,provenance:{support:"unknown",source:"user-prompt"}}});
        objectId = object.id;
      }
      await tx.generationRun.update({where:{id:run.id},data:{input:asJson({...record(run.input),segmentObjectId:objectId})}});
    }
    await tx.scene.update({ where: { id: sceneId }, data: { status: input.kind === "IMAGE_EDIT"||input.repair ? "READY" : input.kind === "RECONSTRUCT" ? "RECONSTRUCTING" : "ANALYZING", lastErrorCode: null } });
    return run;
  }, { timeout: 20_000 });
}

export async function claimRun(runId: string, workflowRunId: string) {
  const result = await getDb().generationRun.updateMany({ where: { id: runId, status: "QUEUED", workflowRunId: null },
    data: { status: "RUNNING", workflowRunId, startedAt: new Date(), currentStage: "Starting" } });
  return result.count === 1;
}
async function loadRun(runId: string) {
  const run = await getDb().generationRun.findUniqueOrThrow({ where: { id: runId }, include: { scene: { include: { normalizedAsset: true } } } });
  if (run.status === "CANCELED" || run.scene.archivedAt || run.scene.revision !== run.inputRevision || run.expiresAt < new Date()) throw new Error("RUN_STALE_OR_EXPIRED");
  return run;
}
async function providerInput(asset: { storageKey: string }) { return getSignedUrl(getR2(), new GetObjectCommand({ Bucket: bucket(), Key: asset.storageKey }), { expiresIn: 3600 }); }
// Inline bounded normalized bytes for Meta; avoids intermittent remote media-fetch rejection.
async function metaInput(asset: { storageKey: string }) {
  return `data:image/webp;base64,${(await readLimited(asset.storageKey, 4 * 1024 * 1024)).toString("base64")}`;
}
async function artifact(sceneId: string, runId: string, kind: AssetKind, bytes: Buffer, mimeType: string, size?: { width: number; height: number }) {
  const id = randomUUID();
  const storageKey = `${storagePrefix()}/scenes/${sceneId}/runs/${runId}/${id}`;
  await putObject(storageKey, bytes, mimeType);
  return getDb().asset.create({ data: { id, sceneId, kind, bucket: bucket(), storageKey, mimeType, status: "READY", byteSize: bytes.length,
    sha256: digest(bytes), readyAt: new Date(), ...size, provenance: { runId, source: "meta-generation" } } });
}
async function beginStep(runId: string, key: string, provider: "META" | "FAL", modelId: string) {
  const prior = await getDb().generationStep.findUnique({ where: { runId_key_attempt: { runId, key, attempt: 1 } } });
  if (prior) throw new Error("SUBMISSION_UNCERTAIN");
  return getDb().generationStep.create({ data: { runId, key, provider, modelId, status: "RUNNING", startedAt: new Date() } });
}

export async function analyzeRun(runId: string) {
  const run = await loadRun(runId), image = run.scene.normalizedAsset!,db=getDb();
  await db.generationRun.update({ where: { id: runId }, data: { currentStage: "Identifying objects and products", progress: 10 } });
  const step = await beginStep(runId, "spark", "META", process.env.META_ANALYSIS_MODEL ?? "muse-spark-1.3");
  let phase:ProviderPhase="preparing",responseId:string|undefined;
  try{
    await db.generationStep.update({where:{id:step.id},data:{input:{providerPhase:phase}}});
    const options = analysisOptionsSchema.parse(record(run.input).analysis ?? {});
    const result = await analyzePhoto(await metaInput(image), { width: image.width!, height: image.height! }, options,{
      onRequest:async()=>{await db.generationStep.update({where:{id:step.id},data:{input:{providerPhase:"requesting"}}});phase="requesting";},
      onResponse:async response=>{
        phase="responded";
        await db.generationStep.update({where:{id:step.id},data:{providerRequestId:response.id,input:{providerPhase:phase},inputTokens:response.usage?.prompt_tokens,outputTokens:response.usage?.completion_tokens}});
        const asset=await artifact(run.sceneId,runId,"PROVIDER_RESPONSE",Buffer.from(JSON.stringify(response)),"application/json");responseId=asset.id;
        await db.generationStep.update({where:{id:step.id},data:{responseAssetId:asset.id}});
      }
    });
    const candidates = result.analysis.objects,candidateIds=new Map(candidates.map(o=>[o.candidateId,randomUUID()]));
    await db.$transaction(async tx => {
      const current=await tx.generationRun.findFirst({where:{id:runId,status:{in:["RUNNING","WAITING"]},expiresAt:{gt:new Date()}}});
      if(!current)throw new Error("RUN_STALE_OR_EXPIRED");
      const changed=await tx.scene.updateMany({where:{id:run.sceneId,revision:run.inputRevision,normalizedAssetId:image.id,archivedAt:null},data:{settings:asJson({...record(run.scene.settings),environment:result.analysis.environment,analysisOptions:options,sceneType:result.analysis.sceneType,analysisSummary:result.analysis.summary,backgroundPlan:result.analysis.background,preferredBackdrop:"room"})}});
      if(!changed.count)throw new Error("RUN_STALE_OR_EXPIRED");
      await tx.generationStep.update({ where: { id: step.id }, data: { status: "SUCCEEDED", providerRequestId: result.requestId, responseAssetId: responseId,
        inputTokens: result.usage?.prompt_tokens, outputTokens: result.usage?.completion_tokens,
        costUsd: ((result.usage?.prompt_tokens ?? 0) * 1.25 + (result.usage?.completion_tokens ?? 0) * 4.25) / 1_000_000, completedAt: new Date() } });
      for (const [index, object] of candidates.entries()) await tx.sceneObject.create({ data: { id:candidateIds.get(object.candidateId), sceneId: run.sceneId, originRunId: runId, sourceOrdinal: index,
        label: object.label, category: object.category, segmentationConcept: object.segmentationConcept, imageBounds: object.bbox, sortOrder: index,
        positionX: ((object.bbox.xMin + object.bbox.xMax) / 2 / image.width! - 0.5) * 5,
        provenance: { model: result.model, promptVersion: result.promptVersion, analysisImageBounds:object.bbox, support: object.support, surfaceRole:object.surfaceRole??"object", parentObjectId:object.parentCandidateId ? candidateIds.get(object.parentCandidateId) : null, supportedByObjectId:object.supportedByCandidateId ? candidateIds.get(object.supportedByCandidateId) : null, placement: "approximate-stage" } } });
      await tx.generationRun.update({ where: { id: runId }, data: { currentStage: "Finding object outlines", progress: 25 } });
    });
    return (await db.sceneObject.findMany({ where: { sceneId: run.sceneId, originRunId: runId }, orderBy: { sourceOrdinal: "asc" } })).map(o => o.id);
  }catch(error){
    const failure=classifyAnalysisFailure(error,phase);
    await db.generationStep.updateMany({where:{id:step.id,status:"RUNNING"},data:{...failure,completedAt:new Date()}});
    throw error;
  }
}

export async function segmentRunObject(runId: string, objectId: string) {
  const run = await loadRun(runId);
  const object = await getDb().sceneObject.findFirstOrThrow({ where: { id: objectId, sceneId: run.sceneId, ...(run.kind === "ANALYZE" ? {originRunId:runId} : {}) } });
  const options = run.kind === "SEGMENT_OBJECT" ? segmentationOptionsSchema.parse(record(run.input).segmentation) : undefined;
  const image = run.scene.normalizedAsset!;
  await getDb().generationRun.update({ where: { id: runId }, data: { currentStage: `Outlining ${object.label}`, progress: Math.min(90,30 + object.sourceOrdinal * 6) } });
  const step = await beginStep(runId, `sam-${objectId}`, "META", process.env.META_SEGMENTATION_MODEL ?? "sam-3.1");
  const result = await segmentConcept(await metaInput(image), options?.concept ?? object.segmentationConcept!, { width: image.width!, height: image.height! }, options);
  const raw = await artifact(run.sceneId, runId, "PROVIDER_RESPONSE", Buffer.from(result.raw), "text/plain");
  const alternatives = [];
  for (const mask of result.masks) {
    const stored = await artifact(run.sceneId,runId,"MASK",mask.png,"image/png",{width:image.width!,height:image.height!});
    alternatives.push({assetId:stored.id,confidence:mask.confidence ?? null,bounds:{xMin:mask.bounds.left,yMin:mask.bounds.top,xMax:mask.bounds.right,yMax:mask.bounds.bottom},area:mask.area});
  }
  // Resolve repeated concepts by their source-image location; preserve alternatives
  // for corrections. A paired shoe product is a binary union, not a lost body part.
  const box=pixelBoxSchema.safeParse(object.imageBounds).data;
  const located=result.masks.filter(m=>!box||((m.bounds.left+m.bounds.right)/2>=box.xMin&&(m.bounds.left+m.bounds.right)/2<box.xMax&&(m.bounds.top+m.bounds.bottom)/2>=box.yMin&&(m.bounds.top+m.bounds.bottom)/2<box.yMax));
  const selected=matchMask(result.masks.map(m=>({mask:m,bounds:{xMin:m.bounds.left,yMin:m.bounds.top,xMax:m.bounds.right,yMax:m.bounds.bottom}})),box);
  let accepted=selected?.mask;
  let acceptedAssetId=accepted?alternatives[result.masks.indexOf(accepted)].assetId:undefined;
  if(object.category==="footwear"&&located.length>1&&located.length<=2){
    const {combineMasks}=await import("@/lib/ai/masks");
    const union=await combineMasks(located.map(m=>m.png),{width:image.width!,height:image.height!});
    const stored=await artifact(run.sceneId,runId,"MASK",union.png,"image/png",{width:image.width!,height:image.height!});
    accepted={...located[0],png:union.png,area:union.area,bounds:{left:union.bounds.xMin,top:union.bounds.yMin,right:union.bounds.xMax,bottom:union.bounds.yMax}};
    acceptedAssetId=stored.id;
    alternatives.push({assetId:stored.id,confidence:null,bounds:union.bounds,area:union.area});
  }
  const provenance = asJson({...record(object.provenance), ...(options ? {segmentationOptions:options} : {}), maskAlternatives:alternatives, segmentationModel:result.model});
  if (!accepted||!acceptedAssetId) {
    await getDb().sceneObject.update({ where: { id: objectId }, data: { provenance, ...(options ? {label:options.label,segmentationConcept:options.concept || options.label} : {}), status: object.maskAssetId ? "CONFIRMED" : "FAILED", lastErrorCode: result.masks.length ? "AMBIGUOUS_MASK" : "NO_MATCH" } });
  } else {
    const mask = accepted;
    await getDb().sceneObject.update({ where: { id: objectId }, data: { maskAssetId: acceptedAssetId, confidence: mask.confidence, status:"CONFIRMED",lastErrorCode:null,
      ...(options ? {label:options.label,segmentationConcept:options.concept || options.label} : {}),
      imageBounds: { xMin: mask.bounds.left, yMin: mask.bounds.top, xMax: mask.bounds.right, yMax: mask.bounds.bottom },
      provenance: asJson({ ...record(provenance), requestLocalId: mask.objectId, foregroundArea: mask.area }) } });
  }
  await getDb().generationStep.update({ where: { id: step.id }, data: { status: "SUCCEEDED", providerRequestId: result.requestId, responseAssetId: raw.id, imageCount: 1, costUsd: 0.0025, completedAt: new Date() } });
}

export async function segmentRequestedObject(runId:string) {
  const run=await loadRun(runId);
  return String(record(run.input).segmentObjectId);
}
export async function markOutlineFailure(runId:string, objectId:string) {
  const run=await loadRun(runId);
  const object=await getDb().sceneObject.findFirstOrThrow({where:{id:objectId,sceneId:run.sceneId}});
  await getDb().sceneObject.update({where:{id:objectId},data:{status:object.maskAssetId ? "CONFIRMED" : "FAILED",lastErrorCode:"SEGMENTATION_INTERRUPTED"}});
  await getDb().generationStep.updateMany({where:{runId,key:`sam-${objectId}`,status:"RUNNING"},data:{status:"SUBMISSION_UNCERTAIN",errorCode:"SEGMENTATION_INTERRUPTED",completedAt:new Date()}});
}

export async function finishAnalysis(runId: string) {
  const run = await loadRun(runId);
  const objects = await getDb().sceneObject.findMany({where:{sceneId:run.sceneId},include:{mask:true}});
  const sharp=(await import("sharp")).default;
  const {containedParts}=await import("@/lib/scene/layout-review");
  const maskInputs=await Promise.all(objects.filter(o=>o.maskAssetId&&o.mask).map(async o=>({id:o.id,parentId:typeof record(o.provenance).parentObjectId==="string"?String(record(o.provenance).parentObjectId):null,supportedById:typeof record(o.provenance).supportedByObjectId==="string"?String(record(o.provenance).supportedByObjectId):null,mask:await sharp(await readLimited(o.mask!.storageKey,4*1024*1024)).greyscale().raw().toBuffer()})));
  const contained=containedParts(maskInputs);
  const incomplete=objects.some(o=>o.lastErrorCode);
  const empty=!objects.length;
  await getDb().$transaction(async tx => {
    for(const [id,parentObjectId]of contained){const object=objects.find(o=>o.id===id)!;await tx.sceneObject.update({where:{id},data:{provenance:asJson({...record(object.provenance),parentObjectId,relationshipSource:"mask-containment-v1"})}});}
    await tx.scene.update({ where: { id: run.sceneId, revision: run.inputRevision }, data: { status: "REVIEW", revision: { increment: 1 } } });
    await tx.generationRun.update({ where: { id: runId }, data: { status: incomplete ? "PARTIAL" : "SUCCEEDED", currentStage: empty ? "No objects identified" : "Review object outlines", errorCode:empty ? "NO_OBJECTS" : incomplete ? "OUTLINES_NEED_REVIEW" : null, errorMessage:empty ? "Analysis found no candidates. Adjust the focus and analyze again, or add an object yourself." : null, progress: 100, completedAt: new Date() } });
  });
}

export async function submitReconstruction(runId: string) {
  const pending=await loadRun(runId);
  if(!record(pending.input).repair){const {planSceneEnvironment}=await import("./background-environment");await planSceneEnvironment(runId);}
  const run = await loadRun(runId);
  const ids = (record(run.input).reconstructionObjectIds ?? record(run.input).objectIds) as string[];
  const found = await getDb().sceneObject.findMany({ where: { sceneId: run.sceneId, id: { in: ids } }, include: { mask: true } });
  const objects = ids.map(id => found.find(o => o.id === id)!);
  if (objects.some(o => !o?.mask || o.mask.status !== "READY")) throw new Error("MASK_UNAVAILABLE");
  const options=reconstructionOptionsSchema.parse(record(run.input).reconstruction ?? {});
  // Derive provider-only masks; reviewed masks remain immutable/restorable.
  const sharp=(await import("sharp")).default;
  const {refineOpenings}=await import("@/lib/appearance/plain");
  const raw=await sharp(await readLimited(run.scene.normalizedAsset!.storageKey,4*1024*1024)).removeAlpha().toColourspace("srgb").raw().toBuffer({resolveWithObject:true});
  const image={data:raw.data,width:raw.info.width,height:raw.info.height};
  const providerMasks=[];
  const refinements=[];
  for(const o of objects){
    const mask=await sharp(await readLimited(o.mask!.storageKey,4*1024*1024)).greyscale().raw().toBuffer({resolveWithObject:true});
    if(mask.info.width!==image.width||mask.info.height!==image.height)throw new Error("MASK_SIZE");
    const refined=options.refineOpenings ? refineOpenings(image,mask.data) : {pixels:mask.data,removed:0,openings:0};
    refinements.push({objectId:o.id,originalMaskId:o.mask!.id,removedPixels:refined.removed,openings:refined.openings});
    if(refined.removed){const bytes=await sharp(refined.pixels,{raw:{width:image.width,height:image.height,channels:1}}).png().toBuffer();providerMasks.push(await artifact(run.sceneId,runId,"MASK",bytes,"image/png",{width:image.width,height:image.height}));}
    else providerMasks.push(o.mask!);
  }
  const input = { image_url: await providerInput(run.scene.normalizedAsset!), mask_urls: await Promise.all(providerMasks.map(o => providerInput(o))), export_textured_glb: true, seed: options.seed };
  const step = await beginStep(runId, "sam3d-submit", "FAL", process.env.SAM3D_MODEL ?? "fal-ai/sam-3/3d-objects");
  await getDb().generationStep.update({where:{id:step.id},data:{input:asJson({maskRefinement:"enclosed-openings-v1",enabled:options.refineOpenings,providerMaskIds:providerMasks.map(m=>m.id),refinements})}});
  await getDb().generationRun.update({ where: { id: runId }, data: { currentStage: "Reconstructing 3D objects", progress: 15 } });
  const { client, model } = getSam3dClient();
  const request = await client.queue.submit(model, { input, abortSignal: AbortSignal.timeout(60_000) });
  // Save provider ID immediately. Status/result retries can use this exact job.
  await getDb().generationStep.update({ where: { id: step.id }, data: { providerRequestId: request.request_id, status: "WAITING" } });
  await getDb().generationRun.update({ where: { id: runId }, data: { status: "WAITING", progress: 30 } });
  return request.request_id;
}
export async function pollReconstruction(runId: string, requestId: string) {
  await loadRun(runId);
  const { client, model } = getSam3dClient();
  const response = await client.queue.status(model, { requestId, logs: false, abortSignal: AbortSignal.timeout(30_000) });
  return response.status === "COMPLETED";
}
export async function ingestRun(runId: string, requestId: string, withAppearance=false) {
  const run = await loadRun(runId);
  const allIds = (run.input as {objectIds:string[]}).objectIds;
  const ids = (record(run.input).reconstructionObjectIds ?? allIds) as string[];
  const { client, model } = getSam3dClient();
  const response = await client.queue.result(model, { requestId, abortSignal: AbortSignal.timeout(60_000) });
  const result = response.data as { individual_glbs?: { url: string }[]; model_glb?: { url: string }; metadata?: { object_index: number }[] };
  if(record(run.input).repair){const {ingestRepair}=await import("./reconstruction-repair");await ingestRepair(runId,result);return true;}
  const files = ids.length === 1 ? [result.model_glb!] : result.individual_glbs;
  if (!files || files.length !== ids.length || files.some(f => !f?.url)) throw new Error("INDEPENDENT_MESHES_MISSING");
  await artifact(run.sceneId, runId, "PROVIDER_RESPONSE", Buffer.from(JSON.stringify(result)), "application/json");
  const assets: { id: string }[] = [];
  const layoutInputs: CompositionInput[] = [];
  const layoutBytes:Buffer[]=[];
  const objects = await getDb().sceneObject.findMany({ where: { sceneId: run.sceneId, id: { in: allIds } },include:{mask:true} });
  const derived=new Map<string,{id:string;rootId:string;sourceId:string}>();
  const partitionFailed:string[]=[];
  for (const file of files) {
    const bytes = await downloadFalArtifact(file.url);
    inspectGlb(bytes);layoutBytes.push(bytes);
    const original=await artifact(run.sceneId, runId, "MODEL_GLB", bytes, "model/gltf-binary");
    assets.push(original);
    const index = assets.length - 1;
    const object = objects.find(o => o.id === ids[index])!;
    const children=objects.filter(o=>record(o.provenance).parentObjectId===object.id&&o.mask);
    if(children.length){
      try{
        const sharp=(await import("sharp")).default;
        const {splitAssembly}=await import("@/lib/scene/assembly");
        const parts=await Promise.all(children.map(async o=>{const {data,info}=await sharp(await readLimited(o.mask!.storageKey,4*1024*1024)).removeAlpha().greyscale().raw().toBuffer({resolveWithObject:true});return {id:o.id,mask:{data,width:info.width,height:info.height}};}));
        const environment=await sceneEnvironment(run.scene);
        const split=splitAssembly(bytes,result.metadata?.find(m=>m.object_index===index),{width:run.scene.normalizedAsset!.width!,height:run.scene.normalizedAsset!.height!},object.imageBounds,environment.environment,parts);
        const body=await artifact(run.sceneId,runId,"MODEL_GLB",split.body.bytes,"model/gltf-binary");
        const pending=new Map<string,{id:string;rootId:string;sourceId:string}>();
        pending.set(object.id,{id:body.id,rootId:object.id,sourceId:original.id});
        for(const part of split.parts){const a=await artifact(run.sceneId,runId,"MODEL_GLB",part.bytes,"model/gltf-binary");pending.set(part.id,{id:a.id,rootId:object.id,sourceId:original.id});}
        assets[index]=body;for(const [key,value]of pending)derived.set(key,value);
      }catch{partitionFailed.push(...children.map(o=>o.id));}
    }
    try { layoutInputs.push({ id: object.id, metadata: result.metadata?.find(m => m.object_index === index), bounds: glbBounds(bytes),
      imageBounds: object.imageBounds, support: String(record(object.provenance).support ?? "unknown"),category:object.category,supportedById:typeof record(object.provenance).supportedByObjectId==="string"?String(record(object.provenance).supportedByObjectId):undefined }); } catch { /* Layout is optional; do not discard a usable mesh. */ }
  }
  let layout: ReturnType<typeof composeRoom> | undefined;
  let layoutReview:import("@/lib/scene/layout-review").LayoutReview|undefined;
  try {
    if (layoutInputs.length !== ids.length) throw new Error("LAYOUT_BOUNDS_MISSING");
    const environment = await sceneEnvironment(run.scene);
    layout = composeRoom(layoutInputs, { width: run.scene.normalizedAsset!.width!, height: run.scene.normalizedAsset!.height! }, environment.environment, environment.environmentSource);
    const {seatGeometry}=await import("@/lib/appearance/contact");
    for(const [i,object]of layout.objects.entries())try{seatGeometry(layoutBytes[i],object);}catch{/* Keep validated bounds if vertex refinement is unavailable. */}
    const {reviewPreparedLayout}=await import("./layout-review");
    layoutReview=await reviewPreparedLayout(layout,ids.map(id=>objects.find(o=>o.id===id)!),layoutBytes,{width:run.scene.normalizedAsset!.width!,height:run.scene.normalizedAsset!.height!});
    layout.composition.background=backgroundPlanSchema.safeParse(record(run.scene.settings).backgroundPlan).data;
    layout.composition.backdrop=record(run.scene.settings).preferredBackdrop === "studio" ? "studio" : "room";
  } catch { if(layout)layout.composition.warnings.push("Reference review could not complete. Inspect this layout before publishing."); /* Preserve usable meshes without claiming a review pass. */ }
  await getDb().$transaction(async tx => {
    for (const id of allIds) {
      const object=objects.find(o=>o.id===id)!;
      const rootId=typeof record(object.provenance).parentObjectId === "string" ? String(record(object.provenance).parentObjectId) : id;
      const index=ids.indexOf(rootId);
      if(partitionFailed.includes(id)){await tx.sceneObject.update({where:{id,sceneId:run.sceneId},data:{status:"FAILED",lastErrorCode:"PARTITION_UNAVAILABLE"}});continue;}
      const generated=derived.get(id);
      if(index<0||(!generated&&id!==rootId))throw new Error("ASSEMBLY_MODEL_MISSING");
      const composed = layout?.objects[index];
      await tx.sceneObject.update({ where: { id, sceneId: run.sceneId }, data: {
      modelAssetId: generated?.id ?? assets[index].id, lastErrorCode:null, representation: "MESH", status: "READY", visible: true,
      ...(composed ? { positionX: composed.position[0], positionY: composed.position[1], positionZ: composed.position[2], rotationX: 0, rotationY: 0, rotationZ: 0, rotationW: 1, scaleX: 1, scaleY: 1, scaleZ: 1 } : {positionX:objects.find(o=>o.id===rootId)!.positionX,positionY:0,positionZ:objects.find(o=>o.id===rootId)!.positionZ,rotationX:0,rotationY:0,rotationZ:0,rotationW:1,scaleX:1,scaleY:1,scaleZ:1}),
      initialTransform: composed ? asJson(composed.placement) : { placement: "manual-stage", importer: "gltf-y-up-bottom-center-v1" },
      provenance: asJson({ ...record(object.provenance), ...(generated ? {assemblyRootId:rootId,assemblyBaseAssetId:generated.sourceId,partitionVersion:"projected-parts-v1",layoutImageBounds:objects.find(o=>o.id===rootId)!.imageBounds} : {}), provider: "fal", model, requestId, maskInputIndex: index, metadata: result.metadata?.find(m => m.object_index === index), placement: composed ? "sam3d-layout-v1" : "manual-stage" })
    } }); }
    await tx.scene.update({ where: { id: run.sceneId, revision: run.inputRevision }, data: { status: "READY", revision: { increment: 1 },settings:asJson({...record(run.scene.settings),layoutReview,reconstructionOptions:reconstructionOptionsSchema.parse(record(run.input).reconstruction ?? {})}),
      ...(layout ? { camera: asJson(layout.composition.camera), stage: asJson(layout.composition) } : {}) } });
    await tx.generationStep.updateMany({ where: { runId, key: "sam3d-submit" }, data: { status: "SUCCEEDED", completedAt: new Date() } });
    await tx.generationRun.update({ where: { id: runId }, data: { status: withAppearance ? "WAITING" : partitionFailed.length||layoutReview?.needsReview ? "PARTIAL" : "SUCCEEDED", errorMessage:partitionFailed.length ? "Complete subjects are ready. Some product regions could not be separated reliably; no independent replacement geometry was invented." : layoutReview?.needsReview ? "3D models are ready, with differences still flagged in the placement report. Refine placement first, or retry selected objects with a new paid reconstruction." : null, currentStage: withAppearance ? "Enhancing source detail" : "Your 3D scene is ready", progress: withAppearance ? 90 : 100, completedAt: withAppearance ? null : new Date() } });
  });
}
export async function failRun(runId: string) {
  const db = getDb();
  const run = await db.generationRun.findUnique({ where: { id: runId } });
  if (!run || run.status === "SUCCEEDED" || run.status === "CANCELED") return;
  const steps = await db.generationStep.findMany({ where: { runId } });
  const uncertain = steps.some(s => s.status === "SUBMISSION_UNCERTAIN"||s.status === "RUNNING"&&s.provider!=="INTERNAL"&&!s.providerRequestId&&!["preparing","responded"].includes(String(record(s.input).providerPhase)));
  const analysisFailure=run.kind==="ANALYZE"?steps.find(s=>s.key==="spark"&&s.status==="FAILED"&&s.errorCode):undefined;
  const knownBackground=steps.some(s=>s.key==="environment-depth"&&s.providerRequestId&&s.status!=="SUCCEEDED");
  const knownJob = steps.some(s => s.key === "sam3d-submit" && s.providerRequestId && s.status !== "SUCCEEDED");
  await db.$transaction([
    db.generationStep.updateMany({ where: { runId, status: "RUNNING" }, data: { status: uncertain ? "SUBMISSION_UNCERTAIN" : "FAILED" } }),
    db.generationRun.update({ where: { id: runId }, data: { status: "FAILED", errorCode: uncertain ? "SUBMISSION_UNCERTAIN" : knownBackground?"KNOWN_BACKGROUND_JOB_INTERRUPTED":knownJob ? "KNOWN_JOB_INTERRUPTED" : analysisFailure?.errorCode??"GENERATION_FAILED",
      errorMessage: uncertain ? "The provider response was interrupted. This attempt may have been charged; it will not be submitted again automatically." : knownBackground?"Background depth paused. Resume retrieves the saved job without another paid submission.":knownJob ? "Generation paused. Resume will retrieve the existing job without another submission." : analysisFailure?analysisFailureMessage(analysisFailure.errorCode!):"Generation could not finish. Your photo and completed objects are saved.", completedAt: new Date() } }),
    db.scene.updateMany({ where: { id: run.sceneId, revision: run.inputRevision, ...(run.kind==="IMAGE_EDIT"||record(run.input).repair?{status:{not:"READY" as const}}:{}) }, data: { status: "FAILED", lastErrorCode: "GENERATION_FAILED" } })
  ]);
}
export async function workspace(sceneId: string, ownerId: string) {
  const scene = await ownedScene(sceneId, ownerId);
  const [objects, run] = await Promise.all([
    getDb().sceneObject.findMany({ where: { sceneId }, include: { mask: true, model: true, product: { include: { imageAsset: true } } }, orderBy: { sortOrder: "asc" } }),
    getDb().generationRun.findFirst({ where: { sceneId, inputRevision: { gte: Number(record(scene.settings).resetRevision ?? 0) } }, orderBy: { createdAt: "desc" } })
  ]);
  if (run && active.includes(run.status as typeof active[number]) && run.expiresAt < new Date()) {
    await failRun(run.id);
    return workspace(sceneId, ownerId);
  }
  const visibleObjects=objects.filter(o=>!isBackgroundSurface(o,{width:scene.normalizedAsset?.width??0,height:scene.normalizedAsset?.height??0}));
  const applied = record(record(scene.settings).appearance);
  const background=record(record(scene.settings).background),materialBackground=background.version==="material-background-v2";
  async function textureUrl(id: unknown) {
    if (typeof id !== "string") return null;
    const asset = await getDb().asset.findFirst({ where: { id, sceneId, kind: "SURFACE_TEXTURE", status: "READY" } });
    return asset ? signRead(asset) : null;
  }
  const stage = compositionSchema.safeParse(scene.stage).data ?? null;
  const variantRows = await getDb().sceneBackground.findMany({ where: { sceneId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  const activeVariantId = typeof record(scene.settings).activeBackgroundId === "string" ? String(record(scene.settings).activeBackgroundId) : variantRows[0]?.id ?? null;
  const backgroundVariants = await Promise.all(variantRows.map(async v => ({
    id: v.id, name: v.name, prompt: typeof v.prompt === "string" ? v.prompt : null, textureAssetId: v.textureAssetId,
    previewUrl: await textureUrl(v.textureAssetId), createdAt: v.createdAt.toISOString(), active: v.id === activeVariantId
  })));
  return { id: scene.id, title: scene.title, description: scene.description, status: scene.status, revision: scene.revision,
    appearanceHistory:(await import("./appearance-history")).appearanceHistorySummary(scene.settings),
    backgroundVariants, activeBackgroundVariantId: activeVariantId,
    analysisOptions:analysisOptionsSchema.safeParse(record(scene.settings).analysisOptions).data ?? analysisOptionsSchema.parse({}),
    reconstructionOptions:reconstructionOptionsSchema.safeParse(record(scene.settings).reconstructionOptions).data ?? reconstructionOptionsSchema.parse({}),
    canRestoreBackground:Boolean(record(scene.settings).backgroundBackup),
    backgroundInfo: {method:background.version==="reference-environment-v1"?"reference":materialBackground?"materials":"photo",report:background.version==="reference-environment-v1"?{coverage:Number(record(background.report).coverage??0),walls:Number(record(background.report).walls??0),expectedWalls:Number(record(background.report).expectedWalls??0),openings:Number(record(background.report).openings??0)}:null,explanation: typeof record(record(record(scene.settings).environmentObservation).analysis).explanation==="string"?String(record(record(record(scene.settings).environmentObservation).analysis).explanation):typeof record(record(record(scene.settings).backgroundUnderstanding).analysis).explanation==="string"?String(record(record(record(scene.settings).backgroundUnderstanding).analysis).explanation):null,lightingEffects:(Array.isArray(record(record(record(scene.settings).environmentObservation).analysis).lightingEffects)?record(record(record(scene.settings).environmentObservation).analysis).lightingEffects:Array.isArray(record(record(record(scene.settings).backgroundUnderstanding).analysis).lightingEffects)?record(record(record(scene.settings).backgroundUnderstanding).analysis).lightingEffects:[]) as string[],warnings:Array.isArray(background.warnings)?background.warnings as string[]:[]},
    layoutReview:(await import("@/lib/scene/layout-review")).layoutReviewSchema.safeParse(record(scene.settings).layoutReview).data??null,
    quality:(await import("./quality")).qualitySummary(scene.settings,new Map(objects.map(o=>[o.id,o.label]))),
    analysisSummary:typeof record(scene.settings).analysisSummary === "string" ? String(record(scene.settings).analysisSummary) : null,
    lighting: lightingSchema.safeParse(record(scene.settings).lighting).data ?? defaultLighting(stage),
    appearance: { applied: applied.version === "photo-bake-v1", floorUrl: await textureUrl(materialBackground?background.floorId:applied.floorId), wallUrl: await textureUrl(materialBackground?background.wallId:applied.wallId), backgroundUrl: await textureUrl(record(record(scene.settings).background).assetId) },
    composition: compositionSchema.safeParse(scene.stage).data ?? null, canRestoreLayout: Boolean(record(scene.settings).layoutBackup),
    image: scene.normalizedAsset ? { url: await signRead(scene.normalizedAsset), width: scene.normalizedAsset.width!, height: scene.normalizedAsset.height! } : null,
    generationEnabled: process.env.GENERATION_ENABLED === "true", objects: await Promise.all(visibleObjects.map(async o => ({
      tint: objectAppearanceSchema.safeParse(o.appearance).data?.tint ?? null, id: o.id, label: o.label, status: o.status, errorCode: o.lastErrorCode, canRestoreOriginal: Boolean(record(o.provenance).replacementBackup),
      parentObjectId:typeof record(o.provenance).parentObjectId === "string" ? String(record(o.provenance).parentObjectId) : null, assemblyRootId:typeof record(o.provenance).assemblyRootId === "string" ? String(record(o.provenance).assemblyRootId) : null,
      concept:o.segmentationConcept ?? o.label, confidence:o.confidence, bounds:pixelBoxSchema.safeParse(o.imageBounds).data ?? null,
      segmentation:segmentationOptionsSchema.safeParse(record(o.provenance).segmentationOptions).data ?? null,
      maskAlternatives:await Promise.all((Array.isArray(record(o.provenance).maskAlternatives) ? record(o.provenance).maskAlternatives as unknown[] : []).slice(0,10).flatMap(v=>{const parsed=maskAlternativeSchema.safeParse(v);return parsed.success ? [parsed.data] : [];}).map(async variant=>{
        const asset=await getDb().asset.findFirst({where:{id:variant.assetId,sceneId,kind:"MASK",status:"READY"}});
        return asset ? {...variant,url:await signRead(asset),selected:asset.id===o.maskAssetId} : null;
      })).then(values=>values.filter(v=>v!==null)),
      product: o.product && o.product.sceneId === sceneId ? { name: o.product.name, description: o.product.description ?? "", brand: o.product.brand ?? "", price: o.product.price?.toString() ?? null, currency: productSchema.shape.currency.parse(o.product.currency ?? "USD"), productUrl: o.product.productUrl ?? "", imageUrl: o.product.imageAsset?.status === "READY" && o.product.imageAsset.sceneId === sceneId ? await signRead(o.product.imageAsset) : null } : null,
      maskUrl: o.mask ? await signRead(o.mask) : null, modelUrl: o.model ? await signRead(o.model) : null,
      placement: modelPlacementSchema.safeParse(o.initialTransform).data ?? null,
      positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ, ...rotationControls(o), scale: o.scaleX, visible: o.visible
    }))), run: run ? { id: run.id, kind: run.kind, status: run.status, stage: run.currentStage, progress: run.progress,
      errorCode: run.errorCode, errorMessage: run.errorMessage, canResume: run.status === "QUEUED" || (run.status === "FAILED" && ["KNOWN_JOB_INTERRUPTED","KNOWN_BACKGROUND_JOB_INTERRUPTED"].includes(run.errorCode??"")) } : null };
}
export async function selectMask(sceneId:string,ownerId:string,input:z.infer<typeof maskSelectionSchema>) {
  const scene=await ownedScene(sceneId,ownerId);
  const db=getDb();
  const object=await db.sceneObject.findFirst({where:{id:input.objectId,sceneId,modelAssetId:null}});
  if(!object)throw new AppError(404,"NOT_FOUND","Object not found.");
  if(scene.revision!==input.expectedRevision||!["READY","REVIEW","FAILED"].includes(scene.status))throw new AppError(409,"REVISION_CONFLICT","Reload or return to object review before changing outlines.");
  const ids=input.maskAssetIds ?? [input.maskAssetId!];
  const rawVariants=Array.isArray(record(object.provenance).maskAlternatives) ? record(object.provenance).maskAlternatives as unknown[] : [];
  const variants=rawVariants.flatMap(v=>{const parsed=maskAlternativeSchema.safeParse(v);return parsed.success?[parsed.data]:[];});
  const assets=await db.asset.findMany({where:{id:{in:ids},sceneId,kind:"MASK",status:"READY"}});
  if(assets.length!==ids.length||ids.some(id=>!variants.some(v=>v.assetId===id)))throw new AppError(400,"INVALID_MASK","Choose only this object's saved outline options.");
  let chosen=variants.find(v=>v.assetId===ids[0])!;
  if(ids.length>1){
    const {combineMasks}=await import("@/lib/ai/masks");
    const merged=await combineMasks(await Promise.all(assets.map(a=>readLimited(a.storageKey,4*1024*1024))),{width:scene.normalizedAsset!.width!,height:scene.normalizedAsset!.height!});
    const id=randomUUID(),key=`${storagePrefix()}/scenes/${sceneId}/masks/${id}`;
    await putObject(key,merged.png,"image/png");
    await db.asset.create({data:{id,sceneId,kind:"MASK",status:"READY",bucket:bucket(),storageKey:key,mimeType:"image/png",byteSize:merged.png.length,sha256:digest(merged.png),width:scene.normalizedAsset!.width!,height:scene.normalizedAsset!.height!,readyAt:new Date(),provenance:{source:"user-combined-mask",maskIds:ids}}});
    chosen={assetId:id,confidence:null,bounds:merged.bounds,area:merged.area};
  }
  return db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
    const current=await tx.scene.findFirst({where:{id:sceneId,ownerId,archivedAt:null,revision:input.expectedRevision,status:{in:["READY","REVIEW","FAILED"]}}});
    if(!current)throw new AppError(409,"REVISION_CONFLICT","The scene changed. Reload before choosing an outline.");
    if(await tx.generationRun.count({where:{sceneId,status:{in:[...active]}}}))throw new AppError(409,"RUN_ACTIVE","Wait for the active generation to finish.");
    const changed=await tx.scene.updateMany({where:{id:sceneId,ownerId,revision:input.expectedRevision,archivedAt:null},data:{revision:{increment:1},status:scene.status==="READY"?"READY":"REVIEW"}});
    if(!changed.count)throw new AppError(409,"REVISION_CONFLICT","The scene changed. Reload before choosing an outline.");
    await tx.sceneObject.update({where:{id:object.id,sceneId},data:{maskAssetId:chosen.assetId,confidence:chosen.confidence,imageBounds:chosen.bounds,status:"CONFIRMED",lastErrorCode:null,provenance:asJson({...record(object.provenance),foregroundArea:chosen.area,maskAlternatives:ids.length>1?[...variants.filter(v=>v.assetId!==chosen.assetId).slice(-9),chosen]:variants})}});
  });
}

export async function saveObjects(sceneId: string, ownerId: string, input: z.infer<typeof objectEditsSchema>) {
  const scene = await ownedScene(sceneId, ownerId);
  const thumbnails = new Map<string, string>();
  const colliders=await getDb().sceneObject.findMany({where:{sceneId,status:"READY",modelAssetId:{not:null}},include:{model:true}});
  const proposed=colliders.map(o=>{const e=input.objects.find(e=>e.id===o.id);if(!e)return o;const q=rotationAfterEdit(o,e);return {...o,positionX:e.positionX,positionY:e.positionY,positionZ:e.positionZ,rotationX:q.x,rotationY:q.y,rotationZ:q.z,rotationW:q.w,scaleX:e.scale,scaleY:e.scale,scaleZ:e.scale,visible:e.visible};});
  if(proposed.some((o,i)=>o!==colliders[i])){const {guardCollisions}=await import("./collision-guard");await guardCollisions(colliders,proposed);}

  // Only new product cards need a cutout. Validate every object before any storage work.
  const originals = await getDb().sceneObject.findMany({ where: { sceneId, status: "READY", id: { in: input.objects.map(o => o.id) } } });
  if (originals.length !== input.objects.length) throw new AppError(400, "INVALID_OBJECT", "The selected object is unavailable.");
  if (scene.status !== "READY" || scene.revision !== input.expectedRevision) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before saving.");
  for(const edit of input.objects){
    const original=originals.find(o=>o.id===edit.id)!;
    if(record(original.provenance).assemblyRootId!==original.id)continue;
    const nextRotation=rotationAfterEdit(original,edit);
    const transformed=edit.positionX!==original.positionX||edit.positionY!==original.positionY||edit.positionZ!==original.positionZ||edit.scale!==original.scaleX||edit.visible!==original.visible||1-Math.abs(nextRotation.x*original.rotationX+nextRotation.y*original.rotationY+nextRotation.z*original.rotationZ+nextRotation.w*original.rotationW)>1e-8;
    if(transformed){const members=await getDb().sceneObject.findMany({where:{sceneId,provenance:{path:["assemblyRootId"],equals:original.id}},select:{id:true}});if(members.some(m=>!input.objects.some(o=>o.id===m.id)))throw new AppError(409,"ASSEMBLY_EDIT_REQUIRED","Include every product region when moving its complete subject.");}
  }
  for (const edit of input.objects) {
    const original = originals.find(o => o.id === edit.id)!;
    if (edit.product && !original.productId) {
      const demo = record(original.provenance).replacementBackup ? await getDb().product.findFirst({ where: { sceneId, modelAssetId: original.modelAssetId, attributes: { path: ["catalogVersion"], equals: "demo-v1" } } }) : null;
      const id = demo?.imageAssetId ?? (record(original.provenance).replacementBackup ? null : await productThumbnail(sceneId, original.id));
      if (id) thumbnails.set(edit.id, id);
    }
  }
  await getDb().$transaction(async tx => {
    const count = await tx.scene.updateMany({ where: { id: sceneId, ownerId, revision: input.expectedRevision, status: "READY", archivedAt: null }, data: { revision: { increment: 1 }, ...(input.lighting ? { settings: asJson({ ...record(scene.settings), lighting: input.lighting }) } : {}) } });
    if (count.count !== 1) throw new AppError(409, "REVISION_CONFLICT", "The scene changed. Reload before saving.");
    for (const edit of input.objects) {
      const original = originals.find(o => o.id === edit.id)!;
      let productId = original.productId;
      if (edit.product === null) productId = null;
      else if (edit.product) {
        const fields = { ...edit.product, price: edit.product.price, currency: edit.product.price === null ? null : edit.product.currency, productUrl: edit.product.productUrl || null };
        if (productId) {
          const updated = await tx.product.updateMany({ where: { id: productId, sceneId }, data: fields });
          if (updated.count !== 1) throw new AppError(400, "INVALID_PRODUCT", "The product is unavailable.");
        } else {
          const product = await tx.product.create({ data: { ...fields, sceneId, imageAssetId: thumbnails.get(edit.id) ?? null } });
          productId = product.id;
        }
      }
      const rotation=rotationAfterEdit(original,edit);
      const changed = await tx.sceneObject.updateMany({ where: { id: edit.id, sceneId, status: "READY" }, data: {
        ...(edit.tint !== undefined ? {appearance: asJson({tint:edit.tint})} : {}), productId, label: edit.label, positionX: edit.positionX, positionY: edit.positionY, positionZ: edit.positionZ,
        rotationX: rotation.x, rotationY: rotation.y, rotationZ: rotation.z, rotationW: rotation.w,
        scaleX: edit.scale, scaleY: edit.scale, scaleZ: edit.scale, visible: edit.visible
      } });
      if (changed.count !== 1) throw new AppError(400, "INVALID_OBJECT", "The selected object is unavailable.");
    }
  });
}

export async function improveGeneratedAppearance(runId:string){
  const run=await getDb().generationRun.findUnique({where:{id:runId},include:{scene:true}});
  if(!run||run.status!=="WAITING"||run.currentStage!=="Enhancing source detail")return;
  try{
    // First pass, not a later repair: settle every object on its support, then
    // bake the photo onto that corrected pose. No inference; the previous
    // photo copy remains the fallback if the coordinated pass cannot run.
    if(run.scene.status==="READY"&&run.scene.revision===run.inputRevision+1&&!run.scene.archivedAt){
      try{const {improveSceneQuality}=await import("./quality");await improveSceneQuality(run.sceneId,run.scene.ownerId,run.scene.revision,{runId});}
      catch{const {updateAppearance}=await import("./appearance");await updateAppearance(run.sceneId,run.scene.ownerId,{action:"APPLY",expectedRevision:run.scene.revision});}
    }
  }catch{/* Optional source transfer must not discard successful reconstruction or retry inference. */}
  finally{await getDb().generationRun.updateMany({where:{id:runId,status:"WAITING",currentStage:"Enhancing source detail"},data:{currentStage:"Preparing photo background",progress:92}});}
}
