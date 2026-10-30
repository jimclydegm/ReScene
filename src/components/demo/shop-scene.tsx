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
  Focus,
  ShoppingBag,
  X,
} from "lucide-react";
import { demoImage, findDemoProduct, money } from "@/lib/demo/catalog";
import { demoScenes, initialArrangement } from "@/lib/demo/scenes";
import { DemoDialog, useDemoStore } from "./store";
import { DemoViewer } from "./viewer";
import { ColorSwatches } from "./product";

export function ShopScenePage() {
  const scene = demoScenes.find((s) => s.id === "living")!,
    store = useDemoStore();
  const [draft, setDraft] = useState(() => initialArrangement(scene)),
    [selected, setSelected] = useState("cloud-sofa"),
    [isolated, setIsolated] = useState<string | null>(null),
    [look, setLook] = useState(false),
    [included, setIncluded] = useState(scene.objects.map((o) => o.id)),
    [photo, setPhoto] = useState(false);
  const product = findDemoProduct(selected),
    item = draft.items[selected],
    total = included.reduce((n, id) => n + findDemoProduct(id)!.price, 0);
  function select(id: string) {
    setSelected(id);
    if (isolated) setIsolated(id || null);
  }
  return (
    <main className="demo-main demo-room-main">
      <div className="demo-breadcrumb">
        <Link href="/demo">Demo experiences</Link>
        <span>/</span>
        <span>Shop the scene</span>
      </div>
      <div className="demo-section-heading">
        <div>
          <span className="d-kicker">THE SUNDAY LIVING ROOM</span>
          <h1>A whole room of possibilities.</h1>
          <p>
            A calm palette, warm wood, and pieces worth exploring. Click
            anything to make it yours.
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
                ? "Sample reference photo"
                : isolated
                  ? "Inspecting one product"
                  : "Explore the styled room"}
            </span>
            <div>
              <button className="d-text" onClick={() => setPhoto((v) => !v)}>
                {photo ? "Back to 3D" : "Compare photo"}
              </button>
              {!photo && (
                <button
                  className="d-text"
                  onClick={() => {
                    setIsolated(null);
                    setDraft((d) => ({
                      ...d,
                      items: Object.fromEntries(
                        Object.entries(d.items).map(([id, item]) => [
                          id,
                          { ...item, visible: true },
                        ]),
                      ),
                    }));
                  }}
                >
                  Show all
                </button>
              )}
            </div>
          </div>
          {photo ? (
            <div className="demo-scene-photo">
              <Image
                src={demoImage("living")}
                alt="Sample reference photo of the living room"
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
          <div className="demo-stage-caption">
            <span>
              {photo
                ? "Original-color sample photo. Switch back to explore the reconstructed objects."
                : "Select a product in the room, or browse the collection below."}
            </span>
            <small>
              AI reconstruction from a single image · geometry and material
              details are approximate.
            </small>
          </div>
          <div className="demo-scene-product-strip">
            {scene.objects.map((o) => {
              const p = findDemoProduct(o.id)!;
              return (
                <button
                  key={o.id}
                  aria-pressed={selected === o.id}
                  onClick={() => select(selected === o.id ? "" : o.id)}
                >
                  <Image
                    src={demoImage(o.id)}
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
            {product && item ? (
              <>
                <div className="demo-panel-heading">
                  <span className="d-kicker">SELECTED IN THE ROOM</span>
                  <button
                    className="d-icon"
                    aria-label="Deselect product"
                    onClick={() => select("")}
                  >
                    <X size={16} />
                  </button>
                </div>
                <Link
                  href={`/demo/product/${selected}`}
                  className="demo-selected-photo"
                >
                  <Image
                    src={demoImage(selected)}
                    alt={product.name}
                    width={500}
                    height={500}
                  />
                </Link>
                <small className="d-kicker">{product.category}</small>
                <h2>{product.name}</h2>
                <strong className="demo-shop-price">
                  {money(product.price)}
                </strong>
                <p>{product.description}</p>
                <ColorSwatches
                  product={product}
                  value={item.color}
                  onChange={(color) =>
                    setDraft((d) => ({
                      ...d,
                      items: {
                        ...d.items,
                        [selected]: { ...d.items[selected], color },
                      },
                    }))
                  }
                />
                <button
                  className="d-button primary full"
                  onClick={() => store.add(selected, item.color)}
                >
                  <ShoppingBag size={16} />
                  Add to shopping list
                </button>
                <div className="demo-inline-actions">
                  <button
                    className="d-text"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        items: {
                          ...d.items,
                          [selected]: {
                            ...d.items[selected],
                            visible: !d.items[selected].visible,
                          },
                        },
                      }))
                    }
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
                <Link href={`/demo/product/${selected}`} className="d-text">
                  Full product details
                  <ArrowRight size={14} />
                </Link>
              </>
            ) : (
              <div className="demo-empty">
                <Focus size={28} />
                <h2>Find your favorite piece.</h2>
                <p>
                  Click a product in the room to see its details, try a color or
                  add it to your list.
                </p>
              </div>
            )}
          </section>
          <section className="demo-panel demo-scene-summary">
            <h2>Bring the look together.</h2>
            <p>
              Choose your favorite pieces and build a shopping list in one step.
            </p>
            <button className="d-button full" onClick={() => setLook(true)}>
              Shop all {scene.objects.length} products
              <ArrowRight size={15} />
            </button>
          </section>
        </aside>
      </div>
      <div className="demo-bottom-prompt">
        <div>
          <h2>Have a different arrangement in mind?</h2>
          <p>Try another collection and make the room your own.</p>
        </div>
        <Link className="d-button" href="/demo/space">
          Build your space
          <ArrowRight size={16} />
        </Link>
      </div>
      <Link className="d-text" href="/demo">
        <ArrowLeft size={14} />
        All demo experiences
      </Link>
      {look && (
        <DemoDialog
          title="Shop the Sunday living room"
          onClose={() => setLook(false)}
        >
          <p>
            Choose the pieces for your demo shopping list. Current color
            selections are included.
          </p>
          <div className="demo-look-list">
            {scene.objects.map((o) => {
              const p = findDemoProduct(o.id)!,
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
                  <Image src={demoImage(o.id)} alt="" width={65} height={65} />
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
                included.map((id) => ({ id, color: draft.items[id].color })),
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
