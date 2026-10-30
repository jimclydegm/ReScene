"use client";
import {useEffect,useRef,useState} from "react";
import { Share2,Copy,ExternalLink,X } from "lucide-react";
import { apiJson } from "@/lib/client-api";
type Publication={id:string;slug:string;revision:number;publishedAt:string;revokedAt:string|null};
/** Top-bar Share button; publishing, copying and revoking happen in one dialog. */
export function PublicationControls({sceneId,revision,disabled}:{sceneId:string;revision:number;disabled:boolean}){
 const [items,setItems]=useState<Publication[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const dialog=useRef<HTMLDialogElement>(null),base=`/api/scenes/${sceneId}/publications`;
 useEffect(()=>{let canceled=false;void apiJson<{publications:Publication[]}>(base).then(r=>{if(!canceled)setItems(r.publications);}).catch(()=>{if(!canceled)setError("Could not load share links. Reload the scene to retry.");});return()=>{canceled=true;};},[base]);
 async function action(body:unknown,done:string){setBusy(true);setError("");setMessage("");try{await apiJson(base,{method:"POST",body:JSON.stringify(body)});setItems((await apiJson<{publications:Publication[]}>(base)).publications);setMessage(done);}catch(e){setError(e instanceof Error?e.message:"Could not update sharing.");}finally{setBusy(false);}}
 const active=items.filter(p=>!p.revokedAt),current=active.some(p=>p.revision===revision);
 return <>
  <button className="button button-dark button-small" onClick={()=>{setMessage("");dialog.current?.showModal();}}><Share2 size={14}/>Share{active.length>0&&<span className="share-count" aria-label={`${active.length} active links`}>{active.length}</span>}</button>
  <dialog ref={dialog} id="publish-scene" className="restart-dialog share-dialog" aria-labelledby="publish-heading" onCancel={e=>{if(busy)e.preventDefault();}}>
   <div className="dialog-heading"><h2 id="publish-heading">Share a read-only snapshot</h2><button className="icon-button" aria-label="Close" disabled={busy} onClick={()=>dialog.current?.close()}><X size={16}/></button></div>
   <p>Anyone with the link can view and download the visible 3D objects, scene textures, the photo-derived background, product thumbnails and your product details, including the scene title. Review the background before publishing. Source photos, masks and generation records stay private.</p>
   <p>Later edits don&apos;t change a snapshot. Revoking stops new access; issued asset links can work for up to 15 minutes and downloaded copies can&apos;t be recalled.</p>
   {active.length>0&&<div className="publication-list">{active.map(p=><div key={p.id}><span>Revision {p.revision}<small>{p.revision===revision?"Current saved scene":"Earlier snapshot"}</small></span><a className="icon-button" href={`/s/${p.slug}`} target="_blank" rel="noopener noreferrer" title="Open viewer" aria-label="Open viewer"><ExternalLink size={14}/></a><button className="icon-button" disabled={busy} title="Copy link" aria-label="Copy link" onClick={()=>{void navigator.clipboard.writeText(`${window.location.origin}/s/${p.slug}`).then(()=>setMessage("Share link copied.")).catch(()=>setError("Copy failed. Open the viewer and copy its URL."));}}><Copy size={14}/></button><button className="button button-light button-small" disabled={busy} onClick={()=>action({action:"REVOKE",publicationId:p.id},"Link revoked.")}>Revoke</button></div>)}</div>}
   {message&&<p role="status" className="save-message">{message}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
   {disabled&&<p className="panel-note">Save your changes before publishing.</p>}
   <div className="editor-actions"><button className="button button-light" autoFocus disabled={busy} onClick={()=>dialog.current?.close()}>Keep private</button><button className="button button-dark" disabled={busy||disabled} onClick={()=>action({action:"PUBLISH",expectedRevision:revision,confirmed:true},"Snapshot published. Copy the link above.")}><Share2 size={14}/>{busy?"Publishing…":current?"Publish again":"Publish snapshot"}</button></div>
  </dialog>
 </>;
}
