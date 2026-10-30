import {describe,it,expect,vi,afterEach} from "vitest";
import {Box3,Color,Object3D,PerspectiveCamera,Scene,Vector3,WebGLRenderTarget,type WebGLRenderer} from "three";
import {captureScene,captureSize,focusDistance} from "../src/lib/editor/capture";
afterEach(()=>vi.unstubAllGlobals());
describe("Scene PNG export",()=>{
 it("bounds export memory and keeps aspect ratio",()=>{
  const s=captureSize(12000,8000);expect(s.width).toBeLessThanOrEqual(4096);expect(s.width*s.height).toBeLessThanOrEqual(8_388_608);expect(s.width/s.height).toBeCloseTo(1.5,2);expect(()=>captureSize(0,10)).toThrow();
 });
 it("renders transparent pixels offscreen, excludes helpers, flips rows, and restores the live scene",async()=>{
  const scene=new Scene();scene.background=new Color("red");const background=scene.background,helper=new Object3D(),floor=new Object3D(),hidden=new Object3D();helper.userData.editorHelper=true;floor.userData.sceneBackground=true;hidden.visible=false;hidden.userData.editorHelper=true;scene.add(helper,floor,hidden);
  const oldTarget=new WebGLRenderTarget(1,1);let current:WebGLRenderTarget|null=oldTarget,alpha=1,encoded:Uint8ClampedArray|undefined;
  const renderer={getDrawingBufferSize:(v:{set:(x:number,y:number)=>unknown})=>v.set(2,2),getClearAlpha:()=>alpha,setClearAlpha:(a:number)=>alpha=a,getRenderTarget:()=>current,setRenderTarget:(t:WebGLRenderTarget|null)=>current=t,render:()=>{expect(current).not.toBe(oldTarget);expect(scene.background).toBeNull();expect(helper.visible).toBe(false);expect(floor.visible).toBe(false);expect(alpha).toBe(0);},readRenderTargetPixels:(_t:unknown,_x:number,_y:number,_w:number,_h:number,pixels:Uint8Array)=>{pixels.set([255,0,0,255,255,0,0,255,0,255,0,255,0,255,0,255]);}} as unknown as WebGLRenderer;
  vi.stubGlobal("document",{createElement:()=>({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(16)}),putImageData:(image:{data:Uint8ClampedArray})=>encoded=image.data}),toBlob:(callback:(b:Blob)=>void)=>callback(new Blob(["png"],{type:"image/png"}))})});
  const result=await captureScene(renderer,scene,new PerspectiveCamera(),true);expect(result.type).toBe("image/png");expect([...encoded!.slice(0,4)]).toEqual([0,255,0,255]);expect(current).toBe(oldTarget);expect(alpha).toBe(1);expect(scene.background).toBe(background);expect(helper.visible).toBe(true);expect(floor.visible).toBe(true);expect(hidden.visible).toBe(false);oldTarget.dispose();
 });
 it("restores visibility and target when GPU readback fails",async()=>{
  const scene=new Scene(),helper=new Object3D();helper.userData.editorHelper=true;scene.add(helper);let alpha=1,target:unknown=null;
  const renderer={getDrawingBufferSize:(v:{set:(x:number,y:number)=>unknown})=>v.set(2,2),getClearAlpha:()=>alpha,setClearAlpha:(a:number)=>alpha=a,getRenderTarget:()=>target,setRenderTarget:(t:unknown)=>target=t,render:()=>{throw new Error("GPU failed");}} as unknown as WebGLRenderer;
  await expect(captureScene(renderer,scene,new PerspectiveCamera(),true)).rejects.toThrow("GPU failed");expect(helper.visible).toBe(true);expect(alpha).toBe(1);expect(target).toBeNull();
 });
 it("frames selected geometry conservatively in portrait and landscape views",()=>{
  const box=new Box3(new Vector3(-1,-1,-1),new Vector3(1,1,1)),camera=new PerspectiveCamera(45,1.5);const landscape=focusDistance(box,camera);camera.aspect=.5;expect(focusDistance(box,camera)).toBeGreaterThan(landscape);
 });
});
