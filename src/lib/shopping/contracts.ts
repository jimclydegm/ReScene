import { z } from "zod";
import { arrangementSchema } from "@/lib/demo/state";
import { collectionIds } from "@/lib/demo/catalog";
export const stylistInputSchema = z
  .object({
    key: z.uuid(),
    sceneId: z
      .string()
      .refine(
        (id) => collectionIds.includes(id),
        "Choose an available collection.",
      ),
    text: z.string().trim().min(3).max(1000),
    budgetCents: z.number().int().min(1).max(100_000_000),
    selected: z.string().max(80),
    keep: z.array(z.string().max(80)).max(8),
    draft: arrangementSchema,
    voiceAttemptId: z.uuid().optional(),
  })
  .strict();
export type StylistInput = z.infer<typeof stylistInputSchema>;
export const shoppingIntentSchema = z
  .object({
    summary: z.string().max(240),
    palette: z.enum(["warm", "cool", "neutral", "colorful", "original"]),
    keep: z.array(z.string().max(80)).max(8),
    excludedProductIds: z.array(z.string().max(80)).max(24),
    requireStorage: z.boolean(),
    budgetCents: z.number().int().min(1).max(100_000_000).nullable(),
    strictBudget: z.boolean(),
    lighting: z.enum(["Original", "Day", "Dusk", "Night", "Studio"]).nullable(),
    background: z
      .enum(["original", "linen", "clay", "sage", "gallery", "studio"])
      .nullable(),
    layout: z.enum(["original", "relaxed", "open"]),
    clarification: z.string().max(240).nullable(),
  })
  .strict();
export type ShoppingIntent = z.infer<typeof shoppingIntentSchema>;
export const shoppingRankingSchema = z
  .object({
    options: z
      .array(
        z
          .object({
            candidateId: z.string().max(80),
            title: z.string().min(1).max(60),
            reason: z.string().min(1).max(220),
          })
          .strict(),
      )
      .min(1)
      .max(2),
  })
  .strict();
export const shoppingOptionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    reason: z.string(),
    draft: arrangementSchema,
    subtotalCents: z.number().int().nonnegative(),
    remainingCents: z.number().int().nonnegative(),
    changes: z.array(z.string()),
    kept: z.array(z.string()),
  })
  .strict();
export type ShoppingOption = z.infer<typeof shoppingOptionSchema>;
export const shoppingResultSchema = z
  .object({
    summary: z.string(),
    notice: z.string().nullable(),
    options: z.array(shoppingOptionSchema).max(2),
    checked: z.number().int().nonnegative(),
    catalogRevision: z.string(),
    effectiveBudgetCents: z.number().int().positive(),
  })
  .strict();
export type ShoppingResult = z.infer<typeof shoppingResultSchema>;
