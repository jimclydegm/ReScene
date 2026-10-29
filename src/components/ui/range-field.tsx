"use client";
import { useId, type CSSProperties } from "react";

export function RangeField({ label, value, min, max, step, onChange, precision = 1, disabled = false }: {
  label: string; value: number; min: number; max: number; step: number; precision?: number; disabled?: boolean; onChange: (value: number) => void;
}) {
  const id = useId();
  const percent = Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
  return <div className="range-field"><div className="range-heading"><label htmlFor={id}>{label}</label><input className="range-number" key={value} aria-label={`${label} value`} type="number" min={min} max={max} step={step} disabled={disabled} defaultValue={value.toFixed(precision)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} onBlur={event => { if (event.currentTarget.value === value.toFixed(precision)) return; const next = event.currentTarget.valueAsNumber; if (Number.isFinite(next) && next >= min && next <= max) onChange(next); else event.currentTarget.value = value.toFixed(precision); }}/></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} style={{ "--range-progress": `${percent}%` } as CSSProperties} onChange={event => onChange(Number(event.target.value))}/>
  </div>;
}
