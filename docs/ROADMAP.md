# ReScene — one release pass

Updated October 29, 2026, Asia/Manila. This replaces the incremental phase schedule. Jim requested bulk implementation and fewer repeated tests/deployments. Build freeze remains November 2; aim to finish the app sooner.

Core flow already works: private photo → live Meta analysis/masks → separate meshes → room/texture/light editing → product cards/replacements → frozen shopper viewer. A fresh deployed two-model author-to-shopper run and 47 focused tests already passed; do not repeat paid inference for unchanged code.

## Current release bundle

- [x] Project management: name/description editing, search/status filters, active sharing indicators, reversible archive/restore with share revocation.
- [x] Complete editor flow: publish shortcut, project details, consistent saved state, explicit discard/reload recovery and protection against leaving unsaved work.
- [x] Release reliability: retry/expired-asset recovery, clear loading/empty/error states, preserve owned data and snapshot isolation.
- [x] Reduce repeated work: one PR CI run per feature change, cancel superseded runs, skip docs-only Vercel builds, one reusable saved-data regression command.
- [x] One combined verification pass: focused unit tests + lint/typecheck/build + one saved-scene integration run; one production deployment and bounded post-deploy check.
- [x] Refresh the short handoff and Indie developer demo/submission documents around the final release.

Do all items within one branch/PR. Do not stop after each item or request another “next phase” instruction. Fix failures within the same pass, and repeat only affected checks when something changed.

Release bundle shipped in PR #10 at 648010b. All 52 tests and PR CI pass, the single saved-data regression passes, and the bounded read-only production smoke passes. No new inference, QA projects or photo/model uploads.

## Current correction bundle: any scene or product

Jim deferred recording/portal work and requested a single broader UX/pipeline correction.

- [x] Remove furniture-only analysis categories, room-specific entry copy and lighting-based candidate priority.
- [x] Analysis focus/instructions/item limit; manually add items even after zero candidates.
- [x] Independent outline retries with text or box/include/exclude points; keep other accepted masks.
- [x] Persist multiple matches, select saved outlines, combine multi-part product masks without inference.
- [x] Fit portrait photo/3D views, improve review controls, reconstruction seed, backdrop and placement resets.
- [x] Complete targeted live clothing/recovery checks, PR #11 merged at 90f5911, READY production release and bounded production verification.

The clothing correction has 61 passing unit cases, passed CI/build and saved-data/API checks, and a real three-item clothing reconstruction saved privately. Production controls/authorization/recovery smoke checks pass with no further inference. Native browser interaction remains unverified.

## Complete subjects and automatic discovery correction

- [x] Research Objects vs Body/Align and diagnose missing subject, mask-scale rejection and median-floor bugs.
- [x] Automatic complete subjects plus product relationships; remove count question and arbitrary three-piece selection limit.
- [x] Reconstruct roots once; derive disjoint product regions with shared geometry/appearance/placement and whole-subject editing.
- [x] Conservative ground envelope, legacy editor-plane correction and frozen public floor placement.
- [x] Rescaled-mask handling, automatic shoe-pair union, grouped publication/privacy guards and safe partial fallback.
- [x] Live full-person experiment/adoption plus 65 tests and reusable saved-data/assembly checks.
- [x] PR #12 merged at f58d4eb; READY production release and bounded deployed verification pass.

## General supports and source-detail correction — October 30

- [x] Inspect reported desk scene and test the specific Body/Align endpoints without replacing textured appearance.
- [x] Balanced general analysis and separate support/attachment relationships.
- [x] Tabletop contact settling, shared-plane fallback and actual vertex contact refinement.
- [x] Ten-mesh source transfer, per-root registration, 2K copy, refresh/restore and optional automatic post-ingest application.
- [x] Repair saved desk output, verify contact/source restore, static/browser appearance and focused tests.
- [x] PR #13 merged at a6c8b76; 72 cases and CI pass, production READY, bounded deployed API checks and Chrome desktop/mobile controls pass.

## Photo-matched background correction — October 30

- [x] General open/plane/distant observations; remove inferred room boxes, side walls and baseboards.
- [x] One durable Muse clean-plate edit, bounded mask compositing/blending and smooth-gradient preservation; independent existing-scene refresh.
- [x] Shared private/public rendering, immutable background allowlists, existing-source privacy and READY failure preservation.
- [x] PR #14 merged at 2a927ed; 83 tests and CI pass, production READY, bounded deployed desktop/mobile and read-only API checks pass.

## External completion gates

Browser access is now available through Chrome; record desktop/mobile checks per release. Recording remains deferred. Participant video limits/private portal fields and actual submission need the authenticated portal and final user review. Keep these separate from implemented app functionality. Continue independent work; do not label these gates as passed.

Original phase history: history/ROADMAP_2026-10-29.md. Technical contracts: ARCHITECTURE.md, DATA_MODEL.md, META_MODELS.md. Current state: CONTEXT.md.

## Plain backgrounds, zoom control and mesh-quality investigation — October 30

- [x] Plain-field background detection without baked cast shadows or unnecessary image inference.
- [x] Zoom lock beside Show grid; retain rotation and pan in private/public viewer.
- [x] Research hosted parameters; bounded one-job mask experiment, immutable reviewed masks and recorded derived-mask provenance.
- [x] Keep opening refinement experimental/off by default after the comparison failed to show clear overall geometry improvement; preserve the saved mesh.
- [x] PR #15 merged at 9e30944; 90 cases and CI pass, production READY and bounded read-only release/controls/shoe checks pass. Live desktop/mobile Zoom lock interaction remains unverified because browser access was disabled at verification time.

## Simple textured surfaces and shadow stability — October 30

