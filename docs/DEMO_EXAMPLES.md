# Demo example library

Requested November1: eight attached scene concepts and five genuinely different products in each of six categories. This is one release bundle. All38 reconstructions and the final72-product/11-collection snapshot are complete. Release verification is in progress.

The new photographs use Muse Image1.0 high-reasoning reference edits. Eight scenes preserve their inventory and setting;30 product variations each have a new full-product studio photograph. Another28 studio photographs identify each scene product independently. These are generated photographs, not crops or mesh screenshots. Visual review caught a wrong perfume bottle; its original paid receipt is retained and a separate explicit correction produced the requested slim black-cap bottle.

The categories are chairs, drawer chests, computer mice, sofas, single shoes and mugs. Shapes/materials/prices vary; finish tints are additional choices rather than substitutes for five actual models. Product dimensions and prices are authored catalog specifications, not AI measurements or identification of real manufacturers.

The scene collections are Home essentials, Playtime desk, Quiet workspace, Seating collection, Appliance collection, Everyday carry, Fragrance collection and City essentials. The existing reading corner, everyday furniture and living-room collections remain available. All new collections work in Build your space and Shop the scene. Sofa variations can replace the existing living-room sofa. The workspace supplies a mouse slot, playtime a mug slot and daily-carry/city scenes footwear slots.

## Durable generation and curation

1. `scripts/generate-example-images.ts` creates fresh Muse photographs, with private submit/response/result receipts. Existing receipts prevent automatic resubmission; known bad results receive a deliberately reviewed new attempt.
2. `scripts/build-example-scenes.ts` creates owned source scenes and private generated ContentItems. It calls app services for SAM3.1 masks, SAM3D reconstruction and scene analysis/environment reconstruction. The existing owner concurrency guard is retained. Each run/job is saved before polling; no blind paid retries.
3. `scripts/promote-example-library.ts` requires completed owned builds, separate independent meshes, valid embedded GLBs and successful Muse photography. Noun and image-location matching assigns scene products independently of provider output order. Models are copied to immutable approved R2 keys; JPEG repacking retains triangles/UVs/texture dimensions. Same-scene asset rows, priced SOURCE listings and source-product links remain in Neon.
4. The public snapshot contains permitted listing/render fields only. It expands the existing14 listings to72 and the existing3 collections to11. No input attachment, source key, owner ID, mask, signed URL or provider receipt is exported. Private CPU inspection renders are QA evidence only, never shopping images.

Curation preserves raw paid outputs when reviewing an empty plate's interpretation. The original photograph controls architecture; a generated plate cannot introduce an unsupported wall. A desk-dominant example uses one continuous oak support rather than low-confidence peripheral blur or a shadow void. The shared background workflow now compares original and clean depth using observed wall count, visible coverage and corner disagreement instead of always selecting clean depth. A successful measured fallback is recorded privately without an unnecessary warning. No additional provider call is needed for this comparison.

Generated-library adoption follows `ContentItem.assetId` and records the actual content-item foreign key; the two IDs need not match. Only ready, owned, unarchived Muse sources are accepted. The active Image Studio project allowance is200 so the catalog-source projects do not block the creator. Product/source assets remain private and same-scene scoped; no SQL migration is needed.

Private state: ignored `test-results/demo-expansion-v1/`. Generated approved photos: `public/demo/expansion/`. Dataset brief: `src/lib/demo/example-batch.ts`; authored specifications: `example-listings.ts`; dynamic menus: `collections-data.json`; photographic evidence: `example-media.json`.

## Readiness

- [x] Muse photographs generated and visually reviewed.
- [x] All30 replacement products and eight scenes reconstructed and inspected.
- [x] Neon/R2 approved listings and complete public snapshot synchronized.
- [x] Stylist/voice use all approved collections with role, budget and placement guards.
- [ ] Combined schema/types/lint/tests/build, release and production smoke complete.

Native browser verification remains deferred at Jim's instruction. Single-photo geometry, especially glass, hidden surfaces and tiny printed details, remains approximate; a successful render does not establish physical fit or faithful unseen geometry.

The final read-only data check confirms38 ready owned builds,72 approved Neon listings with ready same-scene R2 models/photos, and58 new embedded-texture GLBs with UVs/normals (minimum4,132 triangles; largest5.22MiB). All eight scene model assemblies were inspected in private reference-camera renders.354 automated tests, Prisma validation, lint, typecheck, production build and98-page local HTTP smoke pass. Deployment verification is pending.

A real Spark intent/ranking proof returned two different workspace mice at$48/$68, preserved kept/owned pieces and verified canonical Apply, one-step Undo and duplicate reuse. Two earlier test receipts are preserved: the original output allowance was insufficient, and another interpretation returned an unnecessary clarification. The adapter now scopes catalog context to compatible slots, allows8,000 completion tokens/90seconds, explicitly distinguishes alternative looks from simultaneous duplicate items, and records safe response diagnostics without automatic retry. Network uncertainty remains separate from a known invalid/truncated response. Restoring accepted spread layouts allows no deeper conservative footprint overlap; new collisions remain blocked.

## Short stylist demonstrations

- Quiet workspace: mark the laptop and notebook as already owned. Keep the tumbler, enter a$100 budget and request “Keep the tumbler. Show two coordinated mouse choices within the budget.” The owned pieces remain in the scene and leave the purchase subtotal.
- Home essentials: mark the refrigerator as already owned. Enter$500 and request “Keep the refrigerator. Coordinate the chair and drawers with warmer finishes.”
- Sunday living room: keep the table, stool and vase as already owned. Enter$750 and request “Try two different sofas that work with these pieces.”
- City essentials: keep the handbag as already owned. Enter$180 and request “Coordinate the sneaker and loafer with the taupe bag.”
- Playtime desk: keep the ball, lunchbox, car and crayons as already owned. Enter$30 and request “Show two mug options that suit this collection.”

Preview each option, Apply, Undo once and add the included merchandise to the bag. The budget is calculated in code from saved prices. “Already owned” and “Keep” serve different purposes: owned items stay visible without a new purchase charge; kept purchased items still count toward the budget.
