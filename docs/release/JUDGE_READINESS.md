# Submission readiness

ReScene is a fresh Indie Developer hackathon build. Jim confirmed the fresh-start baseline; GitHub records public repository creation on October 28, 2026. This file separates working verification from remaining submission actions.

## Repository and reproducibility

- Public source: https://github.com/jimclydegm/ReScene
- Hosted shopping demo: https://rescene-eta.vercel.app/demo; no shared login or access code.
- Approved sample assets: [judge-assets-v1](https://github.com/jimclydegm/ReScene/releases/tag/judge-assets-v1), 72 derived GLBs, approximately 134MiB. Committed SHA-256/size manifest verifies each download.
- Keyless local showroom: `npm ci`, `npm run setup:judge`, `npm run dev:judge`.
- Local live path: local Postgres/private files/developer identity; only Meta and fal external keys. No cloud credentials or production data are seeded.
- Application code remains unlicensed at Jim's request. Generated media and dependencies retain separate terms; see ATTRIBUTION.md.

## Evidence

The existing release passed 362 tests and full-mesh background checks for 11 collections/66 layouts/234 placements. This bundle adds local-mode deployment/host/database isolation and signed-asset tests. The full suite now passes 365 tests, schema validation, lint, types and production build. Keyless HTTP checks cover 98 shopping pages, 66 photograph hashes and 58 new GLB hashes. A clean checkout without `.env.local` passed installation, asset bootstrap, all 98 shopping pages and representative model hashes.

Local live verification has exercised real upload/normalization, signed reads/tamper rejection, Spark analysis, SAM masks and Spark stylist Workflow/Apply with $48/$78 alternatives. Fresh hosted SAM3D reconstruction completed with two locally saved meshes, original/clean background depth, Muse background generation, editor save/reload and model delivery. Build verification initially erased temporary Workflow state; the same completed provider job was recovered without resubmission. The launcher now explicitly uses `.judge/workflows/`, with a zero-inference Workflow dispatch check after restart. No automatic paid resubmission is used. Docker configuration is supplied; this workstation used the isolated native Postgres 16 instance because the Docker daemon was unavailable.

## Remaining human/provider submission checks

- The video is not ready. No empty/fake video link is shown in the README. Follow VIDEO_STRUCTURE.md, record actual event-built functionality in English, keep the cut under 3:00, and verify the uploaded link signed-out.
- Confirm the actual participant submission fields/team list and submit through the accepted account. No entry has been submitted by this work.
- Confirm exact hosted auxiliary model identities (including SAM3D's default safety checker) and VGGT checkpoint terms with fal/organizers. Code shows Meta endpoints plus Oxford/Meta VGGT, but endpoint names alone do not prove every hosted internal model. Safety checks remain enabled. No unverified blanket compliance claim is made.
- Review rights for every input used in the final recording. Provenance records/file hashes are not proof of source-reference rights. Use permitted unbranded examples; retain Unslop attribution; do not include unlicensed music/stock footage or private receipts.

Published participant guide: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details. It requires public repositories, event-built contributions and authorized assets, and identifies the three-minute demo as a primary judging artifact. The copied Discord organizer answers supplied by Jim add the no-credentials/English/no-slides guidance. Final eligibility decisions remain with the organizers. No video, submission or organizer message is sent by this repository preparation.

## Released verification

PR [#46](https://github.com/jimclydegm/ReScene/pull/46) merged at `462b69f`. PR and main CI passed. Production `rescene-jcia6bg1o-jimclydegms-projects.vercel.app` is READY at the public demo domain. Read-only checks passed for all 98 shopping pages, Album/3D controls, invalid collection/asset boundaries and an approved GLB digest. Production rejects the local file endpoint (404), redirects authoring to sign-in and rejects unauthenticated scene creation (401). No inference was submitted during release verification. Temporary local application/database services were stopped; local evidence and data remain private on disk. Browser verification remains waived; no native visual claim is made.
