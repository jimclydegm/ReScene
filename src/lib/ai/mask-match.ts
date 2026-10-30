import type {z} from "zod";
import type {pixelBoxSchema} from "./controls";
type Box=z.infer<typeof pixelBoxSchema>;
export function boxOverlap(a:Box,b:Box){const intersection=Math.max(0,Math.min(a.xMax,b.xMax)-Math.max(a.xMin,b.xMin))*Math.max(0,Math.min(a.yMax,b.yMax)-Math.max(a.yMin,b.yMin));return intersection/Math.max(1,(a.xMax-a.xMin)*(a.yMax-a.yMin)+(b.xMax-b.xMin)*(b.yMax-b.yMin)-intersection);}
// A single shifted detection is useful when it overlaps the coarse analysis box.
// For repeated concepts require both meaningful overlap and a clear spatial lead.
export function matchMask<T extends {bounds:Box}>(items:T[],box?:Box):T|undefined{
 if(!box)return items.length===1?items[0]:undefined;
 const ranked=items.map(item=>({item,score:(()=>{const a=item.bounds,long=Math.max(box.xMax-box.xMin,box.yMax-box.yMin),distance=Math.hypot((a.xMin+a.xMax-box.xMin-box.xMax)/2,(a.yMin+a.yMax-box.yMin-box.yMax)/2)/long,ratio=((a.xMax-a.xMin)*(a.yMax-a.yMin))/((box.xMax-box.xMin)*(box.yMax-box.yMin));return ratio<.15||ratio>5||distance>1?0:boxOverlap(a,box)+.35*Math.exp(-distance*distance*2);})()})).sort((a,b)=>b.score-a.score);
 if(!ranked.length||ranked[0].score<.09)return;
 if(ranked.length>1&&ranked[0].score-ranked[1].score<.09)return;
 return ranked[0].item;
}
