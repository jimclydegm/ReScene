import sharp from "sharp";
import type { PixelImage } from "./bake";
import type { BackgroundPlan } from "@/lib/scene/background";

// Smooth photographed surfaces can be extended more faithfully from their own
// gradients than from a generative fill. The decision uses residual error, never
// an object category or a scene ID. Textured regions keep the Muse result.
function smoothSurfaceFill(photo:PixelImage,mask:Uint8Array,fill:Buffer,plan?:BackgroundPlan){
  if(!plan||plan.kind==="distant")return;
  let boundary=plan.kind==="planes"?plan.boundary:null;
  if(boundary){
    let best=1,shift=0;const limit=Math.round(photo.height*.07),gap=Math.max(2,Math.round(photo.height*.004));
    for(let dy=-limit;dy<=limit;dy++){
      const values:number[]=[];
      for(let x=0;x<photo.width;x+=8){const y=Math.round((boundary.leftY*(1-x/photo.width)+boundary.rightY*x/photo.width)*photo.height)+dy;
        if(y<gap||y+gap>=photo.height)continue;const a=(y-gap)*photo.width+x,b=(y+gap)*photo.width+x;if(mask[a]||mask[b])continue;
        values.push(Math.abs((photo.data[a*3]+photo.data[a*3+1]+photo.data[a*3+2]-photo.data[b*3]-photo.data[b*3+1]-photo.data[b*3+2])/3));
      }
      values.sort((a,b)=>a-b);const score=values.length>photo.width/24?values[Math.floor(values.length*.5)]:0;
      if(score>best){best=score;shift=dy/photo.height;}
    }
    boundary={leftY:boundary.leftY+shift,rightY:boundary.rightY+shift};
  }
  const region=(x:number,y:number)=>boundary&&y/photo.height<boundary.leftY*(1-x/photo.width)+boundary.rightY*x/photo.width?0:1;
  const basis=(x:number,y:number)=>{const a=x/photo.width*2-1,b=y/photo.height*2-1;return [1,a,b,a*a,a*b,b*b];};
  type Sample={v:number[];rgb:number[]};const groups:[Sample[],Sample[]]=[[],[]],step=Math.max(2,Math.ceil(Math.max(photo.width,photo.height)/160));
  for(let y=0;y<photo.height;y+=step)for(let x=0;x<photo.width;x+=step){const i=y*photo.width+x;if(!mask[i])groups[region(x,y)].push({v:basis(x,y),rgb:[...photo.data.slice(i*3,i*3+3)]});}
  function fit(samples:Sample[]){
    const a=Array.from({length:6},()=>new Float64Array(9));
    for(const s of samples)for(let i=0;i<6;i++){for(let j=0;j<6;j++)a[i][j]+=s.v[i]*s.v[j];for(let k=0;k<3;k++)a[i][6+k]+=s.v[i]*s.rgb[k];}
    for(let i=0;i<6;i++){
      let pivot=i;for(let j=i+1;j<6;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;[a[i],a[pivot]]=[a[pivot],a[i]];
      const divisor=a[i][i];if(Math.abs(divisor)<1e-7)return null;for(let k=i;k<9;k++)a[i][k]/=divisor;
      for(let j=0;j<6;j++)if(j!==i){const value=a[j][i];for(let k=i;k<9;k++)a[j][k]-=value*a[i][k];}
    }
    return a.map(row=>[row[6],row[7],row[8]]);
  }
  const predict=(coeff:number[][],v:number[])=>[0,1,2].map(k=>v.reduce((s,n,i)=>s+n*coeff[i][k],0));
  const fields=groups.map(samples=>{
    if(samples.length<80)return null;let kept=samples,coeff=fit(kept);
    for(let pass=0;pass<3&&coeff;pass++){const c=coeff;const ranked=samples.map(s=>({s,error:Math.hypot(...predict(c,s.v).map((n,k)=>n-s.rgb[k]))})).sort((a,b)=>a.error-b.error);kept=ranked.slice(0,Math.floor(ranked.length*.8)).map(v=>v.s);coeff=fit(kept);}
    if(!coeff)return null;const c=coeff,errors=kept.map(s=>Math.hypot(...predict(c,s.v).map((n,k)=>n-s.rgb[k]))/Math.sqrt(3)).sort((a,b)=>a-b);
    return errors[Math.floor(errors.length*.9)]<=3?coeff:null;
  });
  for(let y=0;y<photo.height;y++)for(let x=0;x<photo.width;x++){const i=y*photo.width+x,c=fields[region(x,y)];if(mask[i]&&c){const rgb=predict(c,basis(x,y));for(let k=0;k<3;k++)fill[i*3+k]=Math.max(0,Math.min(255,Math.round(rgb[k])));}}
}

export async function backgroundFootprint(photo: PixelImage, masks: Uint8Array[]) {
  const count = photo.width * photo.height;
  if (!count || count > 2_560_000 || photo.data.length !== count * 3 || !masks.length || masks.length > 10 || masks.some(m => m.length !== count)) throw new Error("BACKGROUND_INPUT_INVALID");
  const union = Buffer.alloc(count);
  for (let i = 0; i < count; i++) if (masks.some(m => m[i] > 127)) union[i] = 255;
  if (!union.includes(255)) throw new Error("BACKGROUND_EMPTY_MASK");
  // Include a bounded halo for antialiasing and contact shadows. Preserve every
  // pixel outside this footprint when compositing the generated fill.
  const radius = Math.max(2, Math.min(48, Math.round(Math.max(photo.width, photo.height) * .025)));
  const stride=photo.width+1,integral=new Uint32Array(stride*(photo.height+1)),expanded=Buffer.alloc(count);
  for(let y=0;y<photo.height;y++){let row=0;for(let x=0;x<photo.width;x++){row+=union[y*photo.width+x]?1:0;integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}}
  for(let y=0;y<photo.height;y++)for(let x=0;x<photo.width;x++){
    const x0=Math.max(0,x-radius),x1=Math.min(photo.width,x+radius+1),y0=Math.max(0,y-radius),y1=Math.min(photo.height,y+radius+1);
    if(integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0]>0)expanded[y*photo.width+x]=255;
  }
  const guide = Buffer.from(photo.data);
  for (let i = 0; i < count; i++) if (expanded[i]) { guide[i * 3] = 255; guide[i * 3 + 1] = 0; guide[i * 3 + 2] = 255; }
  return { mask: expanded, guide: await sharp(guide, { raw: { width: photo.width, height: photo.height, channels: 3 } }).png().toBuffer() };
}

