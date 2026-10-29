import {describe,it,expect} from "vitest";
import {randomUUID} from "node:crypto";
import {Vector3,Quaternion} from "three";
import {flattenTransform,snapshotSchema,snapshotAssets} from "../src/lib/scene/manifest";
import {defaultLighting} from "../src/lib/scene/lighting";
const model=randomUUID(),object=randomUUID(),product=randomUUID(),image=randomUUID();
const snapshot=()=>({schemaVersion:2,coordinates:{handedness:"right",upAxis:"Y",units:"approximate"},title:"Frozen room",description:null,revision:1,approximateGeometry:true,composition:null,lighting:defaultLighting(null),surfaces:{floorAssetId:null,wallAssetId:null},objects:[{id:object,label:"Chair",modelAssetId:model,transform:{position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]},productId:product}],products:[{id:product,name:"Merchant listing",brand:"",description:"",price:"49.95",currency:"USD",productUrl:"https://example.com/product",imageAssetId:image}]});
describe("frozen publication contract",()=>{
 it("allowlists exactly reachable render assets and rejects raw/editor data",()=>{const m=snapshotSchema.parse(snapshot());expect(snapshotAssets(m)).toEqual([model,image].sort());for(const extra of [{sourceAssetId:randomUUID()},{settings:{raw:true}},{ownerId:randomUUID()}])expect(snapshotSchema.safeParse({...snapshot(),...extra}).success).toBe(false);});
 it("rejects orphan/missing products and duplicate objects",()=>{const m=snapshot();expect(snapshotSchema.safeParse({...m,products:[]}).success).toBe(false);expect(snapshotSchema.safeParse({...m,objects:[...m.objects,...m.objects]}).success).toBe(false);expect(snapshotSchema.safeParse({...m,products:[...m.products,{...m.products[0],id:randomUUID()}]}).success).toBe(false);});
 it("validates unit rotation, safe links and nullable price pairs",()=>{const m=snapshot();expect(snapshotSchema.safeParse({...m,objects:[{...m.objects[0],transform:{...m.objects[0].transform,rotation:[0,0,0,0]}}]}).success).toBe(false);expect(snapshotSchema.safeParse({...m,products:[{...m.products[0],productUrl:"javascript:alert(1)"}]}).success).toBe(false);expect(snapshotSchema.safeParse({...m,products:[{...m.products[0],price:null,currency:null}]}).success).toBe(true);expect(snapshotSchema.safeParse({...m,products:[{...m.products[0],price:null}]}).success).toBe(false);});
 it("flattens imported pose, pivot, draft rotation and size without dropping any layer",()=>{
  const baseRotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2),yaw=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.6);
  const baseline={version:"sam3d-layout-v1",rotation:baseRotation.toArray(),scale:[2,2,2],offset:[-.5,.7,1],size:[2,3,4]};
  const transform=flattenTransform({positionX:3,positionY:1,positionZ:-2,rotationX:yaw.x,rotationY:yaw.y,rotationZ:yaw.z,rotationW:yaw.w,scaleX:1.4,scaleY:1.4,scaleZ:1.4,initialTransform:baseline},{min:[-1,0,-1],max:[1,2,1]});
  const point=new Vector3(.2,.4,-.6),expected=point.clone().multiplyScalar(2).applyQuaternion(baseRotation).add(new Vector3(-.5,.7,1)).multiplyScalar(1.4).applyQuaternion(yaw).add(new Vector3(3,1,-2));
  const actual=point.clone().multiply(new Vector3(...transform.scale)).applyQuaternion(new Quaternion(...transform.rotation)).add(new Vector3(...transform.position));expect(actual.distanceTo(expected)).toBeLessThan(1e-8);
 });
 it("normalizes manual-stage geometry at the bottom center",()=>{const t=flattenTransform({positionX:1,positionY:0,positionZ:0,rotationX:0,rotationY:0,rotationZ:0,rotationW:1,scaleX:1,scaleY:1,scaleZ:1,initialTransform:null},{min:[-2,-1,-1],max:[2,3,1]});expect(t.scale).toEqual([.375,.375,.375]);expect(t.position).toEqual([1,.375,0]);});
});
