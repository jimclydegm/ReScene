import { describe, expect, it } from "vitest";
import { Matrix4 } from "three";
import { isBackgroundSurface } from "../src/lib/scene/surface-role";
import { createSurfaceMaterial } from "../src/lib/scene/surface-material";
import { validateAnalysis } from "../src/lib/ai/contracts";
import { settleSupportContacts, type SceneComposition, type ModelPlacement } from "../src/lib/scene/composition";

const size={width:1000,height:800},broad={category:"surface",imageBounds:{xMin:0,yMin:500,xMax:1000,yMax:800}};
const environment={floorColor:"#aaaaaa",wallColor:"#dddddd",floorMaterial:"plain" as const,lightDirection:"diffuse" as const,lightWarmth:"neutral" as const,sideWall:"none" as const};
const placement=(height:number):ModelPlacement=>({version:"sam3d-layout-v1",offset:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],size:[1,height,1]});
describe("Background planes versus bounded products",()=>{
 it("routes broad legacy floor/wall extents into background independent of scene or color",()=>{
  expect(isBackgroundSurface(broad,size)).toBe(true);
  expect(isBackgroundSurface({...broad,imageBounds:{xMin:0,yMin:0,xMax:1000,yMax:500}},size)).toBe(true);
  expect(isBackgroundSurface({...broad,category:"table"},size)).toBe(false);
 });
 it("retains bounded boards/rugs, merchant products, attached regions and explicit object roles",()=>{
  for(const object of [{...broad,imageBounds:{xMin:100,yMin:500,xMax:900,yMax:750}},{...broad,productId:"merchant-product"},{...broad,provenance:{parentObjectId:"root"}},{...broad,provenance:{surfaceRole:"object"}}])expect(isBackgroundSurface(object,size)).toBe(false);
  expect(isBackgroundSurface({...broad,imageBounds:{xMin:-1,yMin:500,xMax:1000,yMax:800}},size)).toBe(false);
 });
 it("drops background candidates before SAM and removes dangling physical support references",()=>{
  const item={candidateId:"candidate-1",label:"Subject",category:"animal",segmentationConcept:"animal",bbox:{xMin:100,yMin:200,xMax:400,yMax:600},support:"floor",notes:"",supportedByCandidateId:"candidate-2",surfaceRole:"object"};
  const floor={...item,candidateId:"candidate-2",label:"Ground",category:"surface",bbox:broad.imageBounds,supportedByCandidateId:null,surfaceRole:"background"};
  const result=validateAnalysis({sceneType:"general",summary:"Subject on a support",environment,objects:[item,floor]},size);
  expect(result.objects).toHaveLength(1);expect(result.objects[0].supportedByCandidateId).toBeNull();
 });
});
describe("Stable single-plane surfaces",()=>{
 it("combines photographed color and shadow in one opaque depth-writing material",()=>{
  const material=createSurfaceMaterial(new Matrix4(),"#b68a5e","photo");
  expect(material.transparent).toBe(false);expect(material.depthWrite).toBe(true);expect(material.lights).toBe(true);
  expect(material.vertexShader).toContain("projector * modelMatrix");
  expect(material.fragmentShader).toContain("surface * (1.0 - shadowStrength");
  expect(material.fragmentShader).toContain("getShadowMask()");expect(material.uniforms.surfaceMode.value).toBe(1);
  material.dispose();
 });
 it("keeps solid fields and tile patches on the same material path without a receiver layer",()=>{
  const solid=createSurfaceMaterial(new Matrix4(),"#ffffff","solid",0),tile=createSurfaceMaterial(new Matrix4(),"#aaaaaa","tile");
  expect(solid.uniforms.surfaceMode.value).toBe(0);expect(solid.uniforms.shadowStrength.value).toBe(0);expect(tile.uniforms.surfaceMode.value).toBe(2);
  solid.dispose();tile.dispose();
 });
 it("seats floor objects on the plane and keeps explicit stacked supports above it",()=>{
  const stage:SceneComposition={version:"sam3d-room-v1",floorY:0,camera:{position:[0,5,8],target:[0,0,0],fov:45,aspect:1},room:{centerX:0,centerZ:0,width:8,depth:8,height:4},environment,environmentSource:"spark",projectionError:0,warnings:[]};
  const objects=[{id:"base",position:[0,.3,0] as [number,number,number],placement:placement(1)},{id:"top",position:[2,1.6,4] as [number,number,number],placement:placement(.5)}];
  const base={bounds:{min:[0,0,0] as [number,number,number],max:[1,1,1] as [number,number,number]},metadata:{},imageBounds:{xMin:1,yMin:1,xMax:2,yMax:2}};
  settleSupportContacts(objects,[{...base,id:"base",support:"floor"},{...base,id:"top",support:"tabletop",supportedById:"base"}],stage);
  expect(objects[0].position[1]).toBe(0);expect(objects[1].position[1]).toBe(1);
  expect(Math.abs(objects[1].position[0]-objects[0].position[0])).toBeLessThanOrEqual(.001);expect(Math.abs(objects[1].position[2]-objects[0].position[2])).toBeLessThanOrEqual(.001);
 });
});
