# ReScene Living shopping demos

Updated October31,2026. The demo uses existing successful reconstructions. No inference, payments, account creation or database migration is involved.

## Shopping journeys

`/demo` opens three experiences. Header and hub links lead to selection pages first:

- `/demo/products`: searchable/category-filtered catalog of eleven existing sample products. Haven Accent Chair is the featured starting product. Other products reuse the same complete product-page implementation and already available meshes, so no additional generation was needed. Prices, variants and product specifications are authored fictional listings.
- `/demo/product/[id]`: sample photography and interactive3D shown simultaneously. Photo thumbnails switch only the photograph;3D stays visible and responds to color choices. Buying panel contains quantity/bag/Buy now, specs/care dialogs and a compact review carousel with illustrated avatars. Full sample reviews and local-only review form use dialogs. Main demo actions do not require scrolling to a separate reviews section.
- `/demo/spaces`: The Reading Corner is first, The Everyday Collection is second, and Workspace is clearly marked as a non-interactive future collection. Selection opens `/demo/space?collection=corner|space`.
- `/demo/scenes`: choose Sunday Living Room, Reading Corner or Everyday Collection, then open `/demo/shop-the-scene?collection=...`.

Build and Shop both expose the same PositionControls component and changeArrangement validation: floor/surface X/Z movement, yaw with sliders and step buttons, colors, visibility, lighting, grouped undo/redo and reset. Shop retains individual inspection, photography comparison, product cards, list and selectable Shop this look bundle. Both retain the shared renderer's focus, fullscreen, zoom lock, background preview and PNG export.

Build has four saved layouts per collection (A/B/C/D), floor-plan previews and save/switch/reset confirmation. Old v1 carts and A/B Everyday layouts remain readable; new per-collection layout sets prevent layouts from one room being applied to another. Unsaved edits stay page-local. Intentionally save a layout before leaving. All visitor state is browser-only; blocked storage falls back to session memory.

The shared bag merges matching product/color variants, preserves distinct variants, supports quantity/removal and computes totals from integer USD cents. Checkout uses fictional delivery details and creates only a local demo confirmation. No payment or personal information is collected. Reviews and materials/dimensions are explicitly sample content, not verified customer or product claims.

## Frozen content and privacy

The original release (PR30, merge50393c5) curated eight meshes from41f2f4b8 revision13 and eb34c54c revision10. The new Reading Corner deliberately copies three independent ready meshes from Jim's selected6800b8a2 revision102. All three source scenes remain unchanged; protected real fixture f2848b95 is never read or mutated by this export.

`scripts/export-demo-store.ts` checks source revision/object IDs/order. `DEMO_COLLECTION=corner` exports only the newly selected collection and preserves existing frozen releases. It performs no database writes. Sample reference copies/crops and derived background textures are metadata-stripped intentional public demo assets under `public/demo/images`. General source images, masks, prompts, provider IDs and owner data remain private.

`lib/demo/frozen-scenes.json` contains render-safe composition, lights and bottom-center-rebased placements. Dedicated content-addressed R2 copies live under the configured prefix's `demo/store-v1/`. Opaque albedo is JPEG95/4:4:4 in demo copies, with original geometry/accessor bytes, UVs, node transforms and texture dimensions preserved. Original GLBs retain PNG textures. All eleven approved files stay below the4MB delivery bound.

`GET /api/demo/assets/[id]` serves only the frozen allowlist directly through the same origin, with versioned URLs/CDN caching and no database lookup or private signed source URL. Source project edits/deletion do not silently replace curated demo assets; removal from the release is explicit.

## Placement and support

Saved geometry identifies the vase's supporting cabinet through its existing bottom/top/footprint relationship. Cabinet translation/yaw carries the vase rigidly; hiding its support hides the accessory. Independent vase moves stay within the cabinet surface. Conservative rotated footprints reject new independent-object overlaps; vertically separated/support contacts are permitted. This is a lightweight browser guard, not a physical fit certificate.

Build's initial browsing camera frames the wider preset layouts without changing the source-camera calibration used to project background textures. Other viewers retain their existing default framing.

## Validation

206 cases pass, including variant arithmetic/limits, invalid storage, legacy A/B preservation, per-collection layout round trips, support-following/unsupported-move rejection, collision guards across all three scenes, render-only inventory, asset allowlisting without DB access and geometry-preserving repacking. Schema/lint/types/build pass. `scripts/verify-demo-store.mjs` checks all selection/product/workflow pages, invalid asset/product IDs, all approved images and eleven model SHA256 hashes without inference or mutations.

Native browser/WebGL/mobile/download interaction checks remain unverified: browser access still reports disabled and Jim previously chose to continue without browser verification. CSS and HTTP/build checks are not a claim of visual verification.
