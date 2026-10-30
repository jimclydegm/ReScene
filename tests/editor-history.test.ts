import {describe,it,expect} from "vitest";
import {editHistory,recordEdit,finishEdit,undoEdit,redoEdit} from "../src/lib/editor/history";
import {subjectVisibility} from "../src/lib/editor/visibility";
import {rotationControls,rotationQuaternion,rotationAfterEdit} from "../src/lib/editor/rotation";
import {objectEditsSchema} from "../src/lib/validation/generation";

describe("Logical editor actions",()=>{
 it("turns hundreds of slider samples into one reversible action",()=>{
  let s=editHistory({x:0,light:1});for(let x=1;x<=200;x++)s=recordEdit(s,{x,light:1},"drag");
  expect(s.past).toHaveLength(1);s=finishEdit(s);s=undoEdit(s);expect(s.present.x).toBe(0);s=redoEdit(s);expect(s.present.x).toBe(200);
 });
 it("separates gestures and different fields while keeping lighting and products in the same timeline",()=>{
  let s=editHistory({x:0,light:1,name:"A"});s=recordEdit(s,{...s.present,x:1},"drag");s=finishEdit(s);s=recordEdit(s,{...s.present,light:3},"light");s=finishEdit(s);
  for(const name of ["B","Be","Bed"])s=recordEdit(s,{...s.present,name},"typing");
  s=undoEdit(s);expect(s.present).toEqual({x:1,light:3,name:"A"});s=undoEdit(s);expect(s.present.light).toBe(1);s=undoEdit(s);expect(s.present.x).toBe(0);
 });
 it("discards no-op drags and restores redo when a gesture returns to its starting value",()=>{
  let s=recordEdit(editHistory(0),1);s=undoEdit(s);s=recordEdit(s,2,"drag");s=recordEdit(s,0,"drag");s=finishEdit(s);expect(s.past).toHaveLength(0);expect(redoEdit(s).present).toBe(1);
 });
 it("clears redo after a real new edit and limits memory to fifty actions",()=>{
  let s=recordEdit(editHistory(0),1);s=recordEdit(s,2);s=undoEdit(s);s=recordEdit(s,3);expect(s.future).toEqual([]);for(let i=4;i<120;i++)s=recordEdit(s,i);expect(s.past).toHaveLength(50);
 });
 it("does not record unchanged values",()=>{const s=editHistory({x:1});expect(recordEdit(s,{x:1})).toBe(s);});
});
describe("Visibility and complete subjects",()=>{
 const objects=[{id:"root",assemblyRootId:"root",modelUrl:"root.glb",visible:true},{id:"part",assemblyRootId:"root",modelUrl:"part.glb",visible:true},{id:"other",assemblyRootId:null,modelUrl:"other.glb",visible:true},{id:"failed",assemblyRootId:null,modelUrl:null,visible:false}];
 it("isolates a complete subject even when its product region is selected, with one undo",()=>{
  const isolated=subjectVisibility(objects,"part");expect(isolated.map(o=>o.visible)).toEqual([true,true,false,false]);expect(objects[2].visible).toBe(true);
  expect(undoEdit(recordEdit(editHistory(objects),isolated)).present).toEqual(objects);expect(subjectVisibility(isolated,null).map(o=>o.visible)).toEqual([true,true,true,false]);
 });
});
describe("Full object rotation",()=>{
 it("round-trips tilt, heading and lean through persisted quaternions",()=>{
  const angles={yaw:.6,pitch:.3,roll:-.4},q=rotationQuaternion(angles),controls=rotationControls({rotationX:q.x,rotationY:q.y,rotationZ:q.z,rotationW:q.w});
  for(const axis of ["yaw","pitch","roll"] as const)expect(controls[axis]).toBeCloseTo(angles[axis]);expect(q.length()).toBeCloseTo(1);
 });
 it("keeps existing tilt/lean when a legacy edit sends only heading",()=>{
  const q=rotationQuaternion({yaw:.6,pitch:.3,roll:-.4}),next=rotationAfterEdit({rotationX:q.x,rotationY:q.y,rotationZ:q.z,rotationW:q.w},{yaw:.8});const a=rotationControls({rotationX:next.x,rotationY:next.y,rotationZ:next.z,rotationW:next.w});expect(a.pitch).toBeCloseTo(.3);expect(a.roll).toBeCloseTo(-.4);
 });
 it("validates rotation ranges while accepting existing clients without new fields",()=>{
  const object={id:"3ee61171-5730-4c80-8dc2-274eebd26576",label:"Item",positionX:0,positionY:0,positionZ:0,yaw:0,scale:1,visible:true};
  expect(objectEditsSchema.safeParse({expectedRevision:1,objects:[object]}).success).toBe(true);
  expect(objectEditsSchema.safeParse({expectedRevision:1,objects:[{...object,pitch:.5,roll:1}]}).success).toBe(true);
  expect(objectEditsSchema.safeParse({expectedRevision:1,objects:[{...object,pitch:Math.PI}]}).success).toBe(false);
 });
});
