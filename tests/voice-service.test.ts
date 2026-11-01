import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import type {VoiceAttempt} from "../src/generated/prisma/client";
const m=vi.hoisted(()=>({db:{voiceAttempt:{findUnique:vi.fn(),findFirst:vi.fn(),count:vi.fn(),updateMany:vi.fn(),create:vi.fn(),update:vi.fn()},$transaction:vi.fn(),$executeRaw:vi.fn()},transcribe:vi.fn(),plan:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/db",()=>({getDb:()=>m.db}));vi.mock("@/lib/ai/transcribe",()=>({transcribeVoice:m.transcribe,SpeechProviderError:class extends Error{constructor(public status:number){super("Rejected");}}}));vi.mock("@/lib/ai/voice-plan",()=>({planVoiceChanges:m.plan}));
import {transcribeOnce,recoverVoice,proposeVoiceOnce} from "../src/lib/services/voice";
import {SpeechProviderError} from "../src/lib/ai/transcribe";
import {demoScenes,initialArrangement} from "../src/lib/demo/scenes";
const actor={actorHash:"private-actor",networkHash:"private-network"},input={key:"64a3fdbd-4e0b-47df-9bd8-77e05bd446e2",purpose:"showroom" as const,language:"Auto" as const},audio={bytes:new Uint8Array([1,2,3]),durationMs:500};
let row:VoiceAttempt|null;
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv("GENERATION_ENABLED","true");row=null;
 m.db.$transaction.mockImplementation(fn=>fn(m.db));m.db.voiceAttempt.count.mockResolvedValue(0);m.db.voiceAttempt.findUnique.mockImplementation(()=>row);m.db.voiceAttempt.findFirst.mockImplementation(()=>row);
 m.db.voiceAttempt.create.mockImplementation(({data})=>{row={id:"cec748ef-6c40-4d34-9700-89e86beb2588",createdAt:new Date(),updatedAt:new Date(),transcript:null,errorCode:null,commandStatus:null,commandInputHash:null,commandPlan:null,...data};return row;});
 m.db.voiceAttempt.update.mockImplementation(({data})=>{row={...row,...data} as VoiceAttempt;return row;});m.transcribe.mockResolvedValue({text:"Make the chair blue",durationMs:500,model:"muse-voice-transcribe-1.0"});m.plan.mockResolvedValue({summary:"No changes",actions:[]});
});
afterEach(()=>vi.unstubAllEnvs());
describe("Voice request receipts",()=>{
 it("reuses a saved transcription on duplicate submission and exposes no raw recording in the receipt",async()=>{
  const first=await transcribeOnce(actor,input,audio),duplicate=await transcribeOnce(actor,input,audio);expect(first).toEqual(duplicate);expect(m.transcribe).toHaveBeenCalledTimes(1);expect(m.db.voiceAttempt.create).toHaveBeenCalledTimes(1);expect(row).not.toHaveProperty("bytes");expect(row).not.toHaveProperty("audio");expect(await recoverVoice(actor,input.key,input.purpose)).toEqual(first);
 });
 it("never resubmits uncertain or running attempts and rejects changed audio",async()=>{
  await transcribeOnce(actor,input,audio);row!.status="RUNNING";await expect(transcribeOnce(actor,input,audio)).rejects.toMatchObject({code:"VOICE_PENDING"});row!.status="SUBMISSION_UNCERTAIN";await expect(transcribeOnce(actor,input,audio)).rejects.toMatchObject({code:"VOICE_ATTEMPT_FINISHED"});await expect(transcribeOnce(actor,input,{...audio,bytes:new Uint8Array([9])})).rejects.toMatchObject({code:"VOICE_INPUT_CHANGED"});expect(m.transcribe).toHaveBeenCalledTimes(1);
 });
 it("marks HTTP rejection and transport uncertainty distinctly with one provider call",async()=>{
  m.transcribe.mockRejectedValueOnce(new SpeechProviderError(429));await expect(transcribeOnce(actor,input,audio)).rejects.toMatchObject({status:502});expect(row!.status).toBe("FAILED");expect(row!.errorCode).toBe("META_HTTP_429");
  row=null;m.transcribe.mockRejectedValueOnce(new TypeError("connection lost"));await expect(transcribeOnce(actor,input,audio)).rejects.toMatchObject({status:504});expect(row!.status).toBe("SUBMISSION_UNCERTAIN");expect(m.transcribe).toHaveBeenCalledTimes(2);
 });
 it("bounds public request rates and global concurrency before any inference",async()=>{
  m.db.voiceAttempt.count.mockResolvedValueOnce(12);await expect(transcribeOnce(actor,input,audio)).rejects.toMatchObject({status:429,code:"VOICE_RATE_LIMIT"});
  m.db.voiceAttempt.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(8);await expect(transcribeOnce(actor,input,audio)).rejects.toMatchObject({code:"VOICE_BUSY"});expect(m.transcribe).not.toHaveBeenCalled();
 });
 it("expires cached text and scopes recovery to its actor, purpose and key",async()=>{
  await transcribeOnce(actor,input,audio);row!.expiresAt=new Date(0);await expect(transcribeOnce(actor,input,audio)).rejects.toMatchObject({code:"VOICE_EXPIRED"});row!.status="RUNNING";row!.createdAt=new Date(Date.now()-100000);row!.expiresAt=new Date(Date.now()+10000);await expect(recoverVoice(actor,input.key,input.purpose)).rejects.toMatchObject({code:"VOICE_ATTEMPT_FINISHED"});expect(row!.status).toBe("SUBMISSION_UNCERTAIN");expect(m.db.voiceAttempt.findFirst).toHaveBeenLastCalledWith({where:{actorHash:actor.actorHash,requestKey:input.key,purpose:input.purpose,expiresAt:{gt:expect.any(Date)}}});
 });
 it("reuses a Spark proposal only with the same transcript and scene context",async()=>{
  await transcribeOnce(actor,input,audio);const request={attemptId:row!.id,text:"Make it blue",sceneId:"corner" as const,selected:"corner-chair",draft:initialArrangement(demoScenes.find(s=>s.id==="corner")!)};
  const first=await proposeVoiceOnce(actor,request);expect(await proposeVoiceOnce(actor,request)).toEqual(first);expect(m.plan).toHaveBeenCalledTimes(1);await expect(proposeVoiceOnce(actor,{...request,text:"Hide it"})).rejects.toMatchObject({code:"VOICE_CONTEXT_CHANGED"});expect(m.plan).toHaveBeenCalledTimes(1);
 });
 it("does not retry an interrupted proposal and honors the operator inference switch",async()=>{
  await transcribeOnce(actor,input,audio);const request={attemptId:row!.id,text:"Make it blue",sceneId:"corner" as const,selected:"corner-chair",draft:initialArrangement(demoScenes.find(s=>s.id==="corner")!)};m.plan.mockRejectedValueOnce(new Error("interrupted"));await expect(proposeVoiceOnce(actor,request)).rejects.toMatchObject({code:"VOICE_PLAN_UNAVAILABLE"});await expect(proposeVoiceOnce(actor,request)).rejects.toMatchObject({code:"VOICE_PLAN_UNAVAILABLE"});expect(m.plan).toHaveBeenCalledTimes(1);
  vi.stubEnv("GENERATION_ENABLED","false");await expect(transcribeOnce(actor,input,audio)).rejects.toMatchObject({status:503});
 });
});
