# Phase 10 — End-to-end beta hardening before real money

**Branch:** `codex/phase-10-beta-hardening`  
**Approved base:** `0dd9bdefe24c74935b48dc3ec4a965170842e8c0`  
**Phase boundary:** fake money only; Phase 11 / real payment provider excluded.

## 1. Objective

Phase 10 turns the already-green Phase 09 marketplace into a beta gate. It does not add a new marketplace subsystem: it proves the existing auth, RLS, Storage, discovery, conversations, proposals, fake payments, Jobs, scheduling/location, reviews/rehire, admin and trust/safety layers work together under success, failure and concurrency paths.

The implementation follows the approved strategy: hardening by layers with one complete final gate.

## 2. Required integrated journeys

### Journey A — remote fixed service

Implemented in `apps/web/scripts/phase-10-beta-runtime.mjs`:

provider signup/auth fixture → provider onboarding → identity document → admin verification → English skill/service publication → anonymous discovery → client conversation → scheduled direct booking → fake payment → confirmed Job → provider starts → completion requested → client completes → verified review → fresh rehire proposal.

### Journey B — in-person quote

Implemented in the same runtime:

verified electrician → in-person quote service → provider service radius → client radius discovery → inquiry → private image upload → provider quote → client `COUNTEROFFER` revision → provider acceptance → fake payment → exact location release → reschedule/acceptance → Job starts → scope increase → client acceptance → fake additional payment → completion → review.

### Journey C — failures

Runtime assertions cover every Master Plan failure case:

- unauthorized Job/conversation access;
- fake initial payment failure without Job creation;
- concurrent proposal acceptance with exactly one acceptance event;
- overlapping provider double-booking attempt rejected;
- cancelled Job;
- no-show Job;
- outsider denied access to private message attachment;
- invalid review rejected;
- suspended provider denied marketplace mutation;
- expired proposal remains expired and cannot be reopened.

## 3. Hardening delivered

### Security / data boundaries

- cross-phase pgTAP audit for RLS on high-risk tables;
- private identity/conversation Storage bucket and CRUD-policy checks;
- browser grant checks on roles/private evidence/admin audit data;
- privileged RPC anonymous-execution audit;
- SECURITY DEFINER `search_path` audit;
- idempotency, overlap exclusion and proposal immutability schema contracts;
- integrated outsider/suspension/runtime authorization failures.

See `docs/audits/phase-10-security-hardening.md`.

### Auth/session

- SSR remains publishable-key based;
- proxy refreshes with `auth.getClaims()` rather than authorizing from a client-readable session;
- role authority remains database-backed (`user_roles`), not `user_metadata`.

### Error handling / observability

- route and global error boundaries now emit bounded structured `ui_error` events;
- raw error messages/stacks are excluded from the client event;
- optional digest is displayed as a support reference;
- `/health` is explicitly uncached liveness with bounded revision/environment metadata;
- observability runbook added without coupling beta to a third-party APM SDK.

### Dependencies / CI reliability

- production dependency audit gates high/critical advisories;
- frozen lockfile remains mandatory;
- CI concurrency cancels stale runs per ref;
- browser server starts once and is readiness-checked through `/health`;
- Chromium installation is shared by Lighthouse and Playwright;
- integration timeout expanded for the added Phase 10 coverage.

### Performance / mobile / accessibility / SEO

The final gate runs mobile Lighthouse on home, search and seeded service detail for performance, accessibility, best practices and SEO. Regression floors are 60 / 85 / 85 / 90 respectively. Playwright adds semantic, keyboard, health-contract and horizontal-overflow checks in desktop Chromium and Pixel 5 projects.

### Preview, seed, recovery

- reproducible seed smoke validates the demo service through public discovery after `db reset`;
- `phase-10-preview-smoke.mjs` validates critical public preview routes and liveness;
- deployment-status workflow wires non-main Vercel preview smoke when the integration emits a successful deployment status;
- backup/recovery runbook explicitly separates database backups from Storage objects and defines a staging-first restore drill.

## 4. Final gate contract

The commit containing this report is only considered the **Final HEAD approved for Phase 10** when its complete CI run is green and the associated Vercel preview has been inspected/smoked when available.

The single final gate includes:

1. `pnpm install --frozen-lockfile` + production dependency audit;
2. lint;
3. typecheck;
4. unit tests;
5. production build;
6. format check + `git diff --check`;
7. full pgTAP suite including Phase 10;
8. existing Phase 03–09 runtimes;
9. Phase 10 Journeys A+B+C runtime;
10. seeded reset + public seed smoke;
11. production web build/start readiness;
12. three mobile Lighthouse audits across four categories;
13. complete Playwright suite in desktop Chromium + mobile-web;
14. concrete Vercel preview smoke/inspection when the Git integration exposes the deployment.

If any part fails, Phase 10 remains open and Phase 11 remains blocked. Failures are corrected in one grouped block and the complete gate is rerun against the corrected commit.

## 5. Phase boundary

No real-money integration, PSP SDK, webhook, settlement, refund or provider credential was introduced. Successful initial and additional payments in Phase 10 continue to be synthetic/fake-payment results.

**Implementation state in repository:** complete; final approval is determined by the final commit's CI/deployment evidence.
