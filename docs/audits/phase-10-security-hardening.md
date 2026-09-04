# Phase 10 — Security and concurrency hardening audit

**Base:** `0dd9bdefe24c74935b48dc3ec4a965170842e8c0`  
**Branch:** `codex/phase-10-beta-hardening`  
**Scope:** beta hardening only. No Phase 11 and no real payment provider.

## RLS and authorization

Phase 10 keeps authorization database-authoritative. The critical marketplace state remains behind RLS and/or authenticated RPC boundaries: account/private profile data, provider identity evidence, conversations/messages/attachments, proposals and proposal versions, payment attempts, Jobs, reviews/reports, trust & safety state and admin audit data.

`supabase/tests/phase-10-beta-hardening.sql` adds a cross-phase contract that fails if the high-risk tables lose RLS, private evidence gains anonymous table access, `user_roles` becomes browser-updatable, or sensitive admin/payment RPCs become anonymous entrypoints.

Authorization does not use user-editable `user_metadata`. The auth trigger may consume `display_name` as profile content, while authority is stored in `user_roles` and enforced by database guards/RPCs.

## Auth and sessions

The Next.js Supabase server client uses the publishable key and cookie-backed SSR client. The request proxy refreshes trusted claims with `auth.getClaims()` and explicitly does not use a client-readable session object as authorization. Service-role credentials remain server/CI/runtime-only and are not exposed through `NEXT_PUBLIC_*` variables.

## Storage

Both sensitive buckets are private:

- `identity-documents`: owner-scoped CRUD by UUID folder;
- `conversation-attachments`: conversation-participant CRUD by conversation UUID path.

Phase 10 checks bucket privacy and all four CRUD policies for each bucket. Journey B uploads a real synthetic attachment through the participant path. Journey C confirms an outsider cannot download it.

Database backup and Storage-object backup are treated separately because Supabase database backups contain Storage metadata but not the object payloads themselves.

## Privileged functions

The audit checks that the Phase 10 privileged SECURITY DEFINER entrypoints pin `search_path` and remain unavailable to `anon`. Existing functions continue to perform caller/participant/admin checks inside the database rather than relying on UI state.

## Idempotency and concurrency

The final gate verifies:

- payment idempotency through `(proposal_id, request_nonce)` uniqueness;
- additional-payment idempotency through `(scope_change_id, request_nonce)` uniqueness;
- concurrent proposal acceptance produces one acceptance event;
- overlapping provider bookings are rejected by a database exclusion constraint;
- proposal versions remain immutable after creation/acceptance;
- one verified review per Job.

Journey C executes the proposal race and double-booking attempt at runtime, rather than treating the schema constraints as sufficient evidence.

## Dependency and supply-chain boundary

The repository already pins the package manager and commits the lockfile. Phase 10 adds `pnpm audit --prod --audit-level high` to the final validation job so high/critical production dependency advisories fail the gate. Dependency installation remains `--frozen-lockfile`.

## Error and observability safety

Client error boundaries now emit a small structured event containing only event type, scope, timestamp, error class and optional Next.js digest. `error.message` and stack are intentionally excluded because they may contain user-controlled or personally identifiable data. The user-facing digest can be used as a support correlation reference.

The `/health` endpoint is explicitly a liveness endpoint. It is uncached and exposes only bounded deployment metadata: service, status, mode, timestamp, a truncated revision, and a normalized Vercel environment. It is not a database-readiness endpoint and does not leak credentials or internal configuration.

## Phase boundary

No Mercado Pago/Stripe/real PSP SDK, webhook, provider credential, settlement logic or refund integration is introduced here. Both initial and additional payment journeys continue to use the existing fake-payment boundary. Real money remains blocked until Phase 10's final gate is green.
