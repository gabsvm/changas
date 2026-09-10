# Marketplace app-first redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Changas into a warm, energetic, mobile-first marketplace of needs while preserving existing routes, data contracts, privacy guarantees and the current brand palette.

**Architecture:** Reuse the existing marketplace primitives and discovery data flow. Add only the reusable compositions that the new visual language requires: brand hero, category tiles and nearby-service rail. Public pages remain server-first; client components handle only filters, location, favorites and other interaction state already supported by the product.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4 theme tokens, Vitest, Playwright, existing Supabase discovery/auth clients.

**Spec:** `docs/superpowers/specs/2026-09-09-marketplace-app-first-redesign-design.md`

## Global Constraints

- Use the existing palette: canvas `#FFF9F3`, ink `#202124`, orange `#FF6B35`, yellow `#FFC857`, blue `#2563EB`, logo pink `#FF0A78`, strong pink `#D60060`.
- Preserve existing public and authenticated routes, RPCs, discovery contracts, authentication, favorites, conversations, privacy, RLS, Storage and server-first rendering.
- Do not add UI, map, animation, realtime, AI, embedding, job, payment, review, reputation or admin dependencies/features.
- Do not fabricate provider photos, portfolios, reviews, availability, verification badges or other public claims.
- Mobile reference viewports are 320, 360 and 390 px; every touch target is at least 48 px.
- Keep the administrative dark visual language isolated from consumer marketplace tokens.
- Run focused tests after each task and the full local gate before completion.

---

## File map

- `apps/web/src/app/globals.css`: consumer palette, depth, radii, shadows and responsive primitives.
- `apps/web/src/components/ui/marketplace/*`: reusable marketplace presentation primitives.
- `apps/web/src/components/discovery/*`: search, filters, location and result presentation.
- `apps/web/src/app/page.tsx`: public marketplace home composition.
- `apps/web/src/app/buscar/page.tsx`: server-rendered search page and URL state.
- `apps/web/src/app/p/[slug]/page.tsx`: public provider profile.
- `apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx`: public service detail.
- `apps/web/src/app/(account)/*`: authenticated consumer shell, account, messages and favorites presentation.
- `apps/web/src/app/(provider)/*`: apply shared tokens to provider flows without changing provider behavior.
- `apps/web/src/lib/ui/*`: pure presentation helpers and focused unit contracts.
- `tests/e2e/marketplace-app-first.spec.ts`: browser journeys for anonymous and authenticated marketplace use.

### Task 1: Define the warm layered visual system

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/lib/ui/marketplace-theme.test.ts`
- Test: `apps/web/src/lib/ui/marketplace-theme.test.ts`

**Interfaces:**
- Produces CSS variables/classes consumed by all later marketplace components: `--consumer-surface`, `--consumer-surface-strong`, `--consumer-shadow-card`, `--consumer-shadow-float`, `--consumer-radius-card`, `--consumer-radius-control`, `--consumer-hero-gradient`, `.consumer-card`, `.brand-gradient-surface`.
- Does not change the admin theme or existing semantic color names.

- [ ] **Step 1: Extend the theme contract test**

Add assertions for the existing palette and the new visual primitives. The test should read `globals.css` as text and assert exact values/classes rather than relying on a browser-generated style snapshot:

```ts
const css = readFileSync(resolve(process.cwd(), "apps/web/src/app/globals.css"), "utf8");

expect(css).toContain("--color-canvas: #fff9f3");
expect(css).toContain("--color-ink: #202124");
expect(css).toContain("--color-brand-orange: #ff6b35");
expect(css).toContain("--color-brand-yellow: #ffc857");
expect(css).toContain("--color-brand-pink: #ff0a78");
expect(css).toContain("--color-brand-pink-strong: #d60060");
expect(css).toContain("--color-moss: #2563eb");
expect(css).toContain("--consumer-shadow-card");
expect(css).toContain("--consumer-hero-gradient");
```

- [ ] **Step 2: Run the focused contract before implementation**

Run: `pnpm exec vitest run apps/web/src/lib/ui/marketplace-theme.test.ts`

Expected: the new assertions fail only for primitives not yet declared.

- [ ] **Step 3: Add the minimum tokens and component primitives**

Add warm layered values to `:root` and use them in `.consumer-card` and `.brand-gradient-surface`. Keep the current palette values unchanged. Do not add a component library or global animation system. Prefer one soft shadow for cards and one floating shadow for hero/CTA surfaces.

- [ ] **Step 4: Run the focused contract and format the changed files**

Run:

```bash
pnpm exec vitest run apps/web/src/lib/ui/marketplace-theme.test.ts
pnpm exec prettier --check apps/web/src/app/globals.css apps/web/src/lib/ui/marketplace-theme.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the foundation**

