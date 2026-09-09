# Marketplace App-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Changas' public/authenticated mobile experience from a card-heavy web mockup into a dense, mature marketplace product while preserving all existing domain/security contracts.

**Architecture:** Build a reusable consumer UI kit under `apps/web/src/components/ui/marketplace/`, then migrate screens onto those primitives in vertical slices: navigation/global shell, discovery, messages/activity, account/forms, provider onboarding, jobs/payments/detail surfaces, and finally E2E regression. Server/data contracts remain authoritative; this plan changes presentation and interaction only, except profile-avatar upload where it reuses the existing safe browser upload/compression pipeline and existing `profiles.avatar_url` field without weakening storage privacy.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Supabase SSR/browser clients, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-marketplace-app-first-design.md`

## Global Constraints

- Work only on `codex/marketplace-app-first` until final verification.
- Do not create or use GitHub Actions; do not inspect workflow runs/jobs/logs/artifacts.
- Keep Vercel automatic Git deployments disabled and do not deploy during implementation.
- Do not modify provider lifecycle semantics, identity review semantics, RLS, payment contracts, admin permissions, or storage privacy unless a separately proven blocker requires explicit approval.
- Preserve the existing image compression pipeline target of about 100 KiB and maximum long edge of 1200 px.
- Mobile source-of-truth viewports: 320, 360, 390 px.
- Touch targets: minimum 44x44 px, preferably 48x48 px.
- Global Prettier debt is out of scope; format only changed files.

---

### Task 1: Consumer design tokens and shared primitives

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/components/ui/marketplace/app-header.tsx`
- Create: `apps/web/src/components/ui/marketplace/avatar.tsx`
- Create: `apps/web/src/components/ui/marketplace/section-header.tsx`
- Create: `apps/web/src/components/ui/marketplace/list-row.tsx`
- Create: `apps/web/src/components/ui/marketplace/search-field.tsx`
- Create: `apps/web/src/components/ui/marketplace/status-chip.tsx`
- Create: `apps/web/src/components/ui/marketplace/empty-state.tsx`
- Create: `apps/web/src/components/ui/marketplace/settings-row.tsx`
- Create: `apps/web/src/components/ui/marketplace/switch.tsx`
- Create: `apps/web/src/components/ui/marketplace/form-field.tsx`
- Create: `apps/web/src/components/ui/marketplace/action-button.tsx`
- Create: `apps/web/src/components/ui/marketplace/skeleton.tsx`
- Test: `apps/web/src/lib/ui/marketplace-theme.test.ts`

**Interfaces:**
- Produces compact marketplace primitives with semantic props only.
- Keeps admin visual system untouched.

- [ ] **Step 1: Write a failing theme regression test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

describe("marketplace consumer theme", () => {
  it("defines compact consumer surface tokens", () => {
    expect(css).toContain("--consumer-page-padding: 1rem");
    expect(css).toContain("--consumer-radius-card: 0.875rem");
    expect(css).toContain("--consumer-nav-height: 4rem");
  });
});
```

- [ ] **Step 2: Run the directed test and confirm it fails**

Run: `pnpm --filter @changas/web test -- marketplace-theme`
Expected: FAIL because the new tokens do not exist.

- [ ] **Step 3: Implement consumer tokens and primitives**

Use Inter/system stack for consumer UI, retain Changas palette, reduce generic card radius/shadow usage, and add pressed states. Components must not encode page-specific copy.

- [ ] **Step 4: Re-run the directed test**

Run: `pnpm --filter @changas/web test -- marketplace-theme`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/ui/marketplace apps/web/src/lib/ui/marketplace-theme.test.ts
git commit -m "feat(ui): add marketplace consumer primitives"
```

### Task 2: Compact authenticated shell and bottom navigation

**Files:**
- Modify: `apps/web/src/components/ui/authenticated-bottom-nav.tsx`
- Modify: `apps/web/src/components/ui/mobile-app-bar.tsx`
- Modify: `apps/web/src/app/(account)/layout.tsx`
- Modify: `apps/web/src/app/(provider)/layout.tsx`
- Test: `apps/web/src/lib/ui/navigation.test.ts`

**Interfaces:**
- Consumes shared action/icon/surface tokens from Task 1.
- Produces a 4-tab compact nav with orange active icon/text and subtle marker; no active background tile.

- [ ] **Step 1: Extend navigation test to reject legacy active-tile classes**
- [ ] **Step 2: Run test and verify failure**
- [ ] **Step 3: Replace active tile with compact marker, keep unread badge and `aria-current`**
- [ ] **Step 4: Make mobile app bar compact/sticky and align account/provider layouts to 16 px mobile gutters**
- [ ] **Step 5: Run directed tests**
- [ ] **Step 6: Commit `feat(ui): compact authenticated app shell`**

