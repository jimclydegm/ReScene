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
