# Shop in 2D

Shop the scene has a **Shop in 2D** button beside **Scene album**. It opens the approved reference photograph with selectable products, an adjustable highlight and product information. **Back to 3D** restores the existing editor state.

## Shopping behavior

- Click the actual silhouette, a numbered selector or a product card. Click the selected product again or an empty part of the photo to deselect it. Numbered selectors support Tab, Enter and Space.
- Adjust Highlight from0–80%. Picking follows the saved mask alpha, including holes; a bounding box alone cannot select an object.
- The right panel shows the original photographed product's name, price, description, materials and dimensions, plus up to three small Muse-generated photo concepts. Click a photo to enlarge it.
- Add an item or use Shop this look. Photo shopping retains original product identities, prices and finishes regardless of replacements, colors, hidden items or owned flags in the separate3D arrangement.
- Replacement, transforms, colors, room/light changes, voice edits and the stylist are unavailable in2D. They return in3D with the existing selection, edits and undo history intact. Photo shopping has its own purchase-inclusion state.

These are prepared shopping collections, not an upload-time segmentation service. Source-photo visibility and ordinary publication permissions do not change.

## Data and generation

All11 collections already had saved Meta SAM3.1 masks for their39 products. `scripts/export-photo-shopping.ts` reads explicitly approved owned source records, verifies the published reference matches the source, and exports cropped derived overlays at a bounded selection resolution. Each overlay has a SHA-256, crop rectangle, area and a label anchor inside the silhouette. The manifest contains public paths and product keys only; original masks, owner/source IDs, storage keys and provider records remain private. No new segmentation calls were needed.

Twenty-eight pictured products previously had only one generated product photograph. `scripts/generate-photo-shop-albums.ts` made one additional alternate-angle Muse Image photograph for each, with durable submission receipts and no automatic retries. All28 were visually reviewed before export. They are photographic concepts inferred from reference evidence, not verified hidden views. `scripts/sync-photo-shop-albums.ts` saves them as same-scene approved PRODUCT_IMAGE assets in R2/Neon and merges `galleryAssetIds` into the catalog listing. Merchant fields, prices, model assets and scene state are preserved. No SQL migration was needed.

The prepared snapshot and files support the keyless judge setup. Browsing, picking, details and shopping do not require model calls or a database lookup. Failed mask decoding leaves numbered selectors and product cards available.

## Verification

Six focused tests cover every photo/mask hash, exact alpha geometry and interior anchors, picking through holes/overlap, wide/tall letterboxing, original-photo commerce isolation, and generated gallery hashes/dimensions. The complete395-test suite, Prisma validation, lint, TypeScript and production build pass. The full local suite used four workers to avoid oversubscribing simultaneous image-processing tests.

`node scripts/verify-photo-shopping.mjs` checks all11 pages,39 overlay hashes and39 reference/new-gallery photograph hashes without inference. The broader showroom smoke uses `node scripts/verify-demo-store.mjs --ui` to avoid redownloading unchanged models.

Initial native Chrome inspection confirmed the living-room photo, silhouette highlights, numbered selectors, opacity slider and disabled stylist. The subsequent final native interaction pass was interrupted by repeated native-control timeouts while Chrome was in active use; do not treat unperformed final browser gestures as verified. Saved evidence remains ignored under `test-results/shop-2d/`.

Release and production verification are recorded in CONTEXT.md after deployment.