export async function compositeBackground(photo: PixelImage, generated: Buffer, footprint: Uint8Array,plan?:BackgroundPlan) {
  if (footprint.length !== photo.width * photo.height) throw new Error("BACKGROUND_MASK_SIZE");
  const metadata = await sharp(generated, { limitInputPixels: 10_000_000 }).metadata();
  if (!metadata.width || !metadata.height || Math.abs(metadata.width / metadata.height / (photo.width / photo.height) - 1) > .03) throw new Error("BACKGROUND_FRAME_CHANGED");
  const fill = await sharp(generated, { limitInputPixels: 10_000_000 }).resize(photo.width, photo.height, { fit: "fill" }).removeAlpha().toColourspace("srgb").raw().toBuffer();
  smoothSurfaceFill(photo,footprint,fill,plan);
  // A low-resolution harmonic color correction matches the generated fill to
  // the known background at every hole boundary. This removes pasted silhouettes
  // without blurring the original photograph or relying on a uniform backdrop.
  const factor=Math.min(1,256/Math.max(photo.width,photo.height)),w=Math.max(1,Math.round(photo.width*factor)),h=Math.max(1,Math.round(photo.height*factor));
  const small=(data:Buffer)=>sharp(data,{raw:{width:photo.width,height:photo.height,channels:3}}).resize(w,h,{fit:"fill"}).raw().toBuffer();
  // Sampling differences exactly on the high-resolution boundary avoids
  // resampling a removed subject into the color constraints.
  const [sourceSmall,fillSmall]=await Promise.all([small(Buffer.from(photo.data)),small(fill)]);
  const mask=new Uint8Array(w*h),field=new Float32Array(w*h*3),fixed=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)mask[y*w+x]=footprint[Math.min(photo.height-1,Math.floor((y+.5)*photo.height/h))*photo.width+Math.min(photo.width-1,Math.floor((x+.5)*photo.width/w))]?1:0;
  const neighbors=(i:number)=>[...(i%w>0?[i-1]:[]),...(i%w<w-1?[i+1]:[]),...(i>=w?[i-w]:[]),...(i<w*(h-1)?[i+w]:[])];
  const samples=new Uint32Array(w*h),distance=new Uint16Array(footprint.length);
  for(let y=0;y<photo.height;y++)for(let x=0;x<photo.width;x++){
    const i=y*photo.width+x;if(!footprint[i])continue;distance[i]=65535;
    const edge=x>0&&!footprint[i-1]||x<photo.width-1&&!footprint[i+1]||y>0&&!footprint[i-photo.width]||y<photo.height-1&&!footprint[i+photo.width];
    if(edge){const at=Math.min(h-1,Math.floor(y*h/photo.height))*w+Math.min(w-1,Math.floor(x*w/photo.width));samples[at]++;mask[at]=1;for(let k=0;k<3;k++)field[at*3+k]+=photo.data[i*3+k]-fill[i*3+k];}
  }
  for(let i=0;i<mask.length;i++)if(samples[i]){fixed[i]=1;queue[tail++]=i;for(let k=0;k<3;k++)field[i*3+k]/=samples[i];}
  else if(mask[i]&&neighbors(i).some(n=>!mask[n])){fixed[i]=1;queue[tail++]=i;for(let k=0;k<3;k++)field[i*3+k]=sourceSmall[i*3+k]-fillSmall[i*3+k];}
  for(let y=0;y<photo.height;y++)for(let x=0;x<photo.width;x++){const i=y*photo.width+x;if(footprint[i])distance[i]=Math.min(distance[i],x?distance[i-1]+1:65535,y?distance[i-photo.width]+1:65535);}
  for(let y=photo.height-1;y>=0;y--)for(let x=photo.width-1;x>=0;x--){const i=y*photo.width+x;if(footprint[i])distance[i]=Math.min(distance[i],x<photo.width-1?distance[i+1]+1:65535,y<photo.height-1?distance[i+photo.width]+1:65535);}
  const reached=fixed.slice();
  while(head<tail){const i=queue[head++];for(const n of neighbors(i))if(mask[n]&&!reached[n]){reached[n]=1;queue[tail++]=n;for(let k=0;k<3;k++)field[n*3+k]=field[i*3+k];}}
  for(let pass=0;pass<240;pass++){
    let change=0;
    for(let i=0;i<mask.length;i++)if(mask[i]&&!fixed[i]){const adjacent=neighbors(i).filter(n=>mask[n]);for(let k=0;k<3;k++){const value=adjacent.reduce((s,n)=>s+field[n*3+k],0)/Math.max(1,adjacent.length);change=Math.max(change,Math.abs(value-field[i*3+k]));field[i*3+k]=value;}}
    if(change<.03)break;
  }
  const result = Buffer.from(photo.data);
  for(let y=0;y<photo.height;y++)for(let x=0;x<photo.width;x++){
    const i=y*photo.width+x;if(!footprint[i])continue;
    const sx=Math.max(0,Math.min(w-1,(x+.5)*w/photo.width-.5)),sy=Math.max(0,Math.min(h-1,(y+.5)*h/photo.height-.5));
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=sx-x0,fy=sy-y0;
    for(let k=0;k<3;k++){
      const correction=(field[(y0*w+x0)*3+k]*(1-fx)+field[(y0*w+x1)*3+k]*fx)*(1-fy)+(field[(y1*w+x0)*3+k]*(1-fx)+field[(y1*w+x1)*3+k]*fx)*fy;
      const t=Math.min(1,Math.max(0,(distance[i]-1)/Math.max(1,Math.min(24,Math.max(photo.width,photo.height)*.0125)))),alpha=t*t*(3-2*t);
      result[i*3+k]=Math.max(0,Math.min(255,Math.round((fill[i*3+k]+correction)*alpha+photo.data[i*3+k]*(1-alpha))));
    }
  }
  // PNG keeps the unmasked source pixels exact; no global AI color/style change.
  return sharp(result, { raw: { width: photo.width, height: photo.height, channels: 3 } }).png().toBuffer();
}
