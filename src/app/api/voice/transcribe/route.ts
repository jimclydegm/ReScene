import {api,checkOrigin,AppError} from "@/lib/http";
import {voiceActor} from "@/lib/voice/actor";
import {voiceUpload,voicePurpose} from "@/lib/voice/contracts";
import {VOICE_MAX_BYTES,normalizeWave} from "@/lib/voice/audio";
import {transcribeOnce,recoverVoice} from "@/lib/services/voice";
import {z} from "zod";
export const runtime="nodejs";
export const maxDuration=60;
export const POST=(request:Request)=>api(async()=>{
 checkOrigin(request);const type=request.headers.get("content-type")??"";if(!type.startsWith("multipart/form-data"))throw new AppError(400,"VOICE_FORMAT","Send a WAV recording.");
 const reader=request.body?.getReader();if(!reader)throw new AppError(400,"VOICE_EMPTY","Record a short voice clip first.");
 let size=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>VOICE_MAX_BYTES+8192){await reader.cancel();throw new AppError(413,"VOICE_TOO_LARGE","Record a clip of 30 seconds or less.");}chunks.push(part.value);}
 const bytes=Buffer.concat(chunks);let form:FormData;try{form=await new Response(bytes,{headers:{"content-type":type}}).formData();}catch{throw new AppError(400,"VOICE_FORMAT","Send a valid multipart WAV recording.");}
 const keys=[...form.keys()];if(new Set(keys).size!==keys.length)throw new AppError(400,"VOICE_FORMAT","Send one recording and one set of settings.");
 const audio=form.get("audio"),input=voiceUpload.parse(Object.fromEntries([...form.entries()].filter(([k])=>k!=="audio")));if(!(audio instanceof File)||audio.size>VOICE_MAX_BYTES)throw new AppError(400,"VOICE_FORMAT","Use a mono PCM WAV clip of up to 30 seconds.");
 const actor=await voiceActor(request,input.purpose);let normalized;try{normalized=normalizeWave(new Uint8Array(await audio.arrayBuffer()));}catch(e){throw new AppError(400,"VOICE_FORMAT",e instanceof Error?e.message:"Invalid recording.");}
 return Response.json(await transcribeOnce(actor,input,normalized));
});
export const GET=(request:Request)=>api(async()=>{const url=new URL(request.url),key=z.uuid().parse(url.searchParams.get("key")),purpose=voicePurpose.parse(url.searchParams.get("purpose"));return Response.json(await recoverVoice(await voiceActor(request,purpose),key,purpose));});
