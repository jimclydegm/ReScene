import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { photoShoppingScenes, photoPurchaseDraft, photoShoppingScene } from "../src/lib/demo/photo-shopping";
import { maskGeometry, pickPhotoProduct, photoPoint } from "../src/lib/demo/photo-mask";
import { demoScenes, initialArrangement } from "../src/lib/demo/scenes";
import { merchandiseTotal, purchaseLines } from "../src/lib/shopping/engine";
import { productAlbum } from "../src/lib/demo/albums";

describe("Original-photo shopping",()=>{
  it("uses every pictured product's saved Meta silhouette and a hash-matched approved reference",async()=>{
    expect(photoShoppingScenes).toHaveLength(demoScenes.length);
    for(const scene of photoShoppingScenes){
      expect(scene.model).toBe("sam-3.1");
      expect(scene.products.map(p=>p.id)).toEqual(demoScenes.find(s=>s.id===scene.id)!.objects.map(o=>o.id));
      const photo=readFileSync(`public${scene.photo.path}`);
      expect(createHash("sha256").update(photo).digest("hex")).toBe(scene.photo.sha256);
      expect(JSON.stringify(scene)).not.toMatch(/ownerId|sourceAsset|maskAsset|storageKey|providerRequest|https?:|\/Users\//);
      for(const product of scene.products){
        const bytes=readFileSync(`public${product.maskPath}`),{data,info}=await sharp(bytes).raw().toBuffer({resolveWithObject:true});
        expect(info.channels).toBe(4);
        expect([info.width,info.height]).toEqual(product.bounds.slice(2));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(product.sha256);
        const alpha=new Uint8Array(info.width*info.height);
        for(let i=0;i<alpha.length;i++)alpha[i]=data[i*4+3];
        expect(alpha.reduce((sum,a)=>sum+(a>=128?1:0),0)).toBe(product.area);
        const [x,y]=product.anchor;
        expect(pickPhotoProduct([{...product,pixels:alpha}],x,y)).toBe(product.id);
        expect(product.bounds[0]+product.bounds[2]).toBeLessThanOrEqual(scene.width);
        expect(product.bounds[1]+product.bounds[3]).toBeLessThanOrEqual(scene.height);
      }
    }
  });
  it("picks actual mask pixels, not the empty corners or holes of their bounding boxes",()=>{
    const mask={id:"mug",maskPath:"/demo/test.png",sha256:"",bounds:[10,10,3,3],anchor:[10,10],area:8,pixels:new Uint8Array([255,255,255,255,0,255,255,255,255])};
    expect(pickPhotoProduct([mask],10,10)).toBe("mug");
    expect(pickPhotoProduct([mask],11,11)).toBeNull();
    expect(pickPhotoProduct([mask],13,11)).toBeNull();
    expect(pickPhotoProduct([mask],Number.NaN,11)).toBeNull();
    const small={...mask,id:"foreground",area:1};
    expect(pickPhotoProduct([mask,small],10,10)).toBe("foreground");
  });
  it("maps clicks through wide and tall letterboxing and ignores margins",()=>{
    const box={left:10,top:20,width:400,height:400};
    expect(photoPoint(210,220,box,200,100)).toEqual({x:100,y:50});
    expect(photoPoint(210,70,box,200,100)).toBeNull();
    expect(photoPoint(110,220,box,100,200)).toEqual({x:0,y:100});
    expect(photoPoint(60,220,box,100,200)).toBeNull();
  });
  it("places numbered labels inside irregular masks instead of their potentially empty center",()=>{
    const pixels=new Uint8Array([255,255,255,255,0,255,255,255,255]);
    const geometry=maskGeometry(pixels,3,3),[x,y]=geometry.anchor;
    expect(pixels[y*3+x]).toBe(255);
    expect(geometry.area).toBe(8);
    expect(()=>maskGeometry(new Uint8Array(9),3,3)).toThrow("Empty mask");
  });
  it("keeps the photo's original product, finish and price separate from all 3D edits",()=>{
    const scene=demoScenes.find(s=>s.id==="living")!,draft=initialArrangement(scene);
    draft.items["cloud-sofa"]={...draft.items["cloud-sofa"],productId:"daily-gray-sofa",color:2,visible:false,owned:true,x:3};
    draft.lighting="Night";
    const before=structuredClone(draft),photo=photoPurchaseDraft(scene,scene.objects.map(o=>o.id));
    expect(merchandiseTotal(photo)).toBe(96600);
    expect(purchaseLines(photo)).toContainEqual({id:"cloud-sofa",color:0});
    expect(photo.items["cloud-sofa"]).toMatchObject({visible:true,color:0,included:true});
    expect(photo.lighting).toBe("Original");
    expect(draft).toEqual(before);
    expect(purchaseLines(photoPurchaseDraft(scene,["cloud-sofa"]))).toEqual([{id:"cloud-sofa",color:0}]);
  });
  it("provides two or three compact generated photo samples for each pictured product",async()=>{
    for(const scene of photoShoppingScenes)for(const p of scene.products){
      const samples=productAlbum(p.id).filter(i=>i.kind==="generated"&&i.setting!=="reference").slice(0,3);
      expect(samples.length,p.id).toBeGreaterThanOrEqual(2);
      expect(new Set(samples.map(s=>s.path)).size).toBe(samples.length);
      for(const sample of samples){
        const bytes=readFileSync(`public${sample.path}`),info=await sharp(bytes).metadata();
        expect(sample.model).toBe("muse-image-1.0");
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(sample.sha256);
        expect([info.width,info.height]).toEqual([sample.width,sample.height]);
      }
    }
    expect(()=>photoShoppingScene("private-scene")).toThrow();
  });
});
