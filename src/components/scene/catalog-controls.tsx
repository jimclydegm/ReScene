"use client";
import Image from "next/image";
import { RotateCcw } from "lucide-react";
export type CatalogItem={id:string;name:string;imageUrl:string|null};
export function CatalogControls({items,busy,dirty,canRestore,onSeed,onReplace,onRestore}:{items:CatalogItem[];busy:boolean;dirty:boolean;canRestore:boolean;onSeed:()=>void;onReplace:(id:string)=>void;onRestore:()=>void}){
 return <details className="panel-details catalog-controls" open={canRestore||undefined}><summary>Replace with a catalog object</summary>
 <p>Choose a saved product from your collection. Replacements keep the current position and fit the available space, then save immediately. Restore original returns to the source reconstruction.</p>
 {dirty&&<p className="panel-note">Save your changes before replacing.</p>}
 {!items.length?<button className="button button-light button-full" disabled={busy||dirty} onClick={onSeed}>Add demo catalog</button>:<div className="catalog-grid">{items.map(item=><button key={item.id} className="catalog-item" disabled={busy||dirty} onClick={()=>onReplace(item.id)} title={`Replace with ${item.name}`}>{item.imageUrl&&<Image src={item.imageUrl} alt="" width={150} height={150} unoptimized/>}<span>{item.name}</span></button>)}</div>}
 {canRestore&&<button className="button button-light button-full" disabled={busy||dirty} onClick={onRestore}><RotateCcw size={14}/>Restore original object</button>}
 </details>;
}
