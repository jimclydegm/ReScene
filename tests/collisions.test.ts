import{describe,it,expect}from'vitest';import{BoxGeometry,Vector3}from'three';import{collisionPairs}from'../src/lib/scene/collisions';
const box=(id:string,x:number,y=0,parentId?:string)=>{const g=new BoxGeometry(1,1,1).toNonIndexed(),p=g.getAttribute('position'),points:Vector3[][]=[];for(let i=0;i<p.count;i+=3)points.push([0,1,2].map(k=>new Vector3(p.getX(i+k)+x,p.getY(i+k)+y,p.getZ(i+k))));g.dispose();return{id,points,parentId};};
describe('Volumetric collision checks',()=>{
 it('detects intersecting volumes but permits surface contact',()=>{expect(collisionPairs([box('a',0),box('b',.4)]).length).toBe(1);expect(collisionPairs([box('a',0),box('b',1)])).toEqual([]);expect(collisionPairs([box('a',0),box('b',0,1)])).toEqual([]);});
 it('preserves attached subject regions and shared assemblies',()=>{expect(collisionPairs([box('a',0),box('b',0,0,'a')])).toEqual([]);expect(collisionPairs([box('a',0,0,'root'),box('b',0,0,'root')])).toEqual([]);});
 it('distinguishes disjoint components from their combined bounding box',()=>{const sides={id:'frame',points:[...box('left',-2).points,...box('right',2).points]};expect(collisionPairs([sides,box('middle',0)])).toEqual([]);});
});
