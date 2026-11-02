# Judge-facing repository plan

Implementation update, November 2: the local setup described here is now implemented. See [JUDGE_SETUP.md](../JUDGE_SETUP.md) for tested commands and [JUDGE_READINESS.md](JUDGE_READINESS.md) for evidence and outstanding submission checks. The historical proposal below used MinIO; implementation uses signed private filesystem storage and local Postgres, which avoids an extra service. Original proposal language is retained for decision history.

Planning only, November 2, 2026. No runtime setup changes have been implemented by this document.

## Submission position

ReScene's public repository was created October 28, 2026. Jim confirmed that the project was started from scratch during the hackathon. The entry is Indie Developer, under Build for Your World. Keep the original commit history and describe dependencies as dependencies, rather than claiming their underlying models or libraries as original work.

The participant guide confirms a public repository, clearly identified event-built work, authorized assets, and a three-minute video. Its rubric is Impact30%, Meta tooling25%, Technical Depth/Execution20%, Demo25%. The deadline is November4 at9PM EST, or November5 at10AM Manila. November2 remains our earlier internal freeze. Treat the copied Discord answers as organizer guidance supplied by Jim, distinct from the published participant guide. The authenticated submission field list and word limits remain unverified: opening the submission URL in a fresh tab returned the public event page. No entry was submitted.

