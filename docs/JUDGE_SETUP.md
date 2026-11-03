# Run ReScene locally

Node.js 22 and npm are required. The showroom works without an API key. Live generation additionally needs a running local Postgres instance and your own Meta and fal keys. No Neon, Google OAuth, Cloudflare, or Vercel account is needed for these local paths.

## Prepared showroom

```sh
npm ci
npm run setup:judge
npm run dev:judge
```

Open http://127.0.0.1:3000/demo. Setup downloads the approved GLBs from the public [sample release](https://github.com/jimclydegm/ReScene/releases/tag/judge-assets-v1), checks every SHA-256 and byte length against the committed catalog, and saves them under ignored `.judge/objects`. Photos and scene backgrounds are included in the repository. Re-running setup reuses verified files.

Try Album/3D, object selection, replacement, colors, lighting, layouts, hide/show, screenshot download, Undo/Redo and the demonstration bag. These are real saved Meta-generated models. Browsing them submits no inference. Voice input and the shopping stylist are disabled in sample mode; they do not return simulated model answers. Studio links return to the showroom.

## Live generation with two external keys

Install/start Docker Desktop or Docker Engine with Compose. Stop the sample server before switching modes.

```sh
npm run setup:judge -- --live
```

This starts Postgres 17 on 127.0.0.1:55432, applies the repository migrations and seeds the 136 priced catalog listings with linked product photos and full details. Storage is private local files; setup generates a local signing secret. Add your keys to the ignored file `.judge/keys.env`:

```dotenv
MODEL_API_KEY=your_meta_model_api_key
FAL_KEY=your_fal_key
```

Then run:

```sh
npm run dev:judge:live
```

Open http://127.0.0.1:3000/dashboard. Local review uses an isolated developer identity; no shared login or password is published. Upload a permitted JPEG/PNG/WebP, run analysis, review the masks, reconstruct one to three objects, edit and save. In the showroom, Quiet workspace is a short stylist test: mark laptop/notebook as owned, keep the tumbler, enter $100 and request two mouse alternatives. Prices and budget checks come from the seeded database; Spark interprets/ranks actual candidates. Use Speak for an optional real transcription.

Live requests are paid through your accounts. Meta/fal charges are separate. Model availability and sufficient credit are required. Requests are saved before submission; an interrupted response may have been charged and is not automatically resubmitted. Sample browsing, migrations and seeding do not invoke models. Remote inference receives submitted photos/masks and audio where used. Local fal inputs are uploaded through fal's storage API because hosted inference cannot fetch localhost; consult your provider retention/terms before using private data.

The app binds to 127.0.0.1. The local identity rejects non-loopback hosts, remote database URLs, production builds and Vercel deployment. Do not expose this development mode through a tunnel or public proxy. Hosted deployments retain Neon Managed Auth, Neon Postgres and private R2.

### Existing Postgres instead of Docker

Create an isolated local database with user/password/database `rescene` on 127.0.0.1:55432, then use `npm run setup:judge -- --live --existing-postgres`. This switch skips Docker startup only; migrations and seeding are identical. Never point the judge launcher at a production database.

### Files and shutdown

The launchers ignore cloud credentials in `.env.local`, set local configuration explicitly, and read only the two inference keys from `.judge/keys.env` or your shell. Local files, generated images, session secret and receipts stay in ignored `.judge/` (including `.judge/workflows/` for durable local jobs). Docker persists database state in a named volume. Stop the app with Ctrl+C and Postgres with `docker compose -f compose.judge.yaml stop`. No automatic deletion runs.

To use another local HTTP port, set `JUDGE_PORT=4317 npm run dev:judge:live`; the generated links use that port. If 3000 is busy, stop the other server or choose a port. Judge playback uses its own `.judge/next/` development cache, so it can run beside the normal authoring server on a different port. Stop the normal authoring server before a production build, which owns `.next/`. Sample and live judge modes share their cache; stop one before starting the other. Lint and TypeScript exclude local data and diagnostic captures.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

`npm run check` also validates Prisma and runs lint. Production builds must use the normal environment, not a local review launcher. The main test suite uses mocked providers or pure geometry; it does not spend inference credits. Diagnostic scripts elsewhere in `scripts/` include paid operations—do not run them as a blanket setup step.

For an independent cloud deployment, follow [production setup](SETUP.md). That path requires your own database/auth/storage configuration; the two-key promise applies to local live review only.
