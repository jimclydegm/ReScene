# ReScene

Turn one product scene photo into an editable, shoppable 3D scene.

ReScene is Jim's prototype for Meta's Global AI Developer Hackathon. The first demo focuses on furniture and home decor: upload a room photo, identify a few objects, reconstruct them, attach product information, edit the layout, and share an interactive viewer.

**Build freeze: November 2, 2026, Asia/Manila.** ReScene is deployed at [rescene-eta.vercel.app](https://rescene-eta.vercel.app).

## Working foundation

- Landing page with a selectable, movable 3D sample room (illustrated geometry, not AI reconstruction).
- Neon Managed Better Auth sign-up/sign-in/sign-out and Google sign-in integration.
- Private scene dashboard, persistence, ownership checks, and revision-aware updates.
- Private R2 uploads, image validation/normalization, and immutable source/preview storage.
- Meta object detection and mask review, durable hosted SAM 3D generation, and an editable mesh viewer.
- Move, rotate, resize, hide, undo/redo, precise numeric controls, and save/reload generated objects.
- Merchant product cards, private object thumbnails, an original demo replacement catalog and original-object restore.
- Photo-detail texture transfer, estimated room composition, editable main/fill/ambient lighting.
- Confirmed unlisted publication, frozen read-only shopper viewer, revocable links and render-only asset allowlists.
- Eight-model Prisma schema/migration, server-only Meta/fal adapters, and GitHub CI.

The local and deployed upload→analysis→masks→three meshes→saved edits API flow passes. Browser controls and rendered appearance still need visual QA because browser access is disabled in Work settings. Product editing, replacements and immutable sharing are implemented. Browser interaction QA, the final demo recording and authenticated participant-portal submission remain release gates. See [testing instructions](docs/TESTING.md) and [setup](docs/SETUP.md).

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
| [Scene manifest v2 schema](contracts/scene-manifest-v2.schema.json) | Implemented frozen viewer/publication contract (v1 retained as historical design) |
| [Example manifest](contracts/examples/scene-manifest.json) | Synthetic contract example; not a generated scene |
| [Roadmap](docs/ROADMAP.md) | Ordered implementation phases, dates, acceptance checks, and cut lines |
| [Next steps](docs/NEXT_STEPS.md) | Immediate Meta feasibility experiment, evidence, and next implementation slices |
| [Private Meta spike](docs/SPIKE.md) | Prepared runner commands, checkpoints, budget guards, and live-test gaps |
| [Environment template](.env.example) | Configuration names; contains no credentials |
| [Implemented setup](docs/SETUP.md) | Deployment, migration, provider access, local commands, and current limits |

## Stack

Next.js / TypeScript on Vercel; React Three Fiber / Three.js for the viewer; Neon Postgres with Prisma; Neon Auth (Managed Better Auth); Cloudflare R2 for media; Meta Model API for Muse Spark and SAM 3.1; hosted Meta SAM 3D Objects for reconstruction. GitHub holds code, CI, and planning context.

The live fal test returned independent textured GLBs from Meta SAM 3D Objects. Saved SAM poses provide approximate relative placement and room framing. Visible source texture detail can be baked onto the meshes, while hidden surfaces remain inferred. This is not a dimensionally accurate scan.

## Publish and test

Save a ready scene, scroll to **Publish snapshot**, and review the confirmation. Anyone with the unlisted link can view/download the approved meshes, room textures, product thumbnails and merchant fields. The full source photo, masks and provider records stay private. Subsequent draft edits do not change the snapshot; publish again to share a new saved revision. Revoke stops new viewer access, while previously signed asset links can work for up to 15 minutes and downloaded copies cannot be recalled.

Tests: `npm test` (47 focused cases), plus the explicit QA runners in TESTING.md. `scripts/smoke-release.mjs prepare` and `reconstruct` submit paid inference and require explicit use; status/report commands do not. Release/demo preparation is in [DEMO.md](docs/release/DEMO.md).
