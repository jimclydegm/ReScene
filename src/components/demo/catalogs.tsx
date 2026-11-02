"use client";
import { VoiceInput } from "@/components/voice-input";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Box, Search } from "lucide-react";
import {
  demoProducts,
  demoImage,
  collectionInfo,
  collectionProducts,
  collectionIds,
} from "@/lib/demo/catalog";
import { PhotoInspiration } from "./photo-inspiration";
import { ProductTile } from "./product";
export function ProductCatalog() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All products"),
    [page, setPage] = useState(0);
  const categories = [
    "All products",
    ...new Set(demoProducts.map((p) => p.category)),
  ];
  const products = demoProducts
    .filter(
      (p) =>
        (category === "All products" || p.category === category) &&
        `${p.name} ${p.category} ${p.role ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => Number(!!b.imagePath) - Number(!!a.imagePath));
  const pages = Math.max(1, Math.ceil(products.length / 12)),
    currentPage = Math.min(page, pages - 1);
  return (
    <main className="demo-main retail-catalog">
      <div className="demo-breadcrumb">
        <Link href="/demo">Home</Link>
        <span>/</span>
        <span>Shop the collection</span>
      </div>
      <div className="retail-catalog-intro">
        <div>
          <span className="d-kicker">The product collection</span>
          <h1>Explore the collection</h1>
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
        <label className="retail-category-select">
          <span>Category</span>
          <select
            aria-label="Product category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <Search size={17} />
          <input
            type="search"
            placeholder="Find a product"
            aria-label="Search demo products"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <VoiceInput
          purpose="search"
          field="product search"
          label="Voice search"
          maxLength={120}
          replaceOnly
          onUse={(v) => {
            setQuery(v.text.replace(/[.!?,;:]+$/g, ""));
            setCategory("All products");
            setPage(0);
          }}
        />
      </div>
      <p className="retail-result-count">
        {products.length} products · Ready to explore · Page {currentPage + 1}{" "}
        of {pages}
      </p>
      <div className="retail-product-grid">
        {products.slice(currentPage * 12, currentPage * 12 + 12).map((p) => (
          <div key={p.id} className="retail-catalog-product">
            {p.id === "haven-linen-chair" && (
              <span className="retail-start-badge">Start here</span>
            )}
            <ProductTile id={p.id} />
          </div>
        ))}
      </div>
      {pages > 1 && (
        <nav className="retail-pagination" aria-label="Product pages">
          <button
            className="d-button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            {currentPage + 1} / {pages}
          </span>
          <button
            className="d-button"
            disabled={currentPage === pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </nav>
      )}
      {!products.length && (
        <div className="demo-empty">
          <h2>No matching products</h2>
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
  const featured = mode === "build" ? "corner" : "living",
    legacy = ["corner", "space", "living"];
  const ids = [
    featured,
    ...collectionIds.filter((id) => !legacy.includes(id)),
    ...collectionIds.filter((id) => legacy.includes(id) && id !== featured),
  ];
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
            {mode === "build" ? "Build your space" : "Shop the scene"}
          </span>
          <h1>
            {mode === "build"
              ? "Choose your collection"
              : "Explore a styled scene"}
          </h1>
          <p>
            {mode === "build"
              ? "Choose a collection. Arrange products, try finishes and ask the AI stylist for combinations within your budget."
              : "Explore a scene, discover its products and bring your favorites into one shopping list."}
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
                  width={640}
                  height={400}
                  sizes="360px"
                />
                <span>{i === 0 ? "Start here" : "Ready to explore"}</span>
              </div>
              <section>
                <span className="d-kicker">
                  {collectionProducts[id].length} products · Interactive 3D
                </span>
                <h2>{info.name}</h2>
                <p>{info.caption}</p>
                <span className="d-text">
                  {mode === "build"
                    ? "Arrange this collection"
                    : "Shop this scene"}
                  <ArrowRight size={16} />
                </span>
              </section>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
