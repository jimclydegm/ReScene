# Private Meta feasibility runner

**Current authorization: US$10 total development inference**, approved October 29, 2026. This replaces the earlier code-only instruction. The CLI experiment has now produced two independent GLBs; the app also implements the private generation/review/editor flow described in [TESTING.md](TESTING.md). Do not reset the existing experiment or run additional paid tests outside the remaining allowance.

## Prepared input

The corrected bedroom fixture is in ignored `test-results/inputs/bedroom-test-wide.png`. It was generated in this chat using the imagegen tool and contains a fully framed bed, nightstand, floor lamp, and chair. It has no merchant photograph or personal information. The normalized 1536×1024 WebP and SHA-256 are saved under `test-results/meta-bedroom/`, with a private R2 copy under `prototype/spikes/<experiment-id>/`.

The runner applies the same JPEG/PNG/WebP, 12 MiB, 24 MP, still-image checks and orientation/1600px/WebP transform as upload completion. It uses private experiment artifacts rather than creating app database records. Generated/synthetic input is useful for wiring tests; it does not establish quality on actual room photos.

## Safe preparation and inspection

```sh
npm run spike:meta -- help
npm run spike:meta -- status
```

`prepare --image PATH` creates a new experiment if none exists. Use `--dir test-results/another-name` only for a deliberately separate experiment. It writes the normalized image to private R2 and does not invoke any model. Keep all photos, masks, raw responses, URLs, output GLBs, and checkpoints ignored; never move them to `public/` or commit them.

## Paid sequence, for later authorization

These commands are instructions for a future authorized run. `APPROVED_USD` must be the explicit total cap Jim approves, not a guessed default.

```sh
npm run spike:meta -- analyze --budget-usd APPROVED_USD
# Read the returned candidate list and select two different IDs.
npm run spike:meta -- segment --candidates candidate-2,candidate-4 --budget-usd APPROVED_USD
# Inspect the saved PNG masks and transparent cutouts against normalized.webp.
npm run spike:meta -- review --masks 0,1
npm run spike:meta -- reconstruct --budget-usd APPROVED_USD
npm run spike:meta -- poll
# Repeat poll against the known ID if queued/running; it never submits a new job.
npm run spike:meta -- ingest
```

Candidate IDs and mask indices above are placeholders, not observations from a model. Select them from the actual returned analysis/instance list. Review permits one instance from each candidate and freezes their ordered files before reconstruction. If segmentation finds no matches, do not submit reconstruction.

Before a paid run, verify current provider price/billing unit, account balance/credits, and participant host eligibility. The public fal model page currently quotes $0.02/unit/generation; actual multi-object/textured billing is unverified. The local ledger reserves $1.40 for one Spark call, $0.0025 each for two concept calls, and $1 for one reconstruction ($2.405 total). Reservations are conservative allowances, not measured charges or a provider billing guarantee. All paid commands require the same cap, never more than $20 in this experimental CLI. Do not approve a cap implicitly by setting a shell variable.

## Checkpoints and failure handling

- An exclusive lock prevents two runner processes sharing a checkpoint. A process crash can leave the lock file; verify no runner is active before deliberately removing that lock. Removing a lock never authorizes resetting paid attempts.
- Each paid attempt is saved as STARTED **before** submission. It becomes DONE after its result or known fal request ID has been saved. A STARTED attempt must be treated as potentially accepted/charged.
- Re-running analysis/reconstruction is rejected. Segmentation skips completed candidates and refuses an existing uncertain attempt. Candidate selection cannot change mid-experiment.
- Poll and ingest operate on a saved provider ID/result. If submission timed out without an ID, reconcile in the provider dashboard; do not reset and retry blindly. Closing a polling command does not cancel paid GPU work.
- State and private JSON use mode 0600; the experiment directory uses 0700. Normal CLI logs omit image URLs, source bytes, storage keys, SDK errors, and credentials. Private output may contain provider URLs and must stay ignored.
- No lifecycle/automatic cleanup policy is changed. Existing immediate staging cleanup behavior and Jim's disabled automatic expiry choice remain intact.

## What ingestion verifies

Ingestion requires two independent GLBs and metadata entries with indices 0 and 1. Downloads accept only HTTPS `fal.media` hosts, reject redirects, and cap each file at 40 MiB. The container checks GLB version/length, JSON/binary chunks, embedded buffer, mesh inventory, finite transforms/bounds, and no external texture/buffer URIs. Validated bytes are saved privately in R2 and locally with checksums.

This is a preliminary artifact boundary, not a complete glTF validator. Texture/mesh complexity limits, complete accessor validation, browser loading, object identity, baked transforms, coordinate conversion, geometry quality, and performance still require the live inspection step. Two files do not by themselves prove correct input-mask mapping.

## Remaining work

After future inference authorization: run Spark, select candidates, inspect SAM overlays/cutouts, submit one reconstruction, retrieve artifacts, build an owner-only/local mesh inspection view, and test mapping/transforms/independent movement. Do not add public generation or the complete editor before the feasibility gate passes. Durable Workflow/DB runs, UI review, product editing, and publication are later slices in [NEXT_STEPS.md](NEXT_STEPS.md).
