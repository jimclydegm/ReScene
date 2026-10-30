# Photo-matched backgrounds

October 30, 2026. This corrects invented side corners and missing background texture for arbitrary subjects and environments, not a desk-specific preset.

## Model roles and diagnosis

The old renderer constructed a finite floor/back wall, baseboard and sometimes a side wall without evidence for those boundaries. Repeated small photo patches lost the source background's layout, lighting gradients and distant scenery.

[Muse Image](https://dev.meta.ai/docs/image-generation) supports reference-image editing through Meta's JSON `/images/edits` endpoint, but currently rejects an edit mask parameter. ReScene supplies an original plus a magenta removal guide and composites the returned fill under its own mask. Known source pixels outside the removal footprint remain unchanged. Search/shell tools and automatic retries are disabled. Requested aspect ratio follows the source; changed framing is rejected.

Spark provides observed background structure; SAM 3.1 masks identify foreground; SAM 3D Objects reconstructs meshes. Body/Align do not solve this background problem. WorldGen still has no verified developer API. No new provider, depth service, database migration or GPU deployment was added.

## Implemented flow

1. `scene-background-v6` retains general object/support analysis and adds a background plan: seamless/open, observed wall/support planes, or distant/complex context; visible ground/support, optional normalized left/right seam heights and a description. Product categories never decide background structure.
2. After mesh ingestion and object-detail transfer, one durable step attempts the background. Existing scenes expose **Textures → Build/Refresh photo background** as a separate `IMAGE_EDIT` run. Legacy scenes receive background-only Spark analysis without replacing objects/masks. Spark reasoning consumes output tokens, so this structured task allows 4096 tokens with low reasoning effort.
3. Union reconstructed subjects' reviewed masks, adding a bounded halo for antialiasing/contact shadows. Unreconstructed supports remain visible context. Request one Muse edit. Raw provider images remain private `PROVIDER_RESPONSE` assets so later processing can reuse them without inference.
4. Composite only inside the footprint. Bounded harmonic color correction and feathering match hole edges. Robust quadratic RGB fits independently identify smooth background regions by residual error: extend reliable photographed gradients; retain generated fill in textured regions. No object names, scene IDs or fixed gray colors decide the path. PNG preserves untouched pixels exactly.
5. Project the derived full-frame texture with the saved photo camera. A broad support plane and distant shell avoid finite edges. Walls require an observed reachable seam; uncertain seams remain in the image layer. No synthetic side walls/baseboards. Background keeps photographed lighting; lights affect objects and a subdued shadow receiver.
6. Save a derived `SURFACE_TEXTURE` and plan atomically against the revision, preserving meshes/cards/transforms. Optional failure keeps READY geometry/previous background and reports a partial result. Charged submissions never automatically retry. The editor locks saves during generation while progress remains refreshable.

Existing backdrop values remain compatible: `room` means automatic photo background, `studio` ground only, `none` hides surfaces. Legacy floor patches remain a fallback. Restoring object textures leaves the background intact. Reconstruction restart clears later background assets but retains its analysis plan.

## Publication and privacy

Snapshot v2 adds optional `surfaces.backgroundAssetId` and composition background observations; old snapshots remain readable. Private/public viewers use the same derived texture. Frozen allowlists validate a same-scene READY surface asset. Original photos, masks and raw Muse output never enter the public DTO. Publish confirmation explicitly includes photo-derived context and estimated fill. Unsegmented visible context can remain, so the owner must review it. Draft refreshes do not alter earlier snapshots.

## Limits and evidence

This is a photo-projected approximation, not recovered 360-degree geometry. Original framing/modest camera changes work best. Unseen surroundings, nonplanar supports, reflections, residual cast shadows and large rotations may reveal estimated, stretched or faded context. One image cannot establish original hidden texture or geometry.

Tests cover open/distant backgrounds, observed/rejected seams and projection, mask union/halo, exact visible pixels, edge/gradient completion, frame rejection, background-only requests and snapshot allowlists. Two initial legacy Spark-only trials did not return complete output within 900 tokens; neither submitted an image edit. Corrected analysis plus one Muse edit completed on the desk. Further blending reused it without inference. Mesh/card/transform/visibility state is unchanged; prior stage/settings are backed up privately. Chrome inspected local WebGL without side corners, camera orbit and object hiding/reload. Release evidence is in TESTING/CONTEXT.
