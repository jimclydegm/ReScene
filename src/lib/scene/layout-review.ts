import { Matrix4, Quaternion, Vector3 } from "three";
import { z } from "zod";
import { geometry, photoCamera, visibility } from "@/lib/appearance/bake";
import type { ModelPlacement, SceneComposition } from "./composition";

export const layoutReviewSchema=z.object({version:z.literal("mask-layout-v1"),objects:z.array(z.object({id:z.string(),label:z.string(),before:z.number(),after:z.number(),adjusted:z.boolean(),orientationAdjusted:z.boolean().default(false),needsReview:z.boolean()})),needsReview:z.boolean()});
export type LayoutReview=z.infer<typeof layoutReviewSchema>;
type Placement={id:string;position:[number,number,number];placement:ModelPlacement};
type Input={id:string;label:string;bytes:Buffer;mask:Uint8Array;support:string;parentId?:string|null};

function maskBounds(mask:Uint8Array,width:number,height:number){
 let x0=width,y0=height,x1=0,y1=0,area=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]>127){x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);area++;}
 if(area<20)throw new Error("REVIEW_MASK_EMPTY");
 return [x0/width,y0/height,x1/width,y1/height];
}
function verticalMask(mask:Uint8Array,width:number,height:number){
 let n=0,x=0,y=0,xx=0,yy=0,xy=0;
 for(let py=0;py<height;py+=2)for(let px=0;px<width;px+=2)if(mask[py*width+px]>127){n++;x+=px;y+=py;xx+=px*px;yy+=py*py;xy+=px*py;}
 if(!n)return false;xx-=x*x/n;yy-=y*y/n;xy-=x*y/n;
 let ax=.1,ay=1;for(let i=0;i<20;i++){const bx=xx*ax+xy*ay,by=xy*ax+yy*ay,d=Math.hypot(bx,by);if(!d)return false;ax=bx/d;ay=by/d;}
 return Math.atan2(Math.abs(ax),Math.abs(ay))<Math.PI/22;
}

function principal(points:Vector3[]){
 const center=points.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/points.length),cov=new Matrix4(),values=new Array(9).fill(0);
 for(const p of points){const a=p.clone().sub(center).toArray();for(let i=0;i<3;i++)for(let j=0;j<3;j++)values[i*3+j]+=a[i]*a[j];}
 cov.set(values[0],values[1],values[2],0,values[3],values[4],values[5],0,values[6],values[7],values[8],0,0,0,0,1);
 const axis=new Vector3(.3,1,.2).normalize();for(let i=0;i<24;i++)axis.applyMatrix4(cov).normalize();if(axis.y<0)axis.negate();return axis;
}

