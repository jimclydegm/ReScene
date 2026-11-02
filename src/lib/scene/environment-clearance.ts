import { Matrix3, Vector3 } from "three";
import { backgroundCamera, backgroundSurfaces } from "./background";
import { materialSurfaceGeometry } from "./material-background";
import type { SceneComposition } from "./composition";
import type { EnvironmentGeometry } from "./environment-plan";

type Surface = EnvironmentGeometry["surfaces"][number];
export type Boundary = {
  index: number;
  role: Surface["role"];
  normal: Vector3;
  constant: number;
  triangles: [Vector3, Vector3, Vector3][];
};
/** Read the triangles actually rendered, not vertex order (which contains holes
 * and extension vertices). Normals point into the photographed environment. */
export function environmentBoundaries(composition: SceneComposition): Boundary[] {
  if (composition.backdrop === "none") return [];
  const eye = new Vector3(...composition.camera.position);
  const surfaces = composition.background?.geometry?.surfaces ?? fallbackSurfaces(composition);
  return surfaces.flatMap((s, index) => {
    if (s.role === "trim") return [];
    if (composition.backdrop === "studio" && s.role !== "floor" && s.role !== "surface") return [];
    const triangles: Boundary["triangles"] = [];
    for (let i = 0; i < s.triangles.length; i += 3) {
      const t = s.triangles.slice(i, i + 3).map(k => new Vector3(...s.vertices[k])) as [Vector3, Vector3, Vector3];
      if (t[1].clone().sub(t[0]).cross(t[2].clone().sub(t[0])).lengthSq() > 1e-16) triangles.push(t);
    }
    if (!triangles.length) return [];
    const [a, b, c] = triangles[0], normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (s.role === "floor" || s.role === "surface") {
      if (normal.y < 0) normal.negate();
    } else if (normal.dot(eye.clone().sub(a)) < 0) normal.negate();
    return [{ index, role: s.role, normal, constant: normal.dot(a), triangles }];
  });
}
function fallbackSurfaces(composition: SceneComposition): Surface[] {
  const plan = composition.background;
  if (!plan) return [];
  const layout = materialSurfaceGeometry(composition, composition.floorY ?? 0),
    surface = (role: Surface["role"], vertices: Surface["vertices"]): Surface => ({role,vertices,triangles:[0,1,2,0,2,3],color:"#ffffff",roughness:1,textured:false}),
    floor = composition.floorY ?? 0, e = layout.extent;
  const surfaces = plan.groundVisible ? [surface("floor",[[-e,floor,-e],[e,floor,-e],[e,floor,e],[-e,floor,e]])] : [];
  const walls = plan.surfaceMode === "materials" ? layout.walls : [backgroundSurfaces(composition,floor).wall].filter((w):w is NonNullable<typeof w> => !!w);
  for (const wall of walls) {
    const center = new Vector3(...wall.position), u = new Vector3(Math.cos(wall.yaw),0,-Math.sin(wall.yaw)).multiplyScalar(wall.width/2), v = new Vector3(0,wall.height/2,0);
    surfaces.push(surface("wall",[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => center.clone().addScaledVector(u,x).addScaledVector(v,y).toArray() as [number,number,number])));
  }
  if (plan.surfaceMode === "materials" && layout.curve) {
    const rear = new Vector3(...layout.rear), forward = new Vector3(...composition.camera.target).sub(new Vector3(...composition.camera.position)).setY(0).normalize(), u = new Vector3(-forward.z,0,forward.x).multiplyScalar(e);
    surfaces.push(surface("wall",[rear.clone().sub(u).toArray(),rear.clone().add(u).toArray(),rear.clone().add(u).add(new Vector3(0,e,0)).toArray(),rear.clone().sub(u).add(new Vector3(0,e,0)).toArray()] as Surface["vertices"]));
  }
  return surfaces;
}
function projectedInside(p: Vector3, [a, b, c]: Boundary["triangles"][number]) {
  const u = b.clone().sub(a), v = c.clone().sub(a), w = p.clone().sub(a),
    uu = u.dot(u), vv = v.dot(v), uv = u.dot(v), det = uu * vv - uv * uv;
  if (det < 1e-18) return false;
  const x = (w.dot(u) * vv - w.dot(v) * uv) / det,
    y = (w.dot(v) * uu - w.dot(u) * uv) / det;
  return x >= -1e-7 && y >= -1e-7 && x + y <= 1 + 1e-7;
}
export function boundaryPenetration(points: Vector3[], boundary: Boundary) {
  let depth = 0;
  for (const p of points) {
    const d = boundary.normal.dot(p) - boundary.constant;
    if (d < -depth && boundary.triangles.some(t => projectedInside(p, t))) depth = -d;
  }
  return depth;
}
export function backgroundPenetration(points: Vector3[], composition: SceneComposition) {
  return environmentBoundaries(composition).map(b => ({ index: b.index, role: b.role, depth: boundaryPenetration(points, b) }));
}
export type ClearanceObject = { id: string; points: Vector3[]; support?: string };
/** A dominant tabletop supported by independently coplanar product bases must
 * share that level support gauge. Neural depth can otherwise tilt it through
 * the products. Sloped structures with non-coplanar contacts are retained. */
