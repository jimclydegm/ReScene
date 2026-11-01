import "server-only";
import { getDb } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { productThumbnail } from "./product-thumbnail";
import { record } from "./composition";
import { isBackgroundSurface } from "@/lib/scene/surface-role";
import { listingProfile } from "@/lib/shopping/listing";

const protectedScene = "f2848b95-8447-41eb-9544-0d72dd605565";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/** No inference. Keep one listing per source object and preserve merchant edits. */
export async function syncSceneProducts(sceneId: string) {
  if (sceneId === protectedScene) return { saved: 0 };
  const db = getDb(),
    scene = await db.scene.findFirst({
      where: { id: sceneId, archivedAt: null, status: "READY" },
      include: {
        normalizedAsset: true,
        objects: {
          where: { status: "READY", modelAssetId: { not: null } },
          include: { model: true, product: true },
        },
      },
    });
  if (!scene) return { saved: 0 };
  const eligible = scene.objects.filter(
    (o) =>
      o.model?.status === "READY" &&
      o.model.kind === "MODEL_GLB" &&
      o.model.sceneId === sceneId &&
      !record(o.provenance).catalogSuppressed &&
      !record(o.provenance).replacementBackup &&
      !isBackgroundSurface(o, {
        width: scene.normalizedAsset?.width ?? 0,
        height: scene.normalizedAsset?.height ?? 0,
      }),
  );
  if (
    !eligible.some(
      (o) =>
        !o.product?.catalogRole ||
        o.product.modelAssetId !== o.modelAssetId ||
        !o.product.imageAssetId ||
        !o.product.description,
    )
  )
    return { saved: 0 };
  const thumbs = new Map<string, string>();
  for (const o of eligible)
    if (!o.product?.imageAssetId)
      try {
        const id = await productThumbnail(sceneId, o.id);
        if (id) thumbs.set(o.id, id);
      } catch {
        /* A thumbnail failure cannot lose a mesh. */
      }
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
      const guard = await tx.scene.updateMany({
        where: {
          id: sceneId,
          revision: scene.revision,
          archivedAt: null,
          status: "READY",
        },
        data: { revision: { increment: 1 } },
      });
      if (!guard.count) return { saved: 0 };
      let saved = 0;
      for (const old of eligible) {
        const o = await tx.sceneObject.findFirst({
          where: { id: old.id, sceneId, modelAssetId: old.modelAssetId },
          include: { product: true },
        });
        if (!o) continue;
        const profile = listingProfile(o.label, o.category ?? ""),
          existing =
            o.product ??
            (await tx.product.findUnique({ where: { sourceObjectKey: o.id } })),
          p = record(o.provenance);
        if (existing && existing.sceneId !== sceneId) continue;
        const independent = !p.assemblyRootId && !p.parentObjectId;
        const details = {
          ...profile,
          ...record(existing?.inferredDetails),
          version: 1,
          originObjectId: o.id,
          independent,
          listingOrigin: "authored-catalog",
        };
        const data = {
          name: existing?.name ?? o.label,
          description: existing ? existing.description : profile.description,
          brand: existing?.brand ?? "ReScene Collection",
          sku: existing?.sku ?? `RS-${o.id.slice(0, 8).toUpperCase()}`,
          price: existing ? existing.price : profile.price,
          currency: existing ? existing.currency : "USD",
          modelAssetId: o.modelAssetId,
          imageAssetId: existing?.imageAssetId ?? thumbs.get(o.id) ?? null,
          inferredDetails: json(details),
        };
        // Imported instances stay detached from their source's canonical listing.
        const product = existing
          ? await tx.product.update({
              where: { id: existing.id },
              data: {
                ...data,
                ...(!existing.catalogRole
                  ? {
                      catalogRole: "SOURCE",
                      sourceObjectKey: o.id,
                      catalogStatus: independent ? "READY" : "DRAFT",
                    }
                  : {}),
              },
            })
          : await tx.product.create({
              data: {
                ...data,
                sceneId,
                catalogRole: "SOURCE",
                sourceObjectKey: o.id,
                catalogStatus: independent ? "READY" : "DRAFT",
              },
            });
        if (o.productId !== product.id)
          await tx.sceneObject.update({
            where: { id: o.id },
            data: { productId: product.id },
          });
        saved++;
      }
      return { saved };
    },
    { timeout: 30000 },
  );
}

/** Called after terminal generation, including optional quality/background steps. */
export async function syncGeneratedProducts(runId: string) {
  const db = getDb(),
    run = await db.generationRun.findUnique({
      where: { id: runId },
      select: { sceneId: true, status: true, errorCode: true },
    });
  // A known paused job must keep its original revision so Resume remains valid.
  if (
    run &&
    !["KNOWN_BACKGROUND_JOB_INTERRUPTED", "KNOWN_JOB_INTERRUPTED"].includes(
      run.errorCode ?? "",
    ) &&
    ["SUCCEEDED", "PARTIAL"].includes(run.status)
  )
    await syncSceneProducts(run.sceneId);
}
