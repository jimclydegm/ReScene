# ReScene — consolidated completion plan

October 29, 2026. Jim requested larger implementation batches to finish quickly and reduce repeated inference, tests and deployments. This plan supersedes the earlier micro-phase schedule; history is preserved in history/PLAN_2026-10-29.md.

## Finish one usable release

The author-to-shopper core is implemented and passed a fresh deployed Meta run. Complete project management, editor recovery/navigation, sharing discoverability and delivery efficiency as one release bundle. Acceptance: a seller can find/manage a saved project, change its title/listings/layout, recover from a stale save, publish an approved snapshot, archive/restore the draft and understand which links remain active. The source photo stays private; snapshots stay frozen.

## Work together, verify together

Use one branch and one PR for this bundle. Implement independent tasks together without pausing for phase approval. Run unit/static/build checks once after the batch; add tests only for meaningful behavior/security boundaries. Reuse the existing disposable QA scene and saved assets for one consolidated integration run. No new paid inference is needed unless a specific generation bug is found. The earlier removed cumulative cap is not reinstated; this is a resource-saving development policy.

CI should run once per PR change and on main, cancel superseded jobs, and avoid redundant feature-push jobs. Vercel should skip documentation/test-only changes; app/config/schema changes must still build. When all checks pass, merge/deploy the bundle once. Limit post-deploy verification to changed boundaries; retain previous evidence for unchanged generation/publication paths.

## Product scope

Keep the working furniture/home-decor prototype: Meta Muse Spark + SAM 3.1 via Meta Model API, Meta SAM 3D Objects via fal, Next.js/Vercel, GitHub, private R2, Neon Postgres/Prisma and Neon Managed Better Auth. Preserve source privacy, ownership/revision checks, immutable assets, original-object restore, no automatic paid retries and disabled automatic R2 cleanup. Do not add providers, voice, garment fit, arbitrary model uploads, exact measurements, WorldGen APIs, or optional image generation while finishing this release.

## Delivery gates

App functionality and recorded verification form one deliverable. Desktop/mobile browser appearance, recording, private portal fields and final contest submission remain explicit human/access gates, not additional coding phases. Indie developer track is confirmed. November 2 Asia/Manila remains the build freeze. Demo/submission draft: release/DEMO.md.

## General scene and product correction — October 29

Jim clarified that ReScene accepts any scene or product, including apparel and footwear. Furniture/home decor is a demonstration choice, never a model category or UX restriction. The earlier room-first analysis prompt/category enum was a functional bug: the clothing sample returned zero Spark candidates, so no SAM request ran. This correction is one implementation/release bundle, not a new micro-phase schedule.

Implement generic scene/product analysis with explicit focus, candidate count and bounded user instructions. Keep up to five analyzed candidates, up to ten total with manually added items, and three selected meshes per reconstruction. Support independent SEGMENT_OBJECT runs against the exact normalized image, using the existing RunKind without a migration. Freeze text or spatial prompts with each attempt; prohibit mixing concept text and spatial grammar. Preserve prior accepted masks when an explicit retry fails. Store multiple returned masks privately and let the owner choose or union instances (e.g. shoes) without inference. Confidence filtering is local review of returned scores, not an invented Meta detection-threshold API.

Fit photo and WebGL previews to viewport height without cropping or losing source aspect. Provide analysis empty-result recovery, item-by-item prompt refinement, visible phase retry/restart controls, a deterministic 3D seed and no-cost backdrop/placement recovery. Photo/analysis/reconstruction resets retain their existing confirmation and later-result invalidation rules. A successful outline is not evidence of accurate garment geometry or fit. Browser interaction QA remains unavailable while Work browser access is disabled.

## Complete subjects supersede independent garment meshes

