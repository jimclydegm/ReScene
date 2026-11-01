"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useMemo } from "react";
import {
  ArrowRight,
  Box,
  Check,
  Minus,
  Plus,
  Rotate3d,
  Images,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { findDemoProduct, money, type DemoProduct } from "@/lib/demo/catalog";
import { demoProductScene, initialArrangement } from "@/lib/demo/scenes";
import { productAlbum, productCover } from "@/lib/demo/albums";
import { ImageAlbum } from "./image-album";
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
            {i === value && (
              <span className="swatch-check">
                <Check size={13} strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>
      <small>Available finishes</small>
    </fieldset>
  );
}
export function ProductTile({ id }: { id: string }) {
  const p = findDemoProduct(id)!;
  return (
    <Link className="demo-product-tile" href={`/demo/product/${id}`}>
      <div>
        <Image
          src={productCover(id)}
          alt={p.name}
          width={96}
          height={96}
          sizes="96px"
        />
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

const reviews = [
  {
    name: "Alex Morgan",
    initials: "AM",
    color: "#d7b7a1",
    rating: 5,
    title: "An easy addition to my reading corner",
    text: "Being able to see the chair next to the cabinet made choosing the combination much easier.",
  },
  {
    name: "Jamie Lee",
    initials: "JL",
    color: "#adc3b2",
    rating: 5,
    title: "The color preview really helped",
    text: "I could try a different finish and look around the shape before adding it to my bag.",
  },
  {
    name: "Morgan Davis",
    initials: "MD",
    color: "#bdc2dc",
    rating: 4,
    title: "A useful extra view",
    text: "The photo shows the styling, and the 3D preview helps me explore the shape from the other side.",
  },
];
function Avatar({ person }: { person: (typeof reviews)[number] }) {
  return (
    <span
      className="review-avatar"
      role="img"
      aria-label={`${person.name} sample avatar`}
      style={{ background: person.color }}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M4 40c1-10 7-15 16-15s15 5 16 15"
          fill={
            person.initials === "AM"
              ? "#405c4c"
              : person.initials === "JL"
                ? "#796447"
                : "#68658c"
          }
        />
        <ellipse
          cx="20"
          cy="17"
          rx="9"
          ry="11"
          fill={person.initials === "MD" ? "#bc8969" : "#e3b895"}
        />
        <path
          d={
            person.initials === "JL"
              ? "M10 19C6 2 30 0 30 18l-6-8-8 1z"
              : "M11 16C7 2 30 1 30 16l-5-7-7 3z"
          }
          fill="#443d35"
        />
        <circle cx="17" cy="17" r=".8" fill="#302e28" />
        <circle cx="24" cy="17" r=".8" fill="#302e28" />
        <path
          d="M17 23q3 2 6 0"
          stroke="#9b6851"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
export function ProductPage({ id }: { id: string }) {
  const p = findDemoProduct(id)!,
    scene = demoProductScene(id),
    store = useDemoStore();
  const [color, setColor] = useState(0),
    [quantity, setQuantity] = useState(1),
    [mode, setMode] = useState<"album" | "3d">("album"),
    [activeImage, setActiveImage] = useState("studio"),
    [reviewIndex, setReviewIndex] = useState(0),
    [dialog, setDialog] = useState<"specs" | "reviews" | "write" | null>(null),
    [localReview, setLocalReview] = useState<{
      text: string;
      rating: number;
    } | null>(null);
  const draft = initialArrangement(scene);
  draft.items[id].color = color;
  const review = reviews[reviewIndex],
    images = useMemo(() => productAlbum(id), [id]);
  function chooseColor(value: number) {
    setColor(value);
    const photo = images.find(
      (i) =>
        i.kind === "generated" && i.color === value && i.setting === "studio",
    );
    if (photo) setActiveImage(photo.id);
    else setMode("3d");
  }
  return (
    <main className="demo-main retail-product-page">
      <div className="demo-breadcrumb">
        <Link href="/demo/products">All products</Link>
        <span>/</span>
        <span>{p.category}</span>
        <span>/</span>
        <span>{p.name}</span>
      </div>
      <section className="demo-product-layout retail-product-layout">
        <div className="retail-product-visuals shopping-product-media">
          <div className="shopping-media-modes" aria-label="Product media">
            <button
              aria-pressed={mode === "album"}
              onClick={() => {
                setMode("album");
                const photo = images.find((image) => image.id === activeImage);
                if (photo?.color !== null && photo?.color !== undefined)
                  setColor(photo.color);
              }}
            >
              <Images size={17} />
              Album mode
            </button>
            <button aria-pressed={mode === "3d"} onClick={() => setMode("3d")}>
              <Rotate3d size={17} />
              3D mode
            </button>
          </div>
          {mode === "album" ? (
            <ImageAlbum
              images={images}
              activeId={activeImage}
              label={p.name}
              onSelect={(image) => {
                setActiveImage(image.id);
                if (image.color !== null) setColor(image.color);
              }}
            />
          ) : (
            <div className="shopping-optional-3d">
              <DemoViewer
                scene={scene}
                draft={draft}
                selected=""
                onSelect={() => {}}
                individual={id}
              />
            </div>
          )}
          <p className="shopping-media-note">
            {mode === "3d"
              ? "Live color preview · illustrative finishes on the reconstructed texture."
              : "Reference photos and AI-generated product photography. Finishes and settings are illustrative."}
          </p>
        </div>
        <div className="demo-product-details retail-product-info">
          <span className="d-kicker">ReScene Living · The collection</span>
          <h1>{p.name}</h1>
          <p className="demo-subtitle">{p.subtitle}</p>
          <button
            className="demo-rating d-text"
            onClick={() => setDialog("reviews")}
          >
            <span>★★★★★</span>
            <strong>4.7</strong>
            <small>3 sample reviews</small>
          </button>
          <div className="demo-price">
            {money(p.price)}
            <small>USD</small>
          </div>
          <p className="demo-description">{p.description}</p>
          <ColorSwatches product={p} value={color} onChange={chooseColor} />
          <div className="demo-purchase-row">
            <div className="demo-quantity large">
              <button
                aria-label="Decrease quantity"
                disabled={quantity === 1}
                onClick={() => setQuantity((q) => q - 1)}
              >
                <Minus size={15} />
              </button>
              <output aria-label="Quantity">{quantity}</output>
              <button
                aria-label="Increase quantity"
                disabled={quantity === 20}
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              className="d-button primary"
              onClick={() => store.add(id, color, quantity)}
            >
              Add to bag · {money(p.price * quantity)}
              <ShoppingIcon />
            </button>
            <button
              className="d-button demo-buy-now"
              onClick={() => store.buy(id, color, quantity)}
            >
              Buy now
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="demo-benefits">
            <span>
              <Truck size={16} />
              Complimentary demo delivery
            </span>
            <span>
              <ShieldCheck size={16} />
              No payment taken
            </span>
          </div>
          <div className="retail-details-links">
            <button className="d-text" onClick={() => setDialog("specs")}>
              Materials, dimensions & care
              <Plus size={14} />
            </button>
            <Link
              className="d-text"
              href={`/demo/space?collection=${scene.id === "living" ? "corner" : scene.id}`}
            >
              Style it in a room
              <ArrowRight size={14} />
            </Link>
          </div>
          <section
            className="retail-review-panel"
            aria-label="Sample customer reviews"
          >
            <div className="retail-review-heading">
              <strong>From the community</strong>
              <small>Fictional sample reviews</small>
            </div>
            <article>
              <div className="retail-review-person">
                <Avatar person={review} />
                <div>
                  <strong>{review.name}</strong>
                  <span
                    className="demo-stars"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                <div className="retail-review-nav">
                  <button
                    className="d-icon"
                    aria-label="Previous review"
                    onClick={() => setReviewIndex((i) => (i + 2) % 3)}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    className="d-icon"
                    aria-label="Next review"
                    onClick={() => setReviewIndex((i) => (i + 1) % 3)}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <h3>{review.title}</h3>
              <p>{review.text}</p>
            </article>
            <div className="retail-review-actions">
              <button className="d-text" onClick={() => setDialog("reviews")}>
                Read all 3 reviews
              </button>
              <button className="d-text" onClick={() => setDialog("write")}>
                Write a sample review
              </button>
            </div>
            {localReview && (
              <p className="retail-local-review" role="status">
                Your local review: {"★".repeat(localReview.rating)} ·{" "}
                {localReview.text}
              </p>
            )}
          </section>
        </div>
      </section>
      {dialog && (
        <DemoDialog
          title={
            dialog === "specs"
              ? "Product details"
              : dialog === "write"
                ? "Write a sample review"
                : "Sample customer reviews"
          }
          onClose={() => setDialog(null)}
        >
          {dialog === "specs" && (
            <div className="retail-specs">
              <h3>Materials</h3>
              <p>{p.materials}</p>
              <h3>Dimensions</h3>
              <p>{p.dimensions}</p>
              <h3>Care</h3>
              <p>{p.care}</p>
              <small>
                Fictional listing specifications. Not physical measurements
                recovered from the photo.
              </small>
            </div>
          )}
          {dialog === "reviews" && (
            <div className="retail-all-reviews">
              {reviews.map((r) => (
                <article key={r.name}>
                  <div className="retail-review-person">
                    <Avatar person={r} />
                    <div>
                      <strong>{r.name}</strong>
                      <span className="demo-stars">{"★".repeat(r.rating)}</span>
                    </div>
                  </div>
                  <h3>{r.title}</h3>
                  <p>{r.text}</p>
                  <small>Fictional sample review</small>
                </article>
              ))}
            </div>
          )}
          {dialog === "write" && (
            <form
              className="demo-review-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setLocalReview({
                  text: String(f.get("review")).trim(),
                  rating: Number(f.get("rating")),
                });
                setDialog(null);
              }}
            >
              <p>Local preview only. Your review is not published.</p>
              <label>
                Rating
                <select name="rating">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} stars
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Your review
                <textarea
                  name="review"
                  required
                  minLength={5}
                  maxLength={500}
                />
              </label>
              <button className="d-button primary" type="submit">
                Preview review
              </button>
            </form>
          )}
        </DemoDialog>
      )}
    </main>
  );
}
function ShoppingIcon() {
  return <Plus size={16} />;
}
