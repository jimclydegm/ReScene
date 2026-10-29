# ReScene foundation setup

Updated October 29, 2026. This is the implemented foundation; AI reconstruction and publication remain later phases.

## Deployment and account setup

- Vercel project: `jimclydegms-projects/rescene`; existing GitHub import reused.
- Production URL: [rescene-eta.vercel.app](https://rescene-eta.vercel.app).
- Foundation review: [PR #1](https://github.com/jimclydegm/ReScene/pull/1). GitHub deploys the feature branch to its stable, protected preview alias.
- Framework: Next.js 16.4.3; runtime Node 22; Functions region `iad1`.
- Vercel CLI: 65.2.0, authenticated. Upgrade to the available 65.7.0 release is recommended with `npm i -g vercel@latest`. Existing Vercel plugin guidance is installed.
- Shared Vercel MCP endpoint is already configured at `https://mcp.vercel.com`. OAuth remains pending **at Jim's request**; the CLI handles project operations.
- Neon project: `rescene-db`, AWS us-east-1; supplied database/Auth integration reused.
- Initial application migration: `20261029040000_init`. All eight application tables and the additional SQL constraints are applied. Managed `neon_auth` tables are not changed by our migrations.
- Neon trusted origins: production URL, the verified `codex/app-foundation` preview alias, and `http://127.0.0.1:3000`; localhost is enabled by the managed service.
- Canonical JWKS URL ends in `/.well-known/jwks.json` (the supplied `.js` path returned 404).
- Google sign-in is wired to Neon's configured shared development provider. Starting/finishing consent with a real Google identity was not exercised; configure own OAuth credentials for a public production launch.
- Local and deployed prototype currently share the supplied Neon branch/Auth and R2 `prototype` namespace. Create separate development data/Auth/storage credentials before handling real merchant data at scale.

## Credentials and environment

Local credentials are in ignored `.env.local`, with restricted file permissions. Production/preview credentials are stored as Vercel secrets; nonsecret model IDs, limits, and endpoint configuration are Vercel config variables. Existing Neon integration variables were preserved.

`CLOUDFLARE_API_TOKEN` is a local management credential; the app uses only the R2 S3 access/secret pair. It is not deployed as a runtime management token. No key, database password, cookie secret, or OIDC token belongs in GitHub, docs, screenshots, or public `NEXT_PUBLIC_*` variables.

The prototype keeps `GENERATION_ENABLED=false`. Provider clients are present, but no public generation endpoint can consume the model credentials yet.

## Run locally

```sh
npm ci
# For a new checkout, copy .env.example to .env.local and configure its values.
npm run db:generate
npm run dev
```

Open [localhost:3000](http://localhost:3000). The local auth proxy and backend use server-side secrets. `npm ci` and `npm run build` generate the Prisma client; generated files are ignored.

## Database migrations

```sh
npm run db:validate
npm run db:migrate
```

`prisma.config.ts` reads `.env.local`, then `.env`, without overriding platform environment values. Runtime uses pooled `DATABASE_URL` through `@prisma/adapter-neon`. Migration CLI uses `DIRECT_URL`, falling back to `DATABASE_URL_UNPOOLED` and then `DATABASE_URL`.

Review future migration SQL before deployment. The default build generates a client; it does not apply migrations. Do not execute the reference `prisma/constraints.sql` again: those constraints already exist in the initial migration.

## R2 storage and retention

The updated **Object Read & Write** credentials pass object write/read/delete checks. They are stored in `.env.local` and Vercel production/preview; production was redeployed with the new values. Normal app credentials do not administer bucket settings (S3 configuration calls return 403), so CORS/privacy were configured in Cloudflare's authenticated dashboard.

- Bucket `rescene` uses the `prototype` prefix. The public development URL is **disabled** and there is no custom domain; reads require a signature.
- Browser CORS matches [config/r2-cors.json](../config/r2-cors.json): GET/HEAD/PUT, Content-Type, two local origins, production, and the stable branch preview. Signed PUT/GET responses and preflight were tested; an unrelated origin receives no matching CORS authorization.
- **Jim chose to leave automatic staging deletion disabled.** No one-day object-expiration rule was saved. The existing seven-day incomplete-multipart abort rule is unchanged and does not delete completed uploads.
- Successful completion attempts to delete its staging object immediately. Rejected, abandoned, or recreated staging objects can remain; deliberate manual cleanup is needed. Accepted source/normalized assets live outside `prototype/staging/`.

To verify service access:

```sh
npm run services:check
```

`npx tsx scripts/configure-r2.ts` is an optional **CORS-only** admin utility; it requires bucket-settings permission and preserves lifecycle. Do not broaden the normal runtime credentials just to run it. It no longer creates an expiration rule. If keys change, update `.env.local` and corresponding Vercel secrets and redeploy; deployments capture environment values when built.

Uploads go directly to signed staging URLs. Completion verifies limits and actual image decoding, applies EXIF orientation, strips metadata from the normalized derivative, and writes immutable source/normalized objects. A VALIDATING asset state prevents concurrent completion requests from writing the same accepted asset.

## Verification commands

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run services:check
```

`services:check` performs a tiny R2 write/read/delete round trip, database/Auth reads, Meta model discovery, and a missing-job fal queue read. It performs **no model inference**. A fal 404 verifies a queue response, not successful reconstruction or billing entitlement.

With the app running, the explicit account/ownership check is:

```sh
npx tsx scripts/smoke-foundation.ts
```

It creates isolated `example.com` QA identities and a private QA scene, verifies sign-up/session, scene persistence, revision conflicts, origin checks, second-account denial, and sign-out. It writes temporary QA credentials only to an OS-temporary file with mode 0600. These test identities are not Jim's account. Normal CI runs the pure tests/build and does not use cloud credentials or consume inference credits.

To repeat the storage check against the same base URL, supply the credential-file path printed by the foundation check:

```sh
QA_CREDENTIAL_FILE=/absolute/path/to/rescene-qa.json npm run storage:smoke
```

For a deployed foundation check, set `SMOKE_BASE_URL=https://rescene-eta.vercel.app` when running `smoke-foundation.ts`; the output file retains that base for `storage:smoke`. The storage script also reads local database/R2 secrets for checksum/immutability checks. It creates synthetic QA scenes/images, tests CORS and direct upload, verifies orientation/resize/metadata stripping and asset lineage, replays completion, denies unsigned access, proves a reusable staging URL cannot overwrite accepted source, and rejects a malformed JPEG. It deletes only its own temporary test staging objects; private QA scene records/assets remain. No model calls run.

## Current validation

- Production build, lint, TypeScript, and six focused tests pass.
- Local and deployed API smoke checks pass all nine checks, including two-account isolation and sign-out.
- GitHub Actions passed clean install, schema validation, lint, six tests, production build, and typecheck without cloud secrets.
- Browser sign-in and dashboard rendering work with an isolated QA identity. A synthetic JPEG was selected and uploaded through Chrome on the live app; its signed preview loaded at 800×1600 and survived refresh.
- The upload screen has no horizontal overflow at a 390px phone breakpoint; the temporary browser viewport was restored afterward.
- Desktop sample renders and supports object selection, movement, hide/show, and reset.
- Meta model discovery confirms Spark 1.3 and SAM 3.1 access; Neon Auth/JWKS and database respond.
- Dependency overrides update the SDK's Better Auth and Zod dependencies past the reported high/critical advisories. Audit currently reports seven low-severity transitive advisories and no moderate/high/critical advisories. Full type/build/auth checks passed with these overrides.
- Nine deployed storage smoke checks pass: signed reservation, CORS allowlist, direct PUT/completion, normalized preview/persistence, database checksums/lineage, idempotent completion, unsigned denial, immutable accepted source, and malformed-image rejection. A 2400×1200 JPEG with EXIF orientation 6 becomes an 800×1600 metadata-free WebP.
- Cloudflare dashboard confirms private bucket settings and the CORS allowlist. Automatic staging deletion remains disabled at Jim's request.
- Live photo analysis, SAM masks, GPU reconstruction, model-output mapping, product editing, and publication are not implemented or validated in this foundation.
