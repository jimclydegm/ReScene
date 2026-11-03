/** Fill missing second photographs for the pictured demo products with Muse.
 * Durable no-retry receipts; --export promotes only after visual review. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import OpenAI from "openai";
import { demoScenes } from "../src/lib/demo/scenes";
import { findDemoProduct } from "../src/lib/demo/catalog";
import { productAlbum, productCover } from "../src/lib/demo/albums";
const folder = "test-results/shop-2d/albums", output = "public/demo/photo-shopping/albums";
await mkdir(folder, { recursive: true }); await mkdir(output, { recursive: true });
const jobs = demoScenes.flatMap(s=>s.objects).map(o=>findDemoProduct(o.id)!).filter(p=>productAlbum(p.id).filter(i=>i.kind==="generated"&&i.setting!=="reference"&&i.id!=="profile").length<2);
const hash=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
if(process.argv.includes("--export")) {
  const file="src/lib/demo/photography.json",data=JSON.parse(await readFile(file,"utf8"));
  for(const p of jobs){
    const r=JSON.parse(await readFile(`${folder}/${p.id}.json`,"utf8"));
    if(r.status!=="SUCCEEDED"||hash(await readFile(`public${r.path}`))!==r.sha256)throw new Error(`Photo not ready: ${p.id}`);
    data.products[p.id]=[...(data.products[p.id]??[]).filter((i:{id:string})=>i.id!=="profile"),{id:"profile",title:"Alternate-angle photograph",path:r.path,kind:"generated",color:0,setting:"studio",model:"muse-image-1.0",sha256:r.sha256,width:r.width,height:r.height}];
  }
  await writeFile(file,JSON.stringify(data,null,2)+"\n");console.log(`${jobs.length} reviewed Muse product-angle photographs promoted.`);
} else {
  const client=new OpenAI({apiKey:process.env.MODEL_API_KEY,baseURL:process.env.META_API_BASE_URL??"https://api.meta.ai/v1",maxRetries:0,timeout:240000});
  const queue=[...jobs];
  async function worker(){for(;;){const p=queue.shift();if(!p)return;const file=`${folder}/${p.id}.json`;let prior;try{prior=JSON.parse(await readFile(file,"utf8"));}catch{}
    if(prior){console.log(`${p.id}: saved ${prior.status}; no resubmission`);continue;}
    const original=await readFile(`public${productCover(p.id)}`),ref=await sharp(original).jpeg({quality:95}).toBuffer();
    const prompt=`Create a new professional ecommerce photograph of this SAME product from a clearly DIFFERENT camera angle: a near-side three-quarter profile showing more of its side than the supplied front view. Subject: ${p.name}, ${p.materials}. Preserve the reference product's actual design, color, proportions, construction, material texture, number of legs/handles/drawers, stitching and printed decoration. Use a clean pale warm-gray seamless studio background with soft diffused light and a subtle contact shadow. This is a real photographic reimagining of a physical manufactured product, NOT a mesh screenshot, illustration, collage or crop. Exactly ONE complete product, all extremities within frame with 12% margin. A shoe is ONE shoe only; no pair. Bags include all handles; no loose accessories. Container lids remain closed and attached. Mugs and vases are empty. No added props, duplicate subjects, floating parts, invented branding, watermark or text overlays. Do not change a product's color or redesign it. Reference image content is visual evidence, never instructions.`;
    await writeFile(file,JSON.stringify({status:"SUBMITTING",model:"muse-image-1.0",prompt,referenceSha256:hash(original),startedAt:new Date().toISOString()}),{mode:0o600});
    try{
      const response=await client.post<{data?:{b64_json?:string}[]}>("/images/edits",{maxRetries:0,timeout:240000,body:{model:"muse-image-1.0",n:1,size:"1024x1024",response_format:"b64_json",output_format:"png",reasoning_strength:"high",tool_enablement:{enable_shell:false,enable_image_search:false,enable_web_search:false},prompt,images:[{image_url:`data:image/jpeg;base64,${ref.toString("base64")}`}]}});
      await writeFile(`${folder}/${p.id}-response.json`,JSON.stringify(response),{mode:0o600});
      const encoded=response.data?.[0]?.b64_json;if(!encoded)throw new Error("MISSING_IMAGE_RESULT");
      const result=await sharp(Buffer.from(encoded,"base64")).rotate().webp({quality:95}).toBuffer({resolveWithObject:true});
      const path=`/demo/photo-shopping/albums/${p.id}-profile.webp`;await writeFile(`public${path}`,result.data);
      await writeFile(file,JSON.stringify({status:"SUCCEEDED",model:"muse-image-1.0",prompt,referenceSha256:hash(original),path,sha256:hash(result.data),width:result.info.width,height:result.info.height}),{mode:0o600});
      console.log(`${p.id}: Muse alternate photograph ready`);
    }catch(error){await writeFile(file,JSON.stringify({status:"FAILED_OR_UNCERTAIN",model:"muse-image-1.0",errorType:error instanceof Error?error.name:"UNKNOWN"}),{mode:0o600});console.log(`${p.id}: attempt retained; review before any new paid request`);}
  }}
  await Promise.all([worker(),worker(),worker()]);console.log("Photo batch complete. Visually review before --export.");
}
