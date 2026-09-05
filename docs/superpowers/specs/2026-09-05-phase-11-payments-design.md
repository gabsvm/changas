# Phase 11 — Real Payments Design

**Status:** Approved architecture, implementation not started  
**Date:** 2026-09-05  
**Branch:** `codex/phase-11-payments`  
**Base SHA:** `b4fda81461144a3d9aea1ef6b771cd9ce01bcb84`  
**Provider decision:** Mercado Pago Split Payments 1:1 + Checkout Pro

## 1. Goal

Replace fake economic execution with a real payment provider **without changing marketplace behavior**.

Phase 11 must preserve the existing proposal/job semantics while making payment completion, refunds, commissions, additional-scope charges, settlement visibility, and reconciliation provider-backed and auditable.

## 2. Non-goals

Phase 11 does not:

- promote Changas to production;
- configure live production credentials;
- perform Phase 12 launch hardening;
- invent legal/tax conclusions not supported by counsel;
- replace Supabase, Vercel, auth, proposals, jobs, reputation, or notifications architecture;
- make a redirect URL authoritative for payment success;
- remove the fake provider used by tests.

## 3. Existing baseline to preserve

The codebase already contains deliberate payment boundaries:

- `packages/domain/src/payments.ts` defines `PaymentProvider`, `PaymentRecord`, statuses, idempotency keys, refunds, and `FakePaymentProvider`.
- `apps/web/src/lib/proposals/server.ts` uses the fake provider for deterministic test execution.
- `public.apply_payment_result(...)` is a `service_role`-only transactional boundary for proposal payment outcomes and Job creation.
- `public.apply_additional_payment_result(...)` is the equivalent provider-agnostic boundary for accepted scope changes.
- proposal/payment scheduling already locks mutable resources and preserves slot-hold behavior.
- ARS money is represented internally as integer minor units.

Phase 11 extends these boundaries rather than bypassing them.

## 4. Provider architecture

### 4.1 Domain abstraction

The existing synchronous-looking `PaymentProvider` contract is insufficient for a hosted asynchronous checkout because creating a Mercado Pago Checkout Pro preference is not the same event as creating an approved payment.

Phase 11 will evolve the abstraction without deleting fake-test behavior.

Recommended conceptual interface:

```ts
export interface MarketplacePaymentProvider {
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;
  fetchPayment(paymentId: string, sellerAccount: SellerPaymentAccount): Promise<ProviderPaymentSnapshot>;
  refund(input: RefundRequest): Promise<ProviderRefundSnapshot>;
  verifyWebhook(input: ProviderWebhookInput): Promise<VerifiedProviderEvent>;
}
```

`FakePaymentProvider` remains available for deterministic unit/integration tests. Mercado Pago is implemented by `MercadoPagoPaymentProvider` behind the same marketplace-facing orchestration layer.

The provider adapter is responsible for protocol details. Marketplace state transitions remain in the database/server boundaries.

### 4.2 Hosted checkout

Checkout Pro is the first implementation because it moves payment-entry UI to Mercado Pago and minimizes Changas's direct payment-data surface.

The provider adapter creates a preference using the seller OAuth token, exact economic snapshot, external reference, marketplace fee, return URLs, and notification configuration.

The returned `init_point` is a navigation target only. It does not represent payment success.

## 5. Seller Mercado Pago connection

Providers who need paid services must connect a Mercado Pago seller account.

Flow:

1. authenticated provider chooses **Conectar Mercado Pago**;
2. server creates random OAuth state bound to that session/provider;
3. provider is redirected to Mercado Pago authorization;
4. callback validates `state` before exchanging `code`;
5. server exchanges authorization code for seller credentials;
6. seller `user_id`/collector identity is persisted;
7. access and refresh tokens are encrypted before persistence;
8. provider connection becomes usable only after required fields validate.

OAuth secrets and seller tokens never enter client-rendered state.

### Token storage

Use application-level AES-256-GCM envelope encryption with a server-only versioned key, e.g. `PAYMENT_TOKEN_ENCRYPTION_KEY_V1`.

Persist ciphertext, IV, auth tag, key version, provider user ID, expiry, scopes, and connection status. Do not commit encryption keys.

Token refresh updates access and refresh token atomically because Mercado Pago rotates the refresh token during renewal.

## 6. Data model

All new tables use RLS, explicit grants, append-only migrations, precise integer monetary storage, and server-authoritative mutation paths.

