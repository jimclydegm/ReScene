"use client";
import Image from "next/image";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Box, Scan, Plus, RefreshCw, Check, Undo2 } from "lucide-react";
import { RangeField } from "@/components/ui/range-field";
import type { AnalysisOptions, ReconstructionOptions, SegmentationOptions } from "@/lib/ai/controls";
import type { SceneWorkspace } from "./types";

type Props={data:SceneWorkspace;busy:boolean;running:boolean;chosen:string[];setChosen:(ids:string[])=>void;
  analysis:AnalysisOptions;setAnalysis:(value:AnalysisOptions)=>void;reconstruction:ReconstructionOptions;setReconstruction:(value:ReconstructionOptions)=>void;
  onAnalyze:()=>void;onSegment:(value:SegmentationOptions)=>Promise<void>;onMask:(objectId:string,mask:string|string[])=>Promise<void>;onBuild:()=>void;onReview:()=>void};
type Tool="preview"|"box"|"positive"|"negative";
const freshPrompt=():SegmentationOptions=>({label:"",concept:"",mode:"text",points:[]});

export function ObjectReview(props:Props){
  const {data,busy,running,chosen,setChosen,analysis,setAnalysis,reconstruction,setReconstruction}=props;
  const [inspected,setInspected]=useState(data.objects[0]?.id ?? "new");
  const current=data.objects.find(o=>o.id===inspected);
  const [prompt,setPrompt]=useState<SegmentationOptions>(()=>{
    const o=data.objects[0];return o ? {...(o.segmentation ?? {mode:"text",points:[]}),objectId:o.id,label:o.label,concept:o.concept} : freshPrompt();
  });
  const [tool,setTool]=useState<Tool>("preview");
  const [opacity,setOpacity]=useState(.48);
  const [boxes,setBoxes]=useState(false);
  const [confidence,setConfidence]=useState(0);
  const [combined,setCombined]=useState<string[]>([]);
  const [variant,setVariant]=useState<string|null>(null);
  const [pointX,setPointX]=useState(0),[pointY,setPointY]=useState(0);
  const drag=useRef<{x:number;y:number}|null>(null);
  const [pendingBox,setPendingBox]=useState<SegmentationOptions["box"]>();
  const image=data.image!;
  const locked=busy||running;
  const masks=data.objects.filter(o=>chosen.includes(o.id)&&o.maskUrl).map(o=>({id:o.id,url:o.maskUrl!}));
  const previewVariant=current?.maskAlternatives.find(v=>v.assetId===variant);
  const overlay=previewVariant ? [{id:previewVariant.assetId,url:previewVariant.url}] : current?.maskUrl ? [{id:current.id,url:current.maskUrl}] : masks;
  const missingSubject=chosen.some(id=>{const o=data.objects.find(o=>o.id===id);return o?.parentObjectId&&!data.objects.some(p=>p.id===o.parentObjectId&&p.maskUrl);});
  const promptReady=prompt.label.trim()&&(prompt.mode==="text"?prompt.concept.trim():prompt.box||prompt.points.some(p=>p.label==="positive"));
  const canBuild=data.status==="REVIEW";
  function inspect(id:string){
    const o=data.objects.find(o=>o.id===id);setInspected(id);setVariant(null);setCombined([]);setConfidence(0);setTool("preview");
    setPrompt(o ? {...(o.segmentation ?? {mode:"text",points:[]}),objectId:o.id,label:o.label,concept:o.concept} : freshPrompt());
  }
  function location(next:Tool){
    setTool(next);setPrompt(p=>({...p,mode:"spatial",box:p.box ?? current?.bounds ?? undefined}));
  }
  function pixel(event:PointerEvent<SVGSVGElement>){
    const rect=event.currentTarget.getBoundingClientRect();
    return {x:Math.max(0,Math.min(image.width-1,Math.floor((event.clientX-rect.left)/rect.width*image.width))),y:Math.max(0,Math.min(image.height-1,Math.floor((event.clientY-rect.top)/rect.height*image.height)))};
  }
  function down(event:PointerEvent<SVGSVGElement>){
    if(locked||tool==="preview")return;
    const p=pixel(event);
    if(tool==="box"){drag.current=p;event.currentTarget.setPointerCapture(event.pointerId);}
    else if(prompt.points.length<16)setPrompt(s=>({...s,points:[...s.points,{...p,label:tool}]}));
  }
  function move(event:PointerEvent<SVGSVGElement>){
    if(!drag.current)return;
    const p=pixel(event),start=drag.current;
    setPendingBox({xMin:Math.min(start.x,p.x),yMin:Math.min(start.y,p.y),xMax:Math.max(start.x,p.x)+1,yMax:Math.max(start.y,p.y)+1});
  }
  function up(event:PointerEvent<SVGSVGElement>){
    if(!drag.current)return;
    const p=pixel(event),start=drag.current;
    setPrompt(s=>({...s,box:{xMin:Math.min(start.x,p.x),yMin:Math.min(start.y,p.y),xMax:Math.max(start.x,p.x)+1,yMax:Math.max(start.y,p.y)+1}}));
    drag.current=null;setPendingBox(undefined);
  }
  const box=pendingBox ?? (prompt.mode==="spatial" ? prompt.box : undefined);
  return <section className="pipeline-review" aria-label="Photo analysis and object review">
    <div className="pipeline-heading"><div><span className="eyebrow">OBJECT REVIEW</span><h2>Find the products in your photo.</h2><p>Complete subjects stay intact. Product parts remain selectable within the reconstructed scene.</p></div><span className="setting-badge">{data.objects.filter(o=>o.maskUrl).length} of {data.objects.length} outlined</span></div>
    <div className="analysis-layout">
      <div className="review-canvas-column">
        <div className="review-photo-shell"><div className="review-photo fitted-photo" style={{"--photo-aspect":image.width/image.height} as CSSProperties}>
          <Image src={image.url} alt={data.title} width={image.width} height={image.height} unoptimized/>
          {overlay.map(mask=><Image key={mask.id} className="mask-overlay" src={mask.url} alt="Segmentation preview" fill unoptimized style={{opacity}}/>)}
          <svg className={`prompt-canvas tool-${locked?"preview":tool}`} viewBox={`0 0 ${image.width} ${image.height}`} aria-label="Object prompt overlay; use the controls to draw a box or mark include and exclude points" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;setPendingBox(undefined);}}>
            {boxes&&data.objects.filter(o=>o.bounds).map(o=><rect key={o.id} x={o.bounds!.xMin} y={o.bounds!.yMin} width={o.bounds!.xMax-o.bounds!.xMin} height={o.bounds!.yMax-o.bounds!.yMin} className="candidate-box"/>)}
            {box&&<rect x={box.xMin} y={box.yMin} width={box.xMax-box.xMin} height={box.yMax-box.yMin} className="user-box"/>}
            {prompt.mode==="spatial"&&prompt.points.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r={Math.max(image.width,image.height)*.008} fill={p.label==="positive"?"#45a76c":"#df6657"} stroke="white" strokeWidth={2}/><text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={Math.max(image.width,image.height)*.013}>{p.label==="positive"?"+":"−"}</text></g>)}
          </svg>
        </div></div>
        <div className="review-display-controls"><span>Preview fits the photo · {image.width} × {image.height}</span><label><input type="checkbox" checked={boxes} onChange={e=>setBoxes(e.target.checked)}/> Show boxes</label><RangeField label="Mask opacity" min={0} max={.9} step={.05} precision={2} value={opacity} onChange={setOpacity}/></div>
        <p className="control-hint">{tool==="box"?"Drag a tight box around the whole item, including its edges." : tool==="positive"?"Click inside the item. Include points tell SAM what belongs to it." : tool==="negative"?"Click the background or a neighboring item to exclude it." : "Select an item to inspect its outline. Use text or location prompts to correct a miss."}</p>
        {data.analysisSummary&&<p className="analysis-summary">{data.analysisSummary}</p>}
      </div>
      <aside className="object-inspector pipeline-inspector">
        <details className="pipeline-section" open={!data.objects.length}><summary><Scan size={16}/> Analysis controls</summary><fieldset disabled={locked}>
          <label>Find<select value={analysis.focus} onChange={e=>setAnalysis({...analysis,focus:e.target.value as AnalysisOptions["focus"]})}><option value="auto">Automatic · any scene</option><option value="products">Products</option><option value="clothing">Clothing & footwear</option><option value="objects">Individual objects</option></select></label>
          <p className="control-hint">AI scans the whole photo and identifies complete subjects and their product parts automatically. No item count needed.</p>
          <label>What should we focus on?<textarea value={analysis.instructions} maxLength={600} placeholder="For example: the T-shirt, shorts, and shoes worn by the model" onChange={e=>setAnalysis({...analysis,instructions:e.target.value})}/></label>
          <button className="button button-dark" disabled={!data.generationEnabled} onClick={props.onAnalyze}><Scan size={15}/>{data.status==="DRAFT"?"Analyze photo":"Analyze again…"}</button><small>Uses Meta API credits. Reanalysis replaces later results after confirmation.</small>
        </fieldset></details>
        {!data.objects.length&&!running&&data.status!=="DRAFT"&&<div className="pipeline-notice" role="status"><strong>No objects were identified.</strong><p>Choose Clothing & footwear, describe the items, and analyze again. Or add an item below and draw its outline prompt.</p></div>}
        <div className="pipeline-section"><h3>Items in this photo</h3><div className="selection-tools"><button disabled={locked} onClick={()=>setChosen(data.objects.filter(o=>o.maskUrl).map(o=>o.id))}>Select all</button><button disabled={locked||!chosen.length} onClick={()=>setChosen([])}>Clear selection</button></div>
          <div className="review-object-list">{data.objects.map(o=><div className={`review-object-row${inspected===o.id?" inspecting":""}`} key={o.id}>
            <input className="review-checkbox" aria-label={`Build ${o.label}`} type="checkbox" checked={chosen.includes(o.id)} disabled={!o.maskUrl||locked} onChange={e=>{setChosen(e.target.checked?[...new Set([...chosen,o.id,...(o.parentObjectId?[o.parentObjectId]:[])])]:chosen.filter(id=>id!==o.id&&!data.objects.some(child=>child.id===id&&child.parentObjectId===o.id)));inspect(o.id);}}/>
            <button className="review-item-inspect" aria-pressed={inspected===o.id} onClick={()=>inspect(o.id)} disabled={locked}><strong>{o.label}</strong>{o.parentObjectId&&<small>Part of {data.objects.find(p=>p.id===o.parentObjectId)?.label ?? "complete subject"}</small>}<small>{o.errorCode==="AMBIGUOUS_MASK"?`${o.maskAlternatives.length} matches · choose an outline`:o.errorCode==="SEGMENTATION_INTERRUPTED"?"Request interrupted · retry manually":o.errorCode==="NO_MATCH"?"No match · refine and retry":o.maskUrl?`Outline ready${o.confidence!==null?` · ${Math.round(o.confidence*100)}% confidence`:""}`:running?"Finding outline…":"Outline needed"}</small>{o.errorCode&&o.maskUrl&&<small>Previous accepted outline kept</small>}</button>
          </div>)}</div>
          <button className="button button-light add-item" disabled={locked||data.objects.length>=10} onClick={()=>inspect("new")}><Plus size={14}/> Add an item manually</button>
        </div>
        <div className="pipeline-section"><h3>{current?`Refine ${current.label}`:"Add an item"}</h3><fieldset disabled={locked}>
          <label>Item name<input value={prompt.label} maxLength={120} placeholder="Blue T-shirt" onChange={e=>setPrompt({...prompt,label:e.target.value})}/></label>
          {prompt.mode==="text"&&<label>Segmentation concept<input value={prompt.concept} maxLength={80} placeholder="T-shirt" onChange={e=>setPrompt({...prompt,concept:e.target.value})}/></label>}
          <div className="segmentation-modes" role="group" aria-label="Segmentation prompt mode"><button aria-pressed={prompt.mode==="text"} onClick={()=>{setPrompt(p=>({...p,mode:"text",box:undefined,points:[]}));setTool("preview");}}>Text prompt</button><button aria-pressed={prompt.mode==="spatial"} onClick={()=>location("box")}>Box & points</button></div>
          {prompt.mode==="text"?<p className="control-hint">Use one short noun phrase: “T-shirt”, “shorts”, or “sneaker”. Multiple matches are shown for you to choose.</p>:<>
            <div className="prompt-tools" role="group" aria-label="Location prompt tools">{([["box","Draw box"],["positive","Include +"],["negative","Exclude −"]] as const).map(([value,label])=><button key={value} aria-pressed={tool===value} onClick={()=>setTool(value)}>{label}</button>)}</div>
            {prompt.box&&<div className="box-coordinate-fields">{(["xMin","yMin","xMax","yMax"] as const).map(field=><label key={field}>{field}<input type="number" min={field.endsWith("Max")?1:0} max={field.startsWith("x")?image.width:image.height} value={prompt.box![field]} onChange={e=>setPrompt({...prompt,box:{...prompt.box!,[field]:Number(e.target.value)}})}/></label>)}</div>}
            <div className="point-entry"><label>Point X<input type="number" min={0} max={image.width-1} value={pointX} onChange={e=>setPointX(Number(e.target.value))}/></label><label>Point Y<input type="number" min={0} max={image.height-1} value={pointY} onChange={e=>setPointY(Number(e.target.value))}/></label><button disabled={prompt.points.length>=16} onClick={()=>setPrompt(p=>({...p,points:[...p.points,{x:pointX,y:pointY,label:tool==="negative"?"negative":"positive"}]}))}>Add point</button></div>
            <p className="control-hint">{prompt.points.length}/16 points. Green includes; red excludes. Coordinates use the original image.</p><div className="point-tags">{prompt.points.map((p,i)=><button key={i} onClick={()=>setPrompt(s=>({...s,points:s.points.filter((_,n)=>n!==i)}))} aria-label={`Remove ${p.label} point at ${p.x}, ${p.y}`}>{p.label==="positive"?"+":"−"} {p.x}, {p.y} ×</button>)}</div>
            <div className="selection-tools"><button onClick={()=>setPrompt(p=>({...p,points:p.points.slice(0,-1)}))} disabled={!prompt.points.length}><Undo2 size={13}/> Undo point</button><button onClick={()=>setPrompt(p=>({...p,box:undefined,points:[]}))}>Clear box & points</button></div>
          </>}
          <button className="button button-dark" disabled={!promptReady||!data.generationEnabled} onClick={async()=>{await props.onSegment(prompt);setTool("preview");}}><RefreshCw size={15}/>{current?"Retry this outline":"Segment this item"}</button><small>One SAM request. Other items and accepted outlines are kept. No automatic paid retries.</small>
        </fieldset>
        {current&&current.maskAlternatives.length>0&&<div className="mask-variants"><RangeField label="Confidence filter (saved matches only)" min={0} max={1} step={.05} precision={2} value={confidence} onChange={setConfidence}/><p className="control-hint">Filtering does not rerun the model. Matches without scores remain visible.</p>{current.maskAlternatives.filter(v=>v.confidence===null||v.confidence>=confidence).map((v,i)=><div className="mask-variant" key={v.assetId}><input type="checkbox" className="review-checkbox" aria-label={`Combine match ${i+1}`} checked={combined.includes(v.assetId)} disabled={locked} onChange={e=>setCombined(e.target.checked?[...combined,v.assetId]:combined.filter(id=>id!==v.assetId))}/><button onClick={()=>setVariant(v.assetId)} aria-pressed={variant===v.assetId}><Image src={v.url} alt={`Outline option ${i+1}`} width={52} height={52} unoptimized/><span>Match {i+1}<small>{v.confidence===null?"No confidence score":`${Math.round(v.confidence*100)}% confidence`}</small></span></button><button className="button button-light" disabled={locked||v.selected} onClick={()=>props.onMask(current.id,v.assetId)}>{v.selected?<><Check size={13}/>Using</>:"Use outline"}</button></div>)}{current.maskAlternatives.length>1&&<><p className="control-hint">For a pair of shoes, check both matches and combine them into one product outline.</p><button className="button button-light" disabled={locked||combined.length<2} onClick={async()=>{await props.onMask(current.id,combined);setCombined([]);setVariant(null);}}>Combine {combined.length||"selected"} matches · no inference</button></>}</div>}
        </div>
        <div className="pipeline-section build-controls"><h3>Build the scene</h3>{missingSubject&&<p role="status" className="pipeline-notice">A complete subject needs an outline before its product parts can be reconstructed. Refine that subject above; the app will keep its body and parts together.</p>}<p>All accepted items are selected automatically. Product parts are derived from their complete subject so the person and outfit stay together. Hidden surfaces are estimated; this does not simulate garment fit.</p><fieldset disabled={locked}>
          <label>3D seed<input type="number" min={0} max={2147483647} step={1} value={reconstruction.seed} onChange={e=>setReconstruction({...reconstruction,seed:Number(e.target.value)})}/></label><small>Keep the seed for repeatability; change it to try another reconstruction. Textured GLB export is always enabled.</small>
          {canBuild?<button className="button button-dark" disabled={missingSubject||!chosen.length||!data.generationEnabled||!Number.isSafeInteger(reconstruction.seed)||reconstruction.seed<0||reconstruction.seed>2147483647} onClick={props.onBuild}><Box size={16}/>Build scene in 3D</button>:data.status==="FAILED"&&data.objects.some(o=>o.maskUrl)?<button className="button button-light" onClick={props.onReview}>Review masks & retry 3D…</button>:null}
        </fieldset></div>
      </aside>
    </div>
  </section>;
}
