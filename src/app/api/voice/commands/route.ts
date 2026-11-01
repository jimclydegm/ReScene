import {api,checkOrigin,readJson} from "@/lib/http";
import {voiceActor} from "@/lib/voice/actor";
import {voiceCommandInput} from "@/lib/voice/contracts";
import {proposeVoiceOnce} from "@/lib/services/voice";
export const runtime="nodejs";
export const maxDuration=60;
export const POST=(request:Request)=>api(async()=>{checkOrigin(request);const input=voiceCommandInput.parse(await readJson(request));return Response.json(await proposeVoiceOnce(await voiceActor(request,"showroom"),input));});
