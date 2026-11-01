import "server-only";
import {cookies} from "next/headers";
import {createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import {requiredEnv} from "@/lib/env";
import {requireUser} from "@/lib/auth/user";
import type {VoicePurpose} from "./contracts";
export function voiceHash(domain:string,value:string){return createHmac("sha256",requiredEnv("NEON_AUTH_COOKIE_SECRET")).update(`rescene-voice:${domain}:`+value).digest("hex");}
export function validVoiceCookie(value:string,now=Date.now()){
 const parts=value.split("."),[id,time,signature]=parts;if(parts.length!==3||!id||!time||!signature||signature.length!==64||!/^[\da-f]{64}$/.test(signature)||!Number.isFinite(Number(time))||now-Number(time)>86400000||Number(time)>now+60000)return false;
 return timingSafeEqual(Buffer.from(signature,"hex"),Buffer.from(voiceHash("cookie",`${id}.${time}`),"hex"));
}
export async function voiceActor(request:Request,purpose:VoicePurpose){
 const network=(request.headers.get("x-vercel-forwarded-for")??request.headers.get("x-forwarded-for")??"local").split(",")[0].trim().slice(0,100);
 if(["creative","background","analysis"].includes(purpose)){const user=await requireUser();return {actorHash:voiceHash("account",user.id),networkHash:voiceHash("network",network)};}
 const jar=await cookies(),secure=new URL(request.url).protocol==="https:",name=secure?"__Secure-rescene-voice":"rescene-voice";
 let token=jar.get(name)?.value??"";if(!validVoiceCookie(token)){const value=`${randomUUID()}.${Date.now()}`;token=`${value}.${voiceHash("cookie",value)}`;jar.set(name,token,{httpOnly:true,secure,sameSite:"strict",path:"/api/voice",maxAge:86400});}
 return {actorHash:voiceHash("guest",token),networkHash:voiceHash("network",network)};
}
