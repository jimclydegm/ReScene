import { describe, it, expect } from "vitest";
import { Box3, Quaternion, Vector3 } from "three";
import { alignReplacementFrame } from "../src/lib/demo/replacement-frame";
import type { ModelPlacement } from "../src/lib/scene/composition";

const hull:[number,number,number][] = [-2,2].flatMap(x=>[0,2].flatMap(y=>[-1,1].map(z=>[x,y,z] as [number,number,number])));
const placement=(yaw:number):ModelPlacement=>({version:"sam3d-layout-v1",rotation:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw).toArray(),scale:[1,1,1],offset:[0,0,0],size:[4,2,2]});
describe("Catalog replacement frames",()=>{
  it("aligns photo-camera heading to the selected footprint without squashing geometry or lifting its base",()=>{
    const source=placement(Math.PI/4),target=placement(0),before=structuredClone(source);
    const aligned=alignReplacementFrame({placement:source,hull,dimensions:"W180 × D90 × H80 cm"},{placement:target,hull,dimensions:"W180 × D90 × H80 cm"});
    const bounds=new Box3(),q=new Quaternion(...aligned.rotation);
    for(const p of hull)bounds.expandByPoint(new Vector3(...p).multiply(new Vector3(...aligned.scale)).applyQuaternion(q).add(new Vector3(...aligned.offset)));
    expect(bounds.min.y).toBeCloseTo(0);
    const size=bounds.getSize(new Vector3());
    expect(size.x).toBeCloseTo(4);
    expect(size.y).toBeCloseTo(2);
    expect(size.z).toBeCloseTo(2);
    expect(aligned.scale).toEqual(source.scale);
    expect(source).toEqual(before);
  });
  it("keeps near-square objects and unverified missing footprints unchanged",()=>{
    const p=placement(Math.PI/4),t=placement(0);
    expect(alignReplacementFrame({placement:p,hull,dimensions:"W45 × D45 × H50 cm"},{placement:t,hull,dimensions:"W45 × D45 × H50 cm"})).toBe(p);
    expect(alignReplacementFrame({placement:p,dimensions:"W180 × D90 × H80 cm"},{placement:t,hull,dimensions:"W180 × D90 × H80 cm"})).toBe(p);
  });
  it("uses an observed elongated axis when a listing supplies a size instead of width and depth",()=>{
    const source=placement(Math.PI/4),target=placement(0);
    const aligned=alignReplacementFrame({placement:source,hull,dimensions:"Size EU 42"},{placement:target,hull,dimensions:"Size EU 42"});
    expect(aligned.rotation[1]).toBeCloseTo(0);
    expect(aligned.size[0]).toBeCloseTo(4);
    expect(aligned.size[2]).toBeCloseTo(2);
  });
});
