# Phase 03 Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add anonymous public discovery, deterministic PostgreSQL search/radius matching, provider favorites, public SEO surfaces, and CI/runtime coverage without opening Phase 04 scope.

**Architecture:** Keep public pages server-rendered. A new, bounded `SECURITY DEFINER` discovery RPC returns a service-centric safe projection and performs eligibility, FTS/trigram, filters, ranking, and PostGIS distance matching inside PostgreSQL. Coarse curated locations may be URL-addressable; browser geolocation is sent only to a same-origin POST endpoint and never placed in a URL. Favorites remain authenticated and owner-only. Metadata, sitemap, and robots use only existing public projections.

**Tech Stack:** Next.js App Router 16, React/TypeScript, Supabase SSR, PostgreSQL FTS with `simple` configuration, `pg_trgm`, PostGIS geography, pgTAP, Vitest, Playwright, pnpm, GitHub Actions.

**Spec:** Execute only the user-approved Phase 03 requirements for public discovery/search/SEO. Do not implement AI, embeddings, chat, realtime messaging, offers, jobs, payments, reviews/reputation, notifications, admin, or Phase 04+ work.

## Global Constraints

- Work only on `codex/phase-03-discovery`, rooted at approved Phase 02 HEAD `61de1aabe0d74805202d6fccfdce76f45ac03074`.
- Do not edit published Phase 01/02 migrations. Every schema change is a new CLI-generated migration.
- Do not expose private tables, exact service-area centers, identity data, service-role credentials, or private fields to anonymous clients.
- Every new function/view/table has explicit grants and tests for both allowed and absent privileges.
- New production behavior is preceded by a failing test or pgTAP assertion, then the smallest implementation, then focused verification.
- Discovery is bounded and paginated. No fake ratings, jobs, reviews, verification, or availability claims.

---

## Task 0 — Confirm tool contracts and freeze the Phase 02 evidence

- [x] Verify branch and exact approved base commit.
- [x] Correct the Phase 02 report from the superseded commit/run to HEAD `61de1aa` and CI `33350924892`.
- [ ] Run the pinned Supabase CLI help commands required before generating the migration and changing CI: `supabase --help`, `migration --help`, `migration new --help`, `db reset --help`, `test db --help`, and `start --help`.
- [ ] Record the supported command forms in the report/validation notes.

## Task 1 — Write red unit contracts for discovery primitives

- [ ] Add `packages/domain/src/discovery.test.ts` covering Spanish lower-case/accent/whitespace normalization, stable modality/sort/filter parsing, bounded page size, and the deterministic ranking signal order.
- [ ] Add `packages/domain/src/location.test.ts` covering the coarse manual location catalog and rejection of unknown locations.
- [ ] Add money-format regression cases for nullable/ARS minor-unit discovery prices without changing the existing money contract.
- [ ] Keep test inputs and expected outputs explicit, for example:

```ts
expect(normalizeDiscoveryQuery("  ClÁSES   de Inglés ")).toBe(
  "clases de ingles",
);
expect(
  parseDiscoveryFilters({ mode: "remoto", sort: "price-asc", page: "0" }),
).toMatchObject({
  modality: "REMOTE",
  sort: "price-asc",
  page: 1,
});
expect(
  rankDiscoveryResult({
    textRelevance: 0.8,
    exactSkillMatch: true,
    exactCategoryMatch: false,
    tagMatch: true,
    synonymMatch: true,
    distanceMeters: 1500,
  }),
).toBeGreaterThan(
  rankDiscoveryResult({
    textRelevance: 0.8,
    exactSkillMatch: false,
    exactCategoryMatch: false,
    tagMatch: false,
    synonymMatch: false,
    distanceMeters: 500,
  }),
);
```

- [ ] Run the focused Vitest tests and confirm the new tests fail for missing exports before implementing the helpers.

## Task 2 — Write red database/security contracts

