/** Offline collision hulls from approved meshes only; no model changes/inference. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {makeClearanceHull} from '../src/lib/quality/clearance-hull';
const file='src/lib/demo/catalog-models.json',models=JSON.parse(await readFile(file,'utf8')),folder='test-results/background-clearance';await mkdir(folder,{recursive:true});
let points=0;
for(const m of models){let bytes:Buffer;try{bytes=await readFile(`${folder}/${m.id}.glb`);}catch{try{bytes=await readFile(`test-results/demo-expansion-v1/approved/${m.id}.glb`);}catch{const r=await fetch(`https://rescene-eta.vercel.app/api/demo/assets/${m.id}?v=${m.digest.slice(0,12)}`,{signal:AbortSignal.timeout(60000)});assert(r.ok,'Approved model unavailable');bytes=Buffer.from(await r.arrayBuffer());}await writeFile(`${folder}/${m.id}.glb`,bytes,{mode:0o600});}
assert.equal(createHash('sha256').update(bytes).digest('hex'),m.digest);
m.clearanceHull=makeClearanceHull(bytes);points+=m.clearanceHull.length;
}
await writeFile(file,JSON.stringify(models,null,2).replace(/("clearanceHull": )(\[[\s\S]*?\n    \])/g,(_,key,hull)=>key+JSON.stringify(JSON.parse(hull)))+'\n');console.log(JSON.stringify({approvedModels:models.length,hullVertices:points,geometryChanged:false,inferenceCalls:0}));
