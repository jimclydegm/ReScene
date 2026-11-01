import sharp from "sharp";

/** Composite in source coordinates before resizing; Sharp applies resize before composite. */
export async function qualityMaskOverlay(photo: Buffer, mask: Uint8Array, size: { width: number; height: number }) {
  const edge = Buffer.alloc(size.width * size.height * 4);
  for (let y = 1; y < size.height - 1; y++) for (let x = 1; x < size.width - 1; x++) {
    const i = y * size.width + x, inside = mask[i] > 127;
    if (inside && [i - 1, i + 1, i - size.width, i + size.width].some(n => mask[n] <= 127)) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) { const j = ((y + dy) * size.width + x + dx) * 4; edge[j] = 255; edge[j + 1] = 0; edge[j + 2] = 255; edge[j + 3] = 255; }
  }
  const framed = await sharp(photo).resize(size.width, size.height).png().toBuffer();
  const composited = await sharp(framed).composite([{ input: await sharp(edge, { raw: { ...size, channels: 4 } }).png().toBuffer() }]).png().toBuffer();
  return sharp(composited).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png().toBuffer();
}
