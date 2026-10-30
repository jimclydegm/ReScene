"use client";
import { Crosshair, ImageIcon, Undo2, WandSparkles } from "lucide-react";
import type { SceneWorkspace } from "./types";

type Backdrop = "room" | "studio" | "none";
const backdrops: [Backdrop, string][] = [["room", "Photo"], ["studio", "Ground"], ["none", "Plain"]];

/** Scene-level layout, backdrop and background actions, grouped in one inspector tab. */
export function SceneLayoutControls({ data, locked, unsaved, blocked, onMatch, onReview, onRestore, onBackdrop, onBackground }: {
  data: SceneWorkspace; locked: boolean; unsaved: boolean; blocked: boolean;
  onMatch: () => void; onReview: () => void; onRestore: () => void; onBackdrop: (value: Backdrop) => void; onBackground: () => void;
}) {
  const composition = data.composition;
  const manual = composition?.layoutSource === "manual-stage";
  const layoutDisabled = locked || unsaved || blocked;
  const backgroundReady = Boolean(data.appearance.backgroundUrl || composition?.background?.plainColor);
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
        <ul>{review.objects.map(o => <li key={o.id}><span>{o.label}{o.adjusted ? " · adjusted" : ""}</span><meter min={0} max={1} low={.65} optimum={1} value={o.after}/><b className={o.needsReview ? "warn" : ""}>{Math.round(o.after * 100)}%</b></li>)}</ul>
        <small>Mask overlap from the photo angle. Hidden geometry is not verified.</small>
      </div>}
    </div>
    {composition && <div className="panel-block">
      <div className="panel-heading"><h3>Backdrop</h3></div>
      <div className="segmented" role="radiogroup" aria-label="Scene backdrop">{backdrops.map(([value, label]) =>
        <button key={value} role="radio" aria-checked={(composition.backdrop ?? "room") === value} disabled={locked || unsaved} onClick={() => { if ((composition.backdrop ?? "room") !== value) onBackdrop(value); }}>{label}</button>)}</div>
      <p className="panel-hint">Photo shows estimated surfaces, Ground keeps only the floor, Plain removes both. Saves instantly.</p>
    </div>}
    <div className="panel-block">
      <div className="panel-heading"><h3>Photo background</h3><span className={`setting-badge${backgroundReady ? " active" : ""}`}>{backgroundReady ? "Ready" : "Not built"}</span></div>
      <p className="panel-hint">One Meta image edit fills the area behind your objects. Areas outside the photo are estimated.</p>
      <button className="button button-light button-full" disabled={locked || unsaved || !data.generationEnabled} onClick={onBackground}><ImageIcon size={14}/>{backgroundReady ? "Refresh background" : "Build background"}</button>
    </div>
    {composition && composition.warnings.length > 1 && <details className="panel-details"><summary>Scene notes ({composition.warnings.length - 1})</summary>{composition.warnings.slice(1).map(warning => <p key={warning}>{warning}</p>)}</details>}
  </section>;
}