```bash
git add apps/web/src/app/globals.css apps/web/src/lib/ui/marketplace-theme.test.ts
git commit -m "feat(ui): add warm layered marketplace tokens"
```

### Task 2: Build shared marketplace compositions

**Files:**
- Create: `apps/web/src/components/ui/marketplace/brand-hero.tsx`
- Create: `apps/web/src/components/ui/marketplace/category-tile.tsx`
- Create: `apps/web/src/components/ui/marketplace/nearby-service-rail.tsx`
- Modify: `apps/web/src/components/ui/marketplace/app-header.tsx`
- Modify: `apps/web/src/components/ui/mobile-app-bar.tsx`
- Modify: `apps/web/src/components/ui/authenticated-bottom-nav.tsx`
- Modify: `apps/web/src/lib/ui/public-marketplace-ui.test.ts`
- Test: `apps/web/src/lib/ui/public-marketplace-ui.test.ts`

**Interfaces:**
- `BrandHero({ eyebrow, title, description, children })` renders brand background plus a cream content transition without owning search state.
- `CategoryTile({ href, label, description, icon })` renders a semantic link with a 48 px minimum target and no private data.
- `NearbyServiceRail({ rows, title, actionHref })` accepts the existing public discovery row shape and renders a horizontal rail that remains keyboard reachable.

- [ ] **Step 1: Add pure component contract tests**

Extend the UI contract suite to assert that category links, the hero heading and rail action labels use semantic text and that no component introduces rating or verification copy. Keep tests focused on exported props/helpers; use Playwright for layout geometry.

- [ ] **Step 2: Run the focused test to establish the missing exports**

Run: `pnpm exec vitest run apps/web/src/lib/ui/public-marketplace-ui.test.ts`

Expected: FAIL for the new exports.

- [ ] **Step 3: Implement the three compositions**

Use semantic `section`, `h1`/`h2`, `ul`/`li` where appropriate. Use CSS overflow only for intentional horizontal rails. `NearbyServiceRail` must link to the existing service route and use `ServiceCard` or a small shared card composition instead of duplicating provider data formatting.

- [ ] **Step 4: Align shared chrome**

Keep `AppHeader` and `MobileAppBar` responsible only for navigation context. Keep the page heading in the page content. Ensure bottom-nav links remain at least 48 px and unread count badges continue using `bg-brand-pink-strong`.

- [ ] **Step 5: Run tests and focused formatting**

Run:

```bash
pnpm exec vitest run apps/web/src/lib/ui/public-marketplace-ui.test.ts
pnpm exec prettier --check apps/web/src/components/ui/marketplace/brand-hero.tsx apps/web/src/components/ui/marketplace/category-tile.tsx apps/web/src/components/ui/marketplace/nearby-service-rail.tsx apps/web/src/components/ui/marketplace/app-header.tsx apps/web/src/components/ui/mobile-app-bar.tsx apps/web/src/components/ui/authenticated-bottom-nav.tsx apps/web/src/lib/ui/public-marketplace-ui.test.ts
```

- [ ] **Step 6: Commit the shared compositions**

```bash
git add apps/web/src/components/ui/marketplace apps/web/src/components/ui/mobile-app-bar.tsx apps/web/src/components/ui/authenticated-bottom-nav.tsx apps/web/src/lib/ui/public-marketplace-ui.test.ts
git commit -m "feat(ui): add warm marketplace compositions"
```

