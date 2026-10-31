import { Box3, Matrix4, PerspectiveCamera, Vector3 } from "three";
import type { MeshDocument } from "./mesh";

// Deterministic CPU views for owner-private inspection and numeric review. These
// are evidence renders (wireframe, normals, unlit albedo, neutral light), not a
// replacement for the browser renderer.
export type PixelImage4 = { data: Uint8Array; width: number; height: number };
export type RenderMesh = { object: number; points: Float32Array; uv: Float32Array; normals: Float32Array; images: Int32Array; textures: Map<number, PixelImage4> };
export type RenderMode = "wireframe" | "normals" | "unlit" | "neutral" | "depth";

export function renderMesh(doc: MeshDocument, matrix: Matrix4, object: number, textures: Map<number, PixelImage4> = new Map()): RenderMesh {
  const count = doc.primitives.reduce((s, p) => s + p.indices.length / 3, 0);
  const points = new Float32Array(count * 9), uv = new Float32Array(count * 6), normals = new Float32Array(count * 3), images = new Int32Array(count).fill(-1);
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  let t = 0;
  for (const p of doc.primitives) for (let i = 0; i < p.indices.length; i += 3, t++) {
    a.fromArray(p.positions, p.indices[i] * 3).applyMatrix4(matrix); b.fromArray(p.positions, p.indices[i + 1] * 3).applyMatrix4(matrix); c.fromArray(p.positions, p.indices[i + 2] * 3).applyMatrix4(matrix);
    a.toArray(points, t * 9); b.toArray(points, t * 9 + 3); c.toArray(points, t * 9 + 6);
    b.sub(a).cross(c.sub(a)).normalize().toArray(normals, t * 3);
    for (let k = 0; k < 3; k++) { uv[t * 6 + k * 2] = p.uv?.[p.indices[i + k] * 2] ?? 0; uv[t * 6 + k * 2 + 1] = p.uv?.[p.indices[i + k] * 2 + 1] ?? 0; }
    images[t] = p.image ?? -1;
  }
  return { object, points, uv, normals, images, textures };
}

export function boundsOf(meshes: RenderMesh[]) {
  const box = new Box3(), v = new Vector3();
  for (const m of meshes) for (let i = 0; i < m.points.length; i += 3) box.expandByPoint(v.fromArray(m.points, i));
  return box;
}
// Four sides plus top and underside so hidden-region appearance is inspected too.
export function orbitCameras(box: Box3, aspect = 1) {
  const center = box.getCenter(new Vector3()), radius = Math.max(box.getSize(new Vector3()).length() / 2, 1e-3), distance = radius / Math.sin((32 / 2) * Math.PI / 180) * 1.08;
  const views: [string, number, number][] = [["front", 0, 18], ["right", 90, 18], ["back", 180, 18], ["left", 270, 18], ["top", 0, 82], ["underside", 0, -70]];
  return views.map(([name, azimuth, elevation]) => {
    const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180, camera = new PerspectiveCamera(32, aspect, distance / 50, distance * 4);
    camera.position.set(center.x + Math.sin(az) * Math.cos(el) * distance, center.y + Math.sin(el) * distance, center.z + Math.cos(az) * Math.cos(el) * distance);
    if (Math.abs(elevation) > 80) camera.up.set(0, 0, -1);
    camera.lookAt(center); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    return { name, camera };
  });
}

function sample(image: PixelImage4, u: number, v: number, out: number[]) {
  const x = ((u % 1) + 1) % 1 * image.width - .5, y = ((v % 1) + 1) % 1 * image.height - .5;
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x))), y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.min(image.width - 1, x0 + 1), y1 = Math.min(image.height - 1, y0 + 1), fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
  for (let k = 0; k < 3; k++) {
    const top = image.data[(y0 * image.width + x0) * 4 + k] * (1 - fx) + image.data[(y0 * image.width + x1) * 4 + k] * fx;
    const bottom = image.data[(y1 * image.width + x0) * 4 + k] * (1 - fx) + image.data[(y1 * image.width + x1) * 4 + k] * fx;
    out[k] = top * (1 - fy) + bottom * fy;
  }
  return out;
}

