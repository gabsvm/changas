# Marketplace Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulir la interfaz marketplace de Changas, añadir ubicación explícita y dejar operativo el flujo de avatar sin cambiar contratos privados de backend.

**Architecture:** Reutilizar los componentes marketplace existentes y ampliar sus tokens visuales; convertir `LocationPicker` en un control cliente pequeño que conserva selección manual y geolocation efímera; mantener Storage privado y corregirlo mediante migración/estado remoto, no mediante un bucket público.

**Tech Stack:** Next.js App Router 16, React 19, TypeScript, Tailwind CSS 4, Supabase JS/Storage, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-10-marketplace-polish-design.md`

## Global Constraints

- Mantener la paleta existente: `#FFF9F3`, `#202124`, `#FF6B35`, `#FFC857`, `#2563EB`, `#FF0A78`, `#D60060`.
- No crear ramas nuevas; trabajar en `main`.
- No hacer público `profile-avatars` ni tocar RLS/RPC/backend no necesario.
- No persistir coordenadas exactas en URL, perfil ni resultados públicos.
- No agregar librerías de UI, mapas o animación.

### Task 1: Contratos visuales y ubicación

**Files:**

- Modify: `apps/web/src/components/discovery/location-picker.tsx`
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/lib/ui/marketplace-polish.test.ts`
- Test: `apps/web/src/lib/ui/marketplace-polish.test.ts`

- [ ] Write failing source contracts for elevated hero/search surfaces, explicit location activation, permission messaging, manual fallback and remote mode.
- [ ] Run `pnpm exec vitest run apps/web/src/lib/ui/marketplace-polish.test.ts` and verify the missing contracts fail.
- [ ] Add the minimal client location control using `navigator.geolocation.getCurrentPosition`, a manual select fallback and hidden non-public request fields; keep the compact form compatible with `/buscar`.
- [ ] Add only the shared CSS tokens/states needed for depth, press feedback, focus, surface elevation and premium controls.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Premium home surface

**Files:**

- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/components/ui/marketplace/brand-hero.tsx`
- Modify: `apps/web/src/components/ui/marketplace/search-field.tsx`
- Modify: `apps/web/src/components/ui/marketplace/section-header.tsx`
- Test: `apps/web/src/lib/ui/marketplace-polish.test.ts`

- [ ] Add failing assertions for a layered hero panel, concise hierarchy, location affordance and action arrow semantics.
- [ ] Run the focused test and confirm the assertions fail before production edits.
- [ ] Implement the smallest shared composition: elevated inner search panel, stronger CTA hierarchy, compact remote entry, and non-text-only category affordances.
- [ ] Re-run focused unit/source tests.

### Task 3: Shared authenticated surfaces

**Files:**

- Modify: `apps/web/src/app/(account)/messages/page.tsx`
- Modify: `apps/web/src/app/(account)/account/notifications/page.tsx`
- Modify: `apps/web/src/components/ui/marketplace/empty-state.tsx`
- Modify: `apps/web/src/components/ui/marketplace/list-row.tsx`
- Test: `apps/web/src/lib/ui/marketplace-polish.test.ts`

- [ ] Add failing contracts for premium empty states, action rows and readable hierarchy.
- [ ] Replace flat text-only sections with existing shared empty/list primitives, preserving all actions and copy semantics.
- [ ] Add chevrons only to navigable rows, ensure 44px+ touch targets, visible focus and no color-only state.
- [ ] Run focused tests and mobile lint/typecheck.

### Task 4: Avatar bucket diagnosis and user-facing error

**Files:**

- Modify: `apps/web/src/components/account/profile-avatar-uploader.tsx`
- Modify: `packages/config/src/server.ts`
- Modify: `.env.example`
- Test: `apps/web/src/lib/ui/profile-admin-fixes.test.ts`

- [ ] Add a failing contract for Spanish handling of `Bucket not found` and the server-only service key names.
- [ ] Run the focused test and verify it fails.
- [ ] Map the known Storage bucket error to an actionable Spanish message while retaining the private bucket and server-only key fallback.
- [ ] Do not create a duplicate bucket migration; provide the existing migration path and verification SQL in the final report.
- [ ] Re-run avatar/admin focused tests.

### Task 5: Verification and handoff

**Files:**

- Modify: `docs/reports/phase-10-beta-hardening.md` only if a verification note is required; otherwise no report change.

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run targeted Prettier checks on changed files and `git diff --check`.
- [ ] If Docker is available, run Supabase status/reset and the affected mobile Playwright journeys; if unavailable, report the exact blocked gates.
- [ ] Record the SQL/migration commands required for `profile-avatars` and bucket verification, with no secret values.
- [ ] Commit the changes on `main` only after fresh verification.
