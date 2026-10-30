import {Box3,PerspectiveCamera,Vector2,Vector3,WebGLRenderTarget,SRGBColorSpace,type Object3D,type Scene,type WebGLRenderer} from "three";

export function captureSize(width:number,height:number){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw new Error("Viewer size is unavailable.");
 const scale=Math.min(1,4096/width,4096/height,Math.sqrt(8_388_608/(width*height)));
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
export async function captureScene(renderer:WebGLRenderer,scene:Scene,camera:PerspectiveCamera,transparent=false):Promise<Blob>{
 const size=renderer.getDrawingBufferSize(new Vector2()),{width,height}=captureSize(size.x,size.y),target=new WebGLRenderTarget(width,height);
 target.texture.colorSpace=SRGBColorSpace;
 const background=scene.background,clearAlpha=renderer.getClearAlpha(),previous=renderer.getRenderTarget(),helpers:Object3D[]=[];
 const pixels=new Uint8Array(width*height*4);
 try{
  scene.traverse(o=>{if((o.userData.editorHelper||transparent&&o.userData.sceneBackground)&&o.visible){helpers.push(o);o.visible=false;}});
  if(transparent){scene.background=null;renderer.setClearAlpha(0);}
  // Render offscreen so transparent exports cannot flash/change the live view.
  renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
 }finally{renderer.setRenderTarget(previous);scene.background=background;renderer.setClearAlpha(clearAlpha);for(const o of helpers)o.visible=true;target.dispose();}
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
 const context=canvas.getContext("2d");if(!context)throw new Error("Screenshot encoding is unavailable.");
 const image=context.createImageData(width,height);
 for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);
 context.putImageData(image,0,0);
 return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not encode the screenshot.")),"image/png"));
}
export function focusDistance(box:Box3,camera:PerspectiveCamera){
 const radius=Math.max(.01,box.getSize(new Vector3()).length()/2);
 return radius/Math.sin(camera.fov*Math.PI/360)/Math.min(1,camera.aspect)*1.15;
}
