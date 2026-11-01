import sharp from "sharp";
import { Matrix3, Vector3 } from "three";
import { insidePolygon } from "@/lib/scene/environment-geometry";
import { environmentUsesTexture } from "@/lib/scene/environment-material";
import type { EnvironmentObservation } from "@/lib/scene/environment-plan";

/** Retain Muse's material variation at every spatial scale. Remove only an
 * estimated illumination ramp within each surface, never blur across a seam or
 * add source-photo shadows back into the generated material. */
export async function environmentAlbedo(
  photo: Buffer,
  generated: Buffer,
  footprint: Uint8Array,
  plan: EnvironmentObservation,
  options:{preserveResolution?:boolean;delight?:boolean}={},
) {
  let source = await sharp(photo)
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
  if(options.preserveResolution){
    source=await sharp(photo).resize(meta.width,meta.height,{fit:"fill"}).removeAlpha().toColourspace("srgb").raw().toBuffer({resolveWithObject:true});
    footprint=new Uint8Array(await sharp(footprint,{raw:{width,height,channels:1}}).resize(meta.width,meta.height,{kernel:"nearest"}).raw().toBuffer());
    width=meta.width;height=meta.height;
  }
  const fill = await sharp(generated)
      .resize(width, height, { fit: "fill" })
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer(),
    out = Buffer.from(fill),
    regions = new Int16Array(width * height).fill(-1);
  const order = plan.surfaces
    .map((s, i) => ({ s, i }))
    .sort((a, b) => Number(b.s.role === "trim") - Number(a.s.role === "trim"));
  const sums = plan.surfaces.map(() => ({
    n: 0,
    x: 0,
    y: 0,
    xx: 0,
    xy: 0,
    yy: 0,
    rgb: [0, 0, 0],
    xr: [0, 0, 0],
    yr: [0, 0, 0],
  }));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = y * width + x,
        p = { x: (x + 0.5) / width, y: (y + 0.5) / height };
      if (plan.openings.some((o) => insidePolygon(p, o.polygon))) {
        regions[at] = -2;
        continue;
      }
      const region = order.find(({ s }) => insidePolygon(p, s.polygon));
      if (!region) continue;
      regions[at] = region.i;
      if (x % 4 || y % 4) continue;
      const a = sums[region.i];
      a.n++;
      a.x += p.x;
      a.y += p.y;
      a.xx += p.x * p.x;
      a.xy += p.x * p.y;
      a.yy += p.y * p.y;
      for (let c = 0; c < 3; c++) {
        const v = fill[at * 3 + c];
        a.rgb[c] += v;
        a.xr[c] += p.x * v;
        a.yr[c] += p.y * v;
      }
    }
  const fits = sums.map((a) => {
    const m = new Matrix3().set(
      a.xx,
      a.xy,
      a.x,
      a.xy,
      a.yy,
      a.y,
      a.x,
      a.y,
      a.n,
    );
    if (a.n < 12 || Math.abs(m.determinant()) < 1e-8) return null;
    m.invert();
    return a.rgb.map((_, c) => ({
      plane: new Vector3(a.xr[c], a.yr[c], a.rgb[c]).applyMatrix3(m),
      mean: a.rgb[c] / a.n,
    }));
  });
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = y * width + x,
        index = regions[at];
      if (index === -2) {
        if (!footprint[at])
          for (let c = 0; c < 3; c++) out[at * 3 + c] = source.data[at * 3 + c];
        continue;
      }
      if (index < 0) continue;
      if(options.delight===false)continue;
      const s = plan.surfaces[index],
        fit = fits[index];
      if (!environmentUsesTexture(s)) {
        const rgb = s.color
          .slice(1)
          .match(/../g)!
          .map((v) => parseInt(v, 16));
        for (let c = 0; c < 3; c++) out[at * 3 + c] = rgb[c];
        continue;
      }
      if (!fit) continue;
      for (let c = 0; c < 3; c++) {
        const f = fit[c],
          ramp =
            (f.plane.x * (x + 0.5)) / width +
            (f.plane.y * (y + 0.5)) / height +
            f.plane.z;
        out[at * 3 + c] = Math.max(
          0,
          Math.min(
            255,
            f.mean + Math.max(-80, Math.min(80, fill[at * 3 + c] - ramp)),
          ),
        );
      }
    }
  return sharp(out, { raw: { width, height, channels: 3 } })
    .webp({ quality: 95 })
    .toBuffer();
}