### Task 3: Home, discovery, search, category, and marketplace cards

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/buscar/page.tsx`
- Modify: `apps/web/src/app/categoria/[slug]/page.tsx`
- Modify: `apps/web/src/components/discovery/discovery-card.tsx`
- Modify: `apps/web/src/components/discovery/location-picker.tsx`
- Create: `apps/web/src/components/ui/marketplace/category-chip.tsx`
- Create: `apps/web/src/components/ui/marketplace/service-card.tsx`
- Create: `apps/web/src/components/ui/marketplace/provider-card.tsx`
- Test: `apps/web/src/lib/ui/home-marketplace.test.ts`

**Interfaces:**
- Home consumes real `categories` and `searchDiscovery()` rows already loaded server-side.
- Do not invent ratings, pricing, availability, distance, or providers.

- [ ] **Step 1: Add failing markup regression assertions** for `¿Qué necesitás hoy?`, compact search, no marketing hero/footer on authenticated mobile, and honest empty supply state.
- [ ] **Step 2: Run directed test and confirm failure**.
- [ ] **Step 3: Rebuild Home hierarchy**: compact brand/account header, search first, location/mode, horizontal/wrapping category shortcuts, published services immediately after.
- [ ] **Step 4: Convert discovery results to dense service/provider cards** with real fields only.
- [ ] **Step 5: Redesign search/category controls around compact query + chips and preserve URL filter semantics**.
- [ ] **Step 6: Run directed unit tests**.
- [ ] **Step 7: Commit `feat(discovery): make home marketplace-first`**.

### Task 4: Messages list and conversation surfaces

**Files:**
- Modify: `apps/web/src/app/(account)/messages/page.tsx`
- Modify: `apps/web/src/app/(account)/messages/[conversationId]/page.tsx`
- Modify files under: `apps/web/src/components/conversations/`
- Test: existing conversation/unit tests plus mobile E2E fixture where available.

**Interfaces:**
- Conversation summaries keep peer avatar, service context, preview, timestamp, unread count.
- Attachments continue through existing safe browser upload pipeline and private access routes.

- [ ] **Step 1: Add/adjust tests for compact empty and populated rows**.
- [ ] **Step 2: Replace giant empty card with shared `EmptyState`**.
- [ ] **Step 3: Render conversation rows as 72-84 px list rows with dividers rather than one large rounded container**.
- [ ] **Step 4: Compact conversation detail header/composer without changing message semantics**.
- [ ] **Step 5: Run conversation tests**.
- [ ] **Step 6: Commit `feat(messages): polish marketplace conversations`**.

### Task 5: Activity feed and native notification preferences

**Files:**
- Modify: `apps/web/src/app/(account)/account/notifications/page.tsx`
- Modify: `apps/web/src/components/notifications/notification-preferences-form.tsx`
- Modify: `apps/web/src/components/pwa/push-opt-in.tsx`
- Modify: `apps/web/src/app/(account)/account/notifications/actions.ts` only if needed to support safe one-toggle persistence without changing the backend contract.
- Test: notification UI unit tests.

**Interfaces:**
- Existing notification preference fields remain unchanged.
- Switch components expose `role="switch"`/`aria-checked` semantics.

- [ ] **Step 1: Add failing tests requiring switch semantics and no explicit global Save button when immediate persistence is safely supported**.
- [ ] **Step 2: Convert activity list into compact feed rows and compact `Todo al día` empty state**.
- [ ] **Step 3: Convert preferences to settings rows + switches**. If the current server action remains batch-only, submit the containing form automatically on change with pending/error rollback feedback.
- [ ] **Step 4: Compact Push opt-in into the same settings language**.
- [ ] **Step 5: Run notification tests**.
- [ ] **Step 6: Commit `feat(activity): add native feed and switches`**.

### Task 6: Account home and profile/identity forms

**Files:**
- Modify: `apps/web/src/app/(account)/account/page.tsx`
- Modify: `apps/web/src/components/ui/account-menu-item.tsx`
- Modify: `apps/web/src/app/(account)/account/profile/page.tsx`
- Modify: `apps/web/src/app/(account)/account/identity/page.tsx`
- Modify: `apps/web/src/components/account/account-form.tsx`
- Modify: `apps/web/src/app/(account)/actions.ts`
- Create: `apps/web/src/components/account/profile-avatar-uploader.tsx`
- Reuse: common media compression/browser upload helpers already introduced by `fix(media): route uploads through safe browser pipeline`.
- Test: account/profile unit tests and E2E.

**Interfaces:**
- `profiles.avatar_url` remains the persisted field.
- Do not expose a user-editable URL field.
- Avatar image must be compressed before storage and only the optimized object is persisted.

- [ ] **Step 1: Write failing UI test asserting profile form has an image input and no `avatarUrl` URL input**.
- [ ] **Step 2: Reorganize Account into compact identity header + provider progress + grouped rows**.
- [ ] **Step 3: Move account rows from decorative icon cards to native grouped settings rows**.
- [ ] **Step 4: Replace public profile URL editor with avatar preview/change-photo control using existing compression pipeline**.
- [ ] **Step 5: Simplify form chrome, keep semantic labels/autocomplete and sticky save only for long forms**.
- [ ] **Step 6: Run account tests**.
- [ ] **Step 7: Commit `feat(account): polish account and direct avatar upload`**.

### Task 7: Provider onboarding and provider management

**Files:**
- Modify pages under: `apps/web/src/app/(provider)/provider/onboarding/`
- Modify: `apps/web/src/app/(provider)/provider/manage/page.tsx`
- Modify components under: `apps/web/src/components/provider/`
- Reuse: `ProgressBar`, media pipeline, shared marketplace form/status primitives.
- Test: existing provider submission/admin-trust regressions plus mobile onboarding E2E.

**Interfaces:**
- Preserve `PROFILE_INCOMPLETE -> explicit submit -> IDENTITY_PENDING -> review` server-authoritative contract.
- Preserve DNI front/back/selfie requirements and PDF allowance.

- [ ] **Step 1: Update tests to require compact humanized step UI and no raw enums**.
- [ ] **Step 2: Compact onboarding headers/progress and remove nested card stacking**.
- [ ] **Step 3: Reuse form primitives and existing compressed upload experience**.
- [ ] **Step 4: Redesign review screen around checklist/status, not marketing cards**.
- [ ] **Step 5: Compact provider management rows/actions**.
- [ ] **Step 6: Run provider tests**.
- [ ] **Step 7: Commit `feat(provider): polish onboarding marketplace UX`**.

### Task 8: Jobs, service/provider detail, favorites, settings, payments presentation sweep

**Files:**
- Modify relevant pages under `apps/web/src/app/(account)/jobs/`
- Modify public provider/service detail pages under `apps/web/src/app/p/`
- Modify: `apps/web/src/app/(account)/account/favorites/page.tsx`
- Modify: `apps/web/src/app/(account)/account/settings/page.tsx`
- Modify consumer payment components/pages under `apps/web/src/components/payments/` and payment return pages only where presentation is user-facing.
- Do not modify `apps/web/src/app/admin/**` except imports of truly neutral low-level primitives if necessary.

**Interfaces:**
- Domain statuses continue to use humanized labels and real data.
- Payment flows and Mercado Pago contracts remain unchanged.

- [ ] **Step 1: Inventory remaining legacy `rounded-3xl`, giant heading, repeated shadow/card patterns in consumer routes**.
- [ ] **Step 2: Convert list screens to list rows/compact cards and detail screens to sectioned content**.
- [ ] **Step 3: Add contextual sticky actions where a real primary action exists**.
- [ ] **Step 4: Verify no consumer screen invents unavailable data**.
- [ ] **Step 5: Run affected tests**.
- [ ] **Step 6: Commit `feat(ui): finish consumer marketplace polish`**.

### Task 9: Mobile E2E and regression verification

**Files:**
- Create: `tests/e2e/marketplace-app-first.spec.ts`
- Modify only affected existing E2E selectors where behavior remains correct.

**Interfaces:**
- E2E runs against local/test Supabase only.

- [ ] **Step 1: Add mobile assertions for 320, 360, 390 px** covering Home, Messages, Activity, Account, Profile, Provider onboarding.
- [ ] **Step 2: Assert no horizontal overflow** using `document.documentElement.scrollWidth <= window.innerWidth`.
- [ ] **Step 3: Assert nav active state has `aria-current` and no legacy active background tile**.
- [ ] **Step 4: Assert notification preferences use switches**.
- [ ] **Step 5: Assert profile image uses file input, stores optimized image, and exposes no URL editor**.
- [ ] **Step 6: Run relevant E2E suites locally**.
- [ ] **Step 7: Commit `test(e2e): cover marketplace app-first mobile UX`**.

### Task 10: Final local verification and branch completion

**Files:** no feature files unless a verification failure reveals a real regression.

- [ ] **Step 1: Run directed formatting on changed files**.
- [ ] **Step 2: Run `pnpm lint`**.
- [ ] **Step 3: Run `pnpm typecheck`**.
- [ ] **Step 4: Run `pnpm test`**.
- [ ] **Step 5: Run `pnpm --filter @changas/web build`**.
- [ ] **Step 6: Run `git diff --check`**.
- [ ] **Step 7: Run local Supabase pgTAP only if the branch touched server/storage code; otherwise confirm no migrations/RLS changed**.
- [ ] **Step 8: Run marketplace + affected provider/admin-trust E2E at 320/360/390**.
- [ ] **Step 9: Confirm working tree clean, branch synchronized, and Vercel auto-deploy still disabled**.
- [ ] **Step 10: Do not merge/deploy until explicit production approval after verification report**.