Jim's follow-up changes the default from product-only extraction to complete scene preservation. The app decides which subjects/parts exist; it no longer asks users for a segmentation count. `scene-assemblies-v4` uses one-level parent relationships and an internal ten-entry safety bound. Reconstruct full roots once, then derive separate selectable product regions from that shared mesh. This retains head/neck/exposed limbs and removes overlapping, independently generated bodies/clothes. The existing full-person Objects experiment validates this approach for the simple clothing sample. Body/Align remain researched alternatives, not implemented integrations.

Ground placement uses a conservative lower geometry envelope; the old median-of-garment-bottoms rule is removed. Low-resolution SAM rasters are resampled into the documented source bounding box. Publication of a shared-atlas assembly requires all reconstructed members visible. Existing revision/idempotency/private-source constraints and no automatic paid resubmission remain. See SCENE_UNDERSTANDING.md for tested evidence and limits on complex occlusion, rear-region inference, skin hidden under clothing and prototype capacity.

## General support and source-detail improvement — October 30

Rebalance prompts for arbitrary scene content, with support links distinct from attached-part links. Add contact constraints instead of assuming independent estimated poses physically touch. Preserve shared subject topology. Fix the stale three-mesh texture limit; register visible source pixels per root, use up-to-2K bakes and keep originals for refresh/restore. Attempt source detail once after successful ingestion without new inference, retaining geometry on failure.

Body and Align were tested on the saved person. Both are useful anatomy/coordinate tools, but returned untextured GLBs without UVs. Do not replace textured appearances automatically or route desk objects into the human-specific aligner. Dense shared-depth/Body-to-textured-mesh registration remain future work, not implemented claims. See SCENE_QUALITY.md. Chrome browser access is now available; validate affected UI rather than repeating the prior blanket browser restriction.

## Photo-matched backgrounds — October 30

Replace the inferred room box with observed background structure and a photo-projected derived plate. General Spark analysis distinguishes open surfaces, actual wall/support seams and distant context. SAM masks plus one Muse Image edit remove reconstructed foreground; app-side compositing preserves known source pixels, blends boundaries and extends reliable smooth gradients. No side walls/baseboards or category-specific defaults. New reconstruction includes one optional background step; existing scenes have an independent durable refresh. Failures preserve READY geometry and never automatically resubmit. Extend frozen render allowlists for the derived background while keeping original/raw assets private. See BACKGROUND_RECONSTRUCTION.md for architecture, evidence and one-image limits.

## Plain backgrounds and hollow-object investigation — October 30

Add a conservative pixel-based plain-field preflight before background inference, persisting optional validated plainColor in the existing composition JSON/snapshot contract. Render it without baked shadows. Add viewer-local Zoom lock alongside Show grid, retaining orbit/pan. No new service, SQL migration or model provider.

Investigate actual hosted SAM 3D controls and one comparison using provider-only mask opening refinement. Preserve accepted masks and old meshes. The trial did not clearly improve overall geometry, so refinement is an explicit experimental opt-in rather than a new automatic default. Reuse it during source-detail transfer only when enabled. Preserve seed/export, full photo frame, private provenance, original restore and no automatic paid retries. Accurate hollow topology remains an unresolved model limit, not a completed capability.

## Simplify floors and remove flickering layers — October 30

Jim requested a plain textured surface rather than reconstructed floor geometry. Route broad background extents out of SAM 3D; retain bounded support products. Use one opaque plane for surface texture plus ground shadow, remove the near-coplanar transparent receiver and avoid self-shadow acne on generated objects. Keep observed walls/distant scenery separate and avoid floor duplication on a distant shell. Apply the same classification in authoring, layout, texture/background processing and publication, with conservative legacy compatibility. Repair the reported saved scene from existing private assets without paid regeneration. Surface projection is approximate; do not claim recovered 360-degree context.

## Reference-based layout reliability — October 30

