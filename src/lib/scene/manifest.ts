import { z } from "zod";
import { Matrix4, Quaternion, Vector3 } from "three";
import { compositionSchema, modelPlacementSchema } from "./composition";
import { lightingSchema } from "./lighting";
import { productSchema } from "@/lib/validation/products";
const vec=z.tuple([z.number().finite().min(-1000).max(1000),z.number().finite().min(-1000).max(1000),z.number().finite().min(-1000).max(1000)]);
const positive=z.tuple([z.number().positive().max(1000),z.number().positive().max(1000),z.number().positive().max(1000)]);
export const worldTransformSchema=z.object({position:vec,rotation:z.tuple([z.number().min(-1).max(1),z.number().min(-1).max(1),z.number().min(-1).max(1),z.number().min(-1).max(1)]).refine(q=>Math.abs(Math.hypot(...q)-1)<.001),scale:positive}).strict();
export const snapshotSchema=z.object({
 schemaVersion:z.literal(2),coordinates:z.object({handedness:z.literal("right"),upAxis:z.literal("Y"),units:z.literal("approximate")}).strict(),title:z.string().min(1).max(160),description:z.string().max(2000).nullable(),revision:z.number().int().nonnegative(),approximateGeometry:z.literal(true),
 composition:compositionSchema.nullable(),lighting:lightingSchema,
 surfaces:z.object({floorAssetId:z.uuid().nullable(),wallAssetId:z.uuid().nullable()}).strict(),
 objects:z.array(z.object({id:z.uuid(),label:z.string().min(1).max(120),modelAssetId:z.uuid(),transform:worldTransformSchema,productId:z.uuid().nullable()}).strict()).min(1).max(10),
 products:z.array(productSchema.extend({id:z.uuid(),imageAssetId:z.uuid().nullable(),currency:productSchema.shape.currency.nullable()}).strict().refine(p=>(p.price===null)===(p.currency===null),"Price and currency must be paired")).max(10)
}).strict().superRefine((m,ctx)=>{
 if(new Set(m.objects.map(o=>o.id)).size!==m.objects.length||new Set(m.products.map(p=>p.id)).size!==m.products.length)ctx.addIssue({code:"custom",message:"Duplicate object/product IDs"});
 const ids=new Set(m.products.map(p=>p.id)),used=new Set(m.objects.flatMap(o=>o.productId?[o.productId]:[]));
 if([...ids].some(id=>!used.has(id))||[...used].some(id=>!ids.has(id)))ctx.addIssue({code:"custom",message:"Invalid product references"});
 if(m.composition&&new Vector3(...m.composition.camera.position).distanceTo(new Vector3(...m.composition.camera.target))<.1)ctx.addIssue({code:"custom",message:"Invalid camera target"});
});
export type Snapshot=z.infer<typeof snapshotSchema>;
export type WorldTransform=z.infer<typeof worldTransformSchema>;
export function snapshotAssets(m:Snapshot){return [...new Set([...m.objects.map(o=>o.modelAssetId),...m.products.flatMap(p=>p.imageAssetId?[p.imageAssetId]:[]),...[m.surfaces.floorAssetId,m.surfaces.wallAssetId].filter((v):v is string=>!!v)])].sort();}
export function flattenTransform(o:{positionX:number;positionY:number;positionZ:number;rotationX:number;rotationY:number;rotationZ:number;rotationW:number;scaleX:number;scaleY:number;scaleZ:number;initialTransform:unknown},bounds:{min:[number,number,number];max:[number,number,number]}):WorldTransform{
 const parsed=modelPlacementSchema.safeParse(o.initialTransform);
 const f=1.5/Math.max(...bounds.max.map((v,i)=>v-bounds.min[i]),.001);
 const baseline=parsed.success?parsed.data:{rotation:[0,0,0,1] as [number,number,number,number],scale:[f,f,f] as [number,number,number],offset:[-(bounds.min[0]+bounds.max[0])/2*f,-bounds.min[1]*f,-(bounds.min[2]+bounds.max[2])/2*f] as [number,number,number]};
 const q=new Quaternion(o.rotationX,o.rotationY,o.rotationZ,o.rotationW);
 if(Math.abs(q.length()-1)>.001)throw new Error("Non-unit draft quaternion");
 const matrix=new Matrix4().compose(new Vector3(o.positionX,o.positionY,o.positionZ),q,new Vector3(o.scaleX,o.scaleY,o.scaleZ)).multiply(new Matrix4().makeTranslation(...baseline.offset)).multiply(new Matrix4().compose(new Vector3(),new Quaternion(...baseline.rotation),new Vector3(...baseline.scale)));
 const p=new Vector3(),r=new Quaternion(),s=new Vector3();matrix.decompose(p,r,s);
 return worldTransformSchema.parse({position:p.toArray(),rotation:r.toArray(),scale:s.toArray()});
}
