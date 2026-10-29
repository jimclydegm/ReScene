# Next implementation: prove the Meta reconstruction path

Prepared October 29, 2026. The foundation is merged through [PR #1](https://github.com/jimclydegm/ReScene/pull/1). Upload/auth/database/storage work; real model inference, generated meshes, product editing, and publishing are still pending. November 2 remains the build freeze.

Read this checklist with [META_MODELS.md](META_MODELS.md) for provider details and [ARCHITECTURE.md](ARCHITECTURE.md) for pipeline invariants. Do not reload all planning documents for each small task.

## Immediate target

One real room photo → two reviewed masks → two independent Meta-generated GLBs → independently select and move both in a browser. This is the feasibility gate, not the final three-object shoppable demo.

Time-box the experiment to 2–4 focused hours after the input and billing prerequisites are ready. Keep `GENERATION_ENABLED=false` for the public app during the experiment. Do not enable generation merely because model discovery succeeds.

**October 29 update:** Jim approved **US$10 total development inference** and requested a browser-testable upload-to-3D editor. Live Spark/SAM and hosted Meta SAM 3D have succeeded on the synthetic bedroom. The app workflow/review/editor is implemented and local and deployed API checks pass; visual QA is pending browser access. See [TESTING.md](TESTING.md). Product information, replacement, and publication remain later work.

## 1. Prepare the bounded experiment

- [x] Start implementation from updated `main` on `codex/meta-feasibility`. The existing foundation branch/preview remains registered with Auth and R2.
- [x] Prepare the corrected synthetic bedroom fixture created in this chat. Keep its provenance with the private checkpoint. Real-photo testing remains required before the final demo.
- [x] Normalize the fixture using the upload path's canonical transform. Save a private experiment ID, SHA-256, width, and height. The spike uses a separate private R2 namespace and does not create application Asset rows.
- [ ] Verify current Meta/fal pricing, billing unit (per job/object/image), account balance, and any participant terms. Record a total experiment spending cap with Jim before paid submissions. No cap has been selected yet.
- [ ] Check participant rules for model/host eligibility, deadline, submission format, and judging criteria. Keep unknown rules explicitly unresolved rather than inferring them from the invitation.
- [x] Review the installed Meta parser and fal SDK documentation/types and official endpoint contracts. Runtime behavior still needs live validation.

Submission limits for the first successful path: one Spark analysis, at most two initial SAM concept requests, and one two-object reconstruction job. A request-count limit does not replace the monetary cap. Additional submissions require remaining budget and an explicit recorded reason. Disable automatic retries around paid submission where acceptance could be ambiguous.

## 2. Spark analysis

- [ ] Add a small server-side analysis adapter using the existing Meta client and configured Spark model, with Standard mode and bounded structured output.
- [ ] Validate maximum five candidates, useful object labels/concepts, and boxes within normalized-image dimensions. Reject malformed results; do not invent products, prices, or metric dimensions.
- [ ] Save the raw result privately and a sanitized summary with model ID, prompt version, request ID when available, duration, and usage. Do not put signed URLs or image payloads in console logs.
- [ ] Pick two clear candidates for the first segmentation call; preserve stable application IDs separately from model-local IDs.

Pass: the two selected labels correspond to recognizable objects and the saved output passes our validator. Add meaningful tests for invalid/out-of-bounds structured output.

## 3. SAM masks and inspection

- [ ] Add a SAM adapter using the documented special-token response and official installed parser. Do not treat the response as ordinary JSON or assume a returned PNG URL.
- [ ] Decode full-image masks, validate dimensions/foreground polarity/nonempty area, and store private PNG masks and transparent cutouts.
- [ ] Inspect overlays against the normalized image. Resolve concept-to-instance mapping explicitly; exclude extra instances instead of passing an unreviewed array downstream.
- [ ] Record two ordered entries: stable object ID, candidate label, mask asset ID, and provider-local instance reference. Exercise no-match handling without submitting a paid duplicate just to test the error UI.

Pass: both overlays cover the intended object, share the exact normalized coordinate space, and can be reloaded from saved artifacts. Keep a sanitized parser regression fixture when possible.

## 4. One queued SAM 3D Objects job

- [ ] Confirm the host runs Meta SAM 3D Objects and its license/participant eligibility. Use the existing fal adapter only after the documented schema is checked.
- [ ] Send the same normalized image plus the two full-image masks in frozen order; resolve fresh private signed input URLs immediately before submission.
- [ ] Persist submission intent locally/private storage and save the provider request ID as soon as returned. If the response is lost after sending, stop and reconcile; do not automatically submit another job.
- [ ] Poll the known request ID with a deadline. Save progress, elapsed time, output inventory, and quoted/observed charges. Polling/retrieval retries must retain the same ID.
- [ ] Retrieve and validate individual GLBs and layout metadata. Bound bytes and external download destinations; reject unexpected external GLTF resources. Preserve raw results privately.

Pass: two real, independently usable object meshes map to the intended input masks. A combined-only mesh, splat, flat cutout, or procedural proxy does not pass.

## 5. Verify placement in the browser

- [ ] Load both meshes using a temporary owner-only/local inspection view; never expose arbitrary R2 keys through a new public debug route.
- [ ] Determine axis direction, quaternion ordering, scale, baked transforms, support height, pivots, and bounds. Apply the importer conversion once. Keep a written example of each object's input/output transform.
- [ ] Select and move each object independently; verify the other stays fixed. Test orbit/pan/reset and reload saved artifacts without another inference call.
- [ ] Record load time, total bytes, visual defects, and manual placement needs. Report shape quality separately from layout quality.

Pass: recognizable independent objects render and move separately. Manual placement can be an explicit editor requirement if automatic poses are unreliable. Do not claim real measurements or faithful unseen surfaces.

## Files and evidence to produce

These are proposed implementation paths, not existing completed modules:

| Artifact | Purpose |
| --- | --- |
| `scripts/spike-meta.ts` | Explicit, bounded experiment runner; resume known provider requests |
| `src/lib/ai/analyze.ts` | Validated Spark result adapter |
| `src/lib/ai/segment.ts` | SAM parsing, instance mapping, raster validation |
| `src/lib/ai/sam3d.ts` | Extend the existing client with checked submit/status/result contracts |
| `tests/fixtures/meta/` | Sanitized contracts/parser regressions; no credentials, photos, masks, or signed links |
| Private R2 artifacts + ignored local report | Input/masks/raw outputs/GLBs/request IDs/charges and inspection notes |
| `docs/META_MODELS.md` | Observed provider contract, transform convention, quality/cost findings |

The runner must checkpoint a known provider request ID before attempting ingestion and offer a resume path that never silently resubmits. Keep private local reports outside tracked paths; the existing `test-results/` directory is ignored. Check redaction before saving any fixture in Git.

## Build slices after the gate passes

1. **Analysis and review:** persist GenerationRun/Step records, active-run/budget guard, durable dispatch/claim/resume, progress polling, Spark/SAM adapters, then object overlay/list review. Acceptance: fresh upload reaches REVIEW and survives reload.
2. **Reconstruction:** freeze reviewed mask ordering/revision, durable queued submission/polling, validated ingestion, tested importer, independently selectable objects, and known-job recovery. Acceptance: three real objects from a fresh photo reach the editor.
3. **Editor and products:** move/rotate/scale/hide/undo, revision-aware save/reload, seller product fields, and one prepared replacement. Acceptance: edited layout and product mapping persist.
4. **Publish and freeze:** immutable publication, anonymous viewer, asset allowlist, revoke, two-account checks, fresh deployed end-to-end demo, then recording before November 2 freeze.

Register the next branch's stable preview origin in Neon Auth and R2 CORS before browser upload tests. The prototype still shares data/Auth/storage between environments; do not mistake a new Git branch for data isolation. Keep automatic staging deletion disabled per Jim's choice.

If the feasibility gate fails after the time box, record the concrete failure and evaluate only another documented host of the same Meta model or a bounded GPU runner. Agree a smaller scope with Jim if neither is viable. Keep the existing working photo-upload app available throughout.
