"use client";
import {DemoVoiceControls} from "./voice-controls";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Focus,
  LockKeyhole,
  Unlock,
  Check,
  Eye,
  EyeOff,
  Moon,
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
  itemProductId,
} from "@/lib/demo/catalog";
import {
  demoScenes,
  initialArrangement,
  collectionLayouts,
  resolveCollectionLayouts,
  changeArrangement,
  supportOf,
  resetItemPatch,
} from "@/lib/demo/scenes";
import {
  layoutNames,
  layoutTitles,
  type LayoutName,
  type ItemDraft,
} from "@/lib/demo/state";
import {
  editHistory,
  finishEdit,
  recordEdit,
  redoEdit,
  undoEdit,
} from "@/lib/editor/history";
import { RoomControls } from "./room-controls";
import { ReplacementPicker } from "./replacement-picker";
import { arrangementProducts } from "@/lib/demo/room-appearance";
import { PositionControls } from "./position-controls";
import { ColorSwatches } from "./product";
import { SceneAlbumButton } from "./image-album";
import { DemoViewer } from "./viewer";
import { DemoDialog, useDemoStore } from "./store";

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
    [panel, setPanel] = useState<"products" | "room" | "layouts">("products"),
    [replacing, setReplacing] = useState(false),
    [isolated, setIsolated] = useState(false),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<LayoutName | "reset" | null>(null);
  const layouts = resolveCollectionLayouts(
      scene,
      store.collections[scene.id] ??
        (scene.id === "space" && store.layouts
          ? { ...collectionLayouts(scene), ...store.layouts }
          : undefined),
    ),
    draft = timeline.present,
    item = draft.items[selected],
    product = findDemoProduct(item ? itemProductId(selected, item) : selected),
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
    if (!result.error) {
      setTimeline((t) => recordEdit(t, result.draft, group));
      if (patch.visible === false) setIsolated(false);
    }
    return result.error;
  }

  function load(which: LayoutName) {
    setTimeline((t) => recordEdit(t, layouts[which]));
    setSlot(which);
    setSaveSlot(which);
    setMessage(`Layout ${which} loaded.`);
    setPending(null);
    setIsolated(false);
  }
  const visible = scene.objects.filter((o) => draft.items[o.id].visible),
    total = visible.reduce(
      (s, o) =>
        s + findDemoProduct(itemProductId(o.id, draft.items[o.id]))!.price,
      0,
    );
  return (
    <main className="demo-main demo-room-main showroom-main">
      <div className="demo-breadcrumb">
        <Link href="/demo/spaces">Choose a collection</Link>
        <span>/</span>
        <span>Build your space</span>
      </div>
      <div className="demo-section-heading">
        <div>
          <span className="d-kicker">Build your space</span>
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
              <DemoVoiceControls sceneId={scene.id} draft={draft} selected={selected} onApply={(next,id)=>{setTimeline(t=>recordEdit(t,next));setSelected(id);setIsolated(false);setMessage("Voice changes applied. Undo restores the previous arrangement.");}}/>
              <SceneAlbumButton
                sceneId={scene.id}
                name={collectionInfo[scene.id].name}
              />
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
            onSelect={(id) => {
              setSelected(id);
              if (!id) setIsolated(false);
            }}
            isolated={isolated && selected ? selected : undefined}
          />
        </div>
        <aside className="demo-room-sidebar showroom-sidebar">
          <div
            className="showroom-tabs"
            role="tablist"
            aria-label="Showroom controls"
          >
            {(["products", "room", "layouts"] as const).map((tab) => (
              <button
                key={tab}
                id={`showroom-tab-${tab}`}
                role="tab"
                aria-selected={panel === tab}
                aria-controls="showroom-panel"
                tabIndex={panel === tab ? 0 : -1}
                onKeyDown={(e) => {
                  const tabs = ["products", "room", "layouts"] as const;
                  const index = tabs.indexOf(tab);
                  const next =
                    e.key === "ArrowRight"
                      ? (index + 1) % 3
                      : e.key === "ArrowLeft"
                        ? (index + 2) % 3
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? 2
                            : null;
                  if (next !== null) {
                    e.preventDefault();
                    finish();
                    setPanel(tabs[next]);
                    document
                      .getElementById(`showroom-tab-${tabs[next]}`)
                      ?.focus();
                  }
                }}
                onClick={() => {
                  finish();
                  setPanel(tab);
                }}
              >
                {tab === "products"
                  ? "Products"
                  : tab === "room"
                    ? "Room"
                    : "Layouts"}
              </button>
            ))}
          </div>
          <div
            className="showroom-panel-body"
            id="showroom-panel"
            role="tabpanel"
            aria-labelledby={`showroom-tab-${panel}`}
          >
            {panel === "products" && (
              <>
                <section className="demo-panel demo-collection-panel">
                  <div className="demo-panel-heading">
                    <h2>The collection</h2>
                    <span>
                      {visible.length} of {scene.objects.length} in room
                    </span>
                  </div>
                  <div className="demo-room-products">
                    {scene.objects.map((o) => {
                      const p = findDemoProduct(
                          itemProductId(o.id, draft.items[o.id]),
                        )!,
                        d = draft.items[o.id];
                      return (
                        <div
                          key={o.id}
                          className={`demo-room-product${selected === o.id ? " selected" : ""}${!d.visible ? " hidden-product" : ""}`}
                        >
                          <button
                            className="demo-room-product-select"
                            title={p.name}
                            aria-label={`Select ${p.name}`}
                            aria-pressed={selected === o.id}
                            onClick={() => {
                              setSelected(selected === o.id ? "" : o.id);
                              if (selected === o.id) setIsolated(false);
                            }}
                          >
                            <Image
                              src={demoImage(p.id)}
                              alt=""
                              width={56}
                              height={56}
                            />
                            <span>
                              <strong>{p.name}</strong>
                              <small>{money(p.price)}</small>
                            </span>
                          </button>
                          {!d.visible && (
                            <span className="demo-product-hidden">
                              <EyeOff size={12} /> Hidden
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="demo-panel demo-adjustments">
                  <div className="demo-panel-heading">
                    <h2>{product?.name ?? "Choose a product"}</h2>
                    {selected && (
                      <button
                        className="d-icon"
                        aria-label="Deselect product"
                        onClick={() => {
                          setSelected("");
                          setIsolated(false);
                        }}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  {product && item ? (
                    <>
                      <div className="showroom-selected-summary">
                        <strong>{money(product.price)}</strong>
                        <button
                          className="d-button small"
                          onClick={() => setReplacing(true)}
                        >
                          <ArrowRightLeft size={14} />
                          Replace item
                        </button>
                      </div>
                      <ColorSwatches
                        product={product}
                        value={item.color}
                        onChange={(color) => update(selected, { color })}
                      />
                      <details className="showroom-placement">
                        <summary>Position & rotation</summary>
                        <PositionControls
                          item={item}
                          id={selected}
                          onChange={(patch, group) =>
                            update(selected, patch, group)
                          }
                          onFinish={finish}
                        />
                        {supportOf(scene, selected) && (
                          <p className="retail-support-note">
                            Move its supporting piece to move them together.
                          </p>
                        )}
                      </details>
                      <div className="showroom-item-tools">
                        <button
                          className="d-text"
                          aria-pressed={isolated}
                          disabled={!item.visible}
                          onClick={() => setIsolated((v) => !v)}
                        >
                          <Focus size={14} />
                          {isolated ? "View all" : "Isolate"}
                        </button>
                        <button
                          className="d-text"
                          aria-pressed={item.locked ?? false}
                          onClick={() =>
                            update(selected, { locked: !item.locked })
                          }
                        >
                          {item.locked ? (
                            <LockKeyhole size={14} />
                          ) : (
                            <Unlock size={14} />
                          )}{" "}
                          {item.locked ? "Unlock position" : "Lock position"}
                        </button>
                        <button
                          className="d-button small"
                          disabled={!item.visible}
                          onClick={() => store.add(product.id, item.color)}
                        >
                          <ShoppingBag size={14} />
                          Add item
                        </button>
                      </div>
                      <div className="demo-inline-actions">
                        <button
                          className="d-text"
                          onClick={() =>
                            update(selected, { visible: !item.visible })
                          }
                        >
                          {item.visible ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          {item.visible ? "Hide item" : "Show item"}
                        </button>
                        <button
                          className="d-text"
                          onClick={() =>
                            update(
                              selected,
                              resetItemPatch(scene, draft, selected),
                            )
                          }
                        >
                          <RotateCcw size={13} />
                          Reset item
                        </button>
                        <Link
                          href={`/demo/product/${product.id}`}
                          className="d-text"
                          aria-label="View product details"
                        >
                          Details <ArrowRight size={13} />
                        </Link>
                      </div>
                    </>
                  ) : (
                    <p>
                      Click a product in the room or collection to adjust its
                      position and finish.
                    </p>
                  )}
                </section>
              </>
            )}
            {panel === "room" && (
              <>
                <RoomControls
                  scene={scene}
                  draft={draft}
                  onChange={(next, group) =>
                    setTimeline((t) => recordEdit(t, next, group))
                  }
                  onFinish={finish}
                />
                <section className="demo-panel demo-light-panel">
                  <h2>Set the mood</h2>
                  <div className="demo-lighting">
                    {(
                      ["Original", "Day", "Dusk", "Night", "Studio"] as const
                    ).map((name) => (
                      <button
                        aria-pressed={draft.lighting === name}
                        key={name}
                        onClick={() =>
                          setTimeline((t) =>
                            recordEdit(t, { ...t.present, lighting: name }),
                          )
                        }
                      >
                        {name === "Night" ? (
                          <Moon size={14} />
                        ) : (
                          <Sun size={14} />
                        )}{" "}
                        {name}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
            {panel === "layouts" && (
              <section className="demo-panel showroom-layout-panel">
                <div className="demo-panel-heading">
                  <h2>Arrangements</h2>
                  <span>
                    {dirty ? "Unsaved changes" : "Saved in this browser"}
                  </span>
                </div>{" "}
                <section className="demo-layouts" aria-label="Scene layouts">
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
                        <span>
                          {layoutTitles[which]}
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
                        onChange={(e) =>
                          setSaveSlot(e.target.value as LayoutName)
                        }
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
              </section>
            )}
          </div>
          <div className="demo-room-purchase">
            <div>
              <span>{visible.length} products in your arrangement</span>
              <strong>{money(total)}</strong>
            </div>
            <button
              className="d-button primary full"
              disabled={!visible.length}
              onClick={() => store.addMany(arrangementProducts(draft))}
            >
              <ShoppingBag size={16} />
              Add arrangement to bag
            </button>
          </div>
        </aside>
      </div>
      {(message || dirty) && (
        <p className="demo-feedback" role="status" aria-live="polite">
          {message || (dirty ? "Unsaved arrangement" : "")}
        </p>
      )}
      {replacing && selected && (
        <ReplacementPicker
          scene={scene}
          draft={draft}
          id={selected}
          onReplace={(productId) => update(selected, { productId })}
          onClose={() => setReplacing(false)}
        />
      )}
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
              ? "This restores the original collection arrangement. Your six saved layouts are kept."
              : "This replaces your current edits. Save them to a layout first if you want to keep them."}
          </p>
          <button
            className="d-button primary"
            onClick={() => {
              if (pending === "reset") {
                setTimeline((t) => recordEdit(t, initialArrangement(scene)));
                setPending(null);
                setIsolated(false);
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
