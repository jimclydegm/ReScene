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
  wallOffsets:z.array(z.number().min(0).max(1000)).max(8).optional(),
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
  if (wall) wall = offsetBackgroundWalls([wall], composition.camera.position, plan.wallOffsets)[0];
  return { ground: plan.groundVisible, wall, extent, plan };
}
/** Keep material-wall corners connected when clearance expands their planes. */
export function offsetBackgroundWalls<T extends {position:[number,number,number];yaw:number;width:number;height:number}>(walls:T[],eye:[number,number,number],offsets:number[]=[]):T[] {
  if (!offsets.some(v=>v>0)) return walls;
  const spans=walls.map((w,i)=>{const c=new Vector3(...w.position),u=new Vector3(Math.cos(w.yaw),0,-Math.sin(w.yaw)),n=new Vector3(Math.sin(w.yaw),0,Math.cos(w.yaw));if(n.dot(new Vector3(...eye).sub(c))<0)n.negate();const d=n.dot(c)-(offsets[i]??0),shift=n.clone().multiplyScalar(-(offsets[i]??0));return {n,d,old:[c.clone().addScaledVector(u,-w.width/2),c.clone().addScaledVector(u,w.width/2)],ends:[c.clone().addScaledVector(u,-w.width/2).add(shift),c.clone().addScaledVector(u,w.width/2).add(shift)]};});
  for(let i=0;i<spans.length-1;i++){const a=spans[i],b=spans[i+1],det=a.n.x*b.n.z-a.n.z*b.n.x;if(Math.abs(det)<1e-8)continue;for(let x=0;x<2;x++)for(let y=0;y<2;y++)if(a.old[x].distanceTo(b.old[y])<.01){const p=new Vector3((a.d*b.n.z-a.n.z*b.d)/det,a.ends[x].y,(a.n.x*b.d-a.d*b.n.x)/det);a.ends[x]=p;b.ends[y]=p.clone();}}
  return walls.map((w,i)=>({...w,position:spans[i].ends[0].clone().add(spans[i].ends[1]).multiplyScalar(.5).toArray() as [number,number,number],width:spans[i].ends[0].distanceTo(spans[i].ends[1])}));
}
