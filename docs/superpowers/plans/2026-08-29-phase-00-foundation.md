# Phase 00 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a clean, reproducible Changas monorepo on branch `codex/phase-00-foundation` with a mobile-first Next.js shell, shared package boundaries, typed Supabase clients, local database extension migration, PWA baseline, and CI validation—without implementing marketplace features.

**Architecture:** Use a lightweight pnpm workspace with `apps/web` as the only executable application and three deliberately small shared packages: domain types, validation schemas, and environment/config helpers. The web app is server-first, with Supabase browser/server/admin clients isolated behind typed modules; the admin client is server-only and never receives public environment variables. The baseline shell uses Next App Router, Tailwind v4 design tokens, a metadata manifest, an inert production-only service-worker registration, and a health route.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript 6.0.3 strict mode, pnpm 11.19.0, Tailwind CSS 4.3.3, Vitest 4.1.11, Playwright 1.62.1, Supabase SSR 0.12.5, Supabase JS 2.112.4, Zod 4.5.4, ESLint 9.39.5, Prettier 3.9.6, and GitHub Actions. TypeScript 6.0.3 and ESLint 9.39.5 are selected because the current Next.js ESLint toolchain does not yet support TypeScript 7.0 or ESLint 10's rule API.

**Spec:** `CHANGAS_MASTER_PLAN.md`, especially `PHASE 00 — Foundation` (lines 1503–1580), repository/security rules (lines 338–516), and the required phase report (lines 2260–2319).

## Global Constraints

- Execute only `PHASE 00 — Foundation`; stop before Phase 01.
- Use branch `codex/phase-00-foundation`; never develop directly on `main`.
- Use `pnpm`; keep the workspace lightweight and avoid speculative features.
- Use Next.js App Router, React, TypeScript, responsive mobile-first design, installable PWA, and server-first architecture.
- Supabase foundation must include PostgreSQL migrations, Auth/Storage/Realtime-compatible configuration, and RLS-by-default documentation; no product tables are created in Phase 00.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must not appear in public environment variables, browser code, or committed secrets.
- Private documents must use private buckets and authorized/signed access when those features are implemented later; Phase 00 creates no private-document flow.
- Critical mutations remain server-authoritative; Phase 00 creates no business mutations.
- Migrations are deterministic and must not be rewritten after sharing.
- `.env.example` documents names without secret values; no `.env.local` or credentials are committed.
- `lint`, `typecheck`, unit tests, and `build` must run in a clean clone; local Supabase runtime is reported separately because the global CLI is unavailable.

---

### Task 1: Workspace and package boundaries

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `packages/domain/package.json`
- Create: `packages/domain/src/index.ts`
- Create: `packages/validation/package.json`
- Create: `packages/validation/src/index.ts`
- Create: `packages/config/package.json`
- Create: `packages/config/src/index.ts`

**Interfaces:**

- Produces workspace packages `@changas/domain`, `@changas/validation`, and `@changas/config`.
- `@changas/domain` exports `JsonPrimitive`, `JsonObject`, and `JsonValue`.
- `@changas/validation` exports `publicSupabaseEnvSchema` and `PublicSupabaseEnv`.
- `@changas/config` exports `getPublicSupabaseEnv()` and `getServiceRoleEnv()`; both throw a clear `Error` only when invoked with missing/invalid variables.

- [ ] **Step 1: Define package metadata and scripts**

  Set the root package to private, pin `packageManager` to `pnpm@11.19.0`, and provide `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format`, and `format:check` scripts that delegate to the workspace. Keep package exports pointed at source files so Next can transpile the small shared packages without a second build system.

