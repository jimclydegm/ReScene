# Meta models in ReScene

ReScene calls Meta Model API directly for scene understanding, segmentation, image generation and speech transcription. fal hosts the reconstruction and depth models. Third-party infrastructure is separate from the model author.

## Runtime models

- **Muse Spark 1.3 (`muse-spark-1.3`)** identifies objects and support relationships, plans/reviews structure and materials, interprets voice edits and shopping goals, and ranks affordable candidate combinations. [Analysis adapter](../src/lib/ai/analyze.ts), [stylist adapter](../src/lib/ai/shopping-stylist.ts), [environment analysis](../src/lib/ai/environment.ts).
- **SAM 3.1 (`sam-3.1`)** creates object masks, including text/box/point refinements. It does not create meshes. [Segmentation adapter](../src/lib/ai/segment.ts).
- **Muse Image 1.0 (`muse-image-1.0`)** generates product/scene photographs, empty-background plates and material samples. ReScene maps those samples onto geometry; the image model does not output a UV-correct 3D asset. [Environment generation](../src/lib/ai/environment.ts), [image/background operations](../src/lib/ai/background.ts), [sample generation](../scripts/generate-example-images.ts).
- **Muse Voice Transcribe 1.0 (`muse-voice-transcribe-1.0`)** transcribes reviewed speech for prompts/search/scene edits. Spark handles interpretation after transcription. [Transcription adapter](../src/lib/ai/transcribe.ts).
- **SAM 3D Objects (`fal-ai/sam-3/3d-objects`)** reconstructs textured meshes and approximate pose metadata from an image and masks. [Host adapter](../src/lib/ai/sam3d.ts), [generation service](../src/lib/services/generation.ts), [provider documentation](https://fal.ai/models/fal-ai/sam-3/3d-objects/api).
- **VGGT1B (`fal-ai/vggt-1b`)** supplies original/empty-background camera and depth evidence. VGGT is Oxford/Meta research, not a Muse model. ReScene aligns this evidence to the foreground coordinate frame and constructs connected surfaces. [Depth service](../src/lib/services/background-environment.ts), [clean depth](../src/lib/services/environment-surfaces.ts), [upstream](https://github.com/facebookresearch/vggt), [provider documentation](https://fal.ai/models/fal-ai/vggt-1b/api).

The `openai` npm package is an OpenAI-compatible SDK configured with `https://api.meta.ai/v1`; ReScene does not use it to call an OpenAI model. WorldGen, SAM 3D Body/Align, Muse Glimmer and Muse Spark Open are not runtime integrations. Development assistance is separate from runtime model use; no claim that the application implements those agents is made.

**Shop in 2D** reuses saved SAM 3.1 segmentation for 39 products across 11 approved reference photographs. Browsing does not call segmentation again. Twenty-eight additional Muse Image alternate-angle photographs complete the pictured products' galleries; these are generated photographic concepts, not mesh screenshots or verified unseen views. [Photo-shopping workflow](PHOTO_SHOPPING.md).

## What application code contributes

Model outputs are validated before use. Deterministic code handles source privacy, mask matching, durable job receipts, shared coordinate transforms, support/wall clearance, conservative mesh repair, material baking, scene editing and immutable publication. The stylist does not invent merchandise or calculate prices: code enumerates compatible, budget-valid combinations and checks kept/owned products and placement; Spark ranks only the accepted candidates. Applying a look creates one undo entry.

[Original versus clean depth selection](../src/lib/scene/environment-selection.ts), [background clearance](../src/lib/scene/environment-clearance.ts), [material pipeline](../src/lib/quality/pipeline.ts), [shopping validation](../src/lib/shopping/engine.ts), [snapshot publication](../src/lib/services/publication.ts).

## Reproducibility and scope

The committed showroom records names, specifications, prices, immutable model digests, model placement and approved photo provenance. The local sample release contains only the same public derived GLBs. Full private source photographs, original masks and raw provider receipts remain private; the 2D showroom publishes only approved photos and bounded derived selection overlays. Sample playback is not represented as fresh inference. [Assets and attribution](ATTRIBUTION.md).

Single-view reconstruction is approximate. Hidden geometry/material detail is inferred; it is not a measurement, identity match or physical-fit guarantee. Color controls are preview tints, not proof of manufacturer variants. Generated image resolution and atlas dimensions are different quantities.

## Hosted model transparency

The named runtime endpoints above are verified in the source. The fal SAM 3D schema also exposes a default safety checker; the repository cannot establish every auxiliary hosted component or the precise VGGT checkpoint from the endpoint name alone. Organizer/provider confirmation of those details remains a submission review item. Safety checks have not been disabled. VGGT's upstream distinguishes original and commercially licensed checkpoints; do not infer a broad commercial license from the research name or redistribute its weights through this repository.
