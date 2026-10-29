import { describe,it,expect } from "vitest";
import {demoCatalog,demoGlb,demoSvg,fitCatalog,boundsSchema} from "../src/lib/scene/catalog";
import {inspectGlb} from "../src/lib/ai/glb";
import {glbBounds,modelPlacementSchema} from "../src/lib/scene/composition";
describe("original demo catalog",()=>{
 it("builds three self-contained meshes with accurate bounds and artwork",()=>{
  for(const item of demoCatalog){const {bytes,bounds}=demoGlb(item.boxes);expect(inspectGlb(bytes).meshes).toBe(1);expect(boundsSchema.safeParse(bounds).success).toBe(true);const read=glbBounds(bytes);for(let i=0;i<3;i++){expect(read.min[i]).toBeCloseTo(bounds.min[i],5);expect(read.max[i]).toBeCloseTo(bounds.max[i],5);}expect(demoSvg(item.boxes)).toContain('<polygon');}
 });
 it("fits uniformly and anchors at bottom center without changing the mesh",()=>{
  const original={min:[-1,-2,-3] as [number,number,number],max:[3,2,1] as [number,number,number]};
  const fit=fitCatalog(original,[2,1,1]);expect(modelPlacementSchema.safeParse(fit).success).toBe(true);expect(fit.scale).toEqual([.5,.5,.5]);expect(fit.offset).toEqual([-.5,1,.5]);expect(fit.size).toEqual([2,2,2]);expect(original.min).toEqual([-1,-2,-3]);
 });
 it("rejects degenerate asset bounds and unsafe target dimensions",()=>{
  expect(()=>fitCatalog({min:[0,0,0],max:[0,1,1]},[1,1,1])).toThrow();expect(()=>fitCatalog({min:[0,0,0],max:[1,1,1]},[NaN,1,1])).toThrow();
 });
});
