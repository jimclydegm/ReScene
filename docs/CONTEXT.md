# ReScene: short project context

Updated: October 29, 2026. Timezone: Asia/Manila.

## Goal and scope

Jim is building ReScene for Meta's Global AI Developer Hackathon. A seller uploads one room photo; ReScene extracts a few objects into an editable 3D scene, attaches product details, and publishes a shoppable viewer. Freeze the working prototype on **November 2, 2026**. Fashion, streets, virtual try-on, checkout, and exact reconstruction are later work.

## Decisions

- App: Next.js App Router + TypeScript on Vercel; React Three Fiber/Three.js, Drei, Zustand, Tailwind/shadcn.
- Data: Neon Postgres + Prisma 7 + Neon driver adapter. Neon Auth is Managed Better Auth; Prisma manages only our application tables.
- Storage: private Cloudflare R2. Browser uploads use signed staging URLs; server validates and makes immutable normalized inputs. Publications get a narrow allowlist of signed asset reads.
- AI: `muse-spark-1.3` for scene descriptions/labels; `sam-3.1` on Meta Model API for masks. Meta SAM 3D Objects through fal's queued API is the proposed mesh provider, subject to a live spike. Meta keys stay on the server.
- WorldGen is research-only in the official source checked October 29; Muse Wonder is a reasoning/coding model, not a world generator.
- 3–5 furniture/decor objects per scene. Real meshes are the target; cutouts/proxies are labeled fallbacks. A simple stage replaces photo-textured background geometry.
- Product identity, SKU, price, and purchase URLs come from the seller. AI geometry approximates hidden surfaces.
- Vercel Workflow handles durable jobs. The database stores job progress; the UI polls it.
- Eight app models: AppUser, Scene, Asset, Product, SceneObject, GenerationRun, GenerationStep, ScenePublication.

## Current state

- Repo initially contained only README and .gitignore; no app or schema.
- Research, architecture, roadmap, Prisma schema, JSON manifest contract, and environment template are saved.
- No cloud resources provisioned, credentials requested, migrations applied, app scaffolded, or deployment created.
- Documentation/schema validation results are recorded in `docs/ROADMAP.md`.
- Prisma 7.10.1 validation and the JSON contract example passed. SQL migration/constraint execution still needs Phase 1; local DDL generation returned no SQL.

## Next action

Execute Phase 0 in `docs/ROADMAP.md`: verify participant rules/access, run a real Spark + SAM segmentation + SAM 3D multi-object test, and check object-to-mesh mapping and transforms in the browser. Resolve the largest risk before UI implementation.

## Open dependencies

The details page redirects to Cerebral Valley sign-in; participant rules were not accessible in this session. Verify track, judging criteria, required number of models, submission format, and participant deadline. The public page says November 4 at 9 PM ET; November 2 remains our build freeze.

Required configuration: Meta Model API access, hosted SAM 3D credential/credits (proposed fal), Neon project/Auth, Cloudflare R2 bucket/token, and Vercel/GitHub linkage. No account or resource is assumed to exist.

## Read only what you need

- Product/demo: `PLAN.md`
- Model capabilities/evidence: `META_MODELS.md`
- Routes, pipeline, storage, UI modules: `ARCHITECTURE.md`
- Tables/validation: `DATA_MODEL.md`, `../prisma/schema.prisma`, `../contracts/scene-manifest.schema.json`
- Work order/checks: `ROADMAP.md`
