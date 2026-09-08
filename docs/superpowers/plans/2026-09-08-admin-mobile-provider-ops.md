# Changas Admin Mobile + Provider Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make provider review/submission truthful, add audited admin provider enablement paths, and rebuild the Changas admin experience mobile-first.

**Architecture:** PostgreSQL remains authoritative for identity submission and all admin mutations. A shared responsive admin shell/components layer provides one consistent mobile-first UI across every `/admin` route, while existing route-specific RPC/read models are retained.

**Tech Stack:** Next.js 16 App Router, React, TypeScript strict mode, Tailwind CSS, Supabase/PostgreSQL RPCs, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-mobile-provider-ops-design.md`

## Global Constraints

- Do not use, create, edit, run or inspect GitHub Actions workflows.
- Do not trigger Vercel deployments; `vercel.json` must retain Git deployment disablement.
- Do not expose identity documents or weaken RLS/storage privacy.
- Manual activation must require admin authority, reason and immutable audit.
- Mobile layouts must work at 320, 360 and 390 CSS px without horizontal overflow.
- Changas admin visual language: `#FF6B35` primary, `#FFC857` pending, `#2563EB` info, `#D60060` urgent, dark operational surfaces.

---

### Task 1: Fix truthful provider identity submission

**Files:**
- Create: `supabase/migrations/20260908173000_admin_provider_ops.sql`
- Modify: `apps/web/src/app/(provider)/actions.ts`
- Modify: `apps/web/src/app/(provider)/provider/onboarding/documents/page.tsx`
- Modify: `apps/web/src/app/(provider)/provider/onboarding/review/page.tsx`
- Test: `apps/web/src/lib/ui/provider-submission.test.ts`

**Interfaces:**
- Produces RPC `submit_provider_identity_review()` with no args, returning `void`.
- Produces server action `submitProviderIdentityReview(previousState, formData): Promise<ActionState>`.

- [ ] Write a failing presentation/eligibility test requiring all `DNI_FRONT`, `DNI_BACK`, `SELFIE` document types.
- [ ] Add SQL RPC validating owner, profile/private completeness, all three document metadata rows and Storage objects, then setting `IDENTITY_PENDING` and step 4.
- [ ] Change upload action so upload only stores/replaces a file and does not imply review submission.
- [ ] Replace “continue with whatever progress you have” with a gated `Enviar a revisión` action.
- [ ] Ensure review page distinguishes `Perfil incompleto` from actually `En revisión`.

### Task 2: Add audited admin provider operations

**Files:**
- Same migration: `supabase/migrations/20260908173000_admin_provider_ops.sql`
- Modify: `apps/web/src/app/admin/actions.ts`
- Modify: `apps/web/src/lib/admin/server.ts`

**Interfaces:**
- RPC `admin_prepare_provider(target_user_id uuid) returns public.provider_status`.
- RPC `admin_activate_provider(target_user_id uuid, requested_reason text) returns public.provider_status`.
- Actions `prepareProviderAction(formData)` and `activateProviderAction(formData)`.

- [ ] Add SQL tests/runtime assertions for admin required, nonexistent user rejection, idempotent prepare, manual ACTIVE transition and audit rows.
- [ ] Implement security-definer RPCs calling `require_admin()`.
- [ ] Wire server actions and page revalidation.
- [ ] Extend admin user/provider read models where needed for onboarding/doc counts.

### Task 3: Build responsive admin shell

**Files:**
- Create: `apps/web/src/components/admin/admin-shell.tsx`
- Create: `apps/web/src/components/admin/admin-nav.tsx`
- Create: `apps/web/src/components/admin/admin-ui.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`
- Test: `apps/web/src/lib/ui/admin-navigation.test.ts`

**Interfaces:**
- Shared `adminNavigation` descriptors used by mobile and desktop navigation.
- Shared `AdminPageHeader`, `AdminCard`, `AdminStatusBadge`, `AdminEmptyState`.

- [ ] Add failing nav test for Resumen/Identidad/Usuarios/Más mobile grouping.
- [ ] Implement sticky compact header and dark operational canvas.
- [ ] Implement bottom nav on mobile and sidebar/rail on desktop.
- [ ] Implement More sheet/menu containing lower-frequency routes.
- [ ] Ensure at least 48px touch targets and safe-area bottom padding.

### Task 4: Rebuild dashboard around pending operations

**Files:**
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/src/lib/admin/server.ts`

- [ ] Add summary read helper using existing list RPCs with counts.
- [ ] Render pending identity/report/provider operational cards first.
- [ ] Render compact management shortcuts below.
- [ ] Add empty/all-clear state consistent with Smart-Intercom organization but Changas colors.

### Task 5: Rebuild Users and Providers mobile-first

**Files:**
- Modify: `apps/web/src/app/admin/users/page.tsx`
- Modify: `apps/web/src/app/admin/providers/page.tsx`

- [ ] Replace desktop-first detail blocks with stacked cards at mobile widths.
- [ ] Add provider state badge and contextual action matrix.
- [ ] Show `Invitar a completar perfil` when there is no provider profile.
- [ ] Show audited manual activation form with required reason and confirmation copy for absent/incomplete profiles.
- [ ] Link pending providers directly into identity review.
- [ ] Preserve restriction/suspension/restore actions.

### Task 6: Rebuild Identity queue mobile-first

**Files:**
- Modify: `apps/web/src/app/admin/identity/page.tsx`

- [ ] Put queue/pending count at top.
- [ ] Render mobile cards with status/document count/submission date.
- [ ] Keep exact private document access in detail.
- [ ] Make approve/reject controls full-width mobile actions with explicit confirmation semantics.
- [ ] Humanize raw enum statuses.

### Task 7: Apply shared admin design to remaining sections

**Files:**
- Modify: `apps/web/src/app/admin/catalog/page.tsx`
- Modify: `apps/web/src/app/admin/reports/page.tsx`
- Modify: `apps/web/src/app/admin/jobs/page.tsx`
- Modify: `apps/web/src/app/admin/payments/page.tsx`
- Modify: `apps/web/src/app/admin/audit/page.tsx`

- [ ] Replace slate/white desktop-first surfaces with shared admin primitives.
- [ ] Use mobile cards/stacked rows first; desktop tables only where useful.
- [ ] Keep every existing action/RPC intact.
- [ ] Ensure empty states and badges are consistent.

### Task 8: Regression coverage and verification

**Files:**
- Create: `tests/e2e/admin-mobile-revamp.spec.ts`
- Update tests only where real behavior changed.

- [ ] Cover 320/360/390 widths and no horizontal overflow.
- [ ] Cover mobile bottom nav and More menu.
- [ ] Cover user -> prepare provider and user -> manual activation with synthetic test users if test environment allows.
- [ ] Cover identity submission requiring all three documents.
- [ ] Run targeted tests, lint, typecheck, full unit tests, Next build and `git diff --check` locally.
- [ ] Do not use GitHub Actions and do not deploy Vercel.
