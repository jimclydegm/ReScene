# ReScene — current handoff

Updated October 30, 2026 (Asia/Manila). Read this and ROADMAP first, then task-relevant technical docs. Historical milestones are not a new work queue.

## Objective and working style

Finish the photo-to-shoppable-3D hackathon app before November 2, 2026. Jim is in the **Indie developer** track. Any scene/product is in scope: people, animals, clothing, food, electronics, furniture and other subjects. Furniture is a demo, never a detection restriction. Jim requested bulk implementation with one combined PR/release and fewer repeated tests/deployments. Do not invent micro-phases or repeat paid generation for unchanged code.

## Stack, access and constraints

- Next.js 16.4.3 / React 19.3.1 / TypeScript, R3F/Three/Drei and plain CSS; Vercel Node 22/iad1. Read installed Next docs before code changes.
- Neon Postgres / Prisma 7.10.1 / Neon Managed Better Auth; pooled runtime adapter. Local, preview and production share database/storage. Branches do not isolate data.
- Private Cloudflare R2 and immutable owner/snapshot-scoped signed assets. Public bucket URL is disabled. Automatic staging deletion remains disabled at Jim's request.
- Secrets stay in ignored .env.local/Vercel. Never print/commit credentials, signed links, provider request IDs or private artifacts. Vercel MCP OAuth remains pending; authenticated pinned CLI 65.8.0 works.
- Browser tools currently report **disabled in Work settings**, despite Jim replying that he will enable access. Prior older browser evidence exists, but current GPU/shader/shadow/Zoom lock/mobile checks are not verified. Do not claim a browser pass or bypass the restriction. Local 3000 belongs to another project; R2 CORS blocks 3001 and its credentials cannot change CORS. No CORS change was made. Leave the user's original shoe tab's unsaved edits untouched.
- Jim removed the cumulative generation cap. Never reintroduce GENERATION_BUDGET_USD. Meta/fal bills are separate. Keep one active user run, revision/idempotency guards, known-job resume and **zero automatic paid retries**. Reuse saved artifacts; no routine fresh pipeline sweeps.

## Implemented product

Private normalized photo → Meta analysis → reviewed masks → textured object meshes → placement/appearance/light/product editing → unlisted frozen shopper snapshot. Dashboard has search/status filters, pagination, project details, archive/restore and active-share indicators. Earlier-step restarts confirm later-result invalidation. Saves, stale recovery, unsaved-change protection and owner/origin checks are implemented.

Muse Spark 1.3 and SAM 3.1 run directly through Meta Model API; Meta SAM 3D Objects reconstructs through fal. Muse Image 1.0 fills clean background plates. SAM 3.1 is segmentation, Objects is reconstruction. WorldGen has no verified API. Body/Align completed private clothing experiments but returned untextured GLBs without UVs; they are not runtime defaults or general object aligners.

Analysis v8 discovers complete subjects, already-represented product regions, distinct support relationships and broad background extents automatically within a ten-entry safety bound. It does not ask how many items to detect. Shared roots reconstruct once; disjoint triangle regions retain geometry/UVs and selectable products. Group moves and complete-assembly publication preserve the shared atlas. Source-detail transfer supports ten regions, bounded registration and up-to-2K visible pixel baking, with immutable originals/restore. Lights expose main/fill XYZ/intensity and ambient. Catalog replacements preserve original baselines; photo matching requires original geometry. Product identity, measurements, hidden geometry/texture and garment fit are never guaranteed.

Publication v2 freezes render-only JSON and a same-scene READY asset allowlist. Anonymous DTOs exclude source photos, masks, raw responses, storage keys and private provenance/review reports. Approved derived background context and merchant fields can publish. Review visible context before publishing; unsegmented context can remain. Revoke/archive/restart stop new access; existing signed URLs last up to 15 minutes and downloaded files cannot be recalled.

## Current surface and layout behavior

Broad background floors/walls/tabletop extents stay out of SAM object meshes. Bounded supports and merchant objects remain editable. Explicit surfaceRole plus a conservative legacy frame-spanning fallback is shared across review/reconstruction/layout/texture/background/new publication.

A single opaque plane combines surface color/texture and ground shadows. There is no nearly coplanar transparent receiver. Only observed seams create wall planes; distant shells are reserved for actual scenery. PCF filtering and a bounded shadow depth range are explicit; generated meshes cast ground shadows without noisy self-shadow reception. Constant-field preflight stores validated plainColor, ignores minority cast shadows and skips image inference; gradients/textures retain photo background processing. Known background pixels outside the foreground removal footprint are preserved. Projection outside the source view remains approximate.

