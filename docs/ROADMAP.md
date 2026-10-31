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
- [x] 150 cases/schema/lint/types/build, CI and production control/API validation pass. PR #23 merged at f9cf672; production READY. Native visual interaction verification remains access-dependent.

## Structure-first background materials

- [x] Source-scoped surface/topology/light analysis before reconstruction and background construction.
- [x] Confident architectural seam/corner geometry, continuous studio sweep, conservative uncertain-edge handling.
- [x] Solid plain materials and swatch-only shadow-free Muse tiles with validation/fallback and immutable raw output.
- [x] Relightable surfaces, shared private/public renderer, clean/photo mode and previous-background restore.
- [x] Peach-source analysis and one wood tile verified; no object reconstruction inference used.
- [x] 164 cases/schema/lint/types/build and CI pass. PR #24 merged at ce0aa53; production READY, API restore/validation checks and native WebGL/desktop/mobile/orbit/relighting verified.

## Reference environment reconstruction — October 30

- [x] Diagnose the one-wall contract and research studio projection/material/plane-fitting workflows.
- [x] Dedicated source-scoped Spark surface graph, visible walls/ceiling/trim/openings and cached Meta VGGT depth.
- [x] Shared-frame connected planes, floor contacts, opening holes, one continuous ground, cropped-wall and texture continuation.
- [x] Intrinsic reference materials, foreground exclusion, visible geometry/image review and previous-background restore.
- [x] Known-job reuse/resume, stale/cancel guards, layout reframing/undo and render-only publication contract.
- [x] Prepare reported photo without object regeneration; native local Chrome WebGL/lighting/orbit checks and focused safeguards.
- [x] 179 cases/schema/lint/types/build and CI pass. PR #25 merged at 835efd8; production READY, reported scene updated through the deployed saved-result workflow, objects/products/camera/lights preserved.
- [x] Native production desktop/390×844, report/method controls, snapshot privacy/allowlist and two-way restore verified; disposable QA restored and share revoked; zero runtime/browser error records.

## Analysis request recovery and compact controls — October 30

- [x] Reproduce reported failure as strict-schema HTTP400 caused by leaked renderer geometry.
- [x] Observation-only output contract, local strict validation, persistent response receipts and correct rejection/uncertainty diagnostics.
- [x] Compact discovery controls, optional focus disclosure and correct empty/failure messaging.
- [x] 189 cases/schema/lint/types/build pass; explicit low reasoning/8192 completion budget and typed completion-limit handling after live evidence.
- [x] PR26 merged at 0fa2f0f and PR27 at 423954d. Saved photo recovered to REVIEW with8/8 outlines and no3D jobs; production API/SSR/compact-control CSS checks pass; final production rescene-qpr6larem is READY. A later user-started reconstruction was left untouched.
- [ ] Native after-change desktop/mobile inspection remains unavailable while browser access reports disabled; do not repeat inference to verify layout.

## Countertop connectivity and collision safeguards — October 30

- [x] Trace reported background rejection to 13% corner disagreement, not provider interruption.
- [x] Horizontal support anchoring and connected vertical risers reduce saved-data corner disagreement to numerical tolerance without relaxing rejection thresholds.
- [x] Occupied-volume layout correction, grouped support movement, manual save/publication guards and selective retry rejection.
- [x] Reported background rebuilt using cached analysis/depth and one clean image/review; object shapes were not regenerated. Remaining texture-review notes stay visible.
- [x] PR28 merged at d9ab411; 193 tests/schema/lint/types/build and CI pass. Production READY; background/mesh/review DTO and SSR checks pass, deliberate collision edit rejected, zero runtime errors. Native browser inspection remains unavailable.

## Expanded setting and product samples — October30

- [x] Fifteen empty Muse setting photographs across four aspect ratios and fifteen simple product photographs; visually reviewed, cushion corrected once.
- [x] Versioned previews/provenance, native-format selection, format filter and bounded scene picker; legacy assets/recipes preserved.
- [x] Idempotent library registration script, separate SETTING rows and version4 setting path snapshots.
- [x] 195 cases/schema/lint/types/build pass.
- [x] PR29 merged at2a10a49; production READY, all30 asset hashes and library registry metadata verified. Production library/SSR shows37 products and23 settings with format filter; zero runtime errors. Native UI interaction remains unverified while browser access is unavailable.

## Retail demo store — October 30

- [x] Curate eight existing meshes and derived sample photos/backgrounds into a frozen demo release without changing original projects.
- [x] Add dashboard Demo mode entry, three-workflow hub and realistic shared shopping layout.
- [x] Product inspection/photo comparison/colors/specifications/sample reviews and local review preview.
- [x] Room arrangement/visibility/colors/lights/grouped history/A-B saves and comparison/screenshot controls.
- [x] Styled-scene selection/hiding/isolation/product cards/Shop this look and shared cart/mock checkout.
- [x] Validate cart/storage/footprints/allowlist/geometry preservation; schema/lint/build and bounded HTTP/model-hash checks.
- [x] PR30 merged at50393c5; its automatic production deployment reached READY.

Details: DEMO_STORE.md. Jim explicitly chose to continue without browser verification; native WebGL/mobile/download interaction checks remain unverified.


## Shopping-first demo revision — October31

- [x] Product catalog and collection/scene selection pages before the interactive workflows.
- [x] Simultaneous photos and3D, compact buying panel, review carousel/dialogs with illustrated avatars and stronger text contrast.
- [x] Selected chair/cabinet/vase collection, existing second collection, four independently saved layouts and legacy-cart/layout compatibility.
- [x] Shared movement/rotation controls, undo/redo/reset/lights in both scene demos; support-following prevents the vase leaving its cabinet.
- [x]206 tests/schema/lint/types/build and local pages/eleven-model-hash smoke pass; no inference or original-project changes.
- [x] PR31 merged atf4927b6; PR/main CI pass, production READY, live catalog/product/workflow pages and all eleven GLB hashes/images verified at rescene-eta.vercel.app. Native browser verification remains unavailable.

## Compact themed demos — October31

- [x] Shared72px thumbnail wells, compact scene/product menus and top-of-view arrangement comparison with Save as.
- [x] Existing persisted ThemeMenu, semantic light/dark palettes and larger high-contrast primary text.
- [x] Saved camera/aspect framing instead of the wide arranger camera; twelve additional public sample-photo previews.
- [x]210 tests (including contrast/frame-fitting/preview inventory), schema/lint/types/build pass.
- [ ] Combined PR/main release and bounded production smoke. Native browser visual verification remains unavailable.
