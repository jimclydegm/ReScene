import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { z } from "zod";
import { backgroundPlanSchema } from "./background";

const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const quaternion = z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]);
export const environmentSchema = z.object({
  floorColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), wallColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  floorMaterial: z.enum(["wood", "tile", "carpet", "plain"]),
  lightDirection: z.enum(["left", "right", "front", "overhead", "diffuse"]),
  lightWarmth: z.enum(["warm", "neutral", "cool"]), sideWall: z.enum(["left", "right", "none"])
}).strict();
export type Environment = z.infer<typeof environmentSchema>;
export const modelPlacementSchema = z.object({
  version: z.literal("sam3d-layout-v1"), rotation: quaternion,
  scale: vector.refine(v => v.every(n => n > 0 && n < 1000)), offset: vector,
  size: vector.refine(v => v.every(n => n > 0 && n < 1000))
});
export type ModelPlacement = z.infer<typeof modelPlacementSchema>;
export const compositionSchema = z.object({
  version: z.literal("sam3d-room-v1"),
  floorY:z.number().finite().min(-1000).max(1000).optional(),
  backdrop:z.enum(["room","studio","none"]).optional(),
  background: backgroundPlanSchema.optional(),
  camera: z.object({ position: vector, target: vector, fov: z.number().min(20).max(85), aspect: z.number().positive() }),
  room: z.object({ centerX: z.number().finite(), centerZ: z.number().finite(), width: z.number().positive(),
    depth: z.number().positive(), height: z.number().positive() }),
  environment: environmentSchema, environmentSource: z.enum(["spark", "photo-colors"]),
  projectionError: z.number().nonnegative(), warnings: z.array(z.string())
});
export type SceneComposition = z.infer<typeof compositionSchema>;
type Bounds = { min: [number, number, number]; max: [number, number, number] };
export type CompositionInput = { id: string; metadata: unknown; bounds: Bounds; imageBounds: unknown; support: string;category?:string;supportedById?:string };
const metadataSchema = z.object({
  scale: z.tuple([vector.refine(v => v.every(n => n > 0 && n < 100))]),
  rotation: z.tuple([quaternion.refine(q => Math.abs(Math.hypot(...q) - 1) < 0.05)]),
  translation: z.tuple([vector.refine(v => v[2] > 0 && v.every(n => Math.abs(n) < 100))])
});
const imageBoundsSchema = z.object({ xMin: z.number().nonnegative(), yMin: z.number().nonnegative(),
  xMax: z.number().positive(), yMax: z.number().positive() });
const up = new Vector3(0, 1, 0);
const cameraFlip = new Quaternion().setFromAxisAngle(up, Math.PI);
const undoGlbExport = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);

