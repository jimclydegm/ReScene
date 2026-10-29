# ReScene implementation plan

Prepared October 29, 2026. Upload, Meta reconstruction, and object editing are implemented. Scene composition is being corrected; product editing/replacement/publication remain pending. Schedule times are Asia/Manila unless labeled otherwise.

## 1. Product outcome

ReScene turns a seller's scene photo into an interactive product display. Buyers orbit the scene, select furniture, read details, and follow product links. Sellers can move, rotate, hide, or replace individual pieces and publish the result.

The prototype demonstrates the full author-to-shopper flow with **one indoor photo and 3–5 furniture/decor objects**. It proves object-level interaction and editing. It does not promise a scan with exact dimensions or accurate unseen surfaces.

The first scene should contain a bed or sofa, side table, lamp, and another opaque object. Prefer clear boundaries, good lighting, moderate occlusion, and a visible floor. Thin curtains, mirrors, glass, tiny clutter, and busy outdoor scenes are poor first-demo inputs.

## 2. Hackathon requirements and dates

Jim's accepted idea requires Meta models. The proposed runtime uses Muse Spark and SAM 3.1 directly through Meta Model API and Meta SAM 3D Objects through a GPU inference host. These power the core product, with provenance retained for the demo.

The [public event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) lists project submissions on **November 4, 2026, at 9 PM ET**. Treat **November 2** as Jim's earlier build freeze. The [participant details page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) returned a loading shell to public text retrieval and redirected to sign-in in the browser. Submission rules, track, judging rubric, video length, and whether a particular combination of models is mandatory remain Phase 0 checks. Do not infer that every model listed in the invitation is required, or that one is sufficient under the final rules.

## 3. Core user journeys

### Seller: create and review

1. Sign in, create a scene, and upload a JPEG, PNG, or WebP room photo.
2. See the photo and analysis progress. Reloading preserves progress.
3. Review a short object list and corresponding mask overlays.
4. Rename a label, exclude a bad detection, or correct its box and rerun segmentation.
5. Confirm at most five objects and start 3D reconstruction.
6. See meshes or an explicit failure/retry state. Confirmation is a normal editing action.

### Seller: edit and merchandise

1. Orbit/pan/zoom the stage and click an object, or select it from an accessible list.
2. Move it on the floor, rotate around the vertical axis, scale uniformly, hide/restore it, and undo changes in this editing session.
3. Attach a seller-entered product card: name, description, price/currency, thumbnail, and external product URL.
4. Replace an object with a prepared product that already has a validated GLB; change geometry and product association together.
5. Save, reload, and see the same scene. Publish a read-only snapshot and copy its unlisted URL.

### Buyer: explore and shop

1. Open a shared URL without registering.
2. Explore the scene and select products with mouse or touch.
3. Read the selected product in a side panel or mobile bottom sheet.
4. Open the seller's product URL. Checkout remains on the merchant's site.

## 4. Scope and priority

| Priority | Feature | Completion condition |
| --- | --- | --- |
| P0 | Sign-in and ownership | A user can save a scene; another user cannot read or mutate it |
| P0 | Private upload | Validated photo persists in R2 with immutable processing input |
| P0 | Meta analysis/segmentation | Live calls create reviewable labels, boxes, and masks |
| P0 | Reconstruction | At least three independent, real GLBs from the demo photo render and can be selected |
| P0 | Scene composition | Preserve SAM relative sizes/poses/depth, fit the photo camera, estimate floor/walls/light, and compare with an expandable reference |
| P0 | Editing | Move, rotate, uniform scale, hide/restore, local undo, save/reload |
| P0 | Product cards | Seller details attach to the correct object and survive reload |
| P0 | Prepared replacement | One replacement changes both selected mesh and product card |
| P0 | Sharing | A frozen snapshot opens anonymously without editor actions |
| P0 | Job/error states | Refresh, empty detections, provider failures, and stale saves have clear outcomes |
| P1 | Muse Image enhancement | Optional image edit or replacement concept, separate from product truth |
| P0 | Photo comparison | Clickable original-photo thumbnail in Scene Studio with an expanded, keyboard-dismissable view |
| P1 | Additional sample | Only after the first end-to-end path passes |
| P2 | Voice editing | Short recording → Muse Voice Transcribe → validated command |
| P2 | Embed snippet | Controlled read-only iframe after sharing works |

Defer teams, billing, checkout/cart, Amazon/Shein integrations, catalog scraping, cloth simulation, size/fit prediction, AR/VR, street-scale worlds, multiplayer editing, fine-tuning, full photogrammetry, and arbitrary 3D uploads.

## 5. Reconstruction and presentation

**A composed room is the target.** Jim clarified on October 29 that an empty stage with independently resized objects does not fulfill the idea. Apply the saved SAM 3D pose/scale/depth together, estimate a shared floor and photo camera, and render a separate room shell. Muse Spark also describes visible floor/wall colors, floor material, and broad lighting. The private source photo is available as a clickable reference. Keep furniture out of room textures so moving or hiding a mesh does not reveal the original furniture underneath.