export function render(meshes: RenderMesh[], camera: PerspectiveCamera, width: number, height: number, mode: RenderMode, background: [number, number, number] = [236, 236, 233]) {
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const clip = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements, view = camera.matrixWorldInverse.elements;
  const rgb = new Uint8Array(width * height * 3), depth = new Float32Array(width * height).fill(Infinity), owners = new Int16Array(width * height).fill(-1);
  for (let i = 0; i < width * height; i++) rgb.set(background, i * 3);
  const project = (m: RenderMesh, at: number) => {
    const x = m.points[at], y = m.points[at + 1], z = m.points[at + 2], w = clip[3] * x + clip[7] * y + clip[11] * z + clip[15];
    return [((clip[0] * x + clip[4] * y + clip[8] * z + clip[12]) / w + 1) * width / 2, (1 - (clip[1] * x + clip[5] * y + clip[9] * z + clip[13]) / w) * height / 2, -(view[2] * x + view[6] * y + view[10] * z + view[14])];
  };
  const keys = [new Vector3(.45, 1, .6).normalize(), new Vector3(-.6, .35, -.4).normalize()], color = [0, 0, 0], eye = camera.position;
  for (const m of meshes) for (let t = 0; t < m.images.length; t++) {
    const [p0, p1, p2] = [project(m, t * 9), project(m, t * 9 + 3), project(m, t * 9 + 6)];
    if (p0[2] <= 1e-4 || p1[2] <= 1e-4 || p2[2] <= 1e-4) continue;
    const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
    if (Math.abs(area) < 1e-9) continue;
    let nx = m.normals[t * 3], ny = m.normals[t * 3 + 1], nz = m.normals[t * 3 + 2];
    // Double-sided inspection: shade the side facing the camera.
    if (nx * (eye.x - m.points[t * 9]) + ny * (eye.y - m.points[t * 9 + 1]) + nz * (eye.z - m.points[t * 9 + 2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const light = .32 + .55 * Math.max(0, nx * keys[0].x + ny * keys[0].y + nz * keys[0].z) + .22 * Math.max(0, nx * keys[1].x + ny * keys[1].y + nz * keys[1].z);
    const texture = m.textures.get(m.images[t]);
    const x0 = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]))), x1 = Math.min(width - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
    const y0 = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), y1 = Math.min(height - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const w0 = ((p1[0] - px) * (p2[1] - py) - (p2[0] - px) * (p1[1] - py)) / area, w1 = ((p2[0] - px) * (p0[1] - py) - (p0[0] - px) * (p2[1] - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const inv = w0 / p0[2] + w1 / p1[2] + w2 / p2[2], d = 1 / inv, i = y * width + x;
      if (d >= depth[i]) continue;
      depth[i] = d; owners[i] = m.object;
      if (mode === "depth") continue;
      if (mode === "normals") { rgb[i * 3] = (nx * .5 + .5) * 255; rgb[i * 3 + 1] = (ny * .5 + .5) * 255; rgb[i * 3 + 2] = (nz * .5 + .5) * 255; continue; }
      if (mode === "wireframe") { const g = 120 + light * 90; rgb[i * 3] = g; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = g; continue; }
      if (texture) {
        const u = (w0 * m.uv[t * 6] / p0[2] + w1 * m.uv[t * 6 + 2] / p1[2] + w2 * m.uv[t * 6 + 4] / p2[2]) * d, v = (w0 * m.uv[t * 6 + 1] / p0[2] + w1 * m.uv[t * 6 + 3] / p1[2] + w2 * m.uv[t * 6 + 5] / p2[2]) * d;
        sample(texture, u, v, color);
      } else color.fill(200);
      const s = mode === "neutral" ? light : 1;
      for (let k = 0; k < 3; k++) rgb[i * 3 + k] = Math.min(255, color[k] * s);
    }
  }
  if (mode === "wireframe") for (const m of meshes) for (let t = 0; t < m.images.length; t++) {
    const p = [project(m, t * 9), project(m, t * 9 + 3), project(m, t * 9 + 6)];
    if (p.some(v => v[2] <= 1e-4)) continue;
    for (let e = 0; e < 3; e++) {
      const a = p[e], b = p[(e + 1) % 3], steps = Math.min(4000, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1);
      for (let s = 0; s <= steps; s++) {
        const f = s / steps, x = Math.floor(a[0] + (b[0] - a[0]) * f), y = Math.floor(a[1] + (b[1] - a[1]) * f), z = a[2] + (b[2] - a[2]) * f;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const i = y * width + x; if (z <= depth[i] * 1.004 + 1e-4) { rgb[i * 3] = 40; rgb[i * 3 + 1] = 44; rgb[i * 3 + 2] = 52; }
      }
    }
  }
  return { rgb, depth, owners, width, height };
}

// Silhouette agreement between a render and a reviewed mask, resampled to the render frame.
export function maskOverlap(owners: Int16Array, width: number, height: number, mask: Uint8Array, maskWidth: number, maskHeight: number, object: number) {
  let intersection = 0, union = 0, occluded = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const owner = owners[y * width + x], a = owner === object, b = mask[Math.min(maskHeight - 1, Math.floor((y + .5) * maskHeight / height)) * maskWidth + Math.min(maskWidth - 1, Math.floor((x + .5) * maskWidth / width))] > 127;
    intersection += Number(a && b); union += Number(a || b); occluded += Number(b && owner >= 0 && owner !== object);
  }
  return { iou: intersection / Math.max(1, union), occluded };
}
