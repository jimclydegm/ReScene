# Meta models: capabilities and integration research

Checked against primary sources on October 29, 2026. “Documented” below means the public documentation describes a capability; it does not mean ReScene has exercised the endpoint or has account access. Implementation choices and quality expectations are our engineering judgments.

## 1. What each model contributes

| Model/tool | Documented capability | ReScene decision |
| --- | --- | --- |
| Muse Spark series | Multimodal perception, text output, tools, structured output | Core: inspect the normalized photo and propose object labels/categories |
| Muse Wonder | Reasoning, complex coding, long-running agents, computer use | Development/review or optional difficult analysis; unnecessary in the core runtime |
| Muse Image | Text/image-to-image generation and editing | Optional scene/image enhancement or replacement concept; does not output meshes |
| Muse Voice Transcribe | Speech-to-text with streaming/file paths | Implemented: prompt dictation, product search and reviewed demo commands through the batch API; Spark interprets commands |
| SAM 3.1 | Object detection, segmentation, video tracking | Core: masks for the objects selected for reconstruction |
| SAM 3D Objects | Geometry, appearance, and pose reconstruction from an image and masks | Core proposed mesh engine, through a GPU host |
| SAM 3D Body | Human body/shape estimation | Later fashion research; body estimation is not a garment reconstruction/fit system |
| Muse Glimmer | Open-weight 30B multimodal agent model, local deployment | Optional future local analysis; no need to operate a model server in the MVP |
| Muse Spark Open | Open-weight multimodal/agentic model | Future alternative inference deployment; avoid adding GPU operations for this deadline |
| Muse Code | Coding agent for terminal/CI | Development tool, separate from ReScene's runtime model usage |
| WorldGen | Text-to-navigable-world research | Excluded from the build path: official announcement says unavailable to developers |
| Meta 3D Gen / AssetGen | Research on text-to-3D assets and materials | Related research; no verified public production endpoint for this build |

The model list in the invitation is not itself proof that every model must be integrated. Confirm the final participant rules before submission. Extra models should support a user-visible feature, rather than consume the schedule just to increase a count.

## 2. Muse Spark: scene understanding