Sources: [participant guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details), [event](https://cerebralvalley.ai/e/meta-ai-developer-hackathon), [submission](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit).

## What needs correction now

README.md still describes an early foundation, an eight-model schema,52 tests and disabled browser verification. The current release has362 tests,72 approved products,11 collections, a real shopping stylist, voice, Muse-generated photography/materials and verified background repairs. docs/release/DEMO.md is an obsolete90-second recording draft and incomplete model inventory. docs/CATALOG.md describes three procedural assets; its CC0 statement does not cover the later generated catalog or uploaded references. There is no root application LICENSE in the inspected tree. Replace stale front-page claims; preserve detailed historical notes deeper in docs rather than rewriting project history.

## Recommended judge access

Use three clearly separated setup paths.

1. **Hosted preview, no credentials.** Put https://rescene-eta.vercel.app/demo first. Link Products, Build your space and Shop the scene directly. Explain which actions use prepared real outputs, which actions call Meta, and that checkout/reviews/merchant specifications are demonstration data. Do not publish a login/password/access code. Hosted availability supplements the repository; it does not replace runnable instructions.
2. **Local sample mode, no external keys.** Proposed: bundle or download approved prepared assets, run the showroom locally, and exercise orbit, selection, replacement, colors, lighting, layouts, screenshot, bag and undo. Generated samples must be labelled as prepared results, not fresh inference. Voice/AI stylist/generation stay visibly unavailable until configured; no fabricated AI answers. This path is NOT currently implemented.
3. **Local live mode, two external keys.** Proposed: judges provide MODEL_API_KEY and FAL_KEY only. Local infrastructure and an isolated developer identity replace account provisioning for Neon/Auth/R2. This must support actual photo upload, analysis, masks, meshes, backgrounds, editing, persistence and the live stylist. Production self-hosting keeps its existing full cloud setup as an advanced option.

### Why two keys do not work yet

src/lib/db.ts uses PrismaNeon/DATABASE_URL. src/lib/auth/server.ts and src/proxy.ts require Managed Auth for authoring routes. src/lib/storage/r2.ts and /api/demo/assets/[id] require private R2 access even for prepared GLBs. Shopping requests validate their catalog against Neon and persist durable receipts; voice guest identity uses the auth cookie secret. A cloned repository is therefore not a standalone, two-key or keyless demo today.

### Smallest credible implementation

- Add an explicit local review configuration, isolated from the production configuration. It must not activate on Vercel or a publicly bound deployment.
- Start local Postgres and an S3-compatible store such as MinIO through Docker Compose. Keep the existing Postgres/Prisma schema and migrations, rather than forking the application onto SQLite. The current Neon driver is not an ordinary local Postgres adapter; add an appropriate Prisma Postgres adapter behind the local configuration.
- Keep the existing storage helpers, add endpoint/path-style configuration for local S3, and preserve scene membership, immutable keys, private source assets and size validation. Audit direct getR2 callers too.
- Provide a local-only seeded developer identity and a locally generated session/HMAC secret. Keep ownership, revision and origin checks. Skip external OAuth provisioning only in this explicit loopback-bound mode; never add a production authentication bypass or shared judge password.
- Publish an approved sample asset archive, checksum manifest and provenance under a public GitHub Release. Photos already in public/ stay available. GLBs currently live in private R2; export ONLY allowlisted approved viewer copies, never bucket credentials or private scene data. A bootstrap command verifies hashes and installs the files. Do not require a Git LFS account or depend on a temporary signed URL.
- Seed the same72 listings and11 collections in the local database, with local asset references and complete product details. Preserve the same IDs/contracts required by catalog validation. Sample mode should be independent of the maintainer's cloud database/storage.
- Remote model providers cannot fetch localhost/MinIO URLs. Add a provider-media abstraction: Meta receives supported inline images; fal receives documented inline/auto-upload inputs or temporary fal-hosted files using the existing FAL_KEY. Include masks and derived inputs, not just the main photo. Explain this transfer and verify provider limits/retention. Do not solve it by exposing the local database/storage through an unauthenticated tunnel.
- Verify Vercel Workflow's local execution/recovery for the installed version. Do not require a Vercel token or quietly substitute a fake model response. Keep saved request IDs and no automatic paid resubmission.
- Generate local infrastructure/session secrets during setup. These are internal local values, not extra external API accounts. Expose only Meta and fal keys in the short judge questionnaire/template. Keep paid requests opt-in and visibly distinguish them from browsing samples.

Proposed commands may eventually be npm run setup:judge and npm run dev:judge, with a separate live configuration switch. These commands do not exist yet; do not put them in the README as runnable instructions until implementation and a clean-clone test pass.

## README order

Keep the opening concise and product-led, with one strong real screenshot or short app recording.

1. What ReScene does and who it helps: a seller creates interactive product scenes; shoppers inspect products together and get combinations within a budget.
2. Live demo and video links. Add the actual video URL only once uploaded and tested signed-out.
3. A two-minute judge walkthrough with exact pages, actions and expected results. Separate prepared samples from live calls. Start with a stable furniture collection; use the workspace as a second product-category example.
4. Local sample quickstart, then optional two-key live quickstart, then advanced production deployment. State Node22/Docker requirements, exact environment names, migrations/seeding, asset bootstrap and expected first-run behavior.
5. Actual Meta runtime model inventory, roles and implementation links.
6. One compact architecture diagram, plus a few engineering decisions that can be verified in code: durable jobs, approved asset boundaries, exact budget checks, grouped undo, placement constraints.
7. Verification commands and current evidence. Describe what362 automated tests cover without claiming exhaustive visual correctness.
8. Honest limitations and attribution/license links. Approximate single-view geometry; generated hidden details; authored merchandise dimensions/prices; demonstration checkout. No invented accuracy, latency, sales-conversion or customer adoption figures.
9. Event-built contribution/baseline note and links to deeper documentation. Keep internal phase diaries out of the main reading path.

Use restrained headings, concrete prose and screenshots from the actual app. Avoid badge walls, exaggerated adjectives, repeated marketing claims and generic feature lists. Do not hide development assistance or fabricate a personal story to make the repository appear human-written.

## Complete model inventory

- **Muse Spark1.3 — muse-spark-1.3, Meta Model API.** General scene/structure/material analysis, review, voice-command interpretation and shopping intent/ranking. Link src/lib/ai/analyze.ts, environment.ts, quality.ts and shopping-stylist.ts. Prices, budgets and placement eligibility are enforced in code, not entrusted to the model.
- **SAM3.1 — sam-3.1, Meta Model API.** Object masks and reviewed refinements. Link src/lib/ai/segment.ts. It does not generate meshes.
- **Muse Image1.0 — muse-image-1.0, Meta Model API.** Product/scene photography, empty backgrounds and regenerated material evidence. Link src/lib/ai/environment.ts, background.ts and scripts/generate-example-images.ts. It does not directly output UV-correct GLBs; ReScene prepares/maps materials and retains observed detail.
- **Muse Voice Transcribe1.0 — muse-voice-transcribe-1.0, Meta Model API.** Speech transcription. Link src/lib/ai/transcribe.ts. Spark interprets the reviewed transcript.
- **SAM3D Objects — fal-ai/sam-3/3d-objects, hosted by fal.** Object geometry, textures and pose metadata. Link src/lib/ai/sam3d.ts and generation services. fal is an inference host, not the model author.
- **VGGT1B — fal-ai/vggt-1b, hosted by fal; Oxford/Meta research.** Camera/depth evidence for original and empty-background images. Link src/lib/services/background-environment.ts and environment-surfaces.ts. This is an actual sixth runtime model and must not be omitted. The official upstream identifies Oxford/Meta authorship and distinguishes original versus commercial checkpoints; verify the exact hosted checkpoint/terms.

The openai npm dependency is a compatible HTTP client pointed at Meta's base URL; it is not evidence of an OpenAI runtime model. Do not claim WorldGen, SAM3D Body/Align, Muse Wonder, Muse Code, Glimmer or Spark Open as shipped runtime integrations without corresponding implemented, exercised calls. Development tools are a separate disclosure.

Primary model references: [VGGT](https://github.com/facebookresearch/vggt), [hosted VGGT](https://fal.ai/models/fal-ai/vggt-1b/api), [SAM3D Objects](https://fal.ai/models/fal-ai/sam-3/3d-objects/api), [upstream SAM3D](https://github.com/facebookresearch/sam-3d-objects).

## Compliance and release gates

- Preserve proof of public creation date and event-only original development; Jim confirmed a fresh start. No history rewriting or backdating.
- Audit every runtime inference path and lock the submitted model configuration to verified Meta models. Source inspection found direct Meta calls plus SAM3D Objects and VGGT on fal. That alone does not identify every auxiliary hosted component: fal's SAM3D schema enables a safety checker by default and exposes optional pointmap input. Confirm auxiliary depth/safety model identities and applicable terms with fal/organizers before declaring full runtime compliance. Do not assume undocumented internals are Meta, allege a confirmed violation, or disable safety checks to evade the question.
- Record the six-model inventory and the exact environment/configuration used for the recording and submission.
- Finish an asset register: generated inputs/output dates, generator, permitted distribution, source-reference rights and hashes. Keep CC0 procedural assets, Muse photos, reconstructed meshes and third-party attribution separate. Preserve Unslop/Damir Sokolovsky CC BY4.0 attribution. Exclude unverified user references, brand-heavy uploads and unlicensed music/stock clips from the recording and sample release. Select an application code license with Jim; do not silently license third-party assets under it.
- Check working tree and full public history for credentials/private artifacts; do not publish demo access credentials. Do not copy raw private provider receipts into public evidence.
- Verify the three-minute/English/working-event-built-work constraints from the supplied organizer guidance. Use app footage and actual code rather than slides or future concepts.
- Test public video/repository/demo/release downloads signed-out. Verify accepted team listing and actual form requirements in the participant account; no submission is authorized by this planning task.

## One implementation bundle, then one recording pass

First implement the local sample/live setup, updated README/model inventory, asset attribution and reproducibility checks together. In parallel with that work, resolve the hosted auxiliary-model/checkpoint questions; organizer clearance is an external gate, not a reason to claim compliance early. Then rehearse one coherent scene and one stylist request. Record real calls once, reuse that captured evidence, edit to2:55, verify the published links and finish the form. Do not add new product features for this submission pass.

Acceptance: a clean machine can inspect samples without secrets; with only Meta/fal external keys it can complete a small fresh reconstruction and a real stylist request, save/reload, and observe failure recovery. Production auth remains intact. README commands and sample hashes are tested, model identities/asset rights are documented, and the final video is under3:00. Until those gates pass this is a proposed judge setup, not a working two-key quickstart.
