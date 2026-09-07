# Changas Mobile Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the authenticated mobile account/onboarding experience with a coherent, thumb-friendly, premium UI while preserving all existing backend, Supabase, payment, provider-state, Storage, and security contracts.

**Architecture:** Keep the existing server-first Next.js App Router architecture. Add small reusable mobile UI primitives, route-specific server components for data loading, focused client components only for interactive forms/upload state, and presentation-only helpers for provider/onboarding/document labels. Existing server actions remain authoritative.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Tailwind CSS 4, Supabase SSR/JS, existing server actions, Playwright, existing workspace test tooling.

**Spec:** `docs/superpowers/specs/2026-09-07-mobile-premium-redesign-design.md`

## Global Constraints

- Do not change Supabase tables, migrations, RLS, grants, Storage policies, or RPC contracts.
- Do not alter provider lifecycle/status semantics.
- Do not change payment logic or Mercado Pago integration.
- Do not start Phase 12.
- Preserve server-first data loading and existing server-side validation.
- Keep canvas `#F5F1E9`, ink `#163832`, moss `#285943`, terracotta `#B86145`.
- Minimum touch target: 48 px.
- Mobile primary target: `< 640px`; must remain usable at 320 px CSS width.
- Sticky mobile actions must respect `env(safe-area-inset-bottom)`.
- No heavy UI or animation framework.
- Never expose raw provider enum values as primary UI copy.
- Never use real identity documents in tests.

---

## File Structure

### New shared UI
- `apps/web/src/components/ui/mobile-app-bar.tsx` — contextual mobile header.
- `apps/web/src/components/ui/authenticated-bottom-nav.tsx` — mobile authenticated navigation.
- `apps/web/src/components/ui/status-badge.tsx` — semantic status chip.
- `apps/web/src/components/ui/progress-bar.tsx` — accessible progress primitive.
- `apps/web/src/components/ui/sticky-action-bar.tsx` — safe-area mobile CTA container.
- `apps/web/src/components/ui/privacy-notice.tsx` — privacy reassurance surface.
- `apps/web/src/components/ui/account-menu-item.tsx` — account hub list row.
- `apps/web/src/components/ui/form-field.tsx` — shared form framing/helper/error.

### New presentation/domain helpers
- `apps/web/src/lib/ui/provider-status.ts` — raw provider status to human-facing presentation.
- `apps/web/src/lib/ui/onboarding.ts` — four-step metadata/state derivation.
- `apps/web/src/lib/ui/documents.ts` — human labels + client file validation metadata.

### New/changed account routes
- Modify `apps/web/src/app/(account)/layout.tsx`.
- Modify `apps/web/src/app/(account)/account/page.tsx`.
- Create `apps/web/src/app/(account)/account/profile/page.tsx`.
- Create `apps/web/src/app/(account)/account/identity/page.tsx`.
- Modify `apps/web/src/app/(account)/account/settings/page.tsx`.
- Split `apps/web/src/components/account/account-form.tsx` into focused profile/identity forms while keeping existing mutation contract.

### New/changed provider onboarding
- Modify `apps/web/src/app/(provider)/provider/onboarding/page.tsx` into overview.
- Create `apps/web/src/app/(provider)/provider/onboarding/profile/page.tsx`.
- Create `apps/web/src/app/(provider)/provider/onboarding/identity/page.tsx`.
- Create `apps/web/src/app/(provider)/provider/onboarding/documents/page.tsx`.
- Create `apps/web/src/app/(provider)/provider/onboarding/review/page.tsx`.
- Refactor `apps/web/src/components/provider/onboarding-form.tsx` into focused progress/upload components.

### Styling/tests
- Modify `apps/web/src/app/globals.css`.
- Add unit tests for presentation helpers.
- Add Playwright mobile regression coverage using existing synthetic fixture.

---

### Task 1: Mobile design tokens and presentation helpers

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/lib/ui/provider-status.ts`
- Create: `apps/web/src/lib/ui/onboarding.ts`
- Create: `apps/web/src/lib/ui/documents.ts`
- Test: `apps/web/src/lib/ui/provider-status.test.ts`
- Test: `apps/web/src/lib/ui/onboarding.test.ts`
- Test: `apps/web/src/lib/ui/documents.test.ts`

**Interfaces:**
- Produces: `getProviderStatusPresentation(status)`, `getOnboardingSteps(currentStep)`, `getDocumentTypeLabel(type)`, `validateIdentityFile(file)`.

- [ ] **Step 1: Write failing presentation-helper tests**

```ts
import { describe, expect, it } from "vitest";
import { getProviderStatusPresentation } from "./provider-status";

