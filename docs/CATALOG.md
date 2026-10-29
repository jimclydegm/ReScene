# ReScene demo catalog

The three catalog models and SVG illustrations are original procedural works authored for ReScene in src/lib/scene/catalog.ts. These generated demo assets are dedicated to the public domain under CC0 1.0. They contain no external textures/models, brand replicas, commercial listings or invented prices. This dedication applies to the generated demo assets, not uploaded source photos or the entire application.

Seed one authorized READY scene with:

`CATALOG_SCENE_ID=<scene UUID> node --conditions=react-server --import tsx scripts/seed-catalog.ts`

The same fixed seed function backs Products → Add demo catalog for newly reconstructed scenes. No arbitrary GLB/file input is accepted. Seeding stores six private immutable R2 assets and three per-scene Product templates. Scene revision increments on first seed, so stale editors must reload. A concurrent failed seed can leave private orphan R2 bytes; automatic cleanup remains disabled.

Replace saves immediately. Save draft edits first. A placed product is a copy, so seller changes leave templates unchanged. Restore original object recovers the original mesh/card/baseline rather than the immediately preceding catalog choice; current position/yaw/scale/visibility stay. Restoring source photo layout/textures while a replacement is active is blocked to prevent projecting original pixels/poses onto different geometry. Restore the originals first; lights remain editable.
