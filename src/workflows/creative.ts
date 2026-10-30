import {getWorkflowMetadata} from "workflow";
async function claim(id:string,workflowId:string){
  "use step";
  const {claimRun}=await import("@/lib/services/generation");
  return claimRun(id,workflowId);
}
async function compose(id:string){
  "use step";
  const {composeCreative}=await import("@/lib/services/creative");
  await composeCreative(id);
}
compose.maxRetries=0;
export async function createSceneImage(id:string){
  "use workflow";
  if(await claim(id,getWorkflowMetadata().workflowRunId))await compose(id);
}
