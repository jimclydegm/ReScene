# ReScene — current handoff

Updated October 29, 2026 (Asia/Manila). Read this, then only task-relevant technical files. Historical milestones are in docs/history; they are not the active work queue.

## Objective and working style

Finish a usable furniture/home-decor hackathon app quickly. Jim confirmed **Indie developer** track and a November 2 build freeze. He explicitly requested **bulk implementation**, fewer repeated tests/deployments, and no stopping for “next phase” after every subfeature. Follow the single release bundle in ROADMAP.md and consolidated PLAN.md. One branch/PR, one combined verification pass, one production release; repeat only checks affected by a failure/change.

## Stack and access

- Next.js 16.4.3 / React 19.3.1 / TypeScript, R3F/Three/Drei, plain CSS; Vercel Node22/iad1. Read installed Next docs before code changes.
- Neon Postgres / Prisma7.10.1; Neon Managed Better Auth owns neon_auth. Runtime uses pooled Neon adapter. Local/preview/production share prototype data/storage; Git branches do not isolate it.
- Private Cloudflare R2, immutable assets, owner/snapshot-scoped signed GETs. Public bucket URL disabled. Jim explicitly keeps **automatic staging deletion/cleanup disabled**.
- Secrets stay in ignored .env.local and Vercel. Never print/commit credentials, source photos, signed links, provider IDs or raw artifacts. Vercel MCP OAuth stays pending; authenticated CLI works. Use current pinned CLI (65.7.0), not the outdated global CLI.

## Implemented core

- Private upload/normalization, Meta analysis, reviewed masks (up to three), independent GLBs, durable generation, save/reload/restart/error recovery.
- Meta runtime: muse-spark-1.3 + sam-3.1 directly via Meta Model API; Meta SAM 3D Objects through fal-ai/sam-3/3d-objects. Do not substitute another model provider. WorldGen has no verified developer API; SAM segmentation and SAM 3D reconstruction are distinct.
- Composed room/camera preserves approximate SAM size/pose/depth. initialTransform holds imported quaternion/scale/offset; draft XYZ/yaw/uniform scale is outside it. Photo-bake-v1 copies visible, depth/mask-gated source pixels into new embedded GLB textures; originals remain restorable. Clean repeated photo patches supply floor/wall. Hidden geometry/materials and room extensions are approximate, not a scan.
- Editor: Objects/Textures/Lighting/Products tabs, numeric controls, undo/redo, expandable private reference, main/fill XYZ/intensity and ambient controls, merchant name/brand/description/price/link and private mask-cutout thumbnails.
- Original CC0 demo catalog: chair/cabinet/table, explicitly illustrative, no fabricated price/link. Same-scene replacements atomically clone the card and fit a bottom-center baseline. replacementBackup restores original mesh/card/baseline while retaining current placement. Photo matching/textures require original geometry; lighting stays editable.
- Publication v2: confirmed unlisted frozen snapshot, private immutable JSON/hash and exact render-only allowlist. Flatten draft × imported transforms; public renderer must not normalize twice. Anonymous /s/[slug] + /api/shared/[slug] never join live draft products or expose full photos/masks/raw/provenance. Up to ten active revocable links. Revoke/archive/restart stop new access; signed links can last 15 minutes and downloads cannot be recalled.

## Current release bundle

Project name/description editing, searchable/status-filtered dashboard and active share indicators; reversible archive/restore that retains assets and revokes old shares; publish shortcut, discard/reload conflict recovery, unsaved navigation/sign-out protection and viewer retry reset. Archive/metadata mutations serialize with generation starts. No migration or inference is needed.

Delivery: CI checks PR changes once (no duplicate feature-push job), cancels superseded runs, and uses npm run check. Docs-only CI skips reinstall/build. Vercel ignoreCommand compares against the prior successful deployment and skips docs/test/tooling-only deployments; .vercelignore must retain .git in the build workspace for this comparison; app/config/schema changes and unknown comparisons always build. scripts/verify-release.mjs is the single reusable saved-data regression; --smoke is bounded/read-only for post-deploy. Historical smoke runners remain available only for a specific regression, not a default sweep.

## Evidence and fixtures

PRs #1–#9 implement the core. PR #9 (be841d8) and production passed 47 tests plus publication/access/isolation checks. A fresh deployed upload → Meta analysis → two real meshes → merchant edit → replacement → publish → anonymous cards/GLBs/CORS → revoke passed. Analysis took 19.824s and reconstruction/ingestion 82.298s server-run time, excluding user review. Actual total charges are unknown; reserved amounts are estimates. See TESTING.md, not repeated inference, for evidence.

- Jim's selected source example: 1cc4e890-1ca8-4435-ac00-722dccefb995.
- **Reuse disposable saved-data QA:** 6800b8a2-7c39-4a52-8fde-790eb03ab46c. Preserve/restore its metadata; revoke temporary test shares.
- **Do not mutate** the earlier appearance example f2848b95-8447-41eb-9544-0d72dd605565: Jim has saved a real test listing there.
- Fresh release run: 20d22f55-9857-49eb-96f1-435826585347; private saved backup, test shares revoked. Checkpoints/reports remain ignored under test-results.

Jim removed the cumulative generation cap; do not reintroduce GENERATION_BUDGET_USD. Still avoid paid inference in routine development: reuse saved assets unless a specific generation bug requires a new call. Keep idempotency, provider job IDs, one active user job and **zero automatic paid retries**. Meta and fal bills are separate.

PR #10 merged at 648010b and production is READY. All 52 tests and the single PR CI run pass. The one saved-data regression passes, restores original metadata and revokes its temporary share; bounded read-only production smoke passes. No fresh inference, QA scenes or photo/model uploads. App functionality in this release bundle is complete; remaining access/human gates are below.

## Remaining access/human gates

Browser access is still disabled in Work settings. Do not claim desktop/mobile visual interaction, clipboard/dialogs, frame rate or final recording verified. Actual Google consent is unverified. Indie demo/submission draft is in release/DEMO.md; private portal fields/video limit and final contest submission remain pending. Continue app work independently and report these concrete limits without restarting micro-phases.

Technical references: ARCHITECTURE.md, DATA_MODEL.md + prisma/schema.prisma, META_MODELS.md, TEXTURE_FIDELITY.md, CATALOG.md, TESTING.md, SETUP.md. Runtime publication contract: contracts/scene-manifest-v2.schema.json; v1 is historical proposed architecture.
