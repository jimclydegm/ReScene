# ReScene foundation setup

Updated October 29, 2026. This is the implemented foundation; AI reconstruction and publication remain later phases.

## Deployment and account setup

- Vercel project: `jimclydegms-projects/rescene`; existing GitHub import reused.
- Production URL: [rescene-eta.vercel.app](https://rescene-eta.vercel.app).
- Framework: Next.js 16.4.3; runtime Node 22; Functions region `iad1`.
- Vercel CLI: 65.2.0, authenticated. Existing Vercel plugin guidance is installed.
- Shared Vercel MCP endpoint is already configured at `https://mcp.vercel.com`. OAuth remains pending **at Jim's request**; the CLI handles project operations.
- Neon project: `rescene-db`, AWS us-east-1; supplied database/Auth integration reused.
- Initial application migration: `20261029040000_init`. All eight application tables and the additional SQL constraints are applied. Managed `neon_auth` tables are not changed by our migrations.
- Neon trusted origins: production URL and `http://127.0.0.1:3000`; localhost is enabled by the managed service.
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

## R2 access dependency

The supplied token is active and permits reads, but object PUT and bucket configuration returned **403 AccessDenied**. Token metadata contains read permissions. This means a successful HEAD/read check alone does not prove upload access.

Required for normal app operation: **Object Read & Write** access scoped to bucket `rescene`. To configure bucket CORS/lifecycle through the setup script, use appropriate bucket administration permissions temporarily, or configure those settings in Cloudflare's dashboard.

The ready-to-apply browser policy is [config/r2-cors.json](../config/r2-cors.json). Keep the bucket private. It allows GET/HEAD/PUT from the two local origins and production. It does not grant public access to objects. For staging cleanup, add a lifecycle rule expiring only `prototype/staging/` after one day.

Once the credential permissions are fixed:

```sh
npx tsx scripts/configure-r2.ts
npm run services:check
```

The configuration script preserves other bucket rules. If settings are configured manually, the deployed app only needs object read/write credentials. If keys change, update both `.env.local` and the corresponding Vercel secrets and redeploy; deployments capture environment values when built.

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

## Current validation

- Production build, lint, TypeScript, and six focused tests pass.
- Local API smoke check passes all nine checks, including two-account isolation and sign-out.
- Browser sign-in and dashboard rendering work with an isolated QA identity.
- The upload screen has no horizontal overflow at a 390px phone breakpoint; the temporary browser viewport was restored afterward.
- Desktop sample renders and supports object selection, movement, hide/show, and reset.
- Meta model discovery confirms Spark 1.3 and SAM 3.1 access; Neon Auth/JWKS and database respond.
- Dependency overrides update the SDK's Better Auth and Zod dependencies past the reported high/critical advisories. Audit currently reports seven low-severity transitive advisories and no moderate/high/critical advisories. Full type/build/auth checks passed with these overrides.
- R2 writes/CORS/lifecycle and an uploaded-photo round trip remain blocked on the read-only token.
- Live photo analysis, SAM masks, GPU reconstruction, model-output mapping, product editing, and publication are not implemented or validated in this foundation.
