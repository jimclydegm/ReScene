"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LayoutGrid,
  Moon,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  ShoppingBag,
  Sun,
  Undo2,
  X,
} from "lucide-react";
import { demoImage, findDemoProduct, money } from "@/lib/demo/catalog";
import {
  demoScenes,
  initialArrangement,
  startingLayouts,
} from "@/lib/demo/scenes";
import {
  footprintOverlap,
  type Arrangement,
  type ItemDraft,
} from "@/lib/demo/state";
import {
  editHistory,
  finishEdit,
  recordEdit,
  redoEdit,
  undoEdit,
} from "@/lib/editor/history";
import { ColorSwatches } from "./product";
import { DemoViewer } from "./viewer";
import { DemoDialog, useDemoStore } from "./store";

export function LayoutPreview({ draft }: { draft: Arrangement }) {
  return (
    <svg viewBox="0 0 120 74" aria-hidden="true">
      <rect x="1" y="1" width="118" height="72" rx="5" fill="#ece7dc" />
      {Object.entries(draft.items)
        .filter(([, d]) => d.visible)
        .map(([id, d]) => (
          <rect
            key={id}
            x={60 + d.x * 13 - 8}
            y={37 + d.z * 10 - 6}
            width={id === "oak-dresser" ? 19 : 14}
            height={id === "sage-chair" ? 16 : 11}
            rx={id === "round-table" ? 6 : 2}
            transform={`rotate(${(-d.yaw * 180) / Math.PI} ${60 + d.x * 13} ${37 + d.z * 10})`}
            fill={
              id === "sage-chair"
                ? "#87957b"
                : id === "round-table"
                  ? "#fcfaf5"
                  : "#b2906f"
            }
          />
        ))}
    </svg>
  );
}
export function SpacePage() {
  const store = useDemoStore();
  return store.hydrated ? (
    <SpaceEditor />
  ) : (
    <main className="demo-main demo-empty">
      <h1>Build your space</h1>
      <p>Preparing your saved arrangements…</p>
    </main>
  );
}
function SpaceEditor() {
  const store = useDemoStore(),
    scene = demoScenes.find((s) => s.id === "space")!;
  const [timeline, setTimeline] = useState(() =>
      editHistory(store.layouts?.A ?? startingLayouts().A),
    ),
    [slot, setSlot] = useState<"A" | "B">("A"),
    [selected, setSelected] = useState("sage-chair"),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<"A" | "B" | "reset" | null>(null);
  const layouts = store.layouts ?? startingLayouts(),
    draft = timeline.present,
    item = draft.items[selected],
    product = findDemoProduct(selected),
    dirty = JSON.stringify(draft) !== JSON.stringify(layouts[slot]);
  function finish() {
    setTimeline((t) => finishEdit(t));
  }
  function update(
    id: string,
    patch: Partial<ItemDraft>,
    group: string | null = null,
  ) {
    const proposed = {
        ...draft,
        items: { ...draft.items, [id]: { ...draft.items[id], ...patch } },
      },
      candidate = proposed.items[id],
      source = scene.objects.find((o) => o.id === id)!;
    if (
      candidate.visible &&
      ("x" in patch || "z" in patch || "yaw" in patch || "visible" in patch)
    ) {
      const overlaps = (a: ItemDraft, other: typeof source, b: ItemDraft) =>
        footprintOverlap(
          {
            ...a,
            width: source.placement.size[0],
            depth: source.placement.size[2],
          },
          {
            ...b,
            width: other.placement.size[0],
            depth: other.placement.size[2],
          },
        );
      const blocked = scene.objects.some(
        (o) =>
          o.id !== id &&
          proposed.items[o.id].visible &&
          overlaps(candidate, o, proposed.items[o.id]) &&
          (!draft.items[id].visible ||
            !overlaps(draft.items[id], o, draft.items[o.id])),
      );
      if (blocked) {
        setMessage(
          "That move overlaps another product. Try another direction or hide the other item first.",
        );
        return;
      }
    }
    setMessage("");
    setTimeline((t) => recordEdit(t, proposed, group));
  }
  function load(which: "A" | "B") {
    setTimeline(editHistory(layouts[which]));
    setSlot(which);
    setMessage(`Layout ${which} loaded.`);
    setPending(null);
  }
  const visible = scene.objects.filter((o) => draft.items[o.id].visible),
    total = visible.reduce((s, o) => s + findDemoProduct(o.id)!.price, 0);
  return (
    <main className="demo-main demo-room-main">
      <div className="demo-breadcrumb">
        <Link href="/demo">Demo experiences</Link>
        <span>/</span>
        <span>Build your space</span>
      </div>
      <div className="demo-section-heading">
        <div>
          <span className="d-kicker">YOUR ROOM, YOUR WAY</span>
          <h1>Good together. Even better your way.</h1>
          <p>
            Arrange the collection, explore colors and find your favorite light.
          </p>
        </div>
        <Link href="/demo/shop-the-scene" className="d-text">
          Shop a styled room
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="demo-room-layout">
        <div className="demo-room-stage">
          <div className="demo-room-topbar">
            <span>
              <span className="demo-live-dot" />
              Interactive showroom
            </span>
            <div>
              <button
                className="d-icon"
                aria-label="Undo arrangement change"
                disabled={!timeline.past.length}
                onClick={() => setTimeline((t) => undoEdit(t))}
              >
                <Undo2 size={16} />
              </button>
              <button
                className="d-icon"
                aria-label="Redo arrangement change"
                disabled={!timeline.future.length}
                onClick={() => setTimeline((t) => redoEdit(t))}
              >
                <Redo2 size={16} />
              </button>
              <button
                className="d-icon"
                aria-label="Reset arrangement"
                onClick={() => setPending("reset")}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
          <DemoViewer
            scene={scene}
            draft={draft}
            selected={selected}
            onSelect={setSelected}
          />
          <div className="demo-stage-caption">
            <span>
              Click a product to edit · Download a screenshot with the viewer’s
              download button.
            </span>
            <small>
              Your changes stay in this demo. Real dimensions and fit are not
              verified.
            </small>
          </div>
          <section className="demo-layouts">
            <div>
              <LayoutGrid size={17} />
              <strong>Compare arrangements</strong>
              <small>Floor-plan previews</small>
            </div>
            <div className="demo-layout-options">
              {(["A", "B"] as const).map((which) => (
                <button
                  key={which}
                  className={slot === which ? "active" : ""}
                  aria-pressed={slot === which}
                  onClick={() => {
                    if (which === slot) return;
                    if (dirty) setPending(which);
                    else load(which);
                  }}
                >
                  <LayoutPreview draft={layouts[which]} />
                  <span>
                    Layout {which}
                    {slot === which && <Check size={13} />}
                  </span>
                </button>
              ))}
            </div>
            <div className="demo-layout-save">
              {(["A", "B"] as const).map((which) => (
                <button
                  key={which}
                  className="d-button small"
                  onClick={() => {
                    store.setLayouts({ ...layouts, [which]: draft });
                    setSlot(which);
                    setMessage(
                      `Your arrangement is saved as Layout ${which} in this browser.`,
                    );
                  }}
                >
                  <Save size={13} />
                  Save to {which}
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="demo-room-sidebar">
          <section className="demo-panel">
            <div className="demo-panel-heading">
              <h2>The collection</h2>
              <span>
                {visible.length} of {scene.objects.length} in room
              </span>
            </div>
            <div className="demo-room-products">
              {scene.objects.map((o) => {
                const p = findDemoProduct(o.id)!,
                  d = draft.items[o.id];
                return (
                  <div
                    key={o.id}
                    className={`demo-room-product${selected === o.id ? " selected" : ""}${!d.visible ? " hidden-product" : ""}`}
                  >
                    <button
                      className="demo-room-product-select"
                      aria-pressed={selected === o.id}
                      onClick={() => setSelected(selected === o.id ? "" : o.id)}
                    >
                      <Image
                        src={demoImage(o.id)}
                        alt=""
                        width={56}
                        height={56}
                      />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{money(p.price)}</small>
                      </span>
                    </button>
                    <button
                      className="d-icon"
                      aria-label={`${d.visible ? "Remove" : "Add"} ${p.name} ${d.visible ? "from" : "to"} room`}
                      onClick={() => update(o.id, { visible: !d.visible })}
                    >
                      {d.visible ? <Eye size={15} /> : <Plus size={15} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="demo-panel demo-adjustments">
            <div className="demo-panel-heading">
              <h2>{product ? "Make it yours" : "Choose a product"}</h2>
              {selected && (
                <button
                  className="d-icon"
                  aria-label="Deselect product"
                  onClick={() => setSelected("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            {product && item ? (
              <>
                <strong className="demo-selected-name">{product.name}</strong>
                <ColorSwatches
                  product={product}
                  value={item.color}
                  onChange={(color) => update(selected, { color })}
                />
                <div className="demo-position-controls">
                  {(
                    [
                      ["x", "Left / right", -3, 3],
                      ["z", "Back / forward", -2, 2],
                      ["yaw", "Rotate", -Math.PI, Math.PI],
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
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.02}
                        value={item[field]}
                        aria-label={label}
                        disabled={!item.visible}
                        onChange={(e) =>
                          update(
                            selected,
                            { [field]: Number(e.target.value) },
                            `${selected}:${field}`,
                          )
                        }
                        onPointerUp={finish}
                        onPointerCancel={finish}
                        onBlur={finish}
                        onKeyUp={finish}
                      />
                    </label>
                  ))}
                </div>
                <div className="demo-inline-actions">
                  <button
                    className="d-text"
                    onClick={() => update(selected, { visible: !item.visible })}
                  >
                    {item.visible ? <EyeOff size={14} /> : <Eye size={14} />}{" "}
                    {item.visible ? "Hide item" : "Show item"}
                  </button>
                  <button
                    className="d-text"
                    onClick={() =>
                      update(
                        selected,
                        initialArrangement(scene).items[selected],
                      )
                    }
                  >
                    <RotateCcw size={13} />
                    Reset item
                  </button>
                </div>
                <Link href={`/demo/product/${selected}`} className="d-text">
                  View product details
                  <ArrowRight size={13} />
                </Link>
              </>
            ) : (
              <p>
                Click a product in the room or collection to adjust its position
                and finish.
              </p>
            )}
          </section>
          <section className="demo-panel">
            <h2>Set the mood</h2>
            <div className="demo-lighting">
              {(["Original", "Day", "Dusk", "Night", "Studio"] as const).map(
                (name) => (
                  <button
                    aria-pressed={draft.lighting === name}
                    key={name}
                    onClick={() =>
                      setTimeline((t) =>
                        recordEdit(t, { ...t.present, lighting: name }),
                      )
                    }
                  >
                    {name === "Night" ? <Moon size={14} /> : <Sun size={14} />}{" "}
                    {name}
                  </button>
                ),
              )}
            </div>
          </section>
          <div className="demo-room-purchase">
            <div>
              <span>{visible.length} products in your arrangement</span>
              <strong>{money(total)}</strong>
            </div>
            <button
              className="d-button primary full"
              disabled={!visible.length}
              onClick={() =>
                store.addMany(
                  visible.map((o) => ({
                    id: o.id,
                    color: draft.items[o.id].color,
                  })),
                )
              }
            >
              <ShoppingBag size={16} />
              Add arrangement to bag
            </button>
          </div>
        </aside>
      </div>
      <p className="demo-feedback" role="status" aria-live="polite">
        {message ||
          (dirty
            ? `Unsaved arrangement · Save to A or B to keep it in this browser.`
            : "Try the two layouts, or create your own.")}
      </p>
      <Link className="d-text" href="/demo">
        <ArrowLeft size={14} />
        All demo experiences
      </Link>
      {pending && (
        <DemoDialog
          title={
            pending === "reset"
              ? "Reset this arrangement?"
              : `Load Layout ${pending}?`
          }
          onClose={() => setPending(null)}
        >
          <p>
            {pending === "reset"
              ? "This restores the original collection arrangement. Your saved A and B layouts are kept."
              : "This replaces your current edits. Save them to A or B first if you want to keep them."}
          </p>
          <button
            className="d-button primary"
            onClick={() => {
              if (pending === "reset") {
                setTimeline((t) => recordEdit(t, initialArrangement(scene)));
                setPending(null);
                setMessage(
                  "Original arrangement restored. You can undo this change.",
                );
              } else load(pending);
            }}
          >
            {pending === "reset"
              ? "Reset arrangement"
              : `Load Layout ${pending}`}
          </button>
          <button className="d-button" onClick={() => setPending(null)}>
            Keep editing
          </button>
        </DemoDialog>
      )}
    </main>
  );
}
