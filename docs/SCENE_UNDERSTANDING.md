# Complete subjects, product parts and ground placement

October 29, 2026. This supersedes the independent-garment approach from PR #11. Jim reported missing anatomy, a floor above the shoes and an unnecessary item-count question.

## Diagnosed causes

1. The previous prompt asked for shirt/shorts/shoes and deprioritized the person. Three independent object reconstructions therefore had no head, neck, exposed arms or legs to render. Separate meshes also invented different body dimensions and poses.
2. `composeRoom` estimated the floor using the median of mesh bottoms when support was unknown. With three garments, the median can be shorts height rather than shoe height. Explicit floor-supported objects were then snapped independently, changing their relative arrangement.
3. The SAM decoder required raster dimensions to equal the source-coordinate bounding box. Meta's graphics protocol scales a raster into that box; a valid lower-resolution person mask was rejected. This was a local decoding bug, not evidence that SAM cannot segment the person.
4. The candidate-count control exposed an implementation budget to the user instead of making a scene-understanding decision.

## Implemented approach

`scene-assemblies-v4` automatically detects complete subjects and meaningful product parts. Each part references a root candidate; validation rejects missing/self/cyclic/deep parents and parts largely outside their subject. The model can emit up to ten entries as an internal prototype bound. Users are not asked for a count, and legacy maxObjects input does not truncate automatic discovery. Default reconstruction selection includes all accepted entries. Selecting a child also includes its complete subject; a missing subject mask blocks construction before any paid submission.

SAM uses the same normalized photo for all masks. Binary rasters are mapped into their source box using bounded nearest-neighbor resampling. Repeated concept matches are matched to candidate image regions. A shoe pair within its candidate region is combined without a second inference. Ambiguous results remain inspectable; paid calls are never automatically resubmitted.

Reconstruction submits complete roots, not overlapping garments and people. `splitAssembly` projects each root mesh into the source photo and assigns each triangle to one product mask or the remaining context geometry. Existing UVs/materials remain unchanged. Smaller masks resolve overlapping regions; rear surfaces use projected classifications and remain approximate. Every triangle has exactly one owner: no double surfaces and no deliberate holes in the initial assembled figure. This is not anatomical segmentation or a garment-fit simulation. Current partitioning supports the observed one-mesh/one-node textured provider output; unsupported hierarchies or unreliable tiny regions fall back to the complete subject with an explicit partial-region result.

The body/context and product regions share one imported transform, scene scale and camera. Moving/hiding the complete subject updates its regions together. Separate region edits remain possible, but can open gaps; unseen skin beneath clothing is not reconstructed. Standalone catalog substitutions are blocked for these shared-geometry regions. Existing merchant fields remain associated with their object IDs.

The floor uses the conservative minimum geometry height instead of a median of garment bottoms. Other objects retain their relative heights instead of all being individually snapped. The editor also keeps its displayed plane below the lowest visible object pivot; new public snapshots freeze a conservative floor height calculated through the actual world transforms. This prevents the observed intersection, but is not metric ground-plane recovery from a single photo.

## Privacy and persistence

Parent/assembly IDs, original mesh references, masks and provider details stay private. Immutable part GLBs retain the shared appearance atlas and source mesh buffers. Publication requires all reconstructed members of a visible assembly to be approved as visible; a partial publication that could reveal hidden members is rejected before storage/signing. The public contract still freezes explicit mesh/product assets and excludes source photos, masks and provenance. Up to ten render entries are supported. No SQL migration is required; relationships live in existing provenance JSON.

## Model research and alternatives

Meta's [SAM 3D Body](https://github.com/facebookresearch/sam-3d-body) estimates a parametric human mesh/pose using MHR. The hosted [Body API](https://fal.ai/models/fal-ai/sam-3/3d-body/api) accepts an image/person mask and outputs GLB/PLY, keypoints and camera parameters; its schema does not expose textured clothing/identity-preserving appearance export. [SAM 3D Align](https://fal.ai/models/fal-ai/sam-3/3d-align/api) aligns an existing Body mesh to the MoGe/Objects frame; it is not a room or clothing generator. These are researched alternatives, not added runtime integrations.

For this prototype, one full clothed-person SAM 3D Objects reconstruction preserved both appearance and body context in the tested input. The structural lesson applies to other scenes: reconstruct a complete assembly once, retain separate standalone objects, and attach product regions without independently inventing overlapping geometry. A future Body+depth+clothing registration pipeline may improve difficult poses, but requires coordinate, occlusion and texture validation before being described as working. WorldGen still has no verified developer API.

The [SAM protocol](https://github.com/meta-models/meta-sam/blob/main/protocol/sam3.md) and [client graphics documentation](https://dev.meta.ai/docs/sam/client-libraries) define source-coordinate boxes and raster scaling. The app uses supported text or box/point prompts, not invented API tuning parameters.

## Evidence and limits

The existing clothing photo automatically returned a complete person plus three linked products, with default automatic options and no count/instructions. The full-person experiment completed one textured reconstruction in 26 seconds. A static offline render shows head/neck, arms/hands and legs/shoes; this is not a browser screenshot or proof of exact identity. All 5,218 triangles were partitioned once: 2,867 body/context, 1,281 shirt, 838 shorts and 232 shoes. The accepted scene has four pieces at one shared baseline with floorY=0. The existing job outputs were reused for adoption; no second reconstruction was submitted.

Complex occlusions, hair/fingers, reflective/transparent items and unseen surfaces remain model limitations. Partition boundaries and rear-surface labels are estimates. A ten-entry safety bound is not exhaustive understanding of arbitrary crowded photos. Native browser interaction is unverified while Work browser access is disabled; code/API/numeric geometry checks must not be reported as visual browser verification.
