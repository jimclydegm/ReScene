# ReScene Living shopping demos

## Showroom customization — November 1

Build your space keeps the showroom canvas clear and groups the right inspector into Products, Room and Layouts, with the buying total/action pinned underneath. Six named arrangements and save-as controls are on the Layouts tab. Position/rotation controls disclose beneath the selected product instead of taking permanent space.

Build and Shop can replace a selected slot with an existing approved frozen product. The picker has search/category filters, real existing photographs, prices and price differences. Stable slot IDs preserve selection/layout membership; optional item.productId selects the actual model/listing/finish choices and shopping-bag identity. Uniform scaling uses the existing fictional listing heights to relate otherwise scale-ambiguous reconstructions; proportions stay intact and new footprints are checked. This is illustrative scene scale, not verified physical fit. Supporting pieces accept only cabinets/tables; tabletop slots accept accessories. Replacing a support updates accessory height, and moving/rotating it still carries the accessory. Larger intersecting replacements are rejected without changing the accepted draft.

Room controls offer Original, Warm linen, Soft clay, Quiet sage, Dark gallery and White studio. Room finishes preserve the source camera and observed room geometry; White studio switches to a seamless cove without side walls. Wall/floor colors are independent in a room, while a continuous backdrop has one coherent color. Existing room floor texture can be retained. Shuffle product colors and Surprise background each create one undo operation. Room controls are shared with Shop the scene in its compact disclosure.

Build adds selected-item shopping, position locking, isolation and per-item reset alongside the existing visibility/finishes/movement controls. Layout loads, replacements, background/color changes and resets are undoable. Saving A–F persists replacements, background settings and locks in the existing browser store; legacy bags/layouts remain readable. Totals, details links, photos, color options and bag lines all resolve the chosen replacement product. Backend/database, inference and approved model/image assets are unchanged; no paid calls or saved project writes are needed.

Verification: 259 tests, Prisma validation, lint/types and production build pass. New tests cover actual model/listing selection, uniform scaling, support height/following, incompatible replacements, larger-footprint collisions, prices/duplicate bag lines, position locks, grouped randomization history, camera/geometry preservation, the studio route and old/new storage validation. Browser access remains disabled; native layout/WebGL checks are not claimed. PR39 merged at8cc1df4; PR/main CI pass. Production rescene-atb4mzarb-jimclydegms-projects.vercel.app is READY at rescene-eta.vercel.app. Live read-only `DEMO_BASE_URL=https://rescene-eta.vercel.app node scripts/verify-demo-store.mjs --customization` passes for demo/product routes, delivered new controls/styles, privacy and Album defaults; unchanged image/mesh downloads are skipped. Local4317 server is stopped.


October31 visual cleanup: all7–8 illustrative finishes are selectable on every product page. Selecting a finish without an album photograph opens the live3D tint preview; existing photographic variants still select their photo. Shared swatch checks are centered within a contrast badge. Layout chips use one horizontal row; inherited first-child/diagram sizing is removed. Collection cards, position/rotation, item actions, lighting and purchase controls are compact. Product quantity/Add/Buy share a desktop row; redundant headings/navigation and expanded description text are removed or disclosed. Desktop core controls were checked at1280×800 and mobile at390px without horizontal overflow. Saved camera/mesh/layout/cart data remain unchanged. Shopping toasts can be closed. Native checks used local demo state only; no purchases, generation or project mutation.

Visual cleanup release: PR34 merged at364724e; PR/main CI and235 tests/schema/lint/types/build pass. Production rescene-115an74ml-jimclydegms-projects.vercel.app is READY at rescene-eta.vercel.app. Live --ui smoke verifies pages/styles without unchanged binary downloads; native production checks confirm the full palette, color-to3D fallback, correct finish when returning to Album, centered checks and compact desktop layout. The generation cover/default boxes/dismissal checks used a local synthetic fixture, not paid inference. Private screenshot: test-results/visual-cleanup/production-demo.png.

Updated October31,2026. The demo reuses existing successful reconstructions and pre-generated Muse Image product photography. Browsing submits no inference, payments, account creation or database migration.

## Shopping journeys

`/demo` opens three experiences. Header and hub links lead to selection pages first:

