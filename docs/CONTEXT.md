# ReScene — current handoff

Updated October 30, 2026 (Asia/Manila). Read this and the latest ROADMAP entry first; historical milestones are not another work queue.

## Objective and working style

Finish the photo-to-shoppable-3D hackathon app before November 2. Jim registered in **Indie developer**. Any scene/product is in scope, including people, animals, clothing, food and electronics. Furniture is a demo, never a detection restriction. Work in bulk with one combined PR/release. Do not invent micro-phases, repeat paid generation for unchanged code, or infer another phase without a request.

## Stack, access and guardrails

- Next 16.4.3/React 19.3.1, R3F/Three/Drei, Prisma 7.10.1, Neon Postgres/Managed Better Auth, private R2, Vercel Node22/iad1 and GitHub. Read installed Next docs before code changes.
- Local/preview/production share DB/storage. A git branch is not data isolation. Protect saved user data with backups and revision CAS; restore the disposable QA fixture. Preserve concurrent user commits.
- Secrets stay in ignored .env.local/Vercel. Never print/commit keys, private signed URLs, provider request IDs or raw artifacts. Vercel MCP OAuth remains pending; pinned CLI65.8.0 works. Staging deletion remains disabled at Jim's request.
- Jim removed the cumulative generation cap. Never add GENERATION_BUDGET_USD again. Meta/fal bills are separate. Keep one active user run, revision/idempotency/owner/origin guards, known-job resume and **zero automatic paid resubmissions**. Reuse paid results.
- Source photos/masks/predictions/prompts/review are private. Publication v2 exposes only approved derived render assets and merchant-entered product fields through a frozen allowlist. Existing signed links last up to15min; downloads cannot be recalled.
- Never promise exact identity, measurements, hidden geometry/material or garment fit from one photo. WorldGen has no verified API. SAM3.1 is segmentation; SAM3D Objects is reconstruction.

## Working product

Private upload → Muse Spark general analysis → SAM3.1 reviewed masks → textured SAM3D Objects through fal → placement/source-detail/product/light editing → unlisted frozen shopper viewer. Runtime Meta models are required. Body/Align were private untextured experiments, not runtime defaults.

Implemented: project/image Trash+restore, compact dashboard/search/pagination, restart confirmation, mask prompts/boxes/points/alternatives, automatic complete subjects and disjoint product regions, support/contact settling, mask-overlap placement review, source-detail texture transfer/restore, object color/transform/focus/isolation/deselection, grouped undo/redo, PNG downloads, Zoom lock/background preview, Day/Dusk/Night/Studio lighting, catalog replacements and private/public viewers. Mask overlap is not full rendered-image similarity. Clothing/body and hidden geometry remain approximate.

Creative showroom: real sample product photos, empty scene previews, multi-reference Muse composition, persisted drafts/history/adoptions and generated image library. Inventory/framing/scale/setting instructions plus private Spark checks expose composition inconsistencies. Explicit user-confirmed paid image correction/independent-mesh retries retain earlier outputs. Hosted Objects has no verified quality/resolution/topology control. Muse has no documented negative_prompt parameter; exclusions use the normal prompt. Experimental opening-mask refinement remains OFF by default after an inconclusive shoe comparison.

## Current release: reference environment backgrounds

PR #25 merged at **835efd8**. Production **rescene-j05bdhphz-jimclydegms-projects.vercel.app** is READY and aliased to rescene-eta.vercel.app. All179 cases, schema/lint/types/build and PR/main CI pass.

A dedicated Spark environment planner represents individual floors/walls/ceilings/trim/openings and separates materials from illumination. Room/textured planar backgrounds use cached Meta VGGT depth; its padding is removed explicitly. Common-frame plane fitting, floor contacts and shared-corner constraints preserve the saved camera/object coordinates. Windows are holes plus inset photograph cards. The floor is one continuous opaque ground/shadow plane; observed walls extend beyond the crop and cut away from outside. Plain fields/studio sweeps/distant context retain their appropriate routes.

One Muse edit recovers an empty intrinsic background. Plain finishes stay uniform; bounded source detail and generated occlusion detail exclude foreground, with low-frequency illumination removed. Plane-coordinate texture continuation avoids a visible plain rectangle beyond the crop. Coverage/corner/expected-wall checks can reject an incomplete structure; private image-review differences remain visible as PARTIAL notes. This is not a full rendered-scene similarity certificate. Previous background restore, saved-job reuse/resume, zero paid retries and immutable publication are preserved. Layout matching rebuilds numeric geometry from saved evidence without inference; undo restores its background plan. No SQL migration/new key. See REFERENCE_ENVIRONMENTS.md for contracts and limitations.

