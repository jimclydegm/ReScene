"use client";
import {useRef,useState} from "react";
import {ScanSearch,Sparkles,Undo2} from "lucide-react";
import type {SceneWorkspace} from "./types";

const views:[string,string,number][]=[["wireframe","Wireframe",0],["normals","Normals",0],["unlit","Base color",0],["neutral","Neutral light",0],["unlit","Back",2],["unlit","Top",4],["unlit","Underside",5]];
const pct=(v:number)=>`${Math.round(v*100)}%`;

/** Coordinated geometry, texture and placement pass, its report and private diagnostic views. */
export function QualityControls({data,disabled,onImprove,onRestore,onPaid}:{data:SceneWorkspace;disabled:boolean;onImprove:()=>void;onRestore:()=>void;onPaid:(options:{materials:boolean;masks:boolean;review:boolean})=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),[options,setOptions]=useState({materials:true,masks:true,review:true}),[error,setError]=useState(""),[inspect,setInspect]=useState(data.objects.find(o=>o.modelUrl)?.id??"");
 const quality=data.quality,matched=Boolean(data.composition&&data.composition.layoutSource!=="manual-stage"),base=`/api/scenes/${data.id}/quality`;
 return <div className="panel-block">
  <div className="panel-heading"><h3>3D quality</h3><span className={`setting-badge${quality?" active":""}`}>{quality?(quality.paid?"Meta pass applied":"Checked"):"Not run"}</span></div>
  <p className="panel-hint">Checks mesh structure, texture mapping, lighting in the base color and physical contact separately, then repairs only what the evidence supports. Each object keeps its previous model if the result measures worse.</p>
  <div className="panel-buttons">
   <button className="button button-dark" disabled={disabled||!matched} onClick={onImprove}><ScanSearch size={14}/>{quality?"Run check again":"Check and repair"}</button>
   <button className="button button-light" disabled={disabled||!matched||!data.generationEnabled} onClick={()=>{setError("");dialog.current?.showModal();}}><Sparkles size={14}/>Use Meta AI…</button>
  </div>
  {!matched&&<p className="panel-note">Match the photo layout first.</p>}
  {quality&&<div className={`layout-report${quality.objects.some(o=>o.verdict!=="PASS")?" attention":""}`} role="status">
   <strong>{quality.objects.every(o=>o.verdict==="PASS")?"Final output checked":"Some objects need a look"}</strong>
   <ul>{quality.objects.map(o=><li key={o.id}><span>{o.label} · {o.verdict==="PASS"?"pass":o.verdict==="REJECT"?"rejected":"review"}{o.reverted?" · previous kept":""}</span><meter min={0} max={1} low={.65} optimum={1} value={o.iou}/><b className={o.verdict!=="PASS"?"warn":""}>{pct(o.iou)}</b></li>)}</ul>
   <small>Placement: {quality.placement.moved} adjusted, {quality.placement.tilted} rested on their base.{quality.plan?` Meta plans ${quality.plan.planned}, samples ${quality.plan.samples}, refined outlines ${quality.plan.masks}.`:""}</small>
  </div>}
  {quality&&<details className="panel-details"><summary>Quality details</summary>{quality.objects.map(o=><div key={o.id}><p><b>{o.label}</b>: geometry {o.geometry}{o.coverage?` · surface from photo ${pct(o.coverage.observed)}, generated ${pct(o.coverage.generated)}, provider ${pct(o.coverage.inferred)}${o.coverage.unmapped>0?`, unmapped ${pct(o.coverage.unmapped)}`:""}`:" · texture kept"}</p>{o.notes.map(n=><p key={n}>{n}</p>)}</div>)}{quality.spark&&<p>Meta review: {quality.spark}</p>}<p>Hidden surfaces are plausible completions, not recovered detail. Scale is relative; no real measurements are implied.</p></details>}
  {quality&&<button className="text-link panel-link" disabled={disabled} onClick={onRestore}><Undo2 size={13}/>Restore previous models</button>}
  {matched&&<details className="panel-details"><summary>Inspect meshes</summary>
   <label className="field-label">Object<select value={inspect} onChange={e=>setInspect(e.target.value)}>{data.objects.filter(o=>o.modelUrl).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
   <p>{views.map(([mode,label,view])=><a key={label} className="text-link" href={`${base}?objectId=${inspect}&mode=${mode}&view=${view}`} target="_blank" rel="noreferrer">{label} </a>)}<a className="text-link" href={`${base}?mode=unlit`} target="_blank" rel="noreferrer">Photo camera</a>{quality&&<> · <a className="text-link" href={`${base}?objectId=${inspect}&mode=neutral&source=previous`} target="_blank" rel="noreferrer">Before</a></>}</p>
  </details>}
  <dialog ref={dialog} className="restart-dialog" aria-labelledby="quality-heading"><h2 id="quality-heading">Run the Meta quality pass?</h2>
   <p>Paid Meta calls, each made once with no automatic retry: Muse Spark plans structure, materials and protected markings per object; SAM 3.1 refines an outline only where the plan shows a mask error; Muse Image makes up to eight flat material samples; Muse Spark reviews the final renders. Saved results for unchanged meshes and masks are reused. Geometry stays from SAM 3D Objects.</p>
   <fieldset disabled={disabled}>
    <label className="recovery-check"><input type="checkbox" checked={options.masks} onChange={e=>setOptions(v=>({...v,masks:e.target.checked}))}/>Refine incorrect outlines with SAM 3.1</label>
    <label className="recovery-check"><input type="checkbox" checked={options.materials} onChange={e=>setOptions(v=>({...v,materials:e.target.checked}))}/>Generate material samples with Muse Image</label>
    <label className="recovery-check"><input type="checkbox" checked={options.review} onChange={e=>setOptions(v=>({...v,review:e.target.checked}))}/>Review final renders with Muse Spark</label>
   </fieldset>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="editor-actions"><button className="button button-light" autoFocus disabled={disabled} onClick={()=>dialog.current?.close()}>Cancel</button><button className="button button-dark" disabled={disabled} onClick={async()=>{try{await onPaid(options);dialog.current?.close();}catch(e){setError(e instanceof Error?e.message:"Could not start the quality pass.");}}}>Start paid pass</button></div>
  </dialog>
 </div>;
}