### Task 3: Recompose the public home around user needs

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/components/discovery/location-picker.tsx`
- Modify: `apps/web/src/components/ui/marketplace/search-field.tsx`
- Test: `tests/e2e/marketplace-app-first.spec.ts`

**Interfaces:**
- `HomePage` continues to call the existing category query and `searchDiscovery({ query, filters })` flow.
- Location remains optional and continues to use the existing `LocationPicker` contract.
- Search still submits to `/buscar` with URL-addressable query state.

- [ ] **Step 1: Extend the mobile E2E with the home information hierarchy**

Add assertions for the hero heading, category tiles, nearby rail, search label and remote entry. The test must also assert that anonymous browsing remains possible and that the document has no horizontal overflow at 320/360/390 px.

```ts
await expect(page.getByRole("heading", { name: "¿Qué necesitás resolver?" })).toBeVisible();
await expect(page.getByRole("searchbox", { name: /servicio|habilidad/i })).toBeVisible();
await expect(page.getByRole("link", { name: /remoto/i })).toBeVisible();
await expect(page.locator("body")).toHaveCSS("overflow-x", "visible");
```

- [ ] **Step 2: Run the E2E before changing the page**

Run: `pnpm exec playwright test tests/e2e/marketplace-app-first.spec.ts --project=mobile-web`

Expected: fail only for the new structure assertions.

- [ ] **Step 3: Recompose `HomePage`**

Use `BrandHero`, category tiles and `NearbyServiceRail`. Preserve the current server queries, error/empty states, provider CTA and authenticated bottom nav. The hero may contain the search form, but it must not turn the page into a client component.

- [ ] **Step 4: Make location and search visually primary without blocking**

Keep manual location available, preserve optional browser geolocation, and keep the remote link visible without requiring permission or authentication. Ensure labels and focus styles remain semantic.

- [ ] **Step 5: Run focused E2E and format**

Run:

```bash
pnpm exec playwright test tests/e2e/marketplace-app-first.spec.ts --project=mobile-web
pnpm exec prettier --check apps/web/src/app/page.tsx apps/web/src/components/discovery/location-picker.tsx apps/web/src/components/ui/marketplace/search-field.tsx tests/e2e/marketplace-app-first.spec.ts
```

- [ ] **Step 6: Commit the home**

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/discovery/location-picker.tsx apps/web/src/components/ui/marketplace/search-field.tsx tests/e2e/marketplace-app-first.spec.ts
git commit -m "feat(home): recompose marketplace around user needs"
```

### Task 4: Apply the visual hierarchy to search and discovery

**Files:**
- Modify: `apps/web/src/app/buscar/page.tsx`
- Modify: `apps/web/src/components/discovery/discovery-results.tsx`
- Modify: `apps/web/src/components/discovery/discovery-card.tsx`
- Modify: `apps/web/src/components/discovery/search-filters-sheet.tsx`
- Modify: `apps/web/src/components/discovery/discovery-pagination.tsx`
- Modify: `apps/web/src/components/ui/marketplace/service-card.tsx`
- Modify: `apps/web/src/components/ui/marketplace/provider-card.tsx`
- Modify: `apps/web/src/lib/ui/public-marketplace-ui.test.ts`
- Test: `tests/e2e/marketplace-app-first.spec.ts`

**Interfaces:**
- Preserve `DiscoveryFilters`, `ReputationDiscoveryServiceRow`, `searchHref()` and `/api/discovery` request payloads.
- Preserve URL keys for query, category, skill, modality, location, radius, price, offers, price model, sort and pagination.
- Keep the existing `hasMore`/pagination contract and safe public row fields.

- [ ] **Step 1: Add result-card and filter interaction assertions**

Cover desktop and mobile behavior: result title, provider identity, modality, price, filter button, active filter chips, clear state, pagination and remote results. Assert that no private field or exact coordinate appears in rendered text.

- [ ] **Step 2: Run the focused discovery E2E before edits**

Run: `pnpm exec playwright test tests/e2e/marketplace-app-first.spec.ts --project=mobile-web`

Expected: new visual/interaction assertions fail before implementation.

- [ ] **Step 3: Rebuild the results hierarchy**

Make search header compact and persistent. Use `ServiceCard` as the primary unit. Separate service title, provider, zone/modality, price and action visually. Keep ratings/reputation fields only when already available and real; do not add replacement claims.

- [ ] **Step 4: Make filters feel native to the marketplace**

Use a bottom sheet on mobile and a stable side panel on desktop. Keep URL state intact, preserve back/forward navigation, and avoid showing irrelevant filters as dominant content. Do not move filter parsing into JavaScript-only normalization.

- [ ] **Step 5: Verify responsive and accessibility contracts**

Run:

