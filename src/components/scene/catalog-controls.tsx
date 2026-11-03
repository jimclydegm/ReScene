"use client";
import Image from "next/image";
import { useState } from "react";
import { RotateCcw, Search } from "lucide-react";

export type CatalogItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  category?: string | null;
  price?: string | null;
  currency?: string | null;
};
type Props = {
  items: CatalogItem[];
  busy: boolean;
  dirty: boolean;
  canRestore: boolean;
  onSeed: () => void;
  onReplace: (id: string) => void;
  onRestore: () => void;
};

export function CatalogControls({ items, busy, dirty, canRestore, onSeed, onReplace, onRestore }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [limit, setLimit] = useState(24);
  const filtered = items.filter(p =>
    (category === "All" || p.category === category) &&
    `${p.name} ${p.category ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const categories = ["All", ...new Set(items.flatMap(p => p.category ? [p.category] : []))];
  return (
    <details className="panel-details catalog-controls" open={canRestore || undefined}>
      <summary>Replace with a catalog object</summary>
      <p>Choose a saved product. Replacements keep the current position and save immediately.</p>
      {dirty && <p className="panel-note">Save your changes before replacing.</p>}
      {!items.length ? (
        <button className="button button-light button-full" disabled={busy || dirty} onClick={onSeed}>Add demo catalog</button>
      ) : (
        <>
          <div className="catalog-filters">
            <label>
              <Search size={14} />
              <input
                aria-label="Search saved products" type="search" placeholder="Find a product" value={query}
                onChange={e => { setQuery(e.target.value); setLimit(24); }}
              />
            </label>
            <select aria-label="Saved product category" value={category} onChange={e => { setCategory(e.target.value); setLimit(24); }}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <p className="panel-note" role="status">{filtered.length} products</p>
          <div className="catalog-grid">
            {filtered.slice(0, limit).map(item => (
              <button key={item.id} className="catalog-item" disabled={busy || dirty} onClick={() => onReplace(item.id)} title={`Replace with ${item.name}`}>
                {item.imageUrl && <Image src={item.imageUrl} alt="" width={150} height={150} unoptimized />}
                <span>
                  {item.name}
                  {item.price && item.currency && (
                    <strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: item.currency }).format(Number(item.price))}</strong>
                  )}
                </span>
              </button>
            ))}
          </div>
          {filtered.length > limit && <button className="button button-light button-full" onClick={() => setLimit(v => v + 24)}>Show more products</button>}
          {!filtered.length && <p className="panel-note">No matching products. Try another category or search.</p>}
        </>
      )}
      {canRestore && <button className="button button-light button-full" disabled={busy || dirty} onClick={onRestore}><RotateCcw size={14} />Restore original object</button>}
    </details>
  );
}
