import { z } from "zod";
export const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000), brand: z.string().trim().max(120),
  price: z.string().regex(/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/, "Enter a nonnegative price with up to two decimal places.").nullable(),
  currency: z.enum(["USD", "PHP", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "INR"]),
  productUrl: z.string().trim().max(2048).refine(value => {
    if (!value) return true;
    try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
  }, "Use an HTTPS product link without embedded credentials.")
}).strict();
export type ProductFields = z.infer<typeof productSchema>;
