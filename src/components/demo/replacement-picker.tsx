"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowRightLeft, Check, Search } from "lucide-react";
import {
  demoProducts,
  findDemoProduct,
  itemProductId,
  money,
} from "@/lib/demo/catalog";
import { productCover } from "@/lib/demo/albums";
import { changeArrangement, type DemoScene } from "@/lib/demo/scenes";
import type { Arrangement } from "@/lib/demo/state";
import { DemoDialog } from "./store";
export function ReplacementPicker({
  scene,
  draft,
  id,
  onReplace,
  onClose,
}: {
  scene: DemoScene;
  draft: Arrangement;
  id: string;
  onReplace: (productId: string) => string | null;
  onClose: () => void;
}) {
  const current = itemProductId(id, draft.items[id]),
    [choice, setChoice] = useState(current),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [error, setError] = useState("");
  const product = findDemoProduct(choice)!,
    old = findDemoProduct(current)!,
    items = demoProducts.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <DemoDialog title={`Replace ${old.name}`} onClose={onClose} wide>
      <div className="showroom-replace-toolbar">
        <label>
          <Search size={15} />
          <input
            type="search"
            aria-label="Find a replacement"
            placeholder="Find a product"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Replacement category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["All", ...new Set(demoProducts.map((p) => p.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="showroom-replacement-grid">
        {items.map((p) => {
          const reason = changeArrangement(scene, draft, id, {
            productId: p.id,
          }).error;
          return (
            <button
              key={p.id}
              disabled={!!reason}
              title={reason ?? p.name}
              aria-pressed={choice === p.id}
              onClick={() => {
                setChoice(p.id);
                setError("");
              }}
            >
              <Image src={productCover(p.id)} alt="" width={72} height={72} />
              <span>
                <strong>{p.name}</strong>
                <small>{p.category}</small>
                <b>{money(p.price)}</b>
                {reason && (
                  <small className="showroom-replace-reason">{reason}</small>
                )}
              </span>
              {choice === p.id && <Check size={16} />}
            </button>
          );
        })}
      </div>
      {!items.length && (
        <p className="demo-feedback">
          No matching products. Try another category or search.
        </p>
      )}
      <div className="showroom-replace-footer">
        <div>
          <strong>
            {product.name} · {money(product.price)}
          </strong>
          <p>
            {product.price === old.price
              ? "Same price"
              : `${product.price > old.price ? "+" : "−"}${money(Math.abs(product.price - old.price))} for your arrangement`}
            . Position and rotation are kept.
          </p>
          {error && <p role="alert">{error}</p>}
        </div>
        <button
          className="d-button primary"
          disabled={choice === current}
          onClick={() => {
            const problem = onReplace(choice);
            if (problem) setError(problem);
            else onClose();
          }}
        >
          <ArrowRightLeft size={15} />
          Replace item
        </button>
      </div>
    </DemoDialog>
  );
}
