import {demoScenes,changeArrangement,resetItemPatch,replacementError} from "@/lib/demo/scenes";
import {findDemoProduct,itemProductId} from "@/lib/demo/catalog";
import {shuffleFinishes} from "@/lib/demo/room-appearance";
import {voicePlanSchema,type VoicePlan,type VoiceCommandInput} from "./contracts";
/** All-or-nothing preview through the same guards as manual controls. */
export function applyVoicePlan(context:Omit<VoiceCommandInput,"attemptId"|"text">,plan:VoicePlan){
 const scene=demoScenes.find(s=>s.id===context.sceneId),original=context.draft;
 let draft=structuredClone(original),selected=context.selected;
 const fail=(error:string)=>({draft:original,selected:context.selected,error});
 if(!scene||!voicePlanSchema.safeParse(plan).success)return fail("This instruction could not be matched to the collection.");
 if(JSON.stringify(Object.keys(draft.items).sort())!==JSON.stringify(scene.objects.map(o=>o.id).sort()))return fail("This voice request belongs to another collection.");
 for(const [id,item]of Object.entries(draft.items))if(replacementError(scene,id,itemProductId(id,item)))return fail("The selected products do not fit this collection.");
 for(const a of plan.actions){
  if(a.type==="lighting"){if(!a.lighting)return fail("Choose a lighting preset.");draft={...draft,lighting:a.lighting};continue;}
  if(a.type==="background"){if(!a.background)return fail("Choose a background finish.");draft={...draft,background:{preset:a.background}};continue;}
  if(a.type==="shuffle_colors"){draft=shuffleFinishes(draft,()=>.53);continue;}
  const id=a.target??selected;if(!scene.objects.some(o=>o.id===id))return fail("Select a specific product before applying this instruction.");
  if(a.type==="select"){selected=id;continue;}
  const item=draft.items[id],product=findDemoProduct(itemProductId(id,item))!;
  if(a.type==="visible"&&a.visible===null)return fail("Specify whether to show or hide the product.");
  if(a.type==="adjust"&&a.dx===null&&a.dz===null&&a.turn===null)return fail("Specify a small move or rotation.");
  const patch=a.type==="color"?{color:a.color??-1}:a.type==="visible"?{visible:a.visible??item.visible}:a.type==="replace"?{productId:a.productId??""}:a.type==="reset_item"?resetItemPatch(scene,draft,id):{x:item.x+(a.dx??0),z:item.z+(a.dz??0),yaw:Math.atan2(Math.sin(item.yaw+(a.turn??0)),Math.cos(item.yaw+(a.turn??0)))};
  if(a.type==="color"&&(a.color===null||a.color>=product.colors.length))return fail("That finish is unavailable for this product.");
  if(a.type==="replace"&&!findDemoProduct(a.productId??""))return fail("That replacement is not in the demo collection.");
  const result=changeArrangement(scene,draft,id,patch);if(result.error)return fail(result.error);draft=result.draft;
 }
 return {draft,selected,error:null};
}
