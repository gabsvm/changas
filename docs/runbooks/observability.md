# Observability baseline

## Signals

Phase 10 establishes a small, privacy-aware baseline instead of adding a vendor-specific APM dependency.

### Application

- Vercel deployment/build/function logs for server failures and deployment regressions.
- `/health` for liveness only; it must return `Cache-Control: no-store` and the bounded health schema.
- browser error boundaries emit JSON `ui_error` events containing scope, timestamp, error name and optional Next.js digest.
- error messages, stack traces, form bodies, exact addresses, document paths and message text are excluded from the client structured event.

### Database / Supabase

During incidents inspect Auth, Postgres, API and Storage logs for the affected time range. Correlate using user/job/proposal IDs only when operationally necessary and avoid copying private payloads into shared incident channels.

### CI / deployment

The final Phase 10 gate records:

- dependency audit;
- lint/typecheck/unit/build/format/diff;
- pgTAP security contract;
- cross-phase runtime checks + Phase 10 A/B/C journeys;
- reproducible seed smoke;
- Lighthouse category budgets;
- full Chromium + mobile-web Playwright suite;
- Vercel preview smoke for the final commit when the preview is available.

## Initial alert conditions

These are operational triggers, not automated paging guarantees yet:

- `/health` non-2xx or malformed payload;
- repeated auth/session refresh failures;
- repeated payment idempotency/constraint failures outside synthetic testing;
- unexpected spikes in `42501`/authorization errors on a single route or RPC;
- database/storage unavailability;
- preview or production deployment rollback/failure;
- repeated uncaught UI errors sharing a digest.

## Incident correlation

Prefer stable technical identifiers (deployment revision, Next.js digest, proposal/job ID, audit-event ID) over free-form user data. Never log service-role keys, JWTs, passwords, exact address values, identity document paths or raw conversation text.

## Next step after beta

A vendor APM/error collector may be added only with an explicit data-retention/PII review. Phase 10 intentionally leaves the app functional without a third-party observability SDK.
