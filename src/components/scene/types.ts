import type { ModelPlacement, SceneComposition } from "@/lib/scene/composition";
export type SceneObjectView = { id: string; label: string; status: string; errorCode: string | null;
  maskUrl: string | null; modelUrl: string | null; positionX: number; positionY: number; positionZ: number;
  yaw: number; scale: number; visible: boolean; placement: ModelPlacement | null };
export type SceneWorkspace = { id: string; title: string; status: string; revision: number; generationEnabled: boolean;
  composition: SceneComposition | null; canRestoreLayout: boolean;
  image: { url: string; width: number; height: number } | null; objects: SceneObjectView[];
  run: { id: string; kind: string; status: string; stage: string | null; progress: number;
    errorCode: string | null; errorMessage: string | null; canResume: boolean } | null };
