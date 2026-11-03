import data from "./photo-shopping.json";
import type { PhotoMask } from "./photo-mask";
import { initialArrangement, type DemoScene } from "./scenes";
import type { Arrangement } from "./state";

export type PhotoShoppingScene = {
  id: string;
  photo: { path: string; sha256: string; width: number; height: number };
  width: number;
  height: number;
  model: string;
  products: PhotoMask[];
};
export const photoShoppingScenes: PhotoShoppingScene[] = data.scenes;
export function photoShoppingScene(id: string) {
  const scene = photoShoppingScenes.find(s => s.id === id);
  if (!scene) throw new Error("Photo shopping unavailable for this collection");
  return scene;
}
/** A photo always sells its pictured original products, never edited 3D swaps. */
export function photoPurchaseDraft(scene: DemoScene, included: string[]): Arrangement {
  const draft = initialArrangement(scene), selected = new Set(included);
  for (const [id, item] of Object.entries(draft.items)) item.included = selected.has(id);
  return draft;
}
