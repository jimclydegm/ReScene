export const VOICE_SECONDS=30;
export const VOICE_RATE=24000;
export const VOICE_MAX_BYTES=VOICE_RATE*2*VOICE_SECONDS+4096;
export function encodeWave(pcm:Int16Array,rate=VOICE_RATE):Uint8Array{
 const out=new Uint8Array(44+pcm.length*2),v=new DataView(out.buffer),text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
 text(0,"RIFF");v.setUint32(4,out.length-8,true);text(8,"WAVE");text(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,"data");v.setUint32(40,pcm.length*2,true);for(let i=0;i<pcm.length;i++)v.setInt16(44+i*2,pcm[i],true);return out;
}
/** Area-average downsampling preserves timing even when hardware ignores 24kHz. */
export function samplesToWave(samples:Float32Array,sourceRate:number):Uint8Array{
 if(!Number.isFinite(sourceRate)||sourceRate<VOICE_RATE||sourceRate>192000||samples.length/sourceRate>VOICE_SECONDS+.1)throw new Error("Record a clip of 30 seconds or less.");
 const n=Math.min(VOICE_RATE*VOICE_SECONDS,Math.floor(samples.length*VOICE_RATE/sourceRate)),pcm=new Int16Array(n),ratio=sourceRate/VOICE_RATE;
 for(let i=0;i<n;i++){const start=i*ratio,end=(i+1)*ratio;let sum=0;for(let j=Math.floor(start);j<Math.ceil(end);j++)sum+=(Number.isFinite(samples[j])?samples[j]:0)*(Math.min(end,j+1)-Math.max(start,j));const sample=Math.max(-1,Math.min(1,sum/ratio));pcm[i]=Math.round(sample*(sample<0?32768:32767));}return encodeWave(pcm);
}
/** Parse only bounded mono PCM; rebuild the header to strip arbitrary metadata. */
export function normalizeWave(input:Uint8Array){
 if(input.length<44||input.length>VOICE_MAX_BYTES)throw new Error("Upload a mono PCM WAV clip, up to 30 seconds.");
 const v=new DataView(input.buffer,input.byteOffset,input.byteLength),text=(at:number,n:number)=>String.fromCharCode(...input.subarray(at,at+n));
 if(text(0,4)!=="RIFF"||text(8,4)!=="WAVE"||v.getUint32(4,true)+8!==input.length)throw new Error("Use a valid WAV recording.");
 let rate=0,data:Uint8Array|null=null,format=false;
 for(let at=12;at+8<=input.length;){const id=text(at,4),size=v.getUint32(at+4,true),start=at+8;if(start+size>input.length)throw new Error("The WAV recording is incomplete.");
  if(id==="fmt "){if(format||size<16)throw new Error("Invalid WAV format.");format=true;rate=v.getUint32(start+4,true);if(v.getUint16(start,true)!==1||v.getUint16(start+2,true)!==1||![16000,24000].includes(rate)||v.getUint16(start+12,true)!==2||v.getUint16(start+14,true)!==16||v.getUint32(start+8,true)!==rate*2)throw new Error("Use mono 16-bit PCM WAV at 16 or 24 kHz.");}
  if(id==="data"){if(data||size%2)throw new Error("Invalid WAV samples.");data=input.subarray(start,start+size);}at=start+size+(size%2);
 }
 if(!format||!data||data.length/(rate*2)<.25||data.length/(rate*2)>VOICE_SECONDS)throw new Error("Record between a quarter second and 30 seconds.");
 const pcm=new Int16Array(data.length/2),d=new DataView(data.buffer,data.byteOffset,data.byteLength);for(let i=0;i<pcm.length;i++)pcm[i]=d.getInt16(i*2,true);
 return {bytes:encodeWave(pcm,rate),durationMs:Math.round(pcm.length/rate*1000)};
}
