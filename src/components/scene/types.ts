import type { ProductFields } from "@/lib/validation/products";
import type { Lighting } from "@/lib/scene/lighting";
import type { ModelPlacement, SceneComposition } from "@/lib/scene/composition";
import type { AnalysisOptions, ReconstructionOptions, SegmentationOptions } from "@/lib/ai/controls";
export type SceneObjectView = { id: string; label: string; status: string; errorCode: string | null;
  concept:string;confidence:number|null;bounds:SegmentationOptions["box"]|null;segmentation:SegmentationOptions|null;
  maskAlternatives:{assetId:string;confidence:number|null;bounds:NonNullable<SegmentationOptions["box"]>;area:number;url:string;selected:boolean}[];
  canRestoreOriginal: boolean; product: (ProductFields & { imageUrl: string | null }) | null; maskUrl: string | null; modelUrl: string | null; positionX: number; positionY: number; positionZ: number;
  yaw: number; scale: number; visible: boolean; placement: ModelPlacement | null };
export type SceneWorkspace = { id: string; title: string; description: string | null; status: string; revision: number; generationEnabled: boolean;
  analysisOptions:AnalysisOptions;reconstructionOptions:ReconstructionOptions;analysisSummary:string|null;
  lighting: Lighting; appearance: { applied: boolean; floorUrl: string | null; wallUrl: string | null };
  composition: SceneComposition | null; canRestoreLayout: boolean;
  image: { url: string; width: number; height: number } | null; objects: SceneObjectView[];
  run: { id: string; kind: string; status: string; stage: string | null; progress: number;
    errorCode: string | null; errorMessage: string | null; canResume: boolean } | null };

export type RenderObject = Pick<SceneObjectView, "id" | "label" | "modelUrl" | "positionX" | "positionY" | "positionZ" | "yaw" | "scale" | "visible" | "placement"> & { worldTransform?: import("@/lib/scene/manifest").WorldTransform };
