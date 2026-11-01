import { BufferGeometry,BufferAttribute,Matrix4, Quaternion, Vector3 } from "three";
import {completeSurfaceNormals} from "@/lib/scene/smooth-normals";

// Lossless GLB access for quality work. Unlike the photo-bake reader this keeps
// indexed vertices, every primitive, TRS nodes, the bound texCoord set and
// texture roles, so repairs and bakes can be written back without touching
// unrelated data (normal/metal-rough maps, alpha, extras).
export type Gltf = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type GlbDocument = { json: Gltf; views: Buffer[] };
export type Primitive = {
  key: string; mesh: number; primitive: number; node: number; matrix: Matrix4;
  local: Float32Array; positions: Float32Array; indices: Uint32Array; uv: Float32Array | null; texCoord: number;
  normals: Float32Array | null; material: number | null; image: number | null; alphaMode: string;
};
export type TextureRole = "baseColor" | "metallicRoughness" | "normal" | "occlusion" | "emissive" | "unknown";
export type MeshDocument = GlbDocument & { primitives: Primitive[]; roles: Map<number, TextureRole[]>; issues: string[] };

export function decodeGlb(bytes: Buffer): GlbDocument {
  if (bytes.length < 28 || bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2) throw new Error("GLB_INVALID");
  const n = bytes.readUInt32LE(12), json = JSON.parse(bytes.toString("utf8", 20, 20 + n)) as Gltf;
  const binary = bytes.subarray(28 + n, 28 + n + bytes.readUInt32LE(20 + n));
  const views = (json.bufferViews ?? []).map((v: Gltf) => {
    const start = v.byteOffset ?? 0;
    if (v.buffer !== 0 || start + v.byteLength > binary.length) throw new Error("GLB_VIEW_RANGE");
    return Buffer.from(binary.subarray(start, start + v.byteLength));
  });
  return { json, views };
}

const components: Record<number, [number, (b: Buffer, at: number) => number, number]> = {
  5126: [4, (b, at) => b.readFloatLE(at), 1], 5125: [4, (b, at) => b.readUInt32LE(at), 4294967295],
  5123: [2, (b, at) => b.readUInt16LE(at), 65535], 5121: [1, (b, at) => b[at], 255],
  5122: [2, (b, at) => b.readInt16LE(at), 32767], 5120: [1, (b, at) => b.readInt8(at), 127]
};
const widths: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
export function readAccessor(doc: GlbDocument, index: number) {
  const a = doc.json.accessors?.[index];
  if (!a || a.sparse || a.count > 2_000_000) throw new Error("GLB_ACCESSOR_UNSUPPORTED");
  const view = doc.views[a.bufferView], spec = components[a.componentType], width = widths[a.type];
  if (!view || !spec || !width) throw new Error("GLB_ACCESSOR_UNSUPPORTED");
  const [size, read, max] = spec, stride = doc.json.bufferViews[a.bufferView].byteStride ?? size * width, offset = a.byteOffset ?? 0;
  if (a.count && offset + (a.count - 1) * stride + size * width > view.length) throw new Error("GLB_ACCESSOR_RANGE");
  const out = new Float64Array(a.count * width);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < width; k++) {
    const v = read(view, offset + i * stride + k * size);
    out[i * width + k] = a.normalized && a.componentType !== 5126 ? Math.max(v / max, -1) : v;
  }
  return { values: out, width, count: a.count as number };
}

function nodeMatrix(node: Gltf) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix);
  return new Matrix4().compose(new Vector3(...(node.translation ?? [0, 0, 0])), new Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new Vector3(...(node.scale ?? [1, 1, 1])));
}

