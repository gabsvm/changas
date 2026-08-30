# Phase 02 Provider Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, mobile-first provider marketplace data layer and management/public surfaces without starting discovery/search or any later phase.

**Architecture:** Keep controlled catalog data (`categories`, `skills`, `skill_synonyms`) separate from provider-owned professional data and sellable `services`. Expose anonymous visitors only through explicit public views that filter active, published, and unpaused records; exact location, certification evidence, and account identity fields remain behind owner RLS. Provider status transitions stay server/admin/test-authoritative, while provider and service pause flags are independently owner-manageable.

**Tech Stack:** Next.js App Router, React, TypeScript, pnpm workspace, Zod, Supabase PostgreSQL/PostGIS/Storage, pgTAP, Supabase JS, Vitest, Tailwind CSS.

**Spec:** `CHANGAS_MASTER_PLAN.md` Phase 02 and the attached request “CHANGAS — EXECUTE PHASE 02 ONLY”.

## Global Constraints

- Work only on `codex/phase-02-provider-marketplace`, starting at approved Phase 01 HEAD `7ffa8b1b10b8226c7a7ad49cb4255513240a6679`.
- Do not start Phase 03 or implement search/discovery, AI, chat, proposals, jobs, payments, reviews, notifications, admin dashboard, or later-phase features.
- Preserve Phase 01 public/private identity boundaries and never expose `service_role` to browser code.
- Enable RLS on every new user-owned table; revoke implicit client grants and grant only explicit Data API privileges.
- A provider may manage professional records and pause states, but cannot self-promote to `ACTIVE` or alter another provider.
- Public views may expose only display name, public photo, approximate zone, bio, published skills/services, explicitly public professional records, public portfolio media, and an approved/test verification indicator.
- Exact address/coordinates and certification evidence remain private; portfolio media uses a deliberately public portfolio bucket only for items explicitly marked public.
- Use the versioned Supabase CLI and inspect help before new migration/test/runtime commands.
- Keep monetary values as integer minor units and validate every mutation on the server.

---

### Task 1: Establish domain and validation contracts with failing tests

**Files:**

- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/marketplace.ts`
- Create: `packages/domain/src/marketplace.test.ts`
- Modify: `packages/validation/src/index.ts`
- Create: `packages/validation/src/marketplace.test.ts`

- [x] **Step 1: Write failing domain tests**

Cover the five price models, three modalities, independent provider skills/services, and the rule that only `ACTIVE` providers can publish services.

- [x] **Step 2: Run the focused tests and verify RED**

Run `pnpm test -- packages/domain/src/marketplace.test.ts packages/validation/src/marketplace.test.ts`; the missing exports/contracts must fail for the intended reason.

- [x] **Step 3: Implement minimal shared constants and Zod schemas**

Add literal unions/constants for `PriceModel`, `ServiceModality`, `ScheduleType`, and schemas for service, provider profile, professional records, service areas, availability rules, and blocks. Enforce positive integer price amounts except `QUOTE`, `PER_UNIT` units, valid date/time ranges, and bounded text.

- [x] **Step 4: Run focused tests GREEN and full unit tests**

Run the focused command, then `pnpm test`.

- [x] **Step 5: Commit contracts**

Commit with `feat(marketplace): add provider marketplace contracts`.

---

### Task 2: Add the append-only Phase 02 database migration

**Files:**

- Create with `pnpm dlx supabase@2.116.0 migration new provider_marketplace`: `supabase/migrations/<timestamp>_provider_marketplace.sql`
- Modify: `supabase/seed.sql`
- Modify: `apps/web/src/lib/supabase/database.types.ts`

**Tables and invariants:**

- Catalog: `categories`, `skills`, `skill_synonyms`.
- Provider-owned: `provider_skills`, `services`, `service_tags`, `experiences`, `education`, `certifications`, `portfolio_items`, `service_areas`, `availability_rules`, `availability_blocks`.
- Extend `provider_profiles` with `public_slug`, `public_headline`, `marketplace_paused`, and `availability_paused`.
- Use enums/checks for price model, modality, schedule type, valid integer money, service publication, and temporal ranges.
- Store service-area centers as `extensions.geography(Point,4326)` with a GiST index; public views return only a human-readable approximate label and radius.
- Add updated-at triggers, ownership indexes, and a private `private.activate_provider_for_test(uuid)` function that is executable only by `service_role`/`postgres`, rejects missing or invalid targets, and is documented as temporary until Phase 09.
- Replace the Phase 01 provider update policy with separate onboarding/active policies so active providers can pause/resume without gaining status mutation authority; preserve the existing self-promotion denial.

**Public projections:** Create explicitly reviewed, security-barrier views for active/unpaused providers and published/unpaused services, skills, service tags, public experiences, public education, public certifications, public portfolio, approximate service areas, and provider availability summary. Views must not select `profile_private`, identity documents, exact coordinates, certification evidence paths, or private portfolio records.

**Storage:** Add private `provider-certification-evidence` (JPEG/PNG/PDF, 10 MiB) with owner-only object policies and public `provider-portfolio` (JPEG/PNG/WebP, 5 MiB) used only for explicitly public portfolio media. Keep `identity-documents` unchanged and private.

**Grants:** Revoke defaults on all new tables/views; grant catalog/view `SELECT` to `anon` and `authenticated`, owner CRUD to `authenticated` tables, and explicit DML to `service_role`. Grant no `anon` access to owner tables or private evidence.

- [x] **Step 1: Create the migration filename using the CLI**

Run the help-verified `migration new` command and use the generated filename without inventing a timestamp.

- [x] **Step 2: Add pgTAP tests before production SQL**

Create `supabase/tests/phase-02-grants.sql` and `supabase/tests/phase-02-rls.sql` with positive/negative grant checks, structural skill/service checks, public-view redaction checks, two-provider isolation, publication/pause behavior, all price/modality variants, provider status protection, and certification/portfolio Storage policy assertions.

- [x] **Step 3: Implement the migration minimally**

Write deterministic SQL in dependency order: enums/tables/indexes/triggers, policies/grants, views, Storage buckets/policies, test-only function, and limited catalog seed rows.

- [x] **Step 4: Add deterministic local/demo seed data**

Use `supabase/seed.sql` for synthetic provider examples and services covering all price models, modalities, offer states, skills, public professional records, availability, and portfolio metadata. Do not add reviews, jobs, payments, identity documents, or real personal data.

- [x] **Step 5: Update generated-equivalent database types**

Add all new tables, views, enums, inserts, updates, and function definitions to the typed Supabase database contract; no service-role types may be imported by client components.

- [x] **Step 6: Run SQL lint/static review and commit schema**

Run the local CLI help-verified database lint if the local runtime is available, inspect the migration for search paths/grants/views, and commit with `feat(db): add provider marketplace schema and policies`.

---

### Task 3: Implement server-authoritative provider management actions

**Files:**

- Create: `apps/web/src/app/(provider)/marketplace-actions.ts`
- Modify: `apps/web/src/app/(provider)/actions.ts` only where shared provider access helpers are safely reusable
- Create: `apps/web/src/components/provider/marketplace-form.tsx`
- Modify: `packages/validation/src/index.ts`

Implement authenticated server actions for provider settings, skills, services, pause/resume, experience, education, certifications/evidence upload, portfolio/public media upload, service areas, availability rules, and availability blocks. Every action must resolve `auth.getUser()`, validate FormData with shared Zod, use owner-scoped queries, return actionable validation/forbidden/conflict errors, clean up uploaded objects after metadata failure, and call `revalidatePath` only for Phase 02 routes. No action accepts an authoritative user/provider ID from the browser.

- [x] **Step 1: Add action tests or pure action payload tests first and verify RED**

Cover malformed prices, invalid modality, quote-with-price, invalid time ranges, unsafe publication, and owner-scoped mutation payloads.

- [x] **Step 2: Implement the actions and upload cleanup paths**

Use the authenticated server Supabase client for normal owner mutations; use no service-role client in the browser or client components. Keep the temporary activation function outside normal provider actions.

- [x] **Step 3: Add the management page and mobile-first forms**

Create `/provider/manage` with clear sections for profile/pause state, skill catalog selection/removal, service CRUD and pause state, experience, education, certifications/evidence, portfolio, service areas, and availability rules/blocks. Include loading/pending/error/success states and explain that paused records are retained.

- [x] **Step 4: Link provider account navigation and run UI/unit tests**

Link active providers from `/account` to management and preserve onboarding for incomplete providers. Run `pnpm test`, lint, and typecheck.

- [x] **Step 5: Commit management flow**

Commit with `feat(provider): add marketplace management flow`.

---

### Task 4: Implement anonymous public provider and service pages

**Files:**

- Create: `apps/web/src/app/p/[slug]/page.tsx`
- Create: `apps/web/src/app/p/[providerSlug]/[serviceSlug]/page.tsx`
- Create: `apps/web/src/components/marketplace/public-provider-profile.tsx`
- Create: `apps/web/src/components/marketplace/public-service-page.tsx`
- Modify: `apps/web/src/app/page.tsx` only to add a Phase 02-safe provider CTA/link if needed

Read only explicit public views with the cookie-aware server client, return `notFound()` for unpublished/paused/inactive rows, show approximate zone and public professional data, create public portfolio URLs only from the public portfolio bucket, and never select private identity tables or evidence paths. Do not add home search, category browsing, FTS, radius search UX, ranking, favorites, sitemap, or Phase 03 discovery.

- [x] **Step 1: Write render/data-shape tests first and verify RED**

Test that public DTOs contain allowed fields and exclude exact coordinates/address, DNI/private contact, evidence paths, and paused/unpublished services.

- [x] **Step 2: Implement public pages and responsive presentation**

Use server-rendered pages with accessible headings, empty states, links between provider/service pages, and no auth wall.

- [x] **Step 3: Add browser smoke coverage and capture mobile/desktop screenshots**

Run the available Playwright/browser tooling against the development server at approximately 360×800 and 1280px widths. Record commands and screenshots in the phase report; if tooling is unavailable, record `NOT RUN` rather than infer QA.

- [x] **Step 4: Commit public surfaces**

Commit with `feat(marketplace): add public provider and service pages`.

---

### Task 5: Run clean Supabase runtime security validation and CI

**Files:**

- Modify: `.github/workflows/ci.yml` only if Phase 02 runtime commands/assertions need extension
- Modify: `apps/web/scripts/supabase-runtime-security.mjs`
- Modify/create: `supabase/tests/phase-02-*.sql`
- Modify: `apps/web/src/lib/supabase/database.types.ts` if generated runtime schema reveals drift

Extend the existing synthetic runtime script to create two users/providers and verify multiple unrelated skills, every price model/modality, owner CRUD and cross-provider denial, paused/published public views, active-provider status protection, private certification evidence denial, public portfolio behavior, and no exact location leakage. Keep the identity-document regression suite intact. Use only local Supabase credentials emitted by the CLI; no Cloud secrets.

- [x] **Step 1: Start/reset/test only with help-verified Supabase CLI commands**

Run `pnpm dlx supabase@2.116.0 start`, `db reset --local --no-seed`, `test db --local`, and the local runtime script. Run `db lint --local` when supported and `migration list --local` for evidence. Stop the stack in a finally/always path.

- [x] **Step 2: Fix runtime failures from their actual error**

Do not weaken tests or rewrite prior Phase 01 assertions. If PostgreSQL rejects an assertion, correct only the assertion form after recording the cause.

- [x] **Step 3: Run all local validation gates**

Run install frozen, lint, typecheck, unit tests, build, format check, `git diff --check`, and available Supabase runtime checks. Record `PASS`, `FAIL`, or `NOT RUN` separately for local runtime and remote CI.

- [x] **Step 4: Push the phase branch and wait for remote CI**

Push only `origin/codex/phase-02-provider-marketplace`; inspect every job and log. Do not claim completion if CI or required runtime evidence is unavailable.

- [x] **Step 5: Update the Phase 02 report with exact evidence**

Create `docs/reports/phase-02-provider-marketplace.md` with branch/HEAD, commits, features and omissions, migrations, schema/index/RLS/grant decisions, Storage, tests, CI, screenshots/manual QA, limitations, deviations, and explicit STOP.

- [x] **Step 6: Final diff/scope review and stop**

Confirm no Phase 03+ files/features were added, branch and remote SHA match, working tree is clean, and stop after reporting the actual gate statuses.
