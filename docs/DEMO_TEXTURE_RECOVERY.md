# Reference texture recovery

November 3, 2026. The previous demo refinement made upholstery flatter and shifted the apparent color away from the reference. Its curated bake disabled both provider detail and source-photo detail, and reduced fabric swatches to512 pixels. Full UV coverage and lower seam contrast passed, but those checks did not establish reference fidelity.

The ten changed products in corner/living/chair-studio now use their approved pre-refinement reference textures again. This restores the photographed weave, grain, construction detail and color across product pages, Build Your Space, Shop the Scene and catalog replacements. The other126 catalog models are unchanged. Geometry, transforms, prices, photo albums, masks, backgrounds and UI framing are retained. Old immutable files remain available.

The shared baker now treats provider-detail suppression independently from source-photo blending. `preserveProviderDetail:false` removes old generated-atlas shading without forcing the requested photo blend to zero. Explicit zero blend still works; protected markings keep their existing source policy. A regression test covers observed/reference detail and explicit zero. The curation recipe uses1024-pixel fabric swatches and an explicit85% source blend. It still requires manual approval before export.

A new experimental rebake reduced the reference-camera color error for all three scenes, but showed uneven transitions on the chair. It was rejected instead of released. The deployed demo recovery uses the previous approved assets, not that experimental rebake. Lower color error or complete UV coverage alone is insufficient acceptance evidence; compare source/old/new in the reference view and inspect side/back material continuity before promoting another bake.

The existing quality pipeline retains numeric reference comparison, placement checks and per-object rollback. Single-photo unseen materials remain approximate. No new inference, source-project rewrite, migration or model-provider change was used for this correction.

Verification:404 tests; schema/lint/typecheck/build;136 catalog records with only ten model digests/sizes changed; original-vs-recovered geometry/UV equality and approved asset hashes. Local/deployed page and asset checks are recorded in CONTEXT.md. Private comparisons and rejected candidates remain ignored under test-results/texture-fidelity-fix.
