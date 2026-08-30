# Changas architecture

## Scope

Phase 01 adds account/authentication and the provider identity skeleton on top of the Phase 00 foundation. It deliberately contains no skills/services, marketplace catalog, conversations, jobs, payments, admin UI, or automated KYC.

## Workspace boundaries

```text
apps/web       Next.js App Router application and web-only UI
packages/domain      portable domain primitives for future web/native reuse
packages/validation  shared Zod contracts for inputs and environment boundaries
packages/config      public/server environment readers
supabase/       local configuration, migrations, and seed policy
docs/           architecture and decision records
```

The web application owns presentation and web runtime concerns. Business/domain contracts can live in `packages/domain` and `packages/validation` so a future Expo client can reuse rules without reusing the web UI package. All account/provider mutations use server actions and validate again on the server.

## Request/data flow

Server Components and Route Handlers call the cookie-aware server Supabase client. Browser components call the browser client with only the public URL and publishable key. A privileged client exists only in a server-only module and is reserved for explicitly authorized server operations in later phases.

The browser never supplies an authoritative user ID or provider status. Actions resolve the authenticated subject with `auth.getUser()`, then write rows keyed to that subject. Future critical mutations must validate on the server, enforce authorization in RLS/database policies, and record an auditable event when the domain requires it.

## Account and identity boundaries

- `profiles` contains fields suitable for a future deliberate public projection: display name, avatar URL, approximate zone, and bio.
- `profile_private` contains legal name, private contact details, date of birth, exact address, and DNI number. It has no public policy.
- `provider_profiles` owns onboarding progress and the provider status enum. A user can manage only `PROFILE_INCOMPLETE` and `IDENTITY_PENDING`; protected states require a later administrative flow.
- `provider_documents` stores metadata only. The binary files live in the private `identity-documents` Storage bucket under an authenticated user's UUID folder.
- `user_settings` is owner-only. `user_roles` is readable by its owner but has no client write policy; the Auth trigger creates the default `user` role.

The public/private split is intentional. Future discovery must use an explicit public view or projection and must never select `profile_private` or expose Storage object URLs.

## Supabase boundaries

- `src/lib/supabase/client.ts` is for browser components.
- `src/lib/supabase/server.ts` is for Server Components, Server Actions, and Route Handlers.
- `src/lib/supabase/admin.ts` imports `server-only` and uses `SUPABASE_SERVICE_ROLE_KEY` only for future privileged server operations.
- `SUPABASE_SERVICE_ROLE_KEY` is never a `NEXT_PUBLIC_*` variable and never belongs in browser requests or committed values.
- Every future user/private table must enable RLS before it is considered complete, with deny-by-default policies.
- `profiles`, `profile_private`, `provider_profiles`, `provider_documents`, `user_settings`, and `user_roles` enable RLS in the Phase 01 migration.
- Identity files use a private bucket and folder-scoped policies. The current UI does not create public or signed URLs.
- `public.handle_new_user()` is the only `SECURITY DEFINER` function in this migration. It has an empty search path, fully qualified references, only creates default account records, and has execution revoked from client roles.

## Environment separation

The supported environments are `local`, `preview/staging`, and `production`. Preview deployments must not receive arbitrary production write access. Secrets belong in the environment manager for the corresponding deployment, not in Git.

## Migration discipline

Migrations are generated with the versioned Supabase CLI, deterministic, and append-only after sharing. Phase 00 installs only the extensions needed for future UUID generation, radius queries, and fuzzy text matching. Phase 01 adds account tables, RLS, the private identity bucket, and a rolled-back pgTAP test. No fake profiles or reviews are seeded.

## PWA and caching

The metadata manifest provides installability defaults and a placeholder icon. The production-only service worker uses a network-first fallback only for immutable Next static assets; it does not cache navigations, API responses, health data, or Supabase data. This prevents stale auth or economic state when those features arrive.