```bash
pnpm exec vitest run apps/web/src/lib/ui/public-marketplace-ui.test.ts
pnpm exec playwright test tests/e2e/marketplace-app-first.spec.ts --project=mobile-web
pnpm exec prettier --check apps/web/src/app/buscar/page.tsx apps/web/src/components/discovery apps/web/src/components/ui/marketplace/service-card.tsx apps/web/src/components/ui/marketplace/provider-card.tsx apps/web/src/lib/ui/public-marketplace-ui.test.ts tests/e2e/marketplace-app-first.spec.ts
```

- [ ] **Step 6: Commit search/discovery presentation**

```bash
git add apps/web/src/app/buscar/page.tsx apps/web/src/components/discovery apps/web/src/components/ui/marketplace/service-card.tsx apps/web/src/components/ui/marketplace/provider-card.tsx apps/web/src/lib/ui/public-marketplace-ui.test.ts tests/e2e/marketplace-app-first.spec.ts
git commit -m "feat(discovery): polish search and service results"
```

### Task 5: Redesign public provider and service detail surfaces

**Files:**
- Modify: `apps/web/src/app/p/[slug]/page.tsx`
- Modify: `apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx`
- Modify: `apps/web/src/components/ui/marketplace/provider-card.tsx`
- Modify: `apps/web/src/components/ui/marketplace/service-card.tsx`
- Test: `tests/e2e/marketplace-app-first.spec.ts`

**Interfaces:**
- Keep the current public routes, metadata fields and public discovery data sources.
- Keep provider favorite mutations and anonymous return-to-auth behavior unchanged.
- Keep all private fields server-only and absent from rendered metadata/OG output.

- [ ] **Step 1: Add public detail journey assertions**

Extend Playwright to open a result, verify service title/provider/price/modality, open the provider profile, and exercise favorite/contact entry without bypassing authentication. Assert that the page remains indexable server-rendered and has no horizontal overflow.

- [ ] **Step 2: Run the journey before edits**

Run: `pnpm exec playwright test tests/e2e/marketplace-app-first.spec.ts --project=mobile-web`

- [ ] **Step 3: Recompose the service detail**

Give the service title and price the strongest hierarchy, place provider identity immediately below, and keep “Consultar” as the primary action. Use a stable action surface on mobile without obscuring content. Use the existing public data only.

- [ ] **Step 4: Recompose the provider profile**

Use a warm identity header, a concise public presentation and the provider’s published services as a catalog. Render portfolio only from existing public records. Keep the provider zone approximate.

- [ ] **Step 5: Run detail E2E and formatting**

Run:

```bash
pnpm exec playwright test tests/e2e/marketplace-app-first.spec.ts --project=mobile-web
pnpm exec prettier --check "apps/web/src/app/p/[slug]/page.tsx" "apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx" apps/web/src/components/ui/marketplace/provider-card.tsx apps/web/src/components/ui/marketplace/service-card.tsx tests/e2e/marketplace-app-first.spec.ts
```

- [ ] **Step 6: Commit public details**

```bash
git add apps/web/src/app/p apps/web/src/components/ui/marketplace/provider-card.tsx apps/web/src/components/ui/marketplace/service-card.tsx tests/e2e/marketplace-app-first.spec.ts
git commit -m "feat(public): polish provider and service details"
```

### Task 6: Align authenticated consumer surfaces with the marketplace system

**Files:**
- Modify: `apps/web/src/app/(account)/layout.tsx`
- Modify: `apps/web/src/app/(account)/account/page.tsx`
- Modify: `apps/web/src/app/(account)/account/favorites/page.tsx`
- Modify: `apps/web/src/app/(account)/account/notifications/page.tsx`
- Modify: `apps/web/src/app/(account)/messages/page.tsx`
- Modify: `apps/web/src/app/(account)/messages/[conversationId]/page.tsx`
- Modify: `apps/web/src/components/conversations/conversation-thread.tsx`
- Modify: `apps/web/src/components/ui/marketplace/settings-row.tsx`
- Modify: `apps/web/src/components/ui/marketplace/empty-state.tsx`
- Modify: `apps/web/src/lib/notifications/ui-contract.test.ts`
- Test: `tests/e2e/marketplace-app-first.spec.ts`

**Interfaces:**
- Preserve authentication redirects, notification semantics, conversation actions, favorites RLS and all server actions.
- Preserve `MobileAppBar`, `AuthenticatedBottomNav`, unread count behavior and exact empty-state copy contracts.

- [ ] **Step 1: Add authenticated visual journey assertions**

