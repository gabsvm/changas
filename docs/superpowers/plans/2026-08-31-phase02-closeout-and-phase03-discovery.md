# Phase 02 Closeout + Phase 03 Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the two remaining Phase 02 technical debts, then build the Phase 03 public discovery/search/SEO marketplace without starting Phase 04.

**Architecture:** Phase 02 service editing becomes a single PostgreSQL transaction exposed through one authenticated RPC so the service row and normalized tags cannot diverge. Phase 03 adds a server-backed discovery read model and search RPC using PostgreSQL FTS, synonyms/tags, pg_trgm and PostGIS while keeping public exact coordinates private. Public pages remain server-rendered and mobile-first; map code stays optional and unloaded by default.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase/PostgreSQL, RLS, PostGIS, pg_trgm, Vitest, pgTAP, Playwright.

**Spec:** `CHANGAS_MASTER_PLAN.md` Phase 03.

## Global Constraints

- Work outside `main`.
- Finish Phase 02 first on `codex/phase-02-provider-marketplace`.
- Create `codex/phase-03-discovery` from the new approved Phase 02 HEAD.
- No AI, chat, proposals, jobs, payments, reviews, notifications, admin dashboard or Phase 04+.
- Anonymous browsing must work.
- Never expose private/exact provider address or coordinates through public discovery responses.
- Keep money in integer minor units.
- Preserve RLS deny-by-default.
- Public marketplace pages must remain SSR/indexable where appropriate.

---

### Task 1: Transactional service + tags save

**Files:**
- Create: `supabase/migrations/20260831_phase_02_service_transaction.sql`
- Modify: `apps/web/src/app/(provider)/marketplace-actions.ts`
- Modify: `supabase/tests/phase-02-audit.sql`

**Interfaces:**
- Produces RPC `public.save_service_with_tags(...)` returning `id` and `public_slug`.
- RPC owns insert/update of the service plus replacement of normalized tags in one DB transaction.

- [ ] Add failing pgTAP coverage that demonstrates a tag validation failure leaves an existing service row unchanged.
- [ ] Add the server-authoritative authenticated RPC with owner checks and the existing publication/provider-skill constraints preserved.
- [ ] Change `saveService` to call only the transactional RPC after Zod/money validation.
- [ ] Re-run unit/DB/runtime gates.

### Task 2: Authenticated provider-management E2E

**Files:**
- Modify: `supabase/seed.sql`
- Modify: `tests/e2e/phase-02-public-surfaces.spec.ts`

**Interfaces:**
- Synthetic seeded provider credentials are test-only and deterministic.

- [ ] Add a deterministic password hash to the synthetic demo account suitable for local Supabase Auth.
- [ ] Add Playwright login through the real login UI.
- [ ] Assert authenticated `/provider/manage` renders service-management UI in desktop and Pixel 5 projects.
- [ ] Keep all fixtures synthetic.

### Task 3: Phase 02 verification/report

**Files:**
- Modify: `docs/reports/phase-02-provider-marketplace.md`

- [ ] Verify remote CI is green after the functional closeout commit.
- [ ] Record new HEAD/run and transactional/E2E evidence.
- [ ] Stop Phase 02 changes.

### Task 4: Create Phase 03 branch and discovery DB contract

**Files:**
- Create: `codex/phase-03-discovery` branch from Phase 02 closeout HEAD.
- Create: `supabase/migrations/20260831_phase_03_discovery.sql`
- Create: `supabase/tests/phase-03-discovery.sql`

**Interfaces:**
- Produces public/server search RPC returning only approved public fields plus computed distance/ranking data.

- [ ] Add FTS-ready searchable document across service title/description, skill/category, synonyms and service tags.
- [ ] Add pg_trgm fuzzy support where useful.
- [ ] Add PostGIS radius filtering on server without returning exact provider coordinates.
- [ ] Include remote services independently of radius when requested.
- [ ] Add deterministic baseline ranking including new-provider exposure and a rating-placeholder utility that does not fabricate reviews.
- [ ] Add favorites table/RLS for authenticated users.
- [ ] Add positive/negative pgTAP coverage.

### Task 5: Discovery domain/validation contracts

**Files:**
- Modify/Create focused files in `packages/domain/src` and `packages/validation/src`.

- [ ] Add search/filter/sort types.
- [ ] Add query validation for text, category, modality, price model, offers, radius/location and sorting.
- [ ] Add ranking utility tests.

### Task 6: Public discovery UI

**Files:**
- Modify public home.
- Create search/results/category routes/components under `apps/web/src/app`.

- [ ] Build public marketplace home with search and representative categories.
- [ ] Build list-first results with server-side search.
- [ ] Add manual location fields and optional browser geolocation UX.
- [ ] Add filters/sorting and remote-service handling.
- [ ] Add favorites control for authenticated users without adding an auth wall to browsing.
- [ ] Do not load a heavy map by default; omit map if no justified provider is selected.

### Task 7: SEO/indexability

**Files:**
- Add metadata/sitemap/robots/OpenGraph support in Next.js routes as appropriate.

- [ ] Add SEO metadata for home, category, provider and service surfaces.
- [ ] Add sitemap entries for public provider/service/category URLs.
- [ ] Preserve SSR/indexable public pages.

### Task 8: Search acceptance and mobile E2E

**Files:**
- Extend `supabase/seed.sql` with synthetic search examples only.
- Create/extend Playwright tests.

- [ ] Seed enough catalog/service data for `electricista`, `arreglar pc`, `pc se apaga`, `clases ingles`, `instalar camara`.
- [ ] Prove those queries return useful matches without AI.
- [ ] Prove radius filtering is server-backed and does not expose coordinates.
- [ ] Prove anonymous browsing/search.
- [ ] Run desktop and Pixel 5 smoke tests.

### Task 9: Final verification and report

**Files:**
- Create: `docs/reports/phase-03-discovery.md`

- [ ] Run frozen install, lint, typecheck, unit tests, build, format check and diff check.
- [ ] Run clean Supabase reset, all pgTAP suites and runtime checks in CI.
- [ ] Run Playwright in desktop and mobile projects.
- [ ] Record exact HEAD and CI run.
- [ ] STOP before Phase 04.
