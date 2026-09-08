# Premium Product Redesign V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Changas into one coherent premium mobile-first marketplace PWA across public discovery, authenticated navigation, Activity/Jobs, chat, onboarding, and provider management without changing backend contracts.

**Architecture:** Keep the existing server-first Next.js App Router architecture and Supabase actions. Add a shared server `ConsumerShell` for marketplace/public routes, a dedicated `/activity` hub for jobs and notifications, presentation helpers for human labels, progressive disclosure for mobile search, and immersive chat detail behavior. Reuse the current account/provider shells and mutation contracts.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, Vitest, Playwright, Supabase.

**Spec:** `docs/superpowers/specs/2026-09-08-premium-product-redesign-v2-design.md`

## Global Constraints

- Work only on `codex/premium-product-redesign-v2`.
- Do not change Supabase migrations, RLS, grants, Storage policies, payment/provider lifecycle contracts, or Phase 12 scope.
- Do not create, trigger, or use GitHub Actions workflows for verification.
- Do not create or trigger Vercel deployments unless the user explicitly asks later.
- Preserve the current palette in `docs/design/changas-brand-system.md`.
- Use Plus Jakarta Sans Variable as the single UI/display family.
- Minimum 48px mobile targets and safe-area handling.

---

### Task 1: Typography and global product tokens

**Files:**
- Modify: `apps/web/src/lib/ui/brand-theme.test.ts`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Produces: CSS variable `--font-plus-jakarta` applied to `body`; `.font-display` and normal UI text resolve to Plus Jakarta Sans.

- [ ] **Step 1: Write the failing typography contract test**

Add assertions:

```ts
expect(globals).toContain("--font-display: var(--font-plus-jakarta)");
expect(globals).toContain("--font-sans: var(--font-plus-jakarta)");
expect(globals).not.toContain('"Trebuchet MS"');
```

- [ ] **Step 2: Run test and confirm RED**

Run: `pnpm vitest apps/web/src/lib/ui/brand-theme.test.ts --run`
Expected: failure because legacy Trebuchet/Arial declarations remain.

- [ ] **Step 3: Implement Plus Jakarta Sans**

In `layout.tsx`:

```ts
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});
```

Apply `className={plusJakarta.variable}` to `<html>`. Point both Tailwind font tokens and `body` to the variable. Reduce legacy excessive tracking where global helpers are introduced.

- [ ] **Step 4: Run typography test and typecheck**

Run: `pnpm vitest apps/web/src/lib/ui/brand-theme.test.ts --run && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(ui): adopt Plus Jakarta Sans"`

---

### Task 2: Shared consumer shell

**Files:**
- Create: `apps/web/src/components/ui/consumer-shell.tsx`
- Create: `apps/web/src/lib/ui/consumer-shell.test.ts`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/buscar/page.tsx`
- Modify: `apps/web/src/app/categoria/[slug]/page.tsx`
- Modify: `apps/web/src/app/p/[slug]/page.tsx`
- Modify: `apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx`

**Interfaces:**
- Produces: `ConsumerShell({ children, maxWidth?, footer? })`
- Consumes: `createClient`, `getUnreadNotificationCount`, `AuthenticatedBottomNav`.

- [ ] **Step 1: Write a source-level shell contract test**

Test that the component contains authenticated/anonymous branches, `AuthenticatedBottomNav`, and that public marketplace pages import/use `ConsumerShell` rather than hard-coded `Ingresar` headers.

- [ ] **Step 2: Run and confirm RED**

Run: `pnpm vitest apps/web/src/lib/ui/consumer-shell.test.ts --run`
Expected: missing module/usage failure.

- [ ] **Step 3: Implement `ConsumerShell`**

Server component outline:

```tsx
export async function ConsumerShell({ children, maxWidth = "max-w-7xl" }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const unreadCount = user ? await getUnreadNotificationCount(supabase) : 0;
  return <main className={user ? "mobile-content-with-nav ..." : "..."}>...</main>;
}
```

Header shows `Mi cuenta` when logged in and `Ingresar` when anonymous.

- [ ] **Step 4: Apply to five marketplace routes**

Remove duplicated outer `<main>`/header wrappers while preserving each page's business queries, metadata, and SEO.

- [ ] **Step 5: Run shell test/typecheck**

Run: `pnpm vitest apps/web/src/lib/ui/consumer-shell.test.ts --run && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat(ui): unify marketplace consumer shell"`

---

### Task 3: Activity hub and Jobs nav mapping