- [x] Diagnose broad floor incorrectly reconstructed as thick object geometry plus duplicated shadow layers.
- [x] General surface/object routing across analysis, review, reconstruction, layout, appearance/background and publication.
- [x] One opaque textured ground/shadow plane; bounded shadow depth and no generated-mesh self-shadow acne.
- [x] Repair reported vase/stone scene using saved assets, preserving original meshes; zero inference calls.
- [x] PR #16 merged at d1a5077; 96 cases and CI/build pass, production READY, read-only scene/texture/privacy/release checks pass. Live GPU/desktop/mobile/flicker verification remains pending because browser access reports disabled.

## Reference layout review and assembly reliability — October 30

- [x] Diagnose duplicate complete-object/part reconstruction, AABB-top stacking and missing manual-object orientation metadata.
- [x] Mask-supported shared-region inference and legacy disjoint assembly repair; preserve geometry/UVs and undo references.
- [x] Bounded actual-mesh/reference-mask placement review, conservative upright candidates, visible quality metrics and residual warnings.
- [x] Automatic review after reconstruction plus existing-scene review/refine action and reviewed texture baseline.
- [x] Repair reported bedroom with saved assets and zero inference; lamp shape remains flagged.
- [x] PR #17 merged at a4c1cd9; 103 cases and CI/build pass, production READY, saved-data undo and bounded production reference/report/SSR/privacy/release checks pass. Native GPU/browser checks remain unavailable; the CPU preview is not a browser pass.

## Editor controls, screenshot downloads and logical undo — October 30

- [x] Preview background toggle beside Zoom lock; repeat-click and empty-space deselection.
- [x] Tilt/lean controls with saved quaternion round-trip, focus selected, isolate complete subject and show all.
- [x] Scene/transparent PNG downloads through bounded offscreen rendering, with clean exports and state restoration.
- [x] One undo action per input gesture/text edit, combined object/product/light history, keyboard shortcuts and no-op handling.
- [x] 116 unit cases/build pass; saved-data tilt/reload/legacy edit checks pass with QA restoration; zero inference/uploads.
- [x] PR #18 merged at 3f97496; CI passes, production READY, bounded editor validation/SSR/privacy/release checks pass. Native GPU, grouped gestures, download results and responsive layout remain unverified while browser access is disabled.

## Background failure and manual-stage recovery — October 30

- [x] Trace the failed run to scene-axis rejection before background inference, rather than a Muse API outage.
- [x] Ignore arbitrary local axes as leveling votes while retaining poses and coordinate validity checks; explicit camera-up fallback warning.
- [x] Allow background builds without photo placement, preserve manual edits/catalog replacements, label the camera approximation and retain internal local-failure diagnostics.
- [x] One recorded Muse Image verification succeeded; saved object/product state preserved and 405,791 known background pixels unchanged. No model regeneration or automatic retries.
- [x] 122 unit cases, typecheck/lint/build pass. Native browser checks remain unavailable in Work settings.
- [x] PR #19 merged at 02dc76d; CI passes, production READY and bounded read-only smoke passes with zero runtime error records.

## Creative showroom bundle — October 30

- [x] Research public Indie criteria and Meta multi-reference image API; save architecture/demo/verification plan in CREATIVE_SHOWROOM.md.
- [x] Additive appearance/COMPOSE_IMAGE migration; validated colors and light presets across editor/history/publication.
- [x] Private product-reference uploader, illustrative product templates, scene/aspect/prompt controls, durable generation and queued recovery.
- [x] Generated gallery and explicit result adoption into separately owned 3D projects; two entry choices on New Scene.
- [x] Initial 130 tests/lint/build; registered 30 steps / 3 workflows, migration applied.
- [x] Saved color/light/public snapshot verified and QA restored. One real production two-reference composition/adoption and duplicate-dispatch/ownership checks pass. PR #20 merged; production upload correction deployed. Native browser verification remains blocked.

## Creation UI and relational library correction

- [x] Generate 12 photographic sample products and four scene previews with Meta; version assets and preserve prompts.
- [x] Compact starting page; consistent buttons/captions, search/categories, selection tray and visual setting/aspect controls.
- [x] Six relational library/draft/history/adoption tables with FKs, indexes, SQL visibility checks and legacy backfills.
- [x] Real draft/conflict/frozen-history/sample-output/adoption checks pass. PR #21 merged at ed1d70c; CI and production asset/draft/SSR checks pass, production READY. Native visual checks remain blocked by Work settings.

## Image/project trash and simple scene presets

- [x] Image deletion/Trash/restore with owner checks, active-reference guard and preserved history/adoptions.
- [x] Project Delete/Trash wording backed by existing share-revoking archive/restore operation.
- [x] Twelve simple photographic samples, 22 active products total; plants/paired shoes retired from selection.
- [x] Eight empty environment previews and matching no-extra-products prompt controls; old template versions/media retained.
- [x] Saved-data and production confirmation/delete/Trash/restore, sample/setting asset and SSR checks pass. PR #22 merged at 1b69385; CI and production READY. Native visual checks remain blocked by Work settings.

## Composition quality and selective paid recovery

- [x] Actual setting references, numbered inventory/framing/relative-scale constraints and high Muse reasoning.
- [x] Private structured image checks, visible warnings and explicit paid image correction with frozen request/refinement lineage.
- [x] Spatial mask matching and contact-constrained layout with real support heights.
- [x] Independent-object retry with confirmation/seed, same-camera fit, previous-mesh retention and known-job resume.
- [x] Saved-example mask recovery, box reconstruction and jar contact checked; poorer chair/lid retry meshes retained privately, previous models kept.
- [ ] Final checks, merge, production API/SSR verification and release notes.
