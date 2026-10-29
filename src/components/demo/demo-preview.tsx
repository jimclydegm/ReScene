"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowUpRight, Box, Eye, EyeOff, MoveRight, RotateCcw, Scan, MousePointer2 } from "lucide-react";
import { demoProducts, type DemoObject } from "./demo-data";

const DemoCanvas = dynamic(() => import("./demo-canvas"), {
  ssr: false, loading: () => <div className="canvas-loading"><Box size={26}/><span>Opening the sample scene…</span></div>
});

export function DemoPreview() {
  const [selected, setSelected] = useState<DemoObject>("sofa");
  const [hidden, setHidden] = useState<DemoObject[]>([]);
  const [offsets, setOffsets] = useState<Record<DemoObject, number>>({ sofa: 0, table: 0, lamp: 0 });
  const [reset, setReset] = useState(0);
  const product = demoProducts[selected];
  const isHidden = hidden.includes(selected);

  function resetScene() { setHidden([]); setOffsets({ sofa: 0, table: 0, lamp: 0 }); setReset(value => value + 1); }

  return <div className="demo-frame" id="preview">
    <div className="demo-topbar"><span><span className="tiny-dot"/> THE SUNDAY ROOM</span><span><Box size={12}/> INTERACTIVE SAMPLE</span></div>
    <div className="demo-canvas-wrap">
      <DemoCanvas key={reset} selected={selected} onSelect={setSelected} hidden={hidden} offsets={offsets}/>
      <div className="scene-hint"><MousePointer2 size={13}/> Drag to look around · click to explore</div>
      <div className="product-preview" aria-live="polite">
        <div className="product-preview-swatch" style={{ backgroundColor: product.color }}><Box size={26} strokeWidth={1}/></div>
        <div><span className="eyebrow">{product.category}</span><h3>{product.name}</h3><p>{product.price} <span>· sample product</span></p></div>
        <ArrowUpRight size={18}/>
      </div>
    </div>
    <div className="demo-bottom">
      <div className="object-chips" aria-label="Select a sample object">
        {(Object.keys(demoProducts) as DemoObject[]).map(id => <button type="button" key={id} className={`object-chip${selected === id ? " active" : ""}`} onClick={() => setSelected(id)}>{id[0].toUpperCase() + id.slice(1)}</button>)}
      </div>
      <div className="demo-tools">
        <button type="button" title="Move selected object" aria-label="Move selected object" onClick={() => setOffsets(value => ({ ...value, [selected]: value[selected] >= 0.8 ? 0 : value[selected] + 0.4 }))}><MoveRight size={16}/></button>
        <button type="button" title={isHidden ? "Show selected object" : "Hide selected object"} aria-label={isHidden ? "Show selected object" : "Hide selected object"} onClick={() => setHidden(value => isHidden ? value.filter(id => id !== selected) : [...value, selected])}>{isHidden ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
        <button type="button" title="Reset sample scene" aria-label="Reset sample scene" onClick={resetScene}><RotateCcw size={16}/></button>
      </div>
    </div>
    <div className="demo-caption"><Scan size={13}/> Illustrated 3D sample. Open your studio to reconstruct objects from a photo.</div>
  </div>;
}
