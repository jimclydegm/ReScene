"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, Images } from "lucide-react";
import type { AlbumImage } from "@/lib/demo/albums";
import { sceneAlbum } from "@/lib/demo/albums";
import { DemoDialog } from "./store";
export function ImageAlbum({
  images,
  activeId,
  onSelect,
  label,
  expandable = true,
}: {
  images: AlbumImage[];
  activeId: string;
  onSelect: (image: AlbumImage) => void;
  label: string;
  expandable?: boolean;
}) {
  const index = Math.max(
      0,
      images.findIndex((i) => i.id === activeId),
    ),
    image = images[index],
    [expanded, setExpanded] = useState(false),
    strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = strip.current,
      button = root?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (root && button)
      root.scrollTo({
        left: Math.max(
          0,
          button.offsetLeft - root.clientWidth / 2 + button.clientWidth / 2,
        ),
        behavior: "smooth",
      });
  }, [activeId]);
  function move(delta: number) {
    onSelect(images[(index + delta + images.length) % images.length]);
  }
  return (
    <section
      className="shopping-album"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          move(e.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      <div className="shopping-album-main">
        <Image
          src={image.path}
          alt={`${label}: ${image.title}`}
          fill
          sizes="(max-width:850px) 100vw,65vw"
          priority={image.kind === "photo"}
        />
        <button
          className="album-arrow previous"
          aria-label="Previous image"
          disabled={images.length < 2}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={21} />
        </button>
        <button
          className="album-arrow next"
          aria-label="Next image"
          disabled={images.length < 2}
          onClick={() => move(1)}
        >
          <ChevronRight size={21} />
        </button>
        {expandable && (
          <button
            className="album-expand"
            aria-label="Enlarge image"
            onClick={() => setExpanded(true)}
          >
            <Maximize size={17} />
          </button>
        )}
        <span className="album-count">
          {index + 1} / {images.length}
        </span>
      </div>
      <div className="album-caption" aria-live="polite">
        <strong>{image.title}</strong>
        <span>
          {image.kind === "photo"
            ? "Sample photograph"
            : "AI-generated product photo"}
        </span>
      </div>
      <div className="album-filmstrip" ref={strip}>
        {images.map((item) => (
          <button
            key={item.id}
            aria-label={item.title}
            aria-pressed={image.id === item.id}
            onClick={() => onSelect(item)}
          >
            <Image src={item.path} alt="" width={72} height={60} sizes="72px" />
            <span>{item.title}</span>
          </button>
        ))}
      </div>
      {expanded && (
        <DemoDialog title={image.title} onClose={() => setExpanded(false)} wide>
          <div className="album-expanded">
            <Image
              src={image.path}
              alt={image.title}
              width={1200}
              height={1000}
            />
          </div>
          <p>
            {image.kind === "photo"
              ? "Sample photograph."
              : "AI-generated concept photograph based on the product reference. Details, finishes and settings are illustrative."}
          </p>
        </DemoDialog>
      )}
    </section>
  );
}
export function SceneAlbumButton({
  sceneId,
  name,
}: {
  sceneId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState("reference"),
    images = sceneAlbum(sceneId);
  return (
    <>
      <button className="d-text" onClick={() => setOpen(true)}>
        <Images size={15} />
        Scene album
      </button>
      {open && (
        <DemoDialog
          title={`${name} · Album`}
          onClose={() => setOpen(false)}
          wide
        >
          <ImageAlbum
            label={name}
            images={images}
            activeId={active}
            onSelect={(image) => setActive(image.id)}
            expandable={false}
          />
          <p>
            Reference photo and AI-generated styling concepts. The live editor
            keeps your current arrangement.
          </p>
        </DemoDialog>
      )}
    </>
  );
}