- [ ] **Step 2: Define strict TypeScript defaults**

  Configure `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `isolatedModules`, `moduleResolution: "Bundler"`, and `noEmit` in `tsconfig.base.json`; each package and the web app extends it.

- [ ] **Step 3: Add the minimal shared types and env contracts**

  Implement JSON-compatible domain types, the Zod public Supabase environment schema, and server-side environment readers. The service-role reader must read only `SUPABASE_SERVICE_ROLE_KEY` and must not be imported from a client component.

- [ ] **Step 4: Install dependencies and create the lockfile**

  Run:

  ```powershell
  pnpm install
  ```

  Expected: `pnpm-lock.yaml` is created; no postinstall writes secrets or generated product data.

---

### Task 2: Next.js web foundation and baseline shell

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/eslint.config.mjs`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/error.tsx`
- Create: `apps/web/src/app/not-found.tsx`
- Create: `apps/web/src/app/health/route.ts`
- Create: `apps/web/src/lib/health.ts`
- Create: `apps/web/src/components/pwa/service-worker-register.tsx`
- Create: `apps/web/public/sw.js`

**Interfaces:**

- `GET /health` returns `{ status: "ok", service: "changas-web", timestamp: string }`.
- `getHealthPayload(timestamp?: string)` is deterministic and is unit-testable without a running Next server.
- `ServiceWorkerRegister` registers `/sw.js` only in production and does not cache navigations, API requests, or mutable Supabase data.

- [ ] **Step 1: Add a failing health unit test**

  Create `apps/web/src/lib/health.test.ts` asserting that `getHealthPayload("2026-08-29T00:00:00.000Z")` returns the exact status, service, and timestamp object.

- [ ] **Step 2: Run the focused unit test and observe the expected failure**

  Run:

  ```powershell
  pnpm test -- apps/web/src/lib/health.test.ts
  ```

  Expected: FAIL until `getHealthPayload` exists.

- [ ] **Step 3: Implement the minimal App Router shell**

  Create the typed root layout, metadata, accessible skip link, a restrained Changas baseline page with responsive mobile/desktop shell, error and not-found boundaries, health route, Tailwind v4 global tokens, and the safe service-worker component/script. Do not add profile, search, chat, jobs, payments, or admin UX.

- [ ] **Step 4: Run the focused unit test**

  Run the same command and expect PASS.

- [ ] **Step 5: Validate the production shell**

  Run:

  ```powershell
  pnpm --filter @changas/web build
  ```

  Expected: Next production build completes and includes `/health` and `/manifest.webmanifest` routes.

---

### Task 3: Typed Supabase client patterns and PWA manifest

**Files:**

- Create: `apps/web/src/lib/supabase/database.types.ts`
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `apps/web/src/lib/supabase/admin.ts`
- Create: `apps/web/src/app/manifest.ts`
- Create: `apps/web/src/app/icon.svg`

**Interfaces:**

- `createClient()` in `client.ts` returns `SupabaseClient<Database>` for browser components.
- `createClient()` in `server.ts` is async and returns a cookie-aware `SupabaseClient<Database>` for Server Components, Server Actions, and Route Handlers.
- `createAdminClient()` returns a server-only `SupabaseClient<Database>` using the service-role key and disabled session persistence.
- `Database` is the generated-types-compatible placeholder namespace for an empty foundation schema.

- [ ] **Step 1: Define the empty database contract**

  Add `Database` with empty `Tables`, `Views`, `Functions`, `Enums`, and `CompositeTypes` namespaces plus the shared `JsonValue` type so later generated database types can replace the file without changing imports.

- [ ] **Step 2: Implement browser and server clients**

  Use `createBrowserClient` and `createServerClient` from `@supabase/ssr`; read public variables through `@changas/config`; adapt Next's async `cookies()` API with `getAll` and guarded `setAll`. Do not put a service-role import in either client module.

- [ ] **Step 3: Implement the privileged client with an explicit server-only guard**

  Import `server-only` at the top of `admin.ts`, use `createClient` from `@supabase/supabase-js`, and configure `autoRefreshToken: false`, `persistSession: false`, and `detectSessionInUrl: false`.

- [ ] **Step 4: Add and validate the manifest**

  Return a valid `MetadataRoute.Manifest` with `name`, `short_name`, `start_url`, `scope`, `display: "standalone"`, theme/background colors, and the placeholder SVG icon. Keep the icon branded but clearly a placeholder for the later design phase.

- [ ] **Step 5: Run typecheck and build**

  Run:

  ```powershell
  pnpm typecheck
  pnpm --filter @changas/web build
  ```

  Expected: PASS without any environment file present because clients validate variables when called, not at module import/build time.

---

### Task 4: Supabase local structure and architecture documentation

**Files:**

- Create: `supabase/config.toml`
- Create: `supabase/seed.sql`
- Create: `supabase/migrations/20260830030140_foundation_extensions.sql` (generated by Supabase CLI)
- Create: `docs/architecture/overview.md`
- Create: `docs/decisions/0001-foundation.md`
- Create: `.env.example`
- Copy: `CHANGAS_MASTER_PLAN.md` from the user-provided Downloads specification

**Interfaces:**

- A fresh Supabase local project can apply the foundation migration deterministically.
- The migration installs only `pgcrypto` for UUID generation, `postgis` for future radius queries, and `pg_trgm` for future fuzzy search; it creates no user or product tables.
- Documentation defines public/private boundaries and the environment separation `local`, `preview/staging`, and `production`.

- [ ] **Step 1: Add the reproducible local Supabase config and empty seed**

  Configure local API, database, Studio, Auth, Realtime, and Storage services with ports documented in the README; set local Auth redirect URLs only. Keep `seed.sql` comment-only so Phase 00 cannot create fake production-like profiles or reviews.

- [ ] **Step 2: Add the foundation extension migration**

  Use `CREATE SCHEMA IF NOT EXISTS extensions;` followed by idempotent `CREATE EXTENSION IF NOT EXISTS ... WITH SCHEMA extensions;` statements for `pgcrypto`, `postgis`, and `pg_trgm`. Include comments explaining each extension's later approved use.

- [ ] **Step 3: Document architecture and security boundaries**

  Describe the workspace tree, server-first data flow, future mobile reuse boundary, browser/server/admin Supabase clients, secret handling, migration discipline, and the explicit Phase 00 non-goals.

- [ ] **Step 4: Document environment names without values**

  Add empty `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` entries. Mark the service-role key server-only and include local defaults in README prose rather than as secret values.

- [ ] **Step 5: Check migration and secret hygiene**

  Run:

  ```powershell
  rg -n "SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE|secret|service.role" --glob '!pnpm-lock.yaml' .
  git diff --check
  ```

  Expected: only documentation, type declarations, and server-only code mention the privileged key; no literal credential is present; diff check is clean.

---

### Task 5: CI, README, and validation report

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `README.md`
- Modify: root and package scripts only as needed after validation

**Interfaces:**

- GitHub Actions runs install, lint, typecheck, unit tests, and build on pushes and pull requests.
- `pnpm test` runs the deterministic Vitest suite; Playwright is configured for later phases but does not require a running server in Phase 00 CI.
- README provides clean-clone setup and local validation commands.

- [ ] **Step 1: Configure deterministic unit and E2E foundations**

  Configure Vitest for TypeScript source tests and Playwright with a Next start command placeholder-free for later E2E suites; do not add product E2E tests in Phase 00.

- [ ] **Step 2: Add CI with frozen installation**

  Use Node 24.20.0 and `pnpm/action-setup`, run `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. CI must not require Supabase secrets for the foundation build.

