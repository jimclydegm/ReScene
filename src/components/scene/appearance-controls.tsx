"use client";
import { Lightbulb, Palette, RotateCcw, Sparkles, Check } from "lucide-react";
import type { Lighting } from "@/lib/scene/lighting";
import { RangeField } from "@/components/ui/range-field";
export function AppearanceControls({ panel, lighting, setLighting, dirty, objectDirty, busy, applied, onTexture, onReset, texturesBlocked = false }: {
  panel: "textures" | "lighting"; lighting: Lighting; setLighting: (value: Lighting) => void; dirty: boolean; objectDirty: boolean; busy: boolean; applied: boolean;
  texturesBlocked?: boolean; onTexture: () => void; onReset: () => void;
}) {
  if (panel === "textures") return <section className="appearance-controls" aria-label="Photo textures"><div className="inspector-section-heading"><Palette size={17}/><h3>Photo textures</h3><span className={`setting-badge${applied ? " active" : ""}`}>{applied ? "Applied" : "AI original"}</span></div>
    <p>Copy visible fabric, grain, and surface detail from your reference photo.</p><div className="texture-status"><span className="texture-swatch"/><div><strong>{applied ? "Source photo detail" : "Generated appearance"}</strong><small>{applied ? "Objects, floor & walls" : "Original model textures"}</small></div>{applied && <Check size={17}/>}</div>
    <button className="button button-light button-full" disabled={busy || dirty || objectDirty || texturesBlocked} onClick={onTexture}><Sparkles size={15}/>{busy ? "Working…" : applied ? "Restore AI textures" : "Copy photo textures"}</button>
    {texturesBlocked && <p className="control-hint">Restore original objects in Products before copying or restoring photo textures.</p>}
    {(dirty || objectDirty) && <p className="control-hint">Save your changes before switching textures.</p>}
    <div className="inspector-note"><strong>What gets copied?</strong><p>Visible object surfaces use photo detail. Hidden surfaces keep their AI texture. Floor and wall use clean, repeated photo patches.</p><p>Photo textures save immediately and can be restored. They include the original lighting, so softer lights preserve more detail.</p></div>
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
