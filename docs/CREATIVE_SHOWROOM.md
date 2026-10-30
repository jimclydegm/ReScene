# Creative showroom release

October 30, 2026. Approved scope: product photos → Muse Image lifestyle composition → existing reviewed Meta segmentation/3D pipeline → color/light editing → frozen shoppable viewer. Any product category; IKEA is a use case, not a detection or template restriction.

## Contest fit and demo

Public event page (https://cerebralvalley.ai/e/meta-ai-developer-hackathon) describes the Indie track as creativity, technical ambition and whether it works. It currently lists Nov 4, 9 PM ET; retain Nov 2 Asia/Manila internal freeze. Details route returns a loading shell in research; do not invent a detailed rubric. Recommended demonstration: choose three merchant product images, create a lifestyle scene with Muse Image, inspect/accept it, run Spark/SAM/Objects, recolor one selected product, switch day/dusk/night, open a previously published shopper view. Include a second category (e.g. shoes/accessories or food/tableware) using saved scenes. Explain generative product likeness and unseen 3D geometry limitations. Reuse saved results for the timed demo; show real generation progress separately. Do not expand into checkout, fit, exact dimensions or unverified WorldGen.

## Data and API design

Add SceneObject.appearance JSON default {} with strict optional nullable hex tint. Optional light color fields retain compatibility with existing saves. Snapshot v2 freezes tint and light values; no source/reference provenance becomes public. Clone per-instance materials; tint multiplies existing textures, retains detail, and can restore original color. This cannot turn a black photographed material into a faithful white product variant.

Add COMPOSE_IMAGE to RunKind. Creative workspaces reuse owned DRAFT Scene rows marked settings.creative=true. Existing immutable Asset rows store reference PRODUCT_IMAGE files and generated SOURCE_IMAGE results; GenerationRun.input stores validated asset IDs, template ID, aspect and bounded prompt. This avoids duplicate storage/job/ownership tables. API schemas, not arbitrary client JSON, define the data. References are one to six owned READY images; scene templates supply controlled prompts. Procedural demo products are labeled illustrations, never commercial SKUs.

/api/creative GET returns private gallery/reference assets, selected workspace runs and signed owner URLs. POST discriminated operations create workspace, reserve/complete direct R2 reference uploads, seed illustrative product templates, submit/resume queued generation and adopt a result. All mutations check origin/session/ownership. 12 MiB still-image uploads are normalized/EXIF-stripped with 24MP decoding limit. No arbitrary remote fetches. Paid requests are a distinct durable workflow, unique attempt, owner-active-run lock, fixed input fingerprint and captured scene revision. No automatic inference retry. Queued dispatch can resume the same run; unknown submit failures remain explicit, never silently retried. Outputs stay private and immutable.

Use image output only after bounded decoding/validation. Adopting a result creates a new owned scene and copies normalized bytes to its own SOURCE_IMAGE/NORMALIZED_IMAGE assets; existing creator results and projects remain unchanged. No generation is triggered by adoption, refresh, gallery browsing or model controls. Old public snapshots remain frozen.

## Frontend

/scenes/new: Start with a premade photo (existing upload + private generated gallery), or Create your own photo linking to /scenes/create. Creator: resumable workspace, library/upload/template product selection, controlled scene template, aspect ratio and prompt, explicit Generate, durable progress/recovery, saved result thumbnails, Use in 3D and New variation. Generated gallery paginates. State/pending errors must retain selected inputs; polling must not generate.

Editor: per-object color + restore; Day, Dusk, Night, Studio templates populate editable light colors/positions/intensity and existing history. Photographic background lighting is baked and cannot be physically relit by Three lights; state that in the UI.

## Verification gates

Schema migration reviewed/additive, generated Prisma/schema validation, unit tests for strict color/preset/template/reference contracts, owner/active/idempotency/revision tests, no duplicate paid submission, saved tint/light round trip and frozen publish mapping. One recorded Muse multi-reference composition and adoption, then reuse existing reconstruction checks. Do not repeat full paid 3D pipeline for unchanged code. Native desktop/mobile inspection depends on Work browser access; record any blocker honestly. One combined PR/release after affected checks pass.

Implementation status is tracked in ROADMAP, not implied by this design.
