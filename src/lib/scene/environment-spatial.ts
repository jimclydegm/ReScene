import {Vector3} from "three";
import {backgroundCamera} from "./background";
import {depthAt,type DepthGrid} from "@/lib/appearance/environment-depth";
import type {SceneComposition} from "./composition";
export type EnvironmentAnchor={mask:Uint8Array;position:[number,number,number];size:[number,number,number]};
const median=(v:number[])=>{const s=v.filter(Number.isFinite).sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
/** VGGT is scale-ambiguous. Calibrate it against reconstructed foregrounds in
 * the saved camera frame, rather than equating a whole-image median with the
 * camera target. No metric measurements or category-specific distances. */
export function foregroundDepthScale(grid:DepthGrid,composition:SceneComposition,anchors:EnvironmentAnchor[]){
 const camera=backgroundCamera(composition.camera),ratios:number[]=[];
 for(const a of anchors){if(a.mask.length!==grid.sourceWidth*grid.sourceHeight)throw new Error("ENVIRONMENT_MASK_SIZE");const values:number[]=[];
  for(let y=2;y<grid.sourceHeight-2;y+=8)for(let x=2;x<grid.sourceWidth-2;x+=8){if(a.mask[y*grid.sourceWidth+x]<128)continue;const d=depthAt(grid,x/grid.sourceWidth,y/grid.sourceHeight);if(d)values.push(d.depth);}
  const center=new Vector3(a.position[0],a.position[1]+a.size[1]/2,a.position[2]).applyMatrix4(camera.matrixWorldInverse),expected=-center.z-Math.min(a.size[0],a.size[2])*.15;
  if(values.length>=12&&expected>.05){const ratio=expected/median(values);if(ratio>0&&ratio<1000)ratios.push(ratio);}
 }
 if(!ratios.length)return null;const mid=median(ratios),consistent=ratios.filter(v=>v/mid>.5&&v/mid<2);
 return {scale:median(consistent),anchors:consistent.length,spread:Math.max(...consistent)/Math.max(1e-8,Math.min(...consistent))};
}
export function estimateBackgroundSpatial(composition:SceneComposition,grid:DepthGrid|null,anchors:EnvironmentAnchor[]){
 const camera=backgroundCamera(composition.camera),target=new Vector3(...composition.camera.target),distance=camera.position.distanceTo(target);
 const subjectHeight=Math.max(.25,...anchors.map(a=>a.size[1])),forward=target.clone().sub(camera.position);forward.y=0;forward.normalize();
 const back=Math.max(0,...anchors.map(a=>new Vector3(...a.position).sub(target).dot(forward)+a.size[2]/2));
 const near=back+subjectHeight*.25,fallback=Math.max(near,subjectHeight*.85),calibration=grid?foregroundDepthScale(grid,composition,anchors):null,depths:number[]=[];
 if(grid&&calibration){for(let y=.04;y<.6;y+=.025)for(let x=.04;x<.96;x+=.025){const i=Math.floor(y*grid.sourceHeight)*grid.sourceWidth+Math.floor(x*grid.sourceWidth);if(anchors.some(a=>a.mask[i]>127))continue;const d=depthAt(grid,x,y);if(d)depths.push(d.depth*calibration.scale-distance);}}
 const measured=depths.length>=24?median(depths):NaN;
 // Never guess a distant backdrop from invalid/foreground depth. Preserve
 // actual long backgrounds when supported by confident relative depth.
 const valid=Number.isFinite(measured)&&measured>=near*.65&&measured<Math.max(80,distance*12);
 const rearDistance=valid?Math.max(near,measured):fallback;
 return {rearDistance,curveRadius:Math.max(.15,Math.min(subjectHeight*.65,rearDistance*.6)),confidence:valid?Math.min(.9,.5+(calibration?.anchors??0)*.08):.25,source:valid?"foreground-calibrated-depth" as const:"subject-relative-fallback" as const};
}
