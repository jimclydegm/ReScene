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
export const backgroundVariantInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  stylePrompt: z.string().trim().min(1).max(500).optional()
}).strict();
export type BackgroundVariantInput = z.infer<typeof backgroundVariantInputSchema>;
export const materialQualityOptions = z.object({objectIds:z.array(z.uuid()).min(1).max(10).optional(),materials:z.boolean(),masks:z.boolean(),review:z.boolean(),refresh:z.boolean().default(false),textureSize:z.union([z.literal(1024),z.literal(2048),z.literal(4096)]).default(2048),photoStrength:z.number().min(0).max(1).default(.35)}).strict();
export type MaterialQualityOptions=z.infer<typeof materialQualityOptions>;
export const runInputSchema = z.object({
  kind: z.enum(["ANALYZE", "SEGMENT_OBJECT", "RECONSTRUCT", "IMAGE_EDIT"]), expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.uuid(), objectIds: z.array(z.uuid()).min(1).max(10).optional(),
  background:z.object({mode:z.enum(["reference","materials","photo"]),reanalyze:z.boolean().optional()}).strict().optional(),repair:z.boolean().optional(),
  quality:materialQualityOptions.optional(),
  backgroundVariant:backgroundVariantInputSchema.optional(),confirmed:z.literal(true).optional(),
  analysis: analysisOptionsSchema.optional(), segmentation: segmentationOptionsSchema.optional(), reconstruction: reconstructionOptionsSchema.optional()
}).strict().superRefine((input, ctx) => {
  if (input.kind === "RECONSTRUCT" && (input.objectIds && new Set(input.objectIds).size !== input.objectIds.length)) {
    ctx.addIssue({ code: "custom", message: "Select different objects, or use automatic selection.", path: ["objectIds"] });
  }
  if(input.background&&input.kind!=="IMAGE_EDIT")ctx.addIssue({code:"custom",message:"Background controls belong to the background step."});
  if(input.quality&&(input.kind!=="IMAGE_EDIT"||!input.confirmed||input.background))ctx.addIssue({code:"custom",message:"Confirm the paid quality pass separately from background controls."});
  if(input.backgroundVariant&&(input.kind!=="IMAGE_EDIT"||!input.confirmed||input.background||input.quality))ctx.addIssue({code:"custom",message:"Confirm a background variant separately from other background work."});
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
