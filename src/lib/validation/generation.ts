import { z } from "zod";
export const restartInputSchema = z.object({
  target: z.enum(["PHOTO", "ANALYSIS", "RECONSTRUCTION"]), expectedRevision: z.number().int().nonnegative(),
  confirmed: z.literal(true)
}).strict();
export type RestartTarget = z.infer<typeof restartInputSchema>["target"];
export const runInputSchema = z.object({
  kind: z.enum(["ANALYZE", "RECONSTRUCT"]), expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.uuid(), objectIds: z.array(z.uuid()).min(1).max(3).optional()
}).strict().superRefine((input, ctx) => {
  if (input.kind === "RECONSTRUCT" && (!input.objectIds || new Set(input.objectIds).size !== input.objectIds.length)) {
    ctx.addIssue({ code: "custom", message: "Select one to three different objects.", path: ["objectIds"] });
  }
});
export const objectEditsSchema = z.object({ expectedRevision: z.number().int().nonnegative(),
  objects: z.array(z.object({ id: z.uuid(), label: z.string().trim().min(1).max(120),
    positionX: z.number().finite().min(-20).max(20), positionY: z.number().finite().min(-5).max(20), positionZ: z.number().finite().min(-20).max(20),
    yaw: z.number().finite().min(-Math.PI * 4).max(Math.PI * 4), scale: z.number().finite().min(0.1).max(5), visible: z.boolean()
  }).strict()).min(1).max(10)
}).strict().refine(input => new Set(input.objects.map(o => o.id)).size === input.objects.length, "Duplicate object IDs.");
