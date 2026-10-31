"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Box, Search } from "lucide-react";
import {
  demoProducts,
  demoImage,
  collectionInfo,
  collectionProducts,
} from "@/lib/demo/catalog";
import { PhotoInspiration } from "./photo-inspiration";
import { ProductTile } from "./product";
export function ProductCatalog() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All products");
  const categories = [
    "All products",
    ...new Set(demoProducts.map((p) => p.category)),
  ];
  const products = demoProducts.filter(
    (p) =>
      (category === "All products" || p.category === category) &&
      `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <main className="demo-main retail-catalog">
      <div className="demo-breadcrumb">
        <Link href="/demo">Home</Link>
        <span>/</span>
        <span>Shop the collection</span>
      </div>
      <div className="retail-catalog-intro">
        <div>
          <span className="d-kicker">THOUGHTFUL PIECES, EVERYDAY LIVING</span>
          <h1>Find your next favorite.</h1>
          <p>
            Browse the collection. Open a product for photos, details and a
            closer look in 3D.
          </p>
        </div>
        <div className="retail-feature-label">
          <Box size={18} />
          <span>
            Start with the Haven chair
            <br />
            <strong>Photos + interactive 3D</strong>
          </span>
        </div>
      </div>
      <PhotoInspiration kind="products" />
      <div className="retail-catalog-toolbar">
        <nav aria-label="Product categories">
          {categories.map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </nav>
        <label>
          <Search size={17} />
          <input
            type="search"
            placeholder="Find a product"
            aria-label="Search demo products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <p className="retail-result-count">
        {products.length} products · Curated sample collection
      </p>
      <div className="retail-product-grid">
        {products.map((p) => (
          <div key={p.id} className="retail-catalog-product">
            {p.id === "corner-chair" && (
              <span className="retail-start-badge">Start here</span>
            )}
            <ProductTile id={p.id} />
          </div>
        ))}
      </div>
      {!products.length && (
        <div className="demo-empty">
          <h2>No products match.</h2>
          <button
            className="d-button"
            onClick={() => {
              setQuery("");
              setCategory("All products");
            }}
          >
            Show the collection
          </button>
        </div>
      )}
    </main>
  );
}
export function SceneCatalog({ mode }: { mode: "build" | "shop" }) {
  const ids =
    mode === "build" ? ["corner", "space"] : ["living", "corner", "space"];
  return (
    <main className="demo-main retail-catalog">
      <div className="demo-breadcrumb">
        <Link href="/demo">Home</Link>
        <span>/</span>
        <span>{mode === "build" ? "Build your space" : "Shop the scene"}</span>
      </div>
      <div className="retail-catalog-intro">
        <div>
          <span className="d-kicker">
            {mode === "build"
              ? "YOUR SPACE STARTS HERE"
              : "INSPIRATION YOU CAN SHOP"}
          </span>
          <h1>
            {mode === "build"
              ? "Choose a collection. Make it yours."
              : "Find a room that feels like you."}
          </h1>
          <p>
            {mode === "build"
              ? "Select a collection to arrange products, compare four layouts and explore colors and light."
              : "Explore a styled room, discover its pieces and bring your favorites into one shopping list."}
          </p>
        </div>
      </div>
      <PhotoInspiration kind="scenes" />
      <div className="retail-scene-grid">
        {ids.map((id, i) => {
          const info = collectionInfo[id];
          return (
            <Link
              key={id}
              className="retail-scene-card"
              href={`${mode === "build" ? "/demo/space" : "/demo/shop-the-scene"}?collection=${id}`}
            >
              <div>
                <Image
                  src={demoImage(id)}
                  alt={info.name}
                  width={72}
                  height={72}
                  sizes="72px"
                />
                <span>{i === 0 ? "Start here" : "Ready to explore"}</span>
              </div>
              <section>
                <span className="d-kicker">
                  {collectionProducts[id].length} PRODUCTS · INTERACTIVE 3D
                </span>
                <h2>{info.name}</h2>
                <p>{info.caption}</p>
                <span className="d-text">
                  {mode === "build"
                    ? "Arrange this collection"
                    : "Shop this room"}
                  <ArrowRight size={16} />
                </span>
              </section>
            </Link>
          );
        })}
        <article className="retail-scene-card retail-coming-soon">
          <div className="retail-coming-art">
            <Box size={42} />
            <span>Preview collection</span>
          </div>
          <section>
            <span className="d-kicker">NEXT IN THE COLLECTION</span>
            <h2>The Workspace</h2>
            <p>
              A future collection of desks, lighting and everyday essentials.
            </p>
            <span className="retail-unavailable">
              Coming soon · Not interactive
            </span>
          </section>
        </article>
      </div>
    </main>
  );
}
