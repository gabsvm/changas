# Phase 01 Accounts and Provider Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password authentication, SSR session handling, an editable personal account, resumable provider onboarding, private identity-document storage, and server-enforced ownership/status rules without implementing marketplace services or later phases.

**Architecture:** Keep Next.js server-first. Supabase Auth sessions use the existing browser/server clients plus a Next.js 16 `proxy.ts` that refreshes claims with `getUser()`/the current SSR pattern; all account/provider mutations are Server Actions that validate `FormData`, load the authenticated user, and redirect only after the server mutation succeeds. Store public profile fields separately from private identity fields, isolate provider onboarding/status, and keep identity files in a private Storage bucket with folder-scoped policies. Database RLS remains authoritative even if a browser or action is compromised.

**Tech Stack:** Existing Phase 00 stack: Next.js 16.3.3 App Router, React 19.2.8, TypeScript 6.0.3 strict mode, pnpm 11.19.0, Supabase SSR 0.12.5, Supabase JS 2.112.4, Zod 4.5.4, Vitest 4.1.11, Playwright 1.62.1, and Supabase CLI 2.116.0 for migration generation.

**Spec:** `CHANGAS_MASTER_PLAN.md`, `PHASE 01 — Accounts, auth and provider identity skeleton` (lines 1584–1638), identity/privacy rules (lines 425–516 and 1319–1341), and provider status enums (lines 629–641).

## Global Constraints

- Execute only `PHASE 01 — Accounts, auth and provider identity skeleton`; stop before Phase 02.
- Use branch `codex/phase-01-accounts`; do not modify `main` or the Phase 00 branch.
- Preserve the Phase 00 PWA/Vercel/Next.js architecture and use `pnpm`.
- Auth must use Supabase Auth with email/password; Google OAuth is a clean optional integration point and must not block email/password.
- Public identity includes display name, photo URL, approximate zone, bio, and later explicitly public portfolio/reviews; private identity includes DNI number/scans, date of birth, exact address, private contact data, and identity documents.
- Every user-related/private table has RLS enabled before completion; policies deny by default and prove owner-only access.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and never appears in browser bundles, public environment variables, browser requests, or committed values.
- Identity documents use a private Storage bucket with authorized folder-scoped access; no public URL is created.
- Provider status cannot be self-promoted to `ACTIVE`; the database policy must reject owner updates that attempt protected states.
- Critical mutations are server-authoritative and validated independently of client validation.
- Migrations are generated with the versioned Supabase CLI and are append-only.
- Do not finish skills/services, marketplace search, chat, jobs, payments, admin UI, automated KYC, or any Phase 02+ feature.
- Runtime Supabase/RLS tests are reported `NOT RUN` if Docker/Podman remains unavailable; static checks and the test file must still be included.

---

### Task 1: Domain statuses, validation contracts, and test-first boundaries

**Files:**

- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/provider-status.ts`
- Create: `packages/domain/src/provider-status.test.ts`
- Modify: `packages/validation/src/index.ts`
- Create: `packages/validation/src/accounts.test.ts`
- Modify: `packages/config/src/public.ts`
- Modify: `.env.example`

**Interfaces:**

- `ProviderStatus` is the exact union `NOT_STARTED | PROFILE_INCOMPLETE | IDENTITY_PENDING | UNDER_REVIEW | ACTIVE | REJECTED | SUSPENDED | RESTRICTED | DEACTIVATED`.
- `canSelfManageProviderStatus(status: ProviderStatus): boolean` returns true only for `PROFILE_INCOMPLETE` and `IDENTITY_PENDING`.
- `loginSchema`, `signUpSchema`, `passwordResetSchema`, `profileUpdateSchema`, `privateProfileUpdateSchema`, and `identityDocumentSchema` are exported Zod schemas.
- `getPublicSiteUrl(): string` returns `NEXT_PUBLIC_SITE_URL` or `http://localhost:3000` when absent; it rejects non-HTTP(S) URLs.

- [ ] **Step 1: Write the failing provider-status tests**

  Test that `PROFILE_INCOMPLETE` and `IDENTITY_PENDING` are self-manageable, while `ACTIVE`, `UNDER_REVIEW`, `SUSPENDED`, and `DEACTIVATED` are not. Import `canSelfManageProviderStatus` before creating it so the focused test fails for the intended missing-module reason.

- [ ] **Step 2: Run the focused status test and verify RED**

  ```powershell
  pnpm test -- packages/domain/src/provider-status.test.ts
  ```

  Expected: FAIL because `provider-status.ts` does not yet exist.

