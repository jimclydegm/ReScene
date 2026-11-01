# Shopping stylist — implementation and verification

November 1, 2026, Asia/Manila. Implements the focused end-to-end scope in [SHOPPING_STYLIST_PLAN.md](SHOPPING_STYLIST_PLAN.md). Release status is recorded in CONTEXT.md; this document describes the code and evidence, not a promise of exact geometry or real commerce.

## Shopper flow

Open `/demo/space?collection=corner` → **AI stylist**. Enter a request and USD merchandise budget, optionally keep the selected product or mark it already owned. Speak uses the existing reviewed Muse Voice Transcribe input. Spark 1.3 interprets the goal, code searches role-compatible combinations with exact minor-unit pricing, then Spark ranks two validated candidates and explains them. No new image, mask or mesh generation is submitted while shopping.

The same panel is on Shop the scene. It retains the existing prepared room slots, replacement meshes, finish controls, lighting/background presets and merchant-style catalog. Typed input does not require a voice receipt. A new catalog export can introduce other approved generated products; the implementation is not tied to the original eleven listings.

Preview is transient and preloads/validates newly used GLBs. Apply rechecks actor ownership, expiry, catalog price/model version, base draft and constraints, then returns one canonical arrangement. The browser commits one history entry, so Undo/Redo restores the whole look, including owned/included buying state. Bag actions are explicit; applying a look does not purchase or add it. Existing unrelated bag contents are outside the combination's budget.

The request collapses after results arrive to conserve inspector space. Prices and short explanations remain on two compact cards; detailed product/finish/change lists disclose on demand. Original scene camera and background geometry are retained. Browser microphone/native visual verification remains deferred; local HTTP and model evidence are separate from native UI verification.

## Prices and constraints

- Catalog prices are persisted Decimal values converted exactly to integer USD cents. Display retains cents; unknown/invalid prices cannot be free recommendations. This release does not convert currencies.
- A kept product counts as a purchase unless explicitly owned. Owned items stay in the room and keep their identity/finish while leaving the new-purchase subtotal and bag. Multiple identical instances count separately.
- Visibility and buying inclusion are separate. Hiding a product does not silently remove its price. Shop this look has explicit inclusion checkboxes; owned pieces are excluded.
- Keep preserves product identity/finish/visibility. Position lock preserves pose, including indirect moves from a supporting object. The agent cannot hide required pieces to evade a budget.
- Product roles, support footprints/contact height, new collisions and final combined placements are checked in code. The joint validator avoids invalid intermediate moves when the final state is valid. Stylist proposals additionally check observed wall planes; existing manually authored demo layouts remain compatible. Approximate inherited mesh-box overlaps are tolerated rather than claimed to be verified solid geometry.
- Budgets that conflict with typed text request clarification. Impossible kept-purchase budgets stop before inference. No valid candidates yields an explanation, not fabricated products. Only one candidate yields one option. Candidate search is bounded; it does not claim exhaustive optimization over an unlimited catalog.

## Saved products and asset lifecycle

Two additive migrations add Product catalog role/readiness, stable public alias, source-object key, source-instance relation and inferred/authored detail JSON; `ShoppingStylistRequest` stores durable scoped receipts. Referenced product model/image foreign keys now restrict physical deletion. No existing tables/columns were dropped or renamed. Both migrations were applied to shared Neon after validation.

`services/product-library.ts` prepares new generated listings after terminal reconstruction/appearance/background/quality workflows. It reuses existing selected models and mask thumbnails; supplies authored listing defaults without inference; preserves existing merchant fields and explicit price/card removal. Shared-geometry subjects remain draft rather than independent purchasable pieces. A listing problem cannot discard a successful reconstruction. Paused known provider jobs skip catalog synchronization so their resume revision stays valid.

Restart retains SOURCE product records and their selected model/image assets while clearing later scene editing steps and revoking shares. Old model versions remain private Asset/run history. The source scene still owns these records; this does not introduce an independent enterprise asset namespace. Trash hides source projects from new owner catalog selection. Public approved frozen copies remain separate from source edits. Catalog replacement can reuse READY products across the same owner's scenes, copying assets/listing snapshots into the target scene before attaching them; same-scene signing/publication rules are preserved.

The explicit backfill prepared all currently eligible merchandise in the verified owner's ready scenes. The protected fixture was not changed, background surface geometry was not turned into merchandise, other owners were not backfilled, archived scenes stayed archived, and logically deleted assets were not revived. A subsequent detail fill preserved existing values and completed missing names/descriptions/prices/materials/dimensions/finishes. Private backups are under ignored `test-results/stylist/`.

