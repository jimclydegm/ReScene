// Explicit disposable QA scene only. Publishes temporary unlisted snapshots, revokes all test links.
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const base=process.env.SMOKE_BASE_URL??'http://localhost:3000',id=process.env.SMOKE_SCENE_ID;
if(!id)throw new Error('Set SMOKE_SCENE_ID to a disposable QA scene.');
const c=JSON.parse(await readFile(process.env.SMOKE_CREDENTIAL_FILE,'utf8'));
const fetchBound=(url,options={})=>fetch(url,{signal:AbortSignal.timeout(60000),...options});
async function login(account){const r=await fetchBound(base+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(account)});assert.equal(r.status,200);await r.text();return r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');}
const cookie=await login(c.owner),other=await login(c.other),root='/api/scenes/'+id;
async function req(path,method='GET',body,c=cookie,origin=base){return fetchBound(base+path,{method,headers:{Cookie:c,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
async function workspace(){const r=await req(root+'/workspace');assert.equal(r.status,200);return r.json();}
const initial=await workspace(),original=initial.objects.find(o=>o.modelUrl);assert(original);
const fields=o=>({id:o.id,label:o.label,positionX:o.positionX,positionY:o.positionY,positionZ:o.positionZ,yaw:o.yaw,scale:o.scale,visible:o.visible,product:o.product?{...o.product,imageUrl:undefined}:null});
const originals=initial.objects.filter(o=>o.modelUrl).map(fields),publications=[];
try{
 const save=await req(root+'/objects','PATCH',{expectedRevision:initial.revision,objects:[{...fields(original),product:{name:'Frozen QA listing',brand:'ReScene QA',description:'Merchant details for frozen snapshot',price:'49.95',currency:'USD',productUrl:'https://example.com/product'}}]});assert.equal(save.status,200);let w=await workspace();
 const body={action:'PUBLISH',expectedRevision:w.revision,confirmed:true};
 assert.equal((await req(root+'/publications','POST',body,'')).status,401);assert.equal((await req(root+'/publications','POST',body,other)).status,404);assert.equal((await req(root+'/publications','POST',body,cookie,'https://untrusted.example')).status,403);assert.equal((await req(root+'/publications','POST',{...body,confirmed:false})).status,400);assert.equal((await req(root+'/publications','POST',{...body,assetIds:[randomUUID()]})).status,400);assert.equal((await req(root+'/publications','POST',{...body,expectedRevision:w.revision-1})).status,409);
 const r=await req(root+'/publications','POST',body);assert.equal(r.status,200,await r.clone().text());const publication=await r.json();publications.push(publication);
 const repeat=await(await req(root+'/publications','POST',body)).json();assert.equal(repeat.slug,publication.slug,'Revision publish idempotency');
 const read=()=>req('/api/shared/'+publication.slug,'GET',undefined,'');let response=await read();assert.equal(response.status,200);assert(response.headers.get('cache-control').includes('no-store'));assert.equal(response.headers.get('referrer-policy'),'no-referrer');const frozen=await response.json();assert.equal(frozen.objects.find(o=>o.id===original.id).product.price,'49.95');
 const text=JSON.stringify(frozen);for(const secret of ['sourceAssetId','maskUrl','storageKey','ownerId','authSubject','replacementBackup','rawResponse','normalizedAssetId'])assert(!text.includes(secret),'Raw/editor data leaked');assert(!text.includes(initial.image.url.split('?')[0]),'Source photo leaked');
 for(const object of frozen.objects){const model=await fetchBound(object.modelUrl,{headers:{Origin:base}});assert.equal(model.status,200);assert.equal(model.headers.get('access-control-allow-origin'),base);await model.arrayBuffer();}
 for(const url of [frozen.appearance.floorUrl,frozen.appearance.wallUrl,...frozen.objects.map(o=>o.product?.imageUrl)].filter(Boolean)){const image=await fetchBound(url);assert.equal(image.status,200);await image.arrayBuffer();}
 const page=await req('/s/'+publication.slug,'GET',undefined,'');assert.equal(page.status,200);const html=await page.text();assert(html.includes('Frozen QA listing'));assert(!html.includes('Publish snapshot'));assert(!html.includes('Save changes'));assert(!html.includes('Reference photo'));assert(html.includes('noindex'));assert.equal(page.headers.get('referrer-policy'),'no-referrer');
 w=await workspace();assert.equal((await req(root+'/objects','PATCH',{expectedRevision:w.revision,objects:[{...fields(w.objects.find(o=>o.id===original.id)),positionX:original.positionX+.3,product:{name:'Changed live listing',brand:'QA',description:'Changed after publication',price:'99.95',currency:'USD',productUrl:'https://example.com/changed'}}]})).status,200);
 w=await workspace();const catalog=(await(await req(root+'/catalog')).json()).products;assert(catalog.length);assert.equal((await req(root+'/replacement','POST',{action:'REPLACE',expectedRevision:w.revision,objectId:original.id,productId:catalog[0].id})).status,200);
 const unchanged=await(await read()).json();assert.deepEqual(unchanged.objects.map(o=>o.transform),frozen.objects.map(o=>o.transform));assert.equal(unchanged.objects.find(o=>o.id===original.id).product.price,'49.95');assert.equal(new URL(unchanged.objects.find(o=>o.id===original.id).modelUrl).pathname,new URL(frozen.objects.find(o=>o.id===original.id).modelUrl).pathname);
 assert.equal((await req(root+'/publications','POST',{action:'REVOKE',publicationId:publication.id},other)).status,404);assert.equal((await req(root+'/publications','POST',{action:'REVOKE',publicationId:publication.id})).status,200);assert.equal((await read()).status,404);const revokedPage=await req('/s/'+publication.slug,'GET',undefined,'');assert([200,404].includes(revokedPage.status));const revokedHtml=await revokedPage.text();assert(revokedHtml.includes('This share link is unavailable.'));assert(!revokedHtml.includes('Frozen QA listing')); // Next streamed notFound responses can use HTTP 200.
 console.log('Publication checks pass: frozen products/transforms/assets survive draft edits and replacement, anonymous page and real GLB/CORS downloads, exact render allowlist/no source data, owner/origin/stale/confirmation guards, idempotency and revoke.');
}finally{
 for(const p of publications)await req(root+'/publications','POST',{action:'REVOKE',publicationId:p.id});
 let w=await workspace();if(w.objects.find(o=>o.id===original.id).canRestoreOriginal){const r=await req(root+'/replacement','POST',{action:'RESTORE',expectedRevision:w.revision,objectId:original.id});assert.equal(r.status,200);w=await workspace();}
 assert.equal((await req(root+'/objects','PATCH',{expectedRevision:w.revision,objects:originals})).status,200,'Restore disposable metadata');
}
process.exit(0);