Textures → Build/Refresh photo background is a durable IMAGE_EDIT run; new reconstruction attempts one optional background step. Meta receives original plus a magenta guide; app-side compositing enforces masks because the edit API has no mask parameter. Raw outputs stay private. Optional failure keeps READY meshes and never resubmits automatically. Existing legacy floor projects can Match photo layout without a generated floor mesh.

Zoom lock sits beside Show grid and disables zoom while retaining orbit/pan. Experimental enclosed-opening mask refinement is OFF by default: one shoe comparison recovered four mask gaps but did not clearly improve geometry. The hosted Objects API exposes no quality/resolution/topology knob; keep that limitation honest.

## Reference layout review release

PR #17 merged at **a4c1cd9**. Production deployment: rescene-l6p750h9m-jimclydegms-projects.vercel.app, alias rescene-eta.vercel.app. Production is READY; bounded API/SSR/privacy/release checks pass and the error-log scan returned zero records. Full evidence is recorded in TESTING/ROADMAP.

The bedroom report exposed a duplicate duvet already represented by the complete bed, unknown-support parts lifted to the headboard's AABB maximum, and a manual lamp missing orientation/support metadata. Supported mask containment (>92%, sufficiently larger parent) now routes represented regions into shared geometry. Existing explicit review can partition legacy duplicates; unknown support no longer blindly stacks at a parent's highest point.

`mask-layout-v1` compares actual mesh silhouettes with accepted source masks in a fixed reference camera. A bounded CPU fit adjusts translation/uniform scale; slender vertical masks allow conservative upright candidates. Changes must improve the original overlap, with a small bounded upright trade-off. Scores below .65 stay flagged. This is geometry/mask overlap, **not full image similarity, texture accuracy, metric depth or hidden-geometry certification**. New reconstruction reviews automatically before texture transfer and keeps PARTIAL when unresolved warnings remain. Existing scenes expose Review & refine placement; Match photo layout also reviews. Reports are owner-only. Texture refresh honors the reviewed baseline. Undo restores transforms, mesh references, relationships, appearance and report together. Active-run/replacement/revision/privacy guards remain.

The reported bedroom was repaired at revision 9 from saved assets with zero inference. Bed/duvet conserve the original 14,376 triangles as disjoint shared regions. Pillow IoU improved 0→.67/.69, nightstand .60→.87, chair .67→.91, bed .75→.80. Lamp axis is straightened but its shape remains flagged (.32→.54). Private state, assets, reports and fixed-camera CPU renders are ignored under test-results/layout-review. The CPU preview is not a native WebGL screenshot.

All 103 tests, schema/lint/types/build and PR CI pass. A saved-data review/undo and stale-revision check passed with QA settings/model/relationship/transform/camera restoration. No paid inference was used. Native GPU, desktop/mobile and shadow/Zoom lock checks remain pending browser access; do not re-run generation to verify them.

## Latest release: editor UX

PR #18 merged at **3f97496** adds preview-only Hide background beside Zoom lock, canvas/list deselection, tilt/lean controls in degrees, focus selected, isolate complete subject/show all, and local scene/transparent PNG downloads. Offscreen exports omit editor helpers, preserve live state and cap dimensions/memory; no source-photo HTML or cloud writes/inference. Existing saved backdrop controls publishing. A bounded 50-action object/product/light timeline groups input gestures/focused text, handles no-ops and supports keyboard shortcuts. Optional pitch/roll persist through existing quaternion columns and preserve legacy clients' tilt; shared assembly edits/public transforms remain consistent.

116 unit cases, lint/types/build and PR CI pass. Production rescene-q0aev3sx2-jimclydegms-projects.vercel.app is READY and aliased to rescene-eta.vercel.app. Saved-data tilt/lean round-trip and legacy heading-only edits pass; original QA transforms/visibility/models are restored. Bounded production angle DTO/control/undo markup, invalid-angle/origin/anonymous rejection and release smoke pass with unchanged scene revision; the runtime error scan returned zero records. Browser still reports disabled, so actual gestures, PNG GPU output/download and responsive appearance are unverified. No inference, cloud uploads or new publications were used.

## Fixtures and next action

