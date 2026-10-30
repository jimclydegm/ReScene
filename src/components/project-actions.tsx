"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {Trash2,ArchiveRestore} from "lucide-react";
import {apiJson} from "@/lib/client-api";
export function ProjectActions({id,title,revision,archived}:{id:string;title:string;revision:number;archived:boolean}){
 const router=useRouter(),dialog=useRef<HTMLDialogElement>(null);const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function run(){setBusy(true);setError("");try{await apiJson(`/api/scenes/${id}/manage`,{method:"POST",body:JSON.stringify({action:archived?"RESTORE":"DELETE",expectedRevision:revision,confirmed:true})});dialog.current?.close();router.refresh();}catch(e){setError(e instanceof Error?e.message:"Could not update the project.");}finally{setBusy(false);}}
 return <><button className="project-manage-button" onClick={()=>dialog.current?.showModal()} aria-label={`${archived?"Restore":"Delete"} ${title}`}>{archived?<ArchiveRestore size={13}/>:<Trash2 size={13}/>} {archived?"Restore project":"Delete"}</button><dialog className="restart-dialog" ref={dialog} aria-labelledby={`project-action-${id}`} onCancel={e=>{if(busy)e.preventDefault();}}><h2 id={`project-action-${id}`}>{archived?"Restore":"Delete"} this project?</h2><p>{title}</p><p>{archived?"The project will return to your active studio with its saved photo, objects and product details. Previous share links stay revoked; publish again if needed.":"This moves the project to Trash and revokes active share links. Saved photos, models and product details are kept. You can restore the project later."}</p>{error&&<p role="alert" className="form-error">{error}</p>}<div className="editor-actions"><button className="button button-light" disabled={busy} autoFocus onClick={()=>dialog.current?.close()}>Cancel</button><button className="button button-dark" disabled={busy} onClick={run}>{busy?"Working…":archived?"Restore project":"Delete project"}</button></div></dialog></>;
}