### 6.1 `payment_provider_accounts`

Purpose: one provider user's connected payment account.

Key fields:

- `id uuid`
- `provider_user_id uuid`
- `provider_name text`
- `provider_account_reference text`
- `access_token_ciphertext text`
- `refresh_token_ciphertext text`
- `token_iv text`
- `token_auth_tag text`
- `encryption_key_version integer`
- `scope text`
- `token_expires_at timestamptz`
- `status` (`CONNECTED`, `REAUTH_REQUIRED`, `DISCONNECTED`, `SUSPENDED`)
- timestamps

Constraint: one active Mercado Pago connection per provider user.

User-facing reads expose connection state and non-sensitive provider reference only. Token columns are never readable through normal authenticated RLS.

### 6.2 `payment_checkout_sessions`

Purpose: durable bridge between a payable Changas economic snapshot and a hosted provider checkout.

Key fields:

- `id uuid`
- `request_nonce uuid`
- `purpose` (`PROPOSAL`, `SCOPE_CHANGE`)
- `proposal_id uuid null`
- `scope_change_id uuid null`
- `client_user_id uuid`
- `provider_user_id uuid`
- `payment_provider_account_id uuid`
- `provider_name text`
- `provider_checkout_reference text` (Mercado Pago preference ID)
- `external_reference text`
- `amount_minor bigint`
- `marketplace_fee_minor bigint`
- `provider_net_expected_minor bigint`
- `currency_code text`
- `status` (`CREATED`, `REDIRECT_READY`, `COMPLETED`, `EXPIRED`, `FAILED`)
- `checkout_url` stored only if policy permits; otherwise regenerate/use short-lived response
- timestamps

Uniqueness:

- `request_nonce`
- provider checkout reference where non-null
- one active economic checkout per nonce.

The checkout session is not financial truth. It is orchestration state.

### 6.3 `payment_provider_events`

Purpose: append-only audit of received provider notifications.

Key fields:

- `id uuid`
- `provider_name text`
- `provider_event_key text`
- `provider_resource_id text`
- `event_type text`
- `signature_valid boolean`
- `received_at timestamptz`
- `processed_at timestamptz null`
- `processing_status` (`RECEIVED`, `IGNORED`, `PROCESSED`, `FAILED`)
- `payload_sha256 text`
- sanitized provider status/reference fields
- failure code/message where appropriate

`UNIQUE(provider_name, provider_event_key)` makes exact duplicate delivery safe.

Raw sensitive payment data is not blindly persisted. The table stores event identity, status, hashes, and only the provider fields required for audit/reconciliation.

### 6.4 `payment_refunds`

Purpose: explicit refund state rather than overloading the payment attempt.

Key fields:

- `id uuid`
- linked initial/additional payment attempt
- `request_nonce uuid`
- `provider_refund_reference text null`
- `amount_minor bigint`
- `currency_code text`
- `status` (`REQUESTED`, `PENDING`, `SUCCEEDED`, `FAILED`)
- `reason_code text null`
- timestamps

A requested refund is never considered completed before provider confirmation.

### 6.5 `financial_ledger_entries`

Purpose: immutable operational financial truth.

This is an operational ledger, not a general-accounting double-entry ledger.

Entry types include at minimum:

- `GROSS_PAYMENT`
- `MARKETPLACE_FEE`
- `PROVIDER_NET`
- `PAYMENT_PROVIDER_FEE` when authoritatively known
- `ADDITIONAL_CHARGE`
- `REFUND`
- `MARKETPLACE_FEE_REVERSAL`
- `PROVIDER_NET_REVERSAL`
- `CHARGEBACK`
- `SETTLEMENT_STATUS`

Fields:

- `id uuid`
- source payment/refund/event references
- `entry_type`
- `party_type` (`CLIENT`, `PROVIDER`, `MARKETPLACE`, `PAYMENT_PROVIDER`)
- `amount_minor bigint`
- `currency_code text`
- provider reference
- deterministic idempotency key
- metadata jsonb restricted to non-sensitive reconciliation fields
- `created_at`

Entries are insert-only through server-authoritative functions. Unique source/idempotency constraints prevent duplicate ledger effects.

### 6.6 `payment_settlements`

Purpose: represent provider-managed settlement/release state without pretending Changas controls payouts that Mercado Pago owns.

Fields include:

