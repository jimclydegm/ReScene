# Test the photo-to-3D prototype

Updated October 29, 2026. Production and local end-to-end API checks pass: upload → analysis/masks → three meshes → saved edits. Browser automation is currently disabled in Work settings, so rendered controls/mesh appearance have not been visually verified in this phase.

## Browser journey

1. Open [ReScene](https://rescene-eta.vercel.app), sign in, and choose **Create a scene**.
2. Upload `test-results/inputs/bedroom-test-wide.png` from this checkout (the corrected synthetic room image). Save the photo.
3. Click **Find objects**. The app uses Meta Spark to select up to three main pieces, then SAM 3.1 to outline each. The server keeps processing if you close the tab.
4. Review the object list. Select a checkbox to highlight its mask in the photo. Choose only outlines that cover the intended object; unclear/multiple-instance detections are disabled.
5. Click **Build … objects in 3D**. The server submits one hosted Meta SAM 3D Objects job with the ordered reviewed masks. Wait for the editor; reload preserves job progress.
6. Select an object from the list or click its mesh. Drag the viewport to orbit, right-drag to pan, and scroll to zoom. Use **Photo view** to return to the fitted photo camera (older manual stages say Reset camera).
7. Adjust **Left / right**, **Forward / back**, **Height**, **Rotation**, or **Size**. Uncheck **Show object** to hide it. **Undo** restores the previous local edit.
8. Click **Save scene**, refresh, and verify that the layout persists. Another browser tab saving an older revision receives a conflict instead of overwriting changes.

Jim requested removing the cumulative app allowance on October 29. Generation no longer checks `GENERATION_BUDGET_USD`; run estimates ($1.42 analysis/$1 reconstruction) remain historical bookkeeping. Repeated starts with the same idempotency key reuse the run, one active generation per user is enforced, and paid submissions have no automatic retries. Meta credits and fal billing remain separate.

For an already generated scene, click **Match photo layout** below the viewer. It reuses saved SAM poses, preserves relative scale/orientation/depth, fits the photo camera, and adds an estimated floor/walls. It resets and saves transforms; **Undo photo layout** restores the previous composition. Save or reload unsaved edits first. New supported reconstructions compose during ingestion.

Click the **Reference photo** thumbnail in Scene Studio to expand the original without leaving the editor. Close with the button, Escape, or the backdrop. The image remains private.

Shapes, hidden surfaces, measurements, room geometry/materials, and lighting remain approximate. Existing scenes use sampled photo colors with a plain floor and diffuse neutral lighting; they do not gain new AI room observations unless a new analysis is run. The updated Spark room schema/prompt has not had a live inference test. Product cards, replacements, and anonymous sharing are not part of this build yet.

## Developer checks

```sh
npm ci
npm run lint
npm test
npm run build
npm run typecheck
```

Local app: configure `.env.local`, set `GENERATION_ENABLED=true`, run `npm run dev`. There is no cumulative app allowance variable. Workflow uses its local development world automatically; deployed execution uses Vercel's managed world.

`scripts/smoke-generation.ts` is an explicit integration helper. It uses the QA account file produced by `smoke-foundation.ts`; it never prints credentials or signed URLs. `prepare` uploads the synthetic room, `start` spends analysis inference, `reconstruct` spends GPU inference, `status` reads progress, and `save` verifies signed GLB downloads/CORS plus persistence/revision/origin/two-account isolation. Paid modes require prior authorization; they are not CI tasks.

```sh
QA_CREDENTIAL_FILE=/absolute/path/to/qa.json npm exec tsx scripts/smoke-generation.ts status
```

To test production, also set `SMOKE_BASE_URL=https://rescene-eta.vercel.app` and `GENERATION_QA_FILE=test-results/generation-production-qa.json`. Keep that file and all source/mask/model/raw artifacts ignored. Do not rerun `prepare` unless intentionally creating a new test; paid requests reuse saved idempotency keys.

## Current evidence and limitations

- CLI experiment: one Spark request, two SAM concepts, one two-object reconstruction; independent nightstand/chair GLBs passed bounded ingestion. Their textures match the intended object types. Pose conversion is now checked against Meta source, geometric regressions, and both saved reconstruction batches; browser appearance is still unverified.
- Local app: fresh synthetic upload, one analysis with three SAM concepts, and one reconstruction reached READY with bed/chair/nightstand meshes. Repeated starts returned the same run ID. Saved model positions persisted; stale revisions, cross-origin mutations, and second-account access were rejected.
- First production analysis: Spark succeeded; SAM received HTTP 400 because its media fetcher rejected a signed R2 URL. The workflow stopped without automatic resubmission. The fix sends bounded normalized image bytes inline to Meta; a direct live SAM diagnostic accepted this format. The corrected fresh production run passed: analysis/masks took 28.8 seconds and reconstruction/ingestion took 93.7 seconds; bed/nightstand/chair reached READY, with save/reload, revision/origin/ownership checks passing.
- Production budget pool is $7.50 across database runs. CLI reserve is $2.405 plus $0.0025 for the inline-SAM diagnostic. The rejected production run was manually reconciled to $0.02 with an audit note and observed Spark usage. These are conservative reservations/usage estimates, not provider invoices.
- Automatic staging expiry remains disabled at Jim's request. No source photos, masks, or raw model responses are public.
- Visual browser controls, mobile editor layout, real-photo quality beyond the synthetic fixture, partial mesh success, individual resegmentation, and publication remain unchecked.


## Composition regression checks (no inference)

`scripts/smoke-composition.ts` uses an existing READY QA scene and existing QA accounts. It applies photo layout, checks common model scale/pose/camera and signed workspace output, edits yaw/size and confirms the baseline survives, checks stale/origin/other-account rejections and rendered reference controls, then restores the original composition/transforms exactly. It increments revisions during the test but makes no generation call.

```sh
QA_CREDENTIAL_FILE=/absolute/path/to/qa.json \
GENERATION_QA_FILE=test-results/generation-production-inline-qa.json \
npm exec tsx scripts/smoke-composition.ts
```

Add `SMOKE_BASE_URL=https://rescene-eta.vercel.app` for production. Use a QA scene only; the runner temporarily changes its layout. Local integration passed with the real saved bed/nightstand/chair GLBs. Twenty-two focused tests cover pose ordering/axes, shared scale, camera fit, invalid/behind-camera data, GLB hierarchy/cycles, room-observation validation, masks, and existing contracts. Lint/typecheck/production build pass. The same composition runner passed on production after PR #3 merged (`81bf9ac`): matching/persistence, imported baseline preservation, exact previous-layout restore, stale revision/origin rejection, second-account isolation, and rendered reference controls. Both PR CI runs, Vercel preview, main CI, and production deployment passed. Visual/mobile behavior is still unverified because browser access remains disabled; the revised Spark environment prompt has not been called live.

At the end of composition work the database reservation sum was $7.28 of $7.50. Jim subsequently removed the app cap, so that historical value no longer blocks new runs. No additional inference was submitted for this correction. The private color fallback is not evidence of live validation of the updated Spark prompt.


## Restart earlier steps

- **Change photo** (also step 1): confirm to clear the photo and all later results, then upload again in the same scene.
- **Analyze again**: confirm to keep the photo but clear candidates/masks/3D/layout/edits. Click Find objects to submit the new analysis.
- **Rebuild 3D** (also step 2 from the editor): confirm to keep the photo and masks, clear models/layout/edits, then review/reselect and Build in 3D again.
- **Keep current scene** or Escape cancels without a request. Restart controls are disabled during generation; stale tabs receive a revision conflict.

`node --conditions=react-server --import tsx scripts/smoke-restarts.ts` with QA_CREDENTIAL_FILE and an existing GENERATION_QA_FILE creates a separate QA copy of real saved photo/mask/GLB assets. It tests confirmation, active/stale/origin/ownership guards, concurrent reset conflict, old-job resume denial, each clearing boundary, and reupload in the same scene. No inference is submitted by this runner. The local run passes. Invalidated assets are marked DELETED; historical provider/usage records remain. No automatic R2 expiry is added.
