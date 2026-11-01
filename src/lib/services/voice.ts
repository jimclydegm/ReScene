import "server-only";
import {createHash} from "node:crypto";
import {Prisma,type VoiceAttempt} from "@/generated/prisma/client";
import {getDb} from "@/lib/db";
import {AppError} from "@/lib/http";
import {transcribeVoice,SpeechProviderError} from "@/lib/ai/transcribe";
import {planVoiceChanges} from "@/lib/ai/voice-plan";
import {applyVoicePlan} from "@/lib/voice/demo-plan";
import {voicePlanSchema,type VoiceCommandInput,type VoiceResult,type voiceUpload} from "@/lib/voice/contracts";
import type {z} from "zod";
type Actor={actorHash:string;networkHash:string};
const sha=(v:Uint8Array|string)=>createHash("sha256").update(v).digest("hex");
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
function result(row:VoiceAttempt):VoiceResult{
 if(row.status==="SUCCEEDED"&&row.transcript!==null)return {attemptId:row.id,text:row.transcript,durationMs:row.durationMs,model:row.model};
 if(row.status==="RUNNING")throw new AppError(409,"VOICE_PENDING","This clip is still being transcribed. Retrieve its result shortly; it will not be submitted again.");
 throw new AppError(409,"VOICE_ATTEMPT_FINISHED",row.status==="SUBMISSION_UNCERTAIN"?"The transcription response was interrupted. This clip will not be submitted again automatically.":"This clip could not be transcribed. You can start a new recording.");
}
export async function recoverVoice(actor:Actor,key:string,purpose:string){
 let row=await getDb().voiceAttempt.findFirst({where:{actorHash:actor.actorHash,requestKey:key,purpose,expiresAt:{gt:new Date()}}});if(!row)throw new AppError(404,"VOICE_NOT_FOUND","No saved result is available for this clip.");if(row.status==="RUNNING"&&Date.now()-row.createdAt.getTime()>90000)row=await getDb().voiceAttempt.update({where:{id:row.id},data:{status:"SUBMISSION_UNCERTAIN",errorCode:"VOICE_RESPONSE_INTERRUPTED"}});return result(row);
}
export async function transcribeOnce(actor:Actor,input:z.infer<typeof voiceUpload>,audio:{bytes:Uint8Array;durationMs:number}){
 if(process.env.GENERATION_ENABLED!=="true")throw new AppError(503,"VOICE_DISABLED","Voice transcription is currently unavailable.");
 const db=getDb(),model=process.env.META_TRANSCRIPTION_MODEL??"muse-voice-transcribe-1.0",inputHash=sha(sha(audio.bytes)+JSON.stringify({purpose:input.purpose,language:input.language,model}));
 const reserved=await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172641)`;
  const prior=await tx.voiceAttempt.findUnique({where:{actorHash_requestKey:{actorHash:actor.actorHash,requestKey:input.key}}});
  if(prior){if(prior.inputHash!==inputHash)throw new AppError(409,"VOICE_INPUT_CHANGED","Use a new recording for changed audio or language settings.");if(prior.expiresAt<new Date())throw new AppError(409,"VOICE_EXPIRED","This recording's recovery window has ended. Start a new recording.");return {row:prior,created:false};}
  const recent=new Date(Date.now()-60000);
  if(await tx.voiceAttempt.count({where:{createdAt:{gte:recent},OR:[{actorHash:actor.actorHash},{networkHash:actor.networkHash}]}})>=12)throw new AppError(429,"VOICE_RATE_LIMIT","Several voice requests were just made. Wait a minute before recording again.");
  if(await tx.voiceAttempt.count({where:{status:"RUNNING",createdAt:{gte:recent},actorHash:actor.actorHash}}))throw new AppError(409,"VOICE_PENDING","Finish the current voice request first.");
  if(await tx.voiceAttempt.count({where:{status:"RUNNING",createdAt:{gte:recent}}})>=8)throw new AppError(429,"VOICE_BUSY","Voice transcription is busy. Try again shortly.");
  // Clear expired cached content on subsequent requests, retaining only receipts.
  await tx.voiceAttempt.updateMany({where:{expiresAt:{lt:new Date()},OR:[{transcript:{not:null}},{commandPlan:{not:Prisma.DbNull}}]},data:{transcript:null,commandPlan:Prisma.DbNull}});
  return {row:await tx.voiceAttempt.create({data:{...actor,requestKey:input.key,purpose:input.purpose,inputHash,status:"RUNNING",model,durationMs:audio.durationMs,expiresAt:new Date(Date.now()+15*60000)}}),created:true};
 });
 if(!reserved.created)return result(reserved.row);
 try{const output=await transcribeVoice(audio.bytes,input.language);const row=await db.voiceAttempt.update({where:{id:reserved.row.id},data:{status:"SUCCEEDED",transcript:output.text,durationMs:output.durationMs}});return result(row);}
 catch(error){const rejected=error instanceof SpeechProviderError;await db.voiceAttempt.update({where:{id:reserved.row.id},data:{status:rejected?"FAILED":"SUBMISSION_UNCERTAIN",errorCode:rejected?`META_HTTP_${error.status}`:"VOICE_RESPONSE_INTERRUPTED"}});throw new AppError(rejected?502:504,"VOICE_PROVIDER_UNAVAILABLE",rejected?"Meta could not transcribe this clip. Check the recording format or try a new clip when ready.":"The transcription response was interrupted. Retrieve the result before starting another recording.");}
}
export async function proposeVoiceOnce(actor:Actor,input:VoiceCommandInput){
 if(process.env.GENERATION_ENABLED!=="true")throw new AppError(503,"VOICE_DISABLED","Voice controls are currently unavailable.");
 const db=getDb(),inputHash=sha(JSON.stringify(input)),reserved=await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172641)`;
  const row=await tx.voiceAttempt.findFirst({where:{id:input.attemptId,actorHash:actor.actorHash,purpose:"showroom",status:"SUCCEEDED",expiresAt:{gt:new Date()}}});if(!row)throw new AppError(404,"VOICE_NOT_FOUND","Transcribe a showroom instruction first.");
  if(row.commandStatus){if(row.commandInputHash!==inputHash)throw new AppError(409,"VOICE_CONTEXT_CHANGED","The scene or transcript changed. Record a new instruction to review this version.");if(row.commandStatus==="SUCCEEDED")return {row,created:false};throw new AppError(409,"VOICE_PLAN_UNAVAILABLE","This instruction is already processing or finished. It will not be submitted again automatically.");}
  const checked=applyVoicePlan(input,{summary:"",actions:[]});if(checked.error)throw new AppError(400,"VOICE_CONTEXT_INVALID",checked.error);
  await tx.voiceAttempt.update({where:{id:row.id},data:{commandStatus:"RUNNING",commandInputHash:inputHash}});return {row,created:true};
 });
 if(!reserved.created)return voicePlanSchema.parse(reserved.row.commandPlan);
 try{const plan=await planVoiceChanges(input);await db.voiceAttempt.update({where:{id:reserved.row.id},data:{commandStatus:"SUCCEEDED",commandPlan:json(plan)}});return plan;}
 catch{await db.voiceAttempt.update({where:{id:reserved.row.id},data:{commandStatus:"SUBMISSION_UNCERTAIN"}});throw new AppError(502,"VOICE_PLAN_UNAVAILABLE","The voice instruction could not be reviewed. Your scene is unchanged; no automatic retry was sent.");}
}
