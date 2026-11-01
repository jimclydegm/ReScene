"use client";
import { type ItemDraft } from "@/lib/demo/state";
export function PositionControls({
  item,
  id,
  onChange,
  onFinish,
}: {
  item: ItemDraft;
  id: string;
  onChange: (patch: Partial<ItemDraft>, group?: string | null) => void;
  onFinish: () => void;
}) {
  return (
    <fieldset className="retail-transform-controls">
      <legend>Adjust in the scene</legend>
      <p>Move along the surface or turn the product to find the right angle.</p>
      {(
        [
          ["x", "Left / right", -6, 6],
          ["z", "Back / forward", -5, 5],
          ["yaw", "Rotation", -Math.PI, Math.PI],
        ] as const
      ).map(([field, label, min, max]) => (
        <label key={field}>
          <span>
            {label}
            <output>
              {field === "yaw"
                ? `${Math.round((item.yaw * 180) / Math.PI)}°`
                : item[field].toFixed(2)}
            </output>
          </span>
          <div>
            <button
              aria-label={`Decrease ${label.toLowerCase()}`}
              disabled={!item.visible || item.locked}
              onClick={() => {
                onChange({
                  [field]: Math.max(
                    min,
                    item[field] - (field === "yaw" ? Math.PI / 12 : 0.1),
                  ),
                });
                onFinish();
              }}
            >
              −
            </button>
            <input
              type="range"
              min={min}
              max={max}
              step={0.02}
              value={item[field]}
              aria-label={label}
              disabled={!item.visible || item.locked}
              onChange={(e) =>
                onChange({ [field]: Number(e.target.value) }, `${id}:${field}`)
              }
              onPointerUp={onFinish}
              onPointerCancel={onFinish}
              onBlur={onFinish}
              onKeyUp={onFinish}
            />
            <button
              aria-label={`Increase ${label.toLowerCase()}`}
              disabled={!item.visible || item.locked}
              onClick={() => {
                onChange({
                  [field]: Math.min(
                    max,
                    item[field] + (field === "yaw" ? Math.PI / 12 : 0.1),
                  ),
                });
                onFinish();
              }}
            >
              +
            </button>
          </div>
        </label>
      ))}
    </fieldset>
  );
}
