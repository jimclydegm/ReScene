"use client";
import { useId, type CSSProperties } from "react";

export function RangeField({ label, value, min, max, step, onChange, precision = 1, disabled = false }: {
  label: string; value: number; min: number; max: number; step: number; precision?: number; disabled?: boolean; onChange: (value: number) => void;
}) {
  const id = useId();
  const percent = Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
  return <div className="range-field"><div className="range-heading"><label htmlFor={id}>{label}</label><output htmlFor={id}>{value.toFixed(precision)}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} style={{ "--range-progress": `${percent}%` } as CSSProperties} onChange={event => onChange(Number(event.target.value))}/>
  </div>;
}
