"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fitReferenceViewport } from "@/lib/demo/presentation";
export function ReferenceFrame({
  aspect,
  children,
}: {
  aspect: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = fitReferenceViewport(
        entry.contentRect.width,
        entry.contentRect.height,
        aspect,
      );
      setSize((old) =>
        old.width === next.width && old.height === next.height ? old : next,
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [aspect]);
  return (
    <div className="demo-reference-frame" ref={ref}>
      <div
        className="demo-reference-inner"
        style={
          size.width ? { width: size.width, height: size.height } : undefined
        }
      >
        {size.width > 0 ? (
          children
        ) : (
          <div className="demo-viewer-loading" role="status">
            Preparing the reference view…
          </div>
        )}
      </div>
    </div>
  );
}
