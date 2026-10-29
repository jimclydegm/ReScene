# ReScene build phases

Created October 29, 2026. Timezone: Asia/Manila. **November 2 is the build freeze.** Proposed operational target: finish the release candidate by 18:00 that day, leaving time to record and check the demo. This time is a planning assumption, not an event rule.

Phases are ordered by dependency. Finish each acceptance gate before expanding scope. Estimates are focused engineering hours and assume credentials are available; account/queue delays are additional.

## Planning completed

- [x] Inspect repository and preserve the existing GitHub remote.
- [x] Research Meta's named models plus SAM 3D Objects, Body, and WorldGen using primary sources.
- [x] Choose a lean product/demo scope and document unverified assumptions.
- [x] Save architecture, data model, detailed Prisma schema, scene contract, environment names, and phased work in the repo.
- [x] Record offline validation results and remaining integration checks below.

The app foundation is implemented. Jim requested Vercel setup and base code while the reconstruction spike remains pending. Unchecked boxes still describe future work; model-account access is not a completed reconstruction gate. See [SETUP.md](SETUP.md) for actual deployment/access status.

Foundation PR #1 merged into `main` on October 29 (`66771fa`). The immediate experiment and the following implementation slices are prepared in [NEXT_STEPS.md](NEXT_STEPS.md); live model calls have not started.

## Calendar

| Date | Target | Exit condition |
| --- | --- | --- |
| Thu Oct 29 | Phase 0 feasibility, Phase 1 foundation | Real 3D path demonstrated; app/auth/DB/storage skeleton deployed |
| Fri Oct 30 | Phase 2 upload/analysis and Phase 3 reconstruction | Fresh photo reaches independently selectable meshes |
| Sat Oct 31 | Phase 4 editor/product flow | Edit, replace, save, reload work end to end |
| Sun Nov 1 | Phase 5 publication and deployed QA | Anonymous shoppable viewer, ownership checks, job recovery |
| Mon Nov 2 | Phase 6 polish, verification, recording, freeze | Working release candidate and submission package |

If a target slips, remove optional work before weakening the complete core flow. No new architectural dependency after Oct 31 unless needed to repair the core.

## Phase 0 — Prove Meta access and reconstruction

**Time box: 2–4 hours, October 29.** Dependencies: accepted-participant access, Meta key, chosen hosted SAM 3D credentials. No full UI work until the model path is credible.

- [ ] Read the participant rules/details and record track, final deadline/timezone, model requirements, allowed hosts/assets, team rules, judging rubric, and submission format in PLAN.md. Do not treat marketing copy as the final rules.
- [x] Verify account/model discovery access to `muse-spark-1.3` and `sam-3.1`. Secrets are local/platform-side; live inference is still pending.
- [x] Prepare Spark/SAM adapters, private checkpointed spike CLI, offline contract/mask/artifact tests, and normalized synthetic bedroom input. Jim subsequently approved $10 total development inference. See [SPIKE.md](SPIKE.md) and [TESTING.md](TESTING.md).
- [ ] Select one rights-cleared photo with 3–5 clear furniture/decor objects; use two objects for the first test.
- [x] Run live Spark analysis and SAM masks; retain full private artifacts. Synthetic-fixture results are in META_MODELS.md; sanitized real protocol regression fixtures remain later work.
- [ ] Check current hosted SAM 3D price/billing unit/credits and set the experimental spending cap before paid tests.
- [x] Run a two-object CLI job and three-object local/deployed app jobs; save IDs, raw results, bytes and timings privately. Actual GPU invoices remain unverified; conservative reservation controls are active.
- [ ] Load independent GLBs in a minimal viewer and verify mask→object→mesh identity.
- [ ] Verify coordinate frame, quaternion ordering, camera matrix direction, baked transforms, scale, pivots, bounds, and manual correction needs.
- [ ] Test polling a known job and one failure/recovery outcome. Mark unresolved submission ambiguity honestly.
- [ ] Update META_MODELS.md with observed results and chosen provider/importer contract.

**Pass:** two real objects from the same input/masks can be selected, moved separately, and placed coherently. Output quality and browser weight are acceptable for the chosen photo. Account/model/rule assumptions are resolved or explicitly recorded.

**Stop/cut:** after four hours, switch only to a documented host of the same Meta model or a bounded GPU-runner option. If neither works, explicitly agree a smaller fallback scope with Jim; do not silently claim cutouts are full 3D. Preserve a saved real-output sample for later regression checks.

## Phase 1 — App, identity, database, and storage foundation

**Estimate: 4–6 hours, October 29.** Depends on Phase 0's provider decision. Can prepare account configuration while inference runs.

