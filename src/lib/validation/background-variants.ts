import { z } from "zod";

export const backgroundVariantActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("GENERATE"),
    expectedRevision: z.number().int().nonnegative(),
    idempotencyKey: z.uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    stylePrompt: z.string().trim().min(1).max(500).optional()
  }).strict(),
  z.object({
    action: z.literal("SELECT"),
    expectedRevision: z.number().int().nonnegative(),
    variantId: z.uuid()
  }).strict(),
  z.object({
    action: z.literal("DELETE"),
    expectedRevision: z.number().int().nonnegative(),
    variantId: z.uuid()
  }).strict()
]);

export type BackgroundVariantAction = z.infer<typeof backgroundVariantActionSchema>;
