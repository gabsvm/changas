# Phase 01 Audit Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the already-published Phase 01 branch with explicit Data API grants, Node 24, greenable CI, Supabase runtime security tests, and the current `getClaims()` proxy refresh without starting Phase 02.

**Architecture:** Preserve the published Phase 01 schema and append one grant migration instead of rewriting history. Keep owner authorization in RLS, expose only explicit authenticated/service-role table privileges, and use the local Supabase CLI in GitHub Actions for reset plus pgTAP and client/Storage integration checks. Change only the proxy refresh call to `getClaims()`; Server Actions continue using `getUser()` for the current authenticated subject.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript 6.0.3, pnpm 11.19.0, Node.js 24.20.0, `@types/node` 24.13.3, Supabase CLI 2.116.0, Supabase JS 2.112.4, Vitest 4.1.11, GitHub Actions on `ubuntu-latest`.

**Spec:** User audit findings for Changas Phase 01; existing `CHANGAS_MASTER_PLAN.md` Phase 01 boundary; Supabase CLI help from `supabase@2.116.0` for `migration new`, `start`, `db reset --local`, `status -o env`, and `test db --local`.

## Global Constraints

- Work only on `codex/phase-01-accounts` and push only `origin/codex/phase-01-accounts`.
- Do not rewrite `20260830034005_accounts_identity.sql`; add a new CLI-generated migration.
- Do not start categories, skills, services, marketplace, search, chat, jobs, payments, admin UI, or Phase 02.
- Do not grant any Phase 01 table to `anon`; no identity document fixture may contain real personal data.
- Keep `service_role` server-only; explicit service-role table grants are never a reason to import that key into browser code.
- Record static, local runtime, and remote CI evidence separately; a blocked external runner remains `NOT RUN`.

---

### Task 1: Write and review the audit-fix plan

**Files:**

- Create: `docs/superpowers/plans/2026-08-30-phase-01-audit-fix.md`

- [ ] **Step 1: Confirm branch and baseline**

Run `git status --short --branch`, confirm `codex/phase-01-accounts`, and inspect the previous CI run with `gh run view` plus its annotations before changing workflow code.

- [ ] **Step 2: Record the actual CI cause**

Use the GitHub check annotation as the source of truth. The previous job was not started because the GitHub account was locked due to a billing issue; do not misdiagnose that event as a local test failure.

- [ ] **Step 3: Check the plan for scope and incomplete markers**

Search this plan for incomplete markers and invented paths, then execute it inline because the user explicitly authorized the audit fix and push.

---

### Task 2: Add explicit grants without rewriting published history

**Files:**

- Create via CLI: the timestamped `accounts_api_grants` migration file returned by `supabase migration new`
- Create: `supabase/tests/phase-01-grants.sql`
- Modify: `supabase/config.toml`

**Interfaces:**

- `authenticated` receives the exact table privileges requested by the audit.
- `service_role` receives explicit table CRUD privileges for future server-side/admin operations and never appears in browser code.
- `anon` receives no Phase 01 table privilege.

- [ ] **Step 1: Generate the migration with the inspected CLI**

Run `pnpm dlx supabase@2.116.0 migration new accounts_api_grants`, retain the generated timestamped filename, and do not alter `20260830034005_accounts_identity.sql`.

- [ ] **Step 2: Add explicit schema/table grants and revokes**

Grant `USAGE` on `public` to `authenticated` and `service_role`; grant `SELECT, INSERT, UPDATE` on `profiles`, `profile_private`, `provider_profiles`, and `user_settings` to `authenticated`; grant `SELECT, INSERT, UPDATE, DELETE` on `provider_documents`; grant `SELECT` on `user_roles`. Grant explicit DML (`SELECT, INSERT, UPDATE, DELETE`) on the six Phase 01 tables to `service_role` for future server-side/admin work, and explicitly revoke table privileges from `anon` and `public`.

- [ ] **Step 3: Disable implicit local Data API exposure**

Set `auto_expose_new_tables = false` under `[api]` in `supabase/config.toml`; retain `schemas = ["public", "graphql_public"]` and the existing ports.

- [ ] **Step 4: Add pgTAP grant/RLS assertions**

Create a transaction-scoped test that asserts the authenticated matrix, service-role privileges, absent anon privileges, enabled RLS, and owner policy predicates. Include two-user behavior checks from the existing RLS test for own-row writes, cross-user private-row denial, and `ACTIVE` self-promotion denial.

---

### Task 3: Move the repository and CI to Node 24

**Files:**

- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `packages/config/package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `docs/reports/phase-01-accounts.md`
- Modify: `pnpm-lock.yaml` only if the pinned dependency metadata requires it

- [ ] **Step 1: Pin runtime declarations**

Set the root engine to `>=24.0.0`, set GitHub Actions `node-version: 24.20.0`, and replace `@types/node` 26.4.0 with pinned `24.13.3` in each workspace package that declares it. Retire the previous runtime declaration from project documentation.

- [ ] **Step 2: Install with the existing lockfile**

Run `pnpm install --frozen-lockfile`; if pnpm reports the lockfile needs the pinned dependency update, run the minimal pinned install and review the lockfile diff.

- [ ] **Step 3: Keep CI checks independent**

Retain separate frozen install, lint, typecheck, unit test, and build steps in the validation job. Add explicit `actions/setup-node@v4` Node 24.20.0 setup and keep pnpm 11.19.0 pinned.

---

### Task 4: Add Supabase CI integration and client/Storage security fixtures

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `apps/web/scripts/supabase-runtime-security.mjs`
- Create: `apps/web/fixtures/synthetic-identity.txt`
- Modify: `docs/reports/phase-01-accounts.md`

**Interfaces:**

- The integration script consumes `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` emitted by local `supabase status -o env` and never cloud credentials.
- The script creates two confirmed synthetic users using local `service_role`, signs them in with the publishable key, tests Data API ownership, tests provider self-activation denial, and tests private Storage access.

- [ ] **Step 1: Add a deterministic synthetic fixture**

Create the smallest synthetic fixture with no human data and use a per-run UUID path under each test user's folder. Do not commit real identity documents.

- [ ] **Step 2: Write the runtime client/Storage test before wiring CI**

The script must fail if local credentials are missing, create users through the local admin API, assert User A can update/read their own profile, assert User B cannot read or update User A's `profile_private` row, assert User A's provider update to `ACTIVE` returns a permission error, upload the synthetic fixture as User A with an allowed image MIME type, download it as User A, and assert User B and an anonymous client cannot download it. Delete both synthetic users and the object in a `finally` block.

- [ ] **Step 3: Add the integration job from inspected CLI commands**

On `ubuntu-latest`, install Node 24.20.0/pnpm 11.19.0, run `pnpm dlx supabase@2.116.0 start`, run `pnpm dlx supabase@2.116.0 db reset --local --no-seed`, run `pnpm dlx supabase@2.116.0 test db --local`, export local credentials from `pnpm dlx supabase@2.116.0 status -o env`, execute the Node integration script, and always run `pnpm dlx supabase@2.116.0 stop`.

- [ ] **Step 4: Make integration failures visible**

Use a separate `supabase-integration` job with a timeout and make the validation job and integration job both required for a green CI run. Do not add cloud project IDs, service keys, or repository secrets.

---

### Task 5: Change only Proxy refresh validation to `getClaims()`

**Files:**

- Modify: `apps/web/src/lib/supabase/proxy.ts`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/decisions/0002-accounts-identity-boundaries.md`

- [ ] **Step 1: Add a focused proxy contract check if required by the current test setup**

Keep `getUser()` in account/provider Server Actions and callback code. Verify the proxy source calls `supabase.auth.getClaims()` and never `getSession()`.

- [ ] **Step 2: Implement the minimal proxy change**

Replace only the proxy refresh call with `await supabase.auth.getClaims()`, leaving cookie propagation and environment handling intact. Document that `getUser()` remains the Server Action user lookup.

---

### Task 6: Verify, report, push, and stop

**Files:**

- Modify: `docs/reports/phase-01-accounts.md`
- Modify: `README.md`

- [ ] **Step 1: Run all local gates**

Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`, and `git diff --check` on the final commit candidate.

- [ ] **Step 2: Run local Supabase runtime gates when available**

Run `pnpm dlx supabase@2.116.0 start`, `pnpm dlx supabase@2.116.0 db reset --local --no-seed`, `pnpm dlx supabase@2.116.0 test db --local`, and the client/Storage script. If Docker/Podman is unavailable, record each gate as `NOT RUN` and rely on the CI integration job for runtime evidence.

- [ ] **Step 3: Update the report with exact evidence**

Record the prior billing-lock cause, new migration filename, exact grants/revokes, Node pins, proxy change, local runtime result, integration result, CI run URL/conclusion, commit hashes, and any remaining external limitation. Do not write `Phase 01 approved` while a required gate is not PASS.

- [ ] **Step 4: Commit and push only this branch**

Create small commits, push `codex/phase-01-accounts` to `origin`, poll the resulting GitHub Actions run, and stop. Do not merge or begin Phase 02.