- [x] Reuse checkout and create `codex/app-foundation`; keep planning context.
- [x] Scaffold Next.js/React/TypeScript, sample viewer, and styled UI with pinned dependencies/lockfile. Plain CSS is sufficient for the foundation; Tailwind is deferred.
- [x] Configure Node 22, server-only lazy environment helpers, and client bundle boundaries.
- [x] Link the correct Vercel project/GitHub repository; deploy production and a stable feature-branch preview alias.
- [ ] Provision/link the chosen Neon project and a development environment. Enable Neon Managed Better Auth; configure origin allowlist and cookie secret.
- [x] Install Prisma 7.10.1 CLI/client/adapter; review/apply initial migration with constraints; preserve `neon_auth`.
- [x] Implement auth proxy, sign-up/sign-in/sign-out, sessions, AppUser upsert, and protected dashboard/API. Email/session flows tested; Google consent remains untested.
- [x] Configure private R2 bucket, Object Read & Write credentials, CORS, and server signing helpers; verify deployed uploads. Public development URL is disabled.
- [x] Record retention choice: Jim requested automatic staging deletion remain disabled. Preserve the existing seven-day incomplete-multipart abort rule; no uploaded-object expiration rule is enabled.
- [ ] Separate development/production database, Auth, and storage credentials before broader use.
- [x] Add Scene create/list/read/update, owner-scoped DTOs, revision conflicts, and upload reservation/completion services.
- [x] Add GitHub CI for install/generate, typecheck, lint, tests, and build; migrations remain separate.

**Foundation status, Oct 29:** deployed to the existing production origin with Next.js/Node 22 and encrypted server secrets. Local/deployed account checks, mobile layout, nine deployed storage checks, and browser upload/refresh pass. Private R2 writes/CORS work with the rotated credentials. Automatic staging deletion is disabled at Jim's request. The stable feature preview exists; separate database/Auth/storage environments remain deferred and share the supplied prototype resources.

**Pass:** deploy succeeds; login survives reload; two accounts see only their own scenes; an authorized staging upload round-trip works; schema applies in development without affecting auth tables.

## Phase 2 — Upload, analysis, and object review

**Estimate: 4–6 hours, October 30.** Depends on Phase 1.

- [x] Build create-scene/upload screen with format/size hints, progress, and retry.
- [x] Implement and verify staging reservation, direct PUT, completion verification, immutable source snapshot, bounded normalization/EXIF stripping, and malformed-image rejection.
- [x] Implement Run/Step persistence, idempotency, active-run/budget gate, workflow dispatch/claim, and DB-backed progress polling. Local/deployed start replay checks pass.
- [x] Add and live-test Spark scene-analysis adapter with bounded structured output and prompt versioning.
- [ ] Add SAM 3.1 adapter using the official parser; handle zero matches, request-local IDs, masks, corrected boxes, and concept grouping.
- [ ] Store masks/cutouts in normalized-image space and match candidates to instances.
- [ ] Build object list/overlay review: rename, exclude, confirm, correct box, resegment one object.
- [x] Add safe error states, uncertain-submission stop, queued dispatch recovery, and known-job resume. Production failure stopped without resubmitting; browser recovery controls remain visually untested.

**Pass:** a fresh upload reaches REVIEW with correctly aligned masks for at least three objects; review survives refresh; closing/reopening does not lose work; malformed or oversized uploads are rejected server-side. Private image signing cannot be used on another user's asset.

## Phase 3 — Reconstruction and first working viewer

**Estimate: 4–6 hours, October 30.** Depends on Phases 0 and 2.

- [x] Freeze confirmed object/mask order and scene revision in the reconstruction run input.
- [x] Submit queued SAM 3D, persist its ID, and poll durably with a deadline. Cancellation UI is not implemented.
- [x] Ingest independent GLBs/raw metadata with bounded host/byte/container/resource/finite-transform checks. Mapping uses frozen input order; full visual identity/importer checks remain pending.
- [ ] Apply the tested coordinate/pivot importer exactly once. Record importer version and provenance.
- [ ] Assemble an initialized stage/camera and render objects as stable semantic groups.
- [ ] Add orbit/pan/zoom, raycast selection, loading/error fallbacks, and reset camera.
- [ ] Preserve successful objects on partial failure; enable known-job continuation and individual-object retry with reviewed placement.
- [ ] Show cutout/proxy states honestly; do not count them toward the mesh gate.

**Pass:** a fresh demo photo produces at least three independent GLBs. Each selects the correct object, camera controls work, and objects can be temporarily moved independently. Browser refresh/tab closure does not restart paid submissions or lose completed work.

## Phase 3.5 — Correct scene composition (Jim's October 29 clarification)

