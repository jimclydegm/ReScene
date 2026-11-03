/** Curate derived click masks for explicitly public demo photos. Read-only DB;
 * no paid inference, source-scene mutations or private files in the snapshot. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { getDb } from "../src/lib/db";
import { readLimited } from "../src/lib/storage/r2";
import { demoScenes } from "../src/lib/demo/scenes";
import { sceneAlbum } from "../src/lib/demo/albums";
import { maskGeometry } from "../src/lib/demo/photo-mask";
const db = getDb();
const legacy: Record<string, { scene: string; objects: string[] }> = {
  corner: { scene: "6800b8a2-7c39-4a52-8fde-790eb03ab46c", objects: ["fb506dbc-8182-4125-af82-13255508c25f", "2354cd5f-793b-4a46-bea0-89ade18e3189", "85da158b-34e5-469d-8228-95ceb564e115"] },
  space: { scene: "41f2f4b8-5f05-4834-a5f3-0345f9015c39", objects: ["eaf99f02-6148-42d4-942c-37556b58b475", "44df24a4-9f1d-4c4d-bcb4-5d200300226d", "126230a4-4378-48d1-911d-3efc41a4f0a5", "6aba43e0-7ca7-4d7e-8cce-fa149f32c32a"] },
  living: { scene: "eb34c54c-3795-4cb0-a17a-3264f29c753e", objects: ["c24acfa9-15cf-44b5-a857-7b7696008672", "d57a403a-1aeb-4d7c-9994-b2065d3f6e8d", "d1e26a0e-0562-437e-b208-c0dc67101e12", "b5666177-6bdf-4937-91ff-409d0213f5a2"] },
};
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
await mkdir("public/demo/photo-shopping", { recursive: true });
const scenes = [];
try {
  let owner: string | undefined;
  for (const demo of demoScenes) {
    const keys = demo.objects.map(o => o.id);
    const listings = await db.product.findMany({ where: { catalogKey: { in: keys }, catalogRole: "SOURCE", catalogStatus: "READY" }, select: { id: true, catalogKey: true, sourceProductId: true, sourceProduct: { select: { sourceObjectKey: true } }, sceneId: true } });
    if (listings.length !== keys.length || new Set(listings.map(p => p.sceneId)).size !== 1) throw new Error("Approved catalog scene mismatch");
    const sceneId = listings[0].sceneId;
    if (sceneId === "f2848b95-8447-41eb-9544-0d72dd605565" || (legacy[demo.id] && legacy[demo.id].scene !== sceneId)) throw new Error("Not an approved source");
    const source = await db.scene.findUniqueOrThrow({ where: { id: sceneId }, select: { ownerId: true, archivedAt: true, normalizedAsset: { select: { storageKey: true, width: true, height: true } }, objects: { select: { id: true, productId: true, mask: { select: { status: true, sceneId: true, storageKey: true } } } } } });
    owner ??= source.ownerId;
    if (source.ownerId !== owner || source.archivedAt || !source.normalizedAsset) throw new Error("Source ownership mismatch");
    const photo = sceneAlbum(demo.id).find(p => p.setting === "reference")!;
    if (!photo || !photo.path.startsWith("/demo/")) throw new Error("Approved reference required");
    const bytes = await readFile(`public${photo.path}`), meta = await sharp(bytes).metadata();
    const small = await sharp(bytes).resize(100, 100).removeAlpha().raw().toBuffer();
    const original = await sharp(await readLimited(source.normalizedAsset.storageKey, 16 * 1024 * 1024)).resize(100, 100).removeAlpha().raw().toBuffer();
    const difference = small.reduce((sum, p, i) => sum + Math.abs(p - original[i]), 0) / small.length;
    if (difference > 2 || Math.abs(meta.width! / meta.height! - source.normalizedAsset.width! / source.normalizedAsset.height!) > .003) throw new Error("Reference photo changed; review alignment");
    // Normalize to a bounded public selection frame. Overlay/image share exact proportions.
    const width = Math.min(1400, meta.width!), height = Math.round(width * meta.height! / meta.width!);
    const products = [];
    for (const [i, id] of keys.entries()) {
      const listing = listings.find(p => p.catalogKey === id)!;
      const object = legacy[demo.id]
        ? source.objects.find(o => o.id === legacy[demo.id].objects[i])
        : source.objects.find(o => o.id === listing.sourceProduct?.sourceObjectKey || o.productId === listing.sourceProductId || o.productId === listing.id);
      if (!object?.mask || object.mask.status !== "READY" || object.mask.sceneId !== sceneId) throw new Error(`Saved Meta mask unavailable: ${id}`);
      const mask = await sharp(await readLimited(object.mask.storageKey, 4 * 1024 * 1024))
        .removeAlpha().greyscale().resize(width, height, { kernel: "nearest" }).threshold(128).raw().toBuffer();
      const geometry = maskGeometry(mask, width, height);
      const cropped = await sharp(mask, { raw: { width, height, channels: 1 } }).extract({ left: geometry.bounds[0], top: geometry.bounds[1], width: geometry.bounds[2], height: geometry.bounds[3] }).greyscale().raw().toBuffer();
      if (cropped.length !== geometry.bounds[2] * geometry.bounds[3]) throw new Error("Mask crop must have one alpha channel");
      const rgba = Buffer.alloc(cropped.length * 4);
      for (let p = 0; p < cropped.length; p++) { rgba[p*4]=32; rgba[p*4+1]=179; rgba[p*4+2]=155; rgba[p*4+3]=cropped[p]; }
      const png = await sharp(rgba, { raw: { width: geometry.bounds[2], height: geometry.bounds[3], channels: 4 } }).png().toBuffer();
      const digest = hash(png), path = `/demo/photo-shopping/${id}-${digest.slice(0,12)}.png`;
      await writeFile(`public${path}`, png);
      products.push({ id, maskPath: path, sha256: digest, ...geometry });
    }
    scenes.push({ id: demo.id, photo: { path: photo.path, sha256: hash(bytes), width: meta.width!, height: meta.height! }, width, height, model: "sam-3.1", products });
    console.log(`${demo.id}: ${products.length} saved Meta masks aligned to approved photo`);
  }
  await writeFile("src/lib/demo/photo-shopping.json", JSON.stringify({ version: 1, scenes }, null, 2) + "\n");
  console.log(`${scenes.length} collections exported. Zero inference and zero database writes.`);
} finally { await db.$disconnect(); }
