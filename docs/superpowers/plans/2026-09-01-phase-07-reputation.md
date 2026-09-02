# Phase 07 — Reviews, Ranking and Repeat Hiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn completed Changas jobs into verified provider reputation, context-aware discovery ranking, polished favorites, and a safe repeat-hiring flow.

**Architecture:** PostgreSQL remains authoritative for review eligibility, anti-manipulation, aggregates, and rehire authorization. Public pages consume explicit read models/RPCs; raw private Job/Review moderation data is not exposed. Discovery keeps textual/service relevance primary and adds bounded reputation signals plus controlled new-provider exposure instead of sorting by raw stars alone.

**Tech Stack:** Next.js App Router + TypeScript, Supabase PostgreSQL/Auth/RLS, Vitest, pgTAP, runtime Node checks, Playwright, Lighthouse.

**Spec:** `CHANGAS_MASTER_PLAN.md` — Phase 07 plus sections 2.4, 11, 16, 17, 23–25.

## Global Constraints

- Branch: `codex/phase-07-reputation`.
- Baseline: approved Phase 06 HEAD `36ee41f880c6f106ceb12da1f87b355fb46bba38`.
- Reviews are created only from `COMPLETED` Jobs.
- V1 public reputation is client → provider; do not invent public client reputation.
- Rating is integer 1–5; optional dimensions are limited to `quality`, `punctuality`, and `communication`, each 1–5 when supplied.
- Review records retain Job, Service, Skill and accepted-proposal context even if catalog data changes later.
- Providers cannot update/delete client reviews; a negative review is not removable just because it is negative.
- Review reports do not implement Phase 09 moderation decisions.
- Ranking must not use raw average rating as the only reputation signal.
- New providers receive a bounded exposure signal; no paid boosts or mysterious public reputation score.
- Rehire creates a new Proposal flow using current service terms; it never reopens or mutates the completed Job or silently reuses the old price.
- Real payments, notifications, admin moderation and Phase 08+ work remain out of scope.
- Keep migrations append-only.

---

### Task 1: Domain reputation and ranking contracts

**Files:**

- Modify: `packages/domain/src/discovery.ts`
- Modify: `packages/domain/src/discovery.test.ts`
- Reuse: `packages/domain/src/discovery-public.ts` Bayesian `adjustedRating(...)` helper rather than duplicating the formula.

**Interfaces:**

- Extends `DiscoveryRankingSignals` with bounded reputation/completion/repeat-client inputs.
- Reuses `adjustedRating(observedAverage, observedCount, priorAverage, priorWeight)` with Phase 07 constants (`priorMean = 4.2`, `priorWeight = 8`) when provider metrics are calculated.
- `rankDiscoveryResult` keeps text/skill/category/distance relevance dominant and adds bounded reputation/completion/repeat/new-provider bonuses.

- [x] **Step 1: Write failing unit tests**

Add tests proving:

```ts
expect(adjustedRating(5, 2, 4.2, 8)).toBeLessThan(
  adjustedRating(4.9, 400, 4.2, 8),
);
expect(rankDiscoveryResult(strongTextWeakReputation)).toBeGreaterThan(
  rankDiscoveryResult(weakTextStrongReputation),
);
expect(rankDiscoveryResult(newProviderSignals)).toBeGreaterThan(
  rankDiscoveryResult({ ...newProviderSignals, newProviderExposure: false }),
);
```

Also extend filter/sort tests for `best-rated` and `most-completed`.

- [x] **Step 2: Run targeted tests and verify RED**

Evidence: CI `33580540626` failed exactly because `best-rated` fell back to `recommended` and reputation inputs did not affect ranking.

- [x] **Step 3: Implement minimal domain contracts**

Use pure TypeScript only; no React dependency. Rating/count/completion inputs are clamped defensively. Reputation bonuses remain bounded and cannot outweigh a major text/skill relevance difference.

- [x] **Step 4: Run targeted tests and verify GREEN**

Evidence: the implementation commit passed all 26 Vitest files / 75 tests before the separate formatting gate.

- [x] **Step 5: Commit**

Commit: `44d67dd893cce2d282d434400341e20f4bfc0a19` (`feat(phase07): add reputation ranking domain contracts`).

---

### Task 2: Verified review schema, eligibility and anti-manipulation

**Files:**

- Create: `supabase/migrations/20260901230000_phase_07_reviews.sql`
- Create: `supabase/tests/phase-07-reviews.sql`

