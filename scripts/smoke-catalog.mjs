// Explicit QA clone check. Replaces objects then restores originals; no inference.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const credentials=JSON.parse(await readFile(process.env.SMOKE_CREDENTIAL_FILE,'utf8'));
const base=process.env.SMOKE_BASE_URL??'http://localhost:3000';
if(!process.env.SMOKE_SCENE_ID)throw new Error('Set SMOKE_SCENE_ID to an authorized QA clone.');
const root='/api/scenes/'+process.env.SMOKE_SCENE_ID;
const boundedFetch=(url,options={})=>fetch(url,{signal:AbortSignal.timeout(45000),...options});
async function login(account){const r=await boundedFetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(account)});assert.equal(r.status,200);await r.text();return r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');}
const owner=await login(credentials.owner),other=await login(credentials.other);
async function req(path,method='GET',body,cookie=owner,origin=base){return boundedFetch(base+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
const workspace=async()=>{const r=await req(root+'/workspace');assert.equal(r.status,200);return r.json();};
let initial=await workspace();
let result=await req(root+'/catalog');assert.equal(result.status,200);let items=(await result.json()).products;
if(!items.length){assert.equal((await req(root+'/catalog','POST',{expectedRevision:initial.revision})).status,200);initial=await workspace();items=(await(await req(root+'/catalog')).json()).products;}
assert.equal(items.length,3);console.log('Catalog available; checking ownership and replacement safety.');
assert.equal((await req(root+'/catalog','GET',undefined,other)).status,404);
let original=initial.objects.find(o=>o.modelUrl);assert(original);assert(!original.canRestoreOriginal,'Start with an original QA object');
const hash=async url=>{const r=await boundedFetch(url);assert.equal(r.status,200);return createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');};
const hadProduct=Boolean(original.product);
const objectEdit=o=>({id:o.id,label:o.label,positionX:o.positionX,positionY:o.positionY,positionZ:o.positionZ,yaw:o.yaw,scale:o.scale,visible:o.visible});
if(!hadProduct){const r=await req(root+'/objects','PATCH',{expectedRevision:initial.revision,objects:[{...objectEdit(original),product:{name:'Original QA listing',description:'Restore test',brand:'QA',price:'123.45',currency:'USD',productUrl:'https://example.com/product'}}]});assert.equal(r.status,200);initial=await workspace();original=initial.objects.find(o=>o.id===original.id);}
const originalHash=await hash(original.modelUrl);
const body={action:'REPLACE',objectId:original.id,productId:items[0].id,expectedRevision:initial.revision};
assert.equal((await req(root+'/replacement','POST',body,other)).status,404);
assert.equal((await req(root+'/replacement','POST',body,owner,'https://untrusted.example')).status,403);
assert.equal((await req(root+'/replacement','POST',{...body,productId:randomUUID()})).status,400);
assert.equal((await req(root+'/replacement','POST',{...body,objectId:randomUUID()})).status,404);
if(process.env.SMOKE_FOREIGN_SCENE_ID){const foreign=await(await req('/api/scenes/'+process.env.SMOKE_FOREIGN_SCENE_ID+'/catalog')).json();assert(foreign.products.length);assert.equal((await req(root+'/replacement','POST',{...body,productId:foreign.products[0].id})).status,400,'Cross-scene catalog item rejected');}
try{
 for(const item of items){const current=await workspace();const r=await req(root+'/replacement','POST',{...body,productId:item.id,expectedRevision:current.revision});assert.equal(r.status,200,await r.text());const after=await workspace();const object=after.objects.find(o=>o.id===original.id);assert(object.canRestoreOriginal);assert.equal(object.product.name,item.name);assert.equal(object.product.price,null);for(const field of ['positionX','positionY','positionZ','yaw','scale','visible'])assert.equal(object[field],original[field]);assert.notEqual(await hash(object.modelUrl),originalHash);await hash(object.product.imageUrl);console.log('Replacement verified: '+item.name);}
 const copyState=await workspace(),copyObject=copyState.objects.find(o=>o.id===original.id);
 const edit={id:copyObject.id,label:copyObject.label,positionX:copyObject.positionX,positionY:copyObject.positionY,positionZ:copyObject.positionZ,yaw:copyObject.yaw,scale:copyObject.scale,visible:copyObject.visible,product:{...copyObject.product,imageUrl:undefined,name:'QA independent merchant copy',price:'45.50'}};
 assert.equal((await req(root+'/objects','PATCH',{expectedRevision:copyState.revision,objects:[edit]})).status,200);
 const edited=await workspace();assert.equal(edited.objects.find(o=>o.id===original.id).product.price,'45.5');
 assert.equal((await req(root+'/objects','PATCH',{expectedRevision:edited.revision,objects:[{...edit,product:{...edit.product,price:null}}]})).status,200,'Unlisted price and currency stored as a null pair');
 assert.deepEqual((await(await req(root+'/catalog')).json()).products.map(p=>p.name),items.map(p=>p.name),'Merchant edits leave catalog unchanged');
 const current=await workspace();assert.equal((await req(root+'/replacement','POST',body)).status,409);
 for(const action of ['APPLY','RESTORE'])assert.equal((await req(root+'/appearance','POST',{action,expectedRevision:current.revision})).status,409);
 assert.equal((await req(root+'/composition','POST',{action:'MATCH_PHOTO',expectedRevision:current.revision})).status,409);
 assert.equal((await req(root+'/appearance','POST',{action:'LIGHTING',expectedRevision:current.revision,lighting:current.lighting})).status,200,'Lighting remains editable');
}finally{const current=await workspace();if(current.objects.find(o=>o.id===original.id).canRestoreOriginal){const r=await req(root+'/replacement','POST',{action:'RESTORE',objectId:original.id,expectedRevision:current.revision});assert.equal(r.status,200,await r.text());}}
const restored=(await workspace()).objects.find(o=>o.id===original.id);assert.equal(restored.canRestoreOriginal,false);assert.deepEqual(restored.placement,original.placement);assert.deepEqual({...restored.product,imageUrl:null},{...original.product,imageUrl:null});assert.equal(new URL(restored.product.imageUrl).pathname,new URL(original.product.imageUrl).pathname);assert.equal(restored.label,original.label);assert.equal(await hash(restored.modelUrl),originalHash);
if(!hadProduct){const current=await workspace();assert.equal((await req(root+'/objects','PATCH',{expectedRevision:current.revision,objects:[{...objectEdit(restored),product:null}]})).status,200);}
console.log('Catalog checks pass: three original demo GLBs/images, atomic replacements, original model/product/pose restore, saved transforms, invalid/stale/origin/non-owner guards, photo/layout guard and editable lighting. No inference.');process.exit(0);
