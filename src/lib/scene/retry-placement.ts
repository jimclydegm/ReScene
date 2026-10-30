import {Box3,Matrix4,Quaternion,Vector3} from "three";
import {geometry} from "@/lib/appearance/bake";
import {samPose,type ModelPlacement} from "./composition";
export function retryPlacement(bytes:Buffer,metadata:unknown,anchor:{position:[number,number,number];placement:ModelPlacement;metadata:unknown}){
 const old=samPose(anchor.metadata),pose=samPose(metadata),frame=new Quaternion(...anchor.placement.rotation).multiply(old.rotation.clone().invert());
 const unit=anchor.placement.scale[0]/old.scale.x;
 const origin=new Vector3(...anchor.position).add(new Vector3(...anchor.placement.offset)).sub(old.position.clone().applyQuaternion(frame).multiplyScalar(unit));
 const rotation=frame.clone().multiply(pose.rotation),scale=pose.scale.multiplyScalar(unit),matrix=new Matrix4().compose(new Vector3(),rotation,scale);
 const bounds=new Box3().setFromPoints(geometry(bytes,matrix,0).flatMap(t=>t.points));if(bounds.isEmpty())throw new Error("RETRY_GEOMETRY_EMPTY");
 const pivot=bounds.getCenter(new Vector3());pivot.y=bounds.min.y;
 return {position:pose.position.applyQuaternion(frame).multiplyScalar(unit).add(origin).add(pivot).toArray() as [number,number,number],placement:{version:"sam3d-layout-v1" as const,rotation:rotation.toArray(),scale:scale.toArray(),offset:pivot.clone().negate().toArray(),size:bounds.getSize(new Vector3()).toArray()}};
}
