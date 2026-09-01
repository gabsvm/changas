# Phase 05 Proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured proposals, revisions, acceptance and fake-payment job confirmation without real money.

**Architecture:** PostgreSQL owns proposal/payment/job economic truth and legal transitions through security-definer RPCs. TypeScript domain code mirrors state rules and exposes a provider-agnostic payment interface; the web UI renders proposal cards in the existing conversation and calls server actions only. Accepted proposal versions are immutable snapshots.

**Tech Stack:** PostgreSQL/Supabase RLS + RPCs, Next.js App Router, React, TypeScript, Vitest, pgTAP, Playwright.

**Spec:** `CHANGAS_MASTER_PLAN.md`, Phase 05 and sections 13, 15, 21.

## Global Constraints

- No real payment provider in this phase.
- Fake payment actions are local/dev/test only and must not be exposed in production.
- Conversation membership never implies permission to accept on behalf of the client.
- Economic state changes only through server-authoritative RPCs.
- Accepted proposal terms remain immutable and auditable after service edits.
- Duplicate acceptance/payment callbacks must be idempotent.

---

### Task 1: Domain state machine and payment abstraction

**Files:**
- Create: `packages/domain/src/proposals.test.ts`
- Create: `packages/domain/src/proposals.ts`
- Create: `packages/domain/src/payments.test.ts`
- Create: `packages/domain/src/payments.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces proposal kinds/statuses, transition guards, `PaymentProvider`, `FakePaymentProvider`, and deterministic fake outcomes.

- [ ] Write failing tests for legal/illegal proposal transitions and actor permissions.
- [ ] Run CI and confirm domain tests fail because implementation does not exist.
- [ ] Implement the minimal domain state machine and fake payment provider.
- [ ] Re-run CI and require the domain tests to pass.

### Task 2: Proposal/version/payment/job persistence

**Files:**
- Create: `supabase/tests/phase-05-proposals.sql`
- Create: `supabase/migrations/20260901050000_phase_05_proposals.sql`

**Interfaces:**
- Produces `proposals`, immutable `proposal_versions`, `payment_attempts`, `jobs`, audit events, participant-only reads, and RPCs for create/revise/transition/payment.

- [ ] Add pgTAP tests first for ownership, immutability, legal transitions and payment idempotency.
- [ ] Confirm pgTAP is red before migration exists.
- [ ] Implement schema, grants, RLS, constraints and transactional RPCs.
- [ ] Require pgTAP green.

### Task 3: Conversation proposal server layer

**Files:**
- Create: `apps/web/src/lib/proposals/server.ts`
- Create: `apps/web/src/lib/proposals/server.test.ts`
- Create: `apps/web/src/app/(account)/messages/proposal-actions.ts`

**Interfaces:**
- Produces list/create/revise/respond/pay server functions consumed by the thread UI.

- [ ] Write failing parsing/authorization/error-mapping tests.
- [ ] Implement typed RPC wrappers and server actions.
- [ ] Run unit tests and typecheck.

### Task 4: Proposal cards and composer inside conversation

**Files:**
- Create: `apps/web/src/components/conversations/proposal-card.tsx`
- Create: `apps/web/src/components/conversations/proposal-composer.tsx`
- Modify: `apps/web/src/components/conversations/conversation-thread.tsx`
- Modify: `apps/web/src/app/(account)/messages/[conversationId]/page.tsx`

**Interfaces:**
- Consumes Phase 05 server layer.
- Renders structured proposal history and role-appropriate controls without parsing informal chat as economic truth.

- [ ] Load proposal summaries alongside conversation data.
- [ ] Render versioned cards and legal actions only.
- [ ] Add dev-only fake success/pending/failure controls while `NODE_ENV !== 'production'`.
- [ ] Preserve current chat/attachments/realtime behavior.

### Task 5: Runtime and browser verification

**Files:**
- Create: `apps/web/scripts/phase-05-proposals-runtime.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/mobile-smoke.spec.ts`

**Interfaces:**
- Proves cross-user denial, client-only acceptance, immutable snapshots, fake payment outcomes and duplicate callback idempotency.

- [ ] Add runtime checks to CI after Supabase reset.
- [ ] Add browser smoke coverage for proposal card/accept/fake-pay flow.
- [ ] Run full CI: lint, typecheck, unit, build, format, pgTAP, Phase 03/04/05 runtime, Lighthouse and Playwright.
- [ ] Stop after Phase 05.