- payment attempt
- seller expected net minor
- marketplace fee minor
- provider fee minor when known
- provider settlement/accreditation status
- provider available/settled timestamps when available
- last reconciled timestamp

Phase 11 does not manufacture a payout command if the selected Split 1:1 product does not expose one for this model.

### 6.7 `payment_reconciliation_runs`

Purpose: auditable admin reconciliation.

Track:

- run ID
- initiator/admin or system
- date range/provider scope
- counts checked/matched/mismatched/failed
- started/finished timestamps
- sanitized error summary.

## 7. Initial payment flow

### 7.1 Checkout creation

1. Client accepts a payable proposal.
2. Server authenticates client and reloads proposal/accepted version.
3. Server verifies proposal is payable and provider has an active payment account.
4. Server derives amount/currency from the accepted proposal snapshot; client-supplied amount is ignored.
5. Server derives marketplace fee from configured basis points using integer arithmetic.
6. Existing slot-hold rules run before external checkout creation when applicable.
7. Server creates/reuses a `payment_checkout_session` by request nonce.
8. Mercado Pago adapter creates Checkout Pro preference using seller OAuth token.
9. Preference ID is persisted on the checkout session.
10. Server returns the provider `init_point`.

If the same request nonce is replayed, Changas returns the same local checkout session and never creates a second economic attempt for that nonce.

## 8. Provider callback/redirect flow

Return pages may be:

- `/payments/return/success`
- `/payments/return/pending`
- `/payments/return/failure`

They display status context only.

They do **not** call `apply_payment_result` and cannot create a Job.

A forged query string such as `?status=approved&payment_id=...` cannot mark anything paid.

The UI polls/reloads Changas server state or waits for authoritative webhook/reconciliation processing.

## 9. Webhook and reconciliation flow

Endpoint:

`POST /api/payments/mercado-pago/webhook`

Processing:

1. read raw request metadata/body;
2. validate Mercado Pago signature according to current official algorithm;
3. derive stable provider event key;
4. persist event receipt idempotently;
5. reject/ignore invalid signatures without financial mutation;
6. for a valid payment event, fetch the payment directly from Mercado Pago using the correct seller OAuth context;
7. identify checkout by `external_reference` and provider identifiers;
8. validate seller/collector, amount, currency, and expected economic target;
9. normalize provider state to Changas payment status;
10. execute a server-only transactional reconciliation RPC;
11. create immutable ledger effects exactly once;
12. update settlement snapshot;
13. mark provider event processed.

Webhook body status alone is not trusted. Provider fetch/reconciliation is authoritative.

## 10. Payment state reconciliation

The existing `apply_payment_result()` correctly provides transactional proposal/job effects but treats an existing nonce as already finalized. Hosted asynchronous payment requires an explicit safe transition from `PENDING` to a terminal status.

Phase 11 will add a new append-only migration introducing a reconciliation boundary rather than editing historical migrations.

Conceptual RPC:

`reconcile_provider_payment(...)`

Responsibilities:

- `service_role` only;
- lock checkout/payment/proposal rows;
- derive the actor/client and target from durable checkout state, not webhook/user input;
- validate provider/payment identifiers;
- create payment attempt if first authoritative observation;
- allow monotonic transitions such as `PENDING -> SUCCEEDED` and `PENDING -> FAILED`;
- terminal replay with identical status is idempotent;
- contradictory terminal regressions are rejected/ignored and audited;
- only `SUCCEEDED` may transition proposal to `PAID` and create Job;
- `FAILED` preserves correct proposal/slot state;
- ledger and business transition occur in the same database transaction where feasible.

The fake provider path remains available for tests and can continue using its deterministic result boundary or be routed through the same reconciliation function where doing so improves coverage.

## 11. Additional-scope payment

Accepted scope changes use the same hosted checkout orchestration with `purpose = SCOPE_CHANGE`.

Authoritative success reconciles through the existing provider-agnostic additional payment boundary, extended only as needed for asynchronous `PENDING -> terminal` state.

No separate one-off payment architecture is introduced.

## 12. Refund flow

1. Authorized server/admin/client policy requests refund.
2. Server derives refundable amount from immutable financial records.
3. Create/reuse `payment_refunds` row by request nonce.
4. Mercado Pago refund API is called with provider idempotency key.
5. Local state becomes `PENDING`/`REQUESTED` until provider confirmation.
6. Provider fetch/webhook confirms terminal refund status.
7. On success, append refund/reversal ledger entries exactly once.
8. Marketplace/job-visible refund state updates from the refund record, not a mutable client field.

