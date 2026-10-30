"use client";
import {lightingPresets} from "@/lib/scene/lighting";
import { RotateCcw, Sparkles, Check, RefreshCw } from "lucide-react";
import type { Lighting } from "@/lib/scene/lighting";
import { RangeField } from "@/components/ui/range-field";
export function AppearanceControls({ panel, lighting, setLighting, dirty, objectDirty, busy, applied, onTexture, onRefresh, onReset, texturesBlocked = false }: {
  panel: "textures" | "lighting"; lighting: Lighting; setLighting: (value: Lighting) => void; dirty: boolean; objectDirty: boolean; busy: boolean; applied: boolean;
  texturesBlocked?: boolean; onTexture: () => void; onRefresh:()=>void; onReset: () => void;
}) {
  if (panel === "textures") return <section className="panel-stack" aria-label="Photo textures">
    <div className="panel-block">
      <div className="panel-heading"><h3>Photo textures</h3><span className={`setting-badge${applied ? " active" : ""}`}>{applied ? "Applied" : "AI original"}</span></div>
      <p className="panel-hint">Copy visible logos, lettering and surface detail from your photo onto the meshes.</p>
      <div className="texture-status"><span className="texture-swatch"/><div><strong>{applied ? "Source photo detail" : "Generated appearance"}</strong><small>{applied ? "Visible surfaces · up to 2K" : "Original model textures"}</small></div>{applied && <Check size={16}/>}</div>
      <div className="panel-buttons">
        <button className={`button ${applied ? "button-light" : "button-dark"}`} disabled={busy || dirty || objectDirty || texturesBlocked} onClick={onTexture}><Sparkles size={14}/>{busy ? "Working…" : applied ? "Restore AI textures" : "Copy photo textures"}</button>
        {applied&&<button className="button button-light" disabled={busy||dirty||objectDirty||texturesBlocked} onClick={onRefresh}><RefreshCw size={14}/>Refresh detail</button>}
      </div>
      {texturesBlocked ? <p className="panel-note">Restore original objects in Products first.</p> : (dirty || objectDirty) && <p className="panel-note">Save your changes before switching textures.</p>}
    </div>
    <details className="panel-details"><summary>What gets copied?</summary>
      <p>Visible surfaces use aligned photo detail; hidden surfaces keep their AI texture. Small text is limited by photo resolution. Textures save immediately, can be restored, and include the photo&apos;s lighting, so softer scene lights keep more detail.</p>
    </details>
  </section>;
  return <section className="panel-stack" aria-label="Scene lighting"><div className="panel-block"><h3>Lighting mood</h3><div className="preset-row">{Object.entries(lightingPresets).map(([name,value])=><button className="button button-light" key={name} disabled={busy} onClick={()=>setLighting(structuredClone(value))}>{name}</button>)}</div><p className="panel-note">Presets adjust the 3D lights. Photographed background lighting is baked into the image.</p></div>
    {(["key", "fill"] as const).map(name => <fieldset className="panel-block light-group" key={name} disabled={busy} aria-label={name === "key" ? "Main light" : "Fill light"}>
      <div className="panel-heading"><h3><span className={`light-dot ${name}`}/>{name === "key" ? "Main light" : "Fill light"}</h3></div>
      <RangeField label="Intensity" min={0} max={8} step={0.1} value={lighting[name].intensity} onChange={value => setLighting({ ...lighting, [name]: { ...lighting[name], intensity: value } })}/>
      <div className="light-position-fields">{(["X", "Y", "Z"] as const).map((axis, i) => <RangeField key={axis} label={axis} min={axis === "Y" ? 0.1 : -20} max={20} step={0.1} value={lighting[name].position[i]} onChange={value => {
        const position = [...lighting[name].position] as [number, number, number]; position[i] = value;
        setLighting({ ...lighting, [name]: { ...lighting[name], position } });
      }}/>)}</div>
    </fieldset>)}
    <div className="panel-block">
      <div className="panel-heading"><h3>Ambient</h3></div>
      <RangeField label="Overall brightness" disabled={busy} min={0} max={4} step={0.1} value={lighting.ambient} onChange={value => setLighting({ ...lighting, ambient: value })}/>
      <button className="text-link panel-link" disabled={busy} onClick={onReset}><RotateCcw size={13}/>Reset lights</button>
    </div>
  </section>;
}
