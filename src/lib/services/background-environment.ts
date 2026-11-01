import {captureAppearance,recordAppearance} from "./appearance-history";
import "server-only";
import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  readLimited,
  putObject,
  bucket,
  storagePrefix,
} from "@/lib/storage/r2";
import { getSam3dClient } from "@/lib/ai/sam3d";
import { downloadFalArtifact } from "@/lib/ai/glb";
import {
  analyzeEnvironment,
  reviewEnvironment,
} from "@/lib/ai/environment";
import { environmentObservationSchema } from "@/lib/scene/environment-plan";
import { decodeEnvironmentDepth } from "@/lib/appearance/environment-depth";
import { buildEnvironmentGeometry } from "@/lib/scene/environment-geometry";
import { record } from "./composition";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const model = "fal-ai/vggt-1b";
export async function environmentContext(runId: string) {
  const run = await getDb().generationRun.findUniqueOrThrow({
      where: { id: runId },
      include: { scene: { include: { normalizedAsset: true } } },
    }),
    s = run.scene;
  if (
    !["RUNNING", "WAITING"].includes(run.status) ||
    s.archivedAt ||
    !s.normalizedAsset ||
    s.normalizedAssetId !== record(run.input).normalizedAssetId ||
    run.expiresAt < new Date() ||
    (run.kind === "IMAGE_EDIT" && s.revision !== run.inputRevision)
  )
    throw new Error("BACKGROUND_RUN_STALE");
  return { run, scene: s, photo: s.normalizedAsset };
}
export async function planSceneEnvironment(runId: string) {
  const { scene, photo } = await environmentContext(runId),
    db = getDb(),
    settings = record(scene.settings),
    cache = record(settings.environmentObservation),
    saved = environmentObservationSchema.safeParse(cache.analysis);
  const reanalyze=record(record((await getDb().generationRun.findUniqueOrThrow({where:{id:runId}})).input).background).reanalyze===true;
  if (!reanalyze && saved.success && cache.photoId === photo.id) return saved.data;
  const prior = await db.generationStep.findUnique({
    where: {
      runId_key_attempt: { runId, key: "environment-analysis", attempt: 1 },
    },
  });
  if (prior) {
    const parsed = environmentObservationSchema.safeParse(prior.output);
    if (prior.status === "SUCCEEDED" && parsed.success) return parsed.data;
    throw new Error("ENVIRONMENT_ANALYSIS_ALREADY_ATTEMPTED");
  }
  await db.generationRun.update({
    where: { id: runId },
    data: { currentStage: "Planning connected background surfaces" },
  });
  const step = await db.generationStep.create({
    data: {
      runId,
      key: "environment-analysis",
      attempt: 1,
      provider: "META",
      modelId: process.env.META_ANALYSIS_MODEL ?? "muse-spark-1.3",
      status: "RUNNING",
      startedAt: new Date(),
    },
  });
  const result = await analyzeEnvironment(
    await readLimited(photo.storageKey, 4 * 1024 * 1024),
  );
  // Save charged output before touching live state. A later revision conflict
  // does not erase provider results or cause another paid submission.
  await db.generationStep.update({
    where: { id: step.id },
    data: {
      status: "SUCCEEDED",
      providerRequestId: result.requestId,
      output: json(result.analysis),
      inputTokens: result.usage?.prompt_tokens,
      outputTokens: result.usage?.completion_tokens,
      completedAt: new Date(),
    },
  });
  await environmentContext(runId);
  const changed = await db.scene.updateMany({
    where: {
      id: scene.id,
      revision: scene.revision,
      normalizedAssetId: photo.id,
      archivedAt: null,
    },
    data: {
      settings: json({
        ...settings,
        environmentObservation: {
          version: "environment-observation-v1",
          photoId: photo.id,
          analysis: result.analysis,
        },
      }),
    },
  });
  if (!changed.count) throw new Error("BACKGROUND_REVISION_CHANGED");
  return result.analysis;
}
export async function depthStep(runId: string) {
  const { scene, photo } = await environmentContext(runId);
  return getDb().generationStep.findFirst({
    where: {
      key: "environment-depth",
      status: "SUCCEEDED",
      responseAssetId: { not: null },
      run: {
        sceneId: scene.id,
        input: { path: ["normalizedAssetId"], equals: photo.id },
      },
      response: {
        sceneId: scene.id,
        kind: "PROVIDER_RESPONSE",
        status: "READY",
      },
    },
    include: { response: true },
    orderBy: { createdAt: "desc" },
  });
}
export async function prepareEnvironmentDepth(
  runId: string,
): Promise<string | null> {
  const { run, photo } = await environmentContext(runId),
    mode = record(record(run.input).background).mode;
  if (mode === "materials" || mode === "photo") return null;
  const plan = await planSceneEnvironment(runId);
  if (
    plan.topology === "distant"
  )
    return null;
  if (await depthStep(runId)) return null;
  const db = getDb(),
    prior = await db.generationStep.findUnique({
      where: {
        runId_key_attempt: { runId, key: "environment-depth", attempt: 1 },
      },
    });
  if (prior) {
    if (
      prior.providerRequestId &&
      ["WAITING", "RUNNING"].includes(prior.status)
    )
      return prior.providerRequestId;
    throw new Error("ENVIRONMENT_DEPTH_ALREADY_ATTEMPTED");
  }
  const savedJob = await db.generationStep.findFirst({
    where: {
      key: "environment-depth",
      modelId: model,
      status: { in: ["RUNNING", "WAITING"] },
      providerRequestId: { not: null },
      run: {
        sceneId: run.sceneId,
        input: { path: ["normalizedAssetId"], equals: photo.id },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const step = await db.generationStep.create({
    data: {
      runId,
      key: "environment-depth",
      attempt: 1,
      provider: "FAL",
      modelId: model,
      status: savedJob ? "WAITING" : "RUNNING",
      ...(savedJob ? { providerRequestId: savedJob.providerRequestId } : {}),
      startedAt: new Date(),
      input: {
        photoId: photo.id,
        sceneRevision: (await environmentContext(runId)).scene.revision,
        ...(savedJob ? { reusedFromStepId: savedJob.id } : {}),
      },
    },
  });
  if (savedJob?.providerRequestId) return savedJob.providerRequestId;
  const { client } = getSam3dClient(),
    bytes = await readLimited(photo.storageKey, 4 * 1024 * 1024);
  const job = await client.queue.submit(model, {
    input: {
      image_urls: [`data:image/webp;base64,${bytes.toString("base64")}`],
      export_prediction_data: true,
      export_depth_maps: false,
      export_point_cloud: false,
      array_encoding: "base64",
    },
    abortSignal: AbortSignal.timeout(60_000),
  });
  await db.generationStep.update({
    where: { id: step.id },
    data: { status: "WAITING", providerRequestId: job.request_id },
  });
  await db.generationRun.update({
    where: { id: runId },
    data: { currentStage: "Estimating shared background depth", progress: 94 },
  });
  return job.request_id;
}
export async function saveEnvironmentAsset(
  runId: string,
  kind: "PROVIDER_RESPONSE" | "SURFACE_TEXTURE",
  bytes: Buffer,
  mimeType: string,
  part: string,
) {
  const context =
    kind === "PROVIDER_RESPONSE"
      ? await getDb().generationRun.findUniqueOrThrow({
          where: { id: runId },
          include: { scene: true },
        })
      : null;
  const active = context ? null : await environmentContext(runId),
    scene = context?.scene ?? active!.scene,
    photoId = context
      ? String(record(context.input).normalizedAssetId)
      : active!.photo.id;
  if (
    !(await getDb().asset.findFirst({
      where: { id: photoId, sceneId: scene.id, kind: "NORMALIZED_IMAGE" },
    }))
  )
    throw new Error("ENVIRONMENT_PHOTO_INVALID");
  const id = randomUUID(),
    key = `${storagePrefix()}/scenes/${scene.id}/environment/${id}`;
  await putObject(key, bytes, mimeType);
  await getDb().asset.create({
    data: {
      id,
      sceneId: scene.id,
      kind,
      status: "READY",
      bucket: bucket(),
      storageKey: key,
      mimeType,
      byteSize: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      readyAt: new Date(),
      derivedFromId: photoId,
      provenance: { source: "reference-environment-v1", runId, part, photoId },
    },
  });
  return id;
}
export async function pollEnvironmentDepth(runId: string, requestId: string,key="environment-depth") {
  await environmentContext(runId);
  const db = getDb(),
    step = await db.generationStep.findUniqueOrThrow({
      where: {
        runId_key_attempt: { runId, key, attempt: 1 },
      },
    });
  if (step.providerRequestId !== requestId)
    throw new Error("ENVIRONMENT_JOB_MISMATCH");
  if (step.status === "SUCCEEDED") return true;
  const { client } = getSam3dClient(),
    state = await client.queue.status(model, { requestId, logs: false });
  if (state.status !== "COMPLETED") return false;
  let result;
  try {
    result = await client.queue.result(model, { requestId });
  } catch (error) {
    const status = Number(record(error).status);
    if (status >= 400 && status < 500 && status !== 429)
      await db.generationStep.update({
        where: { id: step.id },
        data: {
          status: "FAILED",
          errorCode: "ENVIRONMENT_DEPTH_REJECTED",
          completedAt: new Date(),
        },
      });
    throw error;
  }
  const data = result.data as { prediction_data?: { url: string }[] };
  if (data.prediction_data?.length !== 1)
    throw new Error("ENVIRONMENT_PREDICTION_MISSING");
  const raw = JSON.parse(
      (await downloadFalArtifact(data.prediction_data[0].url)).toString(),
    ),
    grid = decodeEnvironmentDepth(raw);
  // Exclude the provider's full embedded input image and redundant predictions.
  const bytes = Buffer.from(
    JSON.stringify({
      depth: raw.depth,
      depth_conf: raw.depth_conf,
      intrinsic: raw.intrinsic,
      original_image: raw.original_image,
    }),
  );
  const id = await saveEnvironmentAsset(
    runId,
    "PROVIDER_RESPONSE",
    bytes,
    "application/json",
    key,
  );
  await db.generationStep.update({
    where: { id: step.id },
    data: {
      status: "SUCCEEDED",
      responseAssetId: id,
      output: { width: grid.width, height: grid.height },
      completedAt: new Date(),
    },
  });
  return true;
}
export async function draftReferenceEnvironment(runId: string) {
  const {referenceGeometryContext,buildSurfaceAtlas}=await import("./environment-surfaces");
  const c=await referenceGeometryContext(runId),{scene,photo,plan,composition,built}=c,db=getDb();
  await db.generationStep.upsert({where:{runId_key_attempt:{runId,key:"environment-geometry",attempt:1}},create:{runId,key:"environment-geometry",attempt:1,provider:"INTERNAL",status:"SUCCEEDED",output:json(built.report),completedAt:new Date()},update:{output:json(built.report)}});
  const atlas=await buildSurfaceAtlas(runId,c);
  let check=await db.generationStep.findUnique({where:{runId_key_attempt:{runId,key:"environment-check",attempt:1}}});
  if(!check){
    const started=await db.generationStep.create({data:{runId,key:"environment-check",attempt:1,provider:"META",modelId:process.env.META_ANALYSIS_MODEL??"muse-spark-1.3",status:"RUNNING",startedAt:new Date()}});
    const review=await reviewEnvironment(c.source,c.plate,plan);
    check=await db.generationStep.update({where:{id:started.id},data:{status:"SUCCEEDED",output:json(review),completedAt:new Date()}});
  }
  if(check.status!=="SUCCEEDED")throw new Error("ENVIRONMENT_CHECK_ALREADY_ATTEMPTED");
  const review=record(check.output);if(review.empty!==true)throw new Error("ENVIRONMENT_FOREGROUND_REMAINS");
  if(review.structureMatches!==true)built.report.warnings.push("Image review flagged remaining architectural differences; inspect the reference comparison.");
  // The raw plate is architectural/depth evidence; its wall/floor illumination
  // is not rendered after independent material maps replace those pixels.
  // Keep the receipt for inspection, but report only applicable output defects.
  if(review.structureMatches!==true&&Array.isArray(review.issues))built.report.warnings.push(...review.issues.filter((i):i is string=>typeof i==="string"));
  const assetId=await saveEnvironmentAsset(runId,"SURFACE_TEXTURE",atlas.bytes,"image/webp","surface-atlas"),settings=record((await environmentContext(runId)).scene.settings);
  return {
    sceneId:scene.id,revision:scene.revision,photoId:photo.id,
    stage:{...composition,background:{kind:plan.topology==="room"?"planes" as const:"seamless" as const,groundVisible:plan.surfaces.some(s=>s.role==="floor"||s.role==="surface"),boundary:null,description:plan.explanation,surfaceMode:"reference" as const,geometry:atlas.geometry}},
    settings:{...settings,environmentObservation:{version:"environment-observation-v1",photoId:photo.id,analysis:plan},backgroundPlan:undefined,backgroundBackup:{background:settings.background??null,backgroundPlan:composition.background??null},background:{version:"reference-environment-v1",materialMethod:"muse-per-surface-atlas-v3",observation:plan,assetId,photoId:photo.id,warnings:built.report.warnings,report:built.report,atlas:{width:atlas.width,height:atlas.height,cleanPlateAssetId:c.plateAssetId,cleanDepth:c.cleanDepth}}},report:built.report,
  };
}
export async function buildReferenceEnvironment(runId: string) {
  const draft = await draftReferenceEnvironment(runId),
    db = getDb();
  await environmentContext(runId);
  await db.$transaction(async (tx) => {
    const appearanceBefore=await captureAppearance(tx,draft.sceneId);

    if (
      !(await tx.generationRun.findFirst({
        where: {
          id: runId,
          status: { in: ["RUNNING", "WAITING"] },
          expiresAt: { gt: new Date() },
        },
      }))
    )
      throw new Error("BACKGROUND_RUN_STALE");
    const changed = await tx.scene.updateMany({
      where: {
        id: draft.sceneId,
        revision: draft.revision,
        normalizedAssetId: draft.photoId,
        status: "READY",
        archivedAt: null,
      },
      data: {
        stage: json(draft.stage),
        settings: json({
          ...draft.settings,
          backgroundPlan: draft.stage.background,
        }),
        revision: { increment: 1 },
      },
    });
    if (!changed.count) throw new Error("BACKGROUND_REVISION_CHANGED");
    await tx.generationRun.update({
        where: { id: runId },
        data: {
          errorMessage:
            draft.report.warnings.length?`Background ready with ${draft.report.warnings.length} review note${draft.report.warnings.length===1?"":"s"}: ${draft.report.warnings[0]}`.slice(0,900):null,
        },
      });

    await recordAppearance(tx,draft.sceneId,appearanceBefore,"Rebuild background");
});
}

// Matching a layout can change its common coordinate frame. Rebuild only the
// numeric planes from saved evidence; retain the approved albedo, no inference.
export async function reframeSceneEnvironment(
  scene: { id: string; normalizedAssetId: string | null; settings: unknown },
  composition: import("@/lib/scene/composition").SceneComposition,
) {
  const db = getDb(),
    cache = record(record(scene.settings).environmentObservation),
    plan = environmentObservationSchema.parse(record(record(scene.settings).background).observation??cache.analysis);
  if (cache.photoId !== scene.normalizedAssetId)
    throw new Error("ENVIRONMENT_PHOTO_CHANGED");
  const step = await db.generationStep.findFirst({
    where: {
      key: "environment-depth",
      status: "SUCCEEDED",
      run: {
        sceneId: scene.id,
        input: {
          path: ["normalizedAssetId"],
          equals: scene.normalizedAssetId!,
        },
      },
      response: {
        sceneId: scene.id,
        status: "READY",
        kind: "PROVIDER_RESPONSE",
      },
    },
    include: { response: true },
    orderBy: { createdAt: "desc" },
  });
  if (!step?.response) throw new Error("ENVIRONMENT_DEPTH_REQUIRED");
  const grid = decodeEnvironmentDepth(
    JSON.parse(
      (await readLimited(step.response.storageKey, 8 * 1024 * 1024)).toString(),
    ),
  );
  const objects = await db.sceneObject.findMany({
      where: { sceneId: scene.id, maskAssetId: { not: null } },
      include: { mask: true },
    }),
    masks = await Promise.all(
      objects
        .filter((o) => o.mask?.status === "READY")
        .map(async (o) =>
          sharp(await readLimited(o.mask!.storageKey, 4 * 1024 * 1024))
            .greyscale()
            .raw()
            .toBuffer(),
        ),
    );
  const {modelPlacementSchema}=await import("@/lib/scene/composition");
  const anchors=objects.filter(o=>o.mask?.status==="READY").flatMap((o,i)=>{const p=modelPlacementSchema.safeParse(o.initialTransform);return p.success&&masks[i]?[{mask:masks[i],position:[o.positionX,o.positionY,o.positionZ] as [number,number,number],size:p.data.size}]:[];});
  const built = buildEnvironmentGeometry(plan, composition, grid, masks,anchors);
  if (
    built.report.walls < plan.expectedWallCount ||
    built.report.projectionError > 0.08
  )
    throw new Error("ENVIRONMENT_STRUCTURE_INCOMPLETE");
  const previous=composition.background?.geometry?.surfaces??[];
  for(const surface of built.geometry.surfaces){const old=previous.find(s=>s.materialIndex===surface.materialIndex&&s.role===surface.role&&s.atlas);if(old?.atlas){surface.atlas=old.atlas;if(old.relief!==undefined)surface.relief=old.relief;if(surface.tile){const {orthogonalTile}=await import("@/lib/appearance/environment-atlas");surface.tile=orthogonalTile(surface.tile);}}}
  return built;
}
