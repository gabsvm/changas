# Changas

Changas is a mobile-first marketplace foundation for people who want to offer practical skills, trades, and knowledge. This checkout contains **Phase 00 — Foundation** and **Phase 01 — Accounts, auth and provider identity skeleton** from [`CHANGAS_MASTER_PLAN.md`](./CHANGAS_MASTER_PLAN.md). Later marketplace phases are intentionally not started.

## Prerequisites

- Node.js 24.20.0 or newer
- pnpm 11.19.0 (`corepack` or the pnpm installation supported by your environment)
- Docker Desktop only when running Supabase locally

## Local setup

```powershell
pnpm install
Copy-Item .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the local CLI output.
pnpm dev
```

The web app runs at `http://localhost:3000`. The health endpoint is `http://localhost:3000/health`, and the PWA manifest is `http://localhost:3000/manifest.webmanifest`.

The local Supabase defaults are `http://127.0.0.1:54321` for the API and `http://127.0.0.1:54323` for Studio. Populate `.env.local` with the local values printed by the Supabase CLI; never copy credentials into `.env.example` or Git.

## Supabase local workflow

The repository includes a CLI-generated `supabase/config.toml`, an empty seed policy, and one foundation migration. With Docker Desktop running, use the versioned CLI:

```powershell
pnpm dlx supabase@2.116.0 start
pnpm dlx supabase@2.116.0 db reset
pnpm dlx supabase@2.116.0 migration list --local
pnpm dlx supabase@2.116.0 stop
```

Phase 01 adds Auth-backed account tables, owner-only RLS, and the private `identity-documents` bucket. It creates no product/services catalog or fake user records. Configure the Auth provider and use these local callback origins:

- `http://localhost:3000/auth/callback`
- `http://127.0.0.1:3000/auth/callback`

Recovery links return through `/auth/callback?next=/update-password`. Set `NEXT_PUBLIC_SITE_URL` only when the public origin differs from `http://localhost:3000`. Google is an optional clean integration point: configure the Google provider in Supabase first, then set `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true`.

After local Supabase is running, reset and test the append-only migrations and pgTAP security assertions:

```powershell
pnpm dlx supabase@2.116.0 db reset --local --no-seed
pnpm dlx supabase@2.116.0 test db --local
```

Phase 01 uses explicit Data API grants. Authenticated users receive only the requested owner-scoped table operations; `service_role` receives explicit DML for server-side/admin operations and is never client-safe; `anon` and `PUBLIC` receive no Phase 01 table privileges. `supabase/config.toml` sets `auto_expose_new_tables = false` so local development does not hide missing grants.

To run the client and Storage integration security checks against the local instance, export the values from `supabase status -o env` and run:

```powershell
node apps/web/scripts/supabase-runtime-security.mjs
```

The script creates only synthetic users and fixture content, then removes them. It verifies owner read/write, cross-user private-row denial, provider self-activation denial, and private Storage access for the owner versus another user and anonymous access. The same reset, pgTAP, and integration checks run in the `supabase-integration` GitHub Actions job without Supabase Cloud credentials.

## Validation

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

The Playwright configuration is ready for later user journeys; no product E2E journey is included in Phase 00. Browser screenshot QA and a live Supabase runtime require local services/tools and are recorded separately in the phase report.

## Workspace

```text
apps/web/          Next.js App Router PWA shell
packages/domain/   portable JSON/domain primitives
packages/validation shared Zod environment and account contracts
packages/config/   public and server-only environment readers
supabase/          local config, migrations, and seed policy
docs/              architecture and decision records
```

The Phase 01 branch is `codex/phase-01-accounts`. This phase stops before Phase 02 and must be audited before any later phase starts.
