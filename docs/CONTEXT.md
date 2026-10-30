# ReScene — current handoff

Updated October 30, 2026 (Asia/Manila). Read this and ROADMAP first, then task-relevant technical files. Historical milestones are not the active work queue.

## Objective and working style

Finish the photo-to-shoppable-3D hackathon app before November 2, 2026. Jim is in the **Indie developer** track. Any uploaded scene/product is in scope, including people, animals, clothing, food and electronics; furniture is only a demo example. Jim requested **bulk implementation**, fewer repeated tests/deployments and no stopping after micro-phases. Use one branch/PR and combined verification/release. Repeat only checks affected by a failure/change; prefer saved assets over fresh inference.

## Stack and access

- Next.js 16.4.3 / React 19.3.1 / TypeScript, R3F/Three/Drei, plain CSS. Vercel Node 22/iad1. Read installed Next docs before code changes.
- Neon Postgres / Prisma 7.10.1; Neon Managed Better Auth owns neon_auth. Pooled runtime adapter. Local/preview/production share prototype database/storage; branches do not isolate data.
- Private Cloudflare R2, immutable assets and owner/snapshot-scoped signed GETs. Public bucket URL disabled. **Automatic staging deletion remains disabled** at Jim's request.
- Secrets remain in ignored .env.local and Vercel. Never print/commit credentials, source photos, signed links, provider IDs or raw artifacts. Vercel MCP OAuth stays pending; authenticated CLI works. Use pinned CLI 65.8.0 rather than the outdated global CLI.
- Chrome browser access works. Actual Google consent and contest portal/submission are unverified; recording remains deferred. No blanket browser-disabled claim.

## Implemented application

Private upload/normalization → Meta analysis → reviewed masks → textured meshes → layout/appearance/lights → merchant products/replacements → unlisted frozen shopper snapshot. Dashboard supports search/status filters, pagination, project details, archive/restore and active share indicators. Restarting an earlier step confirms invalidation of later results. Saved-state/conflict/recovery/navigation protection are implemented.

Runtime models: Muse Spark 1.3 and SAM 3.1 directly via Meta Model API; Meta SAM 3D Objects via fal. Muse Image 1.0 now fills clean background plates via Meta. SAM 3.1 is segmentation, SAM 3D Objects is reconstruction. WorldGen has no verified developer API. Body and Align each completed one clothing experiment, returning untextured GLBs without UVs; they remain private diagnostics, **not runtime defaults**. Align requires a Body mesh; it is not a general object-placement solver.

General analysis detects complete roots, attached product regions and independent support relationships automatically, within an internal ten-entry safety bound. The user is not asked how many items to find. Roots reconstruct once; disjoint triangle regions preserve body/context and shared geometry/UVs. All reconstructed assembly members must be visible to publish their shared atlas. Object transforms apply draft × imported pose once; grouped moves/hiding preserve the assembly. Bottom-envelope/vertex checks keep floor/support surfaces below geometry. Support settling remains an estimate when a support mesh is absent.

Source detail supports ten mesh regions, bounded per-root registration and up-to-2K visible source-pixel baking; originals remain restorable and refresh starts from them. Unseen texture/geometry and garment fit are not verified. Editor tabs expose objects, textures, main/fill XYZ/intensity, ambient light and merchant-entered product fields. Demo catalog assets are original CC0 examples without fabricated prices/links. Replacements preserve a restorable original baseline/card; photo matching requires original geometry.

Publication v2 freezes render-only JSON plus an exact same-scene READY asset allowlist. Anonymous viewer data never joins live draft products or exposes original photos, masks, raw model responses, storage keys or private provenance. The photo-derived background is an approved render asset; the publish confirmation includes its visible context/estimated fill. Unsegmented context can remain, so review before publication. Revoke/archive/restart stop new access; issued signed links can last 15 minutes and downloads cannot be recalled.

## Current background correction

PR #14 merged at **2a927ed**; this is the last released baseline. Production is READY at rescene-6vf7ifpr8-jimclydegms-projects.vercel.app (dpl_HP38cA8UB1As2gB3k8huxCqZZsem), aliased to rescene-eta.vercel.app. Read BACKGROUND_RECONSTRUCTION.md for findings, implementation and limits.

The hardcoded room box, side walls and baseboards are removed. `scene-background-v6` observes seamless/open surfaces, actual wall/support seams and distant context independently of subject category. A broad support plane and distant photo shell avoid finite edges. A wall requires an observed reachable seam. The source camera projects a foreground-free derived full-frame texture; legacy floor patches remain a fallback. `room` means automatic photo background, `studio` ground only and `none` hides surfaces.

New reconstruction attempts one optional background step after object-detail transfer. Saved scenes use Textures → Build/Refresh photo background as a durable IMAGE_EDIT run. Legacy scenes receive background-only Spark analysis without replacing objects/masks. SAM mask union plus a bounded halo defines removal. Muse receives original and magenta guide; the API does not support edit masks, so the app enforces compositing. Harmonic color blending and confidence-based smooth-gradient completion reduce seams; textured regions retain Muse fill. Background lighting stays photographed. Original object texture restore leaves the independent background intact.

