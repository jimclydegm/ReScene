# ReScene project instructions

## Context loading

- Read `docs/CONTEXT.md` and the current phase in `docs/ROADMAP.md` first.
- Read `docs/META_MODELS.md` for model work, `docs/ARCHITECTURE.md` for application work, and `docs/DATA_MODEL.md` plus `prisma/schema.prisma` for database work.
- Treat plans as proposed architecture until an implementation phase is checked off. Do not describe planned integrations as working.
- After completing a phase, update `docs/ROADMAP.md` and the current state/next action in `docs/CONTEXT.md`. Record changes to scope or architecture in `docs/PLAN.md`.

## Product constraints

- Build freeze: November 2, 2026, Asia/Manila. Prioritize a complete furniture/home-decor demo.
- Core path: upload → Meta analysis → review masks → object meshes → edit/product links → publish/read-only viewer.
- Meta runtime models are required. Do not replace them with another model provider without Jim's instruction.
- WorldGen has no verified developer API. SAM 3.1 is segmentation; SAM 3D Objects is reconstruction. Keep these distinct.
- Use Vercel, GitHub, Cloudflare R2, Neon Postgres, Prisma, and Neon Managed Better Auth as requested.
- Never claim exact product identity, real measurements, faithful unseen geometry, or garment fit from one image.
- Keep source photos private. Public snapshots expose only approved viewer assets and merchant-entered product fields.
- Keep the short handoff concise instead of copying all research into it.

## Persistent writing preferences

- Open paragraphs with concrete facts. Avoid empty setup phrases, vague reactions, invented crowd sentiment, and dramatic lead-ins.
- Write plainly and casually. State facts directly; do not add filler to manufacture wit or tell the reader how to feel.
