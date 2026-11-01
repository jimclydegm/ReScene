import sharp from "sharp";
import {Vector3} from "three";
import {backgroundCamera} from "@/lib/scene/background";
import type {SceneComposition} from "@/lib/scene/composition";
import type {EnvironmentGeometry,EnvironmentObservation} from "@/lib/scene/environment-plan";
type Surface=EnvironmentGeometry["surfaces"][number];
export type SurfaceTile={surface:Surface;observation:EnvironmentObservation["surfaces"][number];index:number};
/** Orthogonal world axes prevent perspective/shear from being baked twice. */
export function orthogonalTile(tile:NonNullable<Surface["tile"]>){
 const u=new Vector3(...tile.u),v=new Vector3(...tile.v),length=v.length();v.addScaledVector(u,-v.dot(u)/u.lengthSq()).normalize().multiplyScalar(length);
 return {...tile,u:u.toArray() as [number,number,number],v:v.toArray() as [number,number,number]};
}
export function materialTargets(geometry:EnvironmentGeometry,plan:EnvironmentObservation):SurfaceTile[]{
 return geometry.surfaces.flatMap(surface=>{const index=surface.materialIndex,observation=index===undefined?undefined:plan.surfaces[index];return observation&&surface.textured&&surface.tile&&surface.role!=="window"&&surface.role!=="opening"?[{surface,observation,index:index!}]:[];});
}
/** Perspective-rectified material evidence, not a crop containing the room. */
export async function rectifyMaterial(plate:Buffer,surface:Surface,composition:SceneComposition,size=1024){
 if(!surface.tile)throw new Error("ENVIRONMENT_TILE_REQUIRED");const {data,info}=await sharp(plate).removeAlpha().toColourspace("srgb").raw().toBuffer({resolveWithObject:true}),tile=orthogonalTile(surface.tile),camera=backgroundCamera(composition.camera),out=Buffer.alloc(size*size*3),a=new Vector3(...tile.origin),u=new Vector3(...tile.u),v=new Vector3(...tile.v),point=new Vector3();
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  point.copy(a).addScaledVector(u,(x+.5)/size).addScaledVector(v,(y+.5)/size).project(camera);
  const px=Math.max(0,Math.min(info.width-1,(point.x*.5+.5)*info.width-.5)),py=Math.max(0,Math.min(info.height-1,(.5-point.y*.5)*info.height-.5)),x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(info.width-1,x0+1),y1=Math.min(info.height-1,y0+1),fx=px-x0,fy=py-y0;
  for(let c=0;c<3;c++)out[(y*size+x)*3+c]=data[(y0*info.width+x0)*3+c]*(1-fx)*(1-fy)+data[(y0*info.width+x1)*3+c]*fx*(1-fy)+data[(y1*info.width+x0)*3+c]*(1-fx)*fy+data[(y1*info.width+x1)*3+c]*fx*fy;
 }
 return sharp(out,{raw:{width:size,height:size,channels:3}}).png().toBuffer();
}
/** Preserve native material detail, remove a broad lighting ramp, then reconcile
 * opposite borders without mirroring the whole texture into a visible motif. */
export async function prepareSurfaceTile(bytes:Buffer,relief=false){
 const {data,info}=await sharp(bytes,{limitInputPixels:10_000_000}).resize({width:2048,height:2048,fit:"inside",withoutEnlargement:true}).removeAlpha().toColourspace("srgb").raw().toBuffer({resolveWithObject:true});const {width:w,height:h}=info,out=Buffer.from(data);
 const sx=[0,0,0],sy=[0,0,0];let xx=0,yy=0;
 for(let y=0;y<h;y+=4)for(let x=0;x<w;x+=4){const a=(x+.5)/w-.5,b=(y+.5)/h-.5;xx+=a*a;yy+=b*b;for(let c=0;c<3;c++){const z=data[(y*w+x)*3+c];sx[c]+=z*a;sy[c]+=z*b;}}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++)out[(y*w+x)*3+c]=Math.max(0,Math.min(255,data[(y*w+x)*3+c]-(sx[c]/xx*((x+.5)/w-.5)+sy[c]/yy*((y+.5)/h-.5))));
 const border=Math.max(2,Math.round(Math.min(w,h)*.025));
 for(let i=0;i<border;i++){const weight=(1-i/border)*.5;for(let y=0;y<h;y++)for(let c=0;c<3;c++){const a=(y*w+i)*3+c,b=(y*w+w-1-i)*3+c,d=(out[b]-out[a])*weight;out[a]+=d;out[b]-=d;}for(let x=0;x<w;x++)for(let c=0;c<3;c++){const a=(i*w+x)*3+c,b=((h-1-i)*w+x)*3+c,d=(out[b]-out[a])*weight;out[a]+=d;out[b]-=d;}}
 if(relief){
  const base=await sharp(out,{raw:{width:w,height:h,channels:3}}).greyscale().raw().toBuffer(),blur=await sharp(base,{raw:{width:w,height:h,channels:1}}).blur(Math.max(1,Math.min(w,h)*.015)).greyscale().raw().toBuffer();
  const height=Buffer.alloc(w*h);for(let i=0;i<height.length;i++)height[i]=Math.max(80,Math.min(176,128+(base[i]-blur[i])*2));
  return sharp(height,{raw:{width:w,height:h,channels:1}}).png().toBuffer();
 }
 return sharp(out,{raw:{width:w,height:h,channels:3}}).png().toBuffer();
}
/** One approved derived atlas preserves the existing publication allowlist.
 * Rectangles use bottom-left UV coordinates with mip-safe gutters. */
export async function packEnvironmentAtlas(plate:Buffer,geometry:EnvironmentGeometry,tiles:Map<number,Buffer>){
 const count=tiles.size+1,columns=Math.ceil(Math.sqrt(count)),cell=Math.min(2048,Math.floor(4096/columns)),side=cell*columns,gutter=8,regions=new Map<number,[number,number,number,number]>(),composites:{input:Buffer;left:number;top:number}[]=[];
 const entries:[number,Buffer][]=[[-1,plate],...tiles];
 for(const [i,[key,bytes]]of entries.entries()){
  const image=await sharp(bytes).resize(cell-gutter*2,cell-gutter*2,{fit:"inside",withoutEnlargement:true}).png().toBuffer({resolveWithObject:true}),left=(i%columns)*cell+gutter,top=Math.floor(i/columns)*cell+gutter,w=image.info.width,h=image.info.height;
  const padded=await sharp(image.data).extend({top:gutter,bottom:gutter,left:gutter,right:gutter,extendWith:"copy"}).png().toBuffer();composites.push({input:padded,left:left-gutter,top:top-gutter});regions.set(key,[(left+.5)/side,1-(top+h-.5)/side,(left+w-.5)/side,1-(top+.5)/side]);
 }
 const mapped=structuredClone(geometry);
 for(const s of mapped.surfaces){
  if(!s.textured)continue;const opening=s.role==="window"||s.role==="opening",rect=regions.get(opening?-1:s.materialIndex??-2);
  if(!rect){s.textured=false;delete s.tile;delete s.relief;continue;}
  s.atlas={mode:opening?"photo":"tile",rect};if(s.tile)s.tile=orthogonalTile(s.tile);s.materialOnly=!opening;
 }
 return {bytes:await sharp({create:{width:side,height:side,channels:3,background:"#ffffff"}}).composite(composites).webp({quality:98,effort:5}).toBuffer(),geometry:mapped,width:side,height:side};
}
