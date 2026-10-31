import { z } from "zod";
import type { ContactEntry } from "./placement";
import type { Coverage } from "./material-bake";
import { correctionTypes, type QualityReviewObservation } from "./contracts";

// Numeric review of the actual final output. No single overlap score passes an
// object; each check names its layer and a bounded correction.
export const reviewIssueSchema = z.object({
  type: z.string().max(40), severity: z.enum(["info", "warn", "error"]), value: z.number(), detail: z.string().max(240),
  source: z.enum(["numeric", "spark"]), correction: z.enum(correctionTypes)
}).strict();
export const objectReviewSchema = z.object({
  id: z.string(), label: z.string(), verdict: z.enum(["PASS", "NEEDS_REVIEW", "REJECT"]),
  metrics: z.object({
    iou: z.number(), iouBefore: z.number(), occluded: z.number(), appearanceBefore: z.number().nullable(), appearanceAfter: z.number().nullable(),
    coverage: z.object({ observed: z.number(), generated: z.number(), inferred: z.number(), unmapped: z.number(), protected: z.number() }).strict().nullable(),
    seamBefore: z.number().nullable(), seamAfter: z.number().nullable()
  }).strict(),
  issues: z.array(reviewIssueSchema)
}).strict();
export type ObjectReview = z.infer<typeof objectReviewSchema>;
export type Correction = (typeof correctionTypes)[number];

export function numericReview(input: {
  id: string; label: string; iou: number; iouBefore: number; occluded: number; appearanceBefore: number | null; appearanceAfter: number | null;
  coverage: Coverage | null; seams: { before: number; after: number } | null; contact: ContactEntry | null; geometryRejected: string[];
}): ObjectReview {
  const issues: ObjectReview["issues"] = [], add = (type: string, severity: "info" | "warn" | "error", value: number, detail: string, correction: Correction = "none") => issues.push({ type, severity, value, detail, source: "numeric", correction });
  if (input.iou < .5) add("silhouette", "warn", input.iou, "Final render and reviewed mask disagree; shape or placement needs a look.");
  if (input.iou < input.iouBefore - .02) add("silhouette-regression", "error", input.iou - input.iouBefore, "Photo fit dropped after the quality pass.", "revert-object");
  if (input.occluded > .15) add("occlusion", "warn", input.occluded, "Another object covers this object where the photo shows it.");
  if (input.coverage && input.coverage.unmapped > .01) add("texture-coverage", "warn", input.coverage.unmapped, "Part of the surface has no usable texture coordinates.");
  if (input.seams && input.seams.after > input.seams.before + 8) add("seams", "warn", input.seams.after - input.seams.before, "UV seams became more visible after baking.", "revert-object");
  if (input.appearanceBefore !== null && input.appearanceAfter !== null && input.appearanceAfter > input.appearanceBefore + 6) add("appearance-regression", "error", input.appearanceAfter - input.appearanceBefore, "Visible base color moved away from the de-lit photo.", "revert-object");
  const c = input.contact;
  if (c) {
    if (c.floating) add("floating", "warn", c.gap, "No base contact reaches the support.", "reseat");
    if (c.penetration > .01) add("sinking", "warn", c.penetration, "The base sinks into its support.", "reseat");
    if (c.stable === false) add("unstable", "warn", c.contacts, "The center of mass lies outside the contact area.");
    if (c.wallPenetration > .005) add("wall", "error", c.wallPenetration, "Geometry passes through an observed wall.", "wall-clearance");
    if (c.collisions.length) add("collision", "error", c.collisions.length, "Intersects another object.", "separate");
    if (c.duplicateOf) add("duplicate", "warn", 1, "Occupies the same space as another object; one may duplicate the other.");
    if (c.baseTilt > 2) add("not-flush", "warn", c.baseTilt, "The base is tilted against its support instead of resting flat.", "reseat");
  }
  for (const reason of input.geometryRejected) add("geometry-kept", "info", 0, `Repair candidate rejected (${reason}); previous geometry kept.`);
  const verdict = issues.some(i => i.severity === "error") ? "REJECT" : issues.some(i => i.severity === "warn") ? "NEEDS_REVIEW" : "PASS";
  return { id: input.id, label: input.label, verdict, issues, metrics: {
    iou: input.iou, iouBefore: input.iouBefore, occluded: input.occluded, appearanceBefore: input.appearanceBefore, appearanceAfter: input.appearanceAfter,
    coverage: input.coverage ? { observed: input.coverage.observed, generated: input.coverage.generated, inferred: input.coverage.inferred, unmapped: input.coverage.unmapped, protected: input.coverage.protected } : null,
    seamBefore: input.seams?.before ?? null, seamAfter: input.seams?.after ?? null
  } };
}

// Spark proposals are hypotheses. A correction survives only when a numeric
// check for the same object supports it; nothing is applied twice.
export function mergeSparkReview(reviews: ObjectReview[], spark: QualityReviewObservation, ids: string[]) {
  const accepted = new Map<string, Correction>();
  for (const entry of spark.objects) {
    const id = ids[Number(entry.objectId.slice(7)) - 1], review = reviews.find(r => r.id === id); if (!review) continue;
    for (const issue of entry.issues) {
      review.issues.push({ type: `spark:${issue.type}`, severity: issue.severity === "high" ? "warn" : "info", value: issue.confidence, detail: `${issue.observed ? "Observed" : "Inferred"}: ${issue.evidence}`.slice(0, 240), source: "spark", correction: issue.correction });
      if (issue.correction === "none" || issue.confidence < .6) continue;
      const supported = review.issues.some(i => i.source === "numeric" && (i.correction === issue.correction || issue.correction === "revert-object" && i.severity !== "info"));
      if (supported && !accepted.has(id)) accepted.set(id, issue.correction);
    }
    if (entry.verdict !== "PASS" && review.verdict === "PASS") review.verdict = "NEEDS_REVIEW";
  }
  return accepted;
}

// Mean color distance between a render and the de-lit photo where the object
// is both visible and masked. A coarse material-fidelity signal only.
export function appearanceDifference(render: Uint8Array, owners: Int16Array, width: number, height: number, photo: Float32Array, mask: Uint8Array, photoWidth: number, photoHeight: number, object: number) {
  let sum = 0, count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x; if (owners[i] !== object) continue;
    const px = Math.min(photoWidth - 1, Math.floor((x + .5) * photoWidth / width)), py = Math.min(photoHeight - 1, Math.floor((y + .5) * photoHeight / height)), at = py * photoWidth + px;
    if (mask[at] < 200) continue;
    sum += Math.hypot(render[i * 3] - photo[at * 3], render[i * 3 + 1] - photo[at * 3 + 1], render[i * 3 + 2] - photo[at * 3 + 2]) / Math.sqrt(3); count++;
  }
  return count > 20 ? sum / count : null;
}