- [ ] **Step 3: Implement the minimal status helper and validation schemas**

  Add the exact status union/helper and schemas with bounds: email uses `z.email()`, passwords require at least 8 characters, display names are 2–80 characters, bio is at most 1000 characters, private phone/address/DNI fields have explicit maximum lengths, and identity files allow only JPEG/PNG/PDF up to 10 MiB with document types `DNI_FRONT`, `DNI_BACK`, or `SELFIE`. Do not accept a status field in any browser-facing update schema.

- [ ] **Step 4: Add validation boundary tests and run all package tests**

  Verify weak passwords and invalid document MIME/size fail, valid profile data passes, and a URL with a non-HTTP(S) protocol fails. Run:

  ```powershell
  pnpm test -- packages/domain/src/provider-status.test.ts packages/validation/src/accounts.test.ts
  ```

  Expected: PASS with all assertions exercising real schema/helper code.

- [ ] **Step 5: Add the site URL reader and environment documentation**

  Implement `getPublicSiteUrl()` without reading the service-role key and document the optional `NEXT_PUBLIC_SITE_URL` in `.env.example` with no value.

---

### Task 2: Accounts schema, RLS, private Storage, and pgTAP tests

**Files:**

- Create via CLI: `supabase/migrations/<generated>_accounts_identity.sql`
- Create: `supabase/tests/phase-01-rls.sql`
- Modify: `apps/web/src/lib/supabase/database.types.ts`
- Modify: `docs/architecture/overview.md`
- Create: `docs/decisions/0002-accounts-identity-boundaries.md`

**Interfaces:**

- Tables: `profiles`, `profile_private`, `provider_profiles`, `provider_documents`, `user_settings`, and `user_roles`.
- Enums: `provider_status`, `identity_document_type`, and `app_role`.
- Private bucket: `identity-documents` with `public = false`, max size 10 MiB, MIME allow-list JPEG/PNG/PDF.
- Auth trigger `public.handle_new_user()` creates the profile, private profile, settings, and default user role for every new Auth user.
- RLS permits users to read/update only their own rows; provider owners can set only `PROFILE_INCOMPLETE` or `IDENTITY_PENDING`; Storage access is limited to the caller's first folder segment equal to `auth.uid()`.

- [ ] **Step 1: Generate the migration with the versioned Supabase CLI**

  Run:

  ```powershell
  pnpm dlx supabase@2.116.0 migration new accounts_identity
  ```

  Use the generated timestamped filename; never hand-invent it.

- [ ] **Step 2: Add normalized identity/account tables and safe triggers**

  Create the enums and tables with UUID foreign keys to `auth.users`, UTC timestamps, bounded text, `provider_profiles.onboarding_step` constrained to a finite range, and unique `(user_id, document_type)` documents. Add a non-`SECURITY DEFINER` updated-at trigger. Add the required Auth insert trigger as a tightly scoped `SECURITY DEFINER` function with `set search_path = ''`, fully qualified table names, and revoked public/anon/authenticated execute grants; it inserts only the default account records.

- [ ] **Step 3: Add RLS policies and protected provider statuses**

  Enable RLS on every new table. Add owner `SELECT/INSERT/UPDATE` policies for editable account rows, owner-only document policies, owner-only settings policies, and no client write policy for `user_roles`. For `provider_profiles`, owner `WITH CHECK` permits only `PROFILE_INCOMPLETE` and `IDENTITY_PENDING`; no owner policy permits `ACTIVE`, `UNDER_REVIEW`, `SUSPENDED`, `RESTRICTED`, or `DEACTIVATED`.

- [ ] **Step 4: Add private identity Storage and folder policies**

  Upsert the `identity-documents` bucket as private with the exact size/MIME limits. Add `storage.objects` insert/select/update/delete policies for authenticated users only when `bucket_id = 'identity-documents'` and `storage.foldername(name)[1] = auth.uid()::text`. Add no anon policy and no public bucket.

- [ ] **Step 5: Add pgTAP tests for schema, ownership, privacy, and status**

  Create `supabase/tests/phase-01-rls.sql` that asserts RLS is enabled on all six tables, the owner policies exist, the identity bucket is private, Storage policies are authenticated/folder-scoped, and the provider owner policy does not include `ACTIVE`. Include behavior checks using two deterministic JWT subject UUIDs: owner profile update succeeds, another user's update changes zero rows, and an owner attempt to set `ACTIVE` raises SQLSTATE `42501`; switch to the privileged role only to inspect the untouched second user's row. Keep the test transaction-rolled-back.

