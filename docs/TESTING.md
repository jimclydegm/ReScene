# Test the photo-to-3D prototype

Updated October 29, 2026. Production and local end-to-end API checks pass: upload → analysis/masks → three meshes → saved edits. Browser automation is currently disabled in Work settings, so rendered controls/mesh appearance have not been visually verified in this phase.

## Browser journey

1. Open [ReScene](https://rescene-eta.vercel.app), sign in, and choose **Create a scene**.
2. Upload `test-results/inputs/bedroom-test-wide.png` from this checkout (the corrected synthetic room image). Save the photo.
3. Click **Find objects**. The app uses Meta Spark to select up to three main pieces, then SAM 3.1 to outline each. The server keeps processing if you close the tab.
4. Review the object list. Select a checkbox to highlight its mask in the photo. Choose only outlines that cover the intended object; unclear/multiple-instance detections are disabled.
5. Click **Build … objects in 3D**. The server submits one hosted Meta SAM 3D Objects job with the ordered reviewed masks. Wait for the editor; reload preserves job progress.
6. Select an object from the list or click its mesh. Drag the viewport to orbit, right-drag to pan, and scroll to zoom. Use **Reset camera** if needed.
7. Adjust **Left / right**, **Forward / back**, **Height**, **Rotation**, or **Size**. Uncheck **Show object** to hide it. **Undo** restores the previous local edit.
8. Click **Save scene**, refresh, and verify that the layout persists. Another browser tab saving an older revision receives a conflict instead of overwriting changes.

The global prototype allowance is deliberately small. The app conservatively reserves $1.42 for analysis and $1 for reconstruction; repeated requests with the same idempotency key reuse the saved run. A budget-limit message leaves saved scenes readable. Ask before increasing allowance; Jim approved $10 total development inference, not unlimited generation.

Shapes, hidden surfaces, scale, and arrangement are approximate. The renderer fits object meshes to a neutral stage; it does not claim measured room layout. Product cards, replacements, and anonymous sharing are not part of this build yet.

## Developer checks

```sh
npm ci
npm run lint
npm test
npm run build
npm run typecheck
```

Local app: configure `.env.local`, set `GENERATION_ENABLED=true`, choose the **remaining approved** global `GENERATION_BUDGET_USD`, and run `npm run dev`. Never choose a new budget without accounting for existing CLI and DB reservations. Workflow uses its local development world automatically; deployed execution uses Vercel's managed world.

`scripts/smoke-generation.ts` is an explicit integration helper. It uses the QA account file produced by `smoke-foundation.ts`; it never prints credentials or signed URLs. `prepare` uploads the synthetic room, `start` spends analysis inference, `reconstruct` spends GPU inference, `status` reads progress, and `save` verifies signed GLB downloads/CORS plus persistence/revision/origin/two-account isolation. Paid modes require prior authorization; they are not CI tasks.

```sh
QA_CREDENTIAL_FILE=/absolute/path/to/qa.json npm exec tsx scripts/smoke-generation.ts status
```

To test production, also set `SMOKE_BASE_URL=https://rescene-eta.vercel.app` and `GENERATION_QA_FILE=test-results/generation-production-qa.json`. Keep that file and all source/mask/model/raw artifacts ignored. Do not rerun `prepare` unless intentionally creating a new test; paid requests reuse saved idempotency keys.

## Current evidence and limitations

- CLI experiment: one Spark request, two SAM concepts, one two-object reconstruction; independent nightstand/chair GLBs passed bounded ingestion. Their textures match the intended object types; automatic poses remain unverified.
- Local app: fresh synthetic upload, one analysis with three SAM concepts, and one reconstruction reached READY with bed/chair/nightstand meshes. Repeated starts returned the same run ID. Saved model positions persisted; stale revisions, cross-origin mutations, and second-account access were rejected.
- First production analysis: Spark succeeded; SAM received HTTP 400 because its media fetcher rejected a signed R2 URL. The workflow stopped without automatic resubmission. The fix sends bounded normalized image bytes inline to Meta; a direct live SAM diagnostic accepted this format. The corrected fresh production run passed: analysis/masks took 28.8 seconds and reconstruction/ingestion took 93.7 seconds; bed/nightstand/chair reached READY, with save/reload, revision/origin/ownership checks passing.
- Production budget pool is $7.50 across database runs. CLI reserve is $2.405 plus $0.0025 for the inline-SAM diagnostic. The rejected production run was manually reconciled to $0.02 with an audit note and observed Spark usage. These are conservative reservations/usage estimates, not provider invoices.
- Automatic staging expiry remains disabled at Jim's request. No source photos, masks, or raw model responses are public.
- Visual browser controls, mobile editor layout, real-photo quality beyond the synthetic fixture, partial mesh success, individual resegmentation, and publication remain unchecked.
