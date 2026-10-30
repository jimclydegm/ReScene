"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Minus,
  Plus,
  Rotate3d,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import {
  demoImage,
  demoProducts,
  findDemoProduct,
  money,
  type DemoProduct,
} from "@/lib/demo/catalog";
import { demoScenes, initialArrangement } from "@/lib/demo/scenes";
import { DemoViewer } from "./viewer";
import { DemoDialog, useDemoStore } from "./store";

export function ColorSwatches({
  product,
  value,
  onChange,
}: {
  product: DemoProduct;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="demo-colors">
      <legend>
        Color <strong>{product.colors[value].name}</strong>
      </legend>
      <div>
        {product.colors.map((c, i) => (
          <button
            key={c.name}
            type="button"
            aria-label={c.name}
            aria-pressed={value === i}
            title={c.name}
            onClick={() => onChange(i)}
            style={{ "--swatch": c.swatch } as React.CSSProperties}
          >
            {i === value && <Check size={16} />}
          </button>
        ))}
      </div>
      <small>Illustrative color options; original textures are retained.</small>
    </fieldset>
  );
}
export function ProductTile({ id }: { id: string }) {
  const p = findDemoProduct(id)!;
  return (
    <Link className="demo-product-tile" href={`/demo/product/${id}`}>
      <div>
        <Image src={demoImage(id)} alt={p.name} width={500} height={500} />
        <span>
          <Box size={13} /> View in 3D
        </span>
      </div>
      <small>{p.category}</small>
      <h3>{p.name}</h3>
      <strong>{money(p.price)}</strong>
    </Link>
  );
}
export function ProductPage({ id }: { id: string }) {
  const p = findDemoProduct(id)!,
    scene = demoScenes.find((s) => s.objects.some((o) => o.id === id))!,
    store = useDemoStore();
  const [color, setColor] = useState(0),
    [quantity, setQuantity] = useState(1),
    [mode, setMode] = useState<"3d" | "photo">("3d"),
    [review, setReview] = useState(false),
    [localReview, setLocalReview] = useState<{
      text: string;
      rating: number;
    } | null>(null);
  const draft = initialArrangement(scene);
  draft.items[id].color = color;
  const related = demoProducts
    .filter((v) => v.id !== id && scene.objects.some((o) => o.id === v.id))
    .slice(0, 3);
  return (
    <main className="demo-main">
      <div className="demo-breadcrumb">
        <Link href="/demo">Home</Link>
        <span>/</span>
        <Link href="/demo/space">The collection</Link>
        <span>/</span>
        <span>{p.name}</span>
      </div>
      <section className="demo-product-layout">
        <div className="demo-product-media">
          <div className="demo-media-tabs" aria-label="Product view">
            <button aria-pressed={mode === "3d"} onClick={() => setMode("3d")}>
              <Rotate3d size={15} />
              Interactive 3D
            </button>
            <button
              aria-pressed={mode === "photo"}
              onClick={() => setMode("photo")}
            >
              Sample photo
            </button>
          </div>
          {mode === "3d" ? (
            <div className="demo-product-viewer">
              <DemoViewer
                scene={scene}
                draft={draft}
                selected=""
                onSelect={() => {}}
                individual={id}
              />
            </div>
          ) : (
            <div className="demo-product-photo">
              <Image
                src={demoImage(id)}
                alt={`Original-color sample photo of ${p.name}`}
                fill
                sizes="(max-width: 850px) 100vw, 60vw"
                priority
              />
              <span>Sample photo · original color</span>
            </div>
          )}
          <div className="demo-media-caption">
            <Box size={15} />
            <span>
              Reconstructed from a single photo with Meta AI.
              <br />
              <small>
                Rotate to inspect. Hidden geometry and fine details are
                approximate.
              </small>
            </span>
          </div>
        </div>
        <div className="demo-product-details">
          <span className="d-kicker">THE EVERYDAY COLLECTION</span>
          <h1>{p.name}</h1>
          <p className="demo-subtitle">{p.subtitle}</p>
          <a className="demo-rating" href="#reviews">
            <span>★★★★★</span>4.7 <small>· 3 sample reviews</small>
          </a>
          <div className="demo-price">
            {money(p.price)} <small>USD · demo price</small>
          </div>
          <p className="demo-description">{p.description}</p>
          <ColorSwatches product={p} value={color} onChange={setColor} />
          <div className="demo-purchase-row">
            <div className="demo-quantity large">
              <button
                aria-label="Decrease quantity"
                disabled={quantity === 1}
                onClick={() => setQuantity((v) => v - 1)}
              >
                <Minus size={15} />
              </button>
              <output aria-label="Quantity">{quantity}</output>
              <button
                aria-label="Increase quantity"
                disabled={quantity === 20}
                onClick={() => setQuantity((v) => v + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              className="d-button primary"
              onClick={() => store.add(id, color, quantity)}
            >
              Add to bag <Plus size={16} />
            </button>
          </div>
          <button
            className="d-button full"
            onClick={() => store.buy(id, color, quantity)}
          >
            Buy now · demo checkout
            <ArrowRight size={16} />
          </button>
          <div className="demo-benefits">
            <span>
              <Truck size={16} />
              Free demo delivery
            </span>
            <span>
              <ShieldCheck size={16} />
              No payment required
            </span>
          </div>
          <div className="demo-product-accordions">
            <details open>
              <summary>Materials & dimensions</summary>
              <p>{p.materials}</p>
              <p>{p.dimensions}</p>
              <small>
                Illustrative listing specifications. Not measurements recovered
                from the image.
              </small>
            </details>
            <details>
              <summary>Care guide</summary>
              <p>{p.care}</p>
            </details>
            <details>
              <summary>About the 3D preview</summary>
              <p>
                This is an AI reconstruction of a sample image. Colors are
                interactive tints, and unseen surfaces are estimated. This
                demonstration does not verify product identity, physical size or
                real-world color.
              </p>
            </details>
          </div>
          <Link href="/demo/space" className="d-text">
            See how the collection works together
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      <section className="demo-reviews" id="reviews">
        <div className="demo-section-heading">
          <div>
            <span className="d-kicker">SAMPLE CUSTOMER STORIES</span>
            <h2>A place in everyday life.</h2>
            <p>Fictional reviews to demonstrate the shopping experience.</p>
          </div>
          <button className="d-button" onClick={() => setReview(true)}>
            Try writing a review
          </button>
        </div>
        <div className="demo-review-grid">
          {[
            {
              name: "Alex · sample customer",
              title: "An easy addition",
              text: "The 3D view made it easy to picture this alongside the other pieces.",
              stars: 5,
            },
            {
              name: "Jamie · sample customer",
              title: "Loved trying the colors",
              text: "Switching between finishes helped me put together a calmer corner.",
              stars: 5,
            },
            {
              name: "Morgan · sample customer",
              title: "A useful way to explore",
              text: "I liked being able to rotate the product before adding it to my list.",
              stars: 4,
            },
          ].map((r) => (
            <article key={r.name}>
              <span className="demo-stars" aria-label={`${r.stars} of 5 stars`}>
                {"★".repeat(r.stars)}
                {"☆".repeat(5 - r.stars)}
              </span>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
              <small>{r.name}</small>
            </article>
          ))}
          {localReview && (
            <article>
              <span className="demo-stars">
                {"★".repeat(localReview.rating)}
              </span>
              <h3>Your demo review</h3>
              <p>{localReview.text}</p>
              <small>Local preview · not published</small>
            </article>
          )}
        </div>
      </section>
      <section className="demo-related">
        <div className="demo-section-heading">
          <div>
            <span className="d-kicker">BETTER TOGETHER</span>
            <h2>Complete your corner.</h2>
          </div>
          <Link href="/demo/space" className="d-text">
            Build your space
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="demo-related-grid">
          {related.map((v) => (
            <ProductTile key={v.id} id={v.id} />
          ))}
        </div>
      </section>
      <Link href="/demo" className="d-text">
        <ArrowLeft size={15} />
        All demo experiences
      </Link>
      {review && (
        <DemoDialog
          title="Try a product review"
          onClose={() => setReview(false)}
        >
          <p>Preview only. This stays on this page and is not published.</p>
          <form
            className="demo-review-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setLocalReview({
                text: String(data.get("review")).trim(),
                rating: Number(data.get("rating")),
              });
              setReview(false);
            }}
          >
            <label>
              Rating
              <select name="rating" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option value={n} key={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </label>
            <label>
              Your sample review
              <textarea
                required
                name="review"
                maxLength={600}
                minLength={5}
                placeholder="What did you think of the shopping experience?"
              />
            </label>
            <button className="d-button primary" type="submit">
              <Star size={15} />
              Preview review
            </button>
          </form>
        </DemoDialog>
      )}
    </main>
  );
}