describe("getProviderStatusPresentation", () => {
  it("maps PROFILE_INCOMPLETE to human copy", () => {
    expect(getProviderStatusPresentation("PROFILE_INCOMPLETE").label).toBe("Perfil incompleto");
  });
  it("never returns the raw enum as the label", () => {
    expect(getProviderStatusPresentation("IDENTITY_PENDING").label).not.toBe("IDENTITY_PENDING");
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { getOnboardingSteps } from "./onboarding";

describe("getOnboardingSteps", () => {
  it("marks previous, current and future steps deterministically", () => {
    expect(getOnboardingSteps(2).map((step) => step.state)).toEqual([
      "complete",
      "current",
      "pending",
      "pending",
    ]);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { getDocumentTypeLabel } from "./documents";

describe("getDocumentTypeLabel", () => {
  it("uses human document labels", () => {
    expect(getDocumentTypeLabel("DNI_FRONT")).toBe("DNI frente");
  });
});
```

- [ ] **Step 2: Run targeted tests and verify failure**

Run from repo root: `pnpm --filter @changas/web test -- provider-status onboarding documents` if the package exposes a test script; otherwise use the repository's existing Vitest command discovered from root scripts. Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement minimal helpers**

`provider-status.ts` must map known states to `{ label, tone, description }` and use a safe `Estado de cuenta` fallback for unknown values.

`onboarding.ts` must define exactly four steps with stable ids `profile`, `identity`, `documents`, `review`; derive `complete/current/pending` from the persisted integer without inventing new backend validation.

`documents.ts` must map `DNI_FRONT`, `DNI_BACK`, `SELFIE`; client validation must accept JPEG/PNG/PDF and reject files above 10 MiB.

- [ ] **Step 4: Add semantic CSS tokens**

Add tokens for surface, muted surface, border, muted text, success, warning and danger. Add mobile safe-area utilities and reduce motion/hover movement for buttons on touch devices.

- [ ] **Step 5: Run tests, lint and typecheck**

Run targeted tests plus `pnpm --filter @changas/web lint` and `pnpm --filter @changas/web typecheck`.

- [ ] **Step 6: Commit**

`git commit -m "feat(ui): add mobile design primitives and presentation helpers"`

---

### Task 2: Authenticated mobile navigation shell

**Files:**
- Create: `apps/web/src/components/ui/authenticated-bottom-nav.tsx`
- Create: `apps/web/src/components/ui/mobile-app-bar.tsx`
- Modify: `apps/web/src/app/(account)/layout.tsx`
- Test: `apps/web/src/lib/ui/navigation.test.ts`

**Interfaces:**
- `AuthenticatedBottomNav({ unreadCount }: { unreadCount: number })`
- `MobileAppBar({ title, backHref, trailing }: { title: string; backHref?: string; trailing?: React.ReactNode })`

- [ ] **Step 1: Write active-route derivation test**

Test helper should map `/messages/...` to Messages, `/account/notifications` to Actividad, `/account/...` to Cuenta and `/` to Inicio.

- [ ] **Step 2: Verify test fails**

Run the targeted test. Expected: helper/module missing.

- [ ] **Step 3: Implement bottom navigation**

Use four items: Inicio `/`, Mensajes `/messages`, Actividad `/account/notifications`, Cuenta `/account`. Use inline lightweight SVG icons, `aria-current="page"`, a notification badge, 48 px minimum targets, fixed bottom position on mobile and `padding-bottom: env(safe-area-inset-bottom)`.

- [ ] **Step 4: Replace wrapping mobile header**

In `(account)/layout.tsx`, keep the server-side unread-count lookup. Render a compact brand/top treatment for desktop and `AuthenticatedBottomNav` on mobile. Add sufficient bottom padding to `main` so content is not obscured.

- [ ] **Step 5: Verify at 320/360/390 widths**

No wrapping text navigation, no horizontal overflow, nav labels remain readable, badge does not change tab width.

- [ ] **Step 6: Run lint/typecheck and commit**

`git commit -m "feat(nav): add thumb-friendly authenticated mobile shell"`

---

### Task 3: Account hub redesign

**Files:**
- Create: `apps/web/src/components/ui/account-menu-item.tsx`
- Create: `apps/web/src/components/ui/status-badge.tsx`
- Create: `apps/web/src/components/ui/progress-bar.tsx`
- Modify: `apps/web/src/app/(account)/account/page.tsx`

**Interfaces:**
- Consumes: provider status presentation + onboarding helper.
- Produces: focused `/account` hub with links to profile, identity, favorites, notifications, settings.

- [ ] **Step 1: Preserve current server queries and add email/provider progress data only from already-loaded records.**
- [ ] **Step 2: Implement compact account identity header.**
- [ ] **Step 3: Implement provider progress card states.**
  - No provider: `¿Querés ofrecer tus servicios?` + existing `StartProviderForm`.
  - Incomplete: human status + progress + `Continuar verificación`.
  - Pending: explanatory read-only status, no misleading action.
  - Active: `Gestionar servicios`.
- [ ] **Step 4: Implement account destination list.**
  - `/account/profile`
  - `/account/identity`
  - `/account/favorites`
  - `/account/notifications`
  - `/account/settings`
- [ ] **Step 5: Verify raw enum strings do not render.**
- [ ] **Step 6: Run lint/typecheck and commit.**

`git commit -m "feat(account): redesign account as mobile-first hub"`

---

### Task 4: Split public profile and private identity editing

**Files:**
- Create: `apps/web/src/components/ui/form-field.tsx`
- Create: `apps/web/src/components/ui/privacy-notice.tsx`
- Create: `apps/web/src/components/ui/sticky-action-bar.tsx`
- Refactor: `apps/web/src/components/account/account-form.tsx`
- Create: `apps/web/src/app/(account)/account/profile/page.tsx`
- Create: `apps/web/src/app/(account)/account/identity/page.tsx`
- Modify: `apps/web/src/app/(account)/account/settings/page.tsx`

**Interfaces:**
- `PublicProfileForm` submits the same existing `updateAccount` action contract with public fields.
- `PrivateIdentityForm` submits the same existing `updateAccount` action contract with private fields.
- Unchanged fields must be preserved by the server action or explicitly included as hidden/current values if the action expects a complete payload.

- [ ] **Step 1: Inspect `updateAccount` and confirm partial-vs-complete payload semantics before splitting.**
- [ ] **Step 2: Write client helper tests for bio counter and field framing only if logic is extracted; otherwise rely on E2E.**
- [ ] **Step 3: Implement `/account/profile`.**
  - App bar `Perfil público`.
  - Intro `Así te van a ver`.
  - Name, zone, bio, avatar URL only if still supported.
  - Bio counter against existing backend max length (1000 unless action schema says otherwise).
  - Sticky `Guardar cambios` CTA on mobile.
- [ ] **Step 4: Implement `/account/identity`.**
  - App bar `Identidad privada`.
  - Privacy notice.
  - Existing supported private fields only.
  - Sticky save CTA.
- [ ] **Step 5: Reduce `/account/settings` to true settings/navigation/sign-out.**
- [ ] **Step 6: Verify no private data appears in URLs or client-global state.**
- [ ] **Step 7: Run tests/lint/typecheck and commit.**

`git commit -m "feat(account): separate public profile and private identity editing"`

---

### Task 5: Provider onboarding overview + dedicated step routing

**Files:**
- Refactor: `apps/web/src/app/(provider)/provider/onboarding/page.tsx`
- Create: `apps/web/src/components/provider/onboarding-step-card.tsx`
- Create: `apps/web/src/app/(provider)/provider/onboarding/profile/page.tsx`
- Create: `apps/web/src/app/(provider)/provider/onboarding/identity/page.tsx`
- Create: `apps/web/src/app/(provider)/provider/onboarding/review/page.tsx`

**Interfaces:**
- Overview consumes current provider `status` + `onboarding_step` and returns one next-action CTA.
- Step routes reuse existing account/provider actions; no migration or provider-state rule changes.

- [ ] **Step 1: Replace raw enum hero with mapped status.**
- [ ] **Step 2: Render accessible progress and four actionable step cards.**
- [ ] **Step 3: Route profile step to focused public/basic form.**
- [ ] **Step 4: Route identity step to focused private identity form.**
- [ ] **Step 5: Implement review page that summarizes current completion without claiming approval.**
- [ ] **Step 6: Tie progression CTA to the existing supported action; do not invent server validation.**
- [ ] **Step 7: Run lint/typecheck and commit.**

`git commit -m "feat(onboarding): split provider verification into focused steps"`

---

### Task 6: Premium identity document uploader

**Files:**
- Create: `apps/web/src/components/provider/document-uploader.tsx`
- Create: `apps/web/src/components/provider/document-list-item.tsx`
- Create: `apps/web/src/app/(provider)/provider/onboarding/documents/page.tsx`
- Refactor/remove document UI from: `apps/web/src/components/provider/onboarding-form.tsx`

**Interfaces:**
- `DocumentUploader` receives existing upload server action and `editable` flag.
- It uses hidden accessible `<input type="file">` elements; visible primary controls are custom buttons/surface.
- It does not upload directly to Storage from arbitrary client code; it submits through the existing server action.

- [ ] **Step 1: Write failing file validation tests** for >10 MiB and unsupported MIME.
- [ ] **Step 2: Implement selected-file state** with filename, MIME/label, size, optional image object-URL preview, change/remove actions, object URL cleanup.
- [ ] **Step 3: Add camera-oriented image input** using `accept="image/*"` and `capture="environment"` where supported, plus separate normal file chooser for JPG/PNG/PDF.
- [ ] **Step 4: Implement pending/success/error/read-only UI.**
- [ ] **Step 5: Render received documents as compact human-labeled rows.**
- [ ] **Step 6: Prevent duplicate submission while pending.**
- [ ] **Step 7: Run tests/lint/typecheck and commit.**

`git commit -m "feat(onboarding): add premium private document uploader"`

---

### Task 7: Accessibility and responsive polish

**Files:**
- Modify relevant UI components from Tasks 1–6.
- Modify `apps/web/src/app/globals.css`.
- Modify `apps/web/scripts/check-mobile-performance.mjs` only if existing check needs route coverage, not to relax thresholds.

- [ ] **Step 1: Audit every interactive target for 48 px minimum.**
- [ ] **Step 2: Add `aria-live` status regions for save/upload feedback.**
- [ ] **Step 3: Verify focus-visible styles and no color-only states.**
- [ ] **Step 4: Verify sticky CTA/bottom nav safe-area spacing.**
- [ ] **Step 5: Verify 320 px width and 200% zoom-equivalent no horizontal scroll.**
- [ ] **Step 6: Respect reduced-motion preferences.**
- [ ] **Step 7: Run mobile performance check, lint, typecheck and build.**
- [ ] **Step 8: Commit.**

`git commit -m "fix(ui): harden mobile accessibility and responsive behavior"`

---

### Task 8: Mobile Playwright regression coverage

**Files:**
- Create or modify: Playwright specs under the repo's existing E2E test location.
- Reuse: `apps/web/fixtures/synthetic-identity.png.b64` or generate the test file exactly as the existing phase runtime tests already do.

- [ ] **Step 1: Add authenticated account navigation test at 360x800.**
- [ ] **Step 2: Add profile and identity edit navigation/save tests.**
- [ ] **Step 3: Add onboarding overview/current-step test.**
- [ ] **Step 4: Add document selection/upload-once test with synthetic fixture.**
- [ ] **Step 5: Add 320/360/390 overflow assertions.**
- [ ] **Step 6: Run Playwright and fix only real regressions; never weaken assertions to make failures disappear.**
- [ ] **Step 7: Run full validation:** `pnpm lint`, `pnpm typecheck`, `pnpm build`, relevant unit tests, mobile performance check and Playwright suite.
- [ ] **Step 8: Commit.**

`git commit -m "test(ui): cover premium mobile account and onboarding flows"`

---

## Final Verification Checklist

- [ ] Bottom nav does not wrap at 320–390 px.
- [ ] Account is a hub, not a long settings form.
- [ ] Public/private editing is clearly separated.
- [ ] Raw provider enum strings are absent from primary UI.
- [ ] Onboarding overview has one clear next action.
- [ ] Onboarding tasks are focused routes.
- [ ] Native file input is not the visible primary upload UI.
- [ ] Upload has selection/pending/success/error/empty/read-only states.
- [ ] Sticky CTA and bottom nav respect Android safe area.
- [ ] Existing backend/security/payment semantics unchanged.
- [ ] Existing tests stay green.
- [ ] No horizontal overflow at 320 px.
- [ ] Build, lint, typecheck, mobile performance check and Playwright pass.
