# Phase 09 Admin Trust & Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Changas a server-enforced admin surface for manual identity verification, catalog moderation, trust/safety restrictions, report handling, job inspection and audited administrative actions.

**Architecture:** PostgreSQL remains the authorization and audit authority. Browser routes are convenience only: every admin read/mutation goes through SECURITY DEFINER RPCs that call a single `require_admin()` guard backed by `user_roles.role = 'admin'`. Sensitive identity documents stay private and are exposed to authorized admins only through a short-lived signed-URL server route; moderation actions are append-only in `admin_audit_events` and reversible where appropriate.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase PostgreSQL/Auth/Storage/RLS, pgTAP, Vitest, Playwright, Lighthouse.

**Spec:** `CHANGAS_MASTER_PLAN.md` — Phase 09 plus sections 19 and 20.

## Global Constraints

- Work only on `codex/phase-09-admin-trust`.
- Baseline is `5d7d3072cbcc7d1420e515f8a1f5bb48c2881670` by explicit user override; Phase 08 is not considered approved by this plan.
- Do not implement Phase 10 beta-hardening journeys.
- Route hiding is never the security model.
- Every admin mutation is server-authoritative and audited.
- Normal authenticated users must have no direct DML/execute path for admin-only operations.
- Provider cannot approve/reject their own identity.
- Identity documents remain in private Storage.
- Applied migrations are append-only.
- Money remains integer minor units; Phase 09 must not introduce real payment-provider behavior.
- Moderation changes must preserve history and be reversible/auditable where appropriate.

---

### Task 1: Admin RBAC, audit authority and read models

**Files:**
- Create: `supabase/tests/phase-09-admin-rbac.sql`
- Create: `supabase/migrations/20260902170000_phase_09_admin_core.sql`
- Create: `apps/web/scripts/phase-09-admin-runtime.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces `public.admin_audit_events`.
- Produces `public.is_current_user_admin()`, private `public.require_admin()`, `public.list_admin_users(...)`, `public.get_admin_user_detail(uuid)`, `public.list_admin_providers(...)`, `public.get_admin_provider_detail(uuid)`, `public.list_admin_jobs(...)`, `public.get_admin_job_detail(uuid)`, `public.list_admin_audit_events(...)`.

- [ ] **Step 1: Write RED pgTAP tests**

Require the audit table, RLS enabled, no browser-table DML, admin RPC signatures and authenticated-only execute grants. Verify `require_admin()` is not executable by browser roles.

- [ ] **Step 2: Run CI and verify RED**

Expected: all inherited tests pass; only Phase 09 objects are absent.

- [ ] **Step 3: Implement minimal RBAC/audit migration**

`is_current_user_admin()` returns true only when `auth.uid()` has `user_roles.role = 'admin'`. Every admin RPC starts with `perform public.require_admin();`. `admin_audit_events` stores `actor_user_id`, `action_type`, `target_type`, `target_id`, safe JSON metadata and timestamp; no secrets/document content.

- [ ] **Step 4: Runtime with admin, normal user and outsider**

Create synthetic users through service role; promote exactly one to admin. Prove normal user cannot call admin reads, admin can, and direct audit inserts from authenticated clients fail.

- [ ] **Step 5: Wire runtime into CI and get GREEN**

---

### Task 2: Manual identity verification and private evidence access

**Files:**
- Create: `supabase/tests/phase-09-identity-review.sql`
- Create: `supabase/migrations/20260902171000_phase_09_identity_review.sql`
- Create: `apps/web/src/lib/admin/identity.ts`
- Create: `apps/web/src/app/api/admin/identity-documents/[documentId]/route.ts`
- Extend: `apps/web/scripts/phase-09-admin-runtime.mjs`

**Interfaces:**
- Produces `provider_identity_reviews` with immutable decision history.
- Produces `list_admin_identity_queue`, `get_admin_identity_case`, `decide_provider_identity_review`.
- Signed document route accepts a provider-document id, verifies current admin server-side, then creates a short-lived signed URL for that exact private object.

- [ ] **Step 1: RED tests**

Require review history table/RLS and RPCs. Require provider self-approval impossible, reject reason required, and approval/rejection records actor/time/reason.

- [ ] **Step 2: Implement identity state transition**

Allowed decisions: `APPROVE` -> provider `ACTIVE`; `REJECT` -> provider `REJECTED`. Decision RPC locks provider row, rejects actor == target provider, records previous/new status, then appends `admin_audit_events`.

- [ ] **Step 3: Implement private signed-document server route**

Use the existing server/privileged Supabase client split. Never expose service-role credentials or bucket-wide listing; only sign the stored `provider_documents.storage_path` after `requireAdmin` succeeds.

- [ ] **Step 4: Runtime proof**

Normal user cannot read another provider document or review queue. Admin can inspect metadata and decision history. Provider cannot approve themselves even if they know RPC/IDs.

---

### Task 3: Catalog CRUD and service moderation

**Files:**
- Create: `supabase/tests/phase-09-catalog-moderation.sql`
- Create: `supabase/migrations/20260902172000_phase_09_catalog_moderation.sql`
- Extend: `apps/web/scripts/phase-09-admin-runtime.mjs`

**Interfaces:**
- Produces admin RPCs for category/skill/synonym CRUD using existing normalized schema.
- Produces `service_moderation_state` and `admin_set_service_moderation(uuid,text,text)`.

- [ ] **Step 1: RED tests**

Require category/skill/synonym create/update/deactivate/delete constraints and a reversible service disable/flag state with reason/history.

- [ ] **Step 2: Implement catalog RPCs**

Validate slugs/names using existing table constraints. Deletion must fail when referential integrity would destroy used marketplace history; deactivation is the normal reversible path.

- [ ] **Step 3: Implement service moderation**

States: `CLEAR`, `FLAGGED`, `DISABLED`. `DISABLED` forces effective public availability off without deleting the service. Reversal to `CLEAR` is allowed and audited.

- [ ] **Step 4: Runtime proof**

Non-admin calls fail. Admin changes are reflected in public discovery behavior and every mutation creates one audit event.

---

### Task 4: Reports, review moderation, user/provider restrictions and suspension

**Files:**
- Create: `supabase/tests/phase-09-trust-safety.sql`
- Create: `supabase/migrations/20260902173000_phase_09_trust_safety.sql`
- Extend: `apps/web/scripts/phase-09-admin-runtime.mjs`

**Interfaces:**
- Produces a unified admin report queue over `conversation_reports` and `review_reports`.
- Produces `moderation_cases` / moderation decisions without deleting source reports.
- Produces `account_restrictions` with reversible active/revoked history.
- Produces admin RPCs to restrict/suspend/restore users/providers and moderate reported reviews/messages where authorized.

- [ ] **Step 1: RED tests**

Require queue visibility only for admins, suspension/restriction history, no destructive deletion of negative reviews, and restoration/reversal audit.

- [ ] **Step 2: Implement account restriction model**

Kinds: `RESTRICTED`, `SUSPENDED`; active rows include reason and actor. Provider status is synchronized to `RESTRICTED`/`SUSPENDED`; restore returns to the last safe previous provider status when available, otherwise `PROFILE_INCOMPLETE`.

- [ ] **Step 3: Implement review/message moderation disposition**

Do not mutate immutable review text. Store visibility/moderation disposition separately (`VISIBLE`, `HIDDEN_POLICY`, `RESTORED`) with reason and audit trail. Conversation evidence stays private and preserved.

- [ ] **Step 4: Runtime proof**

Prove normal users cannot inspect reports, provider cannot remove a bad review, admin can hide for a policy reason and later restore, and every state change is auditable.

---

### Task 5: Admin server layer and UI

**Files:**
- Create: `apps/web/src/lib/admin/server.ts`
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/src/app/admin/users/page.tsx`
- Create: `apps/web/src/app/admin/providers/page.tsx`
- Create: `apps/web/src/app/admin/identity/page.tsx`
- Create: `apps/web/src/app/admin/catalog/page.tsx`
- Create: `apps/web/src/app/admin/reports/page.tsx`
- Create: `apps/web/src/app/admin/jobs/page.tsx`
- Create: `apps/web/src/app/admin/audit/page.tsx`
- Create: `apps/web/src/app/admin/actions.ts`
- Add focused unit tests for server guard/error mapping.