The first composition implementation uses approximate planes/materials and lights, not a generated, texture-complete 3D world. Existing scenes can reuse saved poses and photo-region colors without another inference request. A reversible **Match photo layout** action preserves the previous transforms. Exact walls, windows, floor texture, shadows, and hidden geometry remain quality gaps; additional depth/background reconstruction must be evaluated separately within the schedule and budget.

**Real geometry is a release gate.** Cutouts and colored proxy boxes help while generation is pending or fails. Label them “2D cutout” or “placeholder”; they cannot count as successful 3D reconstruction. If the hosted 3D path fails Phase 0, preserve useful work but explicitly rescope with Jim before calling the original idea complete.

**The model infers unseen surfaces.** Buyer copy should say “AI reconstructed preview.” Do not claim a true 360° scan. Keep the default camera within a tested region and provide reset-view. Objects can rotate, with the approximation clear in the experience.

**Real-world size needs an anchor.** Start with approximate scene units. A seller can enter a known object's width later to scale the scene. No dimension or room-fit claim is made without deliberate calibration.

**Merchant information stays separate from AI interpretation.** Spark may label “floor lamp”; it cannot establish exact SKU, price, dimensions, brand, or stock. Prepared replacements use supplied assets with recorded licenses/attribution.

## 6. Architecture decisions

| Decision | Choice and reason |
| --- | --- |
| App | One Next.js App Router project on Vercel; shared TypeScript contracts |
| Browser 3D | Three.js via React Three Fiber/Drei; mesh selection and transforms |
| Persistence | Neon Postgres/Prisma; relational ownership/products/jobs and JSON scene contract |
| Auth | Neon Managed Better Auth SDK; no second self-hosted auth schema |
| Media | Cloudflare R2; keep uploads and GLBs off function request bodies |
| Reasoning | `muse-spark-1.3` Standard mode for scene analysis |
| Segmentation | Direct Meta `sam-3.1` with the official mask parser |
| Reconstruction | Proposed `fal-ai/sam-3/3d-objects`; verify multi-object GLBs/poses first |
| Durable work | Vercel Workflow; no Redis or separate queue service |
| Progress | Authenticated status polling every 2–3 seconds, slower in hidden tabs |
| Public viewer | Immutable snapshot and allowlisted asset signing |
| Development | GitHub CI, Vercel previews, isolated Neon/R2 development data |

