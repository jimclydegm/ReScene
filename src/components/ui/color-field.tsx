"use client";
import { useId, useRef, useState } from "react";
import { normalizeHexColor, PRESET_COLORS } from "@/lib/ui/color";

export function ColorField({
  label,
  value,
  disabled = false,
  showPresets = true,
  showSpectrum = true,
  resetLabel = "White",
  onChange,
  onFinish,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  showPresets?: boolean;
  showSpectrum?: boolean;
  resetLabel?: string;
  onChange: (color: string) => void;
  onFinish?: () => void;
}) {
  const id = useId();
  const native = useRef<HTMLInputElement>(null);
  const canceled = useRef(false);
  const text = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState({ source: value, text: value });
  if (editing.source !== value) setEditing({ source: value, text: value });
  // A selection change or Undo supplies a new controlled value. Discard only
  // the obsolete text draft; do not keep displaying the previous object's color.
  const draft = editing.source === value ? editing.text : value;
  const setDraft = (text: string) => setEditing({ source: value, text });
  const color = normalizeHexColor(value) ?? "#ffffff";
  const isDefault = color === "#ffffff";
  const commit = (next: string) => {
    const normalized = normalizeHexColor(next);
    if (!normalized) return;
    setDraft(normalized.toUpperCase());
    if (normalized !== color) onChange(normalized);
  };
  const openPicker = () => {
    const input = native.current as
      | (HTMLInputElement & { showPicker?: () => void })
      | null;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  };
  return (
    <div className="cf" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))onFinish?.();}}>
      <div className="cf-head">
        <label className="cf-label" htmlFor={`${id}-hex`}>
          {label}
        </label>
        <span className="cf-value">{isDefault ? resetLabel : color.toUpperCase()}</span>
      </div>
      <div className="cf-row">
        <button
          type="button"
          className="cf-swatch"
          style={{ backgroundColor: color }}
          aria-label={`Choose ${label.toLowerCase()} color`}
          disabled={disabled}
          onClick={openPicker}
        />
        <input
          ref={text}
          id={`${id}-hex`}
          className="cf-hex"
          value={draft.toUpperCase()}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            // Commit text on blur/Enter. Expanding a three-digit prefix while
            // typing a six-digit value changes the caret and corrupts the input.
            setDraft(event.target.value.toUpperCase());
          }}
          onBlur={() => {
            if (canceled.current) { canceled.current = false; return; }
            const normalized = normalizeHexColor(draft);
            if (normalized) commit(normalized);
            else setDraft(normalizeHexColor(value)?.toUpperCase() ?? "#FFFFFF");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
            if (event.key === "Escape") {
              canceled.current = true;
              setDraft(normalizeHexColor(value)?.toUpperCase() ?? "#FFFFFF");
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
        <input
          className="cf-native"
          ref={native}
          type="color"
          value={color}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
          onChange={(event) => commit(event.target.value)}
        />
      </div>
      {showPresets ? (
        <fieldset className="cf-swatches" disabled={disabled}>
          <legend className="sr-only">{label} presets</legend>
          <button
            type="button"
            className="cf-swatch cf-swatch-none"
            aria-pressed={isDefault}
            aria-label={`Reset ${label.toLowerCase()} color to ${resetLabel.toLowerCase()}`}
            onClick={() => {
              setDraft("#FFFFFF");
              onChange("#ffffff");
              onFinish?.();
            }}
          >
            {resetLabel}
          </button>
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="cf-swatch cf-swatch-preset"
              style={{ backgroundColor: preset }}
              aria-pressed={color === preset}
              aria-label={`Color ${preset}`}
              title={preset}
              onClick={() => { commit(preset); onFinish?.(); }}
            />
          ))}
        </fieldset>
      ) : null}
      {showPresets && showSpectrum ? (
        <button
          type="button"
          className="cf-more"
          disabled={disabled}
          onClick={openPicker}
        >
          Custom color…
        </button>
      ) : null}
      <small id={`${id}-hint`} className="cf-hint">
        Hex, preset, or spectrum.
      </small>
    </div>
  );
}

export default ColorField;
