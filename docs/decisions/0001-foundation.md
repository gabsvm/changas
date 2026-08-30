# Decision 0001: lightweight web-first foundation

## Status

Accepted for Phase 00.

## Decision

Changas uses a lightweight pnpm workspace with one Next.js App Router application and three small shared packages: domain primitives, validation contracts, and environment/config helpers. It does not add Turborepo or a shared UI package at this stage.

## Why

The master plan requires a mobile-first PWA on Vercel now and portable domain rules for a future Expo app. A small workspace provides those boundaries without introducing orchestration or UI coupling before the product flows exist.

## Consequences

- Next.js owns web routing, rendering, metadata, and the initial PWA shell.
- Supabase client context is explicit: browser, cookie-aware server, and privileged server-only.
- Package versions and the pnpm lockfile are committed for reproducible installs.
- Later phases may add domain modules and product migrations without moving the web shell into a generic monolith.
- Phase 00 intentionally has no product persistence, because empty schemas are safer to audit than speculative tables.
