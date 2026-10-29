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
  const { segmentRunObject } = await import("@/lib/services/generation");
  await segmentRunObject(runId, objectId);
}
segment.maxRetries = 0;
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
  await ingestRun(runId, requestId);
}
ingest.maxRetries = 0;
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
    } else {
      const requestId = await submit(runId);
      for (let attempt = 0; attempt < 70; attempt++) {
        if (await poll(runId, requestId)) { await ingest(runId, requestId); return; }
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
      if (await poll(runId, requestId)) { await ingest(runId, requestId); return; }
      await sleep("10s");
    }
    throw new Error("Generation deadline exceeded");
  } catch { await failure(runId); }
}