- `/demo/products`: searchable/category-filtered catalog of eleven existing sample products. Haven Accent Chair is the featured starting product. Products share the complete product-page implementation and existing meshes, with new Muse-generated studio photographs as covers. Prices, variants and product specifications are authored fictional listings.
- `/demo/product/[id]`: Album mode opens first, with optional3D mode. Original reference photographs and new Muse Image studio, angle, finish and lifestyle photographs share an expandable gallery. Buying panel contains quantity/bag/Buy now, specs/care dialogs and a compact review carousel with illustrated avatars. Full sample reviews and local-only review form use dialogs. Main demo actions do not require scrolling to a separate reviews section.
- `/demo/spaces`: The Reading Corner is first, The Everyday Collection is second, and Workspace is clearly marked as a non-interactive future collection. Selection opens `/demo/space?collection=corner|space`.
- `/demo/scenes`: choose Sunday Living Room, Reading Corner or Everyday Collection, then open `/demo/shop-the-scene?collection=...`.

Build and Shop both expose the same PositionControls component and changeArrangement validation: floor/surface X/Z movement, yaw with sliders and step buttons, colors, visibility, lighting, grouped undo/redo and reset. Shop retains individual inspection, photography comparison, product cards, list and selectable Shop this look bundle. Both retain the shared renderer's focus, fullscreen, zoom lock, background preview and PNG export.

Build has six saved layouts per collection (A–F), compact named chips and save/switch/reset confirmation. Old v1 carts, four-slot collections and A/B Everyday layouts remain readable; per-collection layout sets prevent layouts from one room being applied to another. Unsaved edits stay page-local. Intentionally save a layout before leaving. All visitor state is browser-only; blocked storage falls back to session memory.

The shared bag merges matching product/color variants, preserves distinct variants, supports quantity/removal and computes totals from integer USD cents. Checkout uses fictional delivery details and creates only a local demo confirmation. No payment or personal information is collected. Reviews and materials/dimensions are explicitly sample content, not verified customer or product claims.

## Frozen content and privacy

The original release (PR30, merge50393c5) curated eight meshes from41f2f4b8 revision13 and eb34c54c revision10. The new Reading Corner deliberately copies three independent ready meshes from Jim's selected6800b8a2 revision102. All three source scenes remain unchanged; protected real fixture f2848b95 is never read or mutated by this export.

`scripts/export-demo-store.ts` checks source revision/object IDs/order. `DEMO_COLLECTION=corner` exports only the newly selected collection and preserves existing frozen releases. It performs no database writes. Sample reference copies/crops and derived background textures are metadata-stripped intentional public demo assets under `public/demo/images`. General source images, masks, prompts, provider IDs and owner data remain private.

`lib/demo/frozen-scenes.json` contains render-safe composition, lights and bottom-center-rebased placements. Dedicated content-addressed R2 copies live under the configured prefix's `demo/store-v1/`. Opaque albedo is JPEG95/4:4:4 in demo copies, with original geometry/accessor bytes, UVs, node transforms and texture dimensions preserved. Original GLBs retain PNG textures. All eleven approved files stay below the4MB delivery bound.

`GET /api/demo/assets/[id]` serves only the frozen allowlist directly through the same origin, with versioned URLs/CDN caching and no database lookup or private signed source URL. Source project edits/deletion do not silently replace curated demo assets; removal from the release is explicit.

## Placement and support

Saved geometry identifies the vase's supporting cabinet through its existing bottom/top/footprint relationship. Cabinet translation/yaw carries the vase rigidly; hiding its support hides the accessory. Independent vase moves stay within the cabinet surface. Conservative rotated footprints reject new independent-object overlaps; vertically separated/support contacts are permitted. This is a lightweight browser guard, not a physical fit certificate.

Build and Shop fit the saved source-photo aspect into the viewer without changing the source-camera calibration used to project background textures. Individual product inspection uses its existing dedicated framing.

## Validation

206 cases pass, including variant arithmetic/limits, invalid storage, legacy A/B preservation, per-collection layout round trips, support-following/unsupported-move rejection, collision guards across all three scenes, render-only inventory, asset allowlisting without DB access and geometry-preserving repacking. Schema/lint/types/build pass. `scripts/verify-demo-store.mjs` checks all selection/product/workflow pages, invalid asset/product IDs, all approved images and eleven model SHA256 hashes without inference or mutations.

Native browser/WebGL/mobile/download interaction checks remain unverified: browser access still reports disabled and Jim previously chose to continue without browser verification. CSS and HTTP/build checks are not a claim of visual verification.

Release: PR31 merged atf4927b6, PR/main CI pass. Production rescene-iv4tgezvc-jimclydegms-projects.vercel.app is READY; the full read-only demo smoke passes at https://rescene-eta.vercel.app. The selected source remains READY at revision102. No additional inference was used.

