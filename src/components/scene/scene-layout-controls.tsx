"use client";
import {ReconstructionRetry} from "./reconstruction-retry";
import {QualityControls} from "./quality-controls";
import {useState} from "react";
import { Crosshair, ImageIcon, Undo2, WandSparkles } from "lucide-react";
import type { SceneWorkspace } from "./types";

type Backdrop = "room" | "studio" | "none";
const backdrops: [Backdrop, string][] = [["room", "Photo"], ["studio", "Ground"], ["none", "Plain"]];

/** Scene-level layout, backdrop and background actions, grouped in one inspector tab. */
export function SceneLayoutControls({ data, locked, unsaved, blocked, onMatch, onReview, onRestore, onBackdrop, onBackground,onRestoreBackground,onRetry,onMask,onQuality,onQualityRestore,onQualityPaid }: {
  data: SceneWorkspace; locked: boolean; unsaved: boolean; blocked: boolean;
  onRetry:(ids:string[],seed:number)=>Promise<void>;onMask:(id:string,mask:string)=>Promise<void>;
  onQuality:()=>void;onQualityRestore:()=>void;onQualityPaid:(options:{materials:boolean;masks:boolean;review:boolean})=>Promise<void>;
  onMatch: () => void; onReview: () => void; onRestore: () => void; onBackdrop: (value: Backdrop) => void; onBackground:(mode:"reference"|"materials"|"photo")=>void;onRestoreBackground:()=>void;
}) {
  const [backgroundMode,setBackgroundMode]=useState<"reference"|"materials"|"photo">("reference");
  const composition = data.composition;
  const manual = composition?.layoutSource === "manual-stage";
  const layoutDisabled = locked || unsaved || blocked;
  const backgroundReady = Boolean(data.appearance.backgroundUrl || composition?.background?.plainColor || composition?.background?.surfaceMode);
  const review = data.layoutReview;
  return <section className="panel-stack" aria-label="Scene layout">
    <div className="panel-block">
      <div className="panel-heading"><h3>Photo layout</h3><span className="setting-badge">{manual ? "Manual stage" : composition ? "Matched" : "Not matched"}</span></div>
      <p className="panel-hint">{manual ? "Objects keep your manual edits. Match to estimate placement from the photo." : composition ? "Size, depth and camera use saved SAM 3D estimates. Surfaces are approximate." : "Restore relative size, depth and camera from the saved AI poses. No generation."}</p>
      <div className="panel-buttons">
        <button className="button button-dark" disabled={layoutDisabled} onClick={onMatch}><WandSparkles size={14}/>Match photo layout</button>
        <button className="button button-light" disabled={layoutDisabled || !composition || manual} onClick={onReview}><Crosshair size={14}/>Refine placement</button>
      </div>
      {data.canRestoreLayout && <button className="text-link panel-link" disabled={layoutDisabled} onClick={onRestore}><Undo2 size={13}/>Undo photo layout</button>}
      {blocked ? <p className="panel-note">Restore original objects in Products first.</p> : unsaved && <p className="panel-note">Save or discard your edits first. Matching saves new transforms.</p>}
      {review && <div className={`layout-report${review.needsReview ? " attention" : ""}`} role="status">
        <strong>{review.needsReview ? "Some placements need a look" : "Placement checked"}</strong>
        <ul>{review.objects.map(o => <li key={o.id}><span>{o.label}{o.collision?" · intersection":""}{o.adjusted ? " · adjusted" : ""}</span><meter min={0} max={1} low={.65} optimum={1} value={o.after}/><b className={o.needsReview ? "warn" : ""}>{Math.round(o.after * 100)}%</b></li>)}</ul>
        <small>Mask overlap from the photo angle. Hidden geometry is not verified.</small>
      </div>}
    </div>
    <QualityControls data={data} disabled={layoutDisabled} onImprove={onQuality} onRestore={onQualityRestore} onPaid={onQualityPaid}/>
    <ReconstructionRetry data={data} disabled={layoutDisabled} onRetry={onRetry} onMask={onMask}/>
    {composition && <div className="panel-block">
      <div className="panel-heading"><h3>Backdrop</h3></div>
      <div className="segmented" role="radiogroup" aria-label="Scene backdrop">{backdrops.map(([value, label]) =>
        <button key={value} role="radio" aria-checked={(composition.backdrop ?? "room") === value} disabled={locked || unsaved} onClick={() => { if ((composition.backdrop ?? "room") !== value) onBackdrop(value); }}>{label}</button>)}</div>
      <p className="panel-hint">Photo shows estimated surfaces, Ground keeps only the floor, Plain removes both. Saves instantly.</p>
    </div>}
    <div className="panel-block">
      <div className="panel-heading"><h3>Background surfaces</h3><span className={`setting-badge${backgroundReady ? " active" : ""}`}>{backgroundReady ? "Ready" : "Not built"}</span></div>
      <div className="segmented" role="group" aria-label="Background construction"><button aria-pressed={backgroundMode==="reference"} disabled={locked} onClick={()=>setBackgroundMode("reference")}>Reference</button><button aria-pressed={backgroundMode==="materials"} disabled={locked} onClick={()=>setBackgroundMode("materials")}>Materials</button><button aria-pressed={backgroundMode==="photo"} disabled={locked} onClick={()=>setBackgroundMode("photo")}>Photo</button></div>
      <p className="panel-hint">{backgroundMode==="reference"?"Plan connected surfaces and openings, estimate shared depth, then recover reference materials without baked shadows. Uses Meta analysis, one VGGT job per photo and one clean background image. Single-photo hidden areas remain estimated.":backgroundMode==="materials"?"Analyze structure first. Plain surfaces stay plain; textured surfaces get AI material tiles without photographed shadows. Lights create new shading. Distant scenery uses a photo plate.":"Preserve photographed scenery and lighting. Image projection remains approximate when you rotate."}</p>
      {data.backgroundInfo?.report&&<div className="layout-report" role="status"><strong>Surface coverage: {Math.round(data.backgroundInfo.report.coverage*100)}%</strong><p>{data.backgroundInfo.report.expectedWalls?`${data.backgroundInfo.report.walls}/${data.backgroundInfo.report.expectedWalls} observed walls`:"Open surfaces"} · {data.backgroundInfo.report.openings} openings</p><small>Checks visible surfaces and corner alignment. Hidden geometry remains estimated.</small></div>}
      {data.backgroundInfo?.explanation&&<details className="panel-details"><summary>Background interpretation</summary><p>{data.backgroundInfo.explanation}</p>{data.backgroundInfo.lightingEffects.length>0&&<p>Lighting kept out of materials: {data.backgroundInfo.lightingEffects.join("; ")}</p>}{data.backgroundInfo.warnings.map(w=><p key={w}>{w}</p>)}</details>}
      <button className="button button-light button-full" disabled={locked || unsaved || !data.generationEnabled} onClick={()=>onBackground(backgroundMode)}><ImageIcon size={14}/>{backgroundReady ? "Rebuild background" : "Build background"}</button>
      {data.canRestoreBackground&&<button className="text-link panel-link" disabled={locked||unsaved} onClick={onRestoreBackground}><Undo2 size={13}/>Restore previous background</button>}
    </div>
    {composition && composition.warnings.length > 1 && <details className="panel-details"><summary>Scene notes ({composition.warnings.length - 1})</summary>{composition.warnings.slice(1).map(warning => <p key={warning}>{warning}</p>)}</details>}
  </section>;
}
