"use client";
import type { Lighting } from "@/lib/scene/lighting";
export function AppearanceControls({ lighting, setLighting, dirty, objectDirty, busy, applied, onSave, onTexture, onReset }: {
  lighting: Lighting; setLighting: (value: Lighting) => void; dirty: boolean; objectDirty: boolean; busy: boolean; applied: boolean;
  onSave: () => void; onTexture: () => void; onReset: () => void;
}) {
  return <section className="appearance-controls" aria-label="Textures and lighting"><details open><summary>Textures & lighting</summary>
    <p>Transfer visible photo detail to the objects. Floor and wall use clean repeated photo patches; hidden object surfaces keep their AI texture.</p>
    <button className="button button-light" disabled={busy || dirty || objectDirty} onClick={onTexture}>{busy ? "Working…" : applied ? "Restore AI textures" : "Copy photo textures"}</button>
    <p className="preview-caveat">Photo textures include the original lighting. Use softer lights to avoid washing out details. Texture transfer saves immediately and can be reverted.</p>
    {(["key", "fill"] as const).map(name => <fieldset key={name}><legend>{name === "key" ? "Main light" : "Fill light"}</legend>
      <label>{name === "key" ? "Main" : "Fill"} intensity<input type="range" min={0} max={8} step={0.1} value={lighting[name].intensity} onChange={e => setLighting({ ...lighting, [name]: { ...lighting[name], intensity: Number(e.target.value) } })}/><output>{lighting[name].intensity.toFixed(1)}</output></label>
      {(["X", "Y", "Z"] as const).map((axis, i) => <label key={axis}>{name === "key" ? "Main" : "Fill"} {axis}<input type="range" min={axis === "Y" ? 0.1 : -20} max={20} step={0.1} value={lighting[name].position[i]} onChange={e => {
        const position = [...lighting[name].position] as [number, number, number]; position[i] = Number(e.target.value);
        setLighting({ ...lighting, [name]: { ...lighting[name], position } });
      }}/><output>{lighting[name].position[i].toFixed(1)}</output></label>)}
    </fieldset>)}
    <label>Ambient intensity<input type="range" min={0} max={4} step={0.1} value={lighting.ambient} onChange={e => setLighting({ ...lighting, ambient: Number(e.target.value) })}/><output>{lighting.ambient.toFixed(1)}</output></label>
    <div className="editor-actions"><button className="button button-light" disabled={busy} onClick={onReset}>Reset lights</button><button className="button button-dark" disabled={busy || !dirty} onClick={onSave}>Save lighting</button></div>
  </details></section>;
}
