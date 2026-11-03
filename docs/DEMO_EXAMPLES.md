# Demo example library

## November3 catalog expansion

The new `catalog-prices-v2` brief adds64 independent products: eight each in tables, chairs, drawers, sofas, mugs, vases, bags and footwear. Tables include side and coffee tables; chairs include dining and lounge seating. Prices span$6–$1,899 rather than clustering around one price. All64 Muse studio photographs are generated and reviewed; all64 owner-scoped SAM3.1/SAM3D builds are complete. Neon verifies136 approved listings and64 new independent textured meshes (minimum3,588 triangles, largest4.52MiB). The complete389-test suite, Prisma validation, lint, types and production build pass. Local seeding verifies136 model/photo/material-linked listings, and judge setup verifies all136 release models. A real Spark request returned$98/$168 coordinated chair-and-drawer combinations under$200, preserving an owned refrigerator, Apply, one-step Undo and duplicate reuse. Production release verification is pending.

Existing curation scripts select this batch with `EXAMPLE_BATCH=catalog-prices-v2`. Definitions live in `src/lib/demo/catalog-expansion.ts`; private attempts and inspection images live under ignored `test-results/catalog-prices-v2`, and approved photography under `public/demo/catalog-v2`. Receipt reuse, complete independent meshes, same-scene asset ownership and public approval boundaries remain unchanged. No SQL migration or new runtime service is required. An existing receipt always prevents blind paid resubmission.

The stylist now searches a bounded selection of products across price bands and product identities, then validates full arrangements as before. Tote and handbag alternatives share a shopping role. The manual replacement picker sorts by price; the editor library gains search, category filters, prices and incremental display. Curated listings suppress duplicate source-object cards. Its source-row bound is1,000 rather than150, above the current owned library size. Imported camera heading was also inflating replacement footprints: all eight new sofas initially hit the room boundary. An oriented hull frame now aligns elongated replacements to the selected slot, preserving mesh proportions, bottom contact and the shopper's yaw. Seven new sofas and all existing sofa alternatives fit the tested living room; an actually overlapping sofa remains blocked. Near-square or missing-evidence frames retain their original orientation; size-only listings can use a clearly elongated observed footprint without inventing measurements. Frozen source scenes and model bytes are unchanged. Native Chrome verified the$249 sofa and$29 table, exact totals, and the table's one-step Undo.


Requested November1: eight attached scene concepts and five genuinely different products in each of six categories. This is one release bundle. All38 reconstructions and the final72-product/11-collection snapshot are shipped in PR44 (c3023b7), November2. Production rescene-2zo624kct-jimclydegms-projects.vercel.app is READY at https://rescene-eta.vercel.app.

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
- [x] Combined schema/types/lint/354 tests/build, PR/main CI, release and production smoke complete.

Native browser verification remains deferred at Jim's instruction. Single-photo geometry, especially glass, hidden surfaces and tiny printed details, remains approximate; a successful render does not establish physical fit or faithful unseen geometry.

The final read-only data check confirms38 ready owned builds,72 approved Neon listings with ready same-scene R2 models/photos, and58 new embedded-texture GLBs with UVs/normals (minimum4,132 triangles; largest5.22MiB). All eight scene model assemblies were inspected in private reference-camera renders.354 automated tests, Prisma validation, lint, typecheck, production build and98-page local HTTP smoke pass. Production passes all98 shopping pages/invalid collection and asset boundaries,66 new Muse photograph hashes and58 immutable model hashes.

A real Spark intent/ranking proof returned two different workspace mice at$48/$68, preserved kept/owned pieces and verified canonical Apply, one-step Undo and duplicate reuse. Two earlier test receipts are preserved: the original output allowance was insufficient, and another interpretation returned an unnecessary clarification. The adapter now scopes catalog context to compatible slots, allows8,000 completion tokens/90seconds, explicitly distinguishes alternative looks from simultaneous duplicate items, and records safe response diagnostics without automatic retry. Network uncertainty remains separate from a known invalid/truncated response. Production replays the successful paid result for HTTP Apply, duplicate reservation, stale-draft and cross-guest checks; a deployed Workflow preflight fails an impossible budget without model calls. No paid inference is repeated for release checks. Restoring accepted spread layouts allows no deeper conservative footprint overlap; new collisions remain blocked.

## Short stylist demonstrations

- Quiet workspace: mark the laptop and notebook as already owned. Keep the tumbler, enter a$100 budget and request “Keep the tumbler. Show two coordinated mouse choices within the budget.” The owned pieces remain in the scene and leave the purchase subtotal.
- Home essentials: mark the refrigerator as already owned. Enter$500 and request “Keep the refrigerator. Coordinate the chair and drawers with warmer finishes.”
- Sunday living room: keep the table, stool and vase as already owned. Enter$750 and request “Try two different sofas that work with these pieces.”
- City essentials: keep the handbag as already owned. Enter$180 and request “Coordinate the sneaker and loafer with the taupe bag.”
- Playtime desk: keep the ball, lunchbox, car and crayons as already owned. Enter$30 and request “Show two mug options that suit this collection.”

Preview each option, Apply, Undo once and add the included merchandise to the bag. The budget is calculated in code from saved prices. “Already owned” and “Keep” serve different purposes: owned items stay visible without a new purchase charge; kept purchased items still count toward the budget.