Jim requested a reviewer after a duplicated duvet, floated pillows/bed parts, misplaced nightstand and leaning lamp. Fix underlying assembly/support routing and validate the final actual geometry rather than trusting pre-contact provider pose bounds. Use one bounded source-mask/mesh silhouette fit, conservative vertical-axis candidates and explicit unresolved-shape flags. Run automatically on new reconstruction and expose one existing-scene review action, retaining undo/private originals. Shared geometry avoids doubled parts. No unbounded visual-judge/regeneration loop or paid inference is introduced. A silhouette check is not a full appearance/depth/hidden-geometry verifier; keep those limits visible instead of promising all discrepancies can be repaired.

## Editor UX bundle — October 30

Jim requested background visibility beside Zoom lock, deselection, more editing controls, screenshot downloads and logical undo/redo. Implement preview-only background visibility, repeated-click/empty-space deselection, persisted tilt/lean in degrees, focus/isolate/show-all, and current-view/transparent PNG downloads. Group continuous input interactions rather than every small sample, with one bounded local timeline for objects/products and lighting. Preserve complete-assembly visibility/transform rules and older clients' tilt. PNG export is offscreen/local and uses only render assets already visible to the viewer; it must not flash the live view, expose source photos, write cloud files or invoke models. Use one release bundle, no generation sweeps or new provider/migration.

## Background failure recovery — October 30

Fix the dependency between optional background generation and strict object-axis leveling as one correction release. Arbitrary local mesh axes must not veto otherwise valid scene poses. Missing photo placement must not prevent a background on the manual stage or require removing catalog replacements. Preserve object/product edits, label manual-camera recovery honestly, keep revision/privacy/no-retry rules, and persist internal diagnostics for preflight/local failures. Optional `composition.layoutSource` is additive to snapshot v2; no SQL migration or model/provider change.

## Creation/library correction

Replace the oversized creation landing with an upload/generated-library switch and a compact image-studio entry. Rebuild product selection around photographic cards, search/category controls and a selected tray; scene choices use generated visual previews. Generate samples once with Meta, version static assets, label synthetic photos honestly and retain prompts. Replace JSON-only creative lineage with ContentItem, CompositionDraft, CompositionReference, ContentGeneration, GenerationReference and ContentAdoption. Preserve owner checks, independent draft revisions, frozen generation inputs, legacy backfills and immutable media. Save drafts explicitly and on generation; references/settings/results/adoptions remain queryable. No new provider or 3D inference is needed for this correction.

## Reversible deletion and minimal assets

Expose project deletion through the existing archive/restore transaction and Trash view; no permanent storage cleanup is enabled. Library images use ContentItem.archivedAt with confirmation/restore. Ownership and active generation-reference guards precede writes; draft revisions advance so stale saves cannot silently reselect deleted images. Draft links, immutable generation history, adopted projects and publication assets remain intact. Public samples cannot be deleted by users. Replace new setting previews/prompts with eight empty environments, and add twelve single-item simple sample photos. Retire plants/paired shoes from the picker while retaining v1 media and lineage.

## Composition quality and selective recovery — October 30

Use the chosen empty setting image as an actual Muse reference, with a numbered one-instance inventory, safe margins, realistic relative-scale/support rules and high reasoning. Follow the image with one bounded Spark quality check; keep the output and show count/crop/scale/support/setting warnings rather than claiming perfect fidelity. User-triggered Fix image issues creates one paid refinement from the saved image, original references and setting, retaining immutable source/output lineage and the effective request snapshot. Muse has no documented negative_prompt parameter; exclusions belong in the ordinary prompt.

Resolve masks using overlap plus bounded spatial proximity to coarse analysis boxes. Keep real support contact during silhouette fitting, including actual support-mesh heights. Add explicit selective paid 3D retries on independent subjects, preserving the saved scene while a known job runs. Fit candidate geometry in the existing camera/frame, retain old meshes when overlap does not improve, and leave shared assemblies/replacements in the full review/rebuild flow. Do not introduce an unlimited paid retry loop or equate silhouette overlap with complete shape/texture validation.

## Structure-first background materials — October 30