**Interfaces:**

- Tables: `reviews`, `review_replies`, `review_reports`.
- RPCs: `create_job_review`, `upsert_provider_review_reply`, `report_review`.
- Public review row permanently stores `job_id`, `service_id`, `skill_id`, `reviewer_user_id`, `provider_user_id`, `rating`, optional dimensions, text, and immutable service/skill snapshots.

- [ ] **Step 1: Write pgTAP RED tests**

Prove all of the following before implementation:

```text
CONFIRMED/IN_PROGRESS/CANCELLED/NO_SHOW Job => review rejected
COMPLETED Job + owning client => review accepted
same client + same Job second review => rejected/idempotently conflicts
outsider => rejected
provider reviewing own Job/provider => rejected
rating 0/6 => rejected
provider direct UPDATE/DELETE review => denied
provider can create at most one public reply to a review about themselves
outsider cannot reply
review author cannot report own review
participant/other authenticated user may file one report per review
anonymous can read only public review read models, not report rows
```

- [ ] **Step 2: Run pgTAP and verify RED**

Run: `pnpm dlx supabase@2.116.0 test db --local` after local reset.

Expected: Phase 07 test fails because schema/functions do not exist.

- [ ] **Step 3: Implement append-only migration**

`reviews` has a unique `job_id` for client→provider V1. Do not grant authenticated direct INSERT/UPDATE/DELETE. `create_job_review` locks the Job, requires `status='COMPLETED'`, requires `auth.uid()=jobs.client_user_id`, rejects self-review, snapshots the current Job-linked Service/Skill names/ids, validates rating/dimensions/text, then inserts once.

`review_replies` has `review_id` unique; provider-only RPC may insert/update the single reply, but no delete grant.

`review_reports` stores reason enum/text and unique `(review_id, reporter_user_id)`; reports remain private pending Phase 09 moderation.

- [ ] **Step 4: Run pgTAP and verify GREEN**

