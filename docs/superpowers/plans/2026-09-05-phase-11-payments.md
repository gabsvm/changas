# Phase 11 Real Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Mercado Pago Split Payments 1:1 + Checkout Pro behind Changas's existing payment boundaries while preserving fake-provider testability and making webhook reconciliation, commission, refunds, ledger, settlement visibility, and admin reconciliation authoritative and idempotent.

**Architecture:** Extend the existing provider-agnostic proposal/job payment boundaries with a hosted-checkout orchestration layer and append-only financial state in Supabase. Mercado Pago protocol details stay inside a dedicated adapter; redirects are display-only; signed webhook + server-side provider fetch drives authoritative reconciliation. Financial truth is persisted in integer minor units and immutable ledger entries, with monotonic payment/refund state transitions and server-only mutation RPCs.

**Tech Stack:** Next.js 16.3.3 App Router, TypeScript, pnpm workspaces, Supabase/Postgres/RLS/pgTAP, Vitest, Playwright, GitHub Actions, Mercado Pago REST APIs/Checkout Pro/OAuth/Webhooks.

**Spec:** `docs/superpowers/specs/2026-09-05-phase-11-payments-design.md`

## Global Constraints

- Branch: `codex/phase-11-payments` only; do not touch `main` or Phase 12.
- Base: `b4fda81461144a3d9aea1ef6b771cd9ce01bcb84`.
- Provider decision: Mercado Pago Split Payments 1:1 + Checkout Pro.
- Preserve `FakePaymentProvider` for deterministic tests.
- Never trust redirect success; webhook/server reconciliation is authoritative.
- Validate webhook signatures and refetch authoritative payment state from Mercado Pago before financial mutation.
- Persist financial amounts as integer minor units; never store floating-point financial truth.
- New database changes are append-only migrations; never rewrite historical migrations.
- Financial transition RPCs remain `service_role` only.
- Seller OAuth tokens remain server-only and encrypted at rest.
- No live/production credentials are introduced in Phase 11.
- Every behavior change follows RED -> GREEN -> REFACTOR and records the failing test evidence before production code.
- Preserve all Phase 00-10 tests and journeys.

---

## File Structure

### Domain and configuration
- Modify `packages/domain/src/payments.ts` — marketplace-facing payment protocol types/status normalization contracts while retaining fake provider.
- Create `packages/domain/src/payment-finance.ts` — pure commission/refund/monotonic-state helpers.
- Create `packages/domain/src/payment-finance.test.ts` — pure financial behavior tests.
- Modify `packages/domain/src/index.ts` — export Phase 11 payment types/helpers.
- Modify `packages/config/src/server.ts` — validated Mercado Pago/server payment configuration.
- Modify `.env.example` — names only, no secrets.

### Web payment subsystem
- Create `apps/web/src/lib/payments/types.ts` — provider-neutral checkout/event/refund DTOs.
- Create `apps/web/src/lib/payments/crypto.ts` — AES-256-GCM token encryption/decryption.
- Create `apps/web/src/lib/payments/crypto.test.ts`.
- Create `apps/web/src/lib/payments/oauth-state.ts` — signed/expiring OAuth state helper.
- Create `apps/web/src/lib/payments/oauth-state.test.ts`.
- Create `apps/web/src/lib/payments/mercado-pago.ts` — Mercado Pago REST adapter.
- Create `apps/web/src/lib/payments/mercado-pago.test.ts`.
- Create `apps/web/src/lib/payments/server.ts` — orchestration for account connection, checkout creation, reconciliation, refund, admin reads.
- Create `apps/web/src/lib/payments/server.test.ts`.

### Routes/UI
- Create `apps/web/src/app/api/payments/mercado-pago/oauth/start/route.ts`.
- Create `apps/web/src/app/api/payments/mercado-pago/oauth/callback/route.ts`.
- Create `apps/web/src/app/api/payments/mercado-pago/webhook/route.ts`.
- Create `apps/web/src/app/payments/return/success/page.tsx`.
- Create `apps/web/src/app/payments/return/pending/page.tsx`.
- Create `apps/web/src/app/payments/return/failure/page.tsx`.
- Create `apps/web/src/components/payments/provider-payment-account.tsx`.
- Modify `apps/web/src/app/(provider)/provider/manage/page.tsx` — surface Mercado Pago connection state.
- Create `apps/web/src/app/admin/payments/page.tsx` — admin reconciliation/payment visibility.
- Modify `apps/web/src/app/admin/layout.tsx` — admin navigation entry if existing pattern requires it.

