# ReScene: short project context

Updated October 29, 2026. Timezone: Asia/Manila. Read this first, then only task-relevant docs.

## Goal

Jim is building ReScene for Meta's Global AI Developer Hackathon: one private room photo → an editable 3D room with separate furniture → seller product information/replacement → a shoppable shared viewer. Freeze November 2. Jim clarified that matching relative size, orientation, depth, camera, and room appearance is core; floating equally sized meshes on an empty stage are insufficient. One image cannot establish exact dimensions or faithful hidden surfaces.

## Stack and constraints

- Next.js 16.4.3/React 19.3.1/TypeScript on Vercel, Node22/iad1; R3F/Three/Drei, plain CSS.
- Neon Postgres + Prisma7.10.1 + Neon adapter; Neon Managed Better Auth owns its auth tables. Eight app models, initial migration applied.
- Private Cloudflare R2 (`prototype` prefix), immutable normalized photos/masks/GLBs, owner-issued short-lived access. Public development URL disabled. Jim explicitly wants **automatic staging deletion disabled**.
- Muse Spark `muse-spark-1.3` and SAM `sam-3.1` directly on Meta Model API; Meta SAM 3D Objects hosted by fal (`fal-ai/sam-3/3d-objects`). WorldGen has no verified developer API. No replacement model provider without Jim's instruction.
- Vercel Workflow5.2.3 handles durable jobs. Provider submissions have no automatic retries; poll/resume a saved provider ID. Unknown submissions stop. Revision checks, ownership/origin checks, one-active-user guard, and serialized global budget reservations apply.
- Secrets live in ignored `.env.local` and Vercel. Never print/commit them or private artifacts. Local/preview/production share prototype Neon/Auth/R2; Git branches do not isolate data. Jim wants Vercel MCP OAuth **kept pending**; authenticated CLI works.

## Implemented

- Production: https://rescene-eta.vercel.app. Foundation PR1 merged `66771fa`; runtime/editor PR2 merged `8f56977`. Scene-composition PR3 merged into `main` at `81bf9ac`; production is deployed. Live Spark/SAM → reviewed masks → three real independent GLBs → move/yaw/uniform scale/hide/undo/save/reload pass local and deployed API tests. Sample landing geometry is illustrated, not inferred.
- Meta receives bounded inline normalized WebP bytes after a production signed-URL fetch rejection. fal receives one-hour private URLs. Source/mask/model/raw artifacts remain private.
- Scene-composition correction: imported SAM poses convert Meta WXYZ row-vector/Z-up coordinates into Three.js XYZW/Y-up. One scene scale preserves relative size/depth. Common floor/camera fit plus estimated room planes/colors/light replace the neutral stage for supported poses. Full baseline rotation/scale/offset is stored in `initialTransform`; draft position/yaw/scale operate outside it. **Publication must flatten both**, not export only draft multipliers.
- `Scene.stage` stores `sam3d-room-v1`, `Scene.camera` the photo viewpoint, and settings room observations/one previous layout backup. No migration. Owner-only POST composition with MATCH_PHOTO/RESTORE uses existing assets, revision checks, no new inference. Existing scenes upgrade only when clicked.
- Scene Studio has a reference thumbnail and expandable native dialog. Photo view/grid controls accompany composed rooms. New Spark prompt/schema describes floor/wall colors/material and broad lighting; revised live response remains untested. Existing scenes explicitly use sampled colors/plain floor/diffuse neutral light.

## Verification and next action

22 focused tests, lint/typecheck/build pass. Local composition integration checks pass: common sizes/poses/camera, save preserving baseline, exact backup restore, stale revision/origin/second-account rejection, and server-rendered reference controls. Saved three-object box reprojection RMSE ~1.4% of frame; this is geometric consistency, not scan accuracy. Both local and deployed composition integration passed. PR3 CI/preview checks and main CI passed; Vercel production serves the merged correction. Checkout is on `main`. See TESTING.md for evidence.

Browser automation still reports disabled in Work settings despite Jim's earlier intent to enable it. Actual editor visuals/mobile interaction are unverified. Detailed floor textures, windows, wall geometry, lighting recovery, and real-photo quality remain incomplete. Product cards, catalog replacement, immutable publication, and anonymous viewer are next implementation phases. Follow NEXT_STEPS.md.

## Spending and open dependencies

Jim approved **US$10 total development inference**. App reservation pool $7.50; shared DB runs currently reserve $7.28. CLI/diagnostic reserve adds $2.4075. Composition work makes no new inference calls. Do not raise allowance or blindly retry; a new full generation needs approved allowance or explicit usage reconciliation. These are conservative reservations, not invoices.

Actual Google consent is unverified (Neon development provider configured). Verify participant track/model requirements, video/submission fields, and deadline in the private event portal; the public deadline is November4 9PM ET, while November2 remains Jim's freeze.

## Task documents

PLAN.md: product scope; META_MODELS.md: model/pose evidence; ARCHITECTURE.md: services/pipeline; DATA_MODEL.md + Prisma: storage/coordinates; ROADMAP.md: phases; TESTING.md: runnable checks; SETUP.md: provisioned resources.
