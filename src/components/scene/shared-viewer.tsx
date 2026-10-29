"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Component,useEffect,useState,type ReactNode } from "react";
import { ExternalLink,Box,RotateCcw } from "lucide-react";
import { Logo } from "@/components/logo";
import { apiJson } from "@/lib/client-api";
import type { sharedScene } from "@/lib/services/publication";
import type { RenderObject } from "./types";
type Shared=Awaited<ReturnType<typeof sharedScene>>;
const ModelCanvas=dynamic(()=>import("./model-canvas"),{ssr:false,loading:()=> <div className="canvas-loading">Opening the scene…</div>});
class SharedBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<div className="viewer-error">The 3D scene could not load. Refresh the assets or browse the product details below.</div>:this.props.children;}}
export function SharedViewer({initial,slug}:{initial:Shared;slug:string}){
 const [viewerRetry,setViewerRetry]=useState(0);
 const [data,setData]=useState(initial),[selected,setSelected]=useState(initial.objects[0].id),[unavailable,setUnavailable]=useState(false),[error,setError]=useState("");
 async function refresh(){try{const next=await apiJson<Shared>(`/api/shared/${slug}`);setData(next);setViewerRetry(v=>v+1);setUnavailable(false);setError("");}catch(e){setUnavailable(true);setError(e instanceof Error?e.message:"This scene is unavailable.");}}
 useEffect(()=>{let canceled=false;const run=()=>{void apiJson<Shared>(`/api/shared/${slug}`).then(next=>{if(!canceled){setData(next);setError("");}}).catch(()=>{if(!canceled)setUnavailable(true);});};const timer=setInterval(run,5*60_000);const focus=()=>{if(document.visibilityState==="visible")run();};document.addEventListener("visibilitychange",focus);return()=>{canceled=true;clearInterval(timer);document.removeEventListener("visibilitychange",focus);};},[slug]);
 if(unavailable)return <main className="shell studio-main"><Logo/><h1>This share link is unavailable.</h1><p>{error||"The owner may have revoked this scene, or the connection was interrupted."}</p><button className="button button-light" onClick={refresh}>Check again</button></main>;
 const current=data.objects.find(o=>o.id===selected)??data.objects[0],product=current.product;
 const objects:RenderObject[]=data.objects.map(o=>({id:o.id,label:o.label,modelUrl:o.modelUrl,positionX:0,positionY:0,positionZ:0,yaw:0,scale:1,visible:true,placement:null,worldTransform:o.transform}));
 return <><header className="studio-header shell"><Logo/><span className="shared-badge">INTERACTIVE SHOWROOM</span></header><main className="shell shared-main"><div className="page-heading"><div><span className="eyebrow">EXPLORE THE SCENE</span><h1>{data.title}</h1>{data.description&&<p>{data.description}</p>}</div><span className="pill"><Box size={13}/>{objects.length} objects</span></div>
 <div className="shared-layout"><div><SharedBoundary key={`${viewerRetry}:${objects.map(o=>o.modelUrl).join()}`}><ModelCanvas objects={objects} selected={current.id} onSelect={setSelected} composition={data.composition} lighting={data.lighting} appearance={data.appearance}/></SharedBoundary><p className="preview-caveat">Drag to look around. Select an object to see its details. Geometry, materials and unseen surfaces are approximate; product details are supplied by the scene owner.</p><button className="button button-light" onClick={refresh}><RotateCcw size={14}/>Refresh assets</button>{error&&<p role="alert">{error}</p>}</div>
 <aside className="shared-products"><span className="eyebrow">IN THIS SCENE</span><div className="object-selector">{data.objects.map(o=><button key={o.id} aria-pressed={current.id===o.id} className={current.id===o.id?"selected":""} onClick={()=>setSelected(o.id)}>{o.label}</button>)}</div>
 {product?<article className="merchant-card">{product.imageUrl&&<Image src={product.imageUrl} alt={product.name} width={384} height={384} unoptimized/>}<div>{product.brand&&<small>{product.brand}</small>}<h2>{product.name}</h2>{product.price!==null&&<strong>{new Intl.NumberFormat("en",{style:"currency",currency:product.currency??"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(product.price))}</strong>}{product.description&&<p>{product.description}</p>}{product.productUrl&&<a className="button button-dark button-full" href={product.productUrl} target="_blank" rel="noopener noreferrer">View product<ExternalLink size={14}/></a>}</div></article>:<div className="inspector-note"><strong>{current.label}</strong><p>The owner has not added product details for this object.</p></div>}</aside>
 </div></main></>;
}