Separate intrinsic material, physical topology and lighting. Before initial 3D submission, cache a source-photo-scoped Spark surface interpretation: open support, continuous studio cyclorama, confident floor/wall junctions (two segments for a visible corner) or distant scenery. Shadow/light bands and material borders cannot create wall geometry. Plain finishes use solid albedo. Textured surfaces use at most two Muse material-only tiles from validated foreground-free swatches; no full source photo is sent to the material generator. Review each proposed tile; rejected/unreviewed texture falls back to solid color. Use real scene lights/shadows on Standard materials and a continuous studio cove, rather than projecting the whole scene onto a ground plane. Distant context retains the photo-plate path. Preserve a previous-background swap, existing immutable assets, object/product/light state and frozen publication boundaries. No database migration/new provider or retry loop.

## Reference environment geometry — October 30

Replace the single-seam default for planar backgrounds with a source-scoped Spark surface graph and hosted Meta VGGT depth. Fit connected planes/openings in the saved scene frame; keep one continuous ground/shadow plane. Recover reference intrinsic appearance with one bounded Muse edit, source detail, foreground exclusion and plane-coordinate texture continuation. Keep studio/distant/plain routes, prior-background restore, known-job reuse/resume, image-review warnings and snapshot privacy. Match-photo reframing uses saved geometry evidence without inference. No new provider, account, SQL migration, object regeneration or paid retry loop. Full contract, evidence and limitations: REFERENCE_ENVIRONMENTS.md.

## Analysis schema and compact controls correction — October 30

Keep model observation schemas independent from render plans. The reference-environment release added optional `geometry` to a shared render schema and accidentally sent it to strict analysis output; Meta rejected it before decoding. Use an explicit observation allowlist and local strict-schema validation before inference. Persist request/response phases and raw received analysis before parsing; distinguish HTTP rejections, connection uncertainty and post-response failures. Retain zero automatic paid resubmissions and stale/cancel guards. Collapse optional focus instructions, remove redundant discovery hints and display no-candidate messaging only after a successful empty analysis. No SQL migration or model-provider change.

The live schema-correction check also exposed an independent default-reasoning completion limit. Set analysis reasoning explicitly low with an 8,192 combined completion budget and report a received `length` result distinctly. One manually initiated bounded recovery returned eight candidates; never retry a truncated response automatically.

## Support surfaces and collision safeguards — October 30

The reported countertop graph failed geometry validation because only role=floor could anchor depth, and vertical countertop fronts were fit independently of their shared horizontal edge. Infer a horizontal support from depth-normal evidence when no floor is observed; anchor walls/risers/fronts through shared support edges and propagate coplanar vertical contacts. Retain rejection of inconsistent geometry, saved-state fallback and paid-job reuse; do not simply loosen quality thresholds.

After independent silhouette fitting, check common-frame occupied mesh volume with bounded ray-parity voxels. Resolve detected root intersections horizontally, moving supported descendants together and keeping attachments intact. Re-evaluate silhouette scores afterward. Save-time guards reject new/worsening detected intersections; publication rejects remaining detected intersections, and selective 3D retries cannot adopt colliding candidates. Surface contact and gaps within a table/frame are allowed. Open/thin/uncertain meshes can evade this approximate check; it is not a universal physical non-intersection proof. No new inference for collision checking or object regeneration.

## Expanded reference samples — October30

Add fifteen individually generated Muse setting photos and fifteen single-product photos under immutable /samples/v3 paths. Settings include empty gray desks/wood tabletop supports, unfurnished rooms, studios and kitchen architecture in16:9,1:1,3:4 and9:16. Retain all legacy settings/products/history. Add format filtering, uncropped previews, native-format labels/defaults and9:16 generation support. Persist prompts, actual dimensions, requested size, model, timestamp and hashes; register products as SAMPLE and settings separately as SETTING in ContentItem so empty backgrounds never enter the product picker. Version new composition snapshots/drafts at4 and freeze the resolved setting asset path. No schema migration or reconstruction inference.
