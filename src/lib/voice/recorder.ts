import {samplesToWave,VOICE_RATE,VOICE_SECONDS} from "./audio";
export class VoiceRecorder{
 private chunks:Float32Array[]=[];
 private count=0;
 private flush:()=>void=()=>{};
 private closed=false;
 private constructor(private context:AudioContext,private stream:MediaStream,private node:AudioWorkletNode,private source:MediaStreamAudioSourceNode,private gain:GainNode){}
 static async start(onLevel:(level:number)=>void){
  if(!navigator.mediaDevices?.getUserMedia||!window.AudioContext)throw new Error("Microphone recording is unavailable here. Upload a short PCM WAV clip instead.");
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});let context:AudioContext|undefined;
  try{context=new AudioContext({sampleRate:VOICE_RATE});await context.audioWorklet.addModule("/voice/recorder-v1.js");await context.resume();const node=new AudioWorkletNode(context,"rescene-recorder-v1"),source=context.createMediaStreamSource(stream),gain=context.createGain();gain.gain.value=0;source.connect(node);node.connect(gain);gain.connect(context.destination);const recorder=new VoiceRecorder(context,stream,node,source,gain);
   node.port.onmessage=e=>{if(e.data.flushed){recorder.flush();return;}const data=e.data.samples;if(!(data instanceof Float32Array)||recorder.closed)return;const max=context!.sampleRate*VOICE_SECONDS,remaining=max-recorder.count,chunk=data.subarray(0,Math.max(0,remaining));if(chunk.length){recorder.chunks.push(new Float32Array(chunk));recorder.count+=chunk.length;let sum=0;for(const s of chunk)sum+=s*s;onLevel(Math.min(1,Math.sqrt(sum/chunk.length)*5));}};
   return recorder;
  }catch(e){stream.getTracks().forEach(t=>t.stop());await context?.close().catch(()=>{});throw e;}
 }
 async stop(){
  if(this.closed)throw new Error("Start a new recording.");
  await new Promise<void>(resolve=>{let finished=false;const done=()=>{if(finished)return;finished=true;clearTimeout(timer);resolve();};const timer=setTimeout(done,500);this.flush=done;this.node.port.postMessage("flush");});
  const samples=new Float32Array(this.count);let at=0;for(const chunk of this.chunks){samples.set(chunk,at);at+=chunk.length;}const rate=this.context.sampleRate;this.cancel();return samplesToWave(samples,rate);
 }
 cancel(){if(this.closed)return;this.closed=true;this.stream.getTracks().forEach(t=>t.stop());this.source.disconnect();this.node.disconnect();this.gain.disconnect();void this.context.close().catch(()=>{});this.chunks=[];}
}
