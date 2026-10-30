# Test the photo-to-3D prototype

Updated October 29, 2026. Production and local end-to-end API checks pass: upload → analysis/masks → three meshes → saved edits. Browser access now works. Desktop composition/selection/hide and 390px confirmation/reference dialogs have been visually checked.

## Browser journey

1. Open [ReScene](https://rescene-eta.vercel.app), sign in, and choose **Create a scene**.
2. Upload `test-results/inputs/bedroom-test-wide.png` from this checkout (the corrected synthetic room image). Save the photo.
3. Click **Find objects**. The app uses Meta Spark to select up to three main pieces, then SAM 3.1 to outline each. The server keeps processing if you close the tab.
4. Review the object list. Select a checkbox to highlight its mask in the photo. Choose only outlines that cover the intended object; unclear/multiple-instance detections are disabled.
5. Click **Build … objects in 3D**. The server submits one hosted Meta SAM 3D Objects job with the ordered reviewed masks. Wait for the editor; reload preserves job progress.
6. Select an object from the list or click its mesh. Drag the viewport to orbit, right-drag to pan, and scroll to zoom. Use **Photo view** to return to the fitted photo camera (older manual stages say Reset camera).
7. Adjust **Left / right**, **Forward / back**, **Height**, **Rotation**, or **Size**. Uncheck **Show object** to hide it. **Undo** restores the previous local edit.
8. Click **Save changes**, refresh, and verify that the layout persists. Another browser tab saving an older revision receives a conflict instead of overwriting changes.

Jim requested removing the cumulative app allowance on October 29. Generation no longer checks `GENERATION_BUDGET_USD`; run estimates ($1.42 analysis/$1 reconstruction) remain historical bookkeeping. Repeated starts with the same idempotency key reuse the run, one active generation per user is enforced, and paid submissions have no automatic retries. Meta credits and fal billing remain separate.

For an already generated scene, click **Match photo layout** below the viewer. It reuses saved SAM poses, preserves relative scale/orientation/depth, fits the photo camera, and adds an estimated floor/walls. It resets and saves transforms; **Undo photo layout** restores the previous composition. Save or reload unsaved edits first. New supported reconstructions compose during ingestion.

Click the **Reference photo** thumbnail in Scene Studio to expand the original without leaving the editor. Close with the button, Escape, or the backdrop. The image remains private.

Shapes, hidden surfaces, measurements, room geometry/materials, and lighting remain approximate. Existing scenes use sampled photo colors with a plain floor and diffuse neutral lighting; they do not gain new AI room observations unless a new analysis is run. The updated Spark room schema/prompt passed a production inference with warm left lighting, wood floor and left-wall observations. Product cards, replacements, and anonymous sharing are not part of this build yet.

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

Add `SMOKE_BASE_URL=https://rescene-eta.vercel.app` for production. Use a QA scene only; the runner temporarily changes its layout. Local integration passed with the real saved bed/nightstand/chair GLBs. Twenty-two focused tests cover pose ordering/axes, shared scale, camera fit, invalid/behind-camera data, GLB hierarchy/cycles, room-observation validation, masks, and existing contracts. Lint/typecheck/production build pass. The same composition runner passed on production after PR #3 merged (`81bf9ac`): matching/persistence, imported baseline preservation, exact previous-layout restore, stale revision/origin rejection, second-account isolation, and rendered reference controls. Both PR CI runs, Vercel preview, main CI, and production deployment passed. The initial browser block was later resolved: desktop material/pose/selection/hide/reload and mobile reference/confirmation dialogs are checked. Revised Spark environment output now passes live.

At the end of composition work the database reservation sum was $7.28 of $7.50. Jim subsequently removed the app cap, so that historical value no longer blocks new runs. No additional inference was submitted for this correction. The private color fallback is not evidence of live validation of the updated Spark prompt.


## Restart earlier steps

- **Change photo** (also step 1): confirm to clear the photo and all later results, then upload again in the same scene.
- **Analyze again**: confirm to keep the photo but clear candidates/masks/3D/layout/edits. Click Find objects to submit the new analysis.
- **Rebuild 3D** (also step 2 from the editor): confirm to keep the photo and masks, clear models/layout/edits, then review/reselect and Build in 3D again.
- **Keep current scene** or Escape cancels without a request. Restart controls are disabled during generation; stale tabs receive a revision conflict.

`node --conditions=react-server --import tsx scripts/smoke-restarts.ts` with QA_CREDENTIAL_FILE and an existing GENERATION_QA_FILE creates a separate QA copy of real saved photo/mask/GLB assets. It tests confirmation, active/stale/origin/ownership guards, concurrent reset conflict, old-job resume denial, each clearing boundary, and reupload in the same scene. No inference is submitted by this runner. Local and deployed runs pass. Invalidated assets are marked DELETED; historical provider/usage records remain. No automatic R2 expiry is added.


### Live restart follow-up

PR #4 merged (`5189d05`), main CI/preview/production passed. Fresh production QA state is ignored `test-results/generation-restart-live-qa.json` (scene `672ef2e3-8ddc-4b94-bacd-b5f9502f780d`). The analysis passed beyond the old cap and produced the new environment fields. Bed/nightstand masks passed; armchair returned NO_MATCH and was correctly disabled. A two-object reconstruction reached READY and was then explicitly restarted to REVIEW: photo/masks/IDs persisted, model URLs/layout cleared, and a second reconstruction was submitted with a new idempotency key. The second reconstruction also reached READY. Fresh GLB downloads/CORS and save/reload, stale revision/origin and second-account checks passed. Desktop Chrome shows both rebuilt meshes with the new room observations; its Rebuild 3D confirmation and cancel are verified. Analysis took 18.1 seconds and the first/rebuilt GPU runs took 58.7/58.8 seconds. Phone-sized inspection found an inherited canvas width overflow; the grid track/viewport/inspector now explicitly shrink.

`scripts/smoke-generation.ts restart-review` and `restart-analysis` explicitly clear later QA results and rotate relevant idempotency keys; they do not submit inference. `reconstruct`/`start` then submit the requested new run. Never use these destructive modes on a user's scene without authorization. Cancel/confirmation dialogs were visually checked; browser destructive submission itself is covered by the API runner instead of silently accepting a permanent-deletion prompt.

Visual QA found SAM GLBs omit metallicFactor, which glTF interprets as metal. The viewer now clones unspecified generated materials with metalness=0 and disposes those private copies; explicit factors/maps and cached loader materials remain intact. Wood/fabric colors now read correctly. Detailed background texture and physical illumination remain approximate.


## Photo textures and lighting — October 29

PR #5 implements photo-bake-v1 and two editable directional lights plus ambient fill. Migration 20261029110000_surface_texture applied to shared Neon. `scripts/smoke-appearance.ts` with APPEARANCE_SOURCE_SCENE creates a private QA copy of authorized saved inputs and checks bake/restore, unchanged geometry/baselines, light persistence, stale revision and non-owner rejection. APPEARANCE_QA_SCENE can reuse that QA copy. No model submissions are made.

Target `1cc4e890-1ca8-4435-ac00-722dccefb995` is the chair/cabinet/vase source. Its offline bake copied 245,668 / 174,617 / 94,877 atlas texels and preserved original generated texture elsewhere. Direct source detail was applied to this scene, with original GLBs retained for Restore AI textures. A QA clone (`f2848b95-8447-41eb-9544-0d72dd605565`) passed the service checks in ~24s including storage/restore/reapply. Browser inspection shows cabinet grain and chair fabric; main intensity and X position were changed with native controls and saved. HTTP checks passed valid save, light bounds=400, stale=409, cross-origin=403 and non-owner=404. Twenty-eight tests/lint/typecheck/build and PR/main CI plus Vercel preview pass. Production is READY and visually verified on the requested scene; production appearance saves, stale/origin/ownership rejection, and signed floor/wall downloads with CORS pass. No inference charged for this phase.

Room texture sheets copy clean observed patches and extend them with mirrored wrapping; the wall uses one patch across each wall to avoid repeating exposure seams. They are not reconstructed full room textures. Source illumination remains baked in object colors, so stronger lights can wash out detail and seams/oblique-view stretching remain possible. Unseen surfaces retain SAM appearance. Original meshes/geometry/transforms are preserved.

## Dashboard and inspector layout — October 29

Dashboard pagination/progress tests cover malformed/repeated/out-of-range query values, empty libraries, historical run completion after restart, partial analysis, active generation and interrupted runs. Local production-build HTTP checks verified 16 projects across three pages without duplicates, all cards owned by the session, signed preview downloads, invalid-page bounds, anonymous redirect and second-account isolation. Scene SSR includes the tablist, scrolling body, fixed save footer and visibility switch. The same HTTP checks pass against production after PR #6 (aa0aed1), including all 16 projects/three pages and signed previews. All 34 tests, lint/typecheck/build and PR CI pass. No inference or scene edits were submitted. The generation smoke script now checks the Save changes label; it was not run because it would submit inference.

Browser access is disabled in Work settings. Responsive CSS, keyboard tab navigation and panel changes are implemented, but desktop/mobile visual and interaction checks are not yet verified. Do not report them as passing.

## Phase 4A — product cards

`SMOKE_CREDENTIAL_FILE=/absolute/path/to/qa-credentials.json SMOKE_SCENE_ID=<authorized-QA-clone> SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-products.mjs`

Credential JSON follows smoke-foundation's `{owner:{email,password},other:{email,password}}` shape. Use the disposable appearance QA clone, not a merchant's real listing. The check saves a PHP 129.95 merchant card, verifies the signed private thumbnail and unchanged geometry/baselines, tests invalid HTTPS/object/stale/origin/other-account rejections, then restores original metadata. Retained private orphan product/assets are not automatically deleted. No inference submitted. Local and production checks pass after PR #7 (fee9912); the QA metadata was restored after each run. 39 tests, lint/typecheck/build and PR CI pass. Browser interaction checks for numeric blur/Enter, undo/redo and Products tab remain pending because access is disabled.

Manual: select an object → Products → Add product details → enter a real merchant name/price/link → Save changes → reload. Verify its cutout/card and exact saved fields. Select a different object to confirm separate cards. Change a property, Undo, Redo, Save; number inputs commit on blur/Enter. Empty price means not listed, zero is retained. Remove product details unlinks the card on save. Sharing/catalog replacement are not implemented yet.

## Phase 4B — catalog replacement

`SMOKE_CREDENTIAL_FILE=/absolute/path/to/qa-credentials.json SMOKE_SCENE_ID=<disposable READY copy> SMOKE_FOREIGN_SCENE_ID=<another owned scene with demo catalog> SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-catalog.mjs`

Use the fresh disposable catalog QA copy `6800b8a2-7c39-4a52-8fde-790eb03ab46c`, not the earlier appearance QA example (Jim has saved a listing there). The check seeds if necessary, creates a temporary original product when absent, replaces through all three items, downloads GLBs/thumbnails, edits a placed card while preserving templates, checks empty-price SQL semantics, verifies cross-scene/other-owner/origin/invalid/stale rejection, blocks photo matching/textures, saves lighting, and restores original model bytes/product/baseline. Restore comparisons ignore expiring URL query signatures and compare the underlying image path. The original appearance example was restored after the earlier check; no source meshes/cards were permanently replaced. Local first seed caught the SQL price/currency pair invariant; absent prices now store both columns null. No schema change or inference.

42 tests cover original GLB validation/bounds, uniform fitting/bottom-center anchoring and degenerate inputs. Lint/typecheck/build and PR CI pass. PR #8 merged at 77cd137; production is READY and the full fresh-copy check passes locally and on production, with original QA metadata restored. Browser interaction QA remains pending because access is disabled. R2 seed/copy bytes from failed transactions remain private; automatic cleanup stays disabled.

Manual: open the chair/cabinet/vase example → Products → select an object → choose a demo replacement. Check its product card, position and size, then refresh. Edit its price and Save changes; templates must stay unchanged. Restore original object recovers the original mesh/card at the current placement. Photo matching/texture actions become available again. Demo products contain no real merchant price/link until supplied by you.

## Phase 5 publication / Phase 6 release

47 tests include matrix-vs-nested-transform equivalence, manual bottom-center normalization, strict snapshot fields, unit rotations, exact reachable IDs and product reference/price/link validation. Runtime contract is contracts/scene-manifest-v2.schema.json; original v1 is historical.

`SMOKE_CREDENTIAL_FILE=/absolute/path/to/qa.json SMOKE_SCENE_ID=6800b8a2-7c39-4a52-8fde-790eb03ab46c SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-publication.mjs`

Local production-build check passes: owner/confirmation/stale/origin guards; duplicate publish reuses the link; anonymous product page renders; GLBs, product images and two QA room textures download; draft merchant/transform edits and model replacement leave the frozen snapshot unchanged; public DTO has no source/mask/editor metadata; other-account revoke is denied; revoke blocks new JSON access. It revokes all test links and restores metadata. Next may stream a not-found page with HTTP 200 after headers have started: the test checks unavailable content/no listing, while the JSON resolver returns 404. No live snapshot URLs are printed or committed.

`scripts/smoke-publication-lifecycle.ts` with SMOKE_OWNER_SCENE_ID and `node --conditions=react-server --import tsx` uses original procedural QA assets to verify archive/restore/restart behavior; it archives its temporary scene and revokes its links. This passes. Direct adversarial QA setup also tried using a source photo ID as a room surface; publication rejected it with 422.

Fresh paid release runner: `scripts/smoke-release.mjs prepare`, `status`, `reconstruct`, `finish`. SMOKE_CREDENTIAL_FILE is required. prepare uploads the approved synthetic input and starts one idempotent Meta analysis; reconstruct submits one two-object job. These two phases spend inference credits; status/report/finish do not. State/timestamps are saved to ignored test-results/release-qa.json. Finish verifies saved merchant fields, catalog replacement, publication, anonymous real GLBs/CORS and revoke. Run release-report.ts with react-server/tsx to save provider/timing/size evidence without secret provider IDs. Null actual cost means unknown, not free.

Browser access remains disabled, so physical appearance, camera orbit/mobile selection, dialogs/clipboard and frame rate are not verified. Google consent, recording and authenticated participant-portal submission remain release gates. See docs/release/DEMO.md.

### Deployed release evidence — October 29

PR #9 merged at be841d8; production is READY. PR CI, 47 tests, lint/typecheck/build pass. The publication integration runner passes on production, including anonymous pages, GLBs/CORS, product thumbnails and two room textures, frozen price/transform/model bindings after draft edits/replacement, no raw-photo/editor data, idempotency, ownership/origin/revision/confirmation guards and revoke. All test links were revoked and disposable metadata restored.

The fresh release scene is 20d22f55-9857-49eb-96f1-435826585347. It completed an actual production WebP upload, one Muse Spark analysis and three SAM masks, one two-object fal reconstruction, saved merchant fields, catalog replacement with an independently edited card, confirmed publication, anonymous cards/real GLBs/CORS, and revoke. It remains a private saved QA scene. State/report files are ignored in test-results; no public snapshot URL is committed.

| Measured server-run item | Observed result |
| --- | --- |
| Meta analysis + reviewed-mask outputs | SUCCEEDED, 19.824 seconds |
| Two-object SAM 3D reconstruction + ingestion | SUCCEEDED, 82.298 seconds |
| Generated mesh files | 1,399,440 / 1,237,708 bytes |
| Provider steps | muse-spark-1.3, sam-3.1 ×3, fal-ai/sam-3/3d-objects ×1 |
| Recorded actual run charges | null / unknown; reserved USD 1.42 + 1.00 are estimates, not bills |
| Final fresh author-to-shopper API check | passed, including revoke |
| Desktop/mobile orbit/selection/dialog/clipboard/frame rate | pending; browser access disabled |

Server-run times exclude upload, merchant review and editing time. Provider usage histories remain private. The fresh run made no automatic paid retry; duplicate start calls reused the same run IDs. Indie developer track is confirmed by Jim; video/portal details and actual contest submission are still pending.

## Consolidated release policy (supersedes default per-phase sweeps)

Run `npm run check` once after the implementation bundle (schema validation, lint, unit tests and production build/type checking). Use `SMOKE_CREDENTIAL_FILE=<private QA file> SMOKE_SCENE_ID=6800b8a2-7c39-4a52-8fde-790eb03ab46c npm run check:release` once against the local production build. It reuses existing models/photos, checks metadata/search/published status, saved merchant edits, one frozen share, archive/restore, asset retention and ownership/origin/revision guards, then restores metadata and revokes its share. It creates no QA projects/uploads and submits zero inference. On production use `SMOKE_BASE_URL=https://rescene-eta.vercel.app npm run check:release -- --smoke` with the same private fixture variables: this is read-only and bounded to changed endpoints/markup.

Do not run every historical smoke runner or fresh generation for ordinary UI changes. Repeat only a failed/affected boundary. Existing fresh Meta evidence above remains valid for unchanged generation. CI runs on PR changes and main, cancels superseded runs, skips docs-only reinstall/build and avoids feature-push duplication. Vercel skips docs/test/tooling-only changes via the documented ignoreCommand convention (0 skips, 1 builds); unknown Git comparisons conservatively build. [Vercel reference](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand).

Consolidated release result, October 29: the full local schema/lint/unit/build check passed, then the affected delivery-scope tests passed after adding the unknown-deployment-history case (52 total cases). The single saved-data integration passed metadata/search/published status, merchant save, existing GLB/CORS, archive/restore, preserved model baselines/photo references, share revocation that stays revoked after restore, and anonymous/other-owner/origin/stale/unconfirmed rejection. It restored metadata and submitted zero inference, with no new QA scenes or photo/model uploads (temporary snapshot/listing records are retained privately). PR #10 merged at 648010b, production is READY, all 52 tests and the single PR CI run pass, and the read-only production smoke passes. Native browser/modal/clipboard interaction remains unverified because browser access is disabled.

Delivery configuration correction: the first docs-only deployment conservatively rebuilt because the earlier .vercelignore removed .git before ignoreCommand. Keep Git metadata in the build workspace so the previous-successful-SHA comparison can run; source secrets/artifacts remain excluded and only Next build outputs are deployed. No app behavior or inference changed.

The Git-metadata configuration correction is deployed at 6552340. Runtime code is unchanged from the passed release smoke. The final documentation-only handoff commit exercises the corrected skip decision without repeating inference or application integration tests.

## Any-scene / clothing correction verification

The prior clothing example (2b495855-65dc-4ca3-ad93-1460e53eb5fe) had REVIEW status with zero SceneObjects and only a successful Spark step: no SAM call occurred. Its empty state was explicitly repaired using one new Spark analysis with clothing focus and three SAM text requests. Shirt and shorts each returned one valid mask; sneakers returned two stored instances, then the new union operation accepted both as one product mask without inference. One additional SAM box+positive/negative-point retry succeeded; the other two accepted masks stayed unchanged. Repeated idempotency keys reused the run and changed parameters with the same key were rejected. A different owner could not choose these masks. No new photo or automatic paid retry was used.

The combined schema/lint/unit/build pass ran the existing 52 tests plus nine new meaningful controls/mask cases. One grayscale fixture assertion was corrected to decode explicitly as grayscale (Sharp otherwise expands PNGs to RGB); all affected cases then passed. The production build/type check and lint pass. The reusable saved-scene integration passed once and restored fixture metadata/shares. Added API checks verified mask input/origin/ownership guards, independent-run validation, backdrop save/revision conflict and restoration of the original backdrop; no inference was submitted by these checks. Native desktop/mobile pointer, dialog and WebGL interaction remain unverified because browser access is disabled.

The same corrected clothing scene then completed one explicit three-item SAM 3D reconstruction with seed 42 in 104 seconds (submit/poll/ingest wall time). All three meshes are READY with embedded-texture GLB export enabled and accepted SAM placement baselines; sizes are 1,745,524 / 1,936,048 / 1,183,316 bytes. Its saved backdrop is studio. This is runtime/asset/pose-contract evidence, not a visually verified garment likeness or fit claim. No publication was created and no source image re-uploaded.

PR #11 merged at 90f5911. CI passes all 61 cases and the application is READY on production (dpl_CMecg2HTP7wowsKSfSEzQTKfwUfy). The bounded production controls smoke passed new mask/run input validation, ownership/origin rejection and rendered backdrop/reset controls; the existing read-only release smoke passed dashboard/studio recovery/navigation/manage checks. No production scene mutations or further inference were submitted by these smokes. Browser pointer/visual verification remains unavailable.

## Complete-subject correction verification

The automatic v4 Spark analysis identified a complete person and three linked clothing/footwear entries with default options and no count/instructions. The first full-person mask exposed a local equal-dimension assumption; the corrected decoder maps raster pixels into source boxes as documented. A second, explicitly initiated mask request succeeded (no automatic retry). One full-person SAM 3D Objects job completed in 26 seconds and produced a 1,381,152-byte textured GLB. Partitioning conserved all 5,218 triangles once: body/context 2,867, shirt 1,281, shorts 838, shoes 232. A static offline mesh render shows complete anatomy/context; browser rendering remains unverified.

Validated existing outputs were adopted into the same private clothing scene without another reconstruction. Its four pieces share the baseline at Y=0, with floorY=0. Earlier state is backed up privately, merchant associations remain, and no publication was created. Whole-group edit enforcement, persisted shared translations, partial-assembly publication rejection, and restoration of transforms/visibility passed. The reusable saved-data release regression also passed with fixture restoration and share revocation. 65 unit cases plus schema/lint/production build/type checks pass. No paid inference was used by unit/API/saved-data checks.

PR #12 merged at f58d4eb. All 65 CI cases pass; production is READY (dpl_3x5X3wAa2TcLRgDaAFEYek1g2hyW). Bounded production controls/SSR/auth/origin/recovery smoke checks pass without scene mutation or further inference. The private clothing example remains READY and unpublished with its complete subject and linked regions. Native browser checks remain unverified.

## October 30: supports, source detail and Body/Align comparison

The reported desk scene had no reconstructed desk and independent contact gaps; appearance was unapplied because the old transfer service rejected >3 meshes. Existing assets now use shared tabletop contact with actual world-vertex bottoms at zero for laptop/mug/mouse/clock. Source transfer accepted six mesh regions, and original IDs survive restore/reapply with owner/stale-revision guards. Static and actual Chrome WebGL inspection show improved keyboard letters, subtle mouse logo and 10:24 on the clock. The v5 prompt found the four independent products supported by the desk on one live Spark call; it did not resegment/reconstruct that scene.

One Body job plus one Align job completed on the existing person sample. The inspected GLBs have no textures or UVs (738,504 / 738,496 bytes). They remain private diagnostics; no saved textured subject was replaced. No automatic paid retry. The reusable saved-scene regression passed once and restored the fixture/shares. New meaningful cases cover general categories, missing/cyclic support links, shared/explicit tabletop contact and camera rays, actual vertex contact, bounded registration and foreground-gated high-frequency source detail. One old test expectation was adjusted for the deliberately balanced apparel prompt; all other cases passed on the combined run.

PR #13 merged at a6c8b76. The final CI run passes all 72 cases, lint, schema, types and production build; main CI also passes. Production is READY (dpl_9Kd1b2S4w8ZET2BkuamK6QDUpbD2). Bounded read-only release and controls API/SSR smoke checks pass with no scene mutation or inference. Actual Chrome WebGL at 1531×872 shows the desk source detail/contact and deployed Refresh source detail control. At 390×844, canvas and texture tabs/refresh fit with document width=viewport width; reference expand/close passes. These checks do not establish every camera angle or every input class. Native JPEG proof is ignored under test-results/desk/production-desktop.jpg and production-mobile.jpg. Temporary viewport overrides were reset; no Google consent or contest submission was tested.

## October 30: photo background correction

The combined local schema/lint/81-case/build pass succeeded before additional boundary/gradient cases; affected background cases and type checks also pass. The final suite contains 83 cases. Real Spark/Muse background generation completed on the reported desk without replacing its six meshes or changing products/transforms/visibility. Two earlier Spark-only trials exhausted the initial small completion allowance; no image edit was submitted by those trials, and no automatic retry occurred. Corrected calls allow reasoning/output room; blending changes reused the completed image without inference.

The saved-data regression passed once with original fixture metadata restored and its test share revoked. Background-specific HTTP checks passed replay without submission, phase-input/origin/owner rejection, and service stale-revision/preservation guards. Publication rejected a foreign background, exposed the approved same-scene surface anonymously, preserved that frozen background after draft changes, and revoked its temporary share; QA settings were restored. An initial fixture used a surface twice and was correctly rejected; the corrected fixture isolates the background field. No new scene, asset upload or inference was used by these API checks.

Actual local Chrome WebGL shows the projected photo context without side corners/baseboards. Camera orbit and temporary clock hiding/reload were checked; the clock does not remain as a second image in the background. Residual shadows/complex hidden areas remain approximate. PR/production and bounded desktop/mobile checks are pending below; do not equate local checks with deployment.

PR #14 merged at 2a927ed. PR/main CI pass all 83 cases, schema/lint/types and production build. Production is READY at rescene-6vf7ifpr8-jimclydegms-projects.vercel.app (dpl_HP38cA8UB1As2gB3k8huxCqZZsem). Bounded deployed release/controls smoke checks pass without mutation or inference. Chrome shows the actual photo background without side corners and its refresh control at 1531×872; at 390×844 the canvas and controls fit with document width equal to viewport width. Temporary viewport overrides were reset. Native JPEG proof is ignored under test-results/background/production-desktop.jpg and production-mobile.jpg. The saved background preserves all 1,010,330 source pixels outside the removal footprint exactly. Final contest/Google consent remain unverified.

## Plain-background and zoom release — October 30

PR #15 merged at 9e30944. Ninety unit cases, schema validation, lint, types, production build and PR CI pass. Seven new cases distinguish constant fields/minority shadows from gradients/patterns, validate mask union/dimensions/allocation bounds, preserve original masks/white subjects/small bright marks, and exercise conservative enclosed gaps plus opt-out/safe colors.

One same-seed fal comparison recovered four candidate white gaps but did not clearly improve overall hollow geometry; no model swap or further inference. The saved shoe's background was refreshed with zero provider steps. READY production rescene-kjfe3d58b-jimclydegms-projects.vercel.app passes bounded read-only release, controls authorization/origin/validation and shoe workspace checks. Solid white/no plate, original mesh/mask/camera/transforms, default refinement off and anonymous rejection are verified through the deployed API.

Native desktop/mobile interaction and screenshot proof are **not verified for this release**. Browser access was disabled in Work settings during final checks. Local port 3000 belongs to another app; 3001 assets were blocked by existing R2 CORS and the credentials cannot change CORS (403, no configuration change occurred). Keep the user's original shoe tab's unsaved edits intact. Resume only affected visual/Zoom lock checks when browser access becomes available; no new inference is needed.

## Simple surfaces and shadow-layer correction — October 30

PR #16 merged at d1a5077. All 96 cases, Prisma validation, lint/types, production build and PR CI pass. Six new cases cover broad background routing versus bounded/merchant/attached objects, removed support references, single opaque color/shadow material configuration, solid/tile modes and floor/stack contact including support footprint bounds. This does not constitute GPU shader compilation or an observed flicker pass.

The reported vase/stone scene is **b80dc2df-4fc8-4bb1-abef-742f2f10e302**. Its incorrect floor mesh is preserved privately but excluded; three subjects remain, bases are grounded and the stacked pebble has a bounded support contact. Repair reused source/model/Muse assets, with zero inference calls. Pre-repair state is ignored under test-results/surface. All 375,375 source background pixels outside the new removal footprint match exactly.

READY production rescene-bj64pn18v-jimclydegms-projects.vercel.app passes bounded read-only scene/model/mask/contact checks, private floor/background PNG delivery with origin headers, anonymous rejection and the reusable production release smoke. The deployment error-log scan returned zero records. Browser access still reported disabled on repeated checks after the user's “I’ll enable” reply; native desktop/mobile, GPU shader compilation, orbit/Zoom lock and flicker proof remain pending. Do not resubmit model calls to complete visual verification.

## Reference layout reviewer — October 30

PR #17 merged at a4c1cd9. All 103 unit cases, schema validation, lint/types, build and PR CI pass. Seven new cases exercise actual-mask fit improvement, conservative vertical versus diagonal references, invalid/empty frames, unknown-support AABB-top regression, supported containment and disjoint/nested exclusions. A saved QA review/undo and stale-revision check restores original mesh references, relationships, transforms, camera/stage and settings without inference.

The bedroom 43af6e59-525e-4f3e-a401-24116a97f84b was repaired at revision 9 using existing models/masks. The bed and cover now partition 14,376 source triangles into 2,671 frame and 11,705 cover triangles; the sum is conserved. Pillow overlap rose from zero to .67/.69 and nightstand .60→.87. Lamp axis is corrected but its shape remains flagged (.32→.54). These are reference-mask silhouette scores, not full appearance/depth accuracy. Fixed-camera CPU before/after renders show the duplicate floating cover removed. Inputs/outputs are private ignored artifacts under test-results/layout-review. Zero paid inference submissions.

Production rescene-l6p750h9m-jimclydegms-projects.vercel.app is READY and aliased to rescene-eta.vercel.app. Bounded checks verify shared bed/cover baseline, saved report and residual lamp warning, improved pillows, Review & refine placement/Reference check SSR, origin rejection, anonymous privacy and general release smoke. The deployment error-log scan returned zero records. Browser access still reports disabled; native GPU compilation/rendering, live controls/shadows and responsive UI remain unverified. The CPU preview is explicitly not browser evidence.

## Editor UX/history and PNG export — October 30

PR #18 merged at 3f97496. All 116 unit cases, schema/lint/types/build and PR CI pass. Thirteen new cases cover grouped input samples, combined object/light/product timeline, no-op/redo/memory limits, assembly-safe isolation, quaternion round-trip and legacy optional fields, export allocation limits, offscreen renderer state/restoration/failure, PNG row direction and camera focus distance. Capture tests use a mocked renderer; they do not certify actual GPU output or browser downloads.

A saved-data QA check verifies tilt/lean save/reload and preservation by legacy heading-only edits. Original object quaternions/positions/scales/visibility/model references were restored. No inference, asset uploads or publication was used.

Production rescene-q0aev3sx2-jimclydegms-projects.vercel.app is READY and aliased to rescene-eta.vercel.app. Bounded production checks pass tilt/lean workspace DTOs, degree-control/isolate/show-all/undo markup, invalid-angle/origin/anonymous rejection and unchanged scene revision, plus the reusable release smoke. Runtime error scan returned zero records. Native grouped pointer/keyboard gestures, deselection, background/focus controls, PNG colors/transparency/download and desktop/mobile layout remain unverified because browser access reports disabled. Resume only these affected checks when access returns; no new generation is needed.

## Background generation recovery — October 30

PR #19 / merge 02dc76d: saved evidence identified a pre-inference `stage={}` dependency failure after a round object's canonical local-up axis vetoed composition. The fixed pose replay handles all three roots with local-up Y 1.000/-.231/-.158, projected bounds error .1085 and nonnegative support heights. Unit regressions cover arbitrary-axis subjects, no-upright fallback, manual-stage backgrounds with replacements, local preparation failure, provider 400/no retry and successful charged image output followed by local processing failure. All 122 cases, lint/typecheck/build and PR CI pass.

One recorded IMAGE_EDIT verification used the affected scene's saved source/masks, one Muse Image edit and no reconstruction/analysis inference. It succeeded; all object fields including product/replacement references, transforms, visibility and provenance exactly equal the pre-repair backup. The saved derived PNG is 636×866; all 405,791 unmasked pixels equal the source bytes. Manual-stage source/camera metadata is explicit. No publication, reset or source/mask edit was performed. Private backups/replay/plate evidence remain ignored under test-results/background-recovery. Accepted outlines still define foreground removal; unsegmented context can remain.

Native browser inventory still reports disabled in Work settings. The image/service checks do not constitute a WebGL rendering pass.

Production rescene-ad1l0cww6-jimclydegms-projects.vercel.app is READY and aliased to rescene-eta.vercel.app. Merge CI passes; bounded read-only production dashboard/editor/ownership/recovery smoke passes without inference or scene mutation. Production runtime error scan returned zero records.

## Creative showroom release — October 30

130 unit cases, lint/type/schema/build pass. Workflow manifest registers 30 steps / 3 workflows. Additive migration applied. Saved QA tints and Night lighting persisted/reloaded and appeared in a frozen public snapshot; original appearance/settings restored and temporary publication revoked.

One real production COMPOSE_IMAGE workflow used two illustrative product references, completed Muse Image inference, saved a private gallery result and adopted it into a new scene with valid source/normalized photos. Repeated submission returned the same run. Another account received 404 for the private workspace. No reconstruction inference was submitted. The preview auth request returned 403 before inference; authentication protections were retained and production used for verification.

Upload integration caught missing checksum/readyAt metadata on completed staging assets; correction 0c5adf4 supplies complete READY metadata. Native browser access is disabled in Work settings, so no WebGL/mobile appearance claim is made. Evidence and private QA IDs remain under ignored test-results/creative-showroom.

Corrected production rescene-4j1a6tcfi-jimclydegms-projects.vercel.app is READY. Direct private upload/normalization/library and New Scene/Creator/editor control SSR checks pass with no extra inference; final deployment error scan returned zero records.

## Library and creation redesign — October 30

Meta Muse Image generated one 4×3 product contact sheet and one 2×2 environment sheet. Sixteen WebP assets were inspected and committed at public/samples/v1; model/prompt metadata is stored beside them. These are synthetic photographic samples, not licensed branded inventory. Twelve sample rows are linked to versioned paths; private source media stays in R2.

Migrations add six relational tables, owner/sample visibility checks, ordered-reference uniqueness/indexes and restrictive lineage FKs. Legacy references, generated results, generation inputs and latest drafts are backfilled. New draft save/reload, stale-save rejection and repeated reservation checks pass. One real sample-based image request produced a linked ContentItem and ContentGeneration output; acceptance created ContentAdoption. Changing/reordering the draft afterwards left the earlier generation's prompt and ordered references unchanged. No reconstruction inference was submitted. Evidence is ignored under test-results/library-refresh.

130 unit cases, lint/types/build pass. Native browser inventory reports disabled in Work settings; no desktop/mobile visual pass is claimed for the redesign.

PR #21 merged at ed1d70c; production rescene-klx2xq0pt-jimclydegms-projects.vercel.app READY. Production HTTP checks verify all twelve photographic assets, New Scene/Creator controls, project title/prompt/template/aspect/ordered-reference persistence and stale-draft rejection without inference. Final deployment error scan returned zero records. All 16 product/scene images are traced into server functions for sample-based generation.

## Trash and simple samples — October 30

136 cases and lint/type/build pass. Saved-data integration verifies owner-scoped image delete/Trash/restore, cross-owner denial, preserved generation reference counts, project Delete/Restore, 22 active sample choices and absence of retired plant/paired-shoe samples. A shared advisory lock serializes deletion with generation reservations; active GenerationReference rows block image deletion. No generation or asset bytes are deleted. Project deletion retains archive/restore behavior and share revocation.

Two Meta image requests generated twelve additional minimal product photographs and eight empty environment previews. Contact sheets were visually inspected: new products are single items with simple silhouettes; settings contain no products, props, plants or furniture. Files and prompts are versioned under public/samples/v2; v1 media and past generation records remain. New generation/draft templateVersion=2 identifies the changed setting instructions. No reconstruction inference was submitted.

Browser inventory again reports disabled in Work settings. API/component markup checks are not native interaction or GPU verification. Private evidence is ignored under test-results/library-delete.

PR #22 merged at 1b69385; production rescene-bv2dag33g-jimclydegms-projects.vercel.app is READY and aliased to rescene-eta.vercel.app. Production checks verify rejection without confirmation, private generated-image delete/Trash/restore, project Delete/Restore, 22 active samples, all eight setting assets and creator controls. QA image and project were restored; no inference ran during API verification. Merge CI passes.

The bounded final production error-log scan returned zero records.

## Composition quality and selective recovery — October 30

The reported scene a36ab9a2-c88b-4437-a8f5-9b8934ef098a was backed up privately before edits. Source-image evidence shows furniture miniaturized onto a countertop and a duplicated loose lid already present in the generated photo. Saved analysis boxes were shifted vertically. Spatial mask matching recovered the unaccepted white box and selected the loose lid rather than the attached jar lid, without new segmentation. Contact-constrained review closes jar/table gap to zero, using actual support triangles. A shared broad tabletop ground also remains at floorY.

One three-object seed-43 fal request tested the chair, missing box and lid. Box accepted at .83455 mask IoU; chair (.8846 versus .8899) and lid (.0758 versus .0943) were rejected as non-improvements, retaining previous meshes. Table/jar object fields, stage and saved background exactly matched pre-retry state. A later explicit no-inference placement review seats the broad-surface peers. Residual lid shape mismatch remains flagged. No claim of full shape/hidden-geometry fidelity is made.

One Muse composition used four simple products and the actual sunlit-room reference at high reasoning. Visual image inspection shows one complete chair/table/jar/box, plausible relative scale, margins and no extra detached lid. The first Spark review exhausted the small output allowance; output survived as PARTIAL. The reviewer allowance was raised to 4096, and one explicit saved-image check succeeded with all four counts=1 and no crop/scale/support/background flags; structured review and attempt history were saved. No second image generation or automatic inference resubmission was used. No extra reconstruction/background sweep ran.

150 unit cases cover mask proximity/ambiguity, source/correction inventories, review-derived warnings, confirmed paid retry, ownership/stale/active/shared-subject guards, contact constraints and unchanged evaluate-only baselines. Browser inventory still reports disabled in Work settings. CPU-render/private image inspection is not native WebGL or desktop/mobile interaction verification. Evidence is ignored under test-results/composition-quality.