**Files:**
- Modify: `apps/web/src/lib/ui/navigation.test.ts`
- Modify: `apps/web/src/lib/ui/navigation.ts`
- Modify: `apps/web/src/components/ui/authenticated-bottom-nav.tsx`
- Create: `apps/web/src/app/(account)/activity/page.tsx`
- Modify: `apps/web/src/app/(account)/jobs/page.tsx`
- Modify: `apps/web/src/app/(account)/account/page.tsx`

**Interfaces:**
- Activity href becomes `/activity`.
- `/jobs` and `/jobs/*` map to `activity`.

- [ ] **Step 1: Add failing nav cases**

```ts
["/activity", "activity"],
["/jobs", "activity"],
["/jobs/123", "activity"],
```

- [ ] **Step 2: Run and confirm RED**

Run: `pnpm vitest apps/web/src/lib/ui/navigation.test.ts --run`
Expected: `/jobs` maps to `home` before implementation.

- [ ] **Step 3: Update nav helper and bottom-nav href**

Map `/activity`, `/account/notifications`, `/jobs`, `/jobs/*` to `activity`. Change tab href to `/activity`.

- [ ] **Step 4: Implement Activity hub**

Server page loads current user, upcoming jobs, unread notification count, and renders two strong destinations: `Mis trabajos` and `Notificaciones`, plus lightweight current-job summary.

- [ ] **Step 5: Add Account route into Activity/Jobs**

Expose `Actividad y trabajos` from the Account hub without adding a fifth bottom tab.

- [ ] **Step 6: Humanize Jobs status**

Use presentation helper from Task 4 instead of `replaceAll("_", " ")`.

- [ ] **Step 7: Run nav/unit/typecheck**

Expected: PASS.

- [ ] **Step 8: Commit**

`git commit -m "feat(activity): make jobs first-class mobile activity"`

---

### Task 4: Human presentation helpers

**Files:**
- Create: `apps/web/src/lib/ui/job-status.ts`
- Create: `apps/web/src/lib/ui/job-status.test.ts`
- Create: `apps/web/src/lib/ui/marketplace-labels.ts`
- Create: `apps/web/src/lib/ui/marketplace-labels.test.ts`
- Modify presentation consumers as touched by later tasks.

**Interfaces:**

```ts
export function getJobStatusLabel(status: string): string;
export function getModalityLabel(value: string): string;
export function getPriceModelLabel(value: string): string;
export function formatDistanceMeters(value: number | null): string | null;
```

- [ ] **Step 1: Write failing tests**

Examples:

```ts
expect(getJobStatusLabel("IN_PROGRESS")).toBe("En curso");
expect(getModalityLabel("IN_PERSON")).toBe("Presencial");
expect(formatDistanceMeters(4200)).toBe("4,2 km");
```

- [ ] **Step 2: Confirm RED**
- [ ] **Step 3: Implement deterministic mappings with sensible fallback**
- [ ] **Step 4: Confirm GREEN**
- [ ] **Step 5: Commit**

`git commit -m "feat(ui): humanize marketplace status labels"`

---

### Task 5: Immersive conversation detail

**Files:**
- Modify: `apps/web/src/app/(account)/layout.tsx`
- Create: `apps/web/src/components/ui/authenticated-shell-nav.tsx`
- Modify: `apps/web/src/components/conversations/conversation-thread.tsx`
- Modify: `apps/web/src/app/(account)/messages/[conversationId]/page.tsx`
- Create: `apps/web/src/lib/ui/conversation-layout.test.ts`

**Interfaces:**
- Bottom nav hidden on `/messages/[conversationId]` mobile, retained on `/messages`.
- Attachment selection integrated into conversation footer controls.

- [ ] **Step 1: Write failing route-visibility test**

Test a pure helper/client shell rule that `shouldShowBottomNav("/messages") === true` and `shouldShowBottomNav("/messages/abc") === false`.

- [ ] **Step 2: Confirm RED**
- [ ] **Step 3: Implement route-aware bottom-nav wrapper**
- [ ] **Step 4: Refactor conversation container**

Use full-width mobile surface, safe-area footer, 48px back/menu controls, no rounded desktop card at narrow widths.

- [ ] **Step 5: Integrate attachment action**

Replace the permanently visible file row with a compact attachment button/disclosure within the composer area while preserving `sendAttachmentMessage` and nonce behavior.

- [ ] **Step 6: Run tests/typecheck**
- [ ] **Step 7: Commit**

`git commit -m "fix(messages): make conversation detail immersive on mobile"`

---

### Task 6: Mobile progressive search

