# Changas

Changas is a mobile-first marketplace for people who want to offer practical skills, trades, and knowledge. This checkout contains **Phase 00 — Foundation**, **Phase 01 — Accounts, auth and provider identity skeleton**, **Phase 02 — Provider marketplace data and public provider/service pages**, and **Phase 03 — Public discovery, search and SEO** from [`CHANGAS_MASTER_PLAN.md`](./CHANGAS_MASTER_PLAN.md). Later marketplace phases remain intentionally out of scope.

## Prerequisites

- Node.js 24.20.0 or newer
- pnpm 11.19.0 (`corepack` or the pnpm installation supported by your environment)
- Docker Desktop only when running Supabase locally

## Local setup

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the local CLI output.
pnpm dev
```

The web app runs at `http://localhost:3000`. The health endpoint is `http://localhost:3000/health`, and the PWA manifest is `http://localhost:3000/manifest.webmanifest`.

The local Supabase defaults are `http://127.0.0.1:54321` for the API and `http://127.0.0.1:54323` for Studio. Populate `.env.local` with the local values printed by the Supabase CLI; never copy credentials into `.env.example` or Git.

## Supabase local workflow

The repository includes a CLI-generated `supabase/config.toml`, synthetic Phase 03 discovery seed data, and append-only migrations. With Docker Desktop running, use the versioned CLI:

```powershell
pnpm dlx supabase@2.116.0 start --exclude edge-runtime
pnpm dlx supabase@2.116.0 db reset
pnpm dlx supabase@2.116.0 migration list --local
pnpm dlx supabase@2.116.0 stop
```

Phase 01 adds Auth-backed account tables, owner-only RLS, and the private `identity-documents` bucket. Phase 02 adds an explicit catalog, provider-owned skills/services/professional records, availability metadata, public projection views, and separate private certification/public-portfolio buckets. All demo data is synthetic. Configure the Auth provider and use these local callback origins:

- `http://localhost:3000/auth/callback`
- `http://127.0.0.1:3000/auth/callback`

Recovery links return through `/auth/callback?next=/update-password`. Set `NEXT_PUBLIC_SITE_URL` only when the public origin differs from `http://localhost:3000`. Google is an optional clean integration point: configure the Google provider in Supabase first, then set `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true`.

After local Supabase is running, reset and test the append-only migrations and pgTAP security assertions:

```powershell
pnpm dlx supabase@2.116.0 db reset --local --no-seed
pnpm dlx supabase@2.116.0 test db --local
```

The no-seed reset keeps pgTAP isolated. Use `pnpm dlx supabase@2.116.0 db reset --local` before opening the synthetic public provider pages or running the browser smoke suite so the demo provider is loaded.

Phase 01, Phase 02, and Phase 03 use explicit Data API grants. Authenticated users receive only the requested owner-scoped table operations; public roles receive only catalog/public projection reads and the bounded discovery RPC; `service_role` receives explicit server-side/admin DML and is never client-safe; `anon` and `PUBLIC` receive no private table or favorite privileges. `supabase/config.toml` sets `auto_expose_new_tables = false` so local development does not hide missing grants. Provider status activation remains outside normal client mutations and is test/admin-only until Phase 09.

Phase 03 discovery is service-centric and anonymous by default. `/buscar` supports deterministic Spanish normalization, active catalog/synonym/tag matching, PostgreSQL full-text/trigram search, concise filters, coarse manual zones, and an explicit browser-geolocation action. The browser receives only public provider/service fields and approximate distance; PostGIS service-area centers stay inside the server-side RPC. Remote services do not require a location. Provider favorites are authenticated and owner-only at `/account/favorites`.

The local database test suite includes Phase 01/02 security assertions and the Phase 03 discovery/favorites contracts. `apps/web/scripts/phase-03-discovery-runtime.mjs` adds synthetic Supabase client tests for search examples, eligibility, radius privacy, remote behavior, and favorite isolation. The GitHub Actions Ubuntu job runs both runtime scripts, pgTAP, and desktop/Pixel 5 Playwright coverage without Supabase Cloud credentials.

To run the client and Storage integration security checks against the local instance, export the values from `supabase status -o env` and run:

```powershell
node apps/web/scripts/supabase-runtime-security.mjs
```

The script creates only synthetic users and fixture content, then removes them. It verifies owner read/write, cross-user private-row denial, provider self-activation denial, published public projections, private certification evidence, intended public portfolio media, identity-document privacy, and Storage access for owner/other-user/anonymous roles. The same reset, pgTAP, and integration checks run in the `supabase-integration` GitHub Actions job without Supabase Cloud credentials.

## Validation

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Phase 02 includes a small public-surface smoke suite in `tests/e2e/phase-02-public-surfaces.spec.ts`; Phase 03 adds public discovery journeys in `tests/e2e/phase-03-discovery.spec.ts`, both exercised at the `Pixel 5` mobile viewport. Run `pnpm build` followed by `pnpm test:e2e` after the seeded local reset. Map UI is intentionally deferred because list results are primary and no map provider is necessary to prove this phase.

## Workspace

```text
apps/web/          Next.js App Router PWA shell
packages/domain/   portable JSON/domain primitives
packages/validation shared Zod environment and account contracts
packages/config/   public and server-only environment readers
supabase/          local config, migrations, and seed policy
docs/              architecture and decision records
```

Phase 03 work is isolated on `codex/phase-03-discovery`. It stops before AI, embeddings, chat, realtime messaging, offers, jobs, payments, reviews/reputation, notifications, admin dashboard, and all later phases.
