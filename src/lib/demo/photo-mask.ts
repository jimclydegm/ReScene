export type PhotoMask = {
  id: string;
  maskPath: string;
  sha256: string;
  bounds: number[]; // x, y, width, height in the public selection frame
  anchor: number[];
  area: number;
};
export type DecodedPhotoMask = PhotoMask & { pixels: Uint8Array | Uint8ClampedArray };

/** Crop and choose a label point inside the silhouette, away from edges/holes. */
export function maskGeometry(pixels: Uint8Array, width: number, height: number) {
  if (!Number.isSafeInteger(width*height) || width<1 || height<1 || pixels.length!==width*height || pixels.length>2_560_000) throw new Error("Invalid mask frame");
  let xMin=width,yMin=height,xMax=0,yMax=0,area=0;
  const distances=new Uint16Array(pixels.length),infinity=width+height;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=y*width+x;
    if(pixels[i]<128) continue;
    area++;xMin=Math.min(xMin,x);yMin=Math.min(yMin,y);xMax=Math.max(xMax,x+1);yMax=Math.max(yMax,y+1);
    distances[i]=Math.min(x?distances[i-1]+1:1,y?distances[i-width]+1:1,infinity);
  }
  if(!area) throw new Error("Empty mask");
  let best=0,max=0;
  for(let y=height-1;y>=0;y--) for(let x=width-1;x>=0;x--) {
    const i=y*width+x;
    if(!distances[i]) continue;
    distances[i]=Math.min(distances[i],x<width-1?distances[i+1]+1:1,y<height-1?distances[i+width]+1:1);
    if(distances[i]>max){max=distances[i];best=i;}
  }
  return { bounds:[xMin,yMin,xMax-xMin,yMax-yMin], anchor:[best%width,Math.floor(best/width)], area };
}

/** Image-space picking uses alpha, including holes; boxes only narrow the search. */
export function pickPhotoProduct(masks: DecodedPhotoMask[], x: number, y: number) {
  if(!Number.isFinite(x)||!Number.isFinite(y)) return null;
  const hits=masks.filter(m=>{
    const [left,top,width,height]=m.bounds,px=Math.floor(x-left),py=Math.floor(y-top);
    return px>=0&&py>=0&&px<width&&py<height&&m.pixels[py*width+px]>=128;
  });
  return hits.sort((a,b)=>a.area-b.area)[0]?.id ?? null;
}

/** SVG preserveAspectRatio=meet can letterbox. Ignore those margins. */
export function photoPoint(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number},width:number,height:number) {
  if(rect.width<=0||rect.height<=0) return null;
  const scale=Math.min(rect.width/width,rect.height/height);
  const x=(clientX-rect.left-(rect.width-width*scale)/2)/scale;
  const y=(clientY-rect.top-(rect.height-height*scale)/2)/scale;
  return x>=0&&y>=0&&x<width&&y<height?{x,y}:null;
}
