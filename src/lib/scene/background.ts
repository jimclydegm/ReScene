import { z } from "zod";
import {environmentGeometrySchema} from "./environment-plan";
import { Matrix4, PerspectiveCamera, Plane, Ray, Vector3 } from "three";
import type { SceneComposition } from "./composition";

// Model observations have a separate allowlist. Adding renderer state must
// never change the structured-output schema sent to an inference provider.
export const backgroundObservationSchema = z.object({
  kind: z.enum(["seamless", "planes", "distant"]),
  groundVisible: z.boolean(),
  boundary: z.object({leftY:z.number().min(0).max(1),rightY:z.number().min(0).max(1)}).strict().nullable(),
  description: z.string().min(1).max(500)
}).strict();
export const backgroundPlanSchema = backgroundObservationSchema.extend({
  surfaceMode:z.enum(["materials","reference"]).optional(),
  geometry:environmentGeometrySchema.optional(),
  transition:z.enum(["open","curve"]).optional(),
  junctions:z.array(z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).strict()).min(2).max(3).optional(),
  materials:z.object({ground:z.object({color:z.string().regex(/^#[0-9a-fA-F]{6}$/),roughness:z.number().min(.2).max(1),tileSize:z.number().min(.1).max(10)}).strict(),wall:z.object({color:z.string().regex(/^#[0-9a-fA-F]{6}$/),roughness:z.number().min(.2).max(1),tileSize:z.number().min(.1).max(10)}).strict()}).strict().optional(),
  spatial:z.object({rearDistance:z.number().min(.01).max(1000),curveRadius:z.number().min(.01).max(100),confidence:z.number().min(0).max(1),source:z.enum(["foreground-calibrated-depth","subject-relative-fallback"])}).strict().optional(),
  plainColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();
export type BackgroundPlan = z.infer<typeof backgroundPlanSchema>;
export const fallbackBackground: BackgroundPlan = { kind: "seamless", groundVisible: true, boundary: null,
  description: "No verified background geometry. Extend the visible support without adding walls or edges." };

export function backgroundCamera(camera: SceneComposition["camera"]) {
  const c = new PerspectiveCamera(camera.fov, camera.aspect, 0.01, 500);
  c.position.set(...camera.position); c.lookAt(new Vector3(...camera.target)); c.updateMatrixWorld(); c.updateProjectionMatrix();
  return c;
}
export function backgroundProjection(camera: SceneComposition["camera"]) {
  const c = backgroundCamera(camera);
  return new Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
}

// Only an observed wall/support seam can create a wall. No object-category rules,
// room box, baseboards or finite side boundaries are inferred here.
export function backgroundSurfaces(composition: SceneComposition, floorY: number) {
  const plan = composition.background ?? fallbackBackground;
  const c = backgroundCamera(composition.camera);
  const extent = Math.max(160, c.position.distanceTo(new Vector3(...composition.camera.target)) * 8);
  let wall: { position: [number, number, number]; yaw: number; width: number; height: number } | null = null;
  if (plan.kind === "planes" && plan.groundVisible && plan.boundary) {
    const ground = new Plane(new Vector3(0, 1, 0), -floorY);
    const ends = [0, 1].map(i => {
      const x = i ? .8 : -.8, y = 1 - 2 * (plan.boundary!.leftY * (1 - (x + 1) / 2) + plan.boundary!.rightY * (x + 1) / 2);
      const direction = new Vector3(x, y, .5).unproject(c).sub(c.position).normalize();
      return new Ray(c.position, direction).intersectPlane(ground, new Vector3());
    });
    if (ends.every((p): p is Vector3 => !!p && p.distanceTo(c.position) < extent * .4)) {
      const a = ends[0]!, b = ends[1]!, middle = a.clone().add(b).multiplyScalar(.5), tangent = b.clone().sub(a);
      // Reject a seam in front of the subjects: leave it in the distant photo
      // layer rather than occluding a reconstructed subject with a guessed wall.
      const forward = new Vector3(...composition.camera.target).sub(c.position).normalize();
      const seamDepth = middle.clone().sub(c.position).dot(forward);
      const targetDepth = new Vector3(...composition.camera.target).sub(c.position).dot(forward);
      if (seamDepth > targetDepth * .8 && tangent.length() > .01) wall = {
        position: [middle.x, floorY + extent / 2, middle.z], yaw: Math.atan2(-tangent.z, tangent.x), width: extent, height: extent
      };
    }
  }
  return { ground: plan.groundVisible, wall, extent, plan };
}