**Files:**
- Modify: `apps/web/src/app/buscar/page.tsx`
- Create: `apps/web/src/components/discovery/mobile-filter-panel.tsx`
- Create: `apps/web/src/lib/ui/discovery-filters.ts`
- Create: `apps/web/src/lib/ui/discovery-filters.test.ts`

**Interfaces:**

```ts
export function countActiveDiscoveryFilters(filters: DiscoveryFilters): number;
```

- [ ] **Step 1: Write failing filter-count tests**
- [ ] **Step 2: Confirm RED**
- [ ] **Step 3: Implement filter count**
- [ ] **Step 4: Move advanced mobile controls into `details`/sheet-like disclosure**

Keep query and location visible. Desktop retains the full grid with `sm:` breakpoint.

- [ ] **Step 5: Add compact `Filtros (N)` trigger and quick modality affordances**
- [ ] **Step 6: Run tests/typecheck**
- [ ] **Step 7: Commit**

`git commit -m "feat(discovery): simplify mobile search filters"`

---

### Task 7: Home and empty-state simplification

**Files:**
- Create: `apps/web/src/components/ui/empty-state.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/(account)/messages/page.tsx`
- Modify: `apps/web/src/app/(account)/jobs/page.tsx`
- Modify: `apps/web/src/app/(account)/account/favorites/page.tsx`

**Interfaces:**
- Reusable `EmptyState` accepts title, description, optional icon, primary/secondary actions.

- [ ] **Step 1: Add source/unit contract for `EmptyState`**
- [ ] **Step 2: Confirm RED**
- [ ] **Step 3: Implement primitive**
- [ ] **Step 4: Reduce Home hero density and use useful no-services state**
- [ ] **Step 5: Replace inconsistent core empty states**
- [ ] **Step 6: Run tests/typecheck**
- [ ] **Step 7: Commit**

`git commit -m "feat(ui): simplify home and unify empty states"`

---

### Task 8: Provider onboarding copy polish

**Files:**
- Modify: `apps/web/src/app/(provider)/provider/onboarding/documents/page.tsx`
- Modify: `apps/web/src/app/(provider)/provider/onboarding/review/page.tsx`
- Create: `apps/web/src/lib/ui/onboarding-copy.test.ts`

- [ ] **Step 1: Add failing source test forbidding engineering phrases**

Forbid customer-facing occurrences of `server action`, `código cliente arbitrario`, `Storage`, and `lógica existente` in the two page sources.

- [ ] **Step 2: Confirm RED**
- [ ] **Step 3: Replace with concise product copy**
- [ ] **Step 4: Confirm GREEN**
- [ ] **Step 5: Commit**

`git commit -m "fix(onboarding): replace engineering copy with product language"`

---

### Task 9: Provider management dashboard presentation

**Files:**
- Modify: `apps/web/src/app/(provider)/provider/manage/page.tsx`
- Modify: `apps/web/src/components/provider/marketplace-management.tsx`
- Modify: `apps/web/src/components/payments/provider-payment-account.tsx`

- [ ] **Step 1: Add presentation contract/source test**
- [ ] **Step 2: Confirm RED**
- [ ] **Step 3: Add dashboard summary/navigation above detailed management**
- [ ] **Step 4: Group long management areas into clear disclosure sections without changing actions**
- [ ] **Step 5: Simplify Mercado Pago to user-relevant state/action; demote diagnostics**
- [ ] **Step 6: Run typecheck/unit tests**
- [ ] **Step 7: Commit**

`git commit -m "feat(provider): turn management into a mobile dashboard"`

---

### Task 10: Mobile regression coverage and final verification

**Files:**
- Modify/Create: `tests/e2e/mobile-premium-product-v2.spec.ts`

- [ ] **Step 1: Add 320/360/390px coverage**

Check no horizontal overflow on Home/Search/Activity/Jobs/Account and that nav state is correct.

- [ ] **Step 2: Add conversation regression**

Assert conversation detail does not render the global mobile nav and composer remains visible.

- [ ] **Step 3: Add search regression**

Assert advanced filters are collapsed by default on mobile and visible on request.

- [ ] **Step 4: Run local verification where an executable environment is available**

Commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm playwright test tests/e2e/mobile-premium-product-v2.spec.ts --project=mobile-web
pnpm prettier --check .
git diff --check
```

If this execution environment cannot run the repository, do not substitute GitHub Actions. Record that limitation and rely only on static/source-level verification until a local runner is available.

- [ ] **Step 5: Review branch diff against `main`**

Use normal Git compare APIs only; do not inspect workflow runs.

- [ ] **Step 6: Commit final test/polish batch**

`git commit -m "test(ui): cover premium product mobile regressions"`
