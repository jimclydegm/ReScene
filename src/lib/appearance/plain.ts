import type { PixelImage } from "./bake";

function validate(photo: PixelImage, masks: Uint8Array[]) {
  const n = photo.width * photo.height;
  if (!Number.isSafeInteger(n) || !Number.isInteger(photo.width) || !Number.isInteger(photo.height) ||
      photo.width < 1 || photo.height < 1 || n > 16_000_000 || photo.data.length !== n * 3 || masks.some(m => m.length !== n)) {
    throw new Error("BACKGROUND_PIXEL_SIZE");
  }
}

// A nearly constant field is a plain backdrop. Minority cast-shadow pixels do
// not become a photographic environment texture. Ambiguous scenes keep photos.
export function plainBackground(photo: PixelImage, masks: Uint8Array[]) {
  validate(photo, masks);
  const bins = new Map<string, { count: number; sum: number[] }>();
  let total = 0;
  for (let y = 0; y < photo.height; y += 4) for (let x = 0; x < photo.width; x += 4) {
    const i = y * photo.width + x;
    if (masks.some(m => m[i] > 127)) continue;
    const rgb = [0, 1, 2].map(k => photo.data[i * 3 + k]), key = rgb.map(v => Math.round(v / 8)).join();
    const bin = bins.get(key) ?? { count: 0, sum: [0, 0, 0] };
    bin.count++;
    rgb.forEach((v, k) => bin.sum[k] += v);
    bins.set(key, bin);
    total++;
  }
  const top = [...bins.values()].sort((a, b) => b.count - a.count)[0];
  if (!top || total < 80 || top.count / total < .88) return null;
  const rgb = top.sum.map(v => Math.round(v / top.count));
  return { color: "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join(""), rgb };
}

// Provider-only refinement: sizeable enclosed bright-background-colored areas
// with a dark rim. This is conservative evidence, not proof of unseen topology.
// Users can disable it when bright printed details are mistaken for openings.
export function refineOpenings(photo: PixelImage, mask: Uint8Array) {
  const backdrop = plainBackground(photo, [mask]), result = new Uint8Array(mask);
  let removed = 0, openings = 0;
  if (!backdrop || Math.min(...backdrop.rgb) < 220) return { pixels: result, removed, openings };
  const { width, height } = photo, n = mask.length, seen = new Uint8Array(n), queue = new Int32Array(n);
  const area = mask.reduce((s, v) => s + Number(v > 127), 0);
  const radius = Math.max(1, Math.round(Math.max(width, height) * .004));
  const candidate = (i: number) => mask[i] > 127 && [0, 1, 2].every(k => Math.abs(photo.data[i * 3 + k] - backdrop.rgb[k]) < 10);
  const darkNear = (i: number) => {
    const x = i % width, y = Math.floor(i / width);
    return [[x - radius, y], [x + radius, y], [x, y - radius], [x, y + radius]].some(([px, py]) => {
      if (px < 0 || px >= width || py < 0 || py >= height) return false;
      const p = (py * width + px) * 3;
      return (photo.data[p] + photo.data[p + 1] + photo.data[p + 2]) / 3 < 60;
    });
  };
  for (let start = 0; start < n; start++) if (!seen[start] && candidate(start)) {
    let head = 0, tail = 1, dark = 0, rim = 0, touches = false;
    queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const i = queue[head++], x = i % width, y = Math.floor(i / width);
      if (!x || !y || x === width - 1 || y === height - 1) touches = true;
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (j < 0) continue;
        if (mask[j] < 128) touches = true;
        if (candidate(j)) {
          if (!seen[j]) { seen[j] = 1; queue[tail++] = j; }
        } else { rim++; if (darkNear(j)) dark++; }
      }
    }
    if (!touches && tail >= Math.max(40, area * .0005) && tail < area * .08 && dark / Math.max(1, rim) > .25) {
      for (let k = 0; k < tail; k++) result[queue[k]] = 0;
      removed += tail; openings++;
    }
  }
  return { pixels: result, removed, openings };
}
