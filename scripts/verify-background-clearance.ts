/** Read-only full-vertex audit of every supplied showroom arrangement. No inference. */
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {Matrix4,Quaternion,Vector3} from 'three';
import {demoScenes,collectionLayouts,resolvedDemoObject} from '../src/lib/demo/scenes';import {backgroundPenetration} from '../src/lib/scene/environment-clearance';import {readMesh} from '../src/lib/quality/mesh';
const cache=new Map<string,Vector3[]>();let arrangements=0,objects=0;
for(const scene of demoScenes){
 for(const o of scene.objects){const bytes=await readFile(`test-results/background-clearance/${o.id}.glb`);cache.set(o.id,readMesh(bytes).primitives.flatMap(p=>Array.from({length:p.positions.length/3},(_,i)=>new Vector3().fromArray(p.positions,i*3))));}
 for(const [name,draft]of Object.entries(collectionLayouts(scene))){arrangements++;
  for(const o of scene.objects){const r=resolvedDemoObject(scene,draft,o.id),i=draft.items[o.id],m=new Matrix4().makeTranslation(i.x,r.position[1],i.z).multiply(new Matrix4().makeRotationY(i.yaw)).multiply(new Matrix4().makeTranslation(...r.placement.offset)).multiply(new Matrix4().compose(new Vector3(),new Quaternion(...r.placement.rotation),new Vector3(...r.placement.scale))),points=cache.get(o.id)!.map(p=>p.clone().applyMatrix4(m));
   const failures=backgroundPenetration(points,scene.composition).filter(p=>p.depth>.001);assert.equal(failures.length,0,`${scene.id}/${name}/${o.id}: background penetration`);objects++;
  }
 }
}
const report={collections:demoScenes.length,arrangements,objectPlacements:objects,remainingIntersections:0,newInference:0};await writeFile('test-results/background-clearance/final-audit.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