// Compare actual projected geometry with reviewed source pixels. Bounded search
// adjusts layout only; no regeneration, image restyling or guessed product identity.
export function reviewLayout(objects:Placement[],inputs:Input[],composition:SceneComposition,size:{width:number;height:number}):LayoutReview{
 const {width,height}=size;if(width*height>2_560_000||inputs.length>10||inputs.some(o=>o.mask.length!==width*height))throw new Error("REVIEW_FRAME");
 const camera=photoCamera(composition.camera),view=camera.matrixWorldInverse;
 const report:LayoutReview={version:"mask-layout-v1",objects:[],needsReview:false};
 for(const object of objects){
  const input=inputs.find(i=>i.id===object.id);if(!input||input.parentId)continue;
  const base=structuredClone(object),target=maskBounds(input.mask,width,height);
  const matrix=(o:Placement)=>new Matrix4().makeTranslation(...o.position).multiply(new Matrix4().makeTranslation(...o.placement.offset)).multiply(new Matrix4().compose(new Vector3(),new Quaternion(...o.placement.rotation),new Vector3(...o.placement.scale)));
  const triangles=geometry(input.bytes,new Matrix4(),0),all=triangles.flatMap(t=>t.points),step=Math.max(1,Math.ceil(all.length/1600)),sample=all.filter((_,i)=>i%step===0);
  const edges=(o:Placement)=>{
   const m=matrix(o),box=[Infinity,Infinity,-Infinity,-Infinity];
   for(const point of sample){const p=point.clone().applyMatrix4(m);if(p.clone().applyMatrix4(view).z>=-.02)return null;const q=p.project(camera),x=(q.x+1)/2,y=(1-q.y)/2;box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);}
   return box;
  };
  const loss=(o:Placement)=>{const b=edges(o);return !b?Infinity:b.reduce((s,v,i)=>s+(v-target[i])**2,0);};
  const iou=(o:Placement)=>{
   const w=192,h=Math.max(32,Math.round(w*height/width)),m=matrix(o),projected=triangles.map(t=>({...t,points:t.points.map(p=>p.clone().applyMatrix4(m)) as typeof t.points}));
   const raster=visibility(projected,camera,w,h).owners;let intersection=0,union=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=raster[y*w+x]>=0,b=input.mask[Math.min(height-1,Math.floor((y+.5)*height/h))*width+Math.min(width-1,Math.floor((x+.5)*width/w))]>127;intersection+=Number(a&&b);union+=Number(a||b);}
   return intersection/Math.max(1,union);
  };
  const before=iou(base);let best=structuredClone(base),bestIoU=before;
  const candidates=[structuredClone(base)];
  // A slender, near-vertical reference may justify a gravity-aligned candidate.
  // It is accepted only by mask overlap, never by a lamp/person category rule.
  const ratio=(target[3]-target[1])*height/Math.max(1,(target[2]-target[0])*width);
  if(ratio>2.8&&verticalMask(input.mask,width,height)){const o=structuredClone(base),world=sample.map(p=>p.clone().applyMatrix4(matrix(o))),axis=principal(world),tilt=Math.acos(Math.max(-1,Math.min(1,axis.y)));
   if(tilt<.5&&tilt>.01){const correction=new Quaternion().setFromUnitVectors(axis,new Vector3(0,1,0));o.placement.rotation=correction.multiply(new Quaternion(...o.placement.rotation)).toArray();
    // Recompute bottom-centered pivot from actual geometry after rotation.
    const rotated=sample.map(p=>p.clone().multiply(new Vector3(...o.placement.scale)).applyQuaternion(new Quaternion(...o.placement.rotation))),minY=Math.min(...rotated.map(p=>p.y));o.placement.offset[1]=-minY;candidates.push(o);}
  }
  for(const candidate of candidates){
   let current=structuredClone(candidate),score=loss(current);const distance=Math.max(1,new Vector3(...current.position).distanceTo(camera.position));
   const grounded=input.support==="floor";if(grounded)current.position[1]=composition.floorY??0;score=loss(current);
   for(const fraction of [.15,.07,.025,.009])for(let pass=0;pass<3;pass++)for(const axis of grounded?[0,2,3]:[0,1,3])for(const sign of [-1,1]){
    const next=structuredClone(current),delta=distance*fraction*sign;
    if(axis===3){const factor=1+fraction*sign;next.placement.scale=next.placement.scale.map(v=>v*factor) as [number,number,number];next.placement.offset=next.placement.offset.map(v=>v*factor) as [number,number,number];next.placement.size=next.placement.size.map(v=>v*factor) as [number,number,number];}
    else next.position[axis]+=delta;
    const factor=next.placement.scale[0]/base.placement.scale[0];if(factor<.4||factor>2.5||new Vector3(...next.position).distanceTo(new Vector3(...base.position))>distance*.65)continue;
    const value=loss(next);if(value<score){current=next;score=value;}
   }
   const overlap=iou(current),uprightPreferred=candidate!==candidates[0]&&overlap>before+.025&&overlap>=bestIoU-.05;if(overlap>bestIoU||uprightPreferred){best=current;bestIoU=overlap;}
  }
  const candidateIoU=bestIoU,improved=candidateIoU>before+.025;
  if(improved){object.position=best.position;object.placement=best.placement;}
  const after=improved?candidateIoU:before,needsReview=after<.65;
  report.objects.push({id:object.id,label:input.label,before,after,adjusted:improved,orientationAdjusted:improved&&best.placement.rotation.some((v,i)=>Math.abs(v-base.placement.rotation[i])>.001),needsReview});report.needsReview ||= needsReview;
 }
 return report;
}

// Shared-mask containment is evidence that separate reconstruction would
// duplicate geometry already represented by the complete supported subject.
export function containedParts(inputs:{id:string;mask:Uint8Array;parentId?:string|null;supportedById?:string|null}[]){
 const parents=new Map<string,string>();
 for(const child of inputs){if(child.parentId||!child.supportedById)continue;const parent=inputs.find(p=>p.id===child.supportedById);if(!parent||parent.parentId||parents.has(parent.id)||parent.mask.length!==child.mask.length)continue;
  let area=0,overlap=0,parentArea=0;for(let i=0;i<child.mask.length;i++){const a=child.mask[i]>127,b=parent.mask[i]>127;area+=Number(a);parentArea+=Number(b);overlap+=Number(a&&b);}
  if(area>40&&parentArea>area*1.15&&overlap/area>.92)parents.set(child.id,parent.id);
 }
 return parents;
}