Total and partial refunds are supported where Mercado Pago accepts them.

Insufficient seller balance is represented as a provider failure/pending operational condition; Changas must not falsely report completion.

## 13. Commission calculation

Configuration:

`CHANGAS_MARKETPLACE_FEE_BPS`

Rules:

- integer basis points only;
- compute from `amount_minor` using integer arithmetic;
- deterministic rounding rule: half-up is not implicit; use integer floor unless business policy explicitly chooses another method;
- chosen rule is unit-tested and documented;
- calculated `marketplace_fee_minor` is persisted in the checkout economic snapshot;
- provider decimal conversion happens only at the adapter boundary;
- no floating-point value is stored as financial truth.

Recommended initial rule: integer floor of `(grossMinor * feeBps) / 10000`, with positive-fee validation when configured fee is non-zero.

The actual BPS value is environment/business configuration and is not hard-coded by Phase 11.

## 14. Provider net amount

Persist expected seller net as a transparent calculation, then reconcile against provider-reported values when available.

Mercado Pago documents that its own fee is deducted from seller funds before the marketplace fee. Therefore Changas must distinguish:

- gross transaction amount;
- Mercado Pago fee when authoritatively reported;
- marketplace fee;
- seller expected/provider-reported net.

Do not infer Mercado Pago's fee from a hard-coded rate.

## 15. Receipts and references

Persist and expose safe references:

- Changas checkout/session ID;
- proposal/job/scope-change ID;
- Mercado Pago preference ID;
- Mercado Pago payment ID;
- refund reference;
- external reference;
- status timestamps.

Do not expose seller OAuth tokens, webhook secrets, encryption material, or sensitive payment instrument data.

## 16. Admin visibility

Add an admin payment/reconciliation surface showing at minimum:

- local payment status;
- provider status;
- gross amount;
- marketplace fee;
- provider net/fee when known;
- refund state;
- reconciliation state;
- provider references;
- mismatch/error indicators.

Admin actions remain server-authoritative and RBAC-protected.

## 17. Security design

Mandatory controls:

- webhook HMAC/signature validation;
- server-side authoritative payment fetch after webhook;
- OAuth `state` anti-CSRF validation;
- seller token encryption at rest;
- secrets only in server environment;
- no production secrets in repository;
- exact amount/currency/seller/external-reference verification;
- no financial mutation from redirect pages;
- idempotency keys for provider mutations where supported/required;
- duplicate webhook/event safety;
- monotonic payment/refund states;
- RLS on all exposed tables;
- `service_role` only for financial transition RPCs;
- sanitized provider event persistence;
- no raw card/payment-instrument storage.

## 18. Error handling

Classify provider failures into stable application categories:

- `AUTH_REQUIRED`
- `PROVIDER_UNAVAILABLE`
- `RATE_LIMITED`
- `INVALID_PROVIDER_STATE`
- `PAYMENT_REJECTED`
- `REFUND_REJECTED`
- `RECONCILIATION_MISMATCH`
- `INTERNAL_ERROR`

Retries are allowed only for operations proven idempotent.

Provider 429/5xx handling uses bounded exponential backoff with jitter in background/admin reconciliation paths. User-request paths fail clearly rather than hanging indefinitely.

## 19. Observability

Structured events at minimum:

- checkout session created/reused;
- OAuth connection/refresh/re-auth required;
- webhook received/signature valid/invalid;
- provider payment fetched;
- payment state transition;
- duplicate event ignored;
- ledger entries committed;
- refund requested/completed/failed;
- reconciliation mismatch;
- settlement snapshot change.

Never log credentials, OAuth tokens, webhook secrets, full authorization headers, or sensitive payment instrument data.

## 20. Environment contract

Expected server-only configuration:

- `MERCADO_PAGO_CLIENT_ID`
- `MERCADO_PAGO_CLIENT_SECRET`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `PAYMENT_TOKEN_ENCRYPTION_KEY_V1`
- `PAYMENT_TOKEN_ENCRYPTION_KEY_VERSION`
- `CHANGAS_MARKETPLACE_FEE_BPS`
- provider mode/test-vs-live configuration as required by the selected SDK/API

Existing Supabase environment remains unchanged.

`.env.example` documents names only; no secrets are committed.

