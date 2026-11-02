/** Free full-mesh audit/repair of every approved demo. --apply writes snapshots;
 * --database also repairs only the verified owner's linked source scenes under
 * revision CAS/history. Raw assets and protected fixtures are never changed. */
import {config} from 'dotenv';config({path:'.env.local',quiet:true});
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from 'three';
import {compositionSchema} from '../src/lib/scene/composition';
import {readMesh} from '../src/lib/quality/mesh';
import {backgroundPenetration,backgroundSupportLift,fitBackgroundClearance,levelBackgroundSupports} from '../src/lib/scene/environment-clearance';
const folder='test-results/background-clearance',file='src/lib/demo/frozen-scenes.json',apply=process.argv.includes('--apply');
await mkdir(folder,{recursive:true});
const original=await readFile(file,'utf8'),frozen=JSON.parse(original),models=JSON.parse(await readFile('src/lib/demo/catalog-models.json','utf8'));
const reports=[],ids:string[]=[];
for(const scene of frozen.scenes){
 let composition=compositionSchema.parse(scene.composition);
 const objects:{id:string;points:Vector3[]}[]=[],lifts:{id:string;distance:number}[]=[];
 for(const o of scene.objects){
  ids.push(o.id);let bytes:Buffer;
  try{bytes=await readFile(`${folder}/${o.id}.glb`);}catch{
   try{bytes=await readFile(`test-results/demo-expansion-v1/approved/${o.id}.glb`);}catch{
    const m=models.find((m:{id:string})=>m.id===o.id)!;
    const r=await fetch(`https://rescene-eta.vercel.app/api/demo/assets/${o.id}?v=${m.digest.slice(0,12)}`,{signal:AbortSignal.timeout(60000)});
    assert(r.ok,'Approved model unavailable');bytes=Buffer.from(await r.arrayBuffer());
   }
   await writeFile(`${folder}/${o.id}.glb`,bytes,{mode:0o600});
  }
  assert.equal(createHash('sha256').update(bytes).digest('hex'),o.digest);
  const p=o.placement,matrix=new Matrix4().makeTranslation(o.position[0],o.position[1],o.position[2]).multiply(new Matrix4().makeTranslation(p.offset[0],p.offset[1],p.offset[2])).multiply(new Matrix4().compose(new Vector3(),new Quaternion(...p.rotation),new Vector3(...p.scale))),doc=readMesh(bytes,matrix);
  objects.push({id:o.id,points:doc.primitives.flatMap(p=>Array.from({length:p.positions.length/3},(_,i)=>new Vector3().fromArray(p.positions,i*3)))});
 }
 const before=objects.flatMap(o=>backgroundPenetration(o.points,composition).filter(p=>p.depth>.001).map(p=>({id:o.id,...p}))),leveled=levelBackgroundSupports(composition,objects);composition=leveled.composition;
 for(const o of objects){const lift=backgroundSupportLift(o.points,composition);if(lift){for(const p of o.points)p.y+=lift;scene.objects.find((v:{id:string})=>v.id===o.id).position[1]+=lift;lifts.push({id:o.id,distance:lift});}}
 const fitted=fitBackgroundClearance(composition,objects);composition=compositionSchema.parse(fitted.composition);
 const remaining=objects.flatMap(o=>backgroundPenetration(o.points,composition).filter(p=>p.depth>.001).map(p=>({id:o.id,...p})));
 assert.equal(remaining.length,0,`${scene.id}: unresolved background intersection`);
 scene.composition=composition;
 reports.push({scene:scene.id,before,lifts,leveled:leveled.changes,walls:fitted.changes,remaining});
}
if(apply&&process.argv.includes('--database')){
 const {getDb}=await import('../src/lib/db'),{repairBackgroundClearance}=await import('../src/lib/services/background-clearance'),db=getDb();
 try{
  const {ownerId}=await db.scene.findUniqueOrThrow({where:{id:'6800b8a2-7c39-4a52-8fde-790eb03ab46c'},select:{ownerId:true}});
  const linked=await db.product.findMany({where:{catalogKey:{in:ids},catalogRole:'SOURCE',scene:{ownerId,archivedAt:null}},select:{sceneId:true}});
  let repaired=0;
  for(const sceneId of new Set(linked.map(p=>p.sceneId))){
   if(sceneId==='f2848b95-8447-41eb-9544-0d72dd605565')continue;
   const s=await db.scene.findUniqueOrThrow({where:{id:sceneId},include:{objects:true}});
   const backup=`${folder}/source-${sceneId}.json`;
   try{await readFile(backup);}catch{await writeFile(backup,JSON.stringify(s,null,2),{mode:0o600});}
   const result=await repairBackgroundClearance(sceneId,ownerId,s.revision);
   if(result.changed)repaired++;
  }
  console.log(JSON.stringify({ownedSourceScenesRepaired:repaired,protectedFixture:'excluded',history:'revision-guarded and undoable',inferenceCalls:0}));
 }finally{await db.$disconnect();}
}
if(apply){
 try{await readFile(`${folder}/frozen-before.json`);}catch{await writeFile(`${folder}/frozen-before.json`,original,{mode:0o600});}
 await writeFile(file,JSON.stringify(frozen,null,2)+'\n');
}
await writeFile(`${folder}/demo-report${apply?'-applied':''}.json`,JSON.stringify(reports,null,2),{mode:0o600});
console.log(JSON.stringify({collections:reports.length,wallOrSupportProblems:reports.filter(r=>r.before.length).map(r=>r.scene),seatedCollections:reports.filter(r=>r.lifts.length).length,remainingIntersections:0,snapshotWritten:apply}));
