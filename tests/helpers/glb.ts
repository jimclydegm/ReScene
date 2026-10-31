import type { BufferGeometry } from "three";

// Minimal embedded GLB from a three geometry plus an RGBA base-color image.
export function buildGlb(geometry: BufferGeometry, options: { image?: { data: Uint8Array; width: number; height: number }; png?: Buffer; normals?: boolean; node?: Record<string, unknown>; alpha?: boolean; dataMap?: Buffer } = {}) {
  const positions = new Float32Array(geometry.attributes.position.array), uv = geometry.attributes.uv ? new Float32Array(geometry.attributes.uv.array) : null;
  const indices = geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
  const parts: Buffer[] = [Buffer.from(positions.buffer)], views: Record<string, unknown>[] = [], accessors: Record<string, unknown>[] = [];
  const attributes: Record<string, number> = { POSITION: 0 };
  accessors.push({ bufferView: 0, componentType: 5126, count: positions.length / 3, type: "VEC3" });
  if (uv) { parts.push(Buffer.from(uv.buffer)); accessors.push({ bufferView: parts.length - 1, componentType: 5126, count: uv.length / 2, type: "VEC2" }); attributes.TEXCOORD_0 = accessors.length - 1; }
  if (options.normals) { const n = new Float32Array(geometry.attributes.normal.array); parts.push(Buffer.from(n.buffer)); accessors.push({ bufferView: parts.length - 1, componentType: 5126, count: n.length / 3, type: "VEC3" }); attributes.NORMAL = accessors.length - 1; }
  parts.push(Buffer.from(indices.buffer)); accessors.push({ bufferView: parts.length - 1, componentType: 5125, count: indices.length, type: "SCALAR" });
  const indexAccessor = accessors.length - 1, images: Record<string, unknown>[] = [], textures: Record<string, unknown>[] = [];
  if (options.png) { parts.push(options.png); images.push({ bufferView: parts.length - 1, mimeType: "image/png" }); textures.push({ source: 0 }); }
  if (options.dataMap) { parts.push(options.dataMap); images.push({ bufferView: parts.length - 1, mimeType: "image/png" }); textures.push({ source: images.length - 1 }); }
  let offset = 0;
  for (const p of parts) { const pad = (4 - offset % 4) % 4; offset += pad; views.push({ buffer: 0, byteOffset: offset, byteLength: p.length }); offset += p.length; }
  const binary = Buffer.alloc(offset); parts.forEach((p, i) => p.copy(binary, views[i].byteOffset as number));
  const material: Record<string, unknown> = { pbrMetallicRoughness: { ...(options.png ? { baseColorTexture: { index: 0 } } : {}), ...(options.dataMap ? { metallicRoughnessTexture: { index: textures.length - 1 } } : {}), roughnessFactor: 1 }, ...(options.alpha ? { alphaMode: "BLEND" } : {}) };
  const g = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, ...options.node }], meshes: [{ primitives: [{ attributes, indices: indexAccessor, material: 0 }] }],
    materials: [material], textures, images, buffers: [{ byteLength: binary.length }], bufferViews: views, accessors };
  const json = Buffer.from(JSON.stringify(g)), pad = Buffer.alloc((4 - json.length % 4) % 4, 32), header = Buffer.alloc(20), bh = Buffer.alloc(8);
  header.write("glTF"); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + pad.length + binary.length, 8); header.writeUInt32LE(json.length + pad.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  bh.writeUInt32LE(binary.length); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, pad, bh, binary]);
}