- [ ] Add `supabase/tests/phase-03-discovery.sql` before adding its migration. Cover explicit grants for the RPC, favorites table/RPC, and any public catalog reads; assert deliberate absence of anon access to favorites/private sources and absence of exact `service_areas.center` in the result contract.
- [ ] Add pgTAP fixtures/assertions for active/public eligibility, inactive provider/service/category/skill exclusion, normalization, the five required example searches, tags/synonyms/typo matching, all modality modes, price/offer filters, deterministic sort/ranking, pagination, and no-coordinate leakage.
- [ ] Add radius assertions for inside/outside, multiple service areas, inactive areas, remote services, and a query plan check that exercises `service_areas_center_gist_idx` without returning its center.
- [ ] Add favorite RLS assertions for owner select/insert/delete, cross-user denial, duplicate prevention, and no anon privileges.
- [ ] Use synthetic fixture UUIDs only; do not create reviews, jobs, or real identity data.
- [ ] Run the focused pgTAP file against the current schema and confirm expected failures before migration implementation.

## Task 3 — Create the Phase 03 migration using the pinned Supabase CLI

- [ ] Generate the filename with `pnpm dlx supabase@2.116.0 migration new phase_03_discovery` after the help checks; never hand-invent a migration filename.
- [ ] Add an immutable `public.normalize_search_text(text)` that lowercases, trims/collapses whitespace, and deterministically maps supported Spanish accents (`áéíóúüñ`) without a JavaScript-only dependency.
- [ ] Add generated normalized/search-document columns and justified indexes: GIN on weighted `tsvector`, GIN/GiST trigram indexes for selected title/description matching, and retain/use the existing GiST geography index on active service areas.
- [ ] Add controlled catalog entries/synonyms in this new migration where needed for `electricista`, `arreglar pc`, `pc se apaga`, `clases ingles`, and `instalar camara`; keep categories/skills active-only public.
- [ ] Add `public.search_discovery_services(...)` as bounded `SECURITY DEFINER`, with `SET search_path = pg_catalog, public, extensions`, validated input, no deprecated `auth.role()`, no unbounded result set, and explicit `EXECUTE` grants only to `anon`, `authenticated`, and `service_role` as needed. Return only provider name/avatar/slug/zone, service title/slug, active category/skill, modality, price fields, offers, and approximate distance/relevance; never center/private fields.
- [ ] Implement eligibility exactly: provider `ACTIVE` and not paused; service published and not paused; active category/skill; `IN_PERSON` includes `BOTH` for an in-person query, `REMOTE` includes `BOTH` for a remote query, and no location is required. For a radius, use a constructed geography point with `ST_DWithin` against active areas and select the minimum distance per service/provider; remote results remain eligible without an area.
- [ ] Implement deterministic recommended/nearest/price ascending/descending ordering with stable slug tie-breakers. Signals are text relevance, exact skill/category, synonym/tag match, and distance; no ratings/jobs/paid boosting. Keep the score in the returned contract only if useful to the UI.
- [ ] Add `public.provider_favorites` with composite primary key `(user_id, provider_user_id)`, owner-only RLS, foreign keys, explicit authenticated CRUD/service-role grants, no anon grants, and no duplicate rows.
- [ ] Add authenticated `SECURITY DEFINER` functions for setting/removing a favorite by public provider slug and listing the current user’s safe public favorite projections, with fixed search path and explicit execute grants.
- [ ] Revoke unintended public/anon privileges where the new objects could inherit them; do not add service-role privileges to browser code.
- [ ] Update `supabase/config.toml` only if needed for the Phase 03 local behavior, preserving the already-secure `auto_expose_new_tables = false`.
- [ ] Run the migration and focused pgTAP tests; iterate until the new contracts pass while all legacy suites remain unchanged and passing.

## Task 4 — Add server-side discovery access and safe geolocation transport

- [ ] Add typed Supabase RPC result/input adapters under `apps/web/src/lib/discovery/` that validate query parameters and discard unexpected response fields before rendering.
- [ ] Add `POST /api/discovery` for explicitly granted browser coordinates. Validate lat/lng/radius and call the bounded RPC with the server Supabase client; return only safe discovery rows and `distance_meters`, never echo coordinates.
- [ ] Add coarse manual locations (including Palermo/Buenos Aires representative options) in `packages/domain/src/location.ts`. Store only the option slug in URL state; map it to a coarse server-side centroid and do not expose exact service-area centers.
- [ ] Add a client location control with labels, keyboard focus, explicit geolocation permission action, manual selection, and a no-location path that preserves discovery.

## Task 5 — Build the public home, search, category, and result components

