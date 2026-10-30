import { tintSchema } from "@/lib/scene/appearance";
import { lightingSchema } from "@/lib/scene/lighting";
import { productSchema } from "./products";
import { z } from "zod";
import { analysisOptionsSchema, segmentationOptionsSchema, reconstructionOptionsSchema } from "@/lib/ai/controls";
export const restartInputSchema = z.object({
  target: z.enum(["PHOTO", "ANALYSIS", "RECONSTRUCTION"]), expectedRevision: z.number().int().nonnegative(),
  confirmed: z.literal(true)
}).strict();
export type RestartTarget = z.infer<typeof restartInputSchema>["target"];
export const runInputSchema = z.object({
  kind: z.enum(["ANALYZE", "SEGMENT_OBJECT", "RECONSTRUCT", "IMAGE_EDIT"]), expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.uuid(), objectIds: z.array(z.uuid()).min(1).max(10).optional(),
  background:z.object({mode:z.enum(["materials","photo"])}).strict().optional(),repair:z.boolean().optional(),confirmed:z.literal(true).optional(),
  analysis: analysisOptionsSchema.optional(), segmentation: segmentationOptionsSchema.optional(), reconstruction: reconstructionOptionsSchema.optional()
}).strict().superRefine((input, ctx) => {
  if (input.kind === "RECONSTRUCT" && (input.objectIds && new Set(input.objectIds).size !== input.objectIds.length)) {
    ctx.addIssue({ code: "custom", message: "Select different objects, or use automatic selection.", path: ["objectIds"] });
  }
  if(input.background&&input.kind!=="IMAGE_EDIT")ctx.addIssue({code:"custom",message:"Background controls belong to the background step."});
  if(input.repair&&(input.kind!=="RECONSTRUCT"||!input.confirmed||!input.objectIds?.length))ctx.addIssue({code:"custom",message:"Confirm a paid retry and choose objects."});
  if (input.kind === "SEGMENT_OBJECT" && !input.segmentation) ctx.addIssue({code:"custom",message:"Choose an object and its segmentation prompt.",path:["segmentation"]});
  if (input.kind !== "SEGMENT_OBJECT" && input.segmentation || input.kind !== "ANALYZE" && input.analysis || input.kind !== "RECONSTRUCT" && (input.reconstruction || input.objectIds)) ctx.addIssue({code:"custom",message:"These controls belong to a different step."});
});
export const maskSelectionSchema = z.object({expectedRevision:z.number().int().nonnegative(),objectId:z.uuid(),maskAssetId:z.uuid().optional(),maskAssetIds:z.array(z.uuid()).min(2).max(10).optional()}).strict()
  .refine(v=>Boolean(v.maskAssetId)!==Boolean(v.maskAssetIds),"Choose one outline or a set to combine.")
  .refine(v=>!v.maskAssetIds||new Set(v.maskAssetIds).size===v.maskAssetIds.length,"Choose different outlines to combine.");
export const objectEditsSchema = z.object({ expectedRevision: z.number().int().nonnegative(), lighting: lightingSchema.optional(),
  objects: z.array(z.object({ id: z.uuid(), label: z.string().trim().min(1).max(120),
    positionX: z.number().finite().min(-20).max(20), positionY: z.number().finite().min(-5).max(20), positionZ: z.number().finite().min(-20).max(20),
    pitch:z.number().finite().min(-Math.PI/2).max(Math.PI/2).optional(),roll:z.number().finite().min(-Math.PI).max(Math.PI).optional(),
    yaw: z.number().finite().min(-Math.PI * 4).max(Math.PI * 4), scale: z.number().finite().min(0.1).max(5), visible: z.boolean(), tint: tintSchema.optional(), product: productSchema.nullable().optional()
  }).strict()).min(1).max(10)
}).strict().refine(input => new Set(input.objects.map(o => o.id)).size === input.objects.length, "Duplicate object IDs.");
