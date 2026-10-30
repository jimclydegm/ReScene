import { z } from "zod";
import type { SceneComposition } from "./composition";
const light = z.object({ color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), position: z.tuple([z.number().min(-20).max(20), z.number().min(0.1).max(20), z.number().min(-20).max(20)]), intensity: z.number().min(0).max(8) }).strict();
export const lightingSchema = z.object({ key: light, fill: light, ambient: z.number().min(0).max(4) }).strict();
export type Lighting = z.infer<typeof lightingSchema>;
export function defaultLighting(composition: SceneComposition | null): Lighting {
  const side = composition?.environment.lightDirection;
  return { key: { position: [side === "left" ? -5 : 5, 7, 4], intensity: side === "diffuse" ? 1 : 2 }, fill: { position: [side === "left" ? 5 : -5, 4, 6], intensity: 0.4 }, ambient: 1.2 };
}

export const lightingPresets:Record<string,Lighting>={
 Day:{key:{position:[-5,8,5],intensity:2.4,color:"#fff5e6"},fill:{position:[5,4,4],intensity:.5,color:"#dceaff"},ambient:1.2},
 Dusk:{key:{position:[-7,2,3],intensity:1.5,color:"#ffb36b"},fill:{position:[5,4,-3],intensity:.45,color:"#879fff"},ambient:.65},
 Night:{key:{position:[3,6,2],intensity:.65,color:"#a9c7ff"},fill:{position:[-4,2,2],intensity:.25,color:"#ffd2a0"},ambient:.25},
 Studio:{key:{position:[-4,7,5],intensity:2,color:"#ffffff"},fill:{position:[5,4,5],intensity:1,color:"#ffffff"},ambient:1.1}
};