Optional failures preserve READY geometry/previous background and never automatically resubmit. Step uniqueness, idempotency, user active-run lock and revision checks remain. Raw Muse images are private PROVIDER_RESPONSE assets; only the final derived SURFACE_TEXTURE enters a snapshot. No migration/new provider/dependency. This remains a photo-projected approximation: large rotations, nonplanar/hidden backgrounds, reflections and residual shadows can differ from the reference.

The desk example below now has six source-detailed mesh regions, independent bottoms at Y=0 and a derived photo background. Its meshes/products/transforms/visibility were preserved. Three legacy background analyses were initiated: two incomplete 900-token trials submitted no image edit; a corrected 4096-token call and one Muse edit completed. Later blending reused that output without inference. Production Chrome framing and background controls passed on desktop and mobile.

## Evidence and reusable fixtures

- **Do not mutate:** f2848b95-8447-41eb-9544-0d72dd605565 — Jim's real test listing.
- **Disposable saved-data QA:** 6800b8a2-7c39-4a52-8fde-790eb03ab46c. Restore metadata/settings and revoke temporary shares.
- Jim's earlier reference: 1cc4e890-1ca8-4435-ac00-722dccefb995.
- Clothing: 2b495855-65dc-4ca3-ad93-1460e53eb5fe, complete person plus linked product regions. Prior state is backed up privately.
- Desk: c9035519-8cf4-45cd-88c2-36d32571eff1, private/unpublished. Upgrade backups/diagnostics are ignored under test-results.

PR #14 and main CI pass **83 cases**, schema/lint/types and build. The one reusable saved-data regression passed with restoration/revocation. Background-specific checks pass HTTP replay without resubmission, owner/origin/phase/stale rejection, mesh/card/transform preservation, cross-scene background rejection, anonymous derived asset delivery, frozen background independence and revocation; QA settings were restored. All 1,010,330 known desk background pixels outside the footprint are unchanged. Local Chrome WebGL/orbit/object-hide/reload passed. Production Chrome verified actual WebGL and the background refresh control at 1531×872; mobile canvas/control layout at 390×844 fits without page overflow. Temporary viewport overrides were reset. Bounded production release and controls API/SSR/auth/origin smoke checks pass without mutation/inference. No new scene or inference was used by saved-data/API checks.

Jim removed the cumulative generation cap; never reintroduce GENERATION_BUDGET_USD. Meta/fal bills are separate. Reserved costs are estimates, not invoice totals. Reuse artifacts unless a specific generation bug needs a new call. **Zero automatic paid retries.** No routine fresh pipeline sweeps.

CI checks PRs once, cancels superseded runs and skips docs-only install/build. Vercel ignores docs/test/tooling-only changes against the prior successful deployment; retain .git in the build workspace for this comparison. Use scripts/verify-release.mjs once for saved-data regression; --smoke is bounded/read-only post-deploy. Do not run every historical smoke script.

## Released correction: plain backgrounds and mesh evidence

PR #15 merged at **9e30944** adds conservative constant-field detection before background inference, validated plainColor in shared render snapshots, and Zoom lock beside Show grid. Plain fields ignore minority cast shadows; gradients/textures keep the photo path. The shoe db8ee6d5-fc99-42f3-8b71-5d0b1f772157 was refreshed to solid white at revision 8 with zero provider steps; original model/mask references remain unchanged. Its prior state and comparison artifacts are private under ignored test-results/shoe.

The hosted SAM 3D API has no quality/resolution/topology knob. One seed-42 comparison with four recovered mask openings (6,996 pixels) still distorted the sole; do not replace the saved mesh or claim improved topology. Provider-only opening refinement is experimental and OFF by default; the owner can opt in before reconstruction. Reviewed masks remain immutable, step provenance records derived inputs, and enabled source-detail transfer excludes the same candidate gaps. No further paid retries. Read BACKGROUND_RECONSTRUCTION.md for details. All 90 unit cases, lint/types, build and PR CI pass. Production is READY at rescene-kjfe3d58b-jimclydegms-projects.vercel.app, aliased to rescene-eta.vercel.app. Bounded production release/controls API and shoe checks pass: solid white plan, no photo plate, original mesh/mask/camera/transforms preserved, refinement disabled by default, unauthorized reads rejected. Live Zoom lock wheel/pinch/rotation and desktop/mobile visual checks remain unverified: browser access is disabled in Work settings. Do not claim a browser pass. Local port 3000 belongs to another project; temporary 3001 browser assets fail existing CORS, and R2 rejects changing it, so browser proof must use production. No CORS change was made. Leave the user's original shoe tab's unsaved edits untouched.

## Next action and references

The correction is deployed. When browser access returns, verify Zoom lock blocks zoom while orbit remains active and inspect desktop/mobile solid-background rendering. Do not repeat paid inference. Accurate hollow topology remains unresolved; experimental refinement is opt-in, not a claimed solution. Recording/portal limits and final contest submission remain human gates, separate from implemented app functionality. Do not infer another micro-phase without a concrete user request.

Technical context: ARCHITECTURE.md; DATA_MODEL.md + prisma/schema.prisma; META_MODELS.md; BACKGROUND_RECONSTRUCTION.md; SCENE_QUALITY.md; SCENE_UNDERSTANDING.md; TEXTURE_FIDELITY.md; TESTING.md; SETUP.md. Current publication contract is contracts/scene-manifest-v2.schema.json. Submission draft: release/DEMO.md.