Expected: all legacy tests plus Phase 07 review tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat(phase07): add verified review authority`.

---

### Task 3: Reputation aggregates and contextual public read models

**Files:**

- Create: `supabase/migrations/20260901231000_phase_07_reputation_metrics.sql`
- Extend: `supabase/tests/phase-07-reviews.sql`

**Interfaces:**

- Table: `provider_reputation_metrics` (internal aggregate cache, no public direct write).
- Functions/views: `refresh_provider_reputation_metrics`, `public_provider_reputation`, `public_provider_skill_reputation`, `public_service_reputation`, `list_public_provider_reviews`.
- Metrics: completed jobs, cancelled jobs, no-show jobs, completion rate, cancellation rate, no-show rate, review count, average rating, adjusted rating, repeat-client count.

- [ ] **Step 1: Add RED aggregate tests**

Create completed/cancelled/no-show jobs and reviews proving:

```text
completed_jobs counts only COMPLETED
repeat_client_count counts distinct clients with >=2 COMPLETED Jobs for same provider
review_count/average/adjusted rating update after verified review
skill aggregate contains only reviews/jobs in that skill context
service aggregate contains only that service context
cancellation/no-show rates are derived from terminal outcomes, not arbitrary active jobs
```

- [ ] **Step 2: Run pgTAP and verify RED**

Expected: missing metrics/read models.

- [ ] **Step 3: Implement aggregate cache and refresh triggers**

Backfill every existing provider. Refresh on relevant `jobs.status` transition and after verified review insertion. Keep aggregate refresh provider-scoped and transactionally consistent.

Use Bayesian adjusted rating with the same documented constants as domain tests. Do not expose an opaque public 0–100 score.

- [ ] **Step 4: Evaluate response-time reliability**

Inspect current conversation/message semantics. Implement response-time only if a normalized, unambiguous provider-response event can be derived without guessing. If not, explicitly omit it from schema/UI/report and record the reason: conversations can contain reused threads/system/proposal events and Phase 07 must not publish a misleading metric.

- [ ] **Step 5: Run pgTAP and verify GREEN**

- [ ] **Step 6: Commit**

Commit message: `feat(phase07): aggregate provider reputation metrics`.

---

### Task 4: Discovery ranking update and new-provider exposure

**Files:**

- Create: `supabase/migrations/20260901232000_phase_07_discovery_ranking.sql`
- Modify: `apps/web/src/lib/discovery/server.ts`
- Modify: `apps/web/src/lib/supabase/database.types.ts`
- Modify search UI/result-card files under `apps/web/src/app/buscar` and reusable discovery components if present.
- Extend: `supabase/tests/phase-03-discovery.sql` or create `supabase/tests/phase-07-ranking.sql`.
- Extend: `apps/web/scripts/phase-03-discovery-runtime.mjs` only where backward compatibility needs coverage; otherwise use Phase 07 runtime.

**Interfaces:**

- Public RPC remains `search_discovery_services_v3` unless changing the return shape requires a versioned `v4`; never silently break an older signature used by browser code.
- Result rows add understandable signals: `rating_average`, `review_count`, `completed_jobs`.
- Sort keys add `best-rated` and `most-completed`.

- [ ] **Step 1: Add ranking RED tests**

With equal textual/service relevance prove:

```text
4.9 / 400 reviews ranks above 5.0 / 2 reviews when other history is equal
strong completion history improves recommended rank
raw stars alone cannot dominate poor operational history
new provider receives bounded exposure but does not beat a materially stronger textual match
best-rated uses adjusted/confidence-aware rating, then volume/history tie-breakers
most-completed uses completed jobs, then adjusted rating/relevance tie-breakers
```

- [ ] **Step 2: Run tests and verify RED**

- [ ] **Step 3: Implement versioned SQL ranking**

Preserve FTS/fuzzy/category/skill/distance scoring from Phase 03. Join internal provider metrics. Add only bounded bonuses for adjusted rating, completed history, completion rate, repeat clients and new-provider exposure. Keep public exact location protections unchanged.

- [ ] **Step 4: Update TypeScript RPC types/UI**

Search cards show rating + count and completed jobs when available. Providers with zero reviews show `Nuevo en Changas`, not fake `0.0` stars.

- [ ] **Step 5: Run unit/pgTAP/discovery runtime and verify GREEN**

- [ ] **Step 6: Commit**

Commit message: `feat(phase07): rank discovery with verified reputation`.

---

### Task 5: Public reviews, provider reply/report UI, and favorites polish

**Files:**

- Create: `apps/web/src/lib/reputation/server.ts`
- Create: `apps/web/src/lib/reputation/actions.ts`
- Create focused reputation UI components under `apps/web/src/components/reputation/` if needed.
- Modify: `apps/web/src/app/p/[slug]/page.tsx`
- Modify: service page `apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx`
- Modify: `apps/web/src/app/(account)/account/favorites/page.tsx`
- Modify: `apps/web/src/lib/favorites/actions.ts` only if necessary.
- Add/extend Vitest tests for normalization/action guards.

**Interfaces:**

- Provider page: overall rating/count, completed jobs, repeat clients, contextual skill summaries, paged recent verified reviews and provider replies.
- Service page: service-specific rating/count/reviews.
- Favorites list: avatar/headline plus verified rating/count/completed-jobs summary.

- [ ] **Step 1: Write failing server normalization/action tests**

Validate rating/text/dimensions/report reason and safe RPC error mapping.

- [ ] **Step 2: Implement server adapters/actions**

No service role in browser/server component user paths. Mutations call authenticated RPCs.

- [ ] **Step 3: Add public UI**

Use semantic `<article>` review cards, visible star text (`4,8 de 5`), dates, service/skill context, optional dimensions only when present, and public provider reply. Do not expose report metadata.

- [ ] **Step 4: Harden favorites**

Update `set_provider_favorite` in an append-only migration if required to reject self-favorite; enrich `list_my_favorite_providers` with reputation fields while keeping private data absent.

- [ ] **Step 5: Run unit/build/format checks**

- [ ] **Step 6: Commit**

Commit message: `feat(phase07): surface verified provider reviews`.

---

### Task 6: Review-from-completed-Job and repeat hiring

**Files:**

- Create or extend migration: `supabase/migrations/20260901233000_phase_07_rehire.sql`
- Modify: `apps/web/src/app/(account)/jobs/[jobId]/page.tsx`
- Modify: `apps/web/src/app/(account)/jobs/actions.ts`
- Create/modify reputation/job server adapter as appropriate.
- Extend: `supabase/tests/phase-07-reviews.sql`
- Create: `supabase/tests/phase-07-rehire.sql`

**Interfaces:**

- Completed client Job shows `Dejar reseña` if no review exists.
- Completed client Job shows `Contratar nuevamente` form.
- Rehire reuses the existing service conversation safely but creates a brand-new Proposal using current Service terms via existing proposal authority.
- Fixed-price current service → new `DIRECT_BOOKING`; non-fixed/quote service → new `QUOTE_REQUEST`.

- [ ] **Step 1: Add RED rehire tests**

Prove:

```text
only original client can rehire from completed Job
active/cancelled/no-show Job cannot use rehire shortcut
old Job id/status/proposal version never changes
new Proposal id != old Proposal id
new Proposal snapshots current Service title/price/modality, not old accepted price
new schedule values belong only to new Proposal
if current Service/provider is paused/unavailable, rehire fails with actionable conflict/not-found
```

- [ ] **Step 2: Run pgTAP and verify RED**

- [ ] **Step 3: Implement minimal rehire RPC/server action**

Prefer a dedicated authenticated `create_rehire_proposal_from_job(...)` RPC that locks/validates the completed Job, current provider/service availability and new schedule, then delegates equivalent invariant logic to the same current-service snapshot rules used by proposal creation. Never mutate/reopen the historical Job.

- [ ] **Step 4: Add completed-Job UI**

Review form: rating 1–5, text, optional 3 dimensions. Rehire form requires new scheduling input appropriate to the selected/current schedule type and communicates that current terms apply.

- [ ] **Step 5: Run pgTAP/unit/build and verify GREEN**

- [ ] **Step 6: Commit**

Commit message: `feat(phase07): add verified review and rehire flows`.

---

### Task 7: Phase 07 runtime, E2E and CI gates

**Files:**

- Create: `apps/web/scripts/phase-07-reputation-runtime.mjs`
- Create: `tests/e2e/phase-07-reputation.spec.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Runtime executes after Phase 06 Jobs runtime and before synthetic seed browser reset.
- Playwright automatically runs Desktop Chrome + Pixel 5 through existing config.

