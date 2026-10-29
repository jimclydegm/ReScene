# ReScene

Turn one product scene photo into an editable, shoppable 3D scene.

ReScene is Jim's prototype for Meta's Global AI Developer Hackathon. The first demo focuses on furniture and home decor: upload a room photo, identify a few objects, reconstruct them, attach product information, edit the layout, and share an interactive viewer.

**Build freeze: November 2, 2026, Asia/Manila.** Planning and source research were completed October 29. The app has not been scaffolded or deployed yet.

## Project context

Read [the short handoff](docs/CONTEXT.md) first. Open other files only for the task at hand.

| File | Use it for |
| --- | --- |
| [Plan](docs/PLAN.md) | Product scope, demo, priorities, decisions, and definition of done |
| [Meta model research](docs/META_MODELS.md) | Verified capabilities, API integration, reconstruction risks, and source links |
| [Architecture](docs/ARCHITECTURE.md) | Frontend, backend, generation pipeline, storage, API routes, and deployment |
| [Data model](docs/DATA_MODEL.md) | Entity relationships, ownership, invariants, JSON contracts, and migrations |
| [Prisma schema](prisma/schema.prisma) | Concrete application database schema, awaiting infrastructure and migrations |
| [SQL constraints](prisma/constraints.sql) | Active-job uniqueness and data checks to append to the initial migration |
| [Scene manifest schema](contracts/scene-manifest.schema.json) | Versioned viewer/publication data contract |
| [Example manifest](contracts/examples/scene-manifest.json) | Synthetic contract example; not a generated scene |
| [Roadmap](docs/ROADMAP.md) | Ordered implementation phases, dates, acceptance checks, and cut lines |
| [Environment template](.env.example) | Configuration names; contains no credentials |

## Proposed stack

Next.js / TypeScript on Vercel; React Three Fiber / Three.js for the viewer; Neon Postgres with Prisma; Neon Auth (Managed Better Auth); Cloudflare R2 for media; Meta Model API for Muse Spark and SAM 3.1; hosted Meta SAM 3D Objects for reconstruction. GitHub holds code, CI, and planning context.

The hosted 3D provider is a proposed addition because SAM 3D needs GPU inference. Phase 0 must verify its outputs before we commit the implementation to it.