- [x] Trace GLB export axes, quaternion ordering, and row-vector pose convention against Meta source and saved provider artifacts.
- [x] Preserve relative model scale/rotation/depth with one scene transform, a common floor, and a fitted photo camera.
- [x] Add estimated floor/walls/shadow surfaces and bounded room/light observations to Spark's schema/prompt.
- [x] Add a clickable reference thumbnail and expanded native dialog to Scene Studio.
- [x] Add owner-only Match photo layout / Undo photo layout using saved assets, revision checks, and no new inference.
- [x] Add pose/projection/GLB hierarchy regressions. Preserve usable meshes on unsupported-layout fallback.
- [x] Complete local/deployed integration verification and merge the correction (PR #3, `81bf9ac`).
- [ ] Visually compare the reconstructed bedroom with its photo; check mobile dialog, camera reset, selection, and mesh orientation once browser access is enabled.
- [ ] Validate the revised Spark environment response on a future authorized inference; current saved scenes use the color fallback.

Room surfaces and lighting are approximate. Full background texture/depth reconstruction remains a separate quality gate, not a completed capability.

## Next room-quality gate — before calling the photo recreation complete

Time-box the first quality pass after visual comparison; keep the November 2 freeze and approved inference cap.

- [ ] Compare the saved bedroom from Photo view with the reference: floor/wall boundary, wall corner, object contacts, bed/chair facing, proportions, shadows, and missing objects. Record visible mismatches separately from coarse projection error.
- [ ] If room surfaces are the main gap, use reviewed floor/wall segmentation and image-space boundary/vanishing-line estimates to fit planes/camera. Validate the provider's supported prompts before adding calls; bounding boxes alone do not determine room geometry.
- [ ] Evaluate a clean floor/wall texture from documented Muse Image editing, removing furniture from texture regions first. This is a future paid experiment, not an implemented endpoint. Do not put the untouched photo behind movable meshes, which would leave furniture ghosts.
- [ ] Project only reviewed clean surface textures onto the fitted planes. Label extrapolated/hidden surfaces as generated, retain neutral fallback on failure, and check moved/hidden objects do not remain in room textures.
- [ ] Validate material/light observations from the revised Spark prompt and compare exposure/shadow direction visually. Keep broad lights until a more reliable estimate is measured.

A one-photo approximation may be enough for the hackathon, but floor-texture/window fidelity, true dimensions, and unseen geometry must not be marked complete merely because mesh generation works. Read META_MODELS.md for current evidence; no extra inference is authorized by this checklist.

## Phase 4 — Editable and shoppable draft

**Estimate: 5–7 hours, October 31.** Depends on Phase 3.

- [ ] Add floor translation, vertical rotation, uniform scale multiplier, hide/restore, numeric controls, and local undo/redo.
- [x] Implement atomic transform saves with expectedRevision, conflict feedback, and reload persistence; edit APIs reject busy scenes. Local/deployed API checks pass.
- [ ] Build merchant product form/card with price/currency validation, HTTPS link, description, and thumbnail.
- [ ] Seed 2–3 rights-cleared replacement products/GLBs in the scene catalog through a trusted script.
- [ ] Implement mesh+product replacement in one transaction with normalized pivot/size and undo.
- [ ] Add responsive object list/product sheet and keyboard-accessible controls.
- [x] Show a small expandable reference photo in Scene Studio (composition correction). Add Muse Image only after every core gate passes.

**Pass:** select a lamp, enter details, move/rotate/scale/hide/undo, replace it, Save, refresh, and see the exact saved draft with correct product mapping. Two simultaneous saves produce a visible conflict instead of data loss.

## Phase 5 — Publish, share, and verify deployed behavior

**Estimate: 4–6 hours, November 1.** Depends on Phase 4.

- [ ] Build manifest serializer and validate the canonical JSON schema plus semantic asset/product checks.
- [ ] Publish a consistent revision as immutable JSON; store the reachable render-asset allowlist and random slug.
- [ ] Build anonymous shared viewer/product sheet using shared rendering components.
- [ ] Resolve only snapshot assets to short-lived signed GET URLs; support refresh without draft/raw-media exposure.
- [ ] Add revoke/archival behavior, noindex/no-store/referrer settings, and safe external product links.
- [ ] Verify later draft edits/replacements do not change the publication or break old asset references.
- [ ] Run two-account authorization checks for all fetch, mutate, publish, sign, run, and replacement paths.
- [ ] Test job failure/partial success, no matches, stale upload signature, interrupted dispatch, known-provider-job retry, and uncertain submission handling.
- [ ] Test real GLB downloads/CORS on production-like storage; test mobile selection and a WebGL fallback.

**Pass:** an anonymous browser opens a frozen scene, selects each product, and follows the correct merchant URL. It cannot obtain a source photo/mask/raw response or use editor APIs. Revoked shares stop issuing new access; existing signature lifetime is documented.

## Phase 6 — Release candidate and hackathon package

**Estimate: 3–4 hours, November 2.** Depends on all P0 gates.

- [ ] Run one fresh deployed upload→review→3D→edit→replace→publish flow with real Meta models.
- [ ] Run clean build/typecheck/lint and focused service/contract checks; record what is and is not tested.
- [ ] Measure generation wall time, per-stage failures, GLB/texture sizes, desktop/mobile frame behavior, and actual charges.
- [ ] Fix blocking defects before visual polish; freeze scope. Voice/embeds/extra samples remain optional.
- [ ] Save a fully generated reference scene and confirm it works independently of model availability.
- [ ] Polish empty/loading/error states, responsive layout, product-card clarity, and approximate-preview wording.
- [ ] Add actual setup/run/deployment instructions and model/asset attribution to README; no secrets or private images in git.
- [ ] Record the demo at the participant-required length and prepare screenshots, project description, architecture explanation, source link, and live URL.
- [ ] Verify the correct track, required model evidence, licenses, final deadline, and submission fields against the participant portal.
- [ ] Submit through the participant process when authorized; retain the working deployment through judging.
- [ ] Mark completed phases here, update CONTEXT.md, and record the final known limitations.

**Pass:** all P0 requirements in PLAN.md work on the public deployment and the submission package accurately describes the implementation. A saved sample is a backup, not a substitute for the fresh-upload validation.

## First setup checklist

| Service | Needed configuration | Where it belongs |
| --- | --- | --- |
| Meta | API key, permitted model IDs, rate/credit limits, participant rules | Server secrets + brief nonsecret access notes |
| Hosted SAM 3D | Account/key, confirmed endpoint/output contract, billing unit/cap | Server secret + META_MODELS.md observed spike results |
| Neon | Project/region, dev/prod branch selection, pooled/direct URLs, Auth URL/secret and domains | Platform/local secrets; nonsecret IDs/region in setup docs |
| Cloudflare | Private R2 bucket, scoped token, CORS, staging lifecycle | Server secrets + environment-specific config |
| Vercel | Existing repo linkage, app region/runtime, stable staging/production origins, Workflow integration | Project settings and environment variables |
| GitHub | Existing ReScene repo, feature branch, CI | Repository and `.github/workflows` after scaffolding |

Never request credentials by committing them to a document. Prefer connected account configuration or platform/local secret storage when implementation begins.

## Scope cuts, in order

1. Voice commands, embed code, optional Muse Image enhancements.
2. Additional sample scenes, OAuth, advanced shadows/material tools, cosmetic animation.
3. More than three demo objects, automatic metric calibration, sophisticated automatic room geometry.

Preserve real Meta inference, independent meshes, object editing, product mapping, save/reload, sharing, and ownership. If those cannot be completed, report the remaining gap directly rather than marking the project complete.

## Historical planning validation (before implementation)

Checked October 29, 2026:

- Prisma **7.10.1** `validate` passed for the eight-model/nine-enum schema; the schema was formatted with the same CLI.
- AJV (Draft 2020-12 with format validation) accepted the manifest schema and synthetic example.
- Local Markdown link targets and whitespace checks passed across README, AGENTS, and all six context/plan documents.
- SQL constraint additions are saved and reviewed as proposed migration input. The local Prisma `migrate diff` invocation returned no SQL, including with an explicit temporary config, so generated-DDL/application testing was **not** completed. Run the normal migration/constraint tests on an isolated development database in Phase 1; do not count the SQL file as database-verified.
- No cloud resources were provisioned, no cloud migrations were applied, no inference credits were consumed, and no app deployment/build was attempted.

These checks validate planning artifacts, not model access, reconstruction quality, or the running application. Remaining gates are deliberately unchecked above.

The foundation work subsequently resolved DDL generation and applied the reviewed migration. Current validation is recorded in [SETUP.md](SETUP.md); the historical planning-only statements above do not describe the current deployment.


**Current runtime gate, October 29:** production upload→Spark/SAM→review data→three independent GLBs→saved transform API passes; signed downloads/CORS, replayed starts, stale saves, origin rejection, and second-account isolation pass. Browser control is disabled in Work settings, so visual mesh/interaction/mobile QA is still pending. Product cards/replacement/publication remain future work. See TESTING.md.

Runtime/editor PR #2 merged into `main` on October 29 (`8f56977`). Both PR CI runs and Vercel checks passed. The deployed three-object API flow and editor-page rendering checks pass; visual browser QA is the next verification action.


**Composition correction verification, October 29:** [PR #3](https://github.com/jimclydegm/ReScene/pull/3) merged at `81bf9ac`. Both PR CI runs, Vercel preview, main CI, and production deployment passed. Local and deployed existing-GLB checks pass matching/persistence/base-pose preservation/exact restore/stale revision/origin/second-account isolation and server-rendered reference controls. No new inference. Visual/mobile QA and revised Spark environment-output validation remain unchecked above.
