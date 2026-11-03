"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Images, ScanLine } from "lucide-react";
import { DemoDialog } from "./store";
import { ImageAlbum } from "./image-album";
import { productAlbum, type AlbumImage } from "@/lib/demo/albums";
import { findDemoProduct } from "@/lib/demo/catalog";
import { photoPoint, pickPhotoProduct, type DecodedPhotoMask } from "@/lib/demo/photo-mask";
import type { PhotoShoppingScene } from "@/lib/demo/photo-shopping";

export function PhotoShop({ scene, selected, onSelect }: {
  scene: PhotoShoppingScene; selected: string; onSelect: (id: string) => void;
}) {
  const [opacity, setOpacity] = useState(35);
  const [hovered, setHovered] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "partial">("loading");
  const decoded = useRef<DecodedPhotoMask[]>([]), filterId = useId().replace(/:/g, "");
  useEffect(() => {
    let cancelled = false;
    decoded.current = [];
    void Promise.allSettled(scene.products.map(async product => {
      const image = new window.Image();
      image.src = product.maskPath;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = product.bounds[2]; canvas.height = product.bounds[3];
      if (image.naturalWidth !== canvas.width || image.naturalHeight !== canvas.height) throw new Error("Mask frame changed");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Mask picking unavailable");
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const pixels = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < pixels.length; i++) pixels[i] = rgba[i*4+3];
      return { ...product, pixels };
    })).then(results => {
      if (cancelled) return;
      decoded.current = results.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
      setStatus(decoded.current.length === scene.products.length ? "ready" : "partial");
    });
    return () => { cancelled = true; decoded.current = []; };
  }, [scene]);
  function hit(e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) {
    const point = photoPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), scene.width, scene.height);
    return point ? pickPhotoProduct(decoded.current, point.x, point.y) : null;
  }
  return (
    <section className="photo-shop" aria-label="Shop the reference photo">
      <div className="photo-shop-tools">
        <span><ScanLine size={15}/>Select a product in the photo</span>
        <label htmlFor={`${filterId}-opacity`}>Highlight <input id={`${filterId}-opacity`} aria-label="Highlight opacity" type="range" min={0} max={80} value={opacity} onChange={e => setOpacity(Number(e.target.value))}/><output>{opacity}%</output></label>
      </div>
      <svg
        className={`photo-shop-image${hovered ? " has-hover" : ""}`}
        viewBox={`0 0 ${scene.width} ${scene.height}`} preserveAspectRatio="xMidYMid meet"
        role="group" aria-label="Photographed products. Click a product or use its numbered selector."
        onPointerMove={e => setHovered(hit(e))} onPointerLeave={() => setHovered(null)}
        onClick={e => { const id = hit(e); onSelect(id && selected !== id ? id : ""); }}
      >
        <title>Shop the original scene photograph</title>
        <defs><filter id={filterId} x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="edge"/><feFlood floodColor="#ffffff"/><feComposite in2="edge" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <image href={scene.photo.path} width={scene.width} height={scene.height} pointerEvents="none"/>
        {scene.products.filter(p => p.id === selected || p.id === hovered).map(p => (
          <image key={p.id} href={p.maskPath} x={p.bounds[0]} y={p.bounds[1]} width={p.bounds[2]} height={p.bounds[3]} pointerEvents="none" opacity={p.id === selected ? opacity / 100 : Math.min(opacity, 20) / 100} filter={`url(#${filterId})`}/>
        ))}
        {scene.products.map((p, index) => (
          <g key={p.id} className="photo-shop-pin" role="button" tabIndex={0}
            aria-label={`Select ${findDemoProduct(p.id)!.name} in photo`} aria-pressed={p.id === selected}
            transform={`translate(${p.anchor[0]} ${p.anchor[1]})`}
            onPointerMove={e => { e.stopPropagation(); setHovered(p.id); }}
            onClick={e => { e.stopPropagation(); onSelect(p.id === selected ? "" : p.id); }}
            onKeyDown={e => { if(e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id === selected ? "" : p.id); } }}
          >
            <title>{findDemoProduct(p.id)!.name}</title>
            <circle r="18"/><text textAnchor="middle" dominantBaseline="central">{index+1}</text>
          </g>
        ))}
      </svg>
      <div className="photo-shop-caption" role="status">
        {status === "loading" ? "Preparing photo selection… Numbered selectors are ready." : status === "partial" ? "Some outlines could not load. Use the numbered selectors or product cards." : hovered ? findDemoProduct(hovered)?.name : "Original photograph · Select a product to see its details"}
      </div>
    </section>
  );
}

export function PhotoProductGallery({ id }: { id: string }) {
  const images = productAlbum(id).filter(p => p.kind === "generated" && p.setting !== "reference").slice(0, 3);
  const [active, setActive] = useState<AlbumImage | null>(null);
  if (!images.length) return null;
  return (
    <div className="photo-product-gallery">
      <div><strong><Images size={14}/>Product photos</strong><span>Muse Image concepts</span></div>
      <div className="photo-product-thumbs">
        {images.map(image => <button key={image.id} aria-label={`Enlarge ${image.title}`} onClick={() => setActive(image)}><Image src={image.path} alt={image.title} width={96} height={72}/><span>{image.title}</span></button>)}
      </div>
      {active && <DemoDialog title={`${findDemoProduct(id)!.name} · Photos`} onClose={() => setActive(null)} wide><ImageAlbum label={findDemoProduct(id)!.name} images={images} activeId={active.id} onSelect={setActive} expandable={false}/><p>AI-generated product concepts. The scene photo and photographed product remain unchanged.</p></DemoDialog>}
    </div>
  );
}
