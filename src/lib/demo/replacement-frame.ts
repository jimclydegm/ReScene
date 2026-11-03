import { Box3, Quaternion, Vector3 } from "three";
import type { ModelPlacement } from "@/lib/scene/composition";

type Point = [number, number, number];
type Frame = { placement: ModelPlacement; hull?: Point[]; dimensions: string };
const cache = new WeakMap<ModelPlacement, WeakMap<ModelPlacement, ModelPlacement>>();
const headings = new WeakMap<ModelPlacement, { dimensions: string; hull?: Point[]; value: number | null }>();
const halfTurn = (a: number) => Math.atan2(Math.sin(a * 2), Math.cos(a * 2)) / 2;

function horizontalHull(points: Point[]) {
  const sorted = points.map(p => [p[0], p[2]] as [number, number])
    .sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cross = (a: number[],b: number[],c: number[]) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const lower: [number,number][] = [], upper: [number,number][] = [];
  for (const p of sorted) { while(lower.length>1 && cross(lower.at(-2)!,lower.at(-1)!,p)<=0) lower.pop(); lower.push(p); }
  for (const p of sorted.toReversed()) { while(upper.length>1 && cross(upper.at(-2)!,upper.at(-1)!,p)<=0) upper.pop(); upper.push(p); }
  return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
function points(frame: Frame) {
  const q = new Quaternion(...frame.placement.rotation), scale = new Vector3(...frame.placement.scale);
  return frame.hull!.map(p => new Vector3(...p).multiply(scale).applyQuaternion(q).toArray());
}
function measuredHeading(frame: Frame): number | null {
  const width = Number(frame.dimensions.match(/W([\d.]+)/)?.[1]);
  const depth = Number(frame.dimensions.match(/D([\d.]+)/)?.[1]);
  // Near-square objects have no reliable front axis from a footprint alone.
  if (!frame.hull?.length || (width && depth && Math.max(width/depth,depth/width)<1.35)) return null;
  const hull = horizontalHull(points(frame));
  let best: { area: number; yaw: number; aspect: number } | null = null;
  for (let i=0;i<hull.length;i++) {
    const a=hull[i],b=hull[(i+1)%hull.length], angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
    const u=hull.map(p=>p[0]*Math.cos(angle)+p[1]*Math.sin(angle));
    const v=hull.map(p=>-p[0]*Math.sin(angle)+p[1]*Math.cos(angle));
    const w=Math.max(...u)-Math.min(...u),d=Math.max(...v)-Math.min(...v),area=w*d;
    if (!w || !d) continue;
    const dominantAngle = w>=d ? angle : angle+Math.PI/2;
    const yaw=halfTurn(-dominantAngle),aspect=Math.max(w/d,d/w);
    if (!best || area<best.area-1e-8 || (Math.abs(area-best.area)<1e-8 && Math.abs(yaw)<Math.abs(best.yaw))) best={area,yaw,aspect};
  }
  return best && best.aspect>=1.35 ? best.yaw : null;
}
function heading(frame: Frame) {
  const prior=headings.get(frame.placement);
  if (prior && prior.dimensions===frame.dimensions && prior.hull===frame.hull) return prior.value;
  const value=measuredHeading(frame);
  headings.set(frame.placement,{dimensions:frame.dimensions,hull:frame.hull,value});
  return value;
}

/** Match elongated furniture/bag headings without stretching geometry or moving
 * the slot. Imported photo-camera yaw is not the shopper's arrangement yaw. */
export function alignReplacementFrame(source: Frame, target: Frame): ModelPlacement {
  let byTarget=cache.get(source.placement);
  const prior=byTarget?.get(target.placement);
  if (prior) return prior;
  const to=heading(target);
  if (to===null) return source.placement;
  const from=heading(source);
  if (from===null) return source.placement;
  const turn=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),halfTurn(to-from));
  const rotation=turn.clone().multiply(new Quaternion(...source.placement.rotation));
  const offset=new Vector3(...source.placement.offset).applyQuaternion(turn);
  const scale=new Vector3(...source.placement.scale),bounds=new Box3();
  for (const p of source.hull!) bounds.expandByPoint(new Vector3(...p).multiply(scale).applyQuaternion(rotation).add(offset));
  const center=bounds.getCenter(new Vector3());
  offset.sub(new Vector3(center.x,bounds.min.y,center.z));
  const result:ModelPlacement={...source.placement,rotation:rotation.toArray(),offset:offset.toArray(),size:bounds.getSize(new Vector3()).toArray()};
  if (!byTarget) { byTarget=new WeakMap(); cache.set(source.placement,byTarget); }
  byTarget.set(target.placement,result);
  return result;
}