// Meta's pose is WXYZ with row-vector rotation. GLB export additionally turns Z-up into Y-up.
// Sources: SAM 3D compose_transform, SceneVisualizer.object_pointcloud and to_glb (see docs).
// Do not apply the fal docs' XYZW label directly to the observed Meta output.
export function samPose(metadata: unknown) {
  const m = metadataSchema.parse(metadata);
  const [w, x, y, z] = m.rotation[0];
  return {
    rotation: cameraFlip.clone().multiply(new Quaternion(x, y, z, w).normalize().invert()).multiply(undoGlbExport),
    position: new Vector3(-m.translation[0][0], m.translation[0][1], -m.translation[0][2]),
    // Scale is expressed in the pre-export axes as well.
    scale: new Vector3(m.scale[0][0], m.scale[0][2], m.scale[0][1])
  };
}
function corners(bounds: Bounds) {
  return [0, 1].flatMap(x => [0, 1].flatMap(y => [0, 1].map(z => new Vector3(
    (x ? bounds.max : bounds.min)[0], (y ? bounds.max : bounds.min)[1], (z ? bounds.max : bounds.min)[2]))));
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function composeRoom(inputs: CompositionInput[], image: { width: number; height: number },
  environment: Environment, environmentSource: SceneComposition["environmentSource"], settle=true) {
  if (!inputs.length || inputs.length > 10 || !Number.isFinite(image.width / image.height) || image.width < 1 || image.height < 1) throw new Error("LAYOUT_INPUT_INVALID");
  const posed = inputs.map(input => {
    const pose = samPose(input.metadata);
    const points = corners(input.bounds).map(p => p.multiply(pose.scale).applyQuaternion(pose.rotation).add(pose.position));
    if (points.some(p => !p.toArray().every(Number.isFinite) || p.z >= -0.01)) throw new Error("LAYOUT_BEHIND_CAMERA");
    const box = imageBoundsSchema.parse(input.imageBounds);
    if (box.xMin >= box.xMax || box.yMin >= box.yMax || box.xMax > image.width || box.yMax > image.height) throw new Error("LAYOUT_IMAGE_BOUNDS_INVALID");
    return { ...input, pose, points, box };
  });
  const supports = posed.filter(o => o.support === "floor");
  const upright = supports.length ? supports : posed;
  const estimatedUp = new Vector3();
  for (const o of upright) {
    const axis = up.clone().applyQuaternion(o.pose.rotation);
    if (axis.dot(up) < 0.65) throw new Error("LAYOUT_COORDINATES_UNSUPPORTED");
    estimatedUp.add(axis);
  }
  estimatedUp.normalize();
  const level = new Quaternion().setFromUnitVectors(estimatedUp, up);
  const leveled = posed.map(o => ({ ...o, points: o.points.map(p => p.clone().applyQuaternion(level)) }));
  const bounds = new Box3().setFromPoints(leveled.flatMap(o => o.points));
  // A median across garment bottoms can bisect the subject. The conservative
  // lower envelope keeps every reconstructed surface above the floor.
  const floor = Math.min(...leveled.flatMap(o => o.points.map(p => p.y)));
  const center = bounds.getCenter(new Vector3());
  // ONE conversion for the whole scene. Never normalize each object independently.
  const unit = 5 / Math.max(...bounds.getSize(new Vector3()).toArray(), 0.01);
  const origin = new Vector3(-center.x, -floor, -center.z);
  const toWorld = (p: Vector3) => p.clone().applyQuaternion(level).add(origin).multiplyScalar(unit);
  const cameraPosition = toWorld(new Vector3());
  const cameraTarget = toWorld(new Vector3(0, 0, median(posed.map(o => o.pose.position.z))));

  // Fit a common focal length to the image rectangles. Bounds are a coarse silhouette proxy.
  const aspect = image.width / image.height;
  const observations: { predicted: number; observed: number }[] = [];
  for (const o of posed) {
    const xs = o.points.map(p => p.x / -p.z / aspect);
    const ys = o.points.map(p => p.y / -p.z);
    const edges = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const targets = [o.box.xMin / image.width * 2 - 1, o.box.xMax / image.width * 2 - 1,
      1 - o.box.yMax / image.height * 2, 1 - o.box.yMin / image.height * 2];
    edges.forEach((p, i) => observations.push({ predicted: p, observed: targets[i] }));
  }
  const focal = observations.reduce((sum, o) => sum + o.predicted * o.observed, 0) /
    Math.max(observations.reduce((sum, o) => sum + o.predicted ** 2, 0), 0.001);
  const fov = Math.max(20, Math.min(85, 2 * Math.atan(1 / Math.max(focal, 0.1)) * 180 / Math.PI));
  const usedFocal = 1 / Math.tan(fov * Math.PI / 360);
  const projectionError = Math.sqrt(observations.reduce((sum, o) => sum + (o.predicted * usedFocal - o.observed) ** 2, 0) / observations.length) / 2;
  const worldBounds = new Box3().setFromPoints(leveled.flatMap(o => o.points.map(p => p.clone().add(origin).multiplyScalar(unit))));
  const size = worldBounds.getSize(new Vector3());
  const worldCenter = worldBounds.getCenter(new Vector3());
  const roomDepth = Math.max(size.z + 4, 8);
  const objects = leveled.map(o => {
    const rotation = level.clone().multiply(o.pose.rotation);
    const scale = o.pose.scale.clone().multiplyScalar(unit);
    const localBox = new Box3().setFromPoints(corners(o.bounds).map(p => p.multiply(scale).applyQuaternion(rotation)));
    const pivot = localBox.getCenter(new Vector3()); pivot.y = localBox.min.y;
    const position = toWorld(o.pose.position).add(pivot);
    // Ground contact correction only for objects the analyzer identifies as floor-supported.
    if (position.y < 1e-8) position.y = 0;
    return { id: o.id, position: position.toArray() as [number, number, number],
      placement: modelPlacementSchema.parse({ version: "sam3d-layout-v1", rotation: rotation.toArray(), scale: scale.toArray(),
        offset: pivot.clone().negate().toArray(), size: localBox.getSize(new Vector3()).toArray() }) };
  });
  const composition = compositionSchema.parse({ version: "sam3d-room-v1", floorY:0,
    camera: { position: cameraPosition.toArray(), target: cameraTarget.toArray(), fov, aspect },
    room: { centerX: worldCenter.x, centerZ: worldBounds.min.z - 0.3 + roomDepth / 2, width: Math.max(size.x + 3, 8),
      depth: roomDepth, height: Math.max(size.y * 1.65, 4) },
    environment, environmentSource, projectionError,
    warnings: ["Scene surfaces and lighting are estimated; the floor is kept below reconstructed geometry.",
      ...(projectionError > 0.12 ? ["The pose and photo disagree. Check the layout against the reference and adjust it."] : [])]
  });
  if(settle)settleSupportContacts(objects,inputs,composition);
  return { composition, objects };
}

// Read accessor bounds through the GLB's active node hierarchy without loading textures or external resources.
export function glbBounds(bytes: Buffer): Bounds {
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  const box = new Box3();
  const visited = new Set<number>();
  function visit(index: number, parent: Matrix4, path: Set<number>) {
    if (path.has(index) || path.size > 100 || visited.size > 10000) throw new Error("Invalid GLB hierarchy");
    const node = gltf.nodes?.[index];
    if (!node) throw new Error("Invalid GLB node");
    visited.add(index);
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3(...(node.translation ?? [0, 0, 0])), new Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new Vector3(...(node.scale ?? [1, 1, 1])));
    const world = parent.clone().multiply(local);
    for (const primitive of gltf.meshes?.[node.mesh]?.primitives ?? []) {
      const accessor = gltf.accessors?.[primitive.attributes?.POSITION];
      if (!accessor || accessor.type !== "VEC3" || !accessor.min || !accessor.max) throw new Error("GLB position bounds missing");
      const b = { min: vector.parse(accessor.min), max: vector.parse(accessor.max) };
      if (b.min.some((v, i) => v > b.max[i])) throw new Error("GLB bounds invalid");
      corners(b).forEach(p => box.expandByPoint(p.applyMatrix4(world)));
    }
    for (const child of node.children ?? []) visit(child, world, new Set([...path, index]));
  }
  const roots = gltf.scenes?.[gltf.scene ?? 0]?.nodes;
  if (!roots?.length) throw new Error("GLB scene missing");
  for (const index of roots) visit(index, new Matrix4(), new Set());
  if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite) || box.getSize(new Vector3()).toArray().some(n => n <= 0)) throw new Error("GLB bounds invalid");
  return { min: box.min.toArray(), max: box.max.toArray() };
}

