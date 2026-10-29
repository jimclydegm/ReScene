# ReScene: short project context

Updated October 29, 2026. Timezone: Asia/Manila. Read this first, then only task-relevant docs.

## Goal

Jim is building ReScene for Meta's Global AI Developer Hackathon: one private room photo → an editable 3D room with separate furniture → seller product information/replacement → a shoppable shared viewer. Freeze November 2. Jim clarified that matching relative size, orientation, depth, camera, and room appearance is core; floating equally sized meshes on an empty stage are insufficient. One image cannot establish exact dimensions or faithful hidden surfaces.

## Stack and constraints

- Next.js 16.4.3/React 19.3.1/TypeScript on Vercel, Node22/iad1; R3F/Three/Drei, plain CSS.
- Neon Postgres + Prisma7.10.1 + Neon adapter; Neon Managed Better Auth owns its auth tables. Eight app models, initial migration applied.
- Private Cloudflare R2 (`prototype` prefix), immutable normalized photos/masks/GLBs, owner-issued short-lived access. Public development URL disabled. Jim explicitly wants **automatic staging deletion disabled**.
- Muse Spark `muse-spark-1.3` and SAM `sam-3.1` directly on Meta Model API; Meta SAM 3D Objects hosted by fal (`fal-ai/sam-3/3d-objects`). WorldGen has no verified developer API. No replacement model provider without Jim's instruction.
- Vercel Workflow5.2.3 handles durable jobs. Provider submissions have no automatic retries; poll/resume a saved provider ID. Unknown submissions stop. Revision checks, ownership/origin checks, one-active-user guard, and serialized generation starts/restarts apply.
- Secrets live in ignored `.env.local` and Vercel. Never print/commit them or private artifacts. Local/preview/production share prototype Neon/Auth/R2; Git branches do not isolate data. Jim wants Vercel MCP OAuth **kept pending**; authenticated CLI works.

## Implemented

- Production: https://rescene-eta.vercel.app. Foundation PR1 merged `66771fa`; runtime/editor PR2 merged `8f56977`. Scene-composition PR3 merged into `main` at `81bf9ac`; production is deployed. Live Spark/SAM → reviewed masks → three real independent GLBs → move/yaw/uniform scale/hide/undo/save/reload pass local and deployed API tests. Sample landing geometry is illustrated, not inferred.
- Meta receives bounded inline normalized WebP bytes after a production signed-URL fetch rejection. fal receives one-hour private URLs. Source/mask/model/raw artifacts remain private.
- Scene-composition correction: imported SAM poses convert Meta WXYZ row-vector/Z-up coordinates into Three.js XYZW/Y-up. One scene scale preserves relative size/depth. Common floor/camera fit plus estimated room planes/colors/light replace the neutral stage for supported poses. Full baseline rotation/scale/offset is stored in `initialTransform`; draft position/yaw/scale operate outside it. **Publication must flatten both**, not export only draft multipliers.
- `Scene.stage` stores `sam3d-room-v1`, `Scene.camera` the photo viewpoint, and settings room observations/one previous layout backup. No migration. Owner-only POST composition with MATCH_PHOTO/RESTORE uses existing assets, revision checks, no new inference. Existing scenes upgrade only when clicked.
- Scene Studio has a reference thumbnail and expandable native dialog. Photo view/grid controls accompany composed rooms. New Spark prompt/schema describes floor/wall colors/material and broad lighting; the revised live response now passes on production (wood floor, warm left light, left wall). Existing scenes explicitly use sampled colors/plain floor/diffuse neutral light.

- Restart-step correction merged as PR #4 (`5189d05`), followed by status-refresh fix `35db989`: Change photo clears photo/all later results; Analyze again keeps photo and clears analysis/masks/3D/edits; Rebuild 3D keeps photo/masks and clears 3D/edits. Native confirmation explains loss and new inference charges. POST restart checks explicit confirmation, ownership/origin, revision and active generation. Old failed runs cannot resume after reset; historical costs/raw responses remain private. Invalidated assets stop being signed; bucket lifecycle remains unchanged.

## Verification and next action

23 focused tests, lint/typecheck/build pass. Local composition integration checks pass: common sizes/poses/camera, save preserving baseline, exact backup restore, stale revision/origin/second-account rejection, and server-rendered reference controls. Saved three-object box reprojection RMSE ~1.4% of frame; this is geometric consistency, not scan accuracy. Both local and deployed composition and restart integration checks pass. PR4 CI/preview and main CI passed; production is deployed. The fresh production Spark room/mask run passed (bed/nightstand masks; chair NO_MATCH); two meshes reached READY, return-to-review cleared the models while preserving the masks, and a second reconstruction reached READY. Fresh signed GLB downloads/CORS and save/reload/revision/origin/ownership checks passed. Checkout is on `main`. See TESTING.md.

