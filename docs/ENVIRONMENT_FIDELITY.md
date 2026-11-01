# Empty-room geometry and independent surface maps

November 1, 2026. This replaces the reference background's mirrored photograph-patch mapping for newly rebuilt environments. Runtime remains Meta Muse Spark, Muse Image and Meta VGGT through fal, with Meta SAM 3D Objects for foreground meshes.

## Causes found in the reported scene

Scene8541ad0a had a successful2048×1152 Muse empty-room image. The application resized it to1600×900, painted plain trim polygons into that image and mirrored small perspective patches across world planes. This produced a white junction band and recurring architectural motifs. The window was present in analysis/geometry, but image-edge blending faded its view toward the plain fallback. Fine plaster relief was also encouraged into a repeating albedo pattern by the analysis prompt.

The lamp has22,446 triangles, not a selected low-poly mode. All four saved foreground meshes lack NORMAL attributes. glTF requires flat shading when normals are absent ([specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes)). The [hosted SAM3D input schema](https://fal.ai/models/fal-ai/sam-3/3d-objects/api) exposes masks, seed, optional pointmap and textured export, but no polygon/detail/quality knob. ReScene already requests textured GLBs and does not decimate them. More triangles alone would not recover missing reference geometry.

## Implemented workflow

1. Analyze the original image. Distinguish broad surfaces, true corners, trim, openings and illumination. New strict observations explicitly label intrinsic appearance as uniform or patterned; historical observations remain readable. Fine plaster relief/shadows do not imply limewash/wallpaper.
2. Recover an object-free Muse Image plate, checkpointing the paid output before further work. Preserve camera/crop, window framing and material identity. Keep native plate resolution; Muse's size setting controls aspect, not guaranteed pixel dimensions ([Meta image guide](https://dev.meta.ai/docs/image-generation)).
3. Analyze the exposed plate alongside the original. Use the visible floor junctions behind removed furniture while keeping original material/window evidence authoritative.
4. Run VGGT on the empty plate. Align its scale using confident unchanged background samples, excluding foreground and window views. Calibrate geometry with the original foreground-depth anchors, so removing objects does not change the scene gauge. A failed alignment retains original depth with a review note. [VGGT provides camera/depth/point maps from images](https://github.com/facebookresearch/vggt); it does not prove hidden room geometry.
5. Fit connected planes/corners/openings in the saved camera frame. Use empty-background depth across the full planned surfaces rather than fitting around furniture. The existing geometry coverage, corner and missing-wall guards still apply.
6. Uniform surfaces use PBR colors. For every patterned surface, rectify clean material evidence into orthogonal plane coordinates, generate a separate high-detail Muse material and review it for objects/lighting/borders. Retain native samples up to2K, remove broad illumination ramps and reconcile opposite borders without mirroring whole patterns. Rejected tiles use an explicit solid fallback.
7. Pack one derived atlas (maximum4096×4096) with independent material regions and a window-image region. The4K atlas is a packing/bake resolution, not a claim of native4K generation. Plane axes preserve observed feature scale and remove projective shear. Shader gradients use unwrapped coordinates so texture repeats do not produce pale mip-filter seams. Windows sample the source-derived view directly without repeat or image-edge fading.
8. Review the empty background and save geometry/atlas atomically under revision guards. Object meshes, placements, product fields, lights and camera stay unchanged. Existing background/texture Undo and previous-background restore remain available. Variant generation receives an empty image plate rather than a packed atlas; variants get their own appropriate mapping.

## Smooth mesh shading

`completeSurfaceNormals` supplies crease-aware normals across UV seams, retaining60-degree hard edges and cloning loader geometry before changes. Existing private/public/demo viewers receive this fallback. New/retried SAM exports embed normals with every triangle corner, UV, image, material and node transform preserved; quality rewrites retain smooth normals. There is no polygon reduction, subdivision or invented geometric detail. Some creases in provider shape or base-color shading can remain; normals do not certify exact reconstruction.

## Persistence and paid-request safety

No SQL migration/new key. Original and clean depth, empty plate, refined observation and each material/check have separate GenerationStep receipts. Image/depth submissions reserve a step first, disable automatic retries and reuse saved responses/jobs. Resume distinguishes original-depth and clean-depth jobs and checks their source lineage/revision. Workflow polling yields; material generation is a separate step per surface rather than one long image-generation loop.

The existing one-atlas SURFACE_TEXTURE publication allowlist is reused. Public geometry adds only bounded numeric atlas rectangles/material indices. Source photos, masks, raw plates, depth predictions, private observations and provider identifiers stay private. Older snapshots remain readable. Appearance history retains per-background observations for restoration/reframing.

## Evidence

Private evidence and recoverable provider results are under ignored `test-results/environment-fidelity`. The reported example reuses its already successful Muse empty plate. One fresh Spark plate analysis identifies three uniform walls, one window and a wood-patterned floor. One empty-plate VGGT job, one Muse floor material and two image checks complete without automatic paid resubmission. The resulting plan has full planned coverage and .644% maximum corner disagreement, with no background review warnings. Numeric agreement is not a photorealism certificate.

Native local WebGL verification confirms uniform walls, visible window context, independent floor material and corrected repeat filtering. Smooth-normal copies retain exact triangle counts and image bytes for all four models. Residual lamp shade/base-color differences remain visible and are not claimed solved by normal generation. The temporary local preview route is removed before release.
