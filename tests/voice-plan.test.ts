import {describe,it,expect} from "vitest";
import {voicePlanSchema,type VoicePlan} from "../src/lib/voice/contracts";
import {applyVoicePlan} from "../src/lib/voice/demo-plan";
import {demoScenes,initialArrangement} from "../src/lib/demo/scenes";
import {editHistory,recordEdit,undoEdit,redoEdit} from "../src/lib/editor/history";
const scene=demoScenes.find(s=>s.id==="corner")!,context=()=>({sceneId:"corner" as const,selected:"corner-chair",draft:initialArrangement(scene)});
const action=(type:VoicePlan["actions"][number]["type"],patch:Partial<VoicePlan["actions"][number]>={})=>({type,target:null,productId:null,color:null,visible:null,dx:null,dz:null,turn:null,lighting:null,background:null,...patch});
const plan=(...actions:VoicePlan["actions"])=>({summary:"Proposed changes",actions});
describe("Reviewed showroom voice plans",()=>{
 it("applies color and lighting together with one undoable operation",()=>{
  const c=context(),next=applyVoicePlan(c,plan(action("color",{color:2}),action("lighting",{lighting:"Dusk"})));expect(next.error).toBeNull();expect(next.draft.items[c.selected].color).toBe(2);expect(next.draft.lighting).toBe("Dusk");expect(c.draft.items[c.selected].color).toBe(0);
  const history=recordEdit(editHistory(c.draft),next.draft);expect(history.past).toHaveLength(1);expect(undoEdit(history).present).toEqual(c.draft);expect(redoEdit(undoEdit(history)).present).toEqual(next.draft);
 });
 it("resolves replacements through actual catalog assets and preserves support constraints",()=>{
  const c=context(),next=applyVoicePlan(c,plan(action("replace",{productId:"dining-chair"})));expect(next.error).toBeNull();expect(next.draft.items[c.selected].productId).toBe("dining-chair");
  const blocked=applyVoicePlan(c,plan(action("replace",{target:"corner-cabinet",productId:"dining-chair"})));expect(blocked.error).toContain("supports");expect(blocked.draft).toBe(c.draft);
 });
 it("rejects locked motion and rolls back earlier changes if any operation fails",()=>{
  const c=context();c.draft.items[c.selected].locked=true;const result=applyVoicePlan(c,plan(action("lighting",{lighting:"Night"}),action("adjust",{dx:.2})));expect(result.error).toContain("Unlock");expect(result.draft).toBe(c.draft);expect(result.draft.lighting).toBe("Original");
 });
 it("rejects unknown items, unavailable finishes, malformed actions and non-allowlisted operations",()=>{
  const c=context();for(const a of [action("select",{target:"nonexistent"}),action("color",{color:15}),action("visible"),action("adjust"),action("replace",{productId:"outside-product"})])expect(applyVoicePlan(c,plan(a)).error).toBeTruthy();
  expect(voicePlanSchema.safeParse({summary:"Checkout",actions:[{...action("select"),type:"checkout"}]}).success).toBe(false);expect(voicePlanSchema.safeParse(plan(action("adjust",{dx:5}))).success).toBe(false);
  const wrong={...c,draft:{...c.draft,items:{}}};expect(applyVoicePlan(wrong,plan()).error).toContain("another collection");
 });
 it("previews visibility, selection and room finishes without changing source scenes",()=>{
  const c=context(),snapshot=JSON.stringify(scene),result=applyVoicePlan(c,plan(action("visible",{visible:false}),action("select",{target:"corner-vase"}),action("background",{background:"sage"})));expect(result.error).toBeNull();expect(result.draft.items[c.selected].visible).toBe(false);expect(result.selected).toBe("corner-vase");expect(result.draft.background?.preset).toBe("sage");expect(JSON.stringify(scene)).toBe(snapshot);
 });
});