export function readMesh(bytes: Buffer, root = new Matrix4()): MeshDocument {
  const doc = decodeGlb(bytes), g = doc.json, issues: string[] = [], primitives: Primitive[] = [], roles = new Map<number, TextureRole[]>();
  const role = (texture: Gltf | undefined, value: TextureRole) => {
    if (!texture) return;
    const source = g.textures?.[texture.index]?.source;
    if (source === undefined) return;
    roles.set(source, [...new Set([...(roles.get(source) ?? []), value])]);
    if (texture.extensions?.KHR_texture_transform) issues.push(`TEXTURE_TRANSFORM:${value}`);
  };
  for (const m of g.materials ?? []) {
    role(m.pbrMetallicRoughness?.baseColorTexture, "baseColor"); role(m.pbrMetallicRoughness?.metallicRoughnessTexture, "metallicRoughness");
    role(m.normalTexture, "normal"); role(m.occlusionTexture, "occlusion"); role(m.emissiveTexture, "emissive");
  }
  (g.images ?? []).forEach((_: unknown, i: number) => { if (!roles.has(i)) roles.set(i, ["unknown"]); });
  function visit(index: number, parent: Matrix4, depth: number) {
    if (depth > 60) throw new Error("GLB_DEPTH");
    const node = g.nodes?.[index];
    if (!node) throw new Error("GLB_NODE");
    const world = parent.clone().multiply(nodeMatrix(node));
    for (const [p, prim] of (g.meshes?.[node.mesh]?.primitives ?? []).entries()) {
      if (prim.mode !== undefined && prim.mode !== 4) { issues.push("NON_TRIANGLE_PRIMITIVE"); continue; }
      if (prim.extensions?.KHR_draco_mesh_compression || prim.extensions?.EXT_meshopt_compression) { issues.push("COMPRESSED_PRIMITIVE"); continue; }
      const pos = readAccessor(doc, prim.attributes.POSITION), local = Float32Array.from(pos.values), positions = new Float32Array(local.length), v = new Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromArray(local, i * 3).applyMatrix4(world).toArray(positions, i * 3); }
      const indices = prim.indices === undefined ? Uint32Array.from({ length: pos.count }, (_, i) => i) : Uint32Array.from(readAccessor(doc, prim.indices).values);
      if (indices.length % 3 || indices.some(i => i >= pos.count)) throw new Error("GLB_INDEX_RANGE");
      const material = typeof prim.material === "number" ? prim.material : null, base = material === null ? undefined : g.materials?.[material]?.pbrMetallicRoughness?.baseColorTexture;
      const texCoord = base?.texCoord ?? 0, uvIndex = prim.attributes[`TEXCOORD_${texCoord}`];
      const normal = prim.attributes.NORMAL === undefined ? null : Float32Array.from(readAccessor(doc, prim.attributes.NORMAL).values);
      if (normal) { const n = new Matrix4().copy(world).invert().transpose(), t = new Vector3(); for (let i = 0; i < pos.count; i++) t.fromArray(normal, i * 3).transformDirection(n).toArray(normal, i * 3); }
      primitives.push({ key: `${node.mesh}:${p}`, mesh: node.mesh, primitive: p, node: index, matrix: world, local, positions, indices,
        uv: uvIndex === undefined ? null : Float32Array.from(readAccessor(doc, uvIndex).values), texCoord, normals: normal, material,
        image: base ? g.textures?.[base.index]?.source ?? null : null, alphaMode: material === null ? "OPAQUE" : g.materials[material].alphaMode ?? "OPAQUE" });
    }
    for (const child of node.children ?? []) visit(child, world, depth + 1);
  }
  for (const node of g.scenes?.[g.scene ?? 0]?.nodes ?? []) visit(node, root, 0);
  if (!primitives.length) throw new Error("GLB_NO_TRIANGLES");
  return { ...doc, primitives, roles, issues: [...new Set(issues)] };
}

// Stable content hashes let a bake record exactly which geometry/UVs it targets.
export function geometryDigest(doc: MeshDocument, hash: (b: Buffer) => string) {
  return {
    geometry: hash(Buffer.concat(doc.primitives.flatMap(p => [Buffer.from(p.local.buffer.slice(0)), Buffer.from(p.indices.buffer.slice(0))]))),
    uv: hash(Buffer.concat(doc.primitives.map(p => p.uv ? Buffer.from(p.uv.buffer.slice(0)) : Buffer.alloc(0))))
  };
}