Use `muse-spark-1.3` through the Meta API. The [model catalog](https://dev.meta.ai/docs/models) documents multimodal input, text output, and structured output; it also distinguishes Standard from Contributor mode. Choose Standard for uploaded seller photos. The [Spark model page](https://dev.meta.ai/models/muse-spark) describes its image/video perception.

Proposed analysis output, validated by our service:

```json
{
  "sceneType": "bedroom",
  "summary": "A bed with a side table and lamp.",
  "objects": [
    {
      "candidateId": "candidate-1",
      "label": "table lamp",
      "category": "lighting",
      "segmentationConcept": "table lamp",
      "bbox": { "xMin": 420, "yMin": 180, "xMax": 620, "yMax": 520 },
      "support": "tabletop",
      "notes": "Partially obscured base"
    }
  ]
}
```

These are illustrative values, not a model response. Bounds are integers in the normalized image's pixel space. Supply image width/height in the prompt; clamp and validate every returned box. Candidate IDs are assigned/stabilized by our backend. Candidate boxes help review and matching; SAM provides the actual segmentation.

Use a bounded schema (at most eight proposals, at most five confirmed objects), one scene-analysis call, and a short output limit. Do not request exact metric positions, product names, brands, prices, or a full Three.js program. Reconstruction supplies poses where available; a seller corrects layout in the editor.

The [structured-output guide](https://dev.meta.ai/docs/structured-output) documents JSON-schema constraints through Chat Completions. Use the supported schema subset and independently validate values, bounds, refusal/error outcomes, and object count. A schema-conforming answer can still describe the scene incorrectly.

## 3. SAM 3.1: segmentation

The exact API model ID is **`sam-3.1`**. The marketing-page spelling `sam-3-1` is not the request ID. Use the Responses endpoint with text plus `input_image`. The [segmentation guide](https://dev.meta.ai/docs/sam/segmenting) specifies one short noun concept per request, or box/point prompts. It does not support a comma-separated object list.

Implementation consequences:

- Group candidates by concept so two lamps can share one request; then match instances by box overlap and user review.
- Request at most five concepts with concurrency two. For ambiguous instances use explicit box prompts after review.
- Associate instances using `(request/concept, returned object ID)`; IDs from separate calls are not globally unique.
- Zero matches is a valid result; show correction/exclusion instead of fabricating a mask.
- A mask is not a depth map or mesh. Keep reconstruction as its own step.

The [overview](https://dev.meta.ai/docs/sam/overview) describes special-token segmentation output in the Responses text lane. It is not ordinary JSON and not an automatic PNG URL. Use the official [client libraries](https://dev.meta.ai/docs/sam/client-libraries): `@meta-sam/parser`, `parseImageStream`, and mask decoding. Confidence support requires a compatible parser version (the guide names 0.0.13+); verify the installed version.

Decode each mask into a binary raster and encode a full-image PNG with the same orientation and dimensions as the normalized input. Persist the PNG in R2. Generate a transparent cutout separately with the mask for the editor; never resize the image without applying the same transform to masks/boxes. Test foreground polarity, raster shape, and no-match behavior with saved real fixtures.

## 4. SAM 3D Objects: the reconstruction engine

Meta's [official repository](https://github.com/facebookresearch/sam-3d-objects) and [research announcement](https://ai.meta.com/blog/sam-3d/) describe single-image reconstruction of individual objects and scene layout, including texture and pose. This is the model closest to ReScene's core promise. The official [setup guide](https://github.com/facebookresearch/sam-3d-objects/blob/main/doc/setup.md) requires Linux and an NVIDIA GPU with at least 32 GB VRAM for its documented environment. It is not a model to load inside a normal Vercel function.

The [official weights/model card](https://huggingface.co/facebook/sam-3d-objects) require access/license review. Keep the exact model/host attribution and license reference with generated assets. Do not assume the licenses of other Meta models apply to SAM 3D.

### Proposed hosted integration

The [fal API reference](https://fal.ai/models/fal-ai/sam-3/3d-objects/api) documents `fal-ai/sam-3/3d-objects`: image URL, per-object `mask_urls`, optional depth/pointmap, textured-GLB export, queued submission/status/results, individual GLBs, and per-object transform metadata. Proposed use: send the original normalized photo plus all confirmed full-image masks in one request. Keep the mask order mapped to our stable object IDs; ingest individual files into R2.

This adds **fal as a GPU inference host for a Meta model**. Spark and SAM 3.1 still run directly on Meta Model API. The public Meta model catalog checked for this plan does not establish a hosted SAM 3D endpoint under Meta Model API. Do not invent one. If participant access later exposes one with the needed outputs, evaluate that documented endpoint before introducing a second host.

### Mandatory Phase 0 experiment

Use one photo with two clearly separated objects before the full demo:

1. Generate masks through Meta SAM 3.1, save the original response and decoded masks.
2. Submit the photo and both masks to the 3D host. Save its request ID and raw result privately.
3. Confirm that two independent GLBs return, not just a combined scene or splat.
4. Verify which `object_index` corresponds to which input mask. Do not assume array order without checking a recognizable pair.
5. Load both objects in a minimal browser viewer and compare their placement to the source.
6. Determine if transforms are baked into GLBs, provided separately, or both. Document camera matrix direction, axis convention, quaternion order, scale shape, and units. Avoid applying transforms twice.
7. Normalize to our contract: right-handed, Y up, local object coordinates, a single root transform per object, approximate units. Validate bounds and pivots.
8. Record wall time, file size, charge, and quality. Test one failure plus retry using the existing request ID.

The provider schema alone cannot answer all coordinate/mapping questions. Save conclusions in this file and a small fixture report when tested. Until then, scene placement is an explicit integration risk. Do not claim automatic layout is verified.

### Fallback order

1. Retry a known submitted job by polling its existing ID.
2. Retry reconstruction for a failed object only, preserving successful objects. One-object jobs lose multi-object alignment; apply reviewed/manual placement rather than silently mixing unverified coordinate systems.
3. If a different documented host serves Meta SAM 3D with the required outputs, swap the adapter during the time-boxed spike.
4. If no viable hosted path exists, consider a short-lived GPU runner using Meta's own code only if access, cost, and setup fit the time box.
5. Offer labeled cutout/proxy fallback in the editor. A cutout-only demo does not satisfy the mesh release gate.

No new depth-estimation service or splat renderer is required for the first prototype. Multi-object reconstruction plus manual placement is a leaner starting point.

## 5. WorldGen, 3D Gen, and fashion boundaries

Meta's [WorldGen announcement](https://www.meta.com/blog/worldgen-3d-world-generation-reality-labs-generative-ai-research/) describes a research system for navigable worlds from text. It explicitly says the work is still research and is not available to developers. This rules it out as a dependency unless Meta supplies documented participant access.

Meta's [3D Gen research](https://ai.meta.com/research/publications/meta-3d-gen) covers text-to-3D and materials. A research announcement is not enough to design a production API call around it. SAM 3D Objects has a more direct relationship to our existing-photo workflow.

Meta's [SAM 3D collection announcement](https://about.fb.com/news/2025/11/new-sam-models-detect-objects-create-3d-reconstructions/) distinguishes Objects and Body. Engineering inference: human body reconstruction does not establish faithful clothing backs, fabric behavior, separate garment meshes, or a sizing/try-on solution. Furniture is the first vertical; a mannequin/garment viewer is future research.

## 6. Muse Image: optional enrichment

The [Muse Image page](https://dev.meta.ai/models/muse-image) documents generation/editing. The [API guide](https://dev.meta.ai/docs/image-generation) names `muse-image-1.0`, `/images/generations`, `/images/edits`, and Responses-based multi-turn editing. The output is an image. The guide says the compatibility `background` response is always opaque, so use SAM for transparent cutouts.

Potential post-core feature: generate an isolated alternative furniture concept, segment it, reconstruct it, and label it synthetic. A faster first replacement feature uses prepared merchant GLBs. An image edit is not an automatic material/geometry edit to an existing 3D mesh.

Background cleanup is optional reference imagery. Do not spend the schedule trying to infer a complete room behind occluded furniture. Do not use generated replacement imagery as evidence of an actual product's appearance.

## 7. Voice, open weights, and coding tools

- [Muse Voice Transcribe](https://dev.meta.ai/models/muse-voice-transcribe) is implemented through `/v1/asr/transcribe`: short-clip dictation/search plus explicit, reviewed showroom commands interpreted by Spark. No realtime WebSocket is used. See [VOICE.md](VOICE.md) for formats, language hints, receipts, guards and live evidence.
- [Muse Glimmer](https://dev.meta.ai/models/muse-glimmer): open-weight 30B agent model under Apache 2.0, intended for local use. A future local tagging assistant is plausible; serving it adds operational work that the core hosted pipeline avoids.
- [Muse Spark Open](https://dev.meta.ai/models/muse-spark-open): open-weight multimodal/agentic deployment option. It is not a mesh generator. Hardware requirements and host support need their own check before deployment.
- [Muse Wonder](https://dev.meta.ai/models/muse-wonder): higher-capability coding/agentic reasoning option. Wonder Full is described as subscription-only in Muse Code, so do not assume an API model ID grants access to it.
- [Muse Code](https://dev.meta.ai/lp/muse-code): development agent, not a backend job engine. If Jim uses it, give it this repo's context files and bounded implementation phases. Do not install or run a remote installer as part of this planning task.

## 8. Provider adapter boundaries

Use the `openai` SDK only as a client compatible with Meta's API; the service endpoint and credentials are Meta's. No OpenAI runtime key is needed for this plan.

```text
META_API_BASE_URL=https://api.meta.ai/v1
MODEL_API_KEY=<server secret>
META_ANALYSIS_MODEL=muse-spark-1.3
META_SEGMENTATION_MODEL=sam-3.1
META_IMAGE_MODEL=muse-image-1.0
META_TRANSCRIPTION_MODEL=muse-voice-transcribe-1.0
SAM3D_PROVIDER=fal
SAM3D_MODEL=fal-ai/sam-3/3d-objects
FAL_KEY=<server secret>
```

Service interfaces return our own typed outputs, not raw SDK responses:

```text
analyzePhoto(assetId) -> candidates + summary + usage + providerRequestId?
segmentObjects(assetId, reviewedPrompts) -> masks/boxes + instance mapping + usage
submitReconstruction(assetId, orderedObjectMasks) -> providerRequestId
checkReconstruction(providerRequestId) -> queued | running | done | failed
ingestReconstruction(providerRequestId) -> local GLB asset IDs + normalized poses
```

Pass asset IDs between workflow steps. Resolve fresh signed URLs immediately before a provider fetch, with enough lifetime for queue delay. Preserve response artifacts privately; redact signed URLs, credentials, and photos from ordinary logs. Version prompts and importer logic for repeatability.

## 9. Cost and latency assumptions

The [Meta API pricing page](https://dev.meta.ai/products/meta-model-api) lists Standard Spark 1.3 at $1.25/M input tokens and $4.25/M output tokens, SAM at $2.50/1,000 images, Muse Image at $0.01/image, and voice at $0.18/hour when checked. Verify dashboard pricing before use; tokenized image input and repeated concept calls matter.

Illustrative calculation, not measured usage: a Spark call with 20,000 billed input tokens and 2,000 output tokens costs `$0.025 + $0.0085 = $0.0335`. Five separately billed SAM image requests would add `$0.0125`. Add the current hosted SAM 3D charge, retries, storage, and platform usage. Do not treat an entire five-object pipeline as one billed image without checking the host's billing unit.

The host's public model pages contain differing price references, so this plan does not pin a GPU price. Record the actual quoted unit/rate and observed job cost in Phase 0. Credits and free-tier availability are account-specific, not guaranteed.

Proposed UX targets: photo preview immediately, first analysis/review within 60 seconds when available, full 3–5 object scene within five minutes on the selected demo input. These are targets to measure, not provider SLAs. Use an eight-minute initial run deadline; allow a retry of known jobs rather than guessing completion.

## 10. Observed access during foundation setup

Meta's authenticated `/models` read succeeded with Spark 1.3, SAM 3.1, Muse Image, Voice Transcribe, and Wonder listed. A fal queue-status read returned the expected missing-job response. No paid inference was submitted. These checks establish discovery/endpoint access, not segmentation quality, GPU entitlement, object mapping, or a successful reconstruction; the live Phase 0 experiment remains required.

## 11. Code preparation, October 29

Jim requested code preparation only; no paid model call is approved. The synthetic bedroom input was normalized to 1536×1024 and uploaded privately to the experiment namespace. The spike intentionally uses local checkpoints/R2 without touching application Scene/GenerationRun records.

- `analyze.ts` uses Standard Spark Chat Completions with JSON Schema, a 4096-output-token cap, runtime bounds/ID checks, and no automatic retry.
- `segment.ts` uses Responses streaming plus installed `@meta-sam/parser` 0.1.0. The parser's `bounds` refer to the source-pixel crop; the decoded raster is placed into a full-frame black/white PNG. Empty/malformed/out-of-bounds masks stop that path. Both request-local and application candidate IDs are preserved.
- The checked fal types describe `individual_glbs`, `metadata.object_index`, nested scale/translation arrays, and quaternion `[x,y,z,w]`. These are documented contracts, not observed coordinate/baked-transform behavior.
- The [fal model page](https://fal.ai/models/fal-ai/sam-3/3d-objects) currently shows $0.02/unit/generation; the effective multi-object/textured-job billing and account balance have **not** been verified. The CLI reserves $1.00 for the first reconstruction as a conservative experiment allowance. This is not a guaranteed provider-enforced charge cap.
- Meta's [pricing page](https://dev.meta.ai/products/meta-model-api) still lists Spark 1.3 at $1.25/M input and $4.25/M output, SAM at $2.50/1k images. The runner conservatively reserves $1.40 for analysis (full context plus bounded output) and $0.0025 per SAM concept; it retains reservations for ambiguous attempts.

The private CLI checkpoints before paid submission, saves a returned reconstruction request ID before polling, freezes selections, requires a consistent explicit budget, and disables fal automatic retries. A lost submission response stays STARTED and requires manual reconciliation. Full end-to-end execution, cost accounting, instance quality, file-to-mask mapping, transforms, importer normalization, and independent browser movement remain untested. See [SPIKE.md](SPIKE.md).


## 12. Live development results, October 29

Jim approved a $10 total development inference cap, replacing the earlier code-only instruction. Spark identified all four objects in the synthetic bedroom. The CLI segmented a nightstand and chair and ingested two independent textured GLBs (1,175,784 and 1,490,588 bytes); texture inspection matches wood drawers and mustard upholstery. No GLB node transforms were present; Y-axis geometry bounds were consistent with upright objects, but a complete visual transform/importer check is still pending.

The local app and a fresh production app run independently produced bed/chair/nightstand masks and three real object GLBs. Production analysis/masks completed in 28.8 seconds; reconstruction/ingestion in 93.7 seconds. The app uses approximate bottom-center manual stage placement rather than unverified provider poses. Signed downloads/CORS and persistent transform API checks pass. Browser appearance/interaction and real-photo quality remain unverified because Work browser control is disabled.

An earlier production SAM request rejected a signed R2 image URL with HTTP 400. The app now sends bounded inline normalized bytes to Meta; a direct diagnostic and the fresh production run succeeded. The rejected attempt was manually reconciled to a conservative $0.02 reserve from observed Spark usage plus one SAM-image allowance, with an audit note retained. Provider invoices/actual GPU charges have not been read; global conservative reservation controls remain below the approved cap.


## Observed pose contract and room composition — October 29

The two-object combined GLB contains the SAME centered vertices as the independent GLBs, with no per-node transforms. Do not assume `model_glb` bakes scene placement. The saved metadata supplies per-object translation, scale, and rotation; `camera_pose` was null.

The fal reference labels quaternion XYZW, but Meta's [SceneVisualizer](https://github.com/facebookresearch/sam-3d-objects/blob/main/sam3d_objects/utils/visualization/scene_visualizer.py) uses PyTorch3D WXYZ and [compose_transform](https://github.com/facebookresearch/sam-3d-objects/blob/main/sam3d_objects/data/dataset/tdfy/transforms_3d.py) applies row-vector rotation. [GLB export](https://github.com/facebookresearch/sam-3d-objects/blob/main/sam3d_objects/model/backbone/tdfy_dit/utils/postprocessing_utils.py) separately rotates Z-up geometry to Y-up. For our observed output, the Three.js rotation is `Ry(pi) * inverse(q_meta_WXYZ) * Rx(pi/2)`; translation is `[-tx, ty, -tz]`, and scale axes become `[sx, sz, sy]`. Quaternion outputs thereafter use Three.js XYZW. The importer validates finite normalized poses, positive scales/depth, image bounds, and upright floor axes. A changed/unsupported convention is rejected instead of silently applying a sideways mesh.

Apply one scene-wide unit factor, ground leveling, and a common camera; do not normalize each mesh's size independently. A coarse focal fit uses projected GLB bounds and the source image rectangles. Saved three-object QA poses produce ~0.0137 normalized-frame edge RMSE before floor-contact correction (about 1.4% of the frame); this compares coarse bounds with AI boxes, NOT ground-truth geometry or visual fidelity. The two-object fixture is ~0.0178. Browser appearance remains unverified because local browser control is disabled.

`room-and-objects-v2` adds bounded environment observations to the existing single Spark request: base colors, floor material, broad lighting, and side wall. The schema/prompt are implemented and validated locally; this revised prompt has NOT been sent to Meta yet. No new paid call was made for composition work. Older scenes use photo-region median colors with plain floor/diffuse neutral lighting; detailed room textures, exact geometry, windows, and illumination are not recovered. SAM 3D Align's documented purpose is fitting a BODY mesh into an object/MoGe frame; it is not a general room generator and is not added here.


## Live room-analysis and visual verification follow-up

After Jim removed the app cap on October 29, `room-and-objects-v2` passed on production. The observed environment was floor `#D9C1A3`, wall `#E9E1D4`, wood, warm left light, and left side wall. Spark usage: 2671 input/1552 output tokens, recorded estimate $0.0099, plus three SAM image calls at $0.0025 each. These are app estimates, not provider invoices. SAM accepted bed/nightstand masks but returned NO_MATCH for `armchair`; the review UI disabled that candidate and reconstruction used only the two accepted masks.

Browser access is now enabled. Saved three-object poses are upright with relative sizes/depth and floor contact; object selection/hide/reload and mobile reference/confirmation dialogs were inspected. SAM exported materials omit metallicFactor, whose glTF default is 1. The preview clones and defaults unspecified generated materials to a dielectric surface (metalness=0), preserving explicit factors/maps. This corrects blackened wood/fabric without changing stored GLBs. Full room textures, precise wall boundaries, windows, physical lighting, and real-photo quality remain gaps.

The earlier $10/$7.50 reservation caps are historical: Jim explicitly removed the cumulative app limit and authorized further focused testing. Provider balances/limits and separate fal billing still apply; recorded request/usage history is retained.


## Texture fidelity investigation — October 29

ReScene already sends export_textured_glb=true. Read-only inspection of five saved objects across two non-QA bedroom scenes confirmed embedded 1024×1024 PNGs, TEXCOORD_0 and baseColorTexture bindings; no vertex colors. The viewer retains those maps when cloning materials. Texture presence is verified; exact photo likeness is not.

The [fal schema](https://fal.ai/models/fal-ai/sam-3/3d-objects/api) exposes textured export but no texture-resolution/source-projection setting. Meta's [exporter](https://github.com/facebookresearch/sam-3d-objects/blob/main/sam3d_objects/model/backbone/tdfy_dit/utils/postprocessing_utils.py) bakes renders of its generated appearance representation; the [pipeline call](https://github.com/facebookresearch/sam-3d-objects/blob/main/sam3d_objects/pipeline/inference_pipeline.py) specifies 1024 texture size. This does not directly copy observed source pixels at export or guarantee recovered grain/weave. Larger atlases alone do not restore absent details. Muse Image is documented for 2D reference/editing, not a mesh UV-baking endpoint.

The proposed source-photo projection and UV bake are separate graphics work using Meta geometry/masks, with visibility/occlusion/camera checks and SAM appearance on unseen surfaces. It is not implemented or validated. [TEXTURE_FIDELITY.md](TEXTURE_FIDELITY.md) records the recommended experiment and privacy/persistence constraints. No paid requests were made during this investigation.

## General scene controls (supersedes room-first prompt) — October 29

`scene-products-v3` analyzes arbitrary scenes/products/outfits and accepts clothing, footwear, accessory, person, vehicle, plant, electronics and other categories alongside historical furniture categories. Focus, maximum candidates (1–5), and bounded subject instructions are captured per run. Manual additions (up to ten candidates per scene) do not depend on Spark detecting an item. The mesh selection remains at most three per reconstruction.

Verified against [Meta's segmentation documentation](https://dev.meta.ai/docs/sam/segmenting): requests use either one short noun phrase OR box/positive/negative point grammar, never both. The installed buildObjectPrompt helper converts our half-open pixel boxes into the provider's inclusive coordinates. All prompts use the exact normalized photo frame; off-frame/empty/negative-only prompts are rejected before submission. include_confidence=true and one_bit masks remain enabled. No documented image detection-threshold tuning is added to the direct Meta API; the UI confidence filter only filters saved matches and costs no inference. The fal detection_threshold setting is for its own automatic segmentation and would not tune our supplied masks.

Independent explicit SEGMENT_OBJECT retries call SAM once without Spark, preserve other candidates and keep a previous accepted mask on failure. Multiple results are retained for explicit instance selection; mask union supports multi-part products such as a pair of shoes with no additional inference. Provider failures remain charged/uncertain where applicable and are never auto-resubmitted. Reconstruction seed is the supported fal parameter; export_textured_glb stays enabled.

Live clothing correction: the prior room prompt produced zero candidates (SAM never ran). One corrected Spark call found the T-shirt/shorts/sneakers; three SAM text calls returned 1/1/2 masks. A no-inference union accepted both shoes as one item; one further SAM spatial request using a box and include/exclude points returned a valid shirt mask. Other accepted masks were unchanged. These observations validate segmentation controls, not garment fit/unseen geometry or final render quality.

## Complete-subject correction (supersedes product-only extraction)

See [SCENE_UNDERSTANDING.md](SCENE_UNDERSTANDING.md). scene-assemblies-v4 discovers roots and product parts automatically; parentObjectId/assemblyRootId, shared original mesh ID and partition version live in existing private provenance JSON. ReconstructionRun input freezes selected entries and the root IDs actually submitted to fal. No SQL migration is required. Root reconstructions are partitioned into disjoint selectable triangle regions, retaining source UV/materials and a shared pose; failed partitions keep the complete root. Group edits, matching, catalog guards and complete-assembly publication honor those relationships.

The direct SAM decoder now scales a raster into its source-coordinate box. Automatic shoe union and region disambiguation reuse returned masks. The floor is a conservative lower geometry envelope, with optional floorY in composition/publication v2. Ten render entries are supported; this is an internal resource bound, not a user item-count question. Whole human appearance was tested using the existing SAM 3D Objects provider. SAM 3D Body and Align were researched but not integrated; anatomy/fit and unseen detail remain approximate.

## General scene quality correction — October 30

See [SCENE_QUALITY.md](SCENE_QUALITY.md). scene-relations-v5 adds broad categories and validated supportedByCandidateId, separate from attached parentCandidateId. Relationships persist as private supportedByObjectId; no migration. Contact settling uses support-top/shared-plane estimates and actual vertex-bottom refinement. Shared part geometry retains its root baseline.

Photo transfer supports up to ten meshes, original-root camera calculation, bounded silhouette registration and up-to-2K source-pixel bakes. Existing photo-bake-v1 restore data is retained, with method=registered-2k-v2; refreshed bakes derive from immutable originals. Optional CPU-only post-ingest transfer runs once and cannot trigger inference resubmission. Public asset boundaries remain unchanged. Body and Align were tested as private experiments; returned GLBs lack UVs/textures, so they are not automatically used to replace textured subjects or solve arbitrary object contact.

## Implemented background model use — October 30

Muse Spark general analysis now includes observed open/plane/distant background structure. Legacy scenes use a small background-only structured call (4096 output allowance, low reasoning effort). Muse Image muse-image-1.0 performs one reference edit per explicit background refresh or optional post-reconstruction background step, through Meta JSON /images/edits with two input images and search/shell tools off. The API rejects mask parameters, so ReScene enforces its SAM removal footprint and preserves unmasked source pixels itself. Raw results stay private; only the composited derivative can publish. Both clients and workflow steps disable automatic paid retries. See official https://dev.meta.ai/docs/image-generation and BACKGROUND_RECONSTRUCTION.md.

## Plain-background / hollow topology investigation — October 30

Plain RGB preflight skips background inference for high-confidence constant fields, ignoring minority cast shadows. `plainColor` is generated locally and omitted from Meta strict structured-output schemas. SAM 3D's hosted API exposes no mesh-resolution, topology or inference-step quality parameter. Supplied masks bypass text-driven detection; detection threshold is not a mesh quality control. An optional pointmap requires a correctly registered same-camera depth source, which is not integrated.

One same-seed experiment refined four bright enclosed background gaps in the shoe mask. Geometry remained inaccurate; the existing model was kept. Provider-only mask refinement is experimental/off by default, leaves accepted outlines unchanged, and can also exclude those pixels from source texture transfer when enabled. It is not proof that hollow geometry is faithfully recovered. See BACKGROUND_RECONSTRUCTION.md for official links and evidence.

## Assembly/reference review correction — October 30

Analysis prompt v8 distinguishes already represented product regions from separate support objects, including removable components without a subject/category restriction. A supported-mask containment check can promote a region to the existing shared-root path before reconstruction. Runtime providers remain Meta Spark/SAM plus Meta SAM 3D via fal; no model is substituted.

The new reviewer is bounded CPU geometry work against Meta-reviewed masks, not another paid image judge or regeneration loop. It measures actual mesh silhouette overlap after placement/contact, improves transforms when supported by that measurement, and flags unresolved shape differences. It cannot certify texture similarity, correct hidden geometry, metric depth or garment fit. No inference was submitted to repair the reported bedroom.

## Composition controls rechecked — October 30

The official [Muse Image guide](https://dev.meta.ai/docs/image-generation) documents multi-reference edits and reasoning_strength=high for internal refinement at the same per-image price; no negative_prompt parameter is documented. ReScene puts exclusions in the main prompt, passes the actual empty setting image (previously only its text description), disables unrelated search tools, and records the effective v3 request. One bounded Spark check flags inventory/crop/relative-scale/support/major setting changes. It is an approximate visual check, not proof of measured product scale or identity. Explicit correction is another paid image call and retains all earlier results.

The [fal Objects schema](https://fal.ai/models/fal-ai/sam-3/3d-objects/api) still exposes seed, masks, pointmap and textured export, with no geometry-quality or mesh-detail setting. Its prompt/detection_threshold operate on auto-segmentation when masks are absent; they do not refine geometry for our accepted-mask path. A user-selected retry changes seed and uses corrected accepted masks, not an invented negative/topology parameter. New candidates must improve fixed-camera mask overlap before replacing an existing mesh; this cannot certify hidden geometry.

## Meta VGGT environment depth

The default planar background workflow calls hosted `fal-ai/vggt-1b` with one source photo and raw prediction export. It decodes depth/confidence/intrinsics, removes the 518-square/14-pixel loader padding and fits geometry in the saved SAM scene camera/frame; it does not load VGGT's point cloud as a room model. Completed and unfinished same-photo jobs are reused. No new key is needed beyond existing FAL_KEY, and polling never resubmits. Muse Spark plans every visible surface/opening and reviews the empty atlas; Muse Image makes one clean intrinsic background fill. Remaining review notes stay visible. Exact parameters, source links, storage/privacy and checkpoint-label limitation: REFERENCE_ENVIRONMENTS.md.

## Strict analysis contract correction

`scene-observations-v9` sends an explicit background observation schema (kind, groundVisible, boundary, description), never renderer geometry/material state. A local validator checks Meta's strict required/additionalProperties rules before dispatch. Request receipt/raw response persistence precedes analysis parsing. HTTP400 rejection is reported distinctly from a lost response; uncertain attempts remain protected against paid resubmission. Source: https://dev.meta.ai/docs/structured-output. The prior shared-schema regression was reproduced as HTTP400: missing geometry in the required array, rather than an inference timeout.

The first corrected live schema request returned `finish_reason=length`: 4,094 of its 4,096 completion tokens were reasoning, with no answer content. Analysis now explicitly uses `reasoning_effort=low` and `max_completion_tokens=8192`; completion-limit receipts get ANALYSIS_OUTPUT_LIMIT rather than a connection warning. The next bounded saved-photo request returned eight candidates. No automatic retry loop is added.
