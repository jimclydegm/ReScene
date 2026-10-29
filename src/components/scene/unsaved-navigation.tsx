"use client";
import {useEffect,useRef} from "react";
import {useRouter} from "next/navigation";
export function UnsavedNavigation({dirty}:{dirty:boolean}){
 const router=useRouter(),dialog=useRef<HTMLDialogElement>(null),proceed=useRef<(()=>void)|null>(null);
 useEffect(()=>{
  if(!dirty)return;
  const intercept=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=(event.target as Element).closest<HTMLAnchorElement>("a[href]");if(!link||link.target==="_blank"||link.hasAttribute("download"))return;const url=new URL(link.href,window.location.href);if(url.origin!==window.location.origin||url.pathname===window.location.pathname&&url.search===window.location.search)return;event.preventDefault();event.stopImmediatePropagation();proceed.current=()=>router.push(url.pathname+url.search+url.hash);dialog.current?.showModal();};
  const navigation=(event:Event)=>{event.preventDefault();proceed.current=(event as CustomEvent<{proceed:()=>void}>).detail.proceed;dialog.current?.showModal();};
  document.addEventListener("click",intercept,true);window.addEventListener("rescene:confirm-navigation",navigation);
  return()=>{document.removeEventListener("click",intercept,true);window.removeEventListener("rescene:confirm-navigation",navigation);};
 },[dirty,router]);
 return <dialog ref={dialog} className="restart-dialog" aria-labelledby="leave-scene-title"><h2 id="leave-scene-title">Leave unsaved changes?</h2><p>Your saved scene is safe. These layout, lighting or product edits have not been saved yet.</p><div className="editor-actions"><button className="button button-light" autoFocus onClick={()=>dialog.current?.close()}>Keep editing</button><button className="button button-dark" onClick={()=>{dialog.current?.close();proceed.current?.();}}>Leave without saving</button></div></dialog>;
}
