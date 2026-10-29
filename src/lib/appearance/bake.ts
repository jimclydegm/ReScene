import sharp from "sharp";
import { Matrix4, PerspectiveCamera, Vector3 } from "three";

export type PixelImage = { data: Uint8Array; width: number; height: number };
export type Triangle = { points: [Vector3, Vector3, Vector3]; uv: [number[], number[], number[]]; image: number; object: number };
export function readGlb(bytes: Buffer) {
  const n = bytes.readUInt32LE(12);
  return { json: JSON.parse(bytes.toString("utf8", 20, 20 + n)), binary: bytes.subarray(n + 28) };
}
export function geometry(bytes: Buffer, root: Matrix4, object: number) {
  const { json: g, binary } = readGlb(bytes);
  const read = (index: number) => {
    const a = g.accessors[index], view = g.bufferViews[a?.bufferView];
    if (!view || a.sparse || a.count > 1_000_000) throw new Error("Unsupported mesh accessor");
    const count = a.type === "VEC3" ? 3 : a.type === "VEC2" ? 2 : 1;
    const sizes: Record<number, number> = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 };
    const size = sizes[a.componentType];
    if (!size) throw new Error("Unsupported mesh component");
    const stride = view.byteStride ?? size * count, offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    if (offset + (a.count - 1) * stride + count * size > binary.length) throw new Error("Mesh accessor out of bounds");
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: count }, (_, k) => {
      const at = offset + i * stride + k * size;
      return a.componentType === 5126 ? binary.readFloatLE(at) : a.componentType === 5125 ? binary.readUInt32LE(at) : a.componentType === 5123 ? binary.readUInt16LE(at) : binary[at];
    }));
  };
  const triangles: Triangle[] = [];
  function visit(index: number, parent: Matrix4, depth = 0) {
    if (depth > 60 || triangles.length > 100_000) throw new Error("Mesh complexity limit");
    const node = g.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4();
    if (!node.matrix && (node.rotation || node.scale || node.translation)) throw new Error("Unsupported node transform");
    const world = parent.clone().multiply(local);
    for (const p of g.meshes?.[node.mesh]?.primitives ?? []) {
      if (p.mode !== undefined && p.mode !== 4) throw new Error("Triangle mesh required");
      const positions = read(p.attributes.POSITION), uv = read(p.attributes.TEXCOORD_0);
      const indices = p.indices === undefined ? positions.map((_, i) => [i]) : read(p.indices);
      const image = g.textures?.[g.materials?.[p.material]?.pbrMetallicRoughness?.baseColorTexture?.index]?.source;
      if (image === undefined) throw new Error("Embedded texture required");
      for (let i = 0; i < indices.length; i += 3) {
        const ids = [indices[i][0], indices[i + 1][0], indices[i + 2][0]];
        if (triangles.length >= 100_000) throw new Error("Mesh complexity limit");
        triangles.push({ object, image, points: ids.map(id => new Vector3(...positions[id] as [number, number, number]).applyMatrix4(world)) as Triangle["points"], uv: ids.map(id => uv[id]) as Triangle["uv"] });
      }
    }
    for (const child of node.children ?? []) visit(child, world, depth + 1);
  }
  for (const node of g.scenes[g.scene ?? 0].nodes) visit(node, root);
  return triangles;
}
export function photoCamera(value: { position: number[]; target: number[]; fov: number; aspect: number }) {
  const c = new PerspectiveCamera(value.fov, value.aspect, 0.01, 200);
  c.position.fromArray(value.position); c.lookAt(new Vector3(...value.target as [number, number, number])); c.updateMatrixWorld();
  return c;
}
function raster(points: number[][], width: number, height: number, sample: (x: number, y: number, a: number, b: number, c: number) => void) {
  const [[ax, ay], [bx, by], [cx, cy]] = points;
  const area = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(area) < 1e-8 || !points.flat().every(Number.isFinite)) return;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const a = ((by - cy) * (x + 0.5 - cx) + (cx - bx) * (y + 0.5 - cy)) / area;
    const b = ((cy - ay) * (x + 0.5 - cx) + (ax - cx) * (y + 0.5 - cy)) / area;
    const c = 1 - a - b;
    if (a >= -1e-6 && b >= -1e-6 && c >= -1e-6) sample(x, y, a, b, c);
  }
}
export function visibility(triangles: Triangle[], camera: PerspectiveCamera, width: number, height: number) {
  const depth = new Float32Array(width * height).fill(Infinity);
  const owners = new Int16Array(width * height).fill(-1);
  for (const t of triangles) {
    const screen = t.points.map(p => { const v = p.clone().project(camera); return [(v.x + 1) * width / 2, (1 - v.y) * height / 2]; });
    const z = t.points.map(p => -p.clone().applyMatrix4(camera.matrixWorldInverse).z);
    if (z.some(v => v <= 0)) continue;
    raster(screen, width, height, (x, y, a, b, c) => {
      const d = 1 / (a / z[0] + b / z[1] + c / z[2]), i = y * width + x;
      if (d < depth[i]) { depth[i] = d; owners[i] = t.object; }
    });
  }
  return { depth, owners };
}
export type PhotoRegistration={scaleX:number;scaleY:number;offsetX:number;offsetY:number};
export function transferPixels(triangles: Triangle[], imageIndex: number, texture: PixelImage, photo: PixelImage, mask: Uint8Array,
  camera: PerspectiveCamera, visible: ReturnType<typeof visibility>, registration:PhotoRegistration={scaleX:1,scaleY:1,offsetX:0,offsetY:0}) {
  const output = Buffer.from(texture.data), weights = new Float32Array(texture.width * texture.height);
  const w = photo.width, h = photo.height;
  let copied = 0;
  for (const t of triangles.filter(t => t.image === imageIndex)) {
    const normal = t.points[1].clone().sub(t.points[0]).cross(t.points[2].clone().sub(t.points[0])).normalize();
    const center = t.points[0].clone().add(t.points[1]).add(t.points[2]).multiplyScalar(1 / 3);
    const facing = normal.dot(camera.position.clone().sub(center).normalize());
    if (facing < 0.18) continue;
    const uv = t.uv.map(v => [v[0] * texture.width, v[1] * texture.height]);
    raster(uv, texture.width, texture.height, (x, y, a, b, c) => {
      const p = t.points[0].clone().multiplyScalar(a).addScaledVector(t.points[1], b).addScaledVector(t.points[2], c);
      const d = -p.clone().applyMatrix4(camera.matrixWorldInverse).z, projected = p.project(camera);
      const ox=(projected.x+1)*w/2,oy=(1-projected.y)*h/2;
      const sx=ox*registration.scaleX+registration.offsetX,sy=oy*registration.scaleY+registration.offsetY,px=Math.floor(sx),py=Math.floor(sy);
      if (d <= 0 || px < 3 || py < 3 || px >= w - 3 || py >= h - 3) return;
      const at = py * w + px;
      const originalAt=Math.floor(oy)*w+Math.floor(ox);
      if (ox<0||oy<0||ox>=w||oy>=h||visible.owners[originalAt] !== t.object || Math.abs(visible.depth[originalAt] - d) > Math.max(0.015, d * 0.006)) return;
      if ([at, at - 2, at + 2, at - 2 * w, at + 2 * w].some(i => mask[i] < 200)) return;
      const weight = Math.min(1, (facing - 0.18) / 0.1), index = y * texture.width + x;
      if (weight <= weights[index]) return;
      if (!weights[index]) copied++;
      weights[index] = weight;
      const fx = sx - px, fy = sy - py;
      for (let k = 0; k < 3; k++) {
        const top = photo.data[at * 3 + k] * (1 - fx) + photo.data[(at + 1) * 3 + k] * fx;
        const bottom = photo.data[(at + w) * 3 + k] * (1 - fx) + photo.data[(at + w + 1) * 3 + k] * fx;
        output[index * 3 + k] = Math.round((top * (1 - fy) + bottom * fy) * weight + texture.data[index * 3 + k] * (1 - weight));
      }
    });
  }
  return { data: output, copied, fraction: copied / (texture.width * texture.height) };
}
export async function bakeGlb(bytes: Buffer, triangles: Triangle[], photo: PixelImage, mask: Uint8Array, camera: PerspectiveCamera, depth: ReturnType<typeof visibility>,registration?:PhotoRegistration) {
  const { json: g, binary } = readGlb(bytes);
  const chunks: Buffer[] = [binary]; let length = binary.length, copied = 0;
  for (const [i, image] of g.images.entries()) {
    const v = g.bufferViews[image.bufferView];
    const raw = await sharp(binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)).resize(2048,2048,{fit:"inside",withoutEnlargement:false,kernel:"lanczos3"}).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
    if (raw.info.width > 2048 || raw.info.height > 2048) throw new Error("Texture size exceeds bake limit");
    const result = transferPixels(triangles, i, { data: raw.data, width: raw.info.width, height: raw.info.height }, photo, mask, camera, depth,registration);
    copied += result.copied;
    const png = await sharp(result.data, { raw: { width: raw.info.width, height: raw.info.height, channels: 3 } }).png().toBuffer();
    const padding = Buffer.alloc((4 - length % 4) % 4); chunks.push(padding); length += padding.length;
    image.bufferView = g.bufferViews.length; image.mimeType = "image/png";
    g.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: png.length }); chunks.push(png); length += png.length;
  }
  if (copied < 200) throw new Error("Not enough aligned photo pixels to improve this mesh");
  g.buffers[0].byteLength = length;
  const json = Buffer.from(JSON.stringify(g)), jpad = Buffer.alloc((4 - json.length % 4) % 4, 32), bpad = Buffer.alloc((4 - length % 4) % 4);
  const header = Buffer.alloc(20); header.write("glTF"); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + jpad.length + length + bpad.length, 8);
  header.writeUInt32LE(json.length + jpad.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(length + bpad.length); bh.writeUInt32LE(0x004e4942, 4);
  return { bytes: Buffer.concat([header, json, jpad, bh, ...chunks, bpad]), copied };
}
export async function cleanPatch(photo: PixelImage, masks: Uint8Array[], surface: "floor" | "wall") {
  const width = Math.min(384, Math.floor(photo.width / 3)), height = Math.min(96, Math.floor(photo.height * 0.09));
  const top = surface === "floor" ? photo.height - height - 4 : 4;
  let best = -1, bestCount = Infinity;
  for (let left = 4; left + width < photo.width; left += 32) {
    let count = 0;
    for (let y = top; y < top + height; y += 2) for (let x = left; x < left + width; x += 2) if (masks.some(m => m[y * photo.width + x] > 0)) count++;
    if (count < bestCount) { bestCount = count; best = left; }
  }
  if (best < 0 || bestCount > 0) throw new Error(`No clean ${surface} patch; keep the existing surface`);
  return sharp(Buffer.from(photo.data), { raw: { width: photo.width, height: photo.height, channels: 3 } }).extract({ left: best, top, width, height }).png().toBuffer();
}

// Bounded per-object silhouette registration compensates modest pose/camera drift.
// It does not OCR or invent lettering; pixels are sampled from the uploaded image.
export function registerPhoto(triangles:Triangle[],camera:PerspectiveCamera,mask:Uint8Array,size:{width:number;height:number}):PhotoRegistration{
  const identity={scaleX:1,scaleY:1,offsetX:0,offsetY:0};
  let x0=size.width,y0=size.height,x1=0,y1=0;
  for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++)if(mask[y*size.width+x]>127){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const triangle of triangles)for(const point of triangle.points){const p=point.clone().project(camera),x=(p.x+1)*size.width/2,y=(1-p.y)*size.height/2;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  const scaleX=(x1-x0)/(maxX-minX),scaleY=(y1-y0)/(maxY-minY),offsetX=x0-minX*scaleX,offsetY=y0-minY*scaleY;
  if(![scaleX,scaleY,offsetX,offsetY].every(Number.isFinite)||scaleX<.7||scaleX>1.3||scaleY<.7||scaleY>1.3||Math.abs(offsetX)>size.width*.15||Math.abs(offsetY)>size.height*.15)return identity;
  return {scaleX,scaleY,offsetX,offsetY};
}