**Interfaces:**
- `requireAdminPage()` redirects authenticated non-admins away only as UX; database RPC guards remain authoritative.
- Server actions call admin RPCs and revalidate affected admin/public pages.

- [ ] **Step 1: RED unit tests for admin guard/error mapping**

Require unauthenticated -> login redirect, authenticated non-admin -> forbidden/not-found UX, admin -> data access.

- [ ] **Step 2: Implement mobile-first admin layout**

Use compact navigation and list/detail cards, not a desktop dashboard squeezed onto mobile. Include clear status chips with text labels and accessible actions.

- [ ] **Step 3: Implement operational pages**

Users/providers search/detail, identity queue + decision form, catalog management, report queue + moderation actions, jobs inspection and audit viewer. Lists are bounded/paginated.

- [ ] **Step 4: Preserve raw-error boundary**

Translate RPC/Postgres errors into actionable admin copy; never show secrets or raw private document paths in normal UI.

---

### Task 6: E2E, security audit, report and STOP

**Files:**
- Create: `tests/e2e/phase-09-admin-trust.spec.ts`
- Create: `docs/reports/phase-09-admin-trust.md`
- Modify CI only for Phase 09 runtime/E2E steps.

- [ ] **Step 1: E2E authorization journey**

Normal account cannot use `/admin` functionality or admin mutations. Admin can search provider, inspect identity case, approve/reject with reason, and see audit event.

- [ ] **Step 2: E2E moderation journey**

Admin handles a report, disables/restores a service or hides/restores reported review, and verifies history remains visible.

- [ ] **Step 3: Private-document test**

Normal user cannot retrieve identity document route; admin receives only a short-lived authorized response for the requested document.

- [ ] **Step 4: Run final gates**

Require lint, typecheck, unit, production build, format/diff, clean Supabase reset, all pgTAP, Phase 03–09 runtimes, Lighthouse and Playwright desktop + Pixel 5.

- [ ] **Step 5: Write implementation report**

Record exact baseline/head/CI, migrations, RLS/grants, admin RPCs, audit model, identity privacy, moderation reversibility, test counts, Lighthouse and known limitations.

- [ ] **Step 6: CI the report commit and STOP**

Only declare Phase 09 PASS from the exact report/fix HEAD whose full CI is green. Do not start Phase 10.
