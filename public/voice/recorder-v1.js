/* global AudioWorkletProcessor, registerProcessor */
class ReSceneRecorder extends AudioWorkletProcessor {
 constructor(){super();this.buffer=new Float32Array(2048);this.length=0;this.port.onmessage=e=>{if(e.data==="flush"){this.send();this.port.postMessage({flushed:true});}};}
 send(){if(!this.length)return;const data=this.buffer.slice(0,this.length);this.port.postMessage({samples:data},[data.buffer]);this.length=0;}
 process(inputs){const channels=inputs[0];if(!channels?.length)return true;for(let i=0;i<channels[0].length;i++){let sum=0;for(const channel of channels)sum+=channel[i]??0;this.buffer[this.length++]=sum/channels.length;if(this.length===this.buffer.length)this.send();}return true;}
}
registerProcessor("rescene-recorder-v1",ReSceneRecorder);