See [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries and [META_MODELS.md](META_MODELS.md) for evidence.

## 7. Demo script

1. Show the room photo and explain static-image shopping.
2. Upload and show live Meta analysis/mask review.
3. Open the scene with three or more reconstructed objects.
4. Orbit, select the lamp, and show its merchant-authored card.
5. Move the table, hide an object, undo, and replace the lamp.
6. Save/publish, then open the public URL anonymously and select the replacement.
7. During judging, show actual model IDs, job duration, and input/output provenance in an implementation panel. Keep this out of normal buyer flows.

Keep a saved scene generated by the same pipeline as an outage/latency backup. Label it pre-generated; do not present it as the result of a fresh upload.

## 8. Definition of done

- Fresh upload completes the deployed flow with real Meta calls.
- Three independent meshes render with correct label/product mapping.
- Edits/cards persist after refresh; publication remains unchanged after draft edits.
- Anonymous shoppers cannot access drafts or raw source media.
- A second account cannot fetch, edit, publish, sign, or attach another user's resources.
- Retry preserves successful work and avoids silent duplicate GPU submissions.
- Desktop and a representative phone support selection/cards/reset; WebGL failure shows poster/product-list fallback.
- Production build, typecheck, lint, relevant contract/service checks, and the main browser flow pass.
- README includes setup, model attribution, limitations, demo URL, and submission materials once available.

## 9. Risks and cut lines

| Risk | Mitigation | Cut line |
| --- | --- | --- |
| 3D host loses identity/pose | Two-object Phase 0 experiment with saved artifacts | Four-hour spike; choose a documented host of the same Meta model or rescope explicitly |
| Bad geometry/occluded backs | Good photo, 3–5 opaque objects, manual transforms, approximation wording | No architecture-perfect reconstruction before freeze |
| GPU latency | Durable polling, progress, deadlines, saved demo | No new host deployment after Oct 31 unless primary is broken |
| Large output | GLB/texture budgets, lazy loading, size checks | Reduce objects/quality before adding a splat renderer |
| UI consumes schedule | One editor and shared viewer components | Cut voice, image enhancements, embeds, second sample first |
| Auth configuration delay | Stable test origin, managed SDK, early two-account test | Email/password first; OAuth optional |
| Access/rule surprises | Verify participant access and requirements first | Do not build around inaccessible models or assumed rubric |

## 10. Budget and setup

Start with one active generation per user, five objects, two generation attempts per scene by default, and a configurable global spending stop. Jim approved $10 initially, then explicitly requested removing the cumulative app cap and continuing testing after reporting $149.91 Meta credit remaining. The app no longer enforces a total allowance. Preserve usage history, idempotency and one-active-run controls; avoid blind or bulk retries. Meta credits do not pay fal inference.

Record model tokens, call counts, duration, provider IDs, and known charges. Published Meta rates and a cost formula are in [META_MODELS.md](META_MODELS.md). Check GPU pricing/credits in the chosen host account before paid inference.

Phase 0 needs Meta access, a reconstruction credential, and participant rules. Phase 1 needs Neon/Auth, R2, and Vercel linkage. [ROADMAP.md](ROADMAP.md) lists setup and acceptance gates.

## 11. Decision log

| Date | Decision | Status |
| --- | --- | --- |
| Oct 29 | Furniture/home decor first; garments later | Planned default |
| Oct 29 | Object meshes plus simple stage | Planned |
| Oct 29 | WorldGen excluded; official announcement says no developer access | Research verified |
| Oct 29 | Hosted SAM 3D proposed through fal | Live verification required |
| Oct 29 | Nov 2 freeze despite Nov 4 public submission date | User target preserved |
| Oct 29 | Build the requested Vercel/auth/database foundation while live 3D spike remains pending | Implemented; no claim of reconstruction feasibility |
| Oct 29 | Use plain CSS for foundation; keep Zustand/Tailwind/shadcn optional for editor | Implemented |
| Oct 29 | Verify rotated R2 credentials, private bucket, browser CORS, normalization, and immutable input on the live app | Nine storage checks and browser upload/refresh pass |
| Oct 29 | Leave automatic staging deletion disabled at Jim's request | No object-expiration rule enabled; setup script preserves lifecycle |
| Oct 29 | Reuse supplied Neon branch/Auth and R2 prototype namespace initially | Implemented; environment separation remains future work |


### October 29 implementation update

Jim requested a complete browser-testable core and approved $10 total development inference. The app now implements private upload, Spark/SAM analysis and mask review, durable fal SAM 3D generation, object selection/transform/hide/undo controls, and revision-aware saved edits. Local and production API flows produced three real meshes and passed persistence and ownership checks. Browser visual QA remains blocked by Work settings. Product cards, prepared replacement, and publication are still planned. The scene-composition correction now converts saved poses and fits a common camera/floor, with an estimated room shell and reference-photo comparison. Detailed room reconstruction and visual QA remain incomplete.


## Step restarts — October 29 request

Earlier steps must be reachable within an existing scene. Change photo returns to upload and clears all later results. Analyze again keeps the source photo and clears candidates, masks, meshes and edits. Return to review/Rebuild 3D retains the photo and masks but clears models, room/camera and saved edits. Each destructive navigation shows a confirmation listing lost results and credit consequences, with Keep current scene as the initial focus. Clearing is explicit; it does not automatically submit a paid job. Active generations must finish first. Historical usage and provider request records remain; discarded assets are logically deleted and no longer signed, without changing R2 lifecycle rules.


## Texture-fidelity clarification — October 29

Textured SAM GLBs are already requested and stored, but generated appearance alone does not meet Jim's photo-likeness expectation. Add the explicit Phase 3.6 quality gate in ROADMAP.md before merchandise/publication: diagnose stored texture versus display fidelity, test source-photo detail projection on visible mesh surfaces, then bake a successful result into a private validated GLB. Preserve generated hidden surfaces and original fallback assets. Background plane textures remain a separate room-quality gate. See [TEXTURE_FIDELITY.md](TEXTURE_FIDELITY.md); this is proposed engineering work, not a new verified Meta API feature or completed implementation.


## Selected-scene implementation — October 29

Jim authorized implementation on the chair/cabinet/vase example and requested adjustable lighting. Texture copying was planned in Phase 3.6; editable main/fill XYZ/intensity and ambient lighting are now added to scope. CPU triangle/depth rasterization transfers accepted source pixels directly into existing UV atlases, avoiding a new GPU/model service. Room surfaces repeat clean observed photo patches, with an original-texture restore path. This preserves editable meshes and avoids source-photo exposure in future public viewers. No additional inference is necessary. Detailed physical material recovery and unseen texture truth remain outside the one-photo guarantee.

### October 29 — Dashboard and editor navigation

Jim requested smaller project thumbnails, project previews/progress, pagination, and a clearer editor menu. Implement compact photo-preview cards with stage/object/date details and six-item server pagination. Expose Objects, Textures and Lighting as top-level inspector tabs; keep tab navigation/save actions fixed while the body scrolls. Preserve draft state across tabs and the existing atomic object/light save. This adds no model calls or database migration. Dashboard images are owner-authenticated signed assets, explicitly labeled source photos unless a saved scene poster exists.

### October 29 — Phase 4A: merchant product cards

Split Phase 4 into testable slices: 4A ships merchant-entered product fields/cards, private mask-derived thumbnails, numeric transform/light inputs, and object undo/redo. 4B remains a trusted rights-cleared replacement catalog plus transactional mesh/product replacement. Phase 5 remains immutable sharing; no anonymous access is added in 4A. Existing Product/Asset/SceneObject tables suffice. Product fields save atomically with object transforms and lighting under the scene revision guard. Thumbnail work uses existing photos/masks and CPU processing, with no inference or merchant-URL fetching. Preserve original geometry/baselines and private source access.
