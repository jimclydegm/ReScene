import { z } from "zod";
export const tintSchema=z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable();
export const objectAppearanceSchema=z.object({tint:tintSchema.optional()}).strict();
