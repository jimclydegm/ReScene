import {
  demoProducts,
  findDemoProduct,
  itemProductId,
  money,
  type DemoProduct,
} from "@/lib/demo/catalog";
import {
  demoScenes,
  collectionLayouts,
  validateArrangement,
  supportOf,
  type DemoScene,
} from "@/lib/demo/scenes";
import type { Arrangement } from "@/lib/demo/state";
import type { ShoppingIntent, StylistInput } from "./contracts";
import { catalogSelections, diverseSelections } from "./catalog-search";

export type Candidate = {
  id: string;
  draft: Arrangement;
  subtotalCents: number;
  score: number;
  changes: string[];
};
export const purchasing = (item: Arrangement["items"][string]) =>
  item.included !== false && !item.owned;
export function merchandiseTotal(draft: Arrangement) {
  return Object.entries(draft.items).reduce((sum, [slot, item]) => {
    if (!purchasing(item)) return sum;
    const p = findDemoProduct(itemProductId(slot, item));
    if (!p || !Number.isSafeInteger(p.price) || p.price < 0)
      throw new Error("A product price is unavailable.");
    return sum + p.price;
  }, 0);
}
export function purchaseLines(draft: Arrangement) {
  return Object.entries(draft.items)
    .filter(([, item]) => purchasing(item))
    .map(([id, item]) => ({ id: itemProductId(id, item), color: item.color }));
}
export function productRole(category: string) {
  if (/chair|sofa|stool/i.test(category)) return "seating";
  if (/storage|table/i.test(category)) return "surface";
  if (/lighting/i.test(category)) return "lighting";
  const roles: Record<string, string> = { Bags: "bag", Footwear: "shoes", Mugs: "mug", "Computer mice": "mouse" };
  if (roles[category]) return roles[category];
  return category.toLowerCase();
}
function roleOf(p: DemoProduct) {
  if (p.role === "tote" || p.role === "handbag") return "bag";
  if (p.role === "table") return "surface";
  if (!p.role && p.category === "Home accessories") {
    if (/vase/i.test(p.name)) return "vase";
    if (/lamp/i.test(p.name)) return "lighting";
  }
  return (
    p.role ??
    (/sofa/i.test(p.category)
      ? "sofa"
      : /chair/i.test(p.category)
        ? "chair"
        : /stool/i.test(p.category)
          ? "stool"
          : productRole(p.category))
  );
}
export function stylistCompatible(
  scene: DemoScene,
  slot: string,
  p: DemoProduct,
  intent: Pick<ShoppingIntent, "requireStorage">,
) {
  const original = findDemoProduct(slot)!;
  if (/chairs$/i.test(original.category) && /chairs$/i.test(p.category) && original.category !== p.category) return false;
  if (/tables$/i.test(original.category) && original.category !== p.category) return false;
  if (original.role) return roleOf(original) === roleOf(p);
  if (supportOf(scene, slot)) return p.category === "Home accessories";
  if (intent.requireStorage && original.category === "Storage")
    return p.category === "Storage";
  return (
    roleOf(original) === roleOf(p) ||
    (productRole(original.category) === "surface" &&
      productRole(p.category) === "surface")
  );
}
/** Send only products that can occupy the current slots, including kept items. */
export function shoppingCatalogContext(input: StylistInput) {
  const scene = demoScenes.find((s) => s.id === input.sceneId)!;
  return demoProducts.flatMap((p) => {
    const slots = Object.entries(input.draft.items)
      .filter(([slot, item]) =>
        input.keep.includes(slot) || item.owned
          ? itemProductId(slot, item) === p.id
          : stylistCompatible(scene, slot, p, { requireStorage: false }),
      )
      .map(([slot]) => slot);
    return slots.length
      ? [{ id: p.id, name: p.name, category: p.category, role: roleOf(p),
          priceCents: p.price, materials: p.materials,
          finishes: p.colors.map((c) => c.name), slots }]
      : [];
  });
}
export function checkContext(input: StylistInput) {
  const scene = demoScenes.find((s) => s.id === input.sceneId);
  if (!scene) return "Choose an available collection.";
  if (input.keep.some((id) => !scene.objects.some((o) => o.id === id)))
    return "A kept product is not in this collection.";
  return validateArrangement(scene, input.draft, input.draft);
}
export function checkCombination(
  input: StylistInput,
  intent: ShoppingIntent,
  draft: Arrangement,
) {
  const scene = demoScenes.find((s) => s.id === input.sceneId)!;
  for (const [slot, before] of Object.entries(input.draft.items)) {
    const after = draft.items[slot];
    if (!after) return "An item is missing from the combination.";
    const kept =
      input.keep.includes(slot) || intent.keep.includes(slot) || !!before.owned;
    if (
      kept &&
      (itemProductId(slot, before) !== itemProductId(slot, after) ||
        before.color !== after.color ||
        before.visible !== after.visible)
    )
      return "A kept product or its finish changed.";
    if (
      before.locked &&
      (before.x !== after.x ||
        before.z !== after.z ||
        before.yaw !== after.yaw ||
        !after.locked)
    )
      return "A position-locked product moved.";
    if (before.owned !== after.owned || before.included !== after.included)
      return "The purchase selection changed.";
    if (
      !kept &&
      !stylistCompatible(
        scene,
        slot,
        findDemoProduct(itemProductId(slot, after))!,
        intent,
      )
    )
      return "A replacement does not serve the required product role.";
    if (after.visible !== before.visible)
      return "The stylist cannot remove a required product.";
  }
  if (intent.keep.some((id) => !Object.hasOwn(draft.items, id)))
    return "The requested kept product was not found.";
  const error = validateArrangement(scene, input.draft, draft, {
    roomBounds: true,
  });
  if (error) return error;
  const budget =
    Math.min(input.budgetCents, intent.budgetCents ?? input.budgetCents) -
    (intent.strictBudget ? 1 : 0);
  return merchandiseTotal(draft) > budget
    ? "This combination exceeds the merchandise budget."
    : null;
}
function finishFor(
  p: DemoProduct,
  palette: ShoppingIntent["palette"],
  variant: number,
) {
  const originalPalette = {
    warm: /wood|walnut|oak|pine|birch|ash|cognac|tan\b|terracotta|rust|cream|sand|ivory|oat/i,
    cool: /blue|navy|sage|olive|forest|silver/i,
    neutral: /white|ivory|cream|chalk|charcoal|black|gr[ae]y|sand|taupe/i,
    colorful: /yellow|mustard|blue|navy|sage|olive|forest|rust|terracotta|burgundy/i,
    original: null,
  }[palette];
  // Keep an already suitable original material in the first look. Applying the
  // same tint to every product would erase much of the catalog's visual variety.
  if (variant === 0 && originalPalette?.test(`${p.name} ${p.materials} ${p.colors[0].name}`)) return 0;
  const term =
    palette === "warm"
      ? variant % 2
        ? /walnut|clay|oak|terra|wood/i
        : /sand|ivory|oat|warm|linen/i
      : palette === "cool"
        ? /blue|sage|forest|slate/i
        : palette === "neutral"
          ? /gray|ivory|chalk|charcoal|sand/i
          : palette === "colorful"
            ? variant % 2
              ? /clay|blue/i
              : /forest|sage/i
            : null;
  return term
    ? Math.max(
        0,
        p.colors.findIndex((c) => term.test(c.name)),
      )
    : 0;
}
export function candidateChanges(before: Arrangement, after: Arrangement) {
  const changes: string[] = [];
  for (const [slot, b] of Object.entries(after.items)) {
    const a = before.items[slot],
      p = findDemoProduct(itemProductId(slot, b))!;
    if (itemProductId(slot, a) !== p.id)
      changes.push(
        `${findDemoProduct(itemProductId(slot, a))!.name} → ${p.name}`,
      );
    if (a.color !== b.color || itemProductId(slot, a) !== p.id)
      changes.push(`${p.name}: ${p.colors[b.color].name}`);
    if (a.x !== b.x || a.z !== b.z || a.yaw !== b.yaw)
      changes.push(`Reposition ${p.name}`);
  }
  if (before.lighting !== after.lighting)
    changes.push(`${after.lighting} lighting`);
  if (JSON.stringify(before.background) !== JSON.stringify(after.background))
    changes.push(`${after.background?.preset ?? "original"} room finish`);
  return changes;
}
/** Small catalog search with exact budget pruning. Models only rank valid final states. */
export function buildCandidates(input: StylistInput, intent: ShoppingIntent) {
  const seen = new Set<string>();
  const scene = demoScenes.find((s) => s.id === input.sceneId)!,
    slots = scene.objects.map((o) => o.id),
    keep = new Set([...input.keep, ...intent.keep]),
    budget =
      Math.min(input.budgetCents, intent.budgetCents ?? input.budgetCents) -
      (intent.strictBudget ? 1 : 0),
    candidates: Candidate[] = [];
  let checked = 0;
  const choices = slots.map((slot) => {
    const item = input.draft.items[slot];
    return keep.has(slot) || item.owned
      ? [findDemoProduct(itemProductId(slot, item))!]
      : demoProducts.filter(
          (p) =>
            !intent.excludedProductIds.includes(p.id) &&
            stylistCompatible(scene, slot, p, intent),
        );
  });
  const layouts = collectionLayouts(scene),
    bases = [
      input.draft,
      ...(intent.layout === "original" ? [] : [layouts.B, layouts.D]),
    ];
  const selections = catalogSelections(choices, slots.map(s => purchasing(input.draft.items[s])), budget);
  // Also retain every affordable single substitution in the current arrangement.
  // A beam can otherwise lose a physically valid kit before geometry validation.
  for (let index = 0; index < slots.length; index++)
    for (const p of choices[index]) {
      const products = slots.map((slot, i) => i === index ? p : findDemoProduct(itemProductId(slot, input.draft.items[slot]))!);
      if (products.some((p, i) => !choices[i].some(c => c.id === p.id))) continue;
      const cost = products.reduce((n, p, i) => n + (purchasing(input.draft.items[slots[i]]) ? p.price : 0), 0);
      if (cost <= budget) selections.push({ products, cost });
    }
  const selectionKeys = new Set<string>();
  selectionLoop: for (const { products: selected, cost } of selections) {
    const selectionKey = selected.map(p => p.id).join("|");
    if (selectionKeys.has(selectionKey)) continue;
    selectionKeys.add(selectionKey);
    for (let variation = 0; variation < 2; variation++)
      for (const base of bases) {
        if (checked++ >= 12000) break selectionLoop;
        const draft = structuredClone(input.draft);
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i],
            old = input.draft.items[slot],
            p = selected[i],
            held = keep.has(slot) || old.owned;
          draft.items[slot] = {
            ...old,
            ...(!old.locked
              ? {
                  x: base.items[slot].x,
                  z: base.items[slot].z,
                  yaw: base.items[slot].yaw,
                }
              : {}),
            productId: p.id,
            color: held ? old.color : finishFor(p, intent.palette, variation),
          };
        }
        // Preserve relative accessory positions when a supporting piece moves.
        for (const slot of slots) {
          const parent = supportOf(scene, slot);
          if (!parent) continue;
          const old = input.draft.items[parent],
            next = draft.items[parent],
            child = input.draft.items[slot];
          if (old.x !== next.x || old.z !== next.z || old.yaw !== next.yaw) {
            const angle = next.yaw - old.yaw,
              dx = child.x - old.x,
              dz = child.z - old.z;
            draft.items[slot].x =
              next.x + dx * Math.cos(angle) + dz * Math.sin(angle);
            draft.items[slot].z =
              next.z - dx * Math.sin(angle) + dz * Math.cos(angle);
            draft.items[slot].yaw = Math.atan2(
              Math.sin(child.yaw + angle),
              Math.cos(child.yaw + angle),
            );
          }
        }
        if (intent.lighting) draft.lighting = intent.lighting;
        if (intent.background)
          draft.background = {
            ...draft.background,
            preset: intent.background,
            wall: undefined,
            floor: undefined,
          };
        if (checkCombination(input, intent, draft)) continue;
        const signature = JSON.stringify(draft);
        if (seen.has(signature)) continue;
        seen.add(signature);
        const changes = candidateChanges(input.draft, draft);
        if (!changes.length) continue;
        candidates.push({
          id: `look-${candidates.length + 1}`,
          draft,
          subtotalCents: cost,
          score:
            changes.filter((c) => c.includes("→")).length * 0.1 +
            (budget - cost) / Math.max(budget, 1),
          changes,
        });
      }
  }
  // Preserve variety in products instead of filling the shortlist with tint duplicates.
  candidates.sort((a, b) => a.score - b.score);
  const kits = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = Object.entries(c.draft.items)
      .map(([s, i]) => itemProductId(s, i))
      .join("|");
    kits.set(key, [...(kits.get(key) ?? []), c]);
  }
  const representatives = [...kits.values()].map(v => ({
    products: Object.entries(v[0].draft.items).map(([s, i]) => findDemoProduct(itemProductId(s, i))!),
    cost: v[0].subtotalCents,
    options: v,
  }));
  const chosen = diverseSelections(representatives, budget, 24);
  const shortlist = chosen.map(c => c.options[0]);
  // With multiple valid kits, give Spark one candidate per merchandise set so
  // its two results cannot be the same products with different tint labels.
  if (shortlist.length === 1)
    for (const c of chosen) {
      const second = c.options[1];
      if (second && shortlist.length < 24) shortlist.push(second);
    }
  return {
    candidates: shortlist,
    checked,
    budget,
    notice: shortlist.length
      ? null
      : `No valid combination was found within ${money(budget)}. Try a higher budget or keep fewer purchased items.`,
  };
}
