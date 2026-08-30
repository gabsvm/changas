# Changas architecture

## Scope

Phase 02 adds the provider marketplace data layer and explicit public provider/service projections on top of the Phase 00 foundation and Phase 01 account/identity boundary. It deliberately contains no discovery/search engine, conversations, proposals, jobs, payments, reviews, notifications, admin dashboard, or automated KYC.

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

Server Components and Route Handlers call the cookie-aware server Supabase client. Browser components call the browser client with only the public URL and publishable key. A privileged client exists only in a server-only module and is reserved for explicitly authorized server-side/admin and local fixture operations. It is never imported by browser code.

The proxy refreshes claims with `auth.getClaims()`. The browser never supplies an authoritative user ID or provider status. Actions resolve the authenticated subject with `auth.getUser()`, then write rows keyed to that subject. Future critical mutations must validate on the server, enforce authorization in RLS/database policies, and record an auditable event when the domain requires it.

## Account and identity boundaries

- `profiles` contains fields suitable for a future deliberate public projection: display name, avatar URL, approximate zone, and bio.
- `profile_private` contains legal name, private contact details, date of birth, exact address, and DNI number. It has no public policy.
- `provider_profiles` owns onboarding progress, public provider presentation, and the provider status enum. A user can manage only `PROFILE_INCOMPLETE` and `IDENTITY_PENDING`; active providers can manage only marketplace pause/presentation fields, while protected status transitions require a later administrative flow.
- `provider_documents` stores metadata only. The binary files live in the private `identity-documents` Storage bucket under an authenticated user's UUID folder.
- `user_settings` is owner-only. `user_roles` is readable by its owner but has no client write policy; the Auth trigger creates the default `user` role.
- `categories`, `skills`, and `skill_synonyms` are a controlled catalog. `provider_skills` is separate from `services`, so one provider can have unrelated skills and multiple services.
- Provider-owned marketplace records include services, tags, experience, education, certifications, portfolio items, approximate service areas, availability rules, and availability blocks. Availability is descriptive metadata only; it does not book or reserve time.

The public/private split is intentional. Public pages read only explicit `public_*` views filtered to active/unpaused providers and published/unpaused services. They never select `profile_private`, exact coordinates, identity documents, certification evidence paths, or private portfolio records.

## Supabase boundaries

- `src/lib/supabase/client.ts` is for browser components.
- `src/lib/supabase/server.ts` is for Server Components, Server Actions, and Route Handlers.
- `src/lib/supabase/admin.ts` imports `server-only` and uses `SUPABASE_SERVICE_ROLE_KEY` only for future privileged server operations.
- `SUPABASE_SERVICE_ROLE_KEY` is never a `NEXT_PUBLIC_*` variable and never belongs in browser requests or committed values.
- Every future user/private table must enable RLS before it is considered complete, with deny-by-default policies.
- `profiles`, `profile_private`, `provider_profiles`, `provider_documents`, `user_settings`, `user_roles`, and all Phase 02 provider-owned tables enable RLS with explicit owner policies.
- Identity files and certification evidence use private buckets and folder-scoped policies. Portfolio media remains in a separate private bucket and is readable anonymously only when the corresponding portfolio row is explicitly public and the provider is active/unpaused.
- Public projection views expose only approved display/profile/professional fields, approximate service-area labels/radii, and intended public portfolio paths. Exact coordinates and private evidence remain inaccessible to client roles.
- `public.handle_new_user()` remains tightly scoped; the Phase 02 `private.activate_provider_for_test(uuid)` function is executable only by `service_role` and is not exposed through the public API.

## Environment separation

The supported environments are `local`, `preview/staging`, and `production`. Preview deployments must not receive arbitrary production write access. Secrets belong in the environment manager for the corresponding deployment, not in Git.

## Migration discipline

Migrations are generated with the versioned Supabase CLI, deterministic, and append-only after sharing. Phase 00 installs the extensions needed for UUID generation, radius-ready data, and fuzzy text matching. Phase 01 adds account tables, RLS, explicit grants, and the private identity bucket. Phase 02 adds the provider marketplace schema, indexes, explicit grants, public projections, private/publicly-intended Storage policies, pgTAP coverage, and synthetic catalog/demo fixtures. No reviews, jobs, payments, or real personal data are seeded.

## PWA and caching

The metadata manifest provides installability defaults and a placeholder icon. The production-only service worker uses a network-first fallback only for immutable Next static assets; it does not cache navigations, API responses, health data, or Supabase data. This prevents stale auth or economic state when those features arrive.
