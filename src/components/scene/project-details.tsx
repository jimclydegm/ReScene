"use client";
import {useRouter} from "next/navigation";
import {useRef,useState} from "react";
import {Pencil} from "lucide-react";
import {apiJson} from "@/lib/client-api";
export function ProjectDetails({id,title,description,revision,disabled,onSaved}:{id:string;title:string;description:string|null;revision:number;disabled:boolean;onSaved?:()=>Promise<unknown>}){
 const router=useRouter();
 const dialog=useRef<HTMLDialogElement>(null),[name,setName]=useState(title),[detail,setDetail]=useState(description??""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 function open(){setName(title);setDetail(description??"");setError("");dialog.current?.showModal();}
 async function save(){setBusy(true);setError("");try{await apiJson(`/api/scenes/${id}`,{method:"PATCH",body:JSON.stringify({expectedRevision:revision,title:name,description:detail||null})});if(onSaved)await onSaved();else router.refresh();dialog.current?.close();}catch(e){setError(e instanceof Error?e.message:"Could not save project details.");}finally{setBusy(false);}}
 return <><button className="button button-light" disabled={disabled} onClick={open}><Pencil size={14}/>Project details</button><dialog className="restart-dialog" ref={dialog} aria-labelledby="project-details-title" onCancel={e=>{if(busy)e.preventDefault();}}><h2 id="project-details-title">Project details</h2><div className="product-fields"><label>Scene name<input value={name} maxLength={160} disabled={busy} onChange={e=>setName(e.target.value)}/></label><label>Description<textarea value={detail} rows={4} maxLength={2000} disabled={busy} onChange={e=>setDetail(e.target.value)}/></label></div><p>These details appear on future snapshots. Already published snapshots stay unchanged.</p>{error&&<p role="alert" className="form-error">{error}</p>}<div className="editor-actions"><button className="button button-light" disabled={busy} onClick={()=>dialog.current?.close()}>Cancel</button><button className="button button-dark" disabled={busy||!name.trim()} onClick={save}>{busy?"Saving…":"Save details"}</button></div></dialog></>;
}