## Compact layout, source framing and theme — October31

Demo UI now uses a shared semantic light/dark palette and the existing app ThemeMenu/persisted theme preference. There is no separate demo theme state. Main text is15–16px; secondary labels are12–13px. Text/accent combinations are checked at WCAG AA contrast in both themes. Scene colors and product photographs are preserved when switching UI theme.

Menus/cart/product selectors share72px square thumbnail wells with contain fitting; primary product photographs and the actual3D view remain larger. Twelve existing public sample photographs (eight products, four settings) are available through compact photo-inspiration dialogs; they are explicitly photographic previews and do not pretend to have generated meshes. No new inference or stored assets.

The fixed wide arranger camera is removed. A ResizeObserver fits the saved photo aspect inside the available viewer area; the default source camera position, target and FOV remain unchanged. Letterboxing replaces field-of-view widening, avoiding extra unobserved background/floor in the initial view. Orbit and zoom remain available, so unseen geometry remains approximate. Compare arrangements moves above the viewer with one Save-as/Save action. Native browser verification remains unavailable; mathematical frame fitting, contrast, build and HTTP checks do not substitute for native visual checks.

Compact/theme release: PR32 merged ata6bdf59. PR/main CI pass; production rescene-hl6t9hi6h-jimclydegms-projects.vercel.app is READY at rescene-eta.vercel.app. The live --presentation smoke verifies pages, theme/compact CSS and all twelve photo previews, skipping unchanged model downloads. No inference or project mutation.

## Album-first product photography and compact editors — October31

Product pages open in Album mode;3D is opt-in. Muse Image1.0 creates the album photography directly from the approved product/reference photographs: clean studio shots, alternate angles/finishes and attractive styled interiors. The primary chair has five generated photographs; each other product has three, and each scene project has two additional styling concepts. There are35 product and6 scene photographs, plus the retained original references. Captions explicitly identify AI-generated photographs and illustrative finishes/unseen details.

`scripts/generate-demo-photography.ts` uses the existing Meta `/images/edits` interface with reference photos, high reasoning and grounding tools disabled. Attempt markers precede paid submission; known attempts are reused, uncertain/failed attempts never auto-repeat. Private PNGs/provider receipts live in ignored test-results/demo-photography-v1. Explicit visual-QA cabinet corrections use separate versioned attempts/files to remove an unwanted vase fragment; earlier paid results remain private. There are no mesh renders in the album.

`lib/demo/photography.json` links each public WebP to the model, full prompt, reference path/SHA256, dimensions and output SHA256. Public photos live in `public/demo/photography`; generated studio images also provide product/catalog/cart covers. Product-page finish choices correspond to available generated photographs; scene editors retain all7–8 illustrative tints. Original geometry, textures, source projects and existing user data remain unchanged.

Collections have six named front-facing arrangements with actual placement differences. Supported vase/cabinet groups move together. Old four-slot collections remain readable; E/F default safely, only the old auto back-facing D pose is replaced, and custom poses/colors/visibility/lighting are preserved. Stable color indices keep earlier bags/variants valid.

Show item had two causes: individual inspection forced visibility, and restoring an accepted conservative footprint contact was treated as a new collision. Rendering now honors visibility in both views, accepted reference/mirrored relative poses restore safely, and genuinely new overlap poses remain guarded. Photo-mode edits return to live3D; hiding an isolated item returns to the room, with blocked-action feedback beside its controls.

Larger scene-choice photographs replace tiny previews; Workspace has an existing sample photo, six short layout chips replace diagrams/the Compare heading, and repeated post-view instructional strips are removed. Theme and saved reference-camera framing remain intact.

All215 tests, schema/lint/types and production build pass. Local presentation smoke verifies default Album mode, all workflow/product pages, delivered theme/compact CSS and all41 image hashes. Validation also covers Muse model/provenance/reference/output hashes, legacy layout compatibility, six front-facing presets, saved finish indices and hide/show in every supplied arrangement. All41 generated photographs are visually reviewed as files, including the three clean-top cabinet corrections; native browser/UI interaction checks remain unperformed. Source photos and3D assets stay unchanged; no database migration.

Release: PR33 merged ate905de3. PR/main CI pass; production rescene-3ivnqlxt1-jimclydegms-projects.vercel.app is READY and the live presentation smoke passes at rescene-eta.vercel.app, including default Album mode and all41 photo hashes. No inference was repeated during release verification.