export function levelBackgroundSupports(composition: SceneComposition, objects: ClearanceObject[]) {
  const next=structuredClone(composition),surfaces=next.background?.geometry?.surfaces,changes:number[]=[];
  if(!surfaces||objects.length<3)return {composition:next,changes};
  const bases=objects.filter(o=>!/wall|ceiling|hang|float/i.test(o.support??"")).map(o=>({
    y:o.points.reduce((m,p)=>Math.min(m,p.y),Infinity),
    height:o.points.reduce((m,p)=>Math.max(m,p.y),-Infinity)-o.points.reduce((m,p)=>Math.min(m,p.y),Infinity),
  })), floor=next.floorY??0;
  if(bases.length<3||bases.some(b=>!Number.isFinite(b.y)||Math.abs(b.y-floor)>Math.max(.025,b.height*.03)))return {composition:next,changes};
  const boundaries=environmentBoundaries(next), replacements=new Map<string,[number,number,number]>();
  for(const b of boundaries){
    if(b.role!=="surface"||b.normal.y<.35||b.normal.y>=.98)continue;
    const surface=surfaces[b.index];
    // Require an actual intersection with the coplanar foreground cohort.
    if(objects.filter(o=>boundaryPenetration(o.points,b)>.01).length<2)continue;
    for(const v of surface.vertices)replacements.set(v.join(","),[v[0],floor,v[2]]);
    surface.vertices=surface.vertices.map(v=>[v[0],floor,v[2]]);
    if(surface.tile){surface.tile.origin[1]=floor;for(const axis of ["u","v"] as const){const a=new Vector3(...surface.tile[axis]),length=a.length();a.setY(0);if(a.length()>.0001)surface.tile[axis]=a.normalize().multiplyScalar(length).toArray() as [number,number,number];}}
    changes.push(b.index);
  }
  for(const surface of surfaces)surface.vertices=surface.vertices.map(v=>replacements.get(v.join(","))??v);
  return {composition:next,changes};
}
/** Only lift a base intersecting a rendered horizontal support. Suspended
 * objects retain their pose; this never drops an object onto a guessed floor. */
