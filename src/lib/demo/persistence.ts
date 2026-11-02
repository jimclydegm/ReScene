import {
  cartLineSchema, collectionsSchema, layoutsSchema, persistedDemoSchema,
  type CartLine, type PersistedDemo,
} from "./state";

/** Recover independent browser preferences without discarding a valid bag
 * because an old collection or one corrupt line no longer matches the catalog. */
export function readDemoState(raw: string | null): PersistedDemo {
  const empty: PersistedDemo = { version: 1, cart: [], layouts: null, collections: {} };
  if (!raw || raw.length > 1_000_000) return empty;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return empty; }
  const complete = persistedDemoSchema.safeParse(value);
  if (complete.success) return complete.data;
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1) return empty;
  const stored = value as Record<string, unknown>;
  const seen = new Set<string>();
  const cart: CartLine[] = [];
  if (Array.isArray(stored.cart)) for (const item of stored.cart.slice(0, 100)) {
    const line = cartLineSchema.safeParse(item);
    if (!line.success) continue;
    const key = `${line.data.productId}:${line.data.color}`;
    if (!seen.has(key)) { seen.add(key); cart.push(line.data); }
  }
  const layouts = layoutsSchema.safeParse(stored.layouts);
  const collections: PersistedDemo["collections"] = {};
  if (stored.collections && typeof stored.collections === "object") {
    for (const [id, layout] of Object.entries(stored.collections).slice(0, 100)) {
      const entry = collectionsSchema.safeParse({ [id]: layout });
      if (entry.success) Object.assign(collections, entry.data);
    }
  }
  return { version: 1, cart, layouts: layouts.success ? layouts.data : null, collections };
}
