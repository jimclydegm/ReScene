"use client";
import {useEffect,useRef,useState} from "react";
import {Check,LoaderCircle,RotateCcw} from "lucide-react";
import {VoiceInput,type VoiceUse} from "@/components/voice-input";
import {voicePlanSchema,type VoiceCommandInput,type VoicePlan} from "@/lib/voice/contracts";
import {applyVoicePlan} from "@/lib/voice/demo-plan";
import {findDemoProduct,itemProductId} from "@/lib/demo/catalog";
import type {Arrangement} from "@/lib/demo/state";
import {DemoDialog} from "./store";

type Context=Omit<VoiceCommandInput,"text"|"attemptId">;
/** The transcript proposes an edit; only the explicit Apply button changes the showroom. */
export function DemoVoiceControls({sceneId,draft,selected,onApply}:{sceneId:string;draft:Arrangement;selected:string;onApply:(draft:Arrangement,selected:string)=>void}){
 const [input,setInput]=useState<VoiceCommandInput|null>(null),[plan,setPlan]=useState<VoicePlan|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const context:Context={sceneId:sceneId as Context["sceneId"],draft,selected},preview=input&&plan?applyVoicePlan(input,plan):null,stale=!!input&&JSON.stringify(context)!==JSON.stringify({sceneId:input.sceneId,draft:input.draft,selected:input.selected});
 const changed=!!preview&&!preview.error&&(JSON.stringify(preview.draft)!==JSON.stringify(draft)||preview.selected!==selected);
 function close(){controller.current?.abort();setInput(null);setPlan(null);setError("");setBusy(false);}
 async function propose(request:VoiceCommandInput){
  controller.current?.abort();const abort=new AbortController();controller.current=abort;setBusy(true);setError("");
  try{const response=await fetch("/api/voice/commands",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request),signal:abort.signal}),data=await response.json();if(!response.ok)throw new Error(data.error?.message??"The instruction could not be reviewed.");if(!abort.signal.aborted)setPlan(voicePlanSchema.parse(data));}
  catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"The instruction could not be reviewed.");}finally{if(!abort.signal.aborted)setBusy(false);}
 }
 function review(value:VoiceUse){const request={...context,text:value.text,attemptId:value.attemptId};setInput(request);setPlan(null);void propose(request);}
 return <><VoiceInput purpose="showroom" label="Voice controls" field="showroom controls" maxLength={1000} replaceOnly onUse={review}/>{input&&<DemoDialog title="Review voice changes" onClose={close}>
  <p className="voice-model">Muse Voice Transcribe → Muse Spark</p><blockquote className="voice-quote">{input.text}</blockquote>
  {busy?<p className="voice-plan-working" role="status"><LoaderCircle size={16} className="spin"/>Interpreting your instruction…</p>:plan&&<><p className="voice-plan-summary">{plan.summary}</p>{preview&&!preview.error&&<ul className="voice-change-list">{describeChanges(input,preview).map((line,i)=><li key={i}><Check size={14}/>{line}</li>)}</ul>}</>}
  {(error||preview?.error||stale)&&<p className="voice-error" role="alert">{stale?"The scene changed while this instruction was being reviewed. Close this preview and record a new instruction.":error||preview?.error}</p>}
  {!busy&&plan&&!changed&&!preview?.error&&<p className="voice-hint">No scene changes are proposed. Close this preview to try another instruction.</p>}
  <p className="voice-hint">Try “make the selected item blue and use dusk lighting.” Small moves, rotation, show/hide, replacements and room finishes are supported. You can undo all applied changes together.</p>
  <div className="voice-use-actions">{error&&<button type="button" className="d-button" disabled={busy} onClick={()=>void propose(input)}><RotateCcw size={13}/>Check saved proposal</button>}<button type="button" className="d-button" onClick={close}>Cancel</button><button type="button" className="d-button primary" disabled={busy||!!error||!!preview?.error||stale||!changed} onClick={()=>{if(preview&&!preview.error&&!stale&&changed){onApply(preview.draft,preview.selected);close();}}}>Apply changes</button></div>
 </DemoDialog>}</>;
}
function describeChanges(before:Context,after:{draft:Arrangement;selected:string}){
 const lines:string[]=[];
 for(const [id,item]of Object.entries(after.draft.items)){
  const old=before.draft.items[id],p=findDemoProduct(itemProductId(id,item))!;
  if(itemProductId(id,old)!==p.id)lines.push(`Replace ${findDemoProduct(itemProductId(id,old))!.name} with ${p.name}`);
  if(item.color!==old.color||itemProductId(id,old)!==p.id)lines.push(`${p.name}: ${p.colors[item.color].name}`);
  if(item.visible!==old.visible)lines.push(`${item.visible?"Show":"Hide"} ${p.name}`);
  if(item.x!==old.x||item.z!==old.z||item.yaw!==old.yaw)lines.push(`Adjust ${p.name} · X ${item.x.toFixed(2)}, Z ${item.z.toFixed(2)}, rotation ${Math.round(item.yaw*180/Math.PI)}°`);
 }
 if(after.draft.lighting!==before.draft.lighting)lines.push(`Lighting: ${after.draft.lighting}`);
 if(JSON.stringify(after.draft.background)!==JSON.stringify(before.draft.background))lines.push(`Room finish: ${after.draft.background?.preset??"original"}`);
 if(after.selected!==before.selected&&after.draft.items[after.selected])lines.push(`Select ${findDemoProduct(itemProductId(after.selected,after.draft.items[after.selected]))!.name}`);
 return lines;
}
