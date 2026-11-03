/** Re-bake reviewed Muse swatches into existing approved SAM geometry. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Matrix4, Box3, Vector3 } from "three";
import sharp from "sharp";
import scenes from "../src/lib/demo/frozen-scenes.json";
import masks from "../src/lib/demo/photo-shopping.json";
import { modelPlacementSchema } from "../src/lib/scene/composition";
import { readMesh, decodeGlb, writeGlb } from "../src/lib/quality/mesh";
import {
  decodeTextures,
  planRegions,
  inspectionView,
} from "../src/lib/quality/pipeline";
import { placementMatrix } from "../src/lib/quality/placement";
import { render, renderMesh } from "../src/lib/quality/render";
import { bakeMaterials } from "../src/lib/quality/material-bake";
import { photoCamera } from "../src/lib/appearance/bake";
import { inspectGlb } from "../src/lib/ai/glb";
import type { QualityPlanObservation } from "../src/lib/quality/contracts";
const folder = "test-results/demo-polish-nov3",
  models = JSON.parse(
    await readFile(`${folder}/catalog-models-before.json`, "utf8"),
  ) as { id: string; digest: string }[],
  requested = new Set(
    (process.env.DEMO_PRODUCTS ?? "").split(",").filter(Boolean),
  );
await mkdir(`${folder}/approved`, { recursive: true });
for (const scene of scenes.scenes.filter((s) =>
  ["corner", "living", "chair-studio"].includes(s.id),
)) {
  const frame = masks.scenes.find((s) => s.id === scene.id)!,
    raw = await sharp(`public${frame.photo.path}`)
      .resize(frame.width, frame.height)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    camera = photoCamera(scene.composition.camera);
  const bytes = await Promise.all(
    scene.objects.map((o) => {
      const m = models.find((m) => m.id === o.id)!;
      return readFile(`.judge/objects/judge/demo/store-v1/${m.digest}.glb`);
    }),
  );
  const docs = scene.objects.map((o, i) =>
      readMesh(
        bytes[i],
        placementMatrix({
          id: o.id,
          position: o.position as [number, number, number],
          placement: modelPlacementSchema.parse(o.placement),
        }),
      ),
    ),
    visible = render(
      docs.map((doc, i) => renderMesh(doc, new Matrix4(), i)),
      camera,
      frame.width,
      frame.height,
      "depth",
    );
  for (const [index, o] of scene.objects.entries()) {
    if (requested.size && !requested.has(o.id)) continue;
    let saved;
    try {
      saved = JSON.parse(await readFile(`${folder}/${o.id}-plan.json`, "utf8"));
    } catch {
      continue;
    }
    if (saved.status !== "SUCCEEDED") continue;
    const plan = saved.result.value as QualityPlanObservation,
      samples = new Map();
    let ready = true;
    for (const m of plan.materials
      .filter((m) => !["metallic", "translucent"].includes(m.finish))
      .slice(0, 3)) {
      const path = `${folder}/${o.id}-${m.id}.png`;
      try {
        const receipt = JSON.parse(await readFile(`${path}.json`, "utf8")),
          review = JSON.parse(await readFile(`${path}.review.json`, "utf8")),
          data = await readFile(path);
        if (
          receipt.status !== "SUCCEEDED" ||
          review.status !== "SUCCEEDED" ||
          !review.result.value.accepted ||
          createHash("sha256").update(data).digest("hex") !==
            receipt.result.sha256
        )
          throw Error("Not reviewed");
        const size = /fabric|cloth|linen|upholster/i.test(m.material)
          ? 512
          : 2048;
        const r = await sharp(data)
          .resize({
            width: size,
            height: size,
            fit: "inside",
            withoutEnlargement: true,
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        samples.set(m.id, {
          data: new Uint8Array(r.data),
          width: r.info.width,
          height: r.info.height,
        });
      } catch {
        ready = false;
      }
    }
    if (!ready || !samples.size) {
      console.log(`${o.id}: incomplete/rejected samples; original preserved`);
      continue;
    }
    const selection = frame.products.find((p) => p.id === o.id)!,
      mask = new Uint8Array(frame.width * frame.height),
      rgba = await sharp(`public${selection.maskPath}`).raw().toBuffer();
    for (let y = 0; y < selection.bounds[3]; y++)
      for (let x = 0; x < selection.bounds[2]; x++)
        mask[
          (y + selection.bounds[1]) * frame.width + x + selection.bounds[0]
        ] = rgba[(y * selection.bounds[2] + x) * 4 + 3];
    const { textures } = await decodeTextures(docs[index], 2048),
      providerLowFrequency = new Map();
    for (const [k, img] of textures) {
      const b = await sharp(Buffer.from(img.data), {
        raw: { width: img.width, height: img.height, channels: 4 },
      })
        .blur(20)
        .raw()
        .toBuffer();
      providerLowFrequency.set(k, { ...img, data: new Uint8Array(b) });
    }
    const box = new Box3();
    for (const p of docs[index].primitives)
      for (let i = 0; i < p.positions.length; i += 3)
        box.expandByPoint(new Vector3().fromArray(p.positions, i));
    const y = (fraction: number) =>
        box.min.y + (box.max.y - box.min.y) * fraction,
      range = (lo: number, hi: number) =>
        [
          box.min.x - 1e-4,
          y(lo),
          box.min.z - 1e-4,
          box.max.x + 1e-4,
          y(hi),
          box.max.z + 1e-4,
        ] as [number, number, number, number, number, number];
    const cloth = plan.materials.some((m) =>
        /fabric|cloth|linen|upholster/i.test(m.material),
      ),
      legCut =
        o.id === "cloud-sofa" ? 0.16 : o.id === "corner-chair" ? 0.23 : 0.26;
    // These reviewed products have one wood finish. Face-by-face assignment of
    // near-identical swatches made patchwork grain. Joinery stays in geometry.
    const singleWood = [
      "corner-cabinet",
      "coffee-table",
      "wood-stool",
      "chair-studio-item-2",
      "chair-studio-item-4",
    ].includes(o.id);
    const plannedRegions = planRegions(plan, samples);
    const regions = (
      singleWood ? plannedRegions.slice(0, 1) : plannedRegions
    ).map((r) => {
      const material = plan.materials.find((m) => m.id === r.id)!,
        fabric = /fabric|cloth|linen|upholster/i.test(material.material);
      return {
        ...r,
        preserveProviderDetail: false,
        ...(cloth
          ? {
              bounds3d: range(
                fabric ? legCut : -0.001,
                fabric ? 1.001 : legCut,
              ),
              ...(fabric
                ? {}
                : { grainAxis: [0, 1, 0] as [number, number, number] }),
            }
          : {
              grainAxis: (/top|seat/i.test(r.id) ? [1, 0, 0] : [0, 1, 0]) as [
                number,
                number,
                number,
              ],
            }),
      };
    });
    const result = bakeMaterials({
      doc: docs[index],
      textures,
      providerLowFrequency,
      object: index,
      photo: {
        data: new Uint8Array(raw.data),
        width: frame.width,
        height: frame.height,
        channels: 3,
      },
      mask,
      camera,
      visible,
      photoStrength: 0.2,
      regions,
      protectedBoxes: plan.protectedDetails
        .filter((d) => d.kind !== "stitching")
        .map((d) => [
          d.evidence.x0,
          d.evidence.y0,
          d.evidence.x1,
          d.evidence.y1,
        ]),
    });
    if (result.coverage.unmapped > 0.0001)
      throw Error("Incomplete mapped surface");
    const images = new Map();
    for (const [k, img] of result.textures)
      images.set(k, {
        bytes: await sharp(Buffer.from(img.data), {
          raw: { width: img.width, height: img.height, channels: 4 },
        })
          .removeAlpha()
          .jpeg({ quality: 96, chromaSubsampling: "4:4:4" })
          .toBuffer(),
        mimeType: "image/jpeg",
      });
    const out = writeGlb(decodeGlb(bytes[index]), { images }),
      after = readMesh(out),
      before = readMesh(bytes[index]);
    inspectGlb(out);
    if (out.length > 8 * 1024 * 1024) throw Error("Approved model too large");
    if (
      after.primitives.some(
        (p, i) =>
          !Buffer.from(p.positions.buffer).equals(
            Buffer.from(before.primitives[i].positions.buffer),
          ) ||
          !Buffer.from(p.indices.buffer).equals(
            Buffer.from(before.primitives[i].indices.buffer),
          ) ||
          !Buffer.from(p.uv!.buffer).equals(
            Buffer.from(before.primitives[i].uv!.buffer),
          ),
      )
    )
      throw Error("Geometry/UV mutation");
    await writeFile(`${folder}/approved/${o.id}.glb`, out);
    await writeFile(
      `${folder}/${o.id}-bake.json`,
      JSON.stringify(
        {
          sourceDigest: models.find((m) => m.id === o.id)!.digest,
          digest: createHash("sha256").update(out).digest("hex"),
          bytes: out.length,
          coverage: result.coverage,
          seams: result.seams,
          geometryPreserved: true,
        },
        null,
        2,
      ),
    );
    const tiles = [];
    for (let view = 0; view < 6; view++)
      tiles.push({
        input: await inspectionView(out, "unlit", view, 256),
        left: view * 256,
        top: 0,
      });
    await sharp({
      create: {
        width: 6 * 256,
        height: 256,
        channels: 3,
        background: "#eeeeeb",
      },
    })
      .composite(tiles)
      .png()
      .toFile(`${folder}/${o.id}-after.png`);
    console.log(
      `${o.id}: full-surface bake ready, generated ${Math.round(result.coverage.generated * 100)}%, ${Math.round(out.length / 1024)} KiB`,
    );
  }
}
