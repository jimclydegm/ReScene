// One saved-data regression pass. No uploads, inference, new QA scenes or permanent deletion.
// --smoke is a read-only bounded production check; it never creates a publication.
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const base=process.env.SMOKE_BASE_URL??'http://localhost:3000',id=process.env.SMOKE_SCENE_ID;
if(!id||!process.env.SMOKE_CREDENTIAL_FILE)throw new Error('Set SMOKE_SCENE_ID to a disposable saved QA project and SMOKE_CREDENTIAL_FILE.');
const c=JSON.parse(await readFile(process.env.SMOKE_CREDENTIAL_FILE,'utf8')),root='/api/scenes/'+id;
const fetchBound=(url,options={})=>fetch(url,{signal:AbortSignal.timeout(45000),...options});
async function login(account){const r=await fetchBound(base+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(account)});assert.equal(r.status,200);await r.text();return r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');}
const owner=await login(c.owner),other=await login(c.other);
const req=(url,method='GET',body,cookie=owner,origin=base)=>fetchBound(base+url,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
async function ok(url,method='GET',body){const r=await req(url,method,body);const data=await r.json();assert(r.status<300,`${method} ${url.split('?')[0]}: HTTP ${r.status} (${data.error?.code??'unknown'})`);return data;}
const initial=await ok(root+'/workspace');assert.equal(initial.status,'READY');
const metadata=(await ok(root)).scene;
if(process.argv.includes('--smoke')){
 const page=await req('/dashboard?filter=READY');assert.equal(page.status,200);assert((await page.text()).includes('Project view'));
 const studio=await req('/scenes/'+id);assert.equal(studio.status,200);const html=await studio.text();for(const text of ['Project details','Publish &amp; share','Discard unsaved changes?','Leave unsaved changes?'])assert(html.includes(text),text);
 assert.equal((await req(root+'/manage','POST',{action:'ARCHIVE',expectedRevision:initial.revision,confirmed:false})).status,400);
 assert.equal((await req(root+'/manage','POST',{action:'ARCHIVE',expectedRevision:initial.revision,confirmed:true},other)).status,404);
 console.log('Production smoke passes: dashboard/search/archive controls, studio recovery/navigation/details markup, manage validation and ownership. No inference or data mutation.');process.exit(0);
}
const edits=o=>({id:o.id,label:o.label,positionX:o.positionX,positionY:o.positionY,positionZ:o.positionZ,yaw:o.yaw,scale:o.scale,visible:o.visible,product:o.product?{...o.product,imageUrl:undefined}:null});
const originals=initial.objects.filter(o=>o.modelUrl).map(edits),first=originals[0];assert(first);
let publication,archivedRevision=null;
try{
 const updated=await ok(root,'PATCH',{expectedRevision:initial.revision,title:'Bulk release QA — reusable project',description:'Consolidated release verification'});
 assert.equal((await req(root,'PATCH',{expectedRevision:initial.revision,title:'Stale'})).status,409);
 const page=await req('/dashboard?q='+encodeURIComponent('Bulk release QA')+'&filter=READY');const html=await page.text();assert.equal(page.status,200);assert(html.includes(id));assert(html.includes('Archive'));
 const objects=[{...first,positionX:first.positionX+.1,product:{name:'Bulk QA listing',brand:'ReScene QA',description:'Temporary regression fixture, not offered for sale.',price:'123.45',currency:'USD',productUrl:'https://example.com/product'}}];
 await ok(root+'/objects','PATCH',{expectedRevision:updated.scene.revision,objects});let w=await ok(root+'/workspace');assert.equal(w.objects.find(o=>o.id===first.id).product.price,'123.45');
 publication=await ok(root+'/publications','POST',{action:'PUBLISH',expectedRevision:w.revision,confirmed:true});
 const viewer=await req('/api/shared/'+publication.slug,'GET',undefined,'');assert.equal(viewer.status,200);const shared=await viewer.json();assert.equal(shared.objects.find(o=>o.id===first.id).product.price,'123.45');
 const asset=await fetchBound(shared.objects[0].modelUrl,{headers:{Origin:base}});assert.equal(asset.status,200);assert.equal(asset.headers.get('access-control-allow-origin'),base);await asset.arrayBuffer();
 const publishedPage=await req('/dashboard?filter=PUBLISHED&q='+encodeURIComponent('Bulk release QA'));assert((await publishedPage.text()).includes('live '));
 console.log('Saved metadata, filters, merchant edit, snapshot and existing GLB download pass.');
 const body={action:'ARCHIVE',expectedRevision:w.revision,confirmed:true};
 assert.equal((await req(root+'/manage','POST',body,'')).status,401);assert.equal((await req(root+'/manage','POST',body,other)).status,404);assert.equal((await req(root+'/manage','POST',body,owner,'https://untrusted.example')).status,403);assert.equal((await req(root+'/manage','POST',{...body,expectedRevision:w.revision-1})).status,409);assert.equal((await req(root+'/manage','POST',{...body,confirmed:false})).status,400);
 archivedRevision=(await ok(root+'/manage','POST',body)).revision;
 assert.equal((await req(root+'/workspace')).status,404);assert.equal((await req('/api/shared/'+publication.slug,'GET',undefined,'')).status,404);
 const archived=await req('/dashboard?view=archived&q='+encodeURIComponent('Bulk release QA'));const archivedHtml=await archived.text();assert(archivedHtml.includes('Restore project'));assert(archivedHtml.includes(id));
 const active=await req('/dashboard?q='+encodeURIComponent('Bulk release QA'));assert(!(await active.text()).includes('class="project-card"'));
 assert.equal((await req(root+'/manage','POST',{action:'RESTORE',expectedRevision:archivedRevision,confirmed:true},other)).status,404);
 await ok(root+'/manage','POST',{action:'RESTORE',expectedRevision:archivedRevision,confirmed:true});archivedRevision=null;
 w=await ok(root+'/workspace');assert.equal(w.status,'READY');assert.deepEqual(w.objects.map(o=>o.placement),initial.objects.map(o=>o.placement));assert.equal(new URL(w.image.url).pathname,new URL(initial.image.url).pathname);assert.equal((await req('/api/shared/'+publication.slug,'GET',undefined,'')).status,404);
 console.log('Archive/restore, asset preservation, permanent share revocation and authorization/revision guards pass.');
}finally{
 if(archivedRevision!==null)await ok(root+'/manage','POST',{action:'RESTORE',expectedRevision:archivedRevision,confirmed:true});
 if(publication)await req(root+'/publications','POST',{action:'REVOKE',publicationId:publication.id});
 let w=await ok(root+'/workspace');await ok(root+'/objects','PATCH',{expectedRevision:w.revision,objects:originals});w=await ok(root+'/workspace');await ok(root,'PATCH',{expectedRevision:w.revision,title:metadata.title,description:metadata.description});
}
console.log('Combined saved-data release check passed. Original QA metadata restored. Zero inference submissions.');process.exit(0);
