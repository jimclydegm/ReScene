import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/http";
import { demoProducts } from "@/lib/demo/catalog";
import models from "@/lib/demo/catalog-models.json";
import {
  shoppingIntentSchema,
  shoppingResultSchema,
  stylistInputSchema,
  type StylistInput,
} from "@/lib/shopping/contracts";
import {
  buildCandidates,
  checkCombination,
  checkContext,
  merchandiseTotal,
} from "@/lib/shopping/engine";
import { decimalToCents } from "@/lib/shopping/listing";
import { shoppingIntent, rankShopping } from "@/lib/ai/shopping-stylist";
import { ShoppingResponseError } from "@/lib/ai/shopping-response";
import { arrangementSchema } from "@/lib/demo/state";
import { canonicalJson } from "@/lib/shopping/canonical";

type Actor = { actorHash: string; networkHash: string };
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: unknown) =>
  createHash("sha256").update(canonicalJson(v)).digest("hex");
export const shoppingCatalogRevision = () =>
  // Mesh digests identify immutable geometry. Do not hash serialized floating-point
  // poses: the bundler may emit equivalent numeric literals with different rounding.
  hash({
    products: demoProducts,
    models: models.map(({ id, digest }) => ({ id, digest })),
  });
async function assertCatalog() {
  const rows = await getDb().product.findMany({
    where: {
      catalogKey: { in: demoProducts.map((p) => p.id) },
      catalogRole: "SOURCE",
      catalogStatus: "READY",
    },
    include: { modelAsset: true },
  });
  if (
    demoProducts.some((p) => {
      const row = rows.find((r) => r.catalogKey === p.id),
        m = models.find((m) => m.id === p.id);
      return (
        !row ||
        row.currency !== "USD" ||
        row.price === null ||
        decimalToCents(row.price.toFixed(2)) !== p.price ||
        row.name !== p.name ||
        row.description !== p.description ||
        ["category", "materials", "dimensions", "care", "colors"].some(
          (field) =>
            canonicalJson(
              (row.inferredDetails as Record<string, unknown>)[field],
            ) !== canonicalJson(p[field as keyof typeof p]),
        ) ||
        row.modelAsset?.status !== "READY" ||
        row.modelAsset.sha256 !== m?.digest
      );
    })
  )
    throw new AppError(
      409,
      "CATALOG_CHANGED",
      "The product catalog changed. Refresh the showroom before requesting a look.",
    );
}
export async function reserveShopping(actor: Actor, input: StylistInput) {
  if (process.env.GENERATION_ENABLED !== "true")
    throw new AppError(
      503,
      "STYLIST_DISABLED",
      "The shopping stylist is temporarily unavailable.",
    );
  const error = checkContext(input);
  if (error) throw new AppError(400, "INVALID_ARRANGEMENT", error);
  await assertCatalog();
  const db = getDb(),
    inputHash = hash(input),
    catalogRevision = shoppingCatalogRevision();
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172642)`;
    const prior = await tx.shoppingStylistRequest.findUnique({
      where: {
        actorHash_requestKey: {
          actorHash: actor.actorHash,
          requestKey: input.key,
        },
      },
    });
    if (prior) {
      if (prior.expiresAt < new Date())
        throw new AppError(
          409,
          "STYLIST_EXPIRED",
          "This suggestion expired. Start a new request when ready.",
        );
      if (prior.inputHash !== inputHash)
        throw new AppError(
          409,
          "STYLIST_INPUT_CHANGED",
          "Start a new suggestion after changing the request.",
        );
      return prior;
    }
    if (
      input.voiceAttemptId &&
      !(await tx.voiceAttempt.findFirst({
        where: {
          id: input.voiceAttemptId,
          actorHash: actor.actorHash,
          purpose: "showroom",
          status: "SUCCEEDED",
          expiresAt: { gt: new Date() },
        },
      }))
    )
      throw new AppError(
        400,
        "VOICE_EXPIRED",
        "This recording has expired. You can submit the reviewed text as a typed request.",
      );
    const recent = new Date(Date.now() - 60000);
    if (
      (await tx.shoppingStylistRequest.count({
        where: {
          createdAt: { gte: recent },
          OR: [
            { actorHash: actor.actorHash },
            { networkHash: actor.networkHash },
          ],
        },
      })) >= 6
    )
      throw new AppError(
        429,
        "STYLIST_RATE_LIMIT",
        "Wait a moment before requesting more looks.",
      );
    if (
      await tx.shoppingStylistRequest.count({
        where: {
          actorHash: actor.actorHash,
          status: { in: ["PENDING", "RUNNING", "WAITING"] },
          expiresAt: { gt: new Date() },
        },
      })
    )
      throw new AppError(
        409,
        "STYLIST_BUSY",
        "Finish the current suggestion before starting another.",
      );
    if (
      (await tx.shoppingStylistRequest.count({
        where: {
          status: { in: ["PENDING", "RUNNING", "WAITING"] },
          expiresAt: { gt: new Date() },
        },
      })) >= 8
    )
      throw new AppError(
        429,
        "STYLIST_BUSY",
        "The stylist is busy. Try again shortly.",
      );
    return tx.shoppingStylistRequest.create({
      data: {
        ...actor,
        requestKey: input.key,
        inputHash,
        catalogRevision,
        input: json(input),
        expiresAt: new Date(Date.now() + 15 * 60000),
      },
    });
  });
}
export async function readShopping(actor: Actor, id: string) {
  const row = await getDb().shoppingStylistRequest.findFirst({
    where: { id, actorHash: actor.actorHash, expiresAt: { gt: new Date() } },
  });
  if (!row)
    throw new AppError(
      404,
      "STYLIST_NOT_FOUND",
      "This saved suggestion is unavailable or expired.",
    );
  if (
    row.status === "RUNNING" &&
    Date.now() - row.updatedAt.getTime() > 180000
  ) {
    await getDb().shoppingStylistRequest.updateMany({
      where: { id, status: "RUNNING", updatedAt: row.updatedAt },
      data: {
        status: "SUBMISSION_UNCERTAIN",
        errorCode: "STYLIST_INTERRUPTED",
        errorMessage:
          "The model response was interrupted. Your scene is unchanged; no automatic paid retry was submitted.",
      },
    });
    return {
      ...row,
      status: "SUBMISSION_UNCERTAIN",
      errorMessage:
        "The response was interrupted. Your scene is unchanged. Start a new request when ready.",
    };
  }
  return row;
}
export async function interpretShopping(id: string) {
  const db = getDb(),
    claimed = await db.shoppingStylistRequest.updateMany({
      where: { id, status: "PENDING", expiresAt: { gt: new Date() } },
      data: { status: "RUNNING", phase: "INTERPRETING" },
    });
  if (!claimed.count) return;
  let submitted = false;
  try {
    const row = await db.shoppingStylistRequest.findUniqueOrThrow({
        where: { id },
      }),
      input = stylistInputSchema.parse(row.input);
    await assertCatalog();
    const minimum = Object.entries(input.draft.items)
      .filter(([slot, i]) => input.keep.includes(slot) || i.owned)
      .reduce(
        (n, [slot, i]) =>
          n +
          merchandiseTotal({
            items: { [slot]: i },
            lighting: input.draft.lighting,
          }),
        0,
      );
    if (minimum > input.budgetCents) {
      await db.shoppingStylistRequest.update({
        where: { id },
        data: {
          status: "SUCCEEDED",
          phase: "READY",
          result: json({
            summary: "Your kept purchases exceed the budget.",
            notice:
              "Increase the budget, unkeep a purchased item, or mark an item you already own.",
            options: [],
            checked: 0,
            catalogRevision: row.catalogRevision,
            effectiveBudgetCents: input.budgetCents,
          }),
        },
      });
      return;
    }
    submitted = true;
    const interpreted = await shoppingIntent(input),
      intent = interpreted.value;
    await db.shoppingStylistRequest.update({
      where: { id },
      data: {
        intent: json(intent),
        usage: json({ intent: interpreted.usage }),
        phase: "CHECKING",
        status: "WAITING",
      },
    });
  } catch (error) {
    await markShoppingFailure(id, error, submitted);
  }
}
export async function completeShopping(id: string) {
  const db = getDb(),
    claimed = await db.shoppingStylistRequest.updateMany({
      where: { id, status: "WAITING", expiresAt: { gt: new Date() } },
      data: { status: "RUNNING", phase: "CHECKING" },
    });
  if (!claimed.count) return;
  let submitted = false;
  try {
    const row = await db.shoppingStylistRequest.findUniqueOrThrow({
        where: { id },
      }),
      input = stylistInputSchema.parse(row.input),
      intent = shoppingIntentSchema.parse(row.intent);
    await assertCatalog();
    if (intent.budgetCents !== null && intent.budgetCents !== input.budgetCents)
      intent.clarification =
        "The budget in your instruction differs from the budget field. Update the field and request your looks again.";
    const search = intent.clarification
      ? {
          candidates: [],
          checked: 0,
          budget: input.budgetCents,
          notice: intent.clarification,
        }
      : buildCandidates(input, intent);
    let options: Prisma.InputJsonValue[] = [];
    if (search.candidates.length) {
      await db.shoppingStylistRequest.update({
        where: { id },
        data: { phase: "COORDINATING" },
      });
      submitted = true;
      const ranked = await rankShopping(
        input,
        intent.summary,
        search.candidates,
      );
      submitted = false;
      const ids = new Set<string>();
      options = ranked.value.options.map((choice) => {
        const candidate = search.candidates.find(
          (c) => c.id === choice.candidateId,
        );
        if (
          !candidate ||
          ids.has(choice.candidateId) ||
          checkCombination(input, intent, candidate.draft)
        )
          throw new Error("INVALID_SHOPPING_SELECTION");
        ids.add(choice.candidateId);
        return json({
          id: candidate.id,
          title: choice.title,
          reason: choice.reason,
          draft: candidate.draft,
          subtotalCents: candidate.subtotalCents,
          remainingCents: search.budget - candidate.subtotalCents,
          changes: candidate.changes,
          kept: [...new Set([...input.keep, ...intent.keep])],
        });
      });
      if (search.candidates.length > 1 && options.length !== 2)
        throw new Error("INCOMPLETE_SHOPPING_SELECTION");
      await db.shoppingStylistRequest.update({
        where: { id },
        data: {
          usage: json({
            ...(row.usage as Record<string, unknown>),
            ranking: ranked.usage,
          }),
        },
      });
    }
    const result = shoppingResultSchema.parse({
      summary: intent.summary,
      notice: search.notice,
      options,
      checked: search.checked,
      catalogRevision: row.catalogRevision,
      effectiveBudgetCents: search.budget,
    });
    await db.shoppingStylistRequest.update({
      where: { id },
      data: { status: "SUCCEEDED", phase: "READY", result: json(result) },
    });
  } catch (error) {
    await markShoppingFailure(id, error, submitted);
  }
}
async function markShoppingFailure(
  id: string,
  error: unknown,
  submitted: boolean,
) {
  const known = error instanceof AppError;
  const responded = error instanceof ShoppingResponseError;
  const prior = responded ? await getDb().shoppingStylistRequest.findUniqueOrThrow({ where: { id } }) : null;
  await getDb().shoppingStylistRequest.update({
    where: { id },
    data: {
      status: submitted && !responded ? "SUBMISSION_UNCERTAIN" : "FAILED",
      phase: "FINISHED",
      errorCode: known || responded ? error.code : "STYLIST_UNAVAILABLE",
      ...(responded ? { usage: json({ ...(prior!.usage as Record<string, unknown>), failure: error.diagnostic }) } : {}),
      errorMessage: known
        ? error.message
        : "The stylist could not finish these looks. Your scene is unchanged; no automatic paid retry was submitted.",
    },
  });
}
/** CLI/test orchestration; production gives each paid call its own workflow step. */
export async function executeShopping(id: string) {
  await interpretShopping(id);
  await completeShopping(id);
}
export async function applyShopping(
  actor: Actor,
  id: string,
  optionId: string,
  rawDraft: unknown,
) {
  const row = await readShopping(actor, id);
  if (row.status !== "SUCCEEDED" || !row.result)
    throw new AppError(
      409,
      "STYLIST_NOT_READY",
      "This suggestion is not ready to apply.",
    );
  await assertCatalog();
  if (row.catalogRevision !== shoppingCatalogRevision())
    throw new AppError(
      409,
      "CATALOG_CHANGED",
      "The catalog changed. Request fresh suggestions.",
    );
  const input = stylistInputSchema.parse(row.input),
    draft = arrangementSchema.parse(rawDraft),
    result = shoppingResultSchema.parse(row.result),
    option = result.options.find((o) => o.id === optionId);
  if (!option || hash(input.draft) !== hash(draft))
    throw new AppError(
      409,
      "STYLIST_STALE",
      "Your scene changed. Request suggestions for the current arrangement.",
    );
  const error = checkCombination(
    input,
    shoppingIntentSchema.parse(row.intent),
    option.draft,
  );
  if (error) throw new AppError(409, "STYLIST_INVALID", error);
  return option;
}
