import "server-only";
import {requiredEnv} from "@/lib/env";
import {z} from "zod";
import {demoProducts} from "@/lib/demo/catalog";
import {voiceLanguage} from "@/lib/voice/contracts";
export class SpeechProviderError extends Error{constructor(public status:number){super("Speech provider request failed");this.name="SpeechProviderError";}}
export async function transcribeVoice(bytes:Uint8Array,language:z.infer<typeof voiceLanguage>){
 const model=process.env.META_TRANSCRIPTION_MODEL??"muse-voice-transcribe-1.0",form=new FormData(),languageBias=language==="Auto"?undefined:language==="English + Tagalog"?["English","Tagalog"]:[language];
 form.set("request",new Blob([JSON.stringify({model,audioEncoding:"WAV",mode:"PUSH_TO_TALK",...(languageBias?{languageBias}:{}),keywords:["ReScene",...demoProducts.map(p=>p.name),"sage","dusk","terracotta","plaster","linen"]})],{type:"application/json"}));form.set("audio",new Blob([new Uint8Array(bytes)],{type:"audio/wav"}),"voice.wav");
 const response=await fetch(`${(process.env.META_API_BASE_URL??"https://api.meta.ai/v1").replace(/\/$/,"")}/asr/transcribe`,{method:"POST",headers:{Authorization:`Bearer ${requiredEnv("MODEL_API_KEY")}`,Accept:"application/json"},body:form,signal:AbortSignal.timeout(45000),cache:"no-store",redirect:"error"});
 if(!response.ok){await response.body?.cancel();throw new SpeechProviderError(response.status);}
 const raw=await response.text();if(raw.length>128*1024)throw new Error("SPEECH_RESULT_TOO_LARGE");
 const parsed=z.object({transcript:z.string().max(4000),audioDurationMs:z.number().int().min(0).max(35000)}).parse(JSON.parse(raw));return {text:parsed.transcript.trim(),durationMs:parsed.audioDurationMs,model};
}