At the final catalog audit, **151 active Product rows** outside the protected fixture had prices, detail JSON and image links. **103 ready generated objects** were linked to product listings; all currently eligible unlinked merchandise for the verified owner was accounted for. Counts are a dated audit, not an invariant; rows include reusable approved listings and older templates, not 151 unique reconstructed products.

## Approved shopping release

The database contains fourteen approved public aliases with prices/details and exact model/image links. Eleven reuse the existing approved showroom assets; three more reuse independent objects from the saved `56e639ae` living-room reconstruction:

- Sol Ceramic Table Lamp — $79.
- Cove Upholstered Armchair — $219.
- Terra Wood Side Table — $99.

These names, specifications and prices are authored catalog content. They are treated as ordinary products by the shopping flow; the application has not verified physical measurements, merchant inventory, customer reviews or checkout transactions. No new photography/mesh inference was needed for preparation.

`scripts/prepare-shopping-catalog.ts --apply --export` backfills and exports the curated assortment. Run without flags for a dry run; `--details-only` fills existing rows; `--export-only` registers approved copies without a whole-scene backfill. Existing merchant values are retained. The source of truth is Neon, exported to `demo/catalog-data.json`; `catalog.ts` is its client adapter. `catalog-models.json` is the explicit render allowlist. Existing aliases/finish indices, layouts and bags remain readable. New generated items have their existing photo cutouts; they do not falsely claim a new Muse photography album.

The Sol lamp's approved derivative is 7.75MB. Its geometry/texture detail is retained; the same-origin route streams that bounded approved object instead of buffering beyond Vercel's response limit. Files over 16MiB are rejected. Smaller approved models retain the existing buffered delivery. No raw storage key, signed private source URL, masks, source photos or provider replies are returned. See [Vercel's streaming guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).

## Recoverability and model use

`POST /api/voice/stylist` uses the existing signed `/api/voice` guest cookie, so there is no second identity system or need to migrate the voice cookie path. `GET /api/voice/stylist/[id]` retrieves the actor's private result; POST to that URL revalidates Apply. Typed and voice share this path, with voice-attempt ownership checked when supplied.

Two Workflow steps separately claim interpretation and ranking. Each paid step has automatic retries disabled, and the Meta SDK calls use `maxRetries: 0`. Completed intent/result/usage is saved; duplicate reservations recover results rather than pay again. Uncertain calls stay uncertain. Operational rate/concurrency bounds remain; the removed cumulative dollar cap was not restored. Session storage supports same-tab recovery after reload, with a fifteen-minute private result window. No raw audio is stored.

JSON hashes canonicalize object keys because Postgres JSONB changes key order. Catalog fingerprints use model IDs/digests instead of floating-point pose serialization, which can differ after bundling. Apply still rechecks the complete numeric arrangement and approved listing fields. Source generation and public share snapshots are not mutated by shopper requests.

## Verification evidence

Meaningful unit coverage includes exact-cent arithmetic, two affordable combinations, newly curated products, impossible budgets, owned/hidden/repeated items, purchase-scope preservation, semantic roles, indirect position locks, atomic final swaps, observed walls, grouped Undo/Redo, strict Meta contracts, owner catalog boundaries, source retention on restart, merchant-edit preservation, duplicate/uncertain requests, stale proposals and foreign-guest access. Schema/lint/types/build and the combined test suite pass; see CONTEXT.md for final release counts.

One live Spark intent/ranking request produced **Warm Clay Lamp and Side Table ($417)** and **Terracotta Vase and Clay Wood Table ($387)**, with the Haven chair kept. Both pass code checks and include the newly curated assortment. This paid result was reused to test the corrected HTTP Apply path rather than rerunning inference. The zero-inference impossible-budget request verifies actual Workflow dispatch, while replay verifies duplicate reuse, both canonical Apply results, stale-scene rejection and cross-guest isolation.

`node --conditions=react-server --import tsx scripts/verify-shopping-stylist.ts` checks product pages, new approved model hashes and API boundaries. `--live` deliberately submits one paid two-stage request. `--replay` reuses the saved private result plus a zero-inference workflow preflight; do not use `--live` repeatedly for unchanged release verification. The replay helper requires access to the ignored development receipt and database, and creates only verification receipts—not source-scene edits.

No full native browser/microphone check is claimed. No reconstruction quality improvement, real-world furniture fit, real inventory or payment integration is implied by this feature.
