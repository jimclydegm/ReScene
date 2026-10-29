# ReScene — one release pass

Updated October 29, 2026, Asia/Manila. This replaces the incremental phase schedule. Jim requested bulk implementation and fewer repeated tests/deployments. Build freeze remains November 2; aim to finish the app sooner.

Core flow already works: private photo → live Meta analysis/masks → separate meshes → room/texture/light editing → product cards/replacements → frozen shopper viewer. A fresh deployed two-model author-to-shopper run and 47 focused tests already passed; do not repeat paid inference for unchanged code.

## Current release bundle

- [x] Project management: name/description editing, search/status filters, active sharing indicators, reversible archive/restore with share revocation.
- [x] Complete editor flow: publish shortcut, project details, consistent saved state, explicit discard/reload recovery and protection against leaving unsaved work.
- [x] Release reliability: retry/expired-asset recovery, clear loading/empty/error states, preserve owned data and snapshot isolation.
- [x] Reduce repeated work: one PR CI run per feature change, cancel superseded runs, skip docs-only Vercel builds, one reusable saved-data regression command.
- [x] One combined verification pass: focused unit tests + lint/typecheck/build + one saved-scene integration run; one production deployment and bounded post-deploy check.
- [x] Refresh the short handoff and Indie developer demo/submission documents around the final release.

Do all items within one branch/PR. Do not stop after each item or request another “next phase” instruction. Fix failures within the same pass, and repeat only affected checks when something changed.

Release bundle shipped in PR #10 at 648010b. All 52 tests and PR CI pass, the single saved-data regression passes, and the bounded read-only production smoke passes. No new inference, QA projects or photo/model uploads.

## Current correction bundle: any scene or product

Jim deferred recording/portal work and requested a single broader UX/pipeline correction.

- [x] Remove furniture-only analysis categories, room-specific entry copy and lighting-based candidate priority.
- [x] Analysis focus/instructions/item limit; manually add items even after zero candidates.
- [x] Independent outline retries with text or box/include/exclude points; keep other accepted masks.
- [x] Persist multiple matches, select saved outlines, combine multi-part product masks without inference.
- [x] Fit portrait photo/3D views, improve review controls, reconstruction seed, backdrop and placement resets.
- [x] Complete targeted live clothing/recovery checks, PR #11 merged at 90f5911, READY production release and bounded production verification.

The clothing correction has 61 passing unit cases, passed CI/build and saved-data/API checks, and a real three-item clothing reconstruction saved privately. Production controls/authorization/recovery smoke checks pass with no further inference. Native browser interaction remains unverified.

## Complete subjects and automatic discovery correction

- [x] Research Objects vs Body/Align and diagnose missing subject, mask-scale rejection and median-floor bugs.
- [x] Automatic complete subjects plus product relationships; remove count question and arbitrary three-piece selection limit.
- [x] Reconstruct roots once; derive disjoint product regions with shared geometry/appearance/placement and whole-subject editing.
- [x] Conservative ground envelope, legacy editor-plane correction and frozen public floor placement.
- [x] Rescaled-mask handling, automatic shoe-pair union, grouped publication/privacy guards and safe partial fallback.
- [x] Live full-person experiment/adoption plus 65 tests and reusable saved-data/assembly checks.
- [ ] One PR/production release and bounded deployed verification.

## External completion gates

Browser desktop/mobile visual checks and recording need browser access, which is currently disabled. Participant video limits/private portal fields and actual submission need the authenticated portal and final user review. Keep these separate from implemented app functionality. Continue independent work; do not label these gates as passed.

Original phase history: history/ROADMAP_2026-10-29.md. Technical contracts: ARCHITECTURE.md, DATA_MODEL.md, META_MODELS.md. Current state: CONTEXT.md.