- **Do not mutate:** f2848b95-8447-41eb-9544-0d72dd605565 — Jim's real test listing.
- **Disposable saved-data QA:** 6800b8a2-7c39-4a52-8fde-790eb03ab46c. Restore settings/state and revoke any temporary shares.
- Bedroom review: 43af6e59-525e-4f3e-a401-24116a97f84b. Vases/surface: b80dc2df-4fc8-4bb1-abef-742f2f10e302. Shoe: db8ee6d5-fc99-42f3-8b71-5d0b1f772157.
- Desk: c9035519-8cf4-45cd-88c2-36d32571eff1. Clothing: 2b495855-65dc-4ca3-ad93-1460e53eb5fe. Earlier reference: 1cc4e890-1ca8-4435-ac00-722dccefb995. Prior-state backups remain private under ignored test-results.

After the current release, verify only affected native controls/rendering when browser access returns. Do not claim exact single-image reconstruction or silently remove residual warnings. Recording/portal fields and final contest submission remain human gates, separate from implemented app functionality. Do not infer another phase without a concrete request.

CI cancels superseded runs, skips docs-only install/build, and Vercel ignores docs/test/tooling-only changes. Preserve .git in builds for this comparison. Use scripts/verify-release.mjs once for saved-data regression; --smoke is bounded/read-only post-deploy. Do not run every historical script.

Technical context: ARCHITECTURE.md; DATA_MODEL.md + prisma/schema.prisma; META_MODELS.md; SCENE_QUALITY.md; SCENE_UNDERSTANDING.md; TEXTURE_FIDELITY.md; BACKGROUND_RECONSTRUCTION.md; TESTING.md; SETUP.md. Render contract: contracts/scene-manifest-v2.schema.json. Submission draft: release/DEMO.md. Full release history is in ROADMAP and its history reference.

## Latest release: background recovery

The latest failure was pre-inference: arbitrary local-up axes on irregular meshes caused full layout rejection; `stage={}` then blocked optional backgrounds. The reported scene also has a catalog replacement. The correction accepts upward leveling votes without vetoing other subjects and supports background-only generation on the existing manual stage (`layoutSource=manual-stage`) without resetting objects/products/replacements. Local/preflight failures now retain internal diagnostics; completed provider work and zero paid retries remain intact.

One recorded background-only Muse Image call succeeded for the affected saved scene, with all object/product/replacement fields unchanged and 405,791 visible background pixels preserved. Remaining unsegmented context is not proof of a model failure. 122 tests/typecheck/lint/build pass. Native browser access still reports disabled. PR #19 merged at 02dc76d. Production rescene-ad1l0cww6-jimclydegms-projects.vercel.app is READY and aliased to rescene-eta.vercel.app; CI and bounded production smoke pass, with zero runtime error records. Next action: user can reload the repaired scene; native WebGL confirmation remains pending browser access. Do not repeat inference. Private evidence: ignored test-results/background-recovery.

## Pending (uncommitted): compact landing + studio UI

Landing is one screen: 64px header, short hero with the demo, three-step row, slim footer. The studio editor opens straight into a full-height viewport plus inspector. A one-line top bar holds title, step indicator, save state, a `⋯` menu (details, reload, change photo, analyze again, rebuild 3D) and Share (publish/copy/revoke dialog). The reference photo is a minimizable inset on the viewport. The viewer toolbar is icon-only. Inspector tabs: Objects (position/rotation/size groups), Scene (match layout, refine placement, undo, backdrop segmented control, photo background, layout report), Textures, Light, Products. Native `select`s use a custom chevron. Buttons are smaller app-wide. Checked locally on desktop and mobile with saved QA scenes, read-only. No inference, saves or publishes were run.

## Latest release: creative showroom

PR #20 merged at e093e79; upload completion corrected in 0c5adf4. Additive migration applied: SceneObject.appearance and COMPOSE_IMAGE. /scenes/create combines 1–6 private product references with Muse Image, scene/aspect/prompt controls, illustrative product templates, durable idempotent jobs, generated history and explicit adoption into separately normalized DRAFT scenes. /scenes/new offers existing-photo and creator choices plus the private generated library. Object tints and Day/Dusk/Night/Studio lights save, undo and freeze in public snapshots. Texture tint is multiplicative; photographed background lighting remains baked.

130 tests/lint/schema/build pass; 30 steps/3 workflows register. Saved tint/light/public snapshot round-trip passed with QA restoration/revocation. One real two-reference production workflow completed and adopted its image without reconstruction inference; repeated dispatch reused the job and cross-owner access was denied. Preview auth returns 403, so live API verification used production without relaxing auth. Native browser inventory remains disabled; do not claim a GPU/desktop/mobile pass. Plan/schema/demo: CREATIVE_SHOWROOM.md. Private evidence: ignored test-results/creative-showroom. Do not repeat paid generation for unchanged code.

