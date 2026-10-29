# Next steps after the scene-composition correction

Updated October 29, 2026. Upload/auth/storage, live Meta analysis/masks, independent meshes, and saved object editing are implemented (PR #2 merged). Jim clarified that matching the photo's room/layout is part of the core goal; an empty stage with equalized object sizes is insufficient.

1. Prioritize the texture-fidelity experiment in [TEXTURE_FIDELITY.md](TEXTURE_FIDELITY.md) / Phase 3.6 before claiming photo-like appearance. Textures already exist; source-photo projection/baking is proposed and untested. First use saved models to separate texture detail loss from lighting.
2. Verify the composition correction: existing scene → Match photo layout → photo camera/relative scale/depth/orientation → save/reload → Undo photo layout. The action reuses saved assets and makes no inference request. Follow TESTING.md.
3. Browser access now works. Desktop composition/materials/selection/hide/reload and 390px reference/confirmation dialogs were checked; mobile canvas overflow was corrected. Next inspect real-photo quality and camera orbit/reset across additional rooms. API/geometry evidence alone does not establish scan accuracy.
4. The revised Spark room/environment schema now passed a production inference. New scenes use those observations; existing scenes still use sampled photo colors and neutral diffuse light until reanalyzed. Detailed textures/windows/geometry remain incomplete. The next room-quality gate in ROADMAP.md covers reviewed surface masks/planes, a separately gated clean-background texture experiment, and checks for furniture ghosts after edits.
5. Build seller product fields, a small rights-cleared replacement catalog, and transactional mesh+product replacement. Preserve the composed baseline and bottom-center pivot.
6. Build immutable publication and an anonymous viewer. Flatten imported baseline + draft position/yaw/scale into the public manifest; do not serialize draft multipliers as absolute object dimensions. Never expose source/mask/raw response assets.
7. Run one fresh deployed author-to-shopper flow, measure quality/timing/cost, fix blockers, record the hackathon demo, and freeze November 2 (Asia/Manila).

Jim requested removing the cumulative app cap and continuing live tests on October 29. The earlier $10 limit is superseded; no app `GENERATION_BUDGET_USD` remains. Keep historical estimates and provider request IDs, idempotency, one active generation per user, and zero automatic paid retries. Meta credits and fal billing are separate. Use focused tests, not unbounded repeated submissions.

Local/preview/production share prototype Neon/Auth/R2. Jim wants automatic staging deletion left disabled and Vercel MCP OAuth kept pending. Secrets/artifacts stay ignored. Load CONTEXT.md first, then only the relevant task document.
