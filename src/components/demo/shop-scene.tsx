"use client";
import { StylistPanel } from "./stylist-panel";
import { merchandiseTotal, purchasing } from "@/lib/shopping/engine";
import type { Arrangement } from "@/lib/demo/state";
import { DemoVoiceControls } from "./voice-controls";
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
  ScanLine,
  Box,
  LockKeyhole,
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
import { PhotoShop, PhotoProductGallery } from "./photo-shop";
import { photoShoppingScene, photoPurchaseDraft } from "@/lib/demo/photo-shopping";
import { productCover } from "@/lib/demo/albums";
export function ShopScenePage({ sceneId = "living" }: { sceneId?: string }) {
  const scene = demoScenes.find((s) => s.id === sceneId)!,
    info = collectionInfo[scene.id],
    store = useDemoStore();
  const [timeline, setTimeline] = useState(() =>
      editHistory(initialArrangement(scene)),
    ),
    [selected3d, setSelected] = useState(scene.objects[0].id),
    [selected2d, setSelected2d] = useState(scene.objects[0].id),
    [isolated, setIsolated] = useState<string | null>(null),
    [look, setLook] = useState(false),
    [panel, setPanel] = useState<"products" | "stylist">("products"),
    [preview, setPreview] = useState<Arrangement | null>(null),
    [photo, setPhoto] = useState(false),
    [shopping2d, setShopping2d] = useState(false),
    [photoIncluded, setPhotoIncluded] = useState<string[]>(scene.objects.map(o => o.id)),
    [reset, setReset] = useState(false),
    [replacing, setReplacing] = useState(false),
    [message, setMessage] = useState("");
  const draft = timeline.present,
    selected = shopping2d ? selected2d : selected3d,
    shoppingDraft = shopping2d ? photoPurchaseDraft(scene, photoIncluded) : draft,
    item = shoppingDraft.items[selected],
    product = findDemoProduct(item ? itemProductId(selected, item) : selected),
    included = scene.objects
      .filter((o) => purchasing(shoppingDraft.items[o.id]))
      .map((o) => o.id),
    total = merchandiseTotal(shoppingDraft),
    photoScene = photoShoppingScene(scene.id);
  function update(patch: Partial<ItemDraft>, group: string | null = null) {
    if (shopping2d) return "Return to 3D to edit the scene.";
    setPreview(null);
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
    if (shopping2d) { setSelected2d(id); return; }
    setSelected(id);
    if (isolated) setIsolated(id || null);
  }
  function showAll() {
    setPreview(null);
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
    <main className={`demo-main demo-room-main${shopping2d ? " shopping-photo-mode" : ""}`} data-shopping-mode={shopping2d ? "2d" : "3d"}>
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
            {shopping2d ? "Select a product in the original photo, explore its details, or shop the whole look." : "Discover each piece. Move it, try a finish, or add the whole look to your bag."}
          </p>
        </div>
        <button className="d-button primary" onClick={() => setLook(true)}>
          <ShoppingBag size={16} />
          Shop this look
        </button>
      </div>
      <div className="demo-room-layout">
        <div className="demo-room-stage">
          {preview && (
            <div className="stylist-preview-banner">
              Stylist preview · not applied{" "}
              <button onClick={() => setPreview(null)}>
                Back to your scene
              </button>
            </div>
          )}
          <div className="demo-room-topbar">
            <span>
              <span className="demo-live-dot" />
              {shopping2d ? "Shop the original photo" : photo
                ? "Sample photography"
                : isolated
                  ? "Inspecting a product"
                  : "Interactive room"}
            </span>
            <div>
              {!shopping2d && <DemoVoiceControls
                sceneId={scene.id}
                draft={draft}
                selected={selected}
                onApply={(next, id) => {
                  setPreview(null);
                  setTimeline((t) => recordEdit(t, next));
                  setSelected(id);
                  setIsolated(null);
                  setPhoto(false);
                  setMessage(
                    "Voice changes applied. Undo restores the previous scene.",
                  );
                }}
              />}
              <SceneAlbumButton sceneId={scene.id} name={info.name} />
              <button className="d-text photo-mode-toggle" aria-pressed={shopping2d} onClick={() => {
                if (!shopping2d) setSelected2d(selected3d);
                setShopping2d(v => !v); setPanel("products"); setPreview(null); setPhoto(false); setReplacing(false); setLook(false);
              }}>
                {shopping2d ? <Box size={15}/> : <ScanLine size={15}/>}{shopping2d ? "Back to 3D" : "Shop in 2D"}
              </button>
              {!shopping2d && <>
              <button
                className="d-icon"
                aria-label="Undo scene edit"
                disabled={!timeline.past.length}
                onClick={() => {
                  setPreview(null);
                  setTimeline((t) => undoEdit(t));
                }}
              >
                <Undo2 size={16} />
              </button>
              <button
                className="d-icon"
                aria-label="Redo scene edit"
                disabled={!timeline.future.length}
                onClick={() => {
                  setPreview(null);
                  setTimeline((t) => redoEdit(t));
                }}
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
              </>}
            </div>
          </div>
          {shopping2d ? <PhotoShop scene={photoScene} selected={selected} onSelect={select}/> : photo ? (
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
              draft={preview ?? draft}
              selected={selected}
              onSelect={select}
              individual={isolated ?? undefined}
            />
          )}
          <div className="demo-scene-product-strip">
            {scene.objects.map((o) => {
              const p = findDemoProduct(
                itemProductId(o.id, shoppingDraft.items[o.id]),
              )!;
              return (
                <button
                  key={o.id}
                  aria-pressed={selected === o.id}
                  onClick={() => select(selected === o.id ? "" : o.id)}
                >
                  <Image
                    src={productCover(p.id)}
                    alt=""
                    width={100}
                    height={100}
                  />
                  <span>
                    {p.name}
                    <strong>{money(p.price)}</strong>
                  </span>
                  {!shoppingDraft.items[o.id].visible && <EyeOff size={13} />}
                </button>
              );
            })}
          </div>
        </div>
        <aside className="demo-room-sidebar showroom-sidebar shop-stylist-sidebar">
          <div
            className="showroom-tabs"
            role="tablist"
            aria-label="Shopping controls"
          >
            {(["products", "stylist"] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={panel === tab}
                disabled={shopping2d && tab === "stylist"}
                title={shopping2d && tab === "stylist" ? "The stylist is available in 3D mode" : undefined}
                onClick={() => {
                  setPreview(null);
                  setPanel(tab);
                }}
              >
                {tab === "stylist" ? <>{shopping2d && <LockKeyhole size={12}/>}AI stylist</> : shopping2d ? "Product details" : "Product & room"}
              </button>
            ))}
          </div>
          <div className="showroom-panel-body">
            {!shopping2d && <div hidden={panel !== "stylist"}>
              <StylistPanel
                sceneId={scene.id}
                draft={draft}
                selected={selected}
                previewActive={!!preview}
                onPreview={(next) => {
                  setPreview(next);
                  if (next) {
                    setPhoto(false);
                    setIsolated(null);
                  }
                }}
                onOwned={(id, owned) => {
                  setPreview(null);
                  setTimeline((t) =>
                    recordEdit(t, {
                      ...t.present,
                      items: {
                        ...t.present.items,
                        [id]: { ...t.present.items[id], owned },
                      },
                    }),
                  );
                }}
                onApply={(option) => {
                  setPreview(null);
                  setPhoto(false);
                  setIsolated(null);
                  setTimeline((t) => recordEdit(t, option.draft));
                  setMessage(
                    `${option.title} applied. Undo restores the previous look.`,
                  );
                }}
              />
            </div>}
            <div hidden={panel !== "products"}>
              <section className="demo-panel demo-shop-card">
                {!shopping2d && message && (
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
                          src={productCover(product.id)}
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
                    {shopping2d && <>
                      <div className="photo-product-actions"><button className="d-button primary" onClick={() => store.add(product.id, 0)}><ShoppingBag size={14}/>Add item</button><Link className="d-text" href={`/demo/product/${product.id}`}>Full details<ArrowRight size={13}/></Link></div>
                      <p className="photo-product-note"><LockKeyhole size={12}/>As photographed · edits available in 3D</p>
                      <p className="photo-product-description">{product.description}</p>
                      <dl className="photo-product-specs"><div><dt>Materials</dt><dd>{product.materials}</dd></div><div><dt>Dimensions</dt><dd>{product.dimensions}</dd></div></dl>
                      <PhotoProductGallery key={product.id} id={product.id}/>
                    </>}
                    {!shopping2d && <>
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
                        {item.visible ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}{" "}
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
                    </>}
                    {!shopping2d && <><button
                      className="d-button primary full"
                      onClick={() => store.add(product.id, item.color)}
                    >
                      <ShoppingBag size={16} />
                      Add to shopping list
                    </button>
                    <Link
                      className="d-text"
                      href={`/demo/product/${product.id}`}
                    >
                      Photos & product details
                      <ArrowRight size={14} />
                    </Link>
                    </>}
                  </>
                ) : (
                  <div className="demo-empty">
                    <Focus size={28} />
                    <h2>Select a product</h2>
                    <p>
                      {shopping2d ? "Select a product in the photo or use its numbered selector." : "Select a product in the scene to view its details and adjust it."}
                    </p>
                  </div>
                )}
              </section>
              {!shopping2d && <><section className="demo-panel demo-light-panel">
                <h2>Set the mood</h2>
                <div className="demo-lighting">
                  {(
                    ["Original", "Day", "Dusk", "Night", "Studio"] as const
                  ).map((name) => (
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
                  ))}
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
              </details></>}
            </div>
          </div>
          <div className="demo-room-purchase">
            <div>
              <span>{included.length} products to buy</span>
              <strong>{money(total)}</strong>
            </div>
            <button
              className="d-button primary full"
              disabled={!!preview || !included.length}
              onClick={() => setLook(true)}
            >
              <ShoppingBag size={15} />
              Shop this look
            </button>
          </div>
        </aside>
      </div>
      {!shopping2d && replacing && selected && (
        <ReplacementPicker
          scene={scene}
          draft={draft}
          id={selected}
          onReplace={(productId) => update({ productId })}
          onClose={() => setReplacing(false)}
        />
      )}
      {!shopping2d && reset && (
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
            {shopping2d ? "Choose products from the original photograph. Original finishes are included." : "Choose the pieces for your demo shopping list. Current color selections are included."}
          </p>
          <div className="demo-look-list">
            {scene.objects.map((o) => {
              const p = findDemoProduct(
                  itemProductId(o.id, shoppingDraft.items[o.id]),
                )!,
                checked = included.includes(o.id);
              return (
                <label key={o.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!!shoppingDraft.items[o.id].owned}
                    onChange={() => shopping2d
                      ? setPhotoIncluded(ids => checked ? ids.filter(id => id !== o.id) : [...ids, o.id])
                      : setTimeline((t) =>
                        recordEdit(t, {
                          ...t.present,
                          items: {
                            ...t.present.items,
                            [o.id]: {
                              ...t.present.items[o.id],
                              included: !checked,
                            },
                          },
                        }),
                      )
                    }
                  />
                  <Image src={demoImage(p.id)} alt="" width={65} height={65} />
                  <span>
                    {p.name}
                    <small>{p.colors[shoppingDraft.items[o.id].color].name}</small>
                  </span>
                  <strong>
                    {shoppingDraft.items[o.id].owned ? "Owned" : money(p.price)}
                  </strong>
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
                  id: itemProductId(id, shoppingDraft.items[id]),
                  color: shoppingDraft.items[id].color,
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
