"use client";
import { useId } from "react";

/** Binary masks use luminance; their black background must never cover the photo. */
export function MaskHighlight({
  url,
  width,
  height,
  opacity,
}: {
  url: string;
  width: number;
  height: number;
  opacity: number;
}) {
  const id = useId().replaceAll(":", ""),
    mask = `mask-${id}`,
    edge = `edge-${id}`;
  return (
    <svg
      className="mask-highlight"
      viewBox={`0 0 ${width} ${height}`}
      aria-label="Highlighted object outline"
      role="img"
    >
      <defs>
        <mask
          id={mask}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={width}
          height={height}
          style={{ maskType: "luminance" }}
        >
          <image href={url} width={width} height={height} />
        </mask>
        <filter id={edge} x="-5%" y="-5%" width="110%" height="110%">
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius={Math.max(width, height) / 450}
            result="outer"
          />
          <feComposite
            in="outer"
            in2="SourceAlpha"
            operator="out"
            result="outline"
          />
          <feFlood floodColor="#00e5ff" />
          <feComposite in2="outline" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${edge})`}>
        <rect
          width={width}
          height={height}
          fill="white"
          mask={`url(#${mask})`}
        />
      </g>
      <rect
        width={width}
        height={height}
        fill="#00c8e5"
        opacity={opacity}
        mask={`url(#${mask})`}
      />
    </svg>
  );
}