export function backgroundSupportLift(points: Vector3[], composition: SceneComposition, support = "unknown") {
  if (/wall|ceiling|hang|float/i.test(support)) return 0;
  let lift = 0;
  for (const b of environmentBoundaries(composition)) {
    if ((b.role !== "floor" && b.role !== "surface") || b.normal.y < .98) continue;
    lift = Math.max(lift, boundaryPenetration(points, b) / b.normal.y);
  }
  return lift > .0001 ? lift : 0;
}
function planePoint(p: Vector3, planes: { normal: Vector3; constant: number }[]) {
  const unique = planes.filter((a, i) => planes.findIndex(b => Math.abs(a.normal.dot(b.normal)) > .9999) === i).slice(0, 3);
  const rhs = unique.map(b => b.constant - b.normal.dot(p));
  if (unique.length === 1) return p.clone().addScaledVector(unique[0].normal, rhs[0]);
  if (unique.length === 2) {
    const [a, b] = unique, dot = a.normal.dot(b.normal), det = 1 - dot * dot;
    return p.clone().addScaledVector(a.normal, (rhs[0] - dot * rhs[1]) / det).addScaledVector(b.normal, (rhs[1] - dot * rhs[0]) / det);
  }
  if (unique.length === 3) {
    const [a,b,c] = unique.map(b => b.normal), m = new Matrix3().set(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
    if (Math.abs(m.determinant()) > 1e-8) return p.clone().add(new Vector3(...rhs as [number,number,number]).applyMatrix3(m.invert()));
  }
  return p.clone();
}
/** Expand uncertain background depth around the final foreground, rather than
 * moving products through their neighbors or vetoing safety on silhouette IoU.
 * Shared corners, trim/window planes and material coordinates move together. */
export function fitBackgroundClearance(composition: SceneComposition, objects: ClearanceObject[]) {
  const next = structuredClone(composition), surfaces = next.background?.geometry?.surfaces;
  if (!objects.length) return { composition: next, changes: [] as { surface: number; distance: number }[] };
  if (!surfaces) {
    const plan = next.background;
    if (plan?.surfaceMode === "materials" && materialSurfaceGeometry(next,next.floorY??0).curve) {
      const forward = new Vector3(...next.camera.target).sub(new Vector3(...next.camera.position)).setY(0).normalize(), target = new Vector3(...next.camera.target), layout = materialSurfaceGeometry(next,next.floorY??0),
        current = new Vector3(...layout.rear).sub(target).dot(forward),
        wanted = objects.reduce((d,o) => o.points.reduce((d,p) => Math.max(d,p.clone().sub(target).dot(forward)+.01),d),current);
      if (wanted > current+.0001) { plan.spatial={rearDistance:wanted,curveRadius:layout.radius,confidence:plan.spatial?.confidence??.25,source:plan.spatial?.source??"subject-relative-fallback"}; return {composition:next,changes:[{surface:-1,distance:wanted-current}]}; }
    }
    if (plan) {
      const walls=environmentBoundaries(next).filter(b=>b.role==="wall"),changes:{surface:number;distance:number}[]=[];
      const offsets=walls.map((b,i)=>{const depth=objects.reduce((d,o)=>Math.max(d,boundaryPenetration(o.points,b)),0),distance=depth>.0001?depth+.01:0;if(distance)changes.push({surface:b.index,distance});return (plan.wallOffsets?.[i]??0)+distance;});
      if(changes.length)plan.wallOffsets=offsets;
      return {composition:next,changes};
    }
    return {composition:next,changes:[]};
  }
  const boundaries = environmentBoundaries(composition), points = objects.flatMap(o => o.points),
    extent = points.length ? points.reduce((b,p) => b.max(p), points[0].clone()).sub(points.reduce((b,p) => b.min(p), points[0].clone())).length() : 1,
    margin = Math.max(.005, Math.min(.03, extent * .001)), shifts = new Map<number, number>();
  for (const b of boundaries) {
    if (b.role === "floor" || b.role === "surface") continue;
    const depth = boundaryPenetration(points, b);
    if (depth > .0001) shifts.set(b.index, depth + margin);
  }
  // A photographed opening/backing and trim belong to their parent wall.
  const parents = new Map<number, number>();
  for (const [i,s] of surfaces.entries()) {
    if (s.role !== "trim" && s.role !== "window" && s.role !== "opening") continue;
    const parent = boundaries.find(b => b.role === "wall" &&
      (s.materialIndex === undefined || surfaces[b.index].materialIndex === s.materialIndex) &&
      s.vertices.every(v => Math.abs(b.normal.dot(new Vector3(...v)) - b.constant) < .08));
    if (parent) { parents.set(i,parent.index); shifts.set(parent.index, Math.max(shifts.get(parent.index) ?? 0, shifts.get(i) ?? 0)); shifts.delete(i); }
  }
  for (const a of boundaries.filter(b => b.role === "wall"))
    for (const b of boundaries.filter(b => b.role === "wall"))
      if (a.normal.dot(b.normal) > .9999 && Math.abs(a.constant-b.constant) < .01) {
        const shift = Math.max(shifts.get(a.index) ?? 0, shifts.get(b.index) ?? 0);
        if (shift > 0) { shifts.set(a.index,shift); shifts.set(b.index,shift); }
      }
  const changes = [...shifts].filter(([,distance]) => distance > 0).map(([surface,distance]) => ({surface,distance}));
  if (!changes.length) return { composition: next, changes };
  const camera = backgroundCamera(composition.camera);
  for (const [i,s] of surfaces.entries()) {
    const own = boundaries.find(b => b.index === (parents.get(i) ?? i));
    if (!own) continue;
    const ownShift = shifts.get(own.index) ?? 0;
    const move = (v: [number,number,number]) => {
      const p = new Vector3(...v), memberships = [own, ...boundaries.filter(b =>
        b.index !== own.index && Math.abs(b.normal.dot(p)-b.constant) < 1e-5)];
      // Keep the original inset of windows/baseboards relative to their wall.
      const planes = memberships.map(b => ({normal:b.normal,constant:b.constant-(shifts.get(b.index)??0)+(b.index===own.index?own.normal.dot(p)-own.constant:0)}));
      return planePoint(p,planes).toArray() as [number,number,number];
    };
    const vertices = s.vertices.map(move);
    if ((s.role === "window" || s.role === "opening") && ownShift > 0 && !s.photoUv)
      s.photoUv = s.vertices.map(v => { const p = new Vector3(...v).project(camera); return [p.x*.5+.5,p.y*.5+.5]; });
    s.vertices = vertices;
    if (s.tile) s.tile.origin = move(s.tile.origin);
  }
  return { composition: next, changes };
}
