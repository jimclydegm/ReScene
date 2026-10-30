# ReScene Living demo store

Implemented October 30, 2026. This is the approved three-workflow shopping demo, built from existing successful reconstructions. No inference, payments, account creation or new database tables are involved.

## Routes and interactions

- `/demo`: three experience cards, shared shopping header/bag and Reset demo.
- `/demo/product/[id]`: eight fictional product listings with existing textured GLB, comparison photo, original/illustrative color variants, quantity, bag/Buy now, specifications/care, fictional reviews and a local-only review preview. Unknown product IDs are rejected. The viewer supports orbit, zoom lock, focus, fullscreen, background preview and scene/transparent PNG exports.
- `/demo/space`: four saved products, visibility, original textures/tints, floor-constrained X/Z and yaw, five light choices including original, grouped history, A/B arrangements with floor-plan previews, save/switch/reset confirmations, screenshot downloads and arrangement-to-bag. Conservative rotated floor footprints block new product overlap; this is a lightweight browser guard, not a physics/fit certificate.
- `/demo/shop-the-scene`: four-product living room, selection/deselection, hiding, individual inspection, sample-photo comparison, colors, shopping list, selectable Shop this look bundle and total.
- The shared bag merges identical product/color variants, preserves distinct variants, supports quantity/removal and calculates totals from authored integer USD cents. Checkout displays fictional delivery details and creates only a local demo confirmation. No payment or personal information is requested.

## Reuse and content

`components/scene/model-canvas.tsx` remains the shared renderer, with optional shopping fullscreen/PNG labels. Existing material cloning/tint, focus/capture, lighting presets and grouped history are reused. `components/demo` owns the retail shell and workflow UI. `lib/demo/catalog.ts` contains fictional merchant fields, dimensions/materials, prices and curated illustrative colors. They never overwrite real Product records.

`scripts/export-demo-store.ts` deliberately curates scene41f2f4b8 revision13 (dresser, sage chair, side table, dining chair) and eb34c54c revision10 (sofa, coffee table, stool, vase). Exact object IDs/order/revision are checked before any export; changed sources require another deliberate curation. It performs no DB writes. Original projects, transforms, merchant metadata and publication links remain unchanged. Protected real fixture f2848b95 is not used.

The script freezes render-safe composition, lights and rebased placements in `lib/demo/frozen-scenes.json`. Bottom-center rebasing preserves the composed source transform and relative scale while making local rotation usable. Selected synthetic sample comparison images/crops and derived background finishes are metadata-stripped intentional public demo copies in `public/demo/images`. These are the selected demo samples only; general project sources, masks, prompts, reviews and signed URLs remain private.

GLBs are copied to content-addressed R2 keys under the configured prefix's `demo/store-v1/`. The original geometry/accessors/UVs/node transforms and texture dimensions are retained; opaque embedded albedo is JPEG95/4:4:4 in the demo copy only. Each resulting file is about1.8–2.2MB, below the4MB application delivery bound. Original reconstruction GLBs retain their PNG textures.

`GET /api/demo/assets/[id]` resolves only the eight frozen product IDs, serves a bounded GLB directly through the same origin and caches approved copies at the CDN. No arbitrary storage key/scene ID/URL, database query, original source lookup or expiring source URL is accepted. Client model URLs include a content version. Source project deletion/edits do not change an already-curated demo release; remove a product from this dedicated release to withdraw it.

## Browser storage

`rescene-store-v1` stores a strictly validated cart and saved A/B layouts; malformed/unknown data falls back to defaults. Hydration finishes before the room loads its saved arrangement. Cross-tab storage updates refresh the shared state. Blocked/quota-limited storage uses session memory. Reset affects only demo state and returns to the demo hub. Unsaved room edits/review previews are page-local; explicitly save A/B before navigating away.

## Validation and limits

Tests cover variant arithmetic/limits, invalid and duplicate cart entries, saved-layout round trips, starting-layout footprints, frozen render-only inventory, asset allowlisting without DB access, and geometry-preserving texture repacking. HTTP checks verify pages and every copied GLB against its frozen SHA256. No automated calls can generate new AI assets or submit an order. Native browser/WebGL/desktop/mobile/download interaction checks remain unverified: local browser access is disabled and Jim explicitly chose to continue without browser verification.

The underlying single-photo reconstructions retain their existing quality limitations. Demo material names/dimensions/reviews are fictional; color tints do not establish a physical manufacturer's variants or verified fit. Furniture is this demo collection, not a general input restriction.
