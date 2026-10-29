# ReScene: short project context

Updated: October 29, 2026. Timezone: Asia/Manila.

## Goal and scope

Jim is building ReScene for Meta's Global AI Developer Hackathon. A seller uploads one room photo; ReScene extracts a few objects into an editable 3D scene, attaches product details, and publishes a shoppable viewer. Freeze the working prototype on **November 2, 2026**. Fashion, streets, virtual try-on, checkout, and exact reconstruction are later work.

## Decisions

- App: Next.js 16.4.3 + React 19.3.1 + TypeScript on Vercel, Node 22/iad1. React Three Fiber/Three.js/Drei power the sample; plain CSS styles the foundation. Zustand/Tailwind/shadcn remain optional for the editor.
- Data: Neon Postgres + Prisma 7 + Neon driver adapter. Neon Auth is Managed Better Auth; Prisma manages only our application tables.
- Storage: private Cloudflare R2 with `prototype` prefix. Signed uploads, validation, immutable source/normalized writes, and browser CORS work. Public development URL is disabled; no custom domain. Jim chose **no automatic staging deletion**. Publications remain planned.
- AI: `muse-spark-1.3` for scene descriptions/labels; `sam-3.1` on Meta Model API for masks. Meta SAM 3D Objects through fal's queued API is the proposed mesh provider, subject to a live spike. Meta keys stay on the server.
- WorldGen is research-only in the official source checked October 29; Muse Wonder is a reasoning/coding model, not a world generator.
- 3–5 furniture/decor objects per scene. Real meshes are the target; cutouts/proxies are labeled fallbacks. A simple stage replaces photo-textured background geometry.
- Product identity, SKU, price, and purchase URLs come from the seller. AI geometry approximates hidden surfaces.
- Vercel Workflow handles durable jobs. The database stores job progress; the UI polls it.
- Eight app models: AppUser, Scene, Asset, Product, SceneObject, GenerationRun, GenerationStep, ScenePublication.

## Current state

- Live foundation: https://rescene-eta.vercel.app; existing Vercel project and Neon `rescene-db` reused. PR #1 merged October 29 at commit `66771fa`. Runtime/editor PR #2 merged October 29 at `8f56977`; checkout is on `main`.
- Landing/sample viewer, managed auth, private scene dashboard, ownership, revision-aware API, and upload code are implemented. Sample geometry is illustrated, not reconstructed.
- Migration `20261029040000_init` applied all 8 app tables/constraints; managed auth tables untouched. Prisma 7.10.1.
- Secrets are in ignored `.env.local` and Vercel production/preview secrets. Do not print them. Generation is enabled for the bounded prototype test.
- Build/lint/typecheck/6 tests, GitHub CI, and local/deployed 9-check account/ownership smoke pass. Nine deployed storage checks and real browser upload/refresh pass using synthetic images. Browser sign-in/dashboard and 390px upload layout checked. Merged foundation: https://github.com/jimclydegm/ReScene/pull/1.
- Updated R2 Object Read & Write credentials are stored locally and in Vercel production/preview; production was redeployed. Bucket settings were applied through Cloudflare's dashboard because runtime credentials intentionally cannot administer settings. The setup script only configures CORS; it must not enable automatic deletion.
- Meta model discovery, Neon DB/Auth/JWKS, R2 write/read/delete, and fal missing-job queue response work. Live Spark/SAM and hosted SAM 3D calls have now succeeded.
- Jim approved **US$10 total development inference** on October 29, replacing the earlier code-only instruction. The CLI produced two independent GLBs; the local app workflow produced three real bedroom object meshes and passed API save/reload, revision, origin, and ownership checks. Fresh production validation also passed: three real meshes, signed downloads/CORS, saved edits, stale/origin/ownership rejection.
- Vercel CLI configured/authenticated; existing plugin guidance available. Jim explicitly requested keeping MCP OAuth pending.
- See `SETUP.md` for commands, resource setup, tested limits, and remaining dependencies. Prototype local/production currently share the supplied Neon branch/Auth and storage namespace.

## Next action

Follow [TESTING.md](TESTING.md) for the working deployed flow. Browser controls/appearance still need visual QA because computer access is disabled. The app now has Find objects → review masks → Build in 3D → move/rotate/scale/hide/undo/save/reload. Vercel Workflow 5.2.3 persists jobs; paid submissions have no automatic retries. Local/preview/production share prototype DB/Auth/R2. Browser automation is disabled in Work settings; Jim said he will enable it but it still reports disabled. Product cards, replacement, and sharing remain unimplemented.

The app has a cumulative **$7.50 reservation pool**, separate from the CLI’s $2.405 reserve plus a $0.0025 inline-SAM diagnostic, keeping conservative allowances below the $10 cap. The first production SAM request received HTTP 400 media-fetch rejection; its run retains $0.02 after manual usage reconciliation. Meta calls now inline bounded normalized bytes to avoid remote fetching. Never blindly repeat an uncertain submission.

## Open dependencies

The details page redirects to Cerebral Valley sign-in; participant rules were not accessible in this session. Verify track, judging criteria, required number of models, submission format, and participant deadline. The public page says November 4 at 9 PM ET; November 2 remains our build freeze.

Keys/account configuration and R2 access now work. Google uses Neon's shared development provider; actual Google account consent is not verified. Local/preview/production still share prototype data/Auth/storage. Stale/rejected staging objects need deliberate manual cleanup; do not add automatic expiry without Jim changing his preference.

## Read only what you need

- Product/demo: `PLAN.md`
- Model capabilities/evidence: `META_MODELS.md`
- Routes, pipeline, storage, UI modules: `ARCHITECTURE.md`
- Tables/validation: `DATA_MODEL.md`, `../prisma/schema.prisma`, `../contracts/scene-manifest.schema.json`
- Work order/checks: `ROADMAP.md`
- Immediate experiment and next implementation slices: `NEXT_STEPS.md`
