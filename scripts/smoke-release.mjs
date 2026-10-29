// Explicit paid release check. One analysis and one two-object reconstruction, no auto retries.
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const credentials=JSON.parse(await readFile(process.env.SMOKE_CREDENTIAL_FILE,'utf8'));
const base=process.env.SMOKE_BASE_URL??'https://rescene-eta.vercel.app',file=process.env.RELEASE_STATE_FILE??'test-results/release-qa.json',phase=process.argv[2]??'status';
const sign=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(credentials.owner)});assert.equal(sign.status,200);await sign.text();const cookie=sign.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
async function req(path,method='GET',body){const r=await fetch(base+path,{signal:AbortSignal.timeout(60000),method,headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert(r.status<300,`HTTP ${r.status}: ${data.error?.code??'request failed'}`);return data;}
let state;
if(phase==='prepare'){
 const bytes=await readFile(process.env.RELEASE_INPUT_FILE??'test-results/texture-target/source.webp');
 const created=await req('/api/scenes','POST',{title:'Release QA — fresh chair and cabinet'});state={sceneId:created.scene.id,base,analysisKey:randomUUID(),reconstructKey:randomUUID(),startedAt:Date.now(),timings:{}};await writeFile(file,JSON.stringify(state),{mode:0o600});
 const root='/api/scenes/'+state.sceneId,upload=await req(root+'/uploads','POST',{expectedRevision:0,contentType:'image/webp',byteSize:bytes.length});const put=await fetch(upload.uploadUrl,{method:'PUT',headers:upload.headers,body:bytes});assert.equal(put.status,200);await put.text();await req(root+'/uploads/'+upload.assetId+'/complete','POST',{expectedRevision:0});let w=await req(root+'/workspace');
 const body={kind:'ANALYZE',expectedRevision:w.revision,idempotencyKey:state.analysisKey};const a=await req(root+'/runs','POST',body),b=await req(root+'/runs','POST',body);assert.equal(a.runId,b.runId);state.timings.analysisStarted=Date.now();
}else{
 state=JSON.parse(await readFile(file,'utf8'));assert.equal(state.base,base);const root='/api/scenes/'+state.sceneId;let w=await req(root+'/workspace');
 if(phase==='reconstruct'){
  assert.equal(w.status,'REVIEW');const ids=w.objects.filter(o=>o.maskUrl).slice(0,2).map(o=>o.id);assert.equal(ids.length,2,'Need two reviewed masks');state.timings.analysisReady=Date.now();
  const body={kind:'RECONSTRUCT',expectedRevision:w.revision,idempotencyKey:state.reconstructKey,objectIds:ids};const a=await req(root+'/runs','POST',body),b=await req(root+'/runs','POST',body);assert.equal(a.runId,b.runId);state.timings.reconstructionStarted=Date.now();
 }else if(phase==='finish'){
  assert.equal(w.status,'READY');state.timings.reconstructionReady=Date.now();
  const object=w.objects.find(o=>o.modelUrl);assert(object);const edits={id:object.id,label:object.label,positionX:object.positionX+.1,positionY:object.positionY,positionZ:object.positionZ,yaw:object.yaw,scale:object.scale,visible:true,product:{name:'Release QA listing',description:'Merchant-entered release check',brand:'ReScene QA',price:'49.95',currency:'USD',productUrl:'https://example.com/product'}};
  await req(root+'/objects','PATCH',{expectedRevision:w.revision,objects:[edits]});w=await req(root+'/workspace');assert.equal(w.objects.find(o=>o.id===object.id).product.price,'49.95');
  await req(root+'/catalog','POST',{expectedRevision:w.revision});w=await req(root+'/workspace');const items=(await req(root+'/catalog')).products;
  await req(root+'/replacement','POST',{action:'REPLACE',expectedRevision:w.revision,objectId:object.id,productId:items[0].id});w=await req(root+'/workspace');assert(w.objects.find(o=>o.id===object.id).canRestoreOriginal);
  const placed=w.objects.find(o=>o.id===object.id);await req(root+'/objects','PATCH',{expectedRevision:w.revision,objects:[{id:placed.id,label:placed.label,positionX:placed.positionX,positionY:placed.positionY,positionZ:placed.positionZ,yaw:placed.yaw,scale:placed.scale,visible:true,product:{...placed.product,imageUrl:undefined,price:'59.95',productUrl:'https://example.com/product',description:'Release QA demonstration listing; not offered for sale.'}}]});w=await req(root+'/workspace');
  const published=await req(root+'/publications','POST',{action:'PUBLISH',expectedRevision:w.revision,confirmed:true});
  const anonymous=await fetch(base+'/api/shared/'+published.slug);assert.equal(anonymous.status,200);const shared=await anonymous.json();assert(shared.objects.length>=2);assert(shared.objects.some(o=>o.product?.name===items[0].name&&o.product.price==='59.95'));
  for(const object of shared.objects){const glb=await fetch(object.modelUrl,{headers:{Origin:base}});assert.equal(glb.status,200);assert.equal(glb.headers.get('access-control-allow-origin'),base);const bytes=Buffer.from(await glb.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'glTF');}
  await req(root+'/publications','POST',{action:'REVOKE',publicationId:published.id});assert.equal((await fetch(base+'/api/shared/'+published.slug)).status,404);state.timings.finished=Date.now();state.completed=true;
 }
 w=await req(root+'/workspace');console.log(JSON.stringify({phase,sceneId:state.sceneId,status:w.status,stage:w.run?.stage,progress:w.run?.progress,readyModels:w.objects.filter(o=>o.modelUrl).length,completed:state.completed??false}));
}
await writeFile(file,JSON.stringify(state),{mode:0o600});if(phase==='prepare')console.log('Fresh release analysis submitted once; checkpoint saved.');process.exit(0);
