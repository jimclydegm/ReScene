# Demo material and environment refinement

November 3, 2026. This pass updates the Reading Corner, Sunday Living Room and Seating Collection. Their source photographs, saved SAM selections, prices, product identities, mesh vertices, UV coordinates and placement transforms remain unchanged.

## Materials

Muse Spark reviews the original photo, object mask and six rendered views to plan materials. Muse Image supplies twenty reviewed material swatches. The approved output uses those swatches in ten existing Meta SAM 3D Objects meshes; the gray molded chair retains its appropriate smooth finish. The baker maps all sides, including backs and undersides, into the original UV atlases. Geometry is compared before and after export; mapped surface coverage is complete for these ten derivatives.

The shared seam blender previously sampled outside UV islands, allowing unused dark atlas pixels to become lines on cloth. It now samples painted pixels inside the owning triangle. A regression test fails on the previous implementation and passes with the correction. Optional reviewed world-space material boundaries also keep fabric bodies separate from wooden feet, including triangles that cross a boundary. Explicit grain axes support reviewed wood alignment.

Curation uses one consistent material for each of the five single-finish wooden products. This avoids assigning almost identical swatches to alternating triangles. Old baked shading is excluded from these new albedos. Fine woven swatches are filtered before baking to avoid alias patterns; the output atlases retain their existing 2048-pixel dimensions. Stitching remains in the geometry rather than being copied through an unreliable photo projection. Printed markings retain the existing protected-detail policy.

## Environments

Three Muse Image floor materials and two complete window images are independently reviewed by Spark. Floors use orthogonal world-space tiling. Plain painted walls stay plain. Each window has its own atlas rectangle, a rectangular wall opening, side reveals, a sill and a center frame, so the photo's cropped edge is not treated as the physical window edge. The reviewed rectangular-opening helper rejects multiple openings on the same plane instead of silently closing another opening. This curation does not assume every possible window is rectangular.

A shared clearance correction attaches baseboards and window trim to their wall by geometry rather than material index. Differently painted baseboards now follow their wall when clearance changes. The demo floor, wall bottoms and baseboards meet at a consistent height.

Window completion and unseen materials are plausible reconstructions, not recovered measurements or verified hidden detail. A single photo still cannot establish the exact rear geometry of a product or a complete room.

## Shopping UI

Individual product views use a bounds-fitted camera with space around the whole object. Thumbnail wells use contained product photographs, including replacement selection and shopping-list dialogs. Shop the Scene has a taller details panel and a compact description/replacement row. Build your Space's styled-room link retains the selected collection.

## Persistence and verification

Approved model derivatives are immutable R2 assets linked from the ten SOURCE catalog listings. Merchant fields, product photographs and galleries are preserved. The three environment atlases are also registered as approved demo-only assets. Original source Scene and SceneObject records are checked unchanged. The frozen demo snapshot, canonical catalog and hash-verified public judge release use the new model digests; old immutable files remain available for rollback. No migration is needed.

Private receipts, original snapshots, six-view renders and native screenshots live in ignored `test-results/demo-polish-nov3/`. They are not public setup dependencies. Ordinary users and judges load the prepared assets without new inference. Paid curation scripts require the existing Meta credentials and durable receipt files; they are not part of judge setup.

Local checks: 403 tests, schema validation, lint, typecheck and production build; all 162 shopping pages; ten new model hashes and three atlas hashes. Native Chrome checks cover the three collections, window orbit, product framing, contained thumbnails, recolor/Undo and original-photo mask selection. Release/production verification is recorded in CONTEXT.md after deployment.

Read-only release commands:

```sh
node scripts/verify-demo-examples.mjs --ui
node scripts/verify-refined-demos.mjs
```

Set `DEMO_BASE_URL` to the deployed application for the same checks.