- [ ] **Step 1: Build runtime security/integrity coverage**

Runtime must prove completed-only eligibility, duplicate/self/outsider denial, provider cannot delete bad review, one provider reply, report privacy, aggregate updates, repeat-client calculation, ranking ordering, bounded new-provider exposure, favorites self-protection, and rehire immutability/current terms.

- [ ] **Step 2: Add E2E journey**

Create/complete a synthetic Job, leave a verified review as client, assert it appears on provider/service pages, assert provider metrics/favorites render, and perform rehire to a distinct Proposal. Check no horizontal overflow on provider/review/completed-job screens.

- [ ] **Step 3: Wire Phase 07 runtime into CI**

Add one explicit Phase 07 runtime step; keep all earlier gates intact.

- [ ] **Step 4: Run full CI and debug only first real failures**

Expected final gates: lint, typecheck, unit, build, format, diff, clean Supabase reset, all pgTAP, runtimes 03–07, Lighthouse, Playwright Desktop Chrome + Pixel 5.

- [ ] **Step 5: Commit**

Commit message: `test(phase07): cover reputation and rehire end to end`.

---

### Task 8: Final Phase 07 report and verification

**Files:**

- Create: `docs/reports/phase-07-reputation.md`

- [ ] **Step 1: Audit against every Phase 07 Master Plan task/acceptance criterion**

Explicitly account for review eligibility, ratings/text/context/dimensions, reply/reporting, provider + skill/service aggregates, completion/cancellation/no-show metrics, repeat-client count, ranking, favorites, rehire, new-provider exposure and anti-manipulation. Record response-time as implemented only if reliable; otherwise record the evidence-based omission.

- [ ] **Step 2: Write report with exact evidence**

Include branch, baseline, final HEAD, migrations, RLS/RPC authority, ranking formula rationale, test counts, runtime names, Lighthouse, Desktop/Pixel Playwright, TDD RED→GREEN evidence and known deferred Phase 08/09/11 work.

- [ ] **Step 3: Commit report**

Commit message: `docs(phase07): add implementation report`.

- [ ] **Step 4: Run CI on the report commit itself**

Do not claim PASS from a pre-report commit.

- [ ] **Step 5: Verification-before-completion**

Use `superpowers:verification-before-completion`, inspect the actual final CI run, confirm both jobs success and exact final HEAD.

- [ ] **Step 6: STOP**

Final verdict may be `PHASE 07 PASS` only with fresh evidence. Do not create or start `codex/phase-08-notifications` until explicit user approval.
