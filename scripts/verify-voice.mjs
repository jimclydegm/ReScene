// Read-only release check: no audio/model submission or saved-scene mutation.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const base=process.env.SMOKE_BASE_URL??"http://localhost:4317",scripts=new Set(),styles=new Set();
const request=(path,options={})=>fetch(base+path,{...options,redirect:"manual",signal:AbortSignal.timeout(30000)});
for(const path of ["/demo/products","/demo/space","/demo/shop-the-scene"]){
 const r=await request(path);assert.equal(r.status,200);assert(r.headers.get("permissions-policy").includes("microphone=(self)"));const html=await r.text();
 if(path==="/demo/products")assert(html.includes("Voice search"));if(path==="/demo/shop-the-scene")assert(html.includes("Voice controls"));
 for(const m of html.matchAll(/<script[^>]*src="([^\"]+)"/g))if(m[1].startsWith("/_next/static/"))scripts.add(m[1]);
 for(const m of html.matchAll(/<link[^>]*href="([^\"]+)"[^>]*rel="stylesheet"/g))if(m[1].startsWith("/_next/static/"))styles.add(m[1]);
 for(const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^\"]+)"/g))if(m[1].startsWith("/_next/static/"))styles.add(m[1]);
}
let delivered="";for(const path of scripts){const r=await request(path);assert.equal(r.status,200);delivered+=await r.text();}
for(const label of ["Muse Voice Transcribe","Voice controls","Review scene changes","Review voice changes","Apply changes","/api/voice/transcribe","/api/voice/commands","Upload WAV"])assert(delivered.includes(label),label);
let css="";for(const path of styles){const r=await request(path);assert.equal(r.status,200);css+=await r.text();}for(const selector of [".voice-dialog",".voice-trigger",".voice-change-list"])assert(css.includes(selector));
let r=await request("/voice/recorder-v1.js");assert.equal(r.status,200);assert((await r.text()).includes("AudioWorkletProcessor"));
const root="/api/voice/transcribe",key="3437ef28-419c-40f6-9f62-fbd97fe9072e";
r=await request(root+"?purpose=search&key="+key);assert.equal(r.status,404);assert(r.headers.get("cache-control").includes("no-store"));assert(r.headers.getSetCookie().some(c=>c.includes("HttpOnly")&&c.includes("SameSite=strict")));
r=await request(root+"?purpose=creative&key="+key);assert.equal(r.status,401);
r=await request(root,{method:"POST",headers:{Origin:"https://untrusted.example"}});assert.equal(r.status,403);
r=await request(root,{method:"POST",headers:{Origin:base,"Content-Type":"multipart/form-data; boundary=invalid"},body:"broken multipart"});assert.equal(r.status,400);
r=await request("/api/voice/commands",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:"{}"});assert.equal(r.status,400);
if(process.env.VOICE_SESSION_FILE){
 const {cookie,sceneId}=JSON.parse(await readFile(process.env.VOICE_SESSION_FILE,"utf8"));
 let text="";const urls=new Set();for(const path of ["/scenes/create","/scenes/"+sceneId]){r=await request(path,{headers:{Cookie:cookie}});assert.equal(r.status,200);const html=await r.text();for(const m of html.matchAll(/<script[^>]*src="([^\"]+)"/g))if(m[1].startsWith("/_next/static/"))urls.add(m[1]);}
 for(const path of urls){r=await request(path);assert.equal(r.status,200);text+=await r.text();}
 for(const label of ["creative direction","background design","analysis focus"])assert(text.includes(label),label);
 r=await request(root+"?purpose=creative&key="+key,{headers:{Cookie:cookie}});assert.equal(r.status,404);
}
console.log("Voice delivery/recording asset, prompt/demo controls, microphone policy, identity/auth/origin and invalid-input guards pass. No inference or saved-scene writes.");
