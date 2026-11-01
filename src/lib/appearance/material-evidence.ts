import sharp from "sharp";
import {Plane,Ray,Vector3} from "three";
import {z} from "zod";
import {insidePolygon} from "@/lib/scene/environment-geometry";
import {backgroundCamera} from "@/lib/scene/background";
import type {EnvironmentGeometry,EnvironmentObservation} from "@/lib/scene/environment-plan";
import type {SceneComposition} from "@/lib/scene/composition";
import {orthogonalTile} from "./environment-atlas";

export const materialPatchSchema=z.object({id:z.string().max(32),rect:z.tuple([z.number().min(0).max(1),z.number().min(0).max(1),z.number().min(0).max(1),z.number().min(0).max(1)])}).strict().refine(p=>p.rect[2]>p.rect[0]&&p.rect[3]>p.rect[1]);
export type MaterialPatch=z.infer<typeof materialPatchSchema>;

/** Largest unoccluded source rectangle inside each surface, with a cell-sized
 * exclusion margin around products/openings. No generated image is evidence of
 * whether the original material is smooth, relief or a color pattern. */
export async function materialEvidence(source:Buffer,plan:EnvironmentObservation,masks:Uint8Array[]){
 const meta=await sharp(source).metadata(),width=meta.width!,height=meta.height!,cols=96,rows=Math.max(24,Math.round(cols*height/width));
 if(masks.some(m=>m.length!==width*height))throw new Error("ENVIRONMENT_MASK_SIZE");
 const blocked=new Uint8Array(cols*rows);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(masks.some(m=>m[y*width+x]>127))blocked[Math.floor(y/height*rows)*cols+Math.floor(x/width*cols)]=1;
 const patches:MaterialPatch[]=[];
 for(const s of plan.surfaces){
  const valid=new Uint8Array(cols*rows);
  for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++){
   const corners=[{x:x/cols,y:y/rows},{x:(x+1)/cols,y:y/rows},{x:x/cols,y:(y+1)/rows},{x:(x+1)/cols,y:(y+1)/rows}];
   if(corners.some(p=>!insidePolygon(p,s.polygon)||plan.openings.some(o=>o.surfaceId===s.id&&insidePolygon(p,o.polygon))))continue;
   let clear=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(blocked[(y+dy)*cols+x+dx])clear=false;
   if(clear)valid[y*cols+x]=1;
  }
  const heights=new Uint32Array(cols);let best:{x:number;y:number;w:number;h:number;score:number}|null=null;
  for(let y=0;y<rows;y++){
   for(let x=0;x<cols;x++)heights[x]=valid[y*cols+x]?heights[x]+1:0;
   for(let x=0;x<cols;x++){let h=heights[x];for(let j=x;j<cols&&h;j++){h=Math.min(h,heights[j]);const w=j-x+1,aspect=w/cols*width/(h/rows*height),score=w*h*Math.min(1,aspect,1/aspect);if(w>=3&&h>=3&&(!best||score>best.score))best={x,y:y-h+1,w,h,score};}}
  }
  if(best)patches.push({id:s.id,rect:[best.x/cols,best.y/rows,(best.x+best.w)/cols,(best.y+best.h)/rows]});
 }
 return patches;
}
export async function cropMaterialEvidence(source:Buffer,patch:MaterialPatch){
 const m=await sharp(source).metadata(),left=Math.round(patch.rect[0]*m.width!),top=Math.round(patch.rect[1]*m.height!),width=Math.max(1,Math.round(patch.rect[2]*m.width!)-left),height=Math.max(1,Math.round(patch.rect[3]*m.height!)-top);
 return sharp(source).extract({left,top,width,height}).resize({width:768,height:768,fit:"inside",withoutEnlargement:true}).png().toBuffer();
}
export function tileFromEvidence(surface:EnvironmentGeometry["surfaces"][number],patch:MaterialPatch,composition:SceneComposition){
 const camera=backgroundCamera(composition.camera),a=new Vector3(...surface.vertices[0]),b=new Vector3(...surface.vertices[1]),c=surface.vertices.slice(2).map(p=>new Vector3(...p)).find(p=>b.clone().sub(a).cross(p.clone().sub(a)).lengthSq()>1e-12);
 if(!c)return surface.tile;const plane=new Plane().setFromCoplanarPoints(a,b,c),hit=(x:number,y:number)=>new Ray(camera.position,new Vector3(x*2-1,1-y*2,.5).unproject(camera).sub(camera.position).normalize()).intersectPlane(plane,new Vector3());
 const [x0,y0,x1,y1]=patch.rect,origin=hit(x0,y0),u=hit(x1,y0),v=hit(x0,y1);if(!origin||!u||!v)return surface.tile;
 return orthogonalTile({origin:origin.toArray() as [number,number,number],u:u.sub(origin).toArray() as [number,number,number],v:v.sub(origin).toArray() as [number,number,number]});
}
