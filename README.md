# ReScene

Turn one product scene photo into an editable, shoppable 3D scene.

ReScene is Jim's prototype for Meta's Global AI Developer Hackathon. The first demo focuses on furniture and home decor: upload a room photo, identify a few objects, reconstruct them, attach product information, edit the layout, and share an interactive viewer.

**Build freeze: November 2, 2026, Asia/Manila.** The Next.js foundation is implemented and deployed at [rescene-eta.vercel.app](https://rescene-eta.vercel.app).

## Working foundation

- Landing page with a selectable, movable 3D sample room (illustrated geometry, not AI reconstruction).
- Neon Managed Better Auth sign-up/sign-in/sign-out and Google sign-in integration.
- Private scene dashboard, persistence, ownership checks, and revision-aware updates.
- Working private R2 photo uploads, image validation/normalization, and immutable source/preview storage.
- Eight-model Prisma schema/migration, server-only Meta/fal adapters, and GitHub CI.

Photo upload and reload persistence are verified on the live app. Object reconstruction, product editing, and publishing are the next phases. See [setup and verified limitations](docs/SETUP.md).

## Development

```sh
npm ci
# Configure .env.local using .env.example; keep it out of Git.
npm run dev
```

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` for local checks. Database and provider verification instructions are in [SETUP.md](docs/SETUP.md).

## Project context

Read [the short handoff](docs/CONTEXT.md) first. Open other files only for the task at hand.

| File | Use it for |
| --- | --- |
| [Plan](docs/PLAN.md) | Product scope, demo, priorities, decisions, and definition of done |
| [Meta model research](docs/META_MODELS.md) | Verified capabilities, API integration, reconstruction risks, and source links |
| [Architecture](docs/ARCHITECTURE.md) | Frontend, backend, generation pipeline, storage, API routes, and deployment |
| [Data model](docs/DATA_MODEL.md) | Entity relationships, ownership, invariants, JSON contracts, and migrations |
| [Prisma schema](prisma/schema.prisma) | Applied eight-model application database schema |
| [SQL constraints](prisma/constraints.sql) | Reference for constraints included in the initial migration |
| [Scene manifest schema](contracts/scene-manifest.schema.json) | Versioned viewer/publication data contract |
| [Example manifest](contracts/examples/scene-manifest.json) | Synthetic contract example; not a generated scene |
| [Roadmap](docs/ROADMAP.md) | Ordered implementation phases, dates, acceptance checks, and cut lines |
| [Next steps](docs/NEXT_STEPS.md) | Immediate Meta feasibility experiment, evidence, and next implementation slices |
| [Private Meta spike](docs/SPIKE.md) | Prepared runner commands, checkpoints, budget guards, and live-test gaps |
| [Environment template](.env.example) | Configuration names; contains no credentials |
| [Implemented setup](docs/SETUP.md) | Deployment, migration, provider access, local commands, and current limits |

## Stack

Next.js / TypeScript on Vercel; React Three Fiber / Three.js for the viewer; Neon Postgres with Prisma; Neon Auth (Managed Better Auth); Cloudflare R2 for media; Meta Model API for Muse Spark and SAM 3.1; hosted Meta SAM 3D Objects for reconstruction. GitHub holds code, CI, and planning context.

The fal queue responds to authenticated reads. Live SAM 3D outputs and transforms still require the Phase 0 reconstruction spike.
