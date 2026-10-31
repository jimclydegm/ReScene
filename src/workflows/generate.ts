import { sleep, getWorkflowMetadata } from "workflow";

async function claim(runId: string, workflowId: string) {
  "use step";
  const { claimRun } = await import("@/lib/services/generation");
  return claimRun(runId, workflowId);
}
async function analyze(runId: string) {
  "use step";
  const { analyzeRun } = await import("@/lib/services/generation");
  return analyzeRun(runId);
}
analyze.maxRetries = 0;
async function segment(runId: string, objectId: string) {
  "use step";
  const { segmentRunObject,markOutlineFailure } = await import("@/lib/services/generation");
  try { await segmentRunObject(runId, objectId); }
  catch { await markOutlineFailure(runId,objectId); }
}
segment.maxRetries = 0;
async function requestedObject(runId:string){
  "use step";
  const {segmentRequestedObject}=await import("@/lib/services/generation");
  return segmentRequestedObject(runId);
}
async function completeAnalysis(runId: string) {
  "use step";
  const { finishAnalysis } = await import("@/lib/services/generation");
  await finishAnalysis(runId);
}
completeAnalysis.maxRetries = 0;
async function submit(runId: string) {
  "use step";
  const { submitReconstruction } = await import("@/lib/services/generation");
  return submitReconstruction(runId);
}
submit.maxRetries = 0;
async function poll(runId: string, requestId: string) {
  "use step";
  const { pollReconstruction } = await import("@/lib/services/generation");
  return pollReconstruction(runId, requestId);
}
async function ingest(runId: string, requestId: string) {
  "use step";
  const { ingestRun } = await import("@/lib/services/generation");
  return await ingestRun(runId, requestId,true);
}
ingest.maxRetries = 0;
async function improveAppearance(runId:string){
  "use step";
  const {improveGeneratedAppearance}=await import("@/lib/services/generation");
  await improveGeneratedAppearance(runId);
}
improveAppearance.maxRetries=0;
async function improveBackground(runId:string){
  "use step";
  const {finishSceneBackground}=await import("@/lib/services/background");
  await finishSceneBackground(runId);
}
improveBackground.maxRetries=0;
async function prepareBackground(runId:string){
  "use step";
  const {prepareEnvironmentDepth}=await import("@/lib/services/background-environment");
  return prepareEnvironmentDepth(runId);
}
prepareBackground.maxRetries=0;
async function pollBackground(runId:string,requestId:string){
  "use step";
  const {pollEnvironmentDepth}=await import("@/lib/services/background-environment");
  return pollEnvironmentDepth(runId,requestId);
}
async function backgroundFailed(runId:string){
  "use step";
  const {backgroundFailure}=await import("@/lib/services/background");
  await backgroundFailure(runId,new Error("ENVIRONMENT_GEOMETRY_UNAVAILABLE"));
}
async function readyWithBackground(runId:string){
  // This deterministic helper runs inside the caller's workflow. All external
  // I/O stays in steps and polling sleeps yield rather than occupying a function.
  try{
    const requestId=await prepareBackground(runId);
    if(requestId){let done=false;for(let i=0;i<60;i++){if(await pollBackground(runId,requestId)){done=true;break;}await sleep("5s");}if(!done)throw new Error("ENVIRONMENT_DEPTH_TIMEOUT");}
    await improveBackground(runId);
  }catch{await backgroundFailed(runId);}
}
async function isQualityRun(runId:string){
  "use step";
  const {getDb}=await import("@/lib/db");
  const run=await getDb().generationRun.findUnique({where:{id:runId}});
  return Boolean(run?.input&&typeof run.input==="object"&&"quality" in run.input);
}
// Paid steps run once each with no automatic retry; a failed provider call is
// recorded as uncertain and the saved scene stays as it was.
async function qualityPlan(runId:string){
  "use step";
  const {planQualityRun}=await import("@/lib/services/quality");
  await planQualityRun(runId);
}
qualityPlan.maxRetries=0;
async function qualityMasks(runId:string){
  "use step";
  const {refineQualityMasks}=await import("@/lib/services/quality");
  await refineQualityMasks(runId);
}
qualityMasks.maxRetries=0;
async function qualityMaterials(runId:string){
  "use step";
  const {sampleQualityMaterials}=await import("@/lib/services/quality");
  await sampleQualityMaterials(runId);
}
qualityMaterials.maxRetries=0;
async function qualityApply(runId:string){
  "use step";
  const {applyQualityRun}=await import("@/lib/services/quality");
  await applyQualityRun(runId);
}
qualityApply.maxRetries=0;
async function qualityReview(runId:string){
  "use step";
  const {reviewQualityRun}=await import("@/lib/services/quality");
  await reviewQualityRun(runId);
}
qualityReview.maxRetries=0;
async function failure(runId: string) {
  "use step";
  const { failRun } = await import("@/lib/services/generation");
  await failRun(runId);
}
export async function generateScene(runId: string, kind: string) {
  "use workflow";
  if (!await claim(runId, getWorkflowMetadata().workflowRunId)) return;
  try {
    if (kind === "ANALYZE") {
      const objects = await analyze(runId);
      for (const id of objects) await segment(runId, id);
      await completeAnalysis(runId);
    } else if(kind === "IMAGE_EDIT"){
      if(await isQualityRun(runId)){await qualityPlan(runId);await qualityMasks(runId);await qualityMaterials(runId);await qualityApply(runId);await qualityReview(runId);}
      else await readyWithBackground(runId);
    } else if(kind === "SEGMENT_OBJECT"){
      await segment(runId,await requestedObject(runId));
      await completeAnalysis(runId);
    } else {
      const requestId = await submit(runId);
      for (let attempt = 0; attempt < 70; attempt++) {
        if (await poll(runId, requestId)) { if(await ingest(runId, requestId))return; await improveAppearance(runId); await readyWithBackground(runId); return; }
        await sleep("10s");
      }
      throw new Error("Generation deadline exceeded");
    }
  } catch { await failure(runId); }
}

export async function resumeReconstruction(runId: string, requestId: string) {
  "use workflow";
  try {
    for (let attempt = 0; attempt < 70; attempt++) {
      if (await poll(runId, requestId)) { if(await ingest(runId, requestId))return; await improveAppearance(runId); await readyWithBackground(runId); return; }
      await sleep("10s");
    }
    throw new Error("Generation deadline exceeded");
  } catch { await failure(runId); }
}

export async function resumeBackground(runId:string){
  "use workflow";
  await readyWithBackground(runId);
}