### Database
- Create `supabase/migrations/20260905xxxx00_phase_11_payment_accounts_checkout.sql`.
- Create `supabase/migrations/20260905xxxx10_phase_11_payment_events_ledger.sql`.
- Create `supabase/migrations/20260905xxxx20_phase_11_payment_reconciliation.sql`.
- Create `supabase/migrations/20260905xxxx30_phase_11_refunds_settlements.sql`.
- Create `supabase/tests/phase-11-payments-schema.sql`.
- Create `supabase/tests/phase-11-payment-reconciliation.sql`.
- Create `supabase/tests/phase-11-refunds-ledger.sql`.

### Runtime/E2E/docs
- Create `apps/web/scripts/phase-11-payments-runtime.mjs`.
- Create `tests/e2e/phase-11-payments.spec.ts`.
- Modify `.github/workflows/ci.yml` — add Phase 11 runtime gate after schema is available.
- Create `docs/reports/phase-11-payments.md`.

---

### Task 1: Pure financial rules and monotonic state helpers

**Files:**
- Create: `packages/domain/src/payment-finance.ts`
- Create: `packages/domain/src/payment-finance.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces: `calculateMarketplaceFeeMinor(grossMinor: number, feeBps: number): number`
- Produces: `calculateProviderExpectedNetMinor(grossMinor: number, marketplaceFeeMinor: number): number`
- Produces: `assertValidRefundAmount(originalMinor: number, alreadyRefundedMinor: number, requestedMinor: number): void`
- Produces: `canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean`

- [ ] **Step 1: Write failing unit tests** proving integer-floor BPS calculation, invalid BPS rejection, safe-integer enforcement, provider net arithmetic, cumulative refund bounds, `PENDING -> SUCCEEDED|FAILED`, identical terminal replay, and rejection of contradictory terminal regressions.
- [ ] **Step 2: Commit RED only** as `test(phase11): define financial state rules`.
- [ ] **Step 3: Observe CI/unit failure** specifically because helpers/exports are missing.
- [ ] **Step 4: Implement minimal pure helpers** with no provider/network code.
- [ ] **Step 5: Commit GREEN** as `feat(phase11): add financial state rules`.
- [ ] **Step 6: Verify unit suite + full validate job green** before continuing.

### Task 2: Server payment configuration contract

**Files:**
- Modify: `packages/config/src/server.ts`
- Modify: `.env.example`
- Test: create `packages/config/src/server.test.ts` if package test discovery supports it; otherwise cover via existing config consumers in web tests.

**Interfaces:**
- Produces: `getPaymentServerEnv()` returning validated `clientId`, `clientSecret`, `webhookSecret`, `tokenEncryptionKey`, `tokenEncryptionKeyVersion`, `marketplaceFeeBps`, `providerMode`.

- [ ] **Step 1: Write failing tests** for missing secrets, invalid 32-byte encryption key material, invalid fee BPS (<0 or >10000), invalid key version, and test/live provider mode parsing.
- [ ] **Step 2: Commit RED** `test(phase11): define payment server config` and observe expected failure.
- [ ] **Step 3: Implement strict parser**; payment-specific env is loaded only by payment code, not by generic pages, so ordinary Phase 10 preview pages do not fail merely because Mercado Pago config is absent.
- [ ] **Step 4: Document variable names only** in `.env.example`.
- [ ] **Step 5: Commit GREEN** `feat(phase11): add payment server config` and verify.

### Task 3: Token encryption and OAuth state security

**Files:**
- Create: `apps/web/src/lib/payments/crypto.ts`
- Create: `apps/web/src/lib/payments/crypto.test.ts`
- Create: `apps/web/src/lib/payments/oauth-state.ts`
- Create: `apps/web/src/lib/payments/oauth-state.test.ts`

**Interfaces:**
- Produces: `encryptPaymentToken(plaintext, key, keyVersion)` -> ciphertext envelope `{ciphertext, iv, authTag, keyVersion}`.
- Produces: `decryptPaymentToken(envelope, key)`.
- Produces: `createOAuthState({providerUserId, returnPath}, secret, now)`.
- Produces: `verifyOAuthState(state, secret, now)` with expiry and tamper detection.

- [ ] **Step 1: RED tests** for round-trip encryption, nonce uniqueness, tampered ciphertext/auth-tag failure, wrong key failure, OAuth state round-trip, expiry, tamper detection, and unsafe return-path rejection.
- [ ] **Step 2: Commit RED** and confirm expected failures.
- [ ] **Step 3: GREEN implementation** using Node `crypto` AES-256-GCM and HMAC-SHA256 signed OAuth state.
- [ ] **Step 4: Commit GREEN** and verify unit suite.

### Task 4: Phase 11 database schema, RLS, and immutable ledger

**Files:**
- Create: `supabase/migrations/20260905xxxx00_phase_11_payment_accounts_checkout.sql`
- Create: `supabase/migrations/20260905xxxx10_phase_11_payment_events_ledger.sql`
- Create: `supabase/tests/phase-11-payments-schema.sql`

**Interfaces:**
- Produces tables: `payment_provider_accounts`, `payment_checkout_sessions`, `payment_provider_events`, `financial_ledger_entries`.
- Produces safe read RPC/view for providers to read only connection state/non-sensitive references.
- Produces service-role-only insert/update functions for sensitive payment account/token data and event/ledger mutation.

- [ ] **Step 1: RED pgTAP** asserting tables/types/constraints do not yet exist, token columns are not readable to authenticated users, financial tables reject authenticated mutation, event uniqueness, ledger idempotency uniqueness, and ledger rows cannot be updated/deleted through exposed roles.
- [ ] **Step 2: Commit RED** and confirm `supabase-integration` fails for missing Phase 11 schema.
- [ ] **Step 3: GREEN append-only migrations** with explicit checks, grants, RLS, foreign keys, integer minor units, and unique idempotency/event keys.
- [ ] **Step 4: Commit GREEN** and verify all pgTAP including existing Phase 01-10 remains green.

### Task 5: Authoritative payment reconciliation RPC

**Files:**
- Create: `supabase/migrations/20260905xxxx20_phase_11_payment_reconciliation.sql`
- Create: `supabase/tests/phase-11-payment-reconciliation.sql`

**Interfaces:**
- Produces `public.reconcile_provider_payment(target_checkout_session_id uuid, provider_payment_reference text, provider_status public.payment_status, provider_amount_minor bigint, provider_currency_code text, provider_account_reference text, provider_event_key text)` returning payment attempt / resulting proposal or scope-change state / job ID.
- Derives client/provider/amount/currency from durable checkout/session rows; caller does not supply actor authority.

- [ ] **Step 1: RED pgTAP** for service-role-only execution, first PENDING observation, `PENDING -> SUCCEEDED`, `PENDING -> FAILED`, identical replay, terminal regression rejection, amount/currency/seller mismatch rejection, duplicate provider event idempotency, and concurrent success producing one Job + one ledger effect set.
- [ ] **Step 2: Commit RED** and observe targeted failures.
- [ ] **Step 3: GREEN RPC** using row locks, monotonic transitions, durable checkout authority, and transactional ledger/business effects.
- [ ] **Step 4: Route proposal payments through existing job-creation semantics rather than duplicating them; preserve fixed-slot hold release/consume behavior.**
- [ ] **Step 5: Commit GREEN** and verify pgTAP + Phase 10 runtime journeys.

### Task 6: Mercado Pago provider adapter

**Files:**
- Create: `apps/web/src/lib/payments/types.ts`
- Create: `apps/web/src/lib/payments/mercado-pago.ts`
- Create: `apps/web/src/lib/payments/mercado-pago.test.ts`

**Interfaces:**
- Produces `MercadoPagoPaymentProvider` methods: `exchangeOAuthCode`, `refreshOAuthToken`, `createCheckoutSession`, `fetchPayment`, `refund`, `verifyWebhook`.
- Uses injectable `fetch` for tests; production default is global server fetch.

- [ ] **Step 1: RED adapter tests** with deterministic HTTP fixtures for OAuth exchange/refresh, preference creation payload, `marketplace_fee`, external reference, notification URL, approved/pending/rejected normalization, malformed payload rejection, refund total/partial, 429/5xx classification, and webhook HMAC fixed vectors.
- [ ] **Step 2: Commit RED** and verify missing adapter failures.
- [ ] **Step 3: GREEN adapter** using REST requests with strict schema validation and provider-neutral outputs; no marketplace DB transitions inside adapter.
- [ ] **Step 4: Commit GREEN** and verify unit suite.

### Task 7: Seller OAuth connection flow

**Files:**
- Create: `apps/web/src/lib/payments/server.ts`
- Create: `apps/web/src/lib/payments/server.test.ts`
- Create: `apps/web/src/app/api/payments/mercado-pago/oauth/start/route.ts`
- Create: `apps/web/src/app/api/payments/mercado-pago/oauth/callback/route.ts`
- Create: `apps/web/src/components/payments/provider-payment-account.tsx`
- Modify: `apps/web/src/app/(provider)/provider/manage/page.tsx`

**Interfaces:**
- Produces provider action/read methods `getProviderPaymentAccountState()`, `buildMercadoPagoOAuthRedirect()`, `completeMercadoPagoOAuthCallback()`.

- [ ] **Step 1: RED server/route tests** for authenticated provider requirement, state binding, tampered/expired state rejection, code exchange, encrypted token persistence, refresh-token replacement, disconnected/re-auth state, and no token material in returned UI state.
- [ ] **Step 2: Commit RED**, observe failure.
- [ ] **Step 3: GREEN orchestration/routes/UI** using server-only config and encrypted persistence RPC.
- [ ] **Step 4: Commit GREEN** and verify unit/build/typecheck.

### Task 8: Real checkout creation and redirect-only return pages

**Files:**
- Extend: `apps/web/src/lib/payments/server.ts`
- Extend test: `apps/web/src/lib/payments/server.test.ts`
- Modify payment trigger paths in proposal/job actions where current fake payment is user-invoked.
- Create: `apps/web/src/app/payments/return/success/page.tsx`
- Create: `apps/web/src/app/payments/return/pending/page.tsx`
- Create: `apps/web/src/app/payments/return/failure/page.tsx`

**Interfaces:**
- Produces `createProposalCheckout(proposalId, requestNonce)` and `createScopeChangeCheckout(scopeChangeId, requestNonce)` returning checkout URL/session ID.

- [ ] **Step 1: RED tests** proving amount/currency come from accepted durable snapshot, seller must be connected, commission uses Task 1 helpers, nonce replay reuses local session, and return pages have zero calls capable of financial mutation.
- [ ] **Step 2: Commit RED** and observe failures.
- [ ] **Step 3: GREEN checkout orchestration** creating/reusing durable checkout row before provider preference, then persisting provider preference ID.
- [ ] **Step 4: GREEN return pages** display confirmation/pending/failure context only.
- [ ] **Step 5: Commit GREEN** and verify unit/build/E2E unaffected.

### Task 9: Signed webhook endpoint and authoritative reconciliation

**Files:**
- Create: `apps/web/src/app/api/payments/mercado-pago/webhook/route.ts`
- Extend: `apps/web/src/lib/payments/server.ts`
- Extend: `apps/web/src/lib/payments/server.test.ts`

**Interfaces:**
- Produces `processMercadoPagoWebhook(requestMetadata)` which verifies signature, persists receipt idempotently, refetches payment with correct seller context, validates snapshot, invokes `reconcile_provider_payment`, and records processing status.

- [ ] **Step 1: RED tests** for invalid signature no-mutation, duplicate delivery safety, seller-context lookup, authoritative provider fetch, wrong amount/currency/seller rejection, approved success, pending, rejected failure, and replay safety.
- [ ] **Step 2: Commit RED** and observe failures.
- [ ] **Step 3: GREEN webhook route/orchestration** with fast 2xx response only after durable receipt handling; provider payload alone is never authoritative.
- [ ] **Step 4: Commit GREEN** and verify unit + pgTAP + existing runtime.

### Task 10: Refunds, settlement snapshots, and reconciliation runs

**Files:**
- Create: `supabase/migrations/20260905xxxx30_phase_11_refunds_settlements.sql`
- Create: `supabase/tests/phase-11-refunds-ledger.sql`
- Extend: `apps/web/src/lib/payments/server.ts`
- Extend: `apps/web/src/lib/payments/server.test.ts`

**Interfaces:**
- Produces tables `payment_refunds`, `payment_settlements`, `payment_reconciliation_runs`.
- Produces server methods `requestPaymentRefund`, `reconcileRefund`, `runPaymentReconciliation`.

- [ ] **Step 1: RED pgTAP/unit tests** for total/partial refunds, cumulative refund cap, REQUESTED/PENDING not equal SUCCEEDED, provider failure, duplicate refund nonce, exactly-once refund ledger reversals, and settlement snapshot update.
- [ ] **Step 2: Commit RED**, confirm failures.
- [ ] **Step 3: GREEN schema/RPC/server implementation** preserving explicit provider-confirmed refund completion.
- [ ] **Step 4: Commit GREEN** and verify all suites.

### Task 11: Admin visibility and reconciliation UX

**Files:**
- Create: `apps/web/src/app/admin/payments/page.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`
- Extend: `apps/web/src/lib/payments/server.ts`
- Test: `apps/web/src/lib/payments/server.test.ts` and `tests/e2e/phase-11-payments.spec.ts`

**Interfaces:**
- Admin read model shows local/provider status, gross, marketplace fee, provider net/fee when known, refund state, provider references, mismatch flag, last reconciliation timestamp.

- [ ] **Step 1: RED unit/E2E tests** proving non-admin denial, admin safe fields, no credential/token leakage, mismatch visibility, and reconciliation action RBAC.
- [ ] **Step 2: Commit RED** and observe failures.
- [ ] **Step 3: GREEN admin page/read model** following existing admin RBAC patterns.
- [ ] **Step 4: Commit GREEN** and verify accessibility/build/E2E.

### Task 12: Phase 11 runtime gate, CI, and report

**Files:**
- Create: `apps/web/scripts/phase-11-payments-runtime.mjs`
- Create: `tests/e2e/phase-11-payments.spec.ts` (extend if created earlier)
- Modify: `.github/workflows/ci.yml`
- Create: `docs/reports/phase-11-payments.md`

**Interfaces:**
- Runtime gate proves fake provider remains green plus mocked/approved provider lifecycle: checkout, signed webhook, duplicate event, pending->success/failure, redirect spoof, additional charge, full/partial refund, ledger, reconciliation/admin visibility.

- [ ] **Step 1: RED runtime test** added to CI before implementation wiring, expecting failure until Phase 11 behavior exists.
- [ ] **Step 2: Commit RED** and observe the Phase 11 gate fail for the expected missing behavior.
- [ ] **Step 3: Complete any minimal wiring required to GREEN** without weakening assertions.
- [ ] **Step 4: Commit GREEN** and run fresh complete CI.
- [ ] **Step 5: Produce `docs/reports/phase-11-payments.md`** with exact final SHA, run IDs, pgTAP counts, unit/E2E/runtime counts, known external Mercado Pago test-account validation still pending, and explicit statement that Phase 12/live production credentials were not touched.
- [ ] **Step 6: Before claiming completion use `verification-before-completion`** and then `finishing-a-development-branch`.

---

## Self-Review

### Spec coverage
- Provider choice/adapter: Tasks 6-9.
- Payment creation: Task 8.
- Webhook validation/persistence/idempotency: Tasks 4, 6, 9.
- Payment status/monotonic reconciliation: Tasks 1, 5, 9.
- Commission/provider net: Tasks 1, 8, 10.
- Refund/partial refund: Task 10.
- Settlement/payout model: Task 10; no invented payout command for provider-managed Split 1:1.
- Additional scope payment: Tasks 5, 8, 9, 12.
- Receipts/references: Tasks 4, 8-11.
- Reconciliation/admin visibility: Tasks 10-11.
- Explicit ledger: Tasks 4-5, 10.
- Security: Tasks 2-9.
- Fake provider retained: Tasks 1, 5, 8, 12.
- Redirect spoof defense: Tasks 8-9, 12.
- No production secrets: Tasks 2, 12.

### Placeholder scan
No `TBD`, `TODO`, `implement later`, or undefined behavioral steps remain. Timestamp suffixes in migration filenames are intentionally represented as `xxxx` only in this planning document; implementation must choose unique monotonic `20260905HHMMSS` timestamps before creating files.

### Type consistency
The plan uses one provider-neutral orchestration boundary, one Mercado Pago adapter, integer `amountMinor`/`feeBps`, durable checkout IDs, and service-role reconciliation throughout. Redirect pages never own financial mutation authority.
