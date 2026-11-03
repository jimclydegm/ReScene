import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { catalogExpansion } from "../src/lib/demo/catalog-expansion";
import { demoProducts } from "../src/lib/demo/catalog";
import models from "../src/lib/demo/catalog-models.json";
import { productAlbum } from "../src/lib/demo/albums";
import { demoScenes, initialArrangement, changeArrangement } from "../src/lib/demo/scenes";
import { buildCandidates, checkCombination, merchandiseTotal } from "../src/lib/shopping/engine";
import type { ShoppingIntent } from "../src/lib/shopping/contracts";

describe("Priced catalog expansion",()=>{
  it("ships independent Muse photos, textured models and complete listings across eight price ranges",()=>{
    const groups = ["table","chair","drawer","sofa","mug","vase","bag","shoes"];
    for(const kind of groups){
      const batch=catalogExpansion.filter(p=>kind==="bag"?/tote|handbag/.test(p.kind):p.kind===kind);
      expect(batch).toHaveLength(8);
      expect(new Set(batch.map(p=>p.price)).size).toBe(8);
      expect(Math.max(...batch.map(p=>p.price))/Math.min(...batch.map(p=>p.price))).toBeGreaterThan(5);
      const digests=new Set<string>();
      for(const p of batch){
        const listing=demoProducts.find(v=>v.id===p.id)!,model=models.find(v=>v.id===p.id)!,photo=productAlbum(p.id)[0];
        expect(listing).toMatchObject({name:p.name,price:p.price,materials:p.materials,dimensions:p.dimensions});
        expect(listing.care.length).toBeGreaterThan(15);
        expect(listing.colors.length).toBeGreaterThanOrEqual(6);
        expect(model.clearanceHull.length).toBeGreaterThan(4);
        expect(model.bytes).toBeGreaterThan(10000);
        expect(photo).toMatchObject({kind:"generated",model:"muse-image-1.0",setting:"studio"});
        expect(photo.path).toMatch(/^\/demo\/catalog-v2\//);
        expect(createHash("sha256").update(readFileSync(`public${photo.path}`)).digest("hex")).toBe(photo.sha256);
        digests.add(model.digest);
      }
      expect(digests.size).toBe(8);
    }
  });
  it("offers multiple valid replacements in every requested category",()=>{
    for(const [kind,collection,slot]of [
      ["table","space","round-table"], ["chair","home-essentials","home-essentials-item-2"],
      ["drawer","home-essentials","home-essentials-item-3"], ["sofa","living","cloud-sofa"],
      ["mug","playtime","playtime-item-2"], ["vase","corner","corner-vase"],
      ["bag","city-style","city-style-item-1"], ["shoes","city-style","city-style-item-2"],
    ]){
      const scene=demoScenes.find(s=>s.id===collection)!,draft=initialArrangement(scene);
      const fits=catalogExpansion.filter(p=>(kind==="bag"?/tote|handbag/.test(p.kind):p.kind===kind)&&!changeArrangement(scene,draft,slot,{productId:p.id}).error);
      expect(fits.length,`${kind} replacements`).toBeGreaterThanOrEqual(3);
    }
  });
  it("finds different low-budget and premium kits with exact prices and preserved owned items",()=>{
    const scene=demoScenes.find(s=>s.id==="home-essentials")!,draft=initialArrangement(scene);
    draft.items["home-essentials-item-1"].owned=true;
    const intent:ShoppingIntent={summary:"Coordinate seating and storage",palette:"warm",keep:[],excludedProductIds:[],requireStorage:true,budgetCents:null,strictBudget:false,lighting:null,background:null,layout:"original",clarification:null};
    for(const budgetCents of [20000,120000]){
      const input={key:crypto.randomUUID(),sceneId:scene.id,text:"Keep the refrigerator and coordinate the chair and drawers",selected:"home-essentials-item-2",keep:["home-essentials-item-1"],budgetCents,draft};
      const result=buildCandidates(input,intent);
      expect(result.candidates.length).toBeGreaterThan(1);
      expect(new Set(result.candidates.map(c=>Object.values(c.draft.items).map(i=>i.productId).join("|"))).size).toBe(result.candidates.length);
      expect(new Set(result.candidates.map(c=>c.draft.items["home-essentials-item-3"].productId)).size).toBeGreaterThan(1);
      expect(result.candidates.some(c=>catalogExpansion.some(p=>Object.values(c.draft.items).some(i=>i.productId===p.id)))).toBe(true);
      for(const c of result.candidates){expect(c.subtotalCents).toBe(merchandiseTotal(c.draft));expect(c.subtotalCents).toBeLessThanOrEqual(budgetCents);expect(checkCombination(input,intent,c.draft)).toBeNull();expect(c.draft.items["home-essentials-item-1"].owned).toBe(true);}
    }
  });
});
