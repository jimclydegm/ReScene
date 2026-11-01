"use client";
import { Shuffle, RotateCcw } from "lucide-react";
import {
  roomFinishes,
  roomColors,
  shuffleFinishes,
  continuousBackdrop,
} from "@/lib/demo/room-appearance";
import type { DemoScene } from "@/lib/demo/scenes";
import type { Arrangement } from "@/lib/demo/state";
export function RoomControls({
  scene,
  draft,
  onChange,
  onFinish,
}: {
  scene: DemoScene;
  draft: Arrangement;
  onChange: (next: Arrangement, group?: string | null) => void;
  onFinish?: () => void;
}) {
  const colors = roomColors(scene, draft),
    background = draft.background ?? { preset: "original" as const },
    continuous = continuousBackdrop(scene, draft);
  const hasFloorTexture =
    !!scene.appearance.floorUrl ||
    !!scene.composition.background?.geometry?.surfaces.some(
      (s) => s.role === "floor" && s.textured,
    );
  return (
    <section className="demo-panel showroom-room-controls">
      <div className="demo-panel-heading">
        <h2>Background & finishes</h2>
        <button
          className="d-icon"
          title="Restore original background"
          aria-label="Restore original background"
          onClick={() => {
            const next = { ...draft };
            delete next.background;
            onChange(next);
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <div className="showroom-backgrounds" aria-label="Background finishes">
        {roomFinishes.map((p) => {
          const c =
            p.id === "original"
              ? roomColors(scene, { background: undefined })
              : p;
          return (
            <button
              key={p.id}
              aria-pressed={
                background.preset === p.id &&
                !background.wall &&
                !background.floor
              }
              onClick={() =>
                onChange({ ...draft, background: { preset: p.id } })
              }
            >
              <span className="showroom-finish-preview">
                <i style={{ background: c.wall }} />
                <i style={{ background: "floor" in c ? c.floor : p.floor }} />
              </span>
              {p.name}
            </button>
          );
        })}
      </div>
      <div className="showroom-color-inputs">
        {(continuous ? (["wall"] as const) : (["wall", "floor"] as const)).map(
          (part) => (
            <label key={part}>
              <input
                aria-label={
                  continuous
                    ? "Backdrop color"
                    : part === "wall"
                      ? "Wall color"
                      : "Floor color"
                }
                type="color"
                value={colors[part]}
                onBlur={onFinish}
                onPointerUp={onFinish}
                onKeyUp={onFinish}
                onChange={(e) =>
                  onChange(
                    {
                      ...draft,
                      background: {
                        ...background,
                        [part]: e.target.value,
                        ...(continuous
                          ? { wall: e.target.value, floor: e.target.value }
                          : part === "floor"
                            ? { keepFloor: false }
                            : {}),
                      },
                    },
                    `room-${part}`,
                  )
                }
              />
              {continuous ? "Backdrop" : part === "wall" ? "Walls" : "Floor"}
              <span>{colors[part].toUpperCase()}</span>
            </label>
          ),
        )}
      </div>
      {hasFloorTexture && !continuous && (
        <label className="showroom-check">
          <input
            type="checkbox"
            checked={background.keepFloor ?? background.preset === "original"}
            onChange={(e) =>
              onChange({
                ...draft,
                background: { ...background, keepFloor: e.target.checked },
              })
            }
          />
          Keep original floor texture
        </label>
      )}
      <div className="showroom-quick-actions">
        <button
          className="d-button small"
          onClick={() => onChange(shuffleFinishes(draft))}
        >
          <Shuffle size={14} />
          Shuffle product colors
        </button>
        <button
          className="d-button small"
          onClick={() => {
            const choices = roomFinishes.filter(
                (p) => p.id !== background.preset && p.id !== "original",
              ),
              p = choices[Math.floor(Math.random() * choices.length)];
            onChange({ ...draft, background: { preset: p.id } });
          }}
        >
          <Shuffle size={14} />
          Surprise background
        </button>
      </div>
    </section>
  );
}
