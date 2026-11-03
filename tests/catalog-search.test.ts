import { describe, it, expect } from "vitest";
import { catalogSelections } from "../src/lib/shopping/catalog-search";

describe("Larger shopping catalogs", () => {
  it("considers late catalog entries and both budget and premium kits within a bounded search", () => {
    const choices = Array.from({length:4},(_,slot)=>Array.from({length:24},(_,i)=>({id:`${slot}-${i}`,price:100+i*100})));
    const result=catalogSelections(choices,[true,true,true,true],10000);
    expect(result.length).toBeLessThanOrEqual(384);
    for(const r of result) expect(r.cost).toBe(r.products.reduce((sum,p)=>sum+p.price,0));
    for(let slot=0;slot<4;slot++) {
      const used=new Set(result.map(r=>r.products[slot].id));
      expect(used.size).toBe(24);
      expect(used.has(`${slot}-23`)).toBe(true);
    }
    expect(result.some(r=>r.cost<2000)).toBe(true);
    expect(result.some(r=>r.cost>8000)).toBe(true);
  });
  it("prunes purchases exactly while keeping owned items in the scene", () => {
    const result=catalogSelections([
      [{id:"owned",price:100000}],
      [{id:"cheap",price:600},{id:"mid",price:1400},{id:"premium",price:4800}],
    ],[false,true],1400);
    expect(result.map(r=>r.products[1].id).sort()).toEqual(["cheap","mid"]);
    expect(result.every(r=>r.products[0].id==="owned"&&r.cost<=1400)).toBe(true);
    expect(catalogSelections([[{id:"expensive",price:1401}]],[true],1400)).toEqual([]);
  });
});
