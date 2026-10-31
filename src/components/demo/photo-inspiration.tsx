"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, Images } from "lucide-react";
import { productInspiration, sceneInspiration } from "@/lib/demo/inspiration";
import { DemoDialog } from "./store";
export function PhotoInspiration({ kind }: { kind: "products" | "scenes" }) {
  const items = kind === "products" ? productInspiration : sceneInspiration;
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    item = items.find((p) => p.id === selected);
  return (
    <>
      <button
        className="demo-inspiration-trigger"
        onClick={() => {
          setSelected(null);
          setOpen(true);
        }}
      >
        <Images size={16} />
        <span>
          More {kind === "products" ? "product" : "setting"} photos{" "}
          <strong>({items.length})</strong>
        </span>
        <small>Photo inspiration</small>
      </button>
      {open && (
        <DemoDialog
          title={
            item?.title ??
            `More ${kind === "products" ? "product" : "setting"} photos`
          }
          onClose={() => setOpen(false)}
          wide
        >
          {item ? (
            <>
              <button
                className="d-text"
                onClick={() => setSelected(null)}
                autoFocus
              >
                <ArrowLeft size={15} />
                All reference photos
              </button>
              <div className="demo-inspiration-expanded">
                <Image
                  src={item.path}
                  alt={item.title}
                  width={1200}
                  height={1200}
                />
              </div>
              <p>
                Sample photograph from the existing image library. This preview
                does not include a reconstructed 3D model.
              </p>
            </>
          ) : (
            <>
              <p>
                Explore more sample photographs. Use the ready collections on
                the main page for the interactive 3D demos.
              </p>
              <div className="demo-inspiration-grid">
                {items.map((p) => (
                  <button key={p.id} onClick={() => setSelected(p.id)}>
                    <Image src={p.path} alt={p.title} width={96} height={96} />
                    <span>{p.title}</span>
                    <small>Photo preview</small>
                  </button>
                ))}
              </div>
            </>
          )}
        </DemoDialog>
      )}
    </>
  );
}
