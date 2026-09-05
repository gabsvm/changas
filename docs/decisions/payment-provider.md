# Payment provider decision — Phase 11

**Status:** Approved design decision  
**Date:** 2026-09-05  
**Branch:** `codex/phase-11-payments`  
**Baseline:** `b4fda81461144a3d9aea1ef6b771cd9ce01bcb84`

## Context

Phase 11 must replace fake economic execution with a real payment provider without changing marketplace behavior. The provider must fit an Argentina-first services marketplace and support the existing provider-agnostic proposal/job payment boundaries.

The Master Plan requires evaluation of marketplace support, platform commission, onboarding, split payments, delayed settlement, refunds, partial refunds, chargebacks, payouts, webhooks, fees, currency, tax/legal implications, and operational burden.

## Decision

Use **Mercado Pago Split Payments 1:1 with Checkout Pro** as the first real payment integration for Changas.

Keep `FakePaymentProvider` for tests and preserve the provider abstraction so another provider can be added later without rewriting marketplace state transitions.

## Options evaluated

| Criterion | Mercado Pago Split 1:1 + Checkout Pro | dLocal for Platforms | Stripe |
| --- | --- | --- | --- |
| Argentina-first fit | Strong; Split 1:1 is documented as available in Argentina | Strong regional coverage, but positioned for multi-market/global platforms | Weak for an Argentina-incorporated launch; Argentina is not listed as a directly supported Stripe country for payments |
| Marketplace support | Native 1:1 marketplace split | Native platform/marketplace product | Mature marketplace tooling where Stripe is supported |
| Platform commission | `marketplace_fee` on Checkout Pro preferences | Supported as platform fee/split rules | Supported in Connect where available |
| Seller onboarding | Mercado Pago seller account + OAuth; KYC requirement documented | Platform onboarding/KYC capabilities | Connect onboarding where available |
| Split payments | Native 1:1 split | Native split among platform participants | Native Connect split patterns where available |
| Hosted checkout | Checkout Pro | Provider-dependent integration | Checkout where available |
| Delayed settlement | Standard flow is provider-managed; custom marketplace fee release date requires assisted commercial configuration | Settlement is a first-class platform capability | Connect settlement controls where available |
| Refunds | Total and partial refunds supported; Split 1:1 has seller-balance caveats | Refund management supported | Supported where available |
| Chargebacks | Documented notifications and dispute processing | Chargeback management supported | Supported where available |
| Payouts | Funds are split into Mercado Pago accounts; payout/withdrawal is provider/account managed | Payouts are a first-class platform feature | Connect payouts where available |
| Webhooks | Signed Webhooks with `x-signature`; payment creation/update events documented | Webhooks/API platform model | Mature webhook model where available |
| Fees | Public docs describe fee ordering but exact commercial rates depend on account/product | Commercial pricing | Public/commercial pricing, but country availability blocks selection |
| Currency | ARS-compatible Argentina integration | Local-currency support | Country availability issue |
| Operational burden | Lowest for Argentina-first MVP; familiar local seller ecosystem, hosted checkout | Higher commercial/integration overhead; stronger if Changas becomes regional | Not viable as primary Argentina provider today |

## Why Mercado Pago

1. It is documented for **Split Payments 1:1 in Argentina**.
2. Checkout Pro keeps card-entry UI and sensitive payment capture outside Changas.
3. The split is executed by the PSP rather than by Changas holding and manually redistributing seller funds.
4. Sellers authorize Changas through OAuth, matching the marketplace model.
5. `marketplace_fee` allows Changas to express its commission at checkout creation.
6. Signed Webhooks provide a server-authoritative completion path.
7. Total and partial refund APIs exist.
8. The existing Changas payment boundaries were intentionally designed to be provider-agnostic, so the integration can be introduced without changing core marketplace semantics.

## Important provider constraints

### Seller requirements

Mercado Pago documents that Split Payments 1:1 requires seller authorization through OAuth and a sufficiently verified seller account. Changas must therefore treat payment-account connection as a provider capability gate, not as an optional cosmetic setting.

### Split 1:1 payment-method limitation

