import {depthAt,type DepthGrid} from "./environment-depth";
import {insidePolygon} from "@/lib/scene/environment-geometry";
import type {EnvironmentObservation} from "@/lib/scene/environment-plan";
/** Match clean-plate depth to the original depth gauge using only unchanged
 * observed background, never the removed objects or a view through glass. */
export function alignCleanDepth(source:DepthGrid,clean:DepthGrid,masks:Uint8Array[],plan:EnvironmentObservation){
 if(Math.abs(clean.sourceWidth/clean.sourceHeight/(source.sourceWidth/source.sourceHeight)-1)>.03)throw new Error("ENVIRONMENT_CLEAN_DEPTH_ASPECT");
 const ratios:number[]=[];
 for(let y=.03;y<.97;y+=.025)for(let x=.03;x<.97;x+=.025){const at=Math.floor(y*source.sourceHeight)*source.sourceWidth+Math.floor(x*source.sourceWidth);if(masks.some(m=>m[at]>127)||plan.openings.some(o=>insidePolygon({x,y},o.polygon)))continue;const a=depthAt(source,x,y),b=depthAt(clean,x,y);if(a&&b)ratios.push(a.depth/b.depth);}
 ratios.sort((a,b)=>a-b);const ratio=ratios[Math.floor(ratios.length/2)],consistent=ratios.filter(v=>Math.abs(v/ratio-1)<.2);
 if(ratios.length<24||consistent.length/ratios.length<.7)throw new Error("ENVIRONMENT_CLEAN_DEPTH_ALIGNMENT");
 const scale=consistent[Math.floor(consistent.length/2)],data=Float32Array.from(clean.data,v=>v*scale);
 return {grid:{...clean,data,sourceWidth:source.sourceWidth,sourceHeight:source.sourceHeight},scale,samples:consistent.length};
}
