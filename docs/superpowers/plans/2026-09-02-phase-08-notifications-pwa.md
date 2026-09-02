# Phase 08 Notifications and PWA Product Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure Changas users reliably see important marketplace events in-app and can opt into Web Push/email while the installable PWA remains conservative about private/stale state.

**Architecture:** PostgreSQL is the source of truth for notification records, preferences, push subscriptions and delivery outbox entries. Domain-event triggers enqueue safe notification metadata transactionally; server-only delivery adapters claim outbox rows and send Web Push/Resend only when configured. The service worker handles push, safe static/offline shell behavior and explicit updates without caching authenticated Jobs/payment responses.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Supabase PostgreSQL/Auth/RLS, pgTAP, Web Push/VAPID, Resend HTTP API, Service Worker APIs, Vitest, Playwright, Lighthouse.

**Spec:** `CHANGAS_MASTER_PLAN.md` — Phase 08 and sections 18/23.

## Global Constraints

- Work only on `codex/phase-08-notifications`, based on `114c3c8b610f3f7fc93c540ef89206ff1d996805`.
- Push permission is opt-in and must be requested from a user gesture, never on first page load.
- Denied/unsupported push must not degrade the rest of the app.
- Never put private chat/body text, exact address, payment details or sensitive evidence in lock-screen push copy.
- Do not send email for trivial chat messages.
- Critical transactional/security preferences cannot be silently disabled by promotional settings.
- Do not cache authenticated/private pages, Jobs, proposals, payment state, notification center responses or API responses in the service worker.
- Applied migrations are append-only.
- RLS defaults to deny unless explicitly allowed.
- `SUPABASE_SERVICE_ROLE_KEY`, VAPID private key, Resend key and dispatch secret are server-only.
- Phase 09 is out of scope. STOP after Phase 08 report and final green CI.

---

### Task 1: Notification authority, preferences and delivery outbox