- [ ] **Step 3: Write setup documentation**

  Document prerequisites, `pnpm install`, copying `.env.example` to `.env.local`, `pnpm dev`, `/health`, PWA manifest inspection, local Supabase CLI commands when installed, validation scripts, workspace structure, branch scope, and the explicit Phase 00 stop boundary.

- [ ] **Step 4: Run all local gates**

  Run:

  ```powershell
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  git diff --check
  ```

  Record each result as `PASS`, `FAIL`, or `NOT RUN`; mark Supabase runtime integration and browser screenshot QA `NOT RUN` if no local service/browser is available.

- [ ] **Step 5: Inspect scope and commit coherent checkpoints**

  Review `git status`, `git diff --stat`, the file tree, dependency list, migration list, and CI workflow. Commit the foundation in small coherent commits, then produce the required Phase 00 report with exact commands, results, manual QA, limitations, and a stop statement. Do not merge, push, or begin Phase 01 without a separate approval.

---

## Self-review checklist

- [ ] Every Phase 00 task is represented: repository, pnpm workspace, `apps/web`, shared packages, strict TypeScript, lint/format, tests, Next, Tailwind tokens, Supabase structure/clients, env example, PWA, CI, Vercel build, docs, migration, health route, error/not-found, README.
- [ ] Explicit Phase 00 non-goals remain absent: profile UX, marketplace, chat, jobs, payments, and admin UI.
- [ ] No plan step relies on a placeholder or an undefined interface.
- [ ] Public and privileged Supabase client boundaries are type-consistent and security-reviewable.
- [ ] Final validation distinguishes local/static evidence from unavailable Supabase runtime and browser screenshot evidence.
