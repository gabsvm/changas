# Changas

Changas is a mobile-first marketplace foundation for people who want to offer practical skills, trades, and knowledge. This checkout is limited to **Phase 00 — Foundation** from [`CHANGAS_MASTER_PLAN.md`](./CHANGAS_MASTER_PLAN.md).

## Prerequisites

- Node.js 20.9 or newer
- pnpm 11.19.0 (`corepack` or the pnpm installation supported by your environment)
- Docker Desktop only when running Supabase locally

## Local setup

```powershell
pnpm install
Copy-Item .env.example .env.local
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

Phase 00 creates no product tables or user seed records. The migration installs only `pgcrypto`, `postgis`, and `pg_trgm` for approved future phases.

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
packages/validation shared Zod environment contracts
packages/config/   public and server-only environment readers
supabase/          local config, migrations, and seed policy
docs/              architecture and decision records
```

The branch for this phase is `codex/phase-00-foundation`. Do not merge or begin Phase 01 until this branch has been audited and explicitly approved.