**Files:**
- Create: `supabase/tests/phase-08-notifications.sql`
- Create: `supabase/migrations/20260902160000_phase_08_notifications.sql`
- Create: `apps/web/scripts/phase-08-notifications-runtime.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces `notifications`, `notification_preferences`, `push_subscriptions`, `notification_delivery_outbox`.
- Produces RPCs `list_my_notifications`, `get_my_notification_unread_count`, `mark_notification_read`, `mark_all_notifications_read`, `get_my_notification_preferences`, `update_my_notification_preferences`, `upsert_push_subscription`, `delete_push_subscription`.
- Produces private helper `enqueue_user_notification(...)` and delivery-claim/result RPCs for privileged server use.

- [ ] **Step 1: Write RED pgTAP authority tests**

Cover table existence, RLS, owner-only reads/mutations, immutable recipient/event identity, preference defaults, subscription ownership and no authenticated direct access to outbox.

```sql
select has_table('public', 'notifications');
select has_function('public', 'list_my_notifications', array['integer','timestamptz','uuid']);
select policies_are('public', 'notification_delivery_outbox', array[]::text[]);
```

- [ ] **Step 2: Run the RED through CI**

Expected: prior 352 pgTAP tests stay green and only Phase 08 contract assertions fail because objects are absent.

- [ ] **Step 3: Implement append-only migration**

Use notification kinds such as `MESSAGE`, `PROPOSAL`, `PAYMENT`, `JOB`, `REVIEW`, `VERIFICATION`, `SECURITY`; store safe `title`, `body`, `action_url`, opaque `entity_type/entity_id`, `created_at/read_at`. Preferences start with `in_app=true`, actionable push/email defaults conservative, promotional separate and false. Push endpoint is unique per user and stores endpoint + p256dh + auth, never VAPID private material.

- [ ] **Step 4: Add authenticated runtime**

Create two users and prove recipient isolation, unread transitions, preference ownership, push subscribe/unsubscribe and outbox invisibility from ordinary authenticated clients.

- [ ] **Step 5: Wire pgTAP/runtime into CI and get GREEN**

Commit only after clean reset + pgTAP + runtime pass.

---

### Task 2: Meaningful domain-event routing and safe copy

**Files:**
- Create: `supabase/tests/phase-08-notification-routing.sql`
- Create: `supabase/migrations/20260902161000_phase_08_notification_routing.sql`
- Extend: `apps/web/scripts/phase-08-notifications-runtime.mjs`

**Interfaces:**
- Consumes Phase 04 `messages`, Phase 05 proposal/payment events, Phase 06 job events, Phase 07 reviews and existing provider verification state.
- Produces deterministic notification routing with dedupe key `(recipient_id, source_event_type, source_event_id, kind)`.

- [ ] **Step 1: Write RED routing tests**

Require routing for: new message in-app, new/counter/accepted/rejected proposal, payment status, upcoming/reschedule/start/completion job events, review received and verification result. Require safe generic push/email payload flags.

- [ ] **Step 2: Implement transactional trigger/router functions**

Example safe message notification:

```sql
perform enqueue_user_notification(
  recipient_id,
  'MESSAGE',
  'Nuevo mensaje',
  'Tenés una conversación con actividad nueva.',
  '/messages/' || conversation_id,
  'message',
  new.id,
  false, -- email
  false  -- push: no per-message lock-screen spam in V1
);
```

Proposal/job/review/verification notifications may enqueue actionable push. Important transactional changes may enqueue email according to preferences.

- [ ] **Step 3: Prove anti-spam/privacy rules**

Runtime must verify message body text never appears in notification/outbox payload and no email delivery is enqueued for ordinary text messages.

- [ ] **Step 4: Get clean GREEN CI for routing**

---

### Task 3: Server-only delivery adapters — Web Push and Resend

**Files:**
- Modify: `apps/web/package.json`, `pnpm-lock.yaml` to add `web-push` plus types if required.
- Modify: `.env.example`
- Create: `apps/web/src/lib/notifications/types.ts`
- Create: `apps/web/src/lib/notifications/templates.ts`
- Create: `apps/web/src/lib/notifications/web-push-provider.ts`
- Create: `apps/web/src/lib/notifications/email-provider.ts`
- Create: `apps/web/src/lib/notifications/resend-email-provider.ts`
- Create: `apps/web/src/lib/notifications/dispatcher.ts`
- Create: `apps/web/src/app/api/notifications/dispatch/route.ts`
- Create tests under `apps/web/src/lib/notifications/*.test.ts`.

**Interfaces:**

```ts
export interface PushProvider {
  send(input: SafePushMessage): Promise<DeliveryResult>;
}

export interface EmailProvider {
  send(input: TransactionalEmail): Promise<DeliveryResult>;
}
```

- [ ] **Step 1: Write RED unit tests for channel policy/templates**

Require generic lock-screen copy, action URL allowlist (`/messages`, `/jobs`, `/account`, `/provider`) and no raw private text. Require message kind to return no email template.

- [ ] **Step 2: Implement provider abstractions**

`WebPushProvider` is enabled only with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. `ResendEmailProvider` uses `RESEND_API_KEY` + `RESEND_FROM_EMAIL` through server-side `fetch` to Resend; business/domain code never imports Resend-specific code.

- [ ] **Step 3: Implement claimed outbox dispatcher**

Claim a bounded batch using a privileged RPC with lock/lease semantics; record success, retryable failure, permanent invalid-subscription failure. Never expose provider exceptions directly to users.

- [ ] **Step 4: Add protected dispatch route**

`POST /api/notifications/dispatch` requires `Authorization: Bearer ${NOTIFICATION_DISPATCH_SECRET}`. Missing configuration returns a controlled unavailable response and never affects normal app routes.

- [ ] **Step 5: Unit test disabled/configured providers and idempotent delivery result recording**

---

### Task 4: Notification center, unread badge, preferences and push opt-in UX

**Files:**
- Create: `apps/web/src/lib/notifications/server.ts`
- Create: `apps/web/src/app/(account)/notifications/page.tsx`
- Create: `apps/web/src/app/(account)/notifications/actions.ts`
- Create: `apps/web/src/components/notifications/notification-center.tsx`
- Create: `apps/web/src/components/notifications/notification-badge.tsx`
- Create: `apps/web/src/components/notifications/notification-preferences.tsx`
- Create: `apps/web/src/components/pwa/push-opt-in.tsx`
- Modify account navigation/layout component used by authenticated pages.
- Modify: `apps/web/src/app/(account)/account/settings/page.tsx`

**Interfaces:**
- Notification center is server-rendered from owner-safe RPCs.
- Push opt-in client calls Notification API only after a button click, registers SW, subscribes with VAPID public key, then posts subscription through a Server Action/RPC.

- [ ] **Step 1: RED tests for server boundary and permission-state mapper**

Require `unsupported`, `default`, `granted`, `denied` states and no permission request on mount.

- [ ] **Step 2: Implement notification center and unread state**

Show chronological items, unread visual + text state, mark one/all read, action links, empty state; no raw provider/DB errors.

- [ ] **Step 3: Implement preferences**

Separate in-app, push, important email and promotional switches. Critical security/account notices remain in-app regardless of promotional preference.

- [ ] **Step 4: Implement explicit push opt-in**

Denied state explains that in-app notifications still work; unsupported iOS/browser state explains install/browser limitation without blocking account settings.

---

### Task 5: PWA install, offline/error shell and safe service-worker updates

**Files:**
- Modify: `apps/web/src/app/manifest.ts`
- Modify: `apps/web/public/sw.js`
- Modify: `apps/web/src/components/pwa/service-worker-register.tsx`
- Create: `apps/web/src/components/pwa/install-prompt.tsx`
- Create: `apps/web/src/app/offline/page.tsx`
- Create/update brand-ready app icon assets under `apps/web/public/` and manifest references.
- Add PWA unit/E2E coverage.

**Interfaces:**
- SW caches versioned static assets and `/offline` shell only.
- Navigation/API/authenticated requests remain network-first and are never served from stale private caches.
- Push handler consumes only already-safe payload fields and notification click focuses/navigates to same-origin allowlisted URL.

- [ ] **Step 1: RED tests against SW source/manifest contract**

Assert no cache-first handler for `/jobs`, `/messages`, `/api`, Supabase or HTML authenticated navigation; assert push and notificationclick handlers exist; manifest contains 192/512 install icons and standalone display.

- [ ] **Step 2: Implement safe SW cache strategy**

Use a versioned cache, delete old caches on activate, cache only immutable `/_next/static/*` and explicitly safe offline/icon assets. Network failures for document navigation may fall back to `/offline`; never fall back to a cached authenticated page.

- [ ] **Step 3: Implement update UX**

Registration detects waiting worker and presents a user-visible refresh/update action; do not silently keep stale app shell indefinitely.

- [ ] **Step 4: Implement install UX**

Handle `beforeinstallprompt` where available; on iOS show concise Add to Home Screen guidance only when appropriate; installed/standalone users see no install nag.

- [ ] **Step 5: Add brand-ready icon set and manifest verification**

Keep existing Changas visual identity; placeholders are acceptable only if clearly brand-ready per Master Plan.

---

### Task 6: Job reminders and delivery policy runtime

**Files:**
- Create: `supabase/migrations/20260902162000_phase_08_job_reminders.sql`
- Create: `supabase/tests/phase-08-reminders.sql`
- Create: `apps/web/scripts/phase-08-delivery-policy-runtime.mjs`
- Modify CI.

**Interfaces:**
- Produces an idempotent RPC that materializes due reminders for upcoming scheduled Jobs without background GPS or recurring bookings.
- Dispatcher may call reminder materialization before claiming outbox.

- [ ] **Step 1: RED tests for due-window/idempotency**

A reminder may be created once for an upcoming active Job and never for cancelled/completed/no-show jobs.

- [ ] **Step 2: Implement reminder materialization**

Use server time, fixed safe copy and deterministic dedupe key; no exact location in push/email body.

- [ ] **Step 3: Runtime policy matrix**

Prove trivial message => in-app only; proposal/job/review/verification => configured actionable channels; push denied/no subscription => no failure of domain mutation; provider disabled => controlled retry/no crash.

---

### Task 7: Browser E2E, mobile limitations, final report and STOP

**Files:**
- Create: `tests/e2e/phase-08-notifications-pwa.spec.ts`
- Modify: Playwright config only if a capability-specific project is justified.
- Create: `docs/reports/phase-08-notifications.md`

- [ ] **Step 1: Add E2E notification-center journey**

Authenticate, generate a meaningful server event, observe unread count, open center, mark read, update preferences; verify no horizontal overflow in Chromium desktop and Pixel 5/mobile-web.

- [ ] **Step 2: Add permission-denied/unsupported PWA behavior test**

Mock notification permission denied and ensure normal navigation/jobs/messages remain usable. Verify no automatic permission prompt during page load.

- [ ] **Step 3: Add SW/install contract checks where browser automation supports them**

Verify manifest, SW registration, offline route and safe update/install controls. Document Safari/iOS limitations that cannot be truthfully automated in Linux Chromium.

- [ ] **Step 4: Run final gates**

Require lint, typecheck, unit, production build, format/diff, clean Supabase reset, pgTAP, Phase 03–08 runtimes, Lighthouse and Playwright desktop + Pixel 5.

- [ ] **Step 5: Write formal report**

Record exact functional HEAD/CI, migrations/RLS, provider configuration requirements, PWA cache strategy, tests/counts, Lighthouse scores, known browser limitations and explicit acceptance-criteria matrix.

- [ ] **Step 6: Run CI on the report commit and STOP**

Only declare `PHASE 08 — PASS / APPROVED` from the exact final report/fix HEAD whose complete CI is green. Do not create or implement `codex/phase-09-admin-trust`.
