import sharp from "sharp";
import type {BackgroundUnderstanding} from "@/lib/scene/background-understanding";
export async function materialSwatch(photo:Buffer,observation:BackgroundUnderstanding["ground"],masks:Uint8Array[],size:{width:number;height:number}){
 const box=observation.swatch;if(!box||box.xMax<=box.xMin||box.yMax<=box.yMin)return null;
 const left=Math.floor(box.xMin*size.width),top=Math.floor(box.yMin*size.height),width=Math.floor((box.xMax-box.xMin)*size.width),height=Math.floor((box.yMax-box.yMin)*size.height);
 if(width<24||height<24||left+width>size.width||top+height>size.height||masks.some(m=>m.length!==size.width*size.height))return null;
 let foreground=0,total=0;for(let y=top;y<top+height;y+=2)for(let x=left;x<left+width;x+=2){total++;if(masks.some(m=>m[y*size.width+x]>127))foreground++;}
 // Do not send product pixels to a material generator. An unsafe/no swatch uses
 // the observed material description instead of the whole source photograph.
 if(foreground/Math.max(1,total)>.005)return null;
 return sharp(photo,{limitInputPixels:2_560_000}).extract({left,top,width,height}).resize({width:512,height:512,fit:"inside",withoutEnlargement:true}).png().toBuffer();
}
export async function prepareMaterialTile(bytes:Buffer){
 const image=sharp(bytes,{limitInputPixels:24_000_000,animated:false}),{width,height}=await image.metadata();
 if(!width||!height||width<128||height<128)throw new Error("MATERIAL_IMAGE_INVALID");
 // Discard generated frame fringes; mirrored wrapping avoids hard repeat seams.
 const side=Math.floor(Math.min(width,height)*.9);
 return image.extract({left:Math.floor((width-side)/2),top:Math.floor((height-side)/2),width:side,height:side}).resize(1024,1024).webp({quality:92}).toBuffer();
}
