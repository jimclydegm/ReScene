import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {demoScenes,initialArrangement,changeArrangement,collectionLayouts,resolveCollectionLayouts,validateArrangement} from '../src/lib/demo/scenes';
import {compositionSchema,type SceneComposition} from '../src/lib/scene/composition';
import type {EnvironmentGeometry} from '../src/lib/scene/environment-plan';
import {environmentBoundaries,boundaryPenetration,backgroundPenetration,backgroundSupportLift,fitBackgroundClearance,levelBackgroundSupports} from '../src/lib/scene/environment-clearance';
type Surface=EnvironmentGeometry['surfaces'][number];
const face=(role:Surface['role'],vertices:Surface['vertices'],extra:Partial<Surface>={}):Surface=>({role,vertices,triangles:[0,1,2,0,2,3],color:'#c9bca5',roughness:.8,textured:true,...extra});
const back=()=>face('wall',[[-3,0,-1],[3,0,-1],[3,3,-1],[-3,3,-1]],{materialIndex:0,tile:{origin:[0,0,-1],u:[1,0,0],v:[0,1,0]}});
const floor=()=>face('floor',[[-3,0,-3],[3,0,-3],[3,0,3],[-3,0,3]]);
const stage=(surfaces:Surface[]):SceneComposition=>({...structuredClone(demoScenes.find(s=>s.id==='living')!.composition),floorY:0,backdrop:'room',camera:{position:[0,2,5],target:[0,1,0],fov:40,aspect:1.5},background:{kind:'planes',groundVisible:true,boundary:null,description:'Measured background',surfaceMode:'reference',geometry:{version:'reference-environment-v1',surfaces}}});
const box=(x=0,y=0,z=-1.1)=>[-1,1].flatMap(a=>[0,1].flatMap(b=>[-1,1].map(c=>new Vector3(x+a*.3,y+b*.6,z+c*.3))));
describe('Shared foreground/background clearance',()=>{
 it('reads rendered triangles even when vertex order contains extensions and unused vertices',()=>{
  const wall=back();wall.vertices.push([20,0,20],[-20,4,20]);const b=environmentBoundaries(stage([wall]))[0];
  expect(b.normal.z).toBeCloseTo(1);expect(boundaryPenetration(box(),b)).toBeCloseTo(.4);
  expect(boundaryPenetration(box(20),b)).toBe(0);
 });
 it('treats opaque window backings as solid geometry rather than an invisible hole',()=>{
  const window=face('window',[[-.8,.2,-1.025],[.8,.2,-1.025],[.8,2,-1.025],[-.8,2,-1.025]],{materialIndex:0});
  expect(backgroundPenetration(box(0,.3),stage([window]))[0].depth).toBeGreaterThan(.3);
 });
 it('expands connected walls and their inset window, retaining materials and stable photo UVs',()=>{
  const wall=back(),side=face('wall',[[-3,0,-1],[-3,0,3],[-3,3,3],[-3,3,-1]],{materialIndex:1}),window=face('window',[[-.8,.2,-1.025],[.8,.2,-1.025],[.8,2,-1.025],[-.8,2,-1.025]],{materialIndex:0,atlas:{mode:'photo',rect:[0,0,.5,.5]}}),input=stage([wall,side,window,floor()]),before=structuredClone(input),objects=[{id:'back',points:box(0,0,-1.1)},{id:'left',points:box(-3.1,0,0)}];
  const fitted=fitBackgroundClearance(input,objects),surfaces=fitted.composition.background!.geometry!.surfaces;
  expect(fitted.changes).toHaveLength(2);expect(input).toEqual(before);
  for(const o of objects)expect(backgroundPenetration(o.points,fitted.composition).every(p=>p.depth<1e-6)).toBe(true);
  expect(surfaces[0].vertices[0]).toEqual(surfaces[1].vertices[0]);
  expect(surfaces[2].vertices[0][2]-surfaces[0].vertices[0][2]).toBeCloseTo(-.025);
  expect(surfaces[2].photoUv).toHaveLength(4);expect(surfaces[2].atlas).toEqual(window.atlas);
  expect(surfaces[0].tile!.origin[2]).toBe(surfaces[0].vertices[0][2]);
  expect(surfaces[0].color).toBe(wall.color);expect(compositionSchema.safeParse(fitted.composition).success).toBe(true);
  expect(fitBackgroundClearance(fitted.composition,objects).changes).toEqual([]);
 });
 it('lifts a sunken base without lowering unrelated supports or changing suspended objects',()=>{
  const composition=stage([floor()]);expect(backgroundSupportLift(box(0,-.02,0),composition)).toBeCloseTo(.02);
  expect(backgroundSupportLift(box(0,1,0),composition)).toBe(0);
  expect(backgroundSupportLift(box(0,-.02,0),composition,'hanging')).toBe(0);
 });
 it('levels a misfitted dominant tabletop only with independently coplanar bases and intersections',()=>{
  const table=face('surface',[[-3,-1,2],[3,-1,2],[3,2,-2],[-3,2,-2]]),composition=stage([table]),objects=[-1,0,1].map(x=>({id:String(x),points:box(x,-.01,-.8),support:'tabletop'}));
  const leveled=levelBackgroundSupports(composition,objects);expect(leveled.changes).toEqual([0]);expect(environmentBoundaries(leveled.composition)[0].normal.y).toBeCloseTo(1);
  objects[0].points.forEach(p=>p.y+=.3);expect(levelBackgroundSupports(composition,objects).changes).toEqual([]);
 });
 it('keeps the start of a material studio sweep beyond all foreground geometry',()=>{
  const composition=stage([]);composition.background={kind:'seamless',groundVisible:true,boundary:null,description:'Studio',surfaceMode:'materials',transition:'curve',spatial:{rearDistance:.2,curveRadius:.5,confidence:.2,source:'subject-relative-fallback'}};
  const object={id:'wide product',points:box(0,0,-2)},fitted=fitBackgroundClearance(composition,[object]);
  expect(fitted.changes.length).toBe(1);expect(backgroundPenetration(object.points,fitted.composition).every(p=>p.depth<1e-6)).toBe(true);
 });
 it('enforces wall checks for normal demo edits and cannot ratchet past the original tolerance',()=>{
  const scene=demoScenes.find(s=>s.id==='home-essentials')!;let draft=initialArrangement(scene);let blocked=false;
  for(let i=0;i<100;i++){const next=changeArrangement(scene,draft,scene.objects[0].id,{z:draft.items[scene.objects[0].id].z-.02});if(next.error){expect(next.error).toMatch(/wall|background/);blocked=true;break;}draft=next.draft;}
  expect(blocked).toBe(true);
 });
 it('validates every supplied layout and repairs old saved arrangements before loading them',()=>{
  for(const scene of demoScenes){const initial=initialArrangement(scene);for(const draft of Object.values(collectionLayouts(scene)))expect(validateArrangement(scene,initial,draft),scene.id).toBeNull();}
  const scene=demoScenes.find(s=>s.id==='home-essentials')!,saved=collectionLayouts(scene);saved.A.items[scene.objects[0].id].z-=2;saved.A.items[scene.objects[0].id].color=3;
  const recovered=resolveCollectionLayouts(scene,saved);expect(validateArrangement(scene,initialArrangement(scene),recovered.A)).toBeNull();expect(recovered.A.items[scene.objects[0].id].color).toBe(3);
 });
});