Production/live credentials are Phase 12 territory. Phase 11 should operate with test/approved non-production credentials.

## 21. Testing strategy

### Domain/unit

- exact BPS commission calculation and rounding;
- ARS minor-unit conversion at provider boundary;
- OAuth state validation helpers;
- token encryption/decryption and wrong-key failure;
- provider status normalization;
- webhook signature fixed vectors;
- redirect cannot produce authoritative success;
- refund amount validation;
- terminal state monotonicity.

### Provider adapter tests

Mock Mercado Pago HTTP/SDK responses for:

- checkout preference creation;
- idempotent/replayed creation;
- payment fetch approved/pending/rejected;
- malformed provider payload;
- OAuth exchange/refresh;
- refund total/partial;
- provider errors/rate limits.

### pgTAP/database

- RLS/grants for every new table/function;
- authenticated users cannot read token ciphertext fields through exposed APIs;
- financial RPCs reject non-`service_role`;
- duplicate event/nonce is safe;
- `PENDING -> SUCCEEDED` works exactly once;
- `PENDING -> FAILED` works exactly once;
- terminal regression rejected;
- concurrent duplicate webhook reconciliation creates one Job and one ledger effect set;
- amount/currency/provider mismatch rejected;
- refund ledger idempotency;
- additional-scope payment reconciliation;
- append-only/immutable ledger policy.

### Runtime/integration

- fake provider Journey A/B/C remains green;
- real-provider adapter test harness in approved test environment;
- seller OAuth connect/reconnect;
- Checkout Pro preference creation;
- signed webhook processing;
- duplicate webhook;
- payment redirect spoof;
- failure leaves correct proposal/job state;
- full refund;
- partial refund;
- additional-scope payment;
- reconciliation/admin visibility.

### E2E

Browser E2E should not require live money. Use fake/test provider controls plus mocked/approved provider test flows. Preserve existing Playwright suite and add Phase 11 payment UX coverage.

## 22. Acceptance criteria mapping

Master Plan criterion → proof required:

- **fake provider still available in test** → existing fake journeys + new provider abstraction tests remain green;
- **real provider works in approved environment** → Mercado Pago test-account checkout + signed webhook + authoritative reconciliation evidence;
- **duplicate webhooks are safe** → pgTAP/runtime duplicate-delivery tests and unique event constraints;
- **payment redirect spoof cannot mark paid** → route/unit/E2E proof that return page has zero financial mutation authority;
- **commission transparent** → persisted gross/fee/net snapshot + admin/user-safe display;
- **refund produces correct state/accounting** → total/partial refund runtime + ledger assertions;
- **payment failure leaves job in correct state** → failure integration test with no unauthorized Job creation and slot behavior verified;
- **no production secrets committed** → env contract, secret scan/diff review, CI checks.

## 23. External validation gate

Before declaring Phase 11 complete in an approved environment, validate the documented Mercado Pago Split 1:1 constraints using test accounts and current account capabilities, especially:

- seller KYC/OAuth eligibility;
- actual buyer funding methods available in Split 1:1;
- marketplace fee behavior;
- refund behavior with seller balance constraints;
- webhook signature/configuration;
- settlement/accreditation fields available for reconciliation.

If real account capabilities contradict the current documentation, adapt only the provider adapter/model boundary; do not change marketplace business semantics to match an undocumented provider quirk.

## 24. Expected implementation areas

Likely files/directories:

- `docs/decisions/payment-provider.md`
- `packages/domain/src/payments.ts`
- `packages/domain/src/*payment*.test.ts`
- `packages/config/src/server.ts`
- `.env.example`
- `apps/web/src/lib/payments/*`
- `apps/web/src/app/api/payments/mercado-pago/*`
- provider/account UI under provider management
- return pages under `apps/web/src/app/payments/return/*`
- admin payment/reconciliation surface
- append-only Supabase Phase 11 migrations
- `supabase/tests/phase-11-*.sql`
- `apps/web/scripts/phase-11-*.mjs`
- `tests/e2e/phase-11-payments.spec.ts`
- `docs/reports/phase-11-payments.md`

Exact filenames may be refined during implementation, but responsibilities and trust boundaries in this spec are fixed unless the spec is amended explicitly.

## 25. Phase boundary

Phase 11 stops after real-provider payment functionality is implemented and audited against its acceptance criteria.

**Do not start Phase 12 from this branch.**