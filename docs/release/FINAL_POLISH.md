# Final demo readiness pass

November 2, 2026. Scope: refine the working desktop app, fix recovery problems and check the public/judge paths before recording. Runtime models, production identity, source privacy and the reconstruction workflow remain unchanged. No SQL migration or new external service is required.

## Changes

- Shared color controls accept a complete hex value without expanding its three-character prefix mid-entry. Undo, external value changes and object selection restore the displayed value. Escape cancels text entry. Native-picker changes remain grouped; room color controls distinguish white from the original background.
- Compact analysis/texture choices and consistent color presets complete the presentation work already in the checkout. Private replacement history reads the current catalog identity from the server rather than assuming an existing replacement was the original model; new edits invalidate replacement redo.
- Replacement picking starts in the selected product’s category and shows items that pass existing placement checks. Optional unavailable results retain their reasons. Search, count, thumbnails and purchase action remain in one dialog.
- The product catalog features Haven Accent Chair first, links directly to it and supports name/price sorting. Prepared judge mode starts with usable product controls, rather than an unavailable stylist panel.
- Short-desktop layouts reduce header/card spacing; thumbnails and color controls are consistent, key prices remain unbroken, and form/scroll areas retain space. Dialog, panel and card motion is brief and respects reduced-motion preferences. Light/dark theme selection also handles blocked storage and cross-tab updates.
- Browser-state recovery keeps valid bag lines and supported arrangements when one stale product/collection is invalid. It rejects unknown versions, invalid prices/colors, duplicate lines and oversized input.
- JSON requests stop reading oversized chunked bodies at128KiB. UI requests have bounded waits and readable recovery messages, with no automatic resubmission of mutations. Stylist polling/application uses the same recovery helper.
- Local judge Next output is isolated in `.judge/next/`, separate from authoring builds, private media and durable jobs. Lint/types exclude generated local data and diagnostic captures. Sample setup reports progress while verifying all72 approved meshes. Upload selection permits choosing the same file again after removal.

## Verification

The consolidated local suite passes **380 tests in68files**, Prisma validation, lint and production build. Typecheck also passes. The keyless local setup verifies all72 approved model hashes without new downloads or inference. Read-only HTTP verification passes all98 shopping routes, default Album/3D controls and invalid collection/asset boundaries.

Native Chrome checks cover the Reading Corner scene, room color input and matching Undo, preset selection, product Album/3D and color choice, the correct variant/subtotal in the bag, mock checkout completion and readable dark-mode product layout. Further release/clean-checkout results are recorded below when complete. These checks do not assert every historical scene or GPU/driver combination is visually perfect.

The registry audit reports no high/critical production advisories; low/moderate transitive advisories remain, including Auth UI/Workflow tooling dependencies. No unreviewed major dependency downgrade is applied to the working inference/auth stack.

## Hackathon review

The signed-in official participant guide was read again November2. It requires a public repository, event-built contributions and authorized assets; it asks for the three-minute demonstration. The30/25/20/25 judging weights remain as documented. GitHub confirms the repository is public and was created October28. Model inventory, reproducible local setup and the recorded-narration plan remain in the repository.

The video, participant submission, input rights and exact hosted auxiliary-model/checkpoint confirmations remain separate review items in JUDGE_READINESS.md. This pass does not submit an entry or assert an organizer’s eligibility decision. See the [official guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details).

## Release

Clean-checkout verification, PR checks and the production deployment are pending for this bundle. No fresh image, mesh, transcription or stylist inference was submitted during this pass. Existing saved scenes and approved media were not regenerated.
