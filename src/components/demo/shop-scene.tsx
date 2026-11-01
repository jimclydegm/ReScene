"use client";
import {DemoVoiceControls} from "./voice-controls";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  Eye,
  EyeOff,
  Focus,
  ShoppingBag,
  X,
  Undo2,
  Redo2,
  RotateCcw,
  Sun,
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
  changeArrangement,
  supportOf,
} from "@/lib/demo/scenes";
import {
  editHistory,
  recordEdit,
  finishEdit,
  undoEdit,
  redoEdit,
} from "@/lib/editor/history";
import type { ItemDraft } from "@/lib/demo/state";
import { DemoDialog, useDemoStore } from "./store";
import { SceneAlbumButton } from "./image-album";
import { DemoViewer } from "./viewer";
import { ColorSwatches } from "./product";
import { RoomControls } from "./room-controls";
import { ReplacementPicker } from "./replacement-picker";
import { PositionControls } from "./position-controls";
export function ShopScenePage({ sceneId = "living" }: { sceneId?: string }) {
  const scene = demoScenes.find((s) => s.id === sceneId)!,
    info = collectionInfo[scene.id],
    store = useDemoStore();
  const [timeline, setTimeline] = useState(() =>
      editHistory(initialArrangement(scene)),
    ),
    [selected, setSelected] = useState(scene.objects[0].id),
    [isolated, setIsolated] = useState<string | null>(null),
    [look, setLook] = useState(false),
    [included, setIncluded] = useState(scene.objects.map((o) => o.id)),
    [photo, setPhoto] = useState(false),
    [reset, setReset] = useState(false),
    [replacing, setReplacing] = useState(false),
    [message, setMessage] = useState("");
  const draft = timeline.present,
    item = draft.items[selected],
    product = findDemoProduct(item ? itemProductId(selected, item) : selected),
    total = included.reduce(
      (n, id) => n + findDemoProduct(itemProductId(id, draft.items[id]))!.price,
      0,
    );
  function update(patch: Partial<ItemDraft>, group: string | null = null) {
    const result = changeArrangement(scene, draft, selected, patch);
    setMessage(result.error ?? "");
    if (!result.error) {
      setPhoto(false);
      if (patch.visible === false && isolated === selected) setIsolated(null);
      setTimeline((t) => recordEdit(t, result.draft, group));
    }
    return result.error;
  }
  function finish() {
    setTimeline((t) => finishEdit(t));
  }
  function select(id: string) {
    setSelected(id);
    if (isolated) setIsolated(id || null);
  }
  function showAll() {
    let next = draft;
    for (const obj of scene.objects) {
      const result = changeArrangement(scene, next, obj.id, { visible: true });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      next = result.draft;
    }
    setIsolated(null);
    setPhoto(false);
    setTimeline((t) => recordEdit(t, next));
    setMessage("");
  }
  return (
    <main className="demo-main demo-room-main">
      <div className="demo-breadcrumb">
        <Link href="/demo/scenes">Choose a scene</Link>
        <span>/</span>
        <span>{info.name}</span>
      </div>
      <div className="demo-section-heading">
        <div>
          <span className="d-kicker">Shop the scene</span>
          <h1>{info.name}</h1>
          <p>
            Discover each piece. Move it, try a finish, or add the whole look to
            your bag.
          </p>
        </div>
        <button className="d-button primary" onClick={() => setLook(true)}>
          <ShoppingBag size={16} />
          Shop this look
        </button>
      </div>
      <div className="demo-room-layout">
        <div className="demo-room-stage">
          <div className="demo-room-topbar">
            <span>
              <span className="demo-live-dot" />
              {photo
                ? "Sample photography"
                : isolated
                  ? "Inspecting a product"
                  : "Interactive room"}
            </span>
            <div>
              <DemoVoiceControls sceneId={scene.id} draft={draft} selected={selected} onApply={(next,id)=>{setTimeline(t=>recordEdit(t,next));setSelected(id);setIsolated(null);setPhoto(false);setMessage("Voice changes applied. Undo restores the previous scene.");}}/>
              <SceneAlbumButton sceneId={scene.id} name={info.name} />
              <button
                className="d-icon"
                aria-label="Undo scene edit"
                disabled={!timeline.past.length}
                onClick={() => setTimeline((t) => undoEdit(t))}
              >
                <Undo2 size={16} />
              </button>
              <button
                className="d-icon"
                aria-label="Redo scene edit"
                disabled={!timeline.future.length}
                onClick={() => setTimeline((t) => redoEdit(t))}
              >
                <Redo2 size={16} />
              </button>
              <button
                className="d-icon"
                aria-label="Reset scene edits"
                onClick={() => setReset(true)}
              >
                <RotateCcw size={16} />
              </button>
              <button className="d-text" onClick={() => setPhoto((v) => !v)}>
                {photo ? "Back to 3D" : "Compare photo"}
              </button>
              <button className="d-text" onClick={showAll}>
                Show all
              </button>
            </div>
          </div>
          {photo ? (
            <div className="demo-scene-photo">
              <Image
                src={demoImage(scene.id)}
                alt={`${info.name} sample photography`}
                width={1400}
                height={788}
              />
            </div>
          ) : (
            <DemoViewer
              scene={scene}
              draft={draft}
              selected={selected}
              onSelect={select}
              individual={isolated ?? undefined}
            />
          )}
          <div className="demo-scene-product-strip">
            {scene.objects.map((o) => {
              const p = findDemoProduct(
                itemProductId(o.id, draft.items[o.id]),
              )!;
              return (
                <button
                  key={o.id}
                  aria-pressed={selected === o.id}
                  onClick={() => select(selected === o.id ? "" : o.id)}
                >
                  <Image
                    src={demoImage(p.id)}
                    alt=""
                    width={100}
                    height={100}
                  />
                  <span>
                    {p.name}
                    <strong>{money(p.price)}</strong>
                  </span>
                  {!draft.items[o.id].visible && <EyeOff size={13} />}
                </button>
              );
            })}
          </div>
        </div>
        <aside className="demo-room-sidebar">
          <section className="demo-panel demo-shop-card">
            {message && (
              <p className="demo-feedback visibility-feedback" role="alert">
                {message}
              </p>
            )}
            {product && item ? (
              <>
                <div className="demo-panel-heading">
                  <span className="d-kicker">Selected product</span>
                  <button
                    className="d-icon"
                    aria-label="Deselect product"
                    onClick={() => select("")}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="retail-shop-product-head">
                  <Link href={`/demo/product/${product.id}`}>
                    <Image
                      src={demoImage(product.id)}
                      alt={product.name}
                      width={150}
                      height={150}
                    />
                  </Link>
                  <div>
                    <small>{product.category}</small>
                    <h2>{product.name}</h2>
                    <strong className="demo-shop-price">
                      {money(product.price)}
                    </strong>
                  </div>
                </div>
                <details className="demo-product-description">
                  <summary>About this piece</summary>
                  <p>{product.description}</p>
                </details>
                <button
                  className="d-button small showroom-swap-button"
                  onClick={() => setReplacing(true)}
                >
                  <ArrowRightLeft size={14} />
                  Replace item
                </button>
                <ColorSwatches
                  product={product}
                  value={item.color}
                  onChange={(color) => update({ color })}
                />
                <PositionControls
                  item={item}
                  id={selected}
                  onChange={update}
                  onFinish={finish}
                />
                {supportOf(scene, selected) && (
                  <p className="retail-support-note">
                    Move its supporting piece to move them together.
                  </p>
                )}

                <div className="demo-inline-actions">
                  <button
                    className="d-text"
                    onClick={() => update({ visible: !item.visible })}
                  >
                    {item.visible ? <EyeOff size={14} /> : <Eye size={14} />}{" "}
                    {item.visible ? "Hide item" : "Show item"}
                  </button>
                  <button
                    className="d-text"
                    onClick={() => {
                      setPhoto(false);
                      setIsolated(isolated ? null : selected);
                    }}
                  >
                    <Focus size={14} />
                    {isolated ? "Back to room" : "Inspect alone"}
                  </button>
                </div>
                <button
                  className="d-button primary full"
                  onClick={() => store.add(product.id, item.color)}
                >
                  <ShoppingBag size={16} />
                  Add to shopping list
                </button>
                <Link className="d-text" href={`/demo/product/${product.id}`}>
                  Photos & product details
                  <ArrowRight size={14} />
                </Link>
              </>
            ) : (
              <div className="demo-empty">
                <Focus size={28} />
                <h2>Select a product</h2>
                <p>
                  Select a product in the scene to view its details and adjust
                  it.
                </p>
              </div>
            )}
          </section>
          <section className="demo-panel demo-light-panel">
            <h2>Set the mood</h2>
            <div className="demo-lighting">
              {(["Original", "Day", "Dusk", "Night", "Studio"] as const).map(
                (name) => (
                  <button
                    key={name}
                    aria-pressed={draft.lighting === name}
                    onClick={() =>
                      setTimeline((t) =>
                        recordEdit(t, { ...t.present, lighting: name }),
                      )
                    }
                  >
                    <Sun size={14} />
                    {name}
                  </button>
                ),
              )}
            </div>
          </section>
          <details className="showroom-shop-room">
            <summary>Room & backgrounds</summary>
            <RoomControls
              scene={scene}
              draft={draft}
              onChange={(next, group) => {
                setPhoto(false);
                setIsolated(null);
                setTimeline((t) => recordEdit(t, next, group));
              }}
              onFinish={finish}
            />
          </details>
        </aside>
      </div>
      {replacing && selected && (
        <ReplacementPicker
          scene={scene}
          draft={draft}
          id={selected}
          onReplace={(productId) => update({ productId })}
          onClose={() => setReplacing(false)}
        />
      )}
      {reset && (
        <DemoDialog title="Reset this room?" onClose={() => setReset(false)}>
          <p>
            This restores its original arrangement, colors and lighting. You can
            undo the reset.
          </p>
          <button
            className="d-button primary"
            onClick={() => {
              setTimeline((t) => recordEdit(t, initialArrangement(scene)));
              setReset(false);
              setMessage("");
            }}
          >
            Reset room
          </button>
        </DemoDialog>
      )}
      {look && (
        <DemoDialog title={`Shop ${info.name}`} onClose={() => setLook(false)}>
          <p>
            Choose the pieces for your demo shopping list. Current color
            selections are included.
          </p>
          <div className="demo-look-list">
            {scene.objects.map((o) => {
              const p = findDemoProduct(
                  itemProductId(o.id, draft.items[o.id]),
                )!,
                checked = included.includes(o.id);
              return (
                <label key={o.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setIncluded((v) =>
                        checked ? v.filter((id) => id !== o.id) : [...v, o.id],
                      )
                    }
                  />
                  <Image src={demoImage(p.id)} alt="" width={65} height={65} />
                  <span>
                    {p.name}
                    <small>{p.colors[draft.items[o.id].color].name}</small>
                  </span>
                  <strong>{money(p.price)}</strong>
                </label>
              );
            })}
          </div>
          <div className="demo-look-total">
            <span>{included.length} selected products</span>
            <strong>{money(total)}</strong>
          </div>
          <button
            className="d-button primary full"
            disabled={!included.length}
            onClick={() => {
              setLook(false);
              store.addMany(
                included.map((id) => ({
                  id: itemProductId(id, draft.items[id]),
                  color: draft.items[id].color,
                })),
              );
            }}
          >
            <Check size={16} />
            Add selected to bag
          </button>
        </DemoDialog>
      )}
    </main>
  );
}
