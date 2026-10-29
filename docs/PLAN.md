# ReScene implementation plan

Prepared October 29, 2026. All implementation phases are pending. Schedule times are Asia/Manila unless labeled otherwise.

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
| P0 | Editing | Move, rotate, uniform scale, hide/restore, local undo, save/reload |
| P0 | Product cards | Seller details attach to the correct object and survive reload |
| P0 | Prepared replacement | One replacement changes both selected mesh and product card |
| P0 | Sharing | A frozen snapshot opens anonymously without editor actions |
| P0 | Job/error states | Refresh, empty detections, provider failures, and stale saves have clear outcomes |
| P1 | Muse Image enhancement | Optional image edit or replacement concept, separate from product truth |
| P1 | Photo comparison | Original photo beside the reconstructed stage in the editor |
| P1 | Additional sample | Only after the first end-to-end path passes |
| P2 | Voice editing | Short recording → Muse Voice Transcribe → validated command |
| P2 | Embed snippet | Controlled read-only iframe after sharing works |

Defer teams, billing, checkout/cart, Amazon/Shein integrations, catalog scraping, cloth simulation, size/fit prediction, AR/VR, street-scale worlds, multiplayer editing, fine-tuning, full photogrammetry, and arbitrary 3D uploads.

## 5. Reconstruction and presentation

**Mesh objects on a simple stage are the default.** Furniture sits on a neutral floor with optional simple walls. The photo is a comparison/reference view, not a textured background behind extracted objects. This prevents the original furniture remaining visible after its mesh moves or disappears.

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

Start with one active generation per user, five objects, two generation attempts per scene by default, and a configurable global spending stop. Proposed experimental budget: **US$20 total**, adjustable by Jim. This is a planning cap, not authorization to purchase credits or a guarantee of cost.

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