Production rescene-4j1a6tcfi-jimclydegms-projects.vercel.app is READY and aliased to rescene-eta.vercel.app. Corrected direct uploads, normalization/library and creator/editor SSR checks pass; final error scan is clean. Next: user can test /scenes/create and saved colors/light presets; native browser/GPU checks remain access-dependent.

## Latest release: creation UX + relational content library

Branch codex/library-creation-redesign. Replaces procedural cards with 12 Meta-generated photographic samples and four scene previews under public/samples/v1; prompts/model metadata are stored there. Starting page is compact upload/library plus creator entry. Product picker has search/categories/selection tray; scene settings have visual previews and aspect buttons. Explicit Save draft and generation persist settings. Six new models: ContentItem, CompositionDraft, CompositionReference, ContentGeneration, GenerationReference, ContentAdoption; ordered frozen generation references differ from mutable draft selections. Applied migrations backfill legacy assets, runs and latest draft state. Old unrecorded adoption ancestry cannot be inferred. Native browser access still disabled; no visual pass claimed. PR #21 merged at ed1d70c. Production rescene-klx2xq0pt-jimclydegms-projects.vercel.app is READY; CI, real linked-output/adoption checks and production assets/draft/SSR checks pass. No runtime error records. Next: user visual review while native browser access remains disabled; avoid repeated 3D inference. Evidence: ignored test-results/library-refresh.

## Latest release: reversible deletion and minimal samples

PR #22 merged at 1b69385. Private uploads/generated images can move to Trash and restore; generation history, draft links and adopted scenes stay intact. Active generation references block deletion; sample images are read-only. Project Delete uses existing archive/restore and revokes shares. Twelve new single-item photographic samples plus eight empty setting previews are at public/samples/v2 (Meta generation prompts preserved); sample seed migration adds them and retires plant/paired-shoe v1 rows without deleting media. New drafts/generations record templateVersion=2. No 3D generation used. All 136 tests, lint/types/build and merge CI pass. Production rescene-bv2dag33g-jimclydegms-projects.vercel.app is READY and aliased to rescene-eta.vercel.app. Production API checks pass image confirmation/delete/Trash/restore and project Delete/Restore, plus all 22 sample choices and eight setting assets/controls. Next: user testing on dashboard and creator. Native browser access remains disabled; do not claim visual interaction verification. Private evidence: ignored test-results/library-delete.

The bounded final production error-log scan returned zero records.

## Latest release: composition quality and selective recovery

PR #23 merged at f9cf672. Muse composition v3 uses actual empty setting image + numbered products + optional previous result, high reasoning and explicit count/margin/relative-scale/support constraints. Spark checks image results; warnings/failure retain the saved output. Fix image issues is one explicit paid correction, never a loop. ContentGeneration gains refinementSourceId FK, requestSnapshot and qualityReview; migration applied. Image Trash guards active refinement sources.

Spatial mask matching replaces center-only selection. Reference fitting preserves physical contact and samples actual support mesh height. Scene → Reconstruction recovery accepts saved missing-object masks and offers explicit paid independent-object retry with seed. Keep scene READY while queued/known-job resume; fit in existing frame/camera, replace only selected meshes that improve mask overlap, and preserve other objects/background. Shared assemblies/replacements require full review/rebuild. This changes the earlier zero-retry policy only by adding explicit user-triggered paid attempts; no automatic inference resubmission.

Reported scene a36ab9a2-c88b-4437-a8f5-9b8934ef098a: source image itself miniaturized furniture on a countertop and duplicated a jar lid. Coarse analysis boxes were vertically shifted; center-only matching lost the box and chose the attached lid. Saved masks recovered without SAM inference; layout constraints close jar/table gap to zero. One three-object fal retry created the box (~.835 IoU); chair and lid retries did not improve and old meshes were retained. Table/jar/background were unchanged by selective retry. One four-product Muse composition in a sunlit room was inspected: complete single items, plausible scale; Spark review found no issues after increasing its output allowance to 4096. A review failure does not lose the generated image. Evidence stays private under test-results/composition-quality. All 150 unit cases, schema/lint/types/build, PR and merge CI pass. Production rescene-9eu5qxcon-jimclydegms-projects.vercel.app is READY and aliased to rescene-eta.vercel.app. Production controls/confirmation/stale-revision/recipe/correction validation pass without new inference or scene edits. Next: user testing in Scene → Reconstruction recovery and the image creator. Native browser inventory still reports disabled in Work settings; no WebGL/interaction pass claimed.

The bounded final deployment error scan returned zero records.
