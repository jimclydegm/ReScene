import { z } from "zod";

export const createSceneSchema = z.object({
  title: z.string().trim().min(1, "Give your scene a name.").max(160, "Use 160 characters or fewer.")
}).strict();

export const updateSceneSchema = createSceneSchema.partial().extend({
  expectedRevision: z.number().int().nonnegative(),
  description: z.string().trim().max(2000).nullable().optional()
}).strict().refine(value => value.title !== undefined || value.description !== undefined, "Choose something to update.");

export const imageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const reserveUploadSchema = z.object({
  contentType: z.enum(imageTypes, { error: "Choose a JPEG, PNG, or WebP image." }),
  byteSize: z.number().int().positive().max(12 * 1024 * 1024, "Choose an image smaller than 12 MB."),
  expectedRevision: z.number().int().nonnegative()
}).strict();

export const completeUploadSchema = z.object({
  expectedRevision: z.number().int().nonnegative()
}).strict();

export const uuidSchema = z.uuid();