- [ ] Add red component/page tests for the required anonymous journeys and semantic controls before implementation.
- [ ] Replace the current foundation-only home with a mobile-first marketplace home: “¿Qué necesitás?” search, location control, representative active categories, nearby/relevant services, remote entry, provider CTA, and unobtrusive auth/account link. Keep lists primary; defer map UI and document the deferral.
- [ ] Add server-rendered `/buscar` with URL-addressable query/filter/sort/page state, bounded results, empty/error states, concise mobile filters, and sort controls. Use semantic headings/list/items and visible focus/touch targets.
- [ ] Add server-rendered `/categoria/[slug]` with stable SEO-friendly slugs, active catalog lookup, filtered services/providers, and not-found behavior for inactive/unknown categories.
- [ ] Add service-centric result cards showing only the safe result contract: display name/avatar/slug, approximate zone, service title/slug, active skill/category, modality, formatted price, offers, and approximate distance where applicable. Do not render unsupported reputation claims.
- [ ] Add provider/service links using `/p/[slug]` and `/p/[slug]/[serviceSlug]`; preserve current `[slug]` route naming that avoids Next dynamic-segment conflicts.
- [ ] Add a favorite control on public provider/result surfaces. Anonymous activation redirects to `/login?next=<safe public path>`; authenticated actions use the server action/RPC and preserve the public return path.
- [ ] Add `/account/favorites`, link it from account navigation, and render only the current user’s safe public provider favorites.

## Task 6 — Harden public provider/service pages and SEO

- [ ] Add red metadata tests for home/category/provider/service title, description, canonical, and OpenGraph values using only public fields.
- [ ] Add `generateMetadata` to provider and service pages without querying private tables or claiming rating/verification/availability. Keep public page data server-rendered.
- [ ] Add metadata for home/category pages, `sitemap.ts` for public home/active category/provider/service URLs, and `robots.ts` that permits public discovery and excludes private/account/provider-management routes.
- [ ] Ensure search/filter pages do not create misleading indexable URL explosions; use canonical behavior appropriate for query pages while stable category/provider/service pages remain indexable.
- [ ] Keep server actions that need the current authenticated user on `getUser()`; do not replace them with `getSession()` or copy Proxy-only behavior to Server Components.

## Task 7 — Runtime and browser integration coverage

- [ ] Add `apps/web/scripts/phase-03-discovery-runtime.mjs` using local Supabase env only. Create synthetic users/providers, activate only through the existing server-authoritative test path, seed services/areas, and assert search examples, eligibility, radius, multiple/inactive areas, modality, no center/private-field leakage, favorites RLS, and private storage behavior remains intact.
- [ ] Add `tests/e2e/phase-03-discovery.spec.ts` covering home, anonymous search, all/remote/in-person filters, category route, provider result opening, service opening, favorites auth redirect, and Pixel 5 viewport behavior. Use seeded synthetic catalog only.
- [ ] Keep Phase 01/02 runtime and pgTAP tests unchanged and run all suites together.
- [ ] Update `.github/workflows/ci.yml` only with commands confirmed by `--help`; the Ubuntu Docker job must perform clean start/reset, all pgTAP, Phase 01/02 runtime, Phase 03 runtime, seeded reset, and desktop/mobile Playwright E2E without cloud credentials.

## Task 8 — Seed, documentation, validation, and publication

- [ ] Extend `supabase/seed.sql` with minimal synthetic public providers/services/areas needed for meaningful examples and E2E, with no fake reviews/jobs/reputation.
- [ ] Run local non-Supabase gates: frozen install, lint, typecheck, unit, build, format check, and `git diff --check`.
- [ ] Run Supabase migration/reset/pgTAP/runtime gates where Docker is available; if local Docker is unavailable, record `NOT RUN` and rely on the remote Ubuntu evidence without overstating local proof.
- [ ] Run the full GitHub Actions workflow on the pushed branch and wait for the remote result. Do not claim PASS unless the final HEAD run is green; document external billing/runner blocking as `BLOCKED EXTERNAL` if it occurs.
- [ ] Create `docs/reports/phase-03-discovery.md` with branch, exact HEAD, commit list, migration names, search/normalization/FTS/trigram/ranking/radius/result architecture, favorite RLS, indexes, SEO/performance decisions, tests, CI/mobile evidence, deferred map/Phase04 scope, and limitations.
- [ ] Review diff for Phase 04+ leakage, run final status/log checks, push only `origin/codex/phase-03-discovery`, and stop for audit.
