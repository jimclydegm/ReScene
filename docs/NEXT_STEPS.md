# Next steps after the scene-composition correction

Updated October 29, 2026. Upload/auth/storage, live Meta analysis/masks, independent meshes, and saved object editing are implemented (PR #2 merged). Jim clarified that matching the photo's room/layout is part of the core goal; an empty stage with equalized object sizes is insufficient.

1. Verify the composition correction: existing scene → Match photo layout → photo camera/relative scale/depth/orientation → save/reload → Undo photo layout. The action reuses saved assets and makes no inference request. Follow TESTING.md.
2. Enable visual browser QA in Work settings. Check the actual bedroom against the expandable reference photo, object identities/orientations, floor contact, photo-view reset, mobile dialog, and selection. Current computer-use calls still report disabled. API/geometry evidence does not replace visual inspection.
3. Validate the revised Spark room/environment schema on a future authorized inference. The schema/prompt is implemented, but no new paid call was used for this correction. Existing scenes use sampled photo colors and neutral diffuse light. Detailed textures/windows/geometry remain incomplete.
4. Build seller product fields, a small rights-cleared replacement catalog, and transactional mesh+product replacement. Preserve the composed baseline and bottom-center pivot.
5. Build immutable publication and an anonymous viewer. Flatten imported baseline + draft position/yaw/scale into the public manifest; do not serialize draft multipliers as absolute object dimensions. Never expose source/mask/raw response assets.
6. Run one fresh deployed author-to-shopper flow, measure quality/timing/cost, fix blockers, record the hackathon demo, and freeze November 2 (Asia/Manila).

The approved development cap is US$10 total. The app's reservation pool is $7.50 and $7.28 is already reserved across shared DB runs; CLI/diagnostic reserve adds $2.4075. Existing scene matching/inspection requires no new inference. Do not raise the cap, create paid retries, or treat unknown charges as free. A new full generation needs more approved allowance or explicit usage reconciliation.

Local/preview/production share prototype Neon/Auth/R2. Jim wants automatic staging deletion left disabled and Vercel MCP OAuth kept pending. Secrets/artifacts stay ignored. Load CONTEXT.md first, then only the relevant task document.