Current Mercado Pago Split 1:1 documentation states that this solution only allows payments with money in Mercado Pago accounts between Mercado Pago accounts and does not allow transfers from external financial institutions. This is a material launch constraint and must be validated with Mercado Pago test accounts and, before production, with Mercado Pago commercial/support guidance.

Changas must not encode assumptions about a specific funding instrument into marketplace state. The adapter reports provider capability; the marketplace only consumes authoritative payment state.

### Refund limitation

Mercado Pago documents that Split 1:1 refunds are apportioned between seller and marketplace and that a full refund can fail when the seller lacks sufficient balance. Therefore `REFUND_REQUESTED` must not be treated as `REFUNDED`; completion is authoritative only after provider confirmation.

### Settlement/release timing

Mercado Pago documents that custom configuration of marketplace/application fee release dates can require an assisted commercial executive. Phase 11 will model settlement explicitly but will not invent delayed-settlement capabilities that the approved account does not actually have.

## Fee model in Changas

Changas will store the commercial fee rule as basis points (`CHANGAS_MARKETPLACE_FEE_BPS`) and calculate the exact fee in integer minor units before provider serialization.

Example only:

- `1000` = 10.00%
- The actual commercial rate remains a business configuration, not a hard-coded product assumption.

Mercado Pago's API receives its required decimal representation only at the provider boundary. Changas financial truth remains integer ARS minor units.

## Tax and legal position

Provider documentation is not sufficient to decide Changas's Argentine tax, invoicing, withholding, consumer-law, or marketplace contractual obligations. Phase 11 therefore records the economic split and provider references but does **not** claim that Mercado Pago removes Changas's legal/accounting obligations.

Before production, Phase 12 must obtain business/legal/accounting confirmation for at least:

- invoicing of the Changas marketplace commission;
- tax treatment and applicable withholdings;
- seller terms for refunds/chargebacks;
- consumer cancellation/refund wording;
- responsibility when a seller cannot fund a refund;
- any required marketplace/PSP disclosures.

These items do not block building the Phase 11 test integration, but they do block calling the product production-ready.

## Why not dLocal first

dLocal for Platforms is technically stronger for a multi-country marketplace: it advertises onboarding, payins, payouts, split funds, settlements, refunds, chargeback handling, and reconciliation. It remains the preferred second-provider candidate if Changas expands beyond Argentina or needs platform-controlled payout/settlement behavior that Mercado Pago 1:1 cannot provide.

It is not selected for the first launch because it introduces more commercial and operational complexity than the Argentina-first requirement currently justifies.

## Why not Stripe first

Stripe's current global availability page does not list Argentina as a directly supported country for a local business to accept payments. Building the primary Phase 11 path around an unsupported home-country setup would add legal/entity complexity unrelated to marketplace validation.

## Implementation implications

- Hosted checkout: Mercado Pago Checkout Pro.
- Marketplace split: Mercado Pago Split Payments 1:1.
- Seller authorization: OAuth Authorization Code flow with refresh tokens.
- Provider credentials/tokens: server-only and encrypted at rest.
- Payment authority: signed webhook + server-side provider fetch/reconciliation.
- Redirect pages: display-only, never authoritative.
- Initial and additional-scope charges: same payment orchestration model.
- Refunds: explicit state machine with provider-confirmed terminal state.
- Ledger: append-only operational financial records in integer minor units.
- Reconciliation: admin-visible provider/local comparison tools.
- Fake provider: retained for deterministic tests.

## Official sources consulted

Mercado Pago:

- https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/overview
- https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/prerequisites
- https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/create-configuration
- https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- https://www.mercadopago.com.ar/developers/es/docs/split-payments/additional-content/security/oauth/creation
- https://www.mercadopago.com.ar/developers/es/docs/split-payments/additional-content/security/oauth/renewal
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications
- https://www.mercadopago.com.ar/developers/es/docs/sales-processing/cancellations-and-refunds
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/chargebacks

dLocal:

- https://www.dlocal.com/es/nuestras-soluciones/dlocal-for-platforms/
- https://docs.dlocal.com/docs/platforms-overview

Stripe:

- https://stripe.com/global

## Decision boundary

This decision approves the Phase 11 integration architecture. It does not authorize a production launch, live credentials, or Phase 12 work.