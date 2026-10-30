"use client";
import {useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {Upload,Images,Sparkles,ArrowUpRight,ArrowLeft} from "lucide-react";
import {UploadForm} from "./upload-form";
import {CreativeStudio} from "./creative-studio";
export function NewSceneStart(){const [tab,setTab]=useState<'upload'|'library'>('upload');return <div className="start-workspace"><header className="creator-header"><Link className="back-icon" href="/dashboard" aria-label="Back to your scenes" title="Back to your scenes"><ArrowLeft size={16}/></Link><div><h1>New scene</h1><p>Start from a photo you have, or generate one from product images.</p></div></header>
<div className="start-choices"><section className="start-existing"><div className="card-head"><h2>Start with a photo</h2><div className="creation-tabs" role="group" aria-label="Photo source"><button aria-pressed={tab==='upload'} onClick={()=>setTab('upload')}><Upload size={13}/>Upload</button><button aria-pressed={tab==='library'} onClick={()=>setTab('library')}><Images size={13}/>Generated library</button></div></div>{tab==='upload'?<UploadForm/>:<CreativeStudio galleryOnly/>}</section>
<Link className="start-create" href="/scenes/create"><div className="start-preview"><Image width={640} height={420} src="/samples/v2/lifestyle.webp" alt="Sunlit photographic scene template"/><span><Sparkles size={13}/>Image studio</span></div><div className="start-create-body"><h2>Create your own photo</h2><p>Pick products and a setting, then generate a new scene image.</p><span className="button button-dark button-small">Open image studio <ArrowUpRight size={14}/></span></div></Link></div>
<p className="start-footnote">Private to your account · Review object outlines before building in 3D · Clear, fully visible products work best.</p></div>;}