Reported living room eb34c54c was updated at revision9 through the deployed durable workflow using saved paid results: three walls, floor, trim and window, full planned coverage and .76% maximum corner disagreement. One VGGT job, one Muse image and two Spark calls; no object regeneration. Image review flagged window/baseboard/material differences; do not hide them or claim exact recovery. Private backups/evidence live under ignored test-results/environment. Objects, products, camera and lights are verified unchanged. Same-scene snapshot geometry/albedo allowlisting, private-field exclusion and two-way background restore pass on the disposable QA fixture; it is restored and its temporary share revoked. The bounded production error scan returned zero records.

Chrome access is available. Native local WebGL checks cover framing, room/floor rendering, texture continuation, orbit/Zoom lock and Day/Night. Production desktop/390×844 rendering, method controls and report also pass with zero browser errors. Do not assume every historical control was tested. Local3000 belongs to another project. R2 CORS blocks3001; do not change credentials/CORS for testing. The ignored private localhost4317 harness rendered the actual shared component and is stopped. Leave the user's original shoe tab and its unsaved edits alone.

## Fixtures and verification

- **Never mutate:** f2848b95-8447-41eb-9544-0d72dd605565, Jim's real listing.
- **Disposable saved-data QA:** 6800b8a2-7c39-4a52-8fde-790eb03ab46c. Restore state/settings/models after checks; revoke temporary shares.
- Current background: eb34c54c-3795-4cb0-a17a-3264f29c753e. Earlier background:41f2f4b8-5f05-4834-a5f3-0345f9015c39.
- Bedroom:43af6e59-525e-4f3e-a401-24116a97f84b; vase:b80dc2df-4fc8-4bb1-abef-742f2f10e302; shoe:db8ee6d5-fc99-42f3-8b71-5d0b1f772157; desk:c9035519-8cf4-45cd-88c2-36d32571eff1; clothing:2b495855-65dc-4ca3-ad93-1460e53eb5fe.

Run appropriate focused checks and required schema/lint/tests/build; do not repeat unchanged suites or paid sweeps. CI cancels superseded runs and skips docs-only builds; Vercel ignores docs/test/tooling-only changes. Keep .git in builds. Use scripts/verify-release.mjs once for saved-data regression, --smoke for bounded read-only production checks. Verify the actual PR head/checks before merging. Use the GitHub integration when available; CLI is a fallback. Wait for the single automatic main deployment; don't deploy twice.

Recording/portal fields and final submission remain human gates, not incomplete app implementation. Do not reopen them without a request. Technical references: ARCHITECTURE, DATA_MODEL, META_MODELS, PLAN, SCENE_QUALITY, SCENE_UNDERSTANDING, TEXTURE_FIDELITY, BACKGROUND_RECONSTRUCTION, REFERENCE_ENVIRONMENTS, TESTING and SETUP. Contract: contracts/scene-manifest-v2.schema.json. Submission draft: release/DEMO.md. Earlier detailed handoff: history/CONTEXT_2026-10-30_pre_environment.md.

Next action: Jim can reload the reported project. For other saved projects use Scene → Reference → Rebuild background; new reconstruction uses the new route automatically. Remaining window/material review notes stay visible. Do not regenerate objects or repeat inference just to recheck this release.

## Active correction: analysis request recovery

Branch codex/analysis-recovery fixes d32eb8e2-e6df-4d90-b621-0f87f41ca428 (FAILED revision1, no objects/masks). The PR25 render schema leaked optional geometry into strict Spark output. Exact request-schema reproduction returns HTTP400: missing geometry in required. It was mislabeled SUBMISSION_UNCERTAIN because the original workflow discarded error detail. Explicit observation schemas plus local strict validation now prevent this; request/response phases and private raw receipts distinguish rejection from connection loss. Compact Analysis controls hide optional focus behind a disclosure; failed runs no longer show a clothing-specific empty-result notice. 188 tests/schema/lint/types/build pass. Deploy and recover this saved photo once; no 3D generation needed. Browser was available for before screenshot (322px analysis panel), then became disabled; an enable request is pending while independent work continues. Ignored evidence: test-results/recovery.
