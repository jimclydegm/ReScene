# Texture fidelity: feasibility and proposed implementation

Researched October 29, 2026. This is a proposed quality phase, not implemented photo-to-mesh texture transfer. No inference was submitted and no application code changed during this investigation.

## Finding

Meta SAM 3D Objects reconstructs appearance as well as shape. ReScene already requests `export_textured_glb: true`. The current [fal input schema](https://fal.ai/models/fal-ai/sam-3/3d-objects/api) says that option exports baked textures and UVs rather than vertex colors. Switching it on again will not solve the reported mismatch.

Read-only inspection of two saved non-QA bedroom scenes found five object GLBs with embedded 1024×1024 PNGs, baseColorTexture bindings, and TEXCOORD_0 UV coordinates. Their textures were roughly 0.94–1.07 MB each; no vertex-color attributes were present. The viewer loads them through Three's GLTFLoader and preserves their maps when cloning materials. This establishes texture presence, not perceptual fidelity or a guarantee against a GPU/display bug in every scene.

Meta's [export source](https://github.com/facebookresearch/sam-3d-objects/blob/main/sam3d_objects/model/backbone/tdfy_dit/utils/postprocessing_utils.py) renders the generated appearance representation from multiple views and bakes those renders into an atlas. It does not directly transfer the original photo's visible pixels at this export step. The [pipeline](https://github.com/facebookresearch/sam-3d-objects/blob/main/sam3d_objects/pipeline/inference_pipeline.py) calls this exporter with texture_size=1024. The hosted fal schema currently exposes no texture-size/quality or source-reprojection setting. Do not invent such parameters or assume doubling an output atlas restores missing information.

The [official model description](https://github.com/facebookresearch/sam-3d-objects) supports shape/texture/layout reconstruction, not exact reproduction of wood grain, fabric weave, logos, or unseen surfaces. Material roughness, normals, reflections and illumination are also different from a color image; one lit photo does not uniquely determine them.

## What is already planned

Generated textured objects are part of reconstruction today. Detailed floor/wall texture recovery is an unchecked room-quality gate. Explicit transfer of source-photo detail onto object meshes was missing from the phased plan; Phase 3.6 now records it before the product/sharing phase. The existing simple room shell uses estimated colors/material hints and broad lights, not recovered floor grain or wall imagery.

Muse Image supports [reference-based generation and editing](https://dev.meta.ai/models/muse-image). It could help fill a clean room background or invented unseen texture, but its output is a 2D image, not an automatically UV-mapped mesh/material package. Do not use image generation as proof of preserving the exact product pattern. Keep visible source details when available; treat generated completion as inferred.

## Recommended sequence

### 1. Separate display errors from missing source detail

Start with the simpler chair/cabinet/vase image and one accepted mesh. Reuse saved geometry/masks; no new paid reconstruction is required for the first checks.

- Record image size, UV presence, material bindings and decoded map dimensions during ingestion; distinguish absent textures from present low-fidelity textures.
- Compare the source crop, embedded atlas, an unlit textured render, and the normal lit render from the same fitted camera. A neutral/unlit comparison identifies lighting/tone-mapping issues before trying another model.
- Inspect color-space handling and texture sampling at real display size. Installed GLTFLoader assigns base-color maps sRGB and flipY=false. Preserve those conventions; avoid a second manual conversion. Do not modify shared cached materials.
- Preserve the existing correction for omitted metallicFactor: glTF defaults it to 1, which darkened generated fabric/wood without reflections. Keep explicit factors/maps unchanged.

Pass: identify whether lost detail is already absent in the stored texture or is lost only in rendering. Audit mode is proposed; only the GLB/container and code inspection above has been completed.

### 2. Prototype source-photo projection on visible surfaces

Engineering recommendation: retain SAM geometry/appearance, then transfer the observed photo detail onto only visible, reliably aligned mesh surfaces. This is a graphics step in addition to Meta inference, not a new Meta model capability.

Use the initial reconstruction transforms, fitted source camera and reviewed full-frame mask. Freeze those transforms when projecting. Render the original reconstructed scene depth/object IDs from that camera; reject pixels occluded by another surface/object, outside the object's mask, outside the frame, behind the camera, or on grazing/back-facing faces. Test self-occlusion as well as cross-object occlusion. Blend/feather the accepted source samples into the existing SAM texture; use generated SAM appearance on unseen or uncertain texels.

The initial prototype can use a custom Three.js projection shader in the private editor to assess alignment. Source lookup must use the INITIAL model-to-camera transform, not the current edited world transform; otherwise the texture slides when furniture moves. Incorrect shape/camera estimates cause seams, stretching and wrong correspondences. Reject poor alignment and retain the original SAM appearance instead of forcing a bad projection. A small bounding-box reprojection error is not sufficient evidence that detailed surfaces align.

Pass: the cabinet's visible grain and chair's visible fabric match the reference better at the source view, remain attached during move/rotation, and do not pull in wall pixels or another object. Inspect oblique views and silhouette borders, not just a front-view screenshot. This is feasible in principle but remains untested on our meshes.

### 3. Bake the accepted result for persistence and sharing

Bake the projection into the existing mesh UV atlas and embed the resulting image in a new GLB. Preserve the old GLB as an optional restore source; never overwrite a READY artifact. Start at the existing resolution and test 2K only if source pixels/UV coverage support a visible improvement. Increasing atlas size cannot create real detail absent from the source/model.

A bounded browser WebGL bake/export is the lean first implementation candidate; measure time, memory and encoding before choosing a server GPU job. Vercel need only reserve/sign/validate the new asset and commit the revision-aware model reference. Upload through private R2 signed PUT, validate the resulting GLB, keep the geometry/baseline transforms unchanged, and record model/photo/mask IDs plus bake/camera versions in provenance. Reuse MODEL_GLB with an embedded texture rather than introducing a texture-storage service or a new database table.

Use an orientation-correct, metadata-stripped higher-resolution source if needed. The current processing image is max1600 WebP quality82; EXIF/orientation and image-size conversion must match the existing mask coordinates. Bound decode pixels, texture size, byte size and supported WebGL devices; retain the original mesh if the bake fails. A new output commits only if the scene revision/model still matches its input.

**Privacy requirement:** an anonymous viewer must NOT receive the full source photo as a shader texture, even if the shader displays only part of it. Bake approved object-only pixels into viewer assets and keep source/masks/raw responses private. Signing a whole source image would expose it to download. Public snapshots must reference the accepted baked GLB, not an editor-only projection shader.

Pass: save/reload/export preserves the appearance; source photo access is unnecessary for the viewer; movement/replacement and immutable publication do not undo the bake or expose raw media.

### 4. Improve room surfaces separately

Use reviewed floor/wall masks and fitted room planes. Extract clean visible patches; optionally evaluate Muse Image editing to remove furniture/fill missing regions with an explicit generated-content designation. Project/bake the clean surfaces onto planes and check that moved/hidden objects do not remain painted into the room. Do not attach the untouched room photo as a backdrop. Scene geometry and recovered lighting remain approximate.

## Boundaries and fallback

Exact backside patterns, folds, specular response and hidden surfaces cannot be copied from a single photograph that does not show them. Additional source views or merchant-supplied models/materials are the route to higher confidence; they are outside the lean single-photo prototype.

Keep existing textured GLBs usable throughout this work. Stop after a one-object quality experiment if projection artifacts outweigh detail gains; do not replace independent editable meshes with a combined splat/world solely for photo resemblance. Splats returned by the current provider can be an optional appearance diagnostic, not a substitute for the edit/product-link requirements.
