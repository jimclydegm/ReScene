import sharp from "sharp";
import { insidePolygon } from "@/lib/scene/environment-geometry";
import type { EnvironmentObservation } from "@/lib/scene/environment-plan";
// Preserve high-frequency observed material detail, not the photographed low-
// frequency lighting. Masked/occluded pixels always come from the clean fill.
export async function environmentAlbedo(
  photo: Buffer,
  generated: Buffer,
  footprint: Uint8Array,
  plan: EnvironmentObservation,
) {
  const source = await sharp(photo)
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true }),
    { width, height } = source.info;
  const meta = await sharp(generated, {
    limitInputPixels: 10_000_000,
  }).metadata();
  if (
    !meta.width ||
    !meta.height ||
    Math.abs(meta.width / meta.height / (width / height) - 1) > 0.03 ||
    footprint.length !== width * height
  )
    throw new Error("ENVIRONMENT_TEXTURE_FRAME");
  const fill = await sharp(generated)
    .resize(width, height, { fit: "fill" })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer();
  const fillLow = await sharp(fill, { raw: { width, height, channels: 3 } })
    .blur(Math.max(2, Math.min(30, width * 0.015)))
    .raw()
    .toBuffer();
  const low = await sharp(photo)
      .removeAlpha()
      .toColourspace("srgb")
      .blur(Math.max(2, Math.min(30, width * 0.015)))
      .raw()
      .toBuffer(),
    out = Buffer.from(fill);
  const materialMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        p = { x: (x + 0.5) / width, y: (y + 0.5) / height };
      const opening = plan.openings.some((o) => insidePolygon(p, o.polygon)),
        surface = plan.surfaces.find((s) => insidePolygon(p, s.polygon));
      if (opening) {
        if (!footprint[i])
          for (let c = 0; c < 3; c++) out[i * 3 + c] = source.data[i * 3 + c];
        continue;
      }
      if (!surface) continue;
      if (surface.finish === "plain") {
        const rgb = surface.color
          .slice(1)
          .match(/../g)!
          .map((s) => parseInt(s, 16));
        for (let c = 0; c < 3; c++) out[i * 3 + c] = rgb[c];
        continue;
      }
      materialMask[i] = 1;
      const rgb = surface.color
        .slice(1)
        .match(/../g)!
        .map((s) => parseInt(s, 16));
      // Flatten the generated low-frequency field too: inpainted lighting/blotches
      // are not albedo. Grain and joints remain in the bounded detail band.
      for (let c = 0; c < 3; c++)
        out[i * 3 + c] = Math.max(
          0,
          Math.min(
            255,
            rgb[c] +
              Math.max(-32, Math.min(32, fill[i * 3 + c] - fillLow[i * 3 + c])),
          ),
        );
    }
  // Keep a halo around removed subjects out of the source-detail transfer. It
  // prevents blurred foreground color from leaking back onto floor/wall albedo.
  const safe = await sharp(Buffer.from(footprint), {
    raw: { width, height, channels: 1 },
  })
    .blur(Math.max(2, Math.min(32, width * 0.015)))
    .raw()
    .toBuffer();
  for (let i = 0; i < width * height; i++)
    if (materialMask[i] && !footprint[i] && safe[i] < 1)
      for (let c = 0; c < 3; c++) {
        // Broad directional lighting is in the low-pass image. Clip fine contrast so
        // a sharp shadow boundary cannot dominate the recovered material detail.
        const detail = Math.max(
          -22,
          Math.min(22, source.data[i * 3 + c] - low[i * 3 + c]),
        );
        out[i * 3 + c] = Math.max(
          0,
          Math.min(255, out[i * 3 + c] + detail * 0.65),
        );
      }
  return sharp(out, { raw: { width, height, channels: 3 } })
    .webp({ quality: 95 })
    .toBuffer();
}
