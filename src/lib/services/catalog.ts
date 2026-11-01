import "server-only";
import { z } from "zod";
import sharp from "sharp";
import { randomUUID, createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { ownedScene } from "./scenes";
import { record } from "./composition";
import { AppError } from "@/lib/http";
import {
  putObject,
  bucket,
  storagePrefix,
  signRead,
  readLimited,
} from "@/lib/storage/r2";
import { inspectGlb } from "@/lib/ai/glb";
import {
  demoCatalog,
  demoGlb,
  demoSvg,
  boundsSchema,
  fitCatalog,
} from "@/lib/scene/catalog";
import { modelPlacementSchema, glbBounds } from "@/lib/scene/composition";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export const catalogInput = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict();
export const replacementInput = z
  .object({
    action: z.enum(["REPLACE", "RESTORE"]),
    expectedRevision: z.number().int().nonnegative(),
    objectId: z.uuid(),
    productId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (v) => v.action !== "REPLACE" || !!v.productId,
    "Choose a catalog product.",
  );
export async function catalog(sceneId: string, ownerId: string) {
  await ownedScene(sceneId, ownerId);
  const products = await getDb().product.findMany({
    where: {
      scene: { ownerId, archivedAt: null },
      OR: [
        {
          sceneId,
          attributes: { path: ["catalogVersion"], equals: "demo-v1" },
        },
        { catalogRole: "SOURCE", catalogStatus: "READY" },
      ],
    },
    include: { imageAsset: true, modelAsset: true },
    orderBy: { name: "asc" },
    take: 150,
  });
  return Promise.all(
    products
      .filter(
        (p) =>
          p.modelAsset?.sceneId === p.sceneId &&
          p.modelAsset.status === "READY" &&
          p.modelAsset.kind === "MODEL_GLB",
      )
      .map(async (p) => ({
        id: p.id,
        name: p.name,
        imageUrl:
          p.imageAsset?.sceneId === p.sceneId && p.imageAsset.status === "READY"
            ? await signRead(p.imageAsset)
            : null,
      })),
  );
}
export async function seedCatalog(
  sceneId: string,
  ownerId: string,
  revision: number,
) {
  const scene = await ownedScene(sceneId, ownerId),
    db = getDb();
  if (scene.status !== "READY" || scene.revision !== revision)
    throw new AppError(
      409,
      "REVISION_CONFLICT",
      "Reload the ready scene before adding catalog items.",
    );
  if ((await catalog(sceneId, ownerId)).length) return;
  const prepared: {
    item: (typeof demoCatalog)[number];
    assets: Prisma.AssetCreateManyInput[];
  }[] = [];
  for (const item of demoCatalog) {
    const model = demoGlb(item.boxes);
    inspectGlb(model.bytes);
    const image = await sharp(Buffer.from(demoSvg(item.boxes)))
      .webp()
      .toBuffer();
    const assets = [];
    for (const [kind, bytes, mimeType] of [
      ["MODEL_GLB", model.bytes, "model/gltf-binary"],
      ["PRODUCT_IMAGE", image, "image/webp"],
    ] as const) {
      const id = randomUUID(),
        key = `${storagePrefix()}/scenes/${sceneId}/catalog/${id}.${kind === "MODEL_GLB" ? "glb" : "webp"}`;
      await putObject(key, bytes, mimeType);
      assets.push({
        id,
        sceneId,
        kind,
        status: "READY" as const,
        bucket: bucket(),
        storageKey: key,
        mimeType,
        byteSize: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        readyAt: new Date(),
        metadata: json({ bounds: model.bounds }),
        provenance: json({
          license: "CC0-1.0",
          author: "ReScene",
          generator: "original-procedural-v1",
          catalogKey: item.key,
        }),
      });
    }
    prepared.push({ item, assets });
  }
  await db.$transaction(async (tx) => {
    const changed = await tx.scene.updateMany({
      where: {
        id: sceneId,
        ownerId,
        revision,
        status: "READY",
        archivedAt: null,
      },
      data: { revision: { increment: 1 } },
    });
    if (!changed.count)
      throw new AppError(
        409,
        "REVISION_CONFLICT",
        "The scene changed. Reload before adding the catalog.",
      );
    for (const { item, assets } of prepared) {
      await tx.asset.createMany({ data: assets });
      await tx.product.create({
        data: {
          sceneId,
          name: item.name,
          description:
            "Original ReScene demo asset. Illustrative geometry; not an actual commercial listing.",
          brand: "ReScene Demo",
          currency: null,
          modelAssetId: assets[0].id,
          imageAssetId: assets[1].id,
          attributes: {
            catalogVersion: "demo-v1",
            catalogKey: item.key,
            license: "CC0-1.0",
          },
        },
      });
    }
  });
}
const backupSchema = z.object({
  modelAssetId: z.uuid(),
  productId: z.uuid().nullable(),
  label: z.string(),
  initialTransform: z.unknown(),
  localBounds: z.unknown(),
});
export async function replaceObject(
  sceneId: string,
  ownerId: string,
  input: z.infer<typeof replacementInput>,
) {
  const scene = await ownedScene(sceneId, ownerId),
    db = getDb();
  if (scene.status !== "READY" || scene.revision !== input.expectedRevision)
    throw new AppError(
      409,
      "REVISION_CONFLICT",
      "Save or reload your ready scene before replacing an object.",
    );
  let importedId: string | undefined;
  if (input.action === "REPLACE") {
    const source = await db.product.findFirst({
      where: {
        id: input.productId,
        catalogRole: "SOURCE",
        catalogStatus: "READY",
        scene: { ownerId, archivedAt: null },
      },
      include: { modelAsset: true, imageAsset: true },
    });
    if (
      source &&
      !(await db.sceneObject.findFirst({
        where: { id: input.objectId, sceneId, status: "READY" },
      }))
    )
      throw new AppError(404, "NOT_FOUND", "Object not found.");
    if (source) {
      if (
        !source.modelAsset ||
        source.modelAsset.sceneId !== source.sceneId ||
        source.modelAsset.status !== "READY" ||
        source.modelAsset.kind !== "MODEL_GLB" ||
        !source.imageAsset ||
        source.imageAsset.sceneId !== source.sceneId ||
        source.imageAsset.status !== "READY"
      )
        throw new AppError(
          422,
          "CATALOG_INCOMPLETE",
          "This product's render assets are unavailable.",
        );
      const copies: Prisma.AssetCreateManyInput[] = [];
      const modelBytes = await readLimited(
        source.modelAsset.storageKey,
        40 * 1024 * 1024,
      );
      inspectGlb(modelBytes);
      const bounds = glbBounds(modelBytes);
      for (const [asset, bytes] of [
        [source.modelAsset, modelBytes],
        [
          source.imageAsset,
          await readLimited(source.imageAsset.storageKey, 4 * 1024 * 1024),
        ],
      ] as const) {
        const id = randomUUID(),
          key = `${storagePrefix()}/scenes/${sceneId}/catalog-imports/${id}`;
        await putObject(key, bytes, asset.mimeType);
        copies.push({
          id,
          sceneId,
          kind: asset.kind,
          status: "READY",
          bucket: bucket(),
          storageKey: key,
          mimeType: asset.mimeType,
          byteSize: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          readyAt: new Date(),
          derivedFromId: asset.id,
          metadata: json(asset.kind === "MODEL_GLB" ? { bounds } : {}),
          provenance: { source: "owned-catalog-import" },
        });
      }
      const imported = await db.$transaction(async (tx) => {
        const current = await tx.scene.findFirst({
          where: {
            id: sceneId,
            ownerId,
            archivedAt: null,
            revision: input.expectedRevision,
            status: "READY",
          },
        });
        const stillOwned = await tx.product.findFirst({
          where: {
            id: source.id,
            updatedAt: source.updatedAt,
            catalogStatus: "READY",
            scene: { ownerId, archivedAt: null },
          },
        });
        if (!current || !stillOwned)
          throw new AppError(
            409,
            "REVISION_CONFLICT",
            "The scene or product changed. Reload before replacing.",
          );
        await tx.asset.createMany({ data: copies });
        return tx.product.create({
          data: {
            sceneId,
            name: source.name,
            description: source.description,
            brand: source.brand,
            price: source.price,
            currency: source.currency,
            productUrl: source.productUrl,
            modelAssetId: copies[0].id,
            imageAssetId: copies[1].id,
            catalogRole: "INSTANCE",
            sourceProductId: source.id,
            inferredDetails: json(source.inferredDetails),
            attributes: {
              catalogVersion: "demo-v1",
              importedSourceId: source.id,
            },
          },
        });
      });
      importedId = imported.id;
    }
  }
  await db.$transaction(async (tx) => {
    const changed = await tx.scene.updateMany({
      where: {
        id: sceneId,
        ownerId,
        revision: input.expectedRevision,
        status: "READY",
        archivedAt: null,
      },
      data: { revision: { increment: 1 } },
    });
    if (!changed.count)
      throw new AppError(
        409,
        "REVISION_CONFLICT",
        "The scene changed. Reload before replacing.",
      );
    const object = await tx.sceneObject.findFirst({
      where: {
        id: input.objectId,
        sceneId,
        status: "READY",
        modelAssetId: { not: null },
      },
    });
    if (object && record(object.provenance).assemblyRootId)
      throw new AppError(
        409,
        "ASSEMBLY_REPLACEMENT",
        "Shared-geometry product regions cannot be replaced with standalone catalog models.",
      );
    if (!object) throw new AppError(404, "NOT_FOUND", "Object not found.");
    const provenance = record(object.provenance),
      saved = backupSchema.safeParse(provenance.replacementBackup);
    if (input.action === "RESTORE") {
      if (!saved.success)
        throw new AppError(
          409,
          "NO_BACKUP",
          "This object has no replacement to restore.",
        );
      const original = await tx.asset.findFirst({
        where: {
          id: saved.data.modelAssetId,
          sceneId,
          kind: "MODEL_GLB",
          status: "READY",
        },
      });
      if (
        !original ||
        (saved.data.productId &&
          !(await tx.product.findFirst({
            where: { id: saved.data.productId, sceneId },
          })))
      )
        throw new AppError(
          409,
          "BACKUP_UNAVAILABLE",
          "The original is no longer available.",
        );
      const { replacementBackup: _, ...rest } = provenance;
      void _;
      await tx.sceneObject.update({
        where: { id: object.id },
        data: {
          modelAssetId: original.id,
          productId: saved.data.productId,
          label: saved.data.label,
          initialTransform:
            saved.data.initialTransform === null
              ? Prisma.DbNull
              : json(saved.data.initialTransform),
          localBounds:
            saved.data.localBounds === null
              ? Prisma.DbNull
              : json(saved.data.localBounds),
          provenance: json(rest),
        },
      });
      return;
    }
    const product = await tx.product.findFirst({
      where: {
        id: importedId ?? input.productId,
        sceneId,
        attributes: { path: ["catalogVersion"], equals: "demo-v1" },
      },
      include: { modelAsset: true, imageAsset: true },
    });
    if (
      !product?.modelAsset ||
      product.modelAsset.sceneId !== sceneId ||
      product.modelAsset.kind !== "MODEL_GLB" ||
      product.modelAsset.status !== "READY" ||
      !product.imageAsset ||
      product.imageAsset.sceneId !== sceneId ||
      product.imageAsset.kind !== "PRODUCT_IMAGE" ||
      product.imageAsset.status !== "READY"
    )
      throw new AppError(
        400,
        "INVALID_PRODUCT",
        "Choose a valid catalog item from this scene.",
      );
    const bounds = boundsSchema.parse(
      record(product.modelAsset.metadata).bounds,
    );
    const originalBase = modelPlacementSchema.safeParse(
      saved.success ? saved.data.initialTransform : object.initialTransform,
    );
    const placement = fitCatalog(
      bounds,
      originalBase.success ? originalBase.data.size : [1.5, 1.5, 1.5],
    );
    // Each placed item gets its own listing so merchant edits cannot alter the catalog.
    const copy = await tx.product.create({
      data: {
        sceneId,
        name: product.name,
        description: product.description,
        brand: product.brand,
        currency: product.currency,
        price: product.price,
        productUrl: product.productUrl,
        imageAssetId: product.imageAssetId,
        modelAssetId: product.modelAssetId,
        catalogRole: "INSTANCE",
        sourceProductId: product.sourceProductId ?? product.id,
        inferredDetails: json(product.inferredDetails),
        attributes: { demoSourceId: product.id },
      },
    });
    await tx.sceneObject.update({
      where: { id: object.id },
      data: {
        modelAssetId: product.modelAssetId,
        productId: copy.id,
        label: product.name,
        initialTransform: json(placement),
        localBounds: json(bounds),
        provenance: json({
          ...provenance,
          replacementBackup: saved.success
            ? saved.data
            : {
                modelAssetId: object.modelAssetId,
                productId: object.productId,
                label: object.label,
                initialTransform: object.initialTransform,
                localBounds: object.localBounds,
              },
        }),
      },
    });
  });
}
