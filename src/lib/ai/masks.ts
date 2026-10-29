import sharp from "sharp";

// Union full-frame binary masks; useful for a pair of shoes or another multi-part product.
export async function combineMasks(images:Buffer[],size:{width:number;height:number}){
  if(images.length<2||images.length>10||!Number.isSafeInteger(size.width*size.height)||size.width<1||size.height<1||size.width*size.height>2_560_000)throw new Error("INVALID_MASK_INPUT");
  const pixels=Buffer.alloc(size.width*size.height);
  for(const image of images){
    const {data,info}=await sharp(image,{limitInputPixels:2_560_000}).removeAlpha().greyscale().raw().toBuffer({resolveWithObject:true});
    if(info.width!==size.width||info.height!==size.height||info.channels!==1)throw new Error("MASK_FRAME_MISMATCH");
    for(let i=0;i<pixels.length;i++)if(data[i]>=128)pixels[i]=255;
  }
  let area=0,xMin=size.width,yMin=size.height,xMax=0,yMax=0;
  for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++)if(pixels[y*size.width+x]){area++;xMin=Math.min(xMin,x);yMin=Math.min(yMin,y);xMax=Math.max(xMax,x+1);yMax=Math.max(yMax,y+1);}
  if(!area)throw new Error("EMPTY_MASK");
  return {png:await sharp(pixels,{raw:{...size,channels:1}}).png().toBuffer(),area,bounds:{xMin,yMin,xMax,yMax}};
}
