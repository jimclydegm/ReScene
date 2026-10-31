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
import {
  demoImage,
  findDemoProduct,
  money,
  collectionInfo,
} from "@/lib/demo/catalog";
import {
  demoScenes,
  initialArrangement,
  collectionLayouts,
  changeArrangement,
  supportOf,
} from "@/lib/demo/scenes";
import {
  layoutNames,
  type LayoutName,
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
import { PositionControls } from "./position-controls";
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
            height={id.endsWith("chair") ? 16 : 11}
            rx={id.endsWith("table") ? 6 : 2}
            transform={`rotate(${(-d.yaw * 180) / Math.PI} ${60 + d.x * 13} ${37 + d.z * 10})`}
            fill={
              id.endsWith("chair")
                ? "#87957b"
                : id.endsWith("table")
                  ? "#fcfaf5"
                  : "#b2906f"
            }
          />
        ))}
    </svg>
  );
}
export function SpacePage({ sceneId = "corner" }: { sceneId?: string }) {
  const store = useDemoStore();
  return store.hydrated ? (
    <SpaceEditor sceneId={sceneId} />
  ) : (
    <main className="demo-main demo-empty">
      <h1>Build your space</h1>
      <p>Preparing your saved arrangements…</p>
    </main>
  );
}
function SpaceEditor({ sceneId }: { sceneId: string }) {
  const store = useDemoStore(),
    scene = demoScenes.find((s) => s.id === sceneId)!;
  const [timeline, setTimeline] = useState(() =>
      editHistory(
        store.collections[scene.id]?.A ??
          (scene.id === "space" && store.layouts
            ? store.layouts.A
            : collectionLayouts(scene).A),
      ),
    ),
    [slot, setSlot] = useState<LayoutName>("A"),
    [saveSlot, setSaveSlot] = useState<LayoutName>("A"),
    [selected, setSelected] = useState(
      scene.objects.find((o) => o.id.endsWith("chair"))?.id ??
        scene.objects[0].id,
    ),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<LayoutName | "reset" | null>(null);
  const layouts =
      store.collections[scene.id] ??
      (scene.id === "space" && store.layouts
        ? { ...collectionLayouts(scene), ...store.layouts }
        : collectionLayouts(scene)),
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
    const result = changeArrangement(scene, draft, id, patch);
    setMessage(result.error ?? "");
    if (!result.error) setTimeline((t) => recordEdit(t, result.draft, group));
  }

  function load(which: LayoutName) {
    setTimeline(editHistory(layouts[which]));
    setSlot(which);
    setSaveSlot(which);
    setMessage(`Layout ${which} loaded.`);
    setPending(null);
  }
  const visible = scene.objects.filter((o) => draft.items[o.id].visible),
    total = visible.reduce((s, o) => s + findDemoProduct(o.id)!.price, 0);
  return (
    <main className="demo-main demo-room-main">
      <div className="demo-breadcrumb">
        <Link href="/demo/spaces">Choose a collection</Link>
        <span>/</span>
        <span>Build your space</span>
      </div>
      <div className="demo-section-heading">
        <div>
          <span className="d-kicker">YOUR ROOM, YOUR WAY</span>
          <h1>{collectionInfo[scene.id].name}</h1>
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
          <section className="demo-layouts">
            <div>
              <LayoutGrid size={17} />
              <strong>Compare arrangements</strong>
              <small>Floor-plan previews</small>
            </div>
            <div className="demo-layout-options">
              {layoutNames.map((which) => (
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
              <label>
                Save as
                <select
                  aria-label="Save arrangement as"
                  value={saveSlot}
                  onChange={(e) => setSaveSlot(e.target.value as LayoutName)}
                >
                  {layoutNames.map((name) => (
                    <option key={name} value={name}>
                      Layout {name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="d-button small"
                onClick={() => {
                  store.setCollection(scene.id, {
                    ...layouts,
                    [saveSlot]: draft,
                  });
                  setSlot(saveSlot);
                  setMessage(`Layout ${saveSlot} saved in this browser.`);
                }}
              >
                <Save size={14} />
                Save
              </button>
            </div>
          </section>
          <DemoViewer
            scene={scene}
            draft={draft}
            selected={selected}
            onSelect={setSelected}
          />
          <div className="demo-stage-caption">
            <span>
              Click a product to edit · PNG downloads are in the viewer toolbar.
            </span>
            <small>
              Your changes stay in this demo. Real dimensions and fit are not
              verified.
            </small>
          </div>
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
                <PositionControls
                  item={item}
                  id={selected}
                  onChange={(patch, group) => update(selected, patch, group)}
                  onFinish={finish}
                />
                {supportOf(scene, selected) && (
                  <p className="retail-support-note">
                    This accessory stays on its cabinet. Move the cabinet to
                    move them together.
                  </p>
                )}
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
            ? `Unsaved arrangement · Save a layout to keep it in this browser.`
            : "Choose one of four layouts, or make it your own.")}
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
              ? "This restores the original collection arrangement. Your four saved layouts are kept."
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
