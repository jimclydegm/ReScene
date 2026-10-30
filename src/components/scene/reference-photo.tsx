"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { Expand, ImageIcon, Minimize2, X } from "lucide-react";
import type { SceneWorkspace } from "./types";

/** Picture-in-picture reference that sits on the 3D viewport; expands to a full dialog. */
export function ReferencePhoto({ image, title }: { image: NonNullable<SceneWorkspace["image"]>; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  return <>
    {collapsed
      ? <button className="reference-inset-toggle" onClick={() => setCollapsed(false)} title="Show reference photo"><ImageIcon size={14}/>Reference</button>
      : <div className="reference-inset">
        <button className="reference-inset-photo" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog" aria-label="Expand reference photo" title="Expand reference photo">
          <Image src={image.url} alt={`Reference for ${title}`} width={image.width} height={image.height} unoptimized/>
          <span><Expand size={12}/></span>
        </button>
        <button className="reference-inset-hide" onClick={() => setCollapsed(true)} aria-label="Minimize reference photo" title="Minimize"><Minimize2 size={12}/></button>
      </div>}
    <dialog className="reference-dialog" ref={dialog} aria-label="Reference photo" onClick={event => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }}>
      <div className="reference-dialog-content"><div className="reference-dialog-heading"><div><span className="eyebrow">ORIGINAL PHOTO</span><h2>{title}</h2></div>
        <button className="button button-light button-small" onClick={() => dialog.current?.close()} aria-label="Close reference photo"><X size={15}/>Close</button></div>
        <Image src={image.url} alt={`Original reference for ${title}`} width={image.width} height={image.height} unoptimized/>
      </div>
    </dialog>
  </>;
}
