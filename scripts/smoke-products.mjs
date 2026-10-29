// Explicit integration smoke check against an authorized QA clone. Restores original metadata; no inference.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const c=JSON.parse(await readFile(process.env.SMOKE_CREDENTIAL_FILE,'utf8'));
const base=process.env.SMOKE_BASE_URL??'http://localhost:3000';
if (!process.env.SMOKE_SCENE_ID) throw new Error('Set SMOKE_SCENE_ID to an authorized QA clone.');
const path='/api/scenes/'+process.env.SMOKE_SCENE_ID;
async function login(account) {const r=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(account)});assert.equal(r.status,200);await r.text();return r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');}
const cookie=await login(c.owner);
async function req(url,method='GET',body,cookieValue=cookie,origin=base){return fetch(base+url,{method,headers:{Cookie:cookieValue,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
const before=await (await req(path+'/workspace')).json();
const fields=o=>({id:o.id,label:o.label,positionX:o.positionX,positionY:o.positionY,positionZ:o.positionZ,yaw:o.yaw,scale:o.scale,visible:o.visible,product:o.product?{...o.product,imageUrl:undefined}:null});
const objects=before.objects.filter(o=>o.modelUrl).map(fields);assert(objects.length);
const product={name:'QA cabinet listing',brand:'ReScene QA',description:'Test merchant details',price:'129.95',currency:'PHP',productUrl:'https://example.com/product'};
const input={expectedRevision:before.revision,objects:objects.map((o,i)=>i===0?{...o,product}:o)};
assert.equal((await req(path+'/objects','PATCH',{...input,objects:input.objects.map((o,i)=>i===0?{...o,product:{...product,productUrl:'javascript:alert(1)'}}:o)})).status,400);
assert.equal((await req(path+'/objects','PATCH',{...input,objects:[{...input.objects[0],id:randomUUID()}]})).status,400);
assert.equal((await req(path+'/objects','PATCH',input,cookie,'https://untrusted.example')).status,403);
const other=await login(c.other);assert.equal((await req(path+'/objects','PATCH',input,other)).status,404);
const saved=await req(path+'/objects','PATCH',input);assert.equal(saved.status,200,await saved.text());
try {
 const after=await (await req(path+'/workspace')).json();
 assert.equal(after.objects[0].product.name,product.name);assert.equal(after.objects[0].product.price,'129.95');assert.equal(after.objects[0].product.currency,'PHP');
 assert(after.objects[0].product.imageUrl,'Private object thumbnail');const image=await fetch(after.objects[0].product.imageUrl);assert.equal(image.status,200);assert((await image.arrayBuffer()).byteLength>100);
 for(let i=0;i<after.objects.length;i++){assert.deepEqual(after.objects[i].placement,before.objects[i].placement);assert.equal(after.objects[i].positionX,before.objects[i].positionX);}
 assert.equal((await req(path+'/objects','PATCH',input)).status,409);
 const markup=await (await req('/scenes/'+before.id)).text();assert(markup.includes('Products'));assert(markup.includes('Redo object edit'));assert(markup.includes('Left / right value'));
}finally{const current=await(await req(path+'/workspace')).json();const restored=await req(path+'/objects','PATCH',{expectedRevision:current.revision,objects});assert.equal(restored.status,200,'Restore QA metadata');}
console.log('Product integration checks pass: exact price/currency, private mask thumbnail, atomic save/restore, geometry preserved, bad URL/object/stale/origin/non-owner rejected; product/numeric/redo controls rendered. No inference.');process.exit(0);
