# Phase 10 beta operations runbook

## Purpose

This runbook makes the beta environment reproducible and gives operators one deterministic smoke path before Phase 11.

## Local synthetic environment

1. Start the pinned local Supabase version used by CI.
2. Reset the local database with the committed seed (`supabase/seed.sql`).
3. Export local `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY` only into the local shell/CI environment.
4. Run `node apps/web/scripts/phase-10-seed-smoke.mjs`.
5. Build/start the web app and execute the browser suite.

The seed smoke must find `demo-proveedor / demo-revision-pc` through the public discovery RPC. This validates the seed through the same public read model the marketplace uses rather than by reading tables with service-role authority.

## Phase 10 integrated runtime

`node apps/web/scripts/phase-10-beta-runtime.mjs` creates isolated UUID-suffixed users/services and executes:

- Journey A: onboarding → admin identity approval → remote English service → discovery → scheduled direct booking → fake payment → Job lifecycle → review → rehire;
- Journey B: verified electrician → radius discovery → inquiry → image attachment → provider quote → client counteroffer → provider acceptance → fake payment → exact location → reschedule → start → scope increase → fake additional payment → completion → review;
- Journey C: unauthorized access, fake-payment failure, proposal race, double booking, cancellation, no-show, private attachment denial, invalid review, suspended-provider mutation denial and proposal expiry.

The local database is disposable in CI and is reset immediately afterwards with the synthetic seed. Uploaded synthetic blob fixtures are explicitly removed at runtime end.

## Vercel preview smoke

`apps/web/scripts/phase-10-preview-smoke.mjs` requires `PREVIEW_URL` and checks:

- `/health`;
- `/`;
- `/buscar`;
- `/p/demo-proveedor/demo-revision-pc`;
- `/manifest.webmanifest`.

`.github/workflows/preview-smoke.yml` wires the same smoke to successful non-main GitHub deployment-status events. The Phase 10 closing check should also inspect the concrete Vercel preview associated with the final commit, because deployment-status workflow availability depends on the GitHub/Vercel integration and the workflow existing on the repository default branch.

## Browser hardening gate

The final CI starts the production server once, waits for `/health`, and reuses that process for:

- mobile Lighthouse on home, search and seeded service detail;
- Chromium + Pixel 5 Playwright projects;
- semantic/mobile invariants from `phase-10-beta-hardening.spec.ts`.

Lighthouse minimums are intentionally conservative beta regression guards, not performance targets: performance 60, accessibility 85, best practices 85 and SEO 90. Future phases may raise them after measuring production traffic and Web Vitals.

## Escalation

If Phase 10 fails, do not start Phase 11. Group failures by boundary (database/security, runtime journey, browser/performance, preview/deployment), fix the smallest authoritative layer, and rerun the complete final gate on the corrected commit.
