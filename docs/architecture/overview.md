# Changas foundation architecture

## Scope

Phase 00 establishes the engineering base only. It deliberately contains no accounts, provider profiles, marketplace catalog, conversations, jobs, payments, or admin workflows.

## Workspace boundaries

```text
apps/web       Next.js App Router application and web-only UI
packages/domain      portable domain primitives for future web/native reuse
packages/validation  shared Zod contracts for inputs and environment boundaries
packages/config      public/server environment readers
supabase/       local configuration, migrations, and seed policy
docs/           architecture and decision records
```

The web application owns presentation and web runtime concerns. Business/domain contracts can live in `packages/domain` and `packages/validation` so a future Expo client can reuse rules without reusing the web UI package.

## Request/data flow

Server Components and Route Handlers call the cookie-aware server Supabase client. Browser components call the browser client with only the public URL and publishable key. A privileged client exists only in a server-only module and is reserved for explicitly authorized server operations in later phases.

No Phase 00 module performs a database mutation. Future critical mutations must validate on the server, enforce authorization in RLS/database policies, and record an auditable event when the domain requires it.

## Supabase boundaries

- `src/lib/supabase/client.ts` is for browser components.
- `src/lib/supabase/server.ts` is for Server Components, Server Actions, and Route Handlers.
- `src/lib/supabase/admin.ts` imports `server-only` and uses `SUPABASE_SERVICE_ROLE_KEY` only for future privileged server operations.
- `SUPABASE_SERVICE_ROLE_KEY` is never a `NEXT_PUBLIC_*` variable and never belongs in browser requests or committed values.
- Every future user/private table must enable RLS before it is considered complete, with deny-by-default policies.
- Future private files must use private buckets and authorized/signed access.

## Environment separation

The supported environments are `local`, `preview/staging`, and `production`. Preview deployments must not receive arbitrary production write access. Secrets belong in the environment manager for the corresponding deployment, not in Git.

## Migration discipline

Migrations are generated with the versioned Supabase CLI, deterministic, and append-only after sharing. Phase 00 installs only the extensions needed for future UUID generation, radius queries, and fuzzy text matching. It creates no product tables and seeds no fake profiles or reviews.

## PWA and caching

The metadata manifest provides installability defaults and a placeholder icon. The production-only service worker uses a network-first fallback only for immutable Next static assets; it does not cache navigations, API responses, health data, or Supabase data. This prevents stale auth or economic state when those features arrive.
