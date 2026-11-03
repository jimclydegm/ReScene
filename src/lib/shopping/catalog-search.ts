/** Bounded catalog search with coverage across both products and price bands. */
type Priced = { id: string; price: number };
type Selection<T> = { products: T[]; cost: number };

// Round-robin over price bands; within each band prefer products seen least often.
// This keeps a growing catalog from filling the search with the first few IDs.
export function diverseSelections<T extends Selection<Priced>>(
  selections: T[], budget: number, limit: number,
): T[] {
  const bands: T[][] = Array.from({ length: 8 }, () => []);
  for (const s of selections)
    bands[Math.min(7, Math.floor(s.cost / Math.max(1, budget) * 8))].push(s);
  const selected: T[] = [], counts = new Map<string, number>();
  for (const band of bands) band.sort((a, b) => b.cost - a.cost);
  while (selected.length < limit && bands.some(b => b.length)) {
    for (const band of bands) {
      if (!band.length || selected.length >= limit) continue;
      let best = 0, reuse = Infinity;
      for (let i = 0; i < band.length; i++) {
        const score = band[i].products.reduce((n, p) => n + (counts.get(p.id) ?? 0), 0);
        if (score < reuse) { best = i; reuse = score; }
      }
      const [s] = band.splice(best, 1);
      selected.push(s);
      for (const p of s.products) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    }
  }
  return selected;
}

export function catalogSelections<T extends Priced>(
  choices: T[][], charged: boolean[], budget: number, limit = 384,
): Selection<T>[] {
  if (choices.some(c => !c.length)) return [];
  const remaining = choices.map((c, i) => charged[i] ? Math.min(...c.map(p => p.price)) : 0);
  let beam: Selection<T>[] = [{ products: [], cost: 0 }];
  for (let slot = 0; slot < choices.length; slot++) {
    const later = remaining.slice(slot + 1).reduce((a, b) => a + b, 0);
    const next = beam.flatMap(s => choices[slot].flatMap(p => {
      const cost = s.cost + (charged[slot] ? p.price : 0);
      return cost + later <= budget ? [{ products: [...s.products, p], cost }] : [];
    }));
    beam = diverseSelections(next, budget, limit);
  }
  return beam;
}
