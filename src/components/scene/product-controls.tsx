"use client";
import Image from "next/image";
import { ExternalLink, ShoppingBag, Plus, X } from "lucide-react";
import type { SceneObjectView } from "./types";
export function ProductControls({ object, busy, onChange }: { object: SceneObjectView; busy: boolean; onChange: (product: SceneObjectView["product"]) => void }) {
  const product = object.product;
  if (!product) return <section className="product-controls"><div className="inspector-section-heading"><ShoppingBag size={17}/><h3>Product details</h3></div><p className="inspector-description">Add your own listing information for {object.label}. ReScene does not identify the exact product from the photo.</p><button className="button button-light button-full" disabled={busy} onClick={() => onChange({ name: object.label, description: "", brand: "", price: null, currency: "USD", productUrl: "", imageUrl: null })}><Plus size={15}/>Add product details</button></section>;
  let safeUrl = "";
  try { const url = new URL(product.productUrl); if (url.protocol === "https:" && !url.username && !url.password) safeUrl = url.href; } catch {}
  const amount = product.price === null || !/^\d+(\.\d{1,2})?$/.test(product.price) ? null : Number(product.price);
  const price = amount === null ? null : new Intl.NumberFormat("en", { style: "currency", currency: product.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return <section className="product-controls"><div className="inspector-section-heading"><ShoppingBag size={17}/><h3>Product details</h3><span className="setting-badge">Merchant entered</span></div>
    <p className="inspector-description">Select any object in the viewer to edit its card. Save changes to keep your listing.</p>
    <fieldset disabled={busy} className="product-fields"><label>Product name<input maxLength={160} value={product.name} onChange={e => onChange({ ...product, name: e.target.value })}/></label><label>Brand<input maxLength={120} value={product.brand} onChange={e => onChange({ ...product, brand: e.target.value })}/></label>
      <div className="product-price-fields"><label>Price<input type="number" min="0" max="999999999.99" step="0.01" placeholder="Not listed" value={product.price ?? ""} onChange={e => onChange({ ...product, price: e.target.value || null })}/></label><label>Currency<select value={product.currency} onChange={e => onChange({ ...product, currency: e.target.value as typeof product.currency })}>{["USD", "PHP", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "INR"].map(currency => <option key={currency}>{currency}</option>)}</select></label></div>
      <label>Product link<input type="url" placeholder="https://your-store.com/product" maxLength={2048} value={product.productUrl} onChange={e => onChange({ ...product, productUrl: e.target.value })}/></label>
      <label>Description<textarea rows={3} maxLength={4000} value={product.description} onChange={e => onChange({ ...product, description: e.target.value })}/></label>
    </fieldset>
    <span className="control-group-label">Card preview</span><article className="merchant-card">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name || object.label} width={384} height={384} unoptimized/> : <div className="product-image-placeholder"><ShoppingBag size={26}/><span>Object photo appears after saving</span></div>}
      <div>{product.brand && <small>{product.brand}</small>}<h4>{product.name || "Product name"}</h4>{price && <strong>{price}</strong>}{product.description && <p>{product.description}</p>}{safeUrl && <a className="button button-dark button-full" href={safeUrl} target="_blank" rel="noopener noreferrer">View product<ExternalLink size={13}/></a>}</div>
    </article><p className="control-hint">The image is a private cutout of your reference photo. Product information is supplied by you; this is an approximate 3D preview.</p>
    <button className="button button-light button-full" disabled={busy} onClick={() => onChange(null)}><X size={14}/>Remove product details</button>
  </section>;
}