Cover account, favorites, notifications empty state, messages and back navigation at mobile and desktop. Verify the bottom navigation stays usable and unread badges remain accessible.

- [ ] **Step 2: Run the focused authenticated tests before edits**

Run:

```bash
pnpm exec vitest run apps/web/src/lib/notifications/ui-contract.test.ts
pnpm exec playwright test tests/e2e/marketplace-app-first.spec.ts --project=mobile-web
```

- [ ] **Step 3: Apply the new surfaces**

Use grouped rows, layered cards and clear empty states. Keep account as a consumer account rather than a dashboard. Keep message rows contextual to the service. Do not redesign the functional provider/admin information architecture here.

- [ ] **Step 4: Apply shared tokens to provider flows without changing behavior**

Only update shared classes/layout presentation in `apps/web/src/app/(provider)/layout.tsx` and provider presentation components when needed for consistency. Do not touch provider actions, document handling, status transitions or backend contracts.

- [ ] **Step 5: Run focused checks and formatting**

Run:

```bash
pnpm exec vitest run apps/web/src/lib/notifications/ui-contract.test.ts
pnpm exec prettier --check "apps/web/src/app/(account)" "apps/web/src/app/(provider)/layout.tsx" apps/web/src/components/conversations apps/web/src/components/ui/marketplace/settings-row.tsx apps/web/src/components/ui/marketplace/empty-state.tsx
```

- [ ] **Step 6: Commit authenticated surfaces**

```bash
git add "apps/web/src/app/(account)" "apps/web/src/app/(provider)/layout.tsx" apps/web/src/components/conversations apps/web/src/components/ui/marketplace/settings-row.tsx apps/web/src/components/ui/marketplace/empty-state.tsx apps/web/src/lib/notifications/ui-contract.test.ts tests/e2e/marketplace-app-first.spec.ts
git commit -m "feat(ui): align authenticated marketplace surfaces"
```

### Task 7: Run the complete local verification gate

**Files:**
- Test: `apps/web/src/lib/ui/marketplace-theme.test.ts`
- Test: `apps/web/src/lib/ui/public-marketplace-ui.test.ts`
- Test: `apps/web/src/lib/notifications/ui-contract.test.ts`
- Test: `tests/e2e/marketplace-app-first.spec.ts`
- Verify: all files changed by Tasks 1–6

**Interfaces:**
- No new interfaces. This task verifies the already-preserved routes, data contracts, accessibility constraints and responsive compositions.

- [ ] **Step 1: Check the final diff and changed-file formatting**

Run:

```powershell
git diff --name-only origin/main...HEAD
git diff --check
```

Run Prettier `--check` only against changed text files from the branch. Do not format historical baseline debt.

- [ ] **Step 2: Run unit and static gates**

Run one by one:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

If global format fails only on unchanged baseline files, record the baseline evidence and keep the changed-file check green; do not mass-format the repository.

- [ ] **Step 3: Run browser coverage**

Run desktop and mobile Playwright for:

```bash
pnpm exec playwright test tests/e2e/marketplace-app-first.spec.ts
```

The suite must cover anonymous home/search, category or service opening, filters, provider/service detail, optional location, remote entry and authenticated navigation at 320/360/390 px plus desktop.

- [ ] **Step 4: Review accessibility and privacy manually**

Verify with browser inspection:

- no horizontal overflow at 320, 360 or 390 px;
- visible keyboard focus;
- semantic headings and labels;
- all primary controls at least 48 px;
- no exact coordinates or private fields in public DOM/metadata;
- no fabricated trust/reputation claims.

- [ ] **Step 5: Commit only if verification requires a scoped test/doc adjustment**

```bash
git status --short
git diff --check
```

Do not create an empty commit. If there are no pending changes, leave the worktree untouched.

- [ ] **Step 6: Publish the branch after all required checks pass**

```bash
git push origin codex/marketplace-app-first
git fetch origin
git rev-parse HEAD
git rev-parse origin/codex/marketplace-app-first
git rev-list --left-right --count origin/codex/marketplace-app-first...HEAD
git status --short
```

Expected: local and remote HEAD match, divergence is `0 0`, and the working tree is clean.

## Intentionally deferred

- Admin visual redesign.
- New marketplace capabilities, jobs, proposals, payments, reviews, reputation or notifications.
- Map-first discovery.
- New backend migrations/RPCs/policies.
- Generated or fake provider imagery/data.

