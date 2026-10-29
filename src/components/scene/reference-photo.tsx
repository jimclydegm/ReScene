"use client";
import Image from "next/image";
import { useRef } from "react";
import { Expand, X } from "lucide-react";
import type { SceneWorkspace } from "./types";

export function ReferencePhoto({ image, title }: { image: NonNullable<SceneWorkspace["image"]>; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="reference-photo" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog" aria-label="Expand reference photo">
      <Image src={image.url} alt={`Reference for ${title}`} width={image.width} height={image.height} unoptimized/>
      <span><strong>Reference photo</strong><small>Click to expand <Expand size={12}/></small></span>
    </button>
    <dialog className="reference-dialog" ref={dialog} aria-label="Reference photo" onClick={event => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }}>
      <div className="reference-dialog-content"><div className="reference-dialog-heading"><div><span className="eyebrow">ORIGINAL PHOTO</span><h2>{title}</h2></div>
        <button className="button button-light" onClick={() => dialog.current?.close()} aria-label="Close reference photo"><X size={18}/>Close</button></div>
        <Image src={image.url} alt={`Original reference for ${title}`} width={image.width} height={image.height} unoptimized/>
        <p>Compare placement, proportions, and orientation with your 3D scene. Press Esc to close.</p>
      </div>
    </dialog>
  </>;
}
