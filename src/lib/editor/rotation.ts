import {Euler,Quaternion} from "three";
export function rotationControls(q:{rotationX:number;rotationY:number;rotationZ:number;rotationW:number}){
 const e=new Euler().setFromQuaternion(new Quaternion(q.rotationX,q.rotationY,q.rotationZ,q.rotationW),"YXZ");return {pitch:e.x,yaw:e.y,roll:e.z};
}
export function rotationQuaternion(value:{yaw:number;pitch?:number;roll?:number}){
 return new Quaternion().setFromEuler(new Euler(value.pitch??0,value.yaw,value.roll??0,"YXZ"));
}

export function rotationAfterEdit(original:Parameters<typeof rotationControls>[0],edit:{yaw:number;pitch?:number;roll?:number}){
 const previous=rotationControls(original);
 return rotationQuaternion({yaw:edit.yaw,pitch:edit.pitch??previous.pitch,roll:edit.roll??previous.roll});
}