Browser access is now working. Desktop confirmation/cancel, 390px confirmation/reference dialogs, and the saved three-object composition/selection/hide/reload are visually checked. SAM GLBs omitted metallicFactor (glTF defaults to metal); the preview now uses dielectric materials only when that field/map is unspecified. Explicit metal settings are preserved. Mobile verification found a canvas intrinsic-width overflow; CSS now uses a minmax(0,1fr) track and shrinkable viewport/inspector. Detailed floor textures, windows, wall geometry, lighting recovery, and real-photo quality remain incomplete. Product cards, catalog replacement, immutable publication, and anonymous viewer are next implementation phases. Follow NEXT_STEPS.md.

## Photo textures and lighting (current work)

Jim selected scene `1cc4e890-1ca8-4435-ac00-722dccefb995` (chair/cabinet/vase). Phase 3.6 now implements CPU UV baking of source pixels onto visible, depth/mask/front-face-checked surfaces. Existing SAM appearance remains elsewhere; new embedded PNG GLBs preserve geometry/transforms and original assets. Clean top/bottom photo patches provide repeated wall/floor textures (estimated extension, not a recovered room scan). AssetKind.SURFACE_TEXTURE migration `20261029110000_surface_texture` applied to shared Neon.

POST appearance APPLY/RESTORE/LIGHTING is owner/origin/revision/READY-guarded. Settings.appearance retains original/baked model IDs and room texture IDs; explicit restore switches back. Main/fill lights have XYZ/intensity controls, plus ambient intensity, live preview and saved settings. Object edits can save lighting atomically to avoid losing draft changes. Restarts clear downstream surface textures/settings. Snapshots must allowlist only baked assets, never the full private source photo.

Offline bake on the requested scene copied 245,668 chair, 174,617 cabinet and 94,877 vase texels. A separate QA clone passes persistence, geometry preservation, lighting save, stale/non-owner rejection and exact texture restore. 28 focused tests and production build pass. PR #5 merged at 4db7874; PR CI/preview pass. Browser confirms grain/fabric and main intensity/X edits/save; HTTP bounds/stale/origin/ownership checks pass. Requested scene has copied textures and soft lighting applied, with original meshes retained. Production is deployed and visually verified. Production appearance saves, stale/origin/ownership rejection, and private floor/wall signed-download CORS checks pass; no new inference submitted. TEXTURE_FIDELITY.md contains initial design and current implementation notes.

## Spending and open dependencies

Jim explicitly requested **removing the cumulative app cap and continuing live testing** on October 29 after reporting $149.91 remaining Meta credits. This supersedes the earlier $10 development cap. `GENERATION_BUDGET_USD` and its guard are removed locally/Vercel; usage estimates/history stay recorded, provider balances/limits still apply, and fal is billed separately. Keep idempotency, one-active-user limits, and no automatic paid retries. Do not run unrelated bulk inference. The private billing URL was not accessible through public retrieval; the balance is Jim's reported value.

Actual Google consent is unverified (Neon development provider configured). Verify participant track/model requirements, video/submission fields, and deadline in the private event portal; the public deadline is November4 9PM ET, while November2 remains Jim's freeze.

## Task documents

TEXTURE_FIDELITY.md: latest appearance research; PLAN.md: product scope; META_MODELS.md: model/pose evidence; ARCHITECTURE.md: services/pipeline; DATA_MODEL.md + Prisma: storage/coordinates; ROADMAP.md: phases; TESTING.md: runnable checks; SETUP.md: provisioned resources.

## Dashboard / inspector design (latest work)

Compact owner-only source-photo preview cards replace dashboard placeholders, with object counts, saved workflow stages, active run progress, updated dates and six-project server pagination. Invalid/repeated pages clamp safely; ordering is updatedAt/id. Inspector now has Objects / Textures / Lighting tabs, horizontal overflow/keyboard navigation, a vertically scrolling body and fixed Save changes footer. Draft object/light edits remain in SceneStudio across tabs. Range fields, object visibility switches and mask-review checkboxes share styled controls. Reload is disabled while drafts are unsaved.

PR #6 merged into main at aa0aed1 and production is READY. All 34 tests, lint/typecheck/build and PR CI pass. Local and production HTTP checks pass for 16 projects/three pages, unique owner cards, signed previews, invalid pages, anonymous redirect, other-account isolation and studio control markup. No model calls/schema changes. Browser access is currently disabled in Work settings, so desktop/mobile visual interaction QA is pending. Next: verify the layout in a browser once enabled, then resume product cards/publication work.
