"use client";
import Image from "next/image";
import { ArrowLeftRight, RotateCcw } from "lucide-react";
export type CatalogItem={id:string;name:string;imageUrl:string|null};
export function CatalogControls({items,busy,dirty,canRestore,onSeed,onReplace,onRestore}:{items:CatalogItem[];busy:boolean;dirty:boolean;canRestore:boolean;onSeed:()=>void;onReplace:(id:string)=>void;onRestore:()=>void}){
 return <section className="catalog-controls"><div className="inspector-section-heading"><ArrowLeftRight size={16}/><h3>Replace this object</h3><span className="setting-badge">Demo catalog</span></div><p className="control-hint">Original illustrative assets, not commercial listings. Replacements fit the current scene size; position, rotation and your size adjustment stay in place. Saves immediately.</p>
 {dirty&&<p className="control-hint">Save your changes before replacing.</p>}
 {!items.length?<button className="button button-light button-full" disabled={busy||dirty} onClick={onSeed}>Add demo catalog</button>:<div className="catalog-grid">{items.map(item=><button key={item.id} className="catalog-item" disabled={busy||dirty} onClick={()=>onReplace(item.id)}>{item.imageUrl&&<Image src={item.imageUrl} alt="" width={150} height={150} unoptimized/>}<span>{item.name}</span><small>Replace object</small></button>)}</div>}
 {canRestore&&<button className="button button-light button-full" disabled={busy||dirty} onClick={onRestore}><RotateCcw size={14}/>Restore original object</button>}
 <p className="control-hint">Restore original object also brings back its original product card. Current position and size edits are kept. Photo matching and texture copying require originals.</p>
 </section>;
}
