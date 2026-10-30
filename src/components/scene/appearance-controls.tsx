"use client";
import { Lightbulb, Palette, RotateCcw, Sparkles, Check } from "lucide-react";
import type { Lighting } from "@/lib/scene/lighting";
import { RangeField } from "@/components/ui/range-field";
export function AppearanceControls({ panel, lighting, setLighting, dirty, objectDirty, busy, applied, onTexture, onRefresh, onReset, texturesBlocked = false, backgroundReady=false, onBackground, generationEnabled=false }: {
  panel: "textures" | "lighting"; lighting: Lighting; setLighting: (value: Lighting) => void; dirty: boolean; objectDirty: boolean; busy: boolean; applied: boolean;
  texturesBlocked?: boolean; onTexture: () => void; onRefresh:()=>void; onReset: () => void;
  backgroundReady?:boolean;onBackground:()=>void;generationEnabled?:boolean;
}) {
  if (panel === "textures") return <section className="appearance-controls" aria-label="Photo textures"><div className="inspector-section-heading"><Palette size={17}/><h3>Photo textures</h3><span className={`setting-badge${applied ? " active" : ""}`}>{applied ? "Applied" : "AI original"}</span></div>
    <p>Copy visible lettering, logos, fabric, grain, and surface detail from your reference photo.</p><div className="texture-status"><span className="texture-swatch"/><div><strong>{applied ? "Source photo detail" : "Generated appearance"}</strong><small>{applied ? "Visible object surfaces · up to 2K" : "Original model textures"}</small></div>{applied && <Check size={17}/>}</div>
    <button className="button button-light button-full" disabled={busy || dirty || objectDirty || texturesBlocked} onClick={onTexture}><Sparkles size={15}/>{busy ? "Working…" : applied ? "Restore AI textures" : "Copy photo textures"}</button>
    {applied&&<button className="button button-light button-full" disabled={busy||dirty||objectDirty||texturesBlocked} onClick={onRefresh}>Refresh source detail</button>}
    <div className="inspector-note"><strong>Photo background · {backgroundReady?"ready":"not built"}</strong><p>Preserve visible background texture, gradients and boundaries. AI fills the areas behind reconstructed objects; open scenes stay open.</p><button className="button button-light button-full" disabled={busy||dirty||objectDirty||!generationEnabled} onClick={onBackground}>{backgroundReady?"Refresh photo background":"Build photo background"}</button><p>Plain backgrounds use a solid color without a baked shadow or an AI image edit. Other backgrounds use one Meta image edit; hidden areas and views outside the photo are estimated.</p></div>
    {texturesBlocked && <p className="control-hint">Restore original objects in Products before copying or restoring photo textures.</p>}
    {(dirty || objectDirty) && <p className="control-hint">Save your changes before switching textures.</p>}
    <div className="inspector-note"><strong>What gets copied?</strong><p>Visible object surfaces use aligned photo detail. Hidden surfaces keep their AI texture. Small text is limited by source resolution and mesh alignment. The photo background is built separately and stays when you restore object textures.</p><p>Photo textures save immediately and can be restored. They include the original lighting, so softer lights preserve more detail.</p></div>
  </section>;
  return <section className="appearance-controls" aria-label="Scene lighting"><div className="inspector-section-heading"><Lightbulb size={17}/><h3>Scene lighting</h3><span className="setting-badge">Live preview</span></div><p>Position your lights and balance their brightness.</p>
    {(["key", "fill"] as const).map(name => <fieldset className="light-group" key={name} disabled={busy}><legend><span className={`light-dot ${name}`}/>{name === "key" ? "Main light" : "Fill light"}</legend>
      <RangeField label={`${name === "key" ? "Main" : "Fill"} intensity`} min={0} max={8} step={0.1} value={lighting[name].intensity} onChange={value => setLighting({ ...lighting, [name]: { ...lighting[name], intensity: value } })}/>
      <span className="control-group-label">Position</span><div className="light-position-fields">{(["X", "Y", "Z"] as const).map((axis, i) => <RangeField key={axis} label={`${name === "key" ? "Main" : "Fill"} ${axis}`} min={axis === "Y" ? 0.1 : -20} max={20} step={0.1} value={lighting[name].position[i]} onChange={value => {
        const position = [...lighting[name].position] as [number, number, number]; position[i] = value;
        setLighting({ ...lighting, [name]: { ...lighting[name], position } });
      }}/>)}</div>
    </fieldset>)}
    <div className="ambient-group"><RangeField label="Ambient intensity" disabled={busy} min={0} max={4} step={0.1} value={lighting.ambient} onChange={value => setLighting({ ...lighting, ambient: value })}/><p className="control-hint">Soft overall brightness, without a fixed direction.</p></div>
    <button className="button button-light button-full" disabled={busy} onClick={onReset}><RotateCcw size={14}/>Reset lights</button>
  </section>;
}