- [ ] **Step 6: Update typed database types and document boundaries**

  Replace the empty table namespace with generated-types-compatible `Row/Insert/Update/Relationships` definitions for all Phase 01 tables and enum unions. Document that the types are manually synchronized until the first Supabase runtime is available, and that future public discovery must expose a deliberate public projection rather than `profile_private`.

---

### Task 3: SSR auth, callback, and server-authoritative account actions

**Files:**

- Create: `apps/web/src/proxy.ts`
- Create: `apps/web/src/lib/supabase/proxy.ts`
- Create: `apps/web/src/lib/auth/redirect.ts`
- Create: `apps/web/src/lib/auth/redirect.test.ts`
- Create: `apps/web/src/app/auth/callback/route.ts`
- Create: `apps/web/src/app/(auth)/actions.ts`
- Create: `apps/web/src/app/(account)/actions.ts`
- Create: `apps/web/src/app/(provider)/actions.ts`

**Interfaces:**

- `safeNextPath(value: FormDataEntryValue | string | null, fallback = "/account"): string` accepts only relative paths beginning with `/` and rejects `//`, schemes, and hostnames.
- Auth actions: `signIn`, `signUp`, `requestPasswordReset`, `updatePassword`, `signOut`, each returning `AuthActionState` or redirecting only after success.
- Account actions: `updateAccount`, returning `ActionState` after updating only the authenticated user's public/private rows.
- Provider actions: `startProviderOnboarding`, `saveProviderOnboarding`, `uploadIdentityDocument`, all resolving `auth.getUser()` server-side and never accepting authoritative user/status IDs from hidden fields.
- `updateSession(request: NextRequest): Promise<NextResponse>` refreshes SSR cookies with `createServerClient` and `getUser()`.

- [ ] **Step 1: Write the failing redirect-safety test**

  Test `/account`, `/provider/onboarding?step=2`, and `/` are accepted, while `https://evil.example`, `//evil.example`, and `javascript:...` resolve to the fallback. Import the missing helper first.

- [ ] **Step 2: Run the redirect test and verify RED**

  ```powershell
  pnpm test -- apps/web/src/lib/auth/redirect.test.ts
  ```

  Expected: FAIL because the helper is absent.

- [ ] **Step 3: Implement the safe redirect helper and session proxy**

  Add the helper and use Next.js 16's `src/proxy.ts` named `proxy` export with `config.matcher`, following the current Supabase SSR pattern: copy request cookies into the server client, call `supabase.auth.getUser()`, copy refreshed cookies to both request and response, and exclude static assets/favicon. Do not use `getSession()` as an authorization check.

- [ ] **Step 4: Implement auth callback and actions**

  Add PKCE code exchange in `/auth/callback`, safe `next` handling, email/password sign-in/sign-up, recovery email, password update, and sign-out. Use the existing cookie-aware server client, `getPublicSiteUrl()` for redirect origins, friendly non-sensitive errors, and no service-role client. Google OAuth should be represented by a clearly isolated integration point only when a provider button is rendered conditionally from configuration; do not add fake credentials.

- [ ] **Step 5: Implement account/provider server actions**

  Each action must parse input with the shared Zod schema, call `supabase.auth.getUser()`, reject missing users, and write only rows keyed by that authenticated ID. Account updates write `profiles` and `profile_private` separately. Onboarding creates/resumes one provider row, updates only the allowed step/status values, and never accepts `status` from form data. Document uploads validate the `File`, sanitize its basename, upload to `<auth.uid()>/<uuid>-<filename>` in the private bucket with `upsert: false`, insert metadata, remove the object if metadata insertion fails, and transition the provider to `IDENTITY_PENDING` without exposing a URL.

- [ ] **Step 6: Run action/unit type checks**

  Run:

  ```powershell
  pnpm test -- apps/web/src/lib/auth/redirect.test.ts
  pnpm typecheck
  ```

  Expected: PASS; runtime Supabase calls remain unexecuted until local Docker/Podman is available.

---

### Task 4: Auth, account, and provider onboarding UI

**Files:**

- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/sign-up/page.tsx`
- Create: `apps/web/src/app/(auth)/forgot-password/page.tsx`
- Create: `apps/web/src/app/(auth)/update-password/page.tsx`
- Create: `apps/web/src/app/(auth)/auth-error/page.tsx`
- Create: `apps/web/src/components/auth/auth-form.tsx`
- Create: `apps/web/src/app/(account)/layout.tsx`
- Create: `apps/web/src/app/(account)/account/page.tsx`
- Create: `apps/web/src/app/(account)/account/settings/page.tsx`
- Create: `apps/web/src/components/account/account-form.tsx`
- Create: `apps/web/src/app/(provider)/provider/onboarding/page.tsx`
- Create: `apps/web/src/components/provider/onboarding-form.tsx`

**Interfaces:**

- Public routes: `/login`, `/sign-up`, `/forgot-password`, `/update-password`, `/auth-error`.
- Protected routes: `/account`, `/account/settings`, `/provider/onboarding`.
- Client forms use React 19 `useActionState` with accessible labels, pending states, inline errors, success messages, and no client-side authority over user IDs/status.
- Account page reads the current user/profile server-side and shows private fields only to that user.
- Provider page shows `PROFILE_INCOMPLETE`, `IDENTITY_PENDING`, or other returned status as read-only state; it renders onboarding progress and document upload controls without document URLs.

- [ ] **Step 1: Build shared auth form states and navigation**

  Add links among auth routes, `aria-live` feedback, disabled submit states, password autocomplete attributes, and an optional Google button only when a configured OAuth URL exists. Do not render a nonfunctional social-login button.

- [ ] **Step 2: Build sign-up/login/recovery/update pages**

  Keep the forms mobile-first, use the Server Actions, preserve safe `next` values through hidden fields, and show generic credential errors. Sign-up should explain email confirmation when Supabase returns no session and redirect to `/account` when a session exists.

- [ ] **Step 3: Build account/settings pages**

  Read `auth.getUser()` and own rows server-side; redirect unauthenticated users to `/login?next=/account`. Render public profile fields and private identity fields in separate visual sections, submit to `updateAccount`, and add a sign-out form.

- [ ] **Step 4: Build resumable provider onboarding**

  Add a start-provider CTA on `/account`, a four-step progress shell, save/resume behavior backed by `onboarding_step`, basic personal/identity fields, document type selection, file input constraints, and a manual-review status panel. Do not render skills/services or verification approval controls.

- [ ] **Step 5: Run UI build and accessibility-oriented static checks**

  Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`. Check labels, focusable controls, keyboard navigation structure, readable mobile spacing, and the absence of private data in links/HTML attributes.

---

### Task 5: Phase 01 validation, documentation, report, and stop

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture/overview.md`
- Create: `docs/reports/phase-01-accounts.md`

- [ ] **Step 1: Add local Auth/Supabase setup instructions**

  Document email confirmation/recovery redirect URLs, local Supabase reset/test commands, private bucket expectations, the Google OAuth integration point, and the requirement to run with Docker/Podman before treating RLS as runtime-verified.

- [ ] **Step 2: Run every available validation gate**

  Run:

  ```powershell
  pnpm install --frozen-lockfile
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  pnpm format:check
  git diff --check
  pnpm dlx supabase@2.116.0 status
  pnpm dlx supabase@2.116.0 test db
  ```

  Record each result as `PASS`, `FAIL`, or `NOT RUN`; do not turn unavailable Docker into a false PASS.

- [ ] **Step 3: Perform manual smoke checks where runtime exists**

  With the web build running, check `/login`, `/sign-up`, `/forgot-password`, `/account` redirect behavior, `/provider/onboarding` redirect behavior, manifest preservation, and the absence of service-role text in client output. If Supabase is available, execute the full email-confirmation, profile ownership, private-document, resume, and self-activation denial checks.

- [ ] **Step 4: Inspect scope and commit Phase 01**

  Review the tree, migrations, RLS policies, storage policies, dependency changes, and `git diff --check`. Commit small coherent changes, list exact commit hashes in the report, and verify no Phase 02 files or product features were introduced.

- [ ] **Step 5: Push only the Phase 01 branch and stop**

  After final verification, push `codex/phase-01-accounts` to `origin` only if the user has authorized that push. Do not merge to `main`, start Phase 02, or claim runtime database approval when Docker/Podman is unavailable.

## Self-review checklist

- [ ] All Phase 01 tasks are covered: Auth, email/password, optional Google integration point, callback/session handling, profiles, provider activation, provider profiles/status, private identity fields/documents, resumable progress, settings, RLS, ownership/privacy/status tests, and temporary manual identity state UI.
- [ ] No services/skills/marketplace/chat/jobs/payments/admin functionality is present.
- [ ] Browser-facing actions never trust IDs, status, or approval fields from form data.
- [ ] `profile_private` and identity Storage are not exposed through public policies or URLs.
- [ ] The runtime database gate is reported separately from static TypeScript/UI gates.
