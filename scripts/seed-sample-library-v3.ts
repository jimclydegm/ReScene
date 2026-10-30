import{config}from"dotenv";import{readFile}from"node:fs/promises";import{join}from"node:path";import{createHash}from"node:crypto";config({path:".env.local",quiet:true});
const {getDb}=await import("../src/lib/db");
type Sample={key:string;label:string;kind:"setting"|"product";category?:string;aspect:string;path:string;prompt:string;model:string;width:number;height:number;sha256:string;generatedAt:string};
const samples=JSON.parse(await readFile(join(process.cwd(),"public/samples/v3/provenance.json"),"utf8")) as Sample[];
if(samples.length!==30||new Set(samples.map(s=>s.key)).size!==30)throw new Error("Expected thirty distinct versioned assets");
for(const s of samples){if(s.path!==`/samples/v3/${s.key}.webp`)throw new Error("Invalid sample path");const bytes=await readFile(join(process.cwd(),"public",s.path.slice(1)));if(createHash("sha256").update(bytes).digest("hex")!==s.sha256)throw new Error("Sample content differs from provenance");}
const db=getDb();await db.$transaction(async tx=>{
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172641)`;
 const existing=await tx.contentItem.findMany({where:{sampleKey:{in:samples.map(s=>`${s.key}:v3`)}}});
 for(const s of samples){const old=existing.find(o=>o.sampleKey===`${s.key}:v3`);if(old&&(old.publicPath!==s.path||old.title!==s.label||!old.provenance||typeof old.provenance!=="object"||Array.isArray(old.provenance)||old.provenance.sha256!==s.sha256))throw new Error("Immutable sample already differs");}
 const missing=samples.filter(s=>!existing.some(o=>o.sampleKey===`${s.key}:v3`));
 if(missing.length)await tx.contentItem.createMany({data:missing.map(s=>({sampleKey:`${s.key}:v3`,title:s.label,category:s.category??"Settings",kind:s.kind==="product"?"SAMPLE":"SETTING",publicPath:s.path,provenance:{source:"meta-generated-sample",version:3,...s}}))});
},{timeout:20000});console.log("Registered 15 product samples and 15 setting references; existing items preserved.");await db.$disconnect();
