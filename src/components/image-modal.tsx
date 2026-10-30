"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

/** Full-size image preview with a details column; mount it to open, it calls onClose when dismissed. */
export function ImageModal({ src, alt, title, kicker, stage, children, actions, onClose, onPrev, onNext }: {
  src: string | null; alt: string; title: string; kicker?: ReactNode; stage?: ReactNode; children?: ReactNode; actions?: ReactNode;
  onClose: () => void; onPrev?: () => void; onNext?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [size, setSize] = useState<{ src: string; label: string } | null>(null);
  useEffect(() => { const d = dialog.current; if (d && !d.open) d.showModal(); }, []);
  return <dialog ref={dialog} className="image-modal" aria-label={title} onClose={onClose}
    onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}
    onKeyDown={e => { if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return; if (e.key === "ArrowLeft" && onPrev) { e.preventDefault(); onPrev(); } if (e.key === "ArrowRight" && onNext) { e.preventDefault(); onNext(); } }}>
    <div className="image-modal-stage">
      {src ? <Image key={src} src={src} alt={alt} width={1600} height={1200} unoptimized onLoad={e => setSize({ src, label: `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}px` })}/> : stage}
      {onPrev && <button className="modal-nav prev" aria-label="Previous image" onClick={onPrev}><ChevronLeft size={18}/></button>}
      {onNext && <button className="modal-nav next" aria-label="Next image" onClick={onNext}><ChevronRight size={18}/></button>}
    </div>
    <aside className="image-modal-info">
      <div className="image-modal-head"><div>{kicker && <span className="image-modal-kicker">{kicker}</span>}<h2>{title}</h2></div><button className="icon-button" aria-label="Close preview" autoFocus onClick={() => dialog.current?.close()}><X size={16}/></button></div>
      <div className="image-modal-details">{children}
        {src && size?.src === src && <Fact label="Resolution">{size.label}</Fact>}
      </div>
      {src && <a className="text-link image-modal-open" href={src} target="_blank" rel="noopener noreferrer">Open full size <ExternalLink size={12}/></a>}
      {actions && <div className="image-modal-actions">{actions}</div>}
    </aside>
  </dialog>;
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <dl className="image-fact"><dt>{label}</dt><dd>{children}</dd></dl>;
}