export type GlbEdits = {
  images?: Map<number, { bytes: Buffer; mimeType: string }>;
  primitives?: Map<string, { local?: Float32Array; indices?: Uint32Array }>;
};
// Writes edits as new views/accessors and drops views nothing references, so a
// replaced 2K atlas does not keep the old image as dead weight. Positions get
// fresh min/max; stale tangents are removed; stored normals are recomputed.
export function writeGlb(doc: GlbDocument, edits: GlbEdits) {
  const g = structuredClone(doc.json), views = [...doc.views];
  const addView = (bytes: Buffer, target?: number) => { g.bufferViews.push({ buffer: 0, byteOffset: 0, byteLength: bytes.length, ...(target ? { target } : {}) }); views.push(bytes); return g.bufferViews.length - 1; };
  for (const [image, value] of edits.images ?? []) {
    if (!g.images?.[image]) throw new Error("GLB_IMAGE_MISSING");
    g.images[image] = { ...g.images[image], bufferView: addView(value.bytes), mimeType: value.mimeType };
    delete g.images[image].uri;
  }
  for (const [key, value] of edits.primitives ?? []) {
    const [m, p] = key.split(":").map(Number), prim = g.meshes?.[m]?.primitives?.[p];
    if (!prim) throw new Error("GLB_PRIMITIVE_MISSING");
    if (value.local) {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < value.local.length; i++) { min[i % 3] = Math.min(min[i % 3], value.local[i]); max[i % 3] = Math.max(max[i % 3], value.local[i]); }
      g.accessors.push({ bufferView: addView(Buffer.from(value.local.buffer.slice(0)), 34962), componentType: 5126, count: value.local.length / 3, type: "VEC3", min, max });
      prim.attributes.POSITION = g.accessors.length - 1;
      delete prim.attributes.TANGENT;
    }
    if (value.indices) {
      g.accessors.push({ bufferView: addView(Buffer.from(value.indices.buffer.slice(0)), 34963), componentType: 5125, count: value.indices.length, type: "SCALAR" });
      prim.indices = g.accessors.length - 1;
    }
    if (prim.attributes.NORMAL !== undefined) {
      const local = value.local ?? Float32Array.from(readAccessor({ json: g, views }, prim.attributes.POSITION).values);
      const indices = value.indices ?? (prim.indices===undefined?Uint32Array.from({length:local.length/3},(_,i)=>i):Uint32Array.from(readAccessor({ json: g, views }, prim.indices).values));
      g.accessors.push({ bufferView: addView(Buffer.from(vertexNormals(local, indices).buffer), 34962), componentType: 5126, count: local.length / 3, type: "VEC3" });
      prim.attributes.NORMAL = g.accessors.length - 1;
    }
  }
  return packGlb(g, views);
}
export function vertexNormals(local: Float32Array, indices: Uint32Array) {
  const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(local,3));geometry.setIndex(new BufferAttribute(indices,1));
  const completed=completeSurfaceNormals(geometry),normals=completed.getAttribute("normal"),out=new Float32Array(local.length);
  for(let i=0;i<indices.length;i++){const v=indices[i]*3;out[v]+=normals.getX(i);out[v+1]+=normals.getY(i);out[v+2]+=normals.getZ(i);}
  for(let i=0;i<out.length;i+=3){const length=Math.hypot(out[i],out[i+1],out[i+2])||1;out[i]/=length;out[i+1]/=length;out[i+2]/=length;}
  geometry.dispose();completed.dispose();return out;
}
export function packGlb(g: Gltf, views: Buffer[]) {
  const used = new Set<number>();
  for (const a of g.accessors ?? []) if (a.bufferView !== undefined) used.add(a.bufferView);
  for (const i of g.images ?? []) if (i.bufferView !== undefined) used.add(i.bufferView);
  const order = [...used].sort((a, b) => a - b), remap = new Map(order.map((v, i) => [v, i])), chunks: Buffer[] = [];
  let length = 0;
  g.bufferViews = order.map(v => {
    const pad = (4 - length % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
    const view = { ...g.bufferViews[v], buffer: 0, byteOffset: length };
    chunks.push(views[v]); length += views[v].length; return view;
  });
  for (const a of g.accessors ?? []) if (a.bufferView !== undefined) a.bufferView = remap.get(a.bufferView);
  for (const i of g.images ?? []) if (i.bufferView !== undefined) i.bufferView = remap.get(i.bufferView);
  g.buffers = [{ byteLength: length }];
  const json = Buffer.from(JSON.stringify(g)), jpad = Buffer.alloc((4 - json.length % 4) % 4, 32), bpad = Buffer.alloc((4 - length % 4) % 4);
  const header = Buffer.alloc(20); header.write("glTF"); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + jpad.length + length + bpad.length, 8);
  header.writeUInt32LE(json.length + jpad.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(length + bpad.length); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, jpad, bh, ...chunks, bpad]);
}

// Position-welded topology. UV seams split vertices in exported meshes, so
// connectivity, boundaries and winding are evaluated on welded positions.
export type Topology = { welded: Uint32Array[]; triangleCount: number; areas: Float64Array[]; normals: Float32Array[]; diagonal: number };
export function weld(doc: { primitives: Pick<Primitive, "positions" | "indices">[] }): Topology {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of doc.primitives) for (let i = 0; i < p.positions.length; i++) { min[i % 3] = Math.min(min[i % 3], p.positions[i]); max[i % 3] = Math.max(max[i % 3], p.positions[i]); }
  if (!Number.isFinite(min[0])) { min = [0, 0, 0]; max = [0, 0, 0]; }
  const diagonal = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1, q = diagonal * 1e-5, ids = new Map<string, number>();
  const welded: Uint32Array[] = [], areas: Float64Array[] = [], normals: Float32Array[] = [];
  let triangleCount = 0;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (const p of doc.primitives) {
    const map = new Uint32Array(p.positions.length / 3);
    for (let i = 0; i < map.length; i++) {
      const key = `${Math.round(p.positions[i * 3] / q)},${Math.round(p.positions[i * 3 + 1] / q)},${Math.round(p.positions[i * 3 + 2] / q)}`;
      let id = ids.get(key); if (id === undefined) { id = ids.size; ids.set(key, id); } map[i] = id;
    }
    const w = new Uint32Array(p.indices.length), area = new Float64Array(p.indices.length / 3), normal = new Float32Array(p.indices.length);
    for (let t = 0; t < p.indices.length; t += 3) {
      for (let k = 0; k < 3; k++) w[t + k] = map[p.indices[t + k]];
      a.fromArray(p.positions, p.indices[t] * 3); b.fromArray(p.positions, p.indices[t + 1] * 3); c.fromArray(p.positions, p.indices[t + 2] * 3);
      const n = b.sub(a).cross(c.sub(a)), l = n.length(); area[t / 3] = l / 2; if (l > 0) n.multiplyScalar(1 / l); n.toArray(normal, t);
    }
    welded.push(w); areas.push(area); normals.push(normal); triangleCount += area.length;
  }
  return { welded, triangleCount, areas, normals, diagonal };
}