// Contact constraints operate on independent reconstructed roots. They do not
// change relative part geometry or claim a metric surface measurement.
export function settleSupportContacts(objects:{id:string;position:[number,number,number];placement:ModelPlacement}[],inputs:CompositionInput[],composition:SceneComposition){
  const done=new Set<string>(),visiting=new Set<string>();
  function settle(id:string){
    if(done.has(id)||visiting.has(id))return;
    visiting.add(id);
    const item=objects.find(o=>o.id===id)!,input=inputs.find(o=>o.id===id)!;
    const explicit = objects.find(o=>o.id===input.supportedById&&o.id!==id);
    if(input.support==="tabletop"||explicit||input.support==="floor") {
      const supports=objects.filter(o=>o.id!==id&&["table","storage","surface"].includes(inputs.find(i=>i.id===o.id)?.category??""));
      const support=explicit??(input.support==="tabletop"?supports.filter(o=>Math.abs(o.position[0]-item.position[0])<=o.placement.size[0]/2&&Math.abs(o.position[2]-item.position[2])<=o.placement.size[2]/2).sort((a,b)=>Math.abs(a.position[1]+a.placement.size[1]-item.position[1])-Math.abs(b.position[1]+b.placement.size[1]-item.position[1]))[0]:undefined);
      if(support)settle(support.id);
      const peers=objects.filter(o=>inputs.find(i=>i.id===o.id)?.support==="tabletop");
      const y=support?support.position[1]+support.placement.size[1]:input.support==="floor"?(composition.floorY??0):Math.min(...peers.map(o=>o.position[1]));
      const delta=y-item.position[1];
      if(Math.abs(delta)<Math.max(2,item.placement.size[1]*4)){
        // Follow the viewing ray so the contact anchor retains its source position.
        const camera=composition.camera.position,t=(y-camera[1])/(item.position[1]-camera[1]);
        if(Number.isFinite(t)&&t>.2&&t<3){item.position[0]=camera[0]+(item.position[0]-camera[0])*t;item.position[2]=camera[2]+(item.position[2]-camera[2])*t;}
        item.position[1]=y;
        if(explicit)for(const axis of [0,2] as const){
          // A depth estimate must not leave a stacked item beyond its support.
          const half=Math.max(0,(explicit.placement.size[axis]-item.placement.size[axis])/2);
          item.position[axis]=Math.max(explicit.position[axis]-half,Math.min(explicit.position[axis]+half,item.position[axis]));
        }
      }
      if(!support&&input.support==="tabletop"&&!composition.warnings.includes("A shared tabletop plane is estimated because its support mesh is unavailable."))composition.warnings.push("A shared tabletop plane is estimated because its support mesh is unavailable.");
    }
    visiting.delete(id);done.add(id);
  }
  for(const o of objects)settle(o.id);
}
