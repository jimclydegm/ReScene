"use client";
import { VoiceInput } from "@/components/voice-input";
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
    [category, setCategory] = useState(findDemoProduct(current)?.category ?? "All"),
    [showUnavailable, setShowUnavailable] = useState(false),
    [error, setError] = useState("");
  const product = findDemoProduct(choice)!,
    old = findDemoProduct(current)!,
    matches = demoProducts.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        `${p.name} ${p.category} ${p.role ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ).map(p=>({product:p, reason:changeArrangement(scene,draft,id,{productId:p.id}).error})),
    items = matches.filter(({reason})=>showUnavailable || !reason);
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
        <VoiceInput
          purpose="search"
          field="product search"
          label="Voice search"
          maxLength={120}
          replaceOnly
          onUse={(v) => {
            setQuery(v.text.replace(/[.!?,;:]+$/g, ""));
            setCategory("All");
          }}
        />
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
      <div className="showroom-replace-results">
        <span role="status">{items.length} {items.length===1?"product":"products"}{!showUnavailable?" fit this position":" found"}</span>
        <label><input type="checkbox" checked={showUnavailable} onChange={e=>setShowUnavailable(e.target.checked)}/>Show unavailable</label>
      </div>
      <div className="showroom-replacement-grid">
        {items.map(({product:p,reason}) => {
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
