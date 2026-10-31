import { z } from "zod";
import { findDemoProduct, demoProducts, collectionProducts } from "./catalog";
export const DEMO_STORAGE = "rescene-store-v1";
export const cartLineSchema = z
  .object({
    productId: z.string().refine((id) => !!findDemoProduct(id)),
    color: z.number().int().min(0),
    quantity: z.number().int().min(1).max(20),
  })
  .strict()
  .refine((l) => l.color < (findDemoProduct(l.productId)?.colors.length ?? 0));
export type CartLine = z.infer<typeof cartLineSchema>;
export const cartSchema = z
  .array(cartLineSchema)
  .max(40)
  .refine(
    (lines) =>
      new Set(lines.map((l) => `${l.productId}:${l.color}`)).size ===
      lines.length,
  );
export function addToCart(
  cart: CartLine[],
  productId: string,
  color = 0,
  quantity = 1,
): CartLine[] {
  const line = cartLineSchema.parse({ productId, color, quantity }),
    found = cart.find((l) => l.productId === productId && l.color === color);
  if (found)
    return cart.map((l) =>
      l === found ? { ...l, quantity: Math.min(20, l.quantity + quantity) } : l,
    );
  return cartSchema.parse([...cart, line]);
}
export const cartTotal = (cart: CartLine[]) =>
  cart.reduce(
    (total, line) =>
      total + (findDemoProduct(line.productId)?.price ?? 0) * line.quantity,
    0,
  );
export const itemDraftSchema = z
  .object({
    x: z.number().min(-8).max(8),
    z: z.number().min(-8).max(8),
    yaw: z.number().min(-Math.PI).max(Math.PI),
    visible: z.boolean(),
    color: z.number().int().min(0).max(2),
  })
  .strict();
export type ItemDraft = z.infer<typeof itemDraftSchema>;
export const arrangementSchema = z
  .object({
    items: z.record(z.string(), itemDraftSchema),
    lighting: z.enum(["Original", "Day", "Dusk", "Night", "Studio"]),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (Object.keys(a.items).length > 8)
      ctx.addIssue({ code: "custom", message: "Unknown arrangement" });
    for (const [id, item] of Object.entries(a.items)) {
      const p = findDemoProduct(id);
      if (!p || item.color >= p.colors.length)
        ctx.addIssue({ code: "custom", message: "Unknown product or color" });
    }
  });
export type Arrangement = z.infer<typeof arrangementSchema>;
const layoutKeys = [
  "sage-chair",
  "round-table",
  "oak-dresser",
  "dining-chair",
].sort();
export const layoutsSchema = z
  .object({ A: arrangementSchema, B: arrangementSchema })
  .strict()
  .refine((v) =>
    [v.A, v.B].every(
      (a) =>
        JSON.stringify(Object.keys(a.items).sort()) ===
        JSON.stringify(layoutKeys),
    ),
  );
export const layoutNames = ["A", "B", "C", "D"] as const;
export type LayoutName = (typeof layoutNames)[number];
export const layoutSetSchema = z
  .object({
    A: arrangementSchema,
    B: arrangementSchema,
    C: arrangementSchema,
    D: arrangementSchema,
  })
  .strict();
export type LayoutSet = z.infer<typeof layoutSetSchema>;
export const collectionsSchema = z
  .record(z.string(), layoutSetSchema)
  .superRefine((value, ctx) => {
    for (const [id, layouts] of Object.entries(value)) {
      const keys = Object.hasOwn(collectionProducts, id)
        ? collectionProducts[id]
        : undefined;
      if (
        !keys ||
        Object.values(layouts).some(
          (layout) =>
            JSON.stringify(Object.keys(layout.items).sort()) !==
            JSON.stringify([...keys].sort()),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Unknown collection or incomplete layout",
        });
    }
  });
export const persistedDemoSchema = z
  .object({
    version: z.literal(1),
    cart: cartSchema,
    layouts: layoutsSchema.nullable(),
    collections: collectionsSchema.default({}),
  })
  .strict();
export type PersistedDemo = z.infer<typeof persistedDemoSchema>;
export const isDemoId = (id: string) => demoProducts.some((p) => p.id === id);
// Conservative floor footprints: never lift furniture or move through another item.
// Rectangles are rotated using the same draft yaw as the renderer (SAT intersection).
export function footprintOverlap(
  a: { x: number; z: number; yaw: number; width: number; depth: number },
  b: { x: number; z: number; yaw: number; width: number; depth: number },
) {
  const corners = (r: typeof a) =>
    [-1, 1].flatMap((x) =>
      [-1, 1].map((z) => [
        r.x +
          ((x * r.width) / 2) * Math.cos(r.yaw) +
          ((z * r.depth) / 2) * Math.sin(r.yaw),
        r.z -
          ((x * r.width) / 2) * Math.sin(r.yaw) +
          ((z * r.depth) / 2) * Math.cos(r.yaw),
      ]),
    );
  const aa = corners(a),
    bb = corners(b);
  for (const yaw of [a.yaw, b.yaw])
    for (const [x, z] of [
      [Math.cos(yaw), -Math.sin(yaw)],
      [Math.sin(yaw), Math.cos(yaw)],
    ]) {
      const ap = aa.map((p) => p[0] * x + p[1] * z),
        bp = bb.map((p) => p[0] * x + p[1] * z);
      if (
        Math.max(...ap) <= Math.min(...bp) + 0.015 ||
        Math.max(...bp) <= Math.min(...ap) + 0.015
      )
        return false;
    }
  return true;
}
