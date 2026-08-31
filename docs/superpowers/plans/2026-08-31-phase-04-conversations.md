# Phase 04 Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure contextual conversations between a client and a provider around a public service, with private attachments, realtime delivery, inbox/unread state, abuse controls and mobile-first chat UX.

**Architecture:** Phase 04 introduces a dedicated conversation/message domain in PostgreSQL with participant-only RLS and server-authoritative RPCs for state-changing operations. Conversations begin from a public service and retain that service context; messages are paginated from the server while Supabase Realtime only accelerates delivery and never becomes the source of truth. Attachments live in a private Storage bucket and are referenced by message attachment rows; signed/authorized reads are generated only after participant authorization.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase PostgreSQL/Auth/Storage/Realtime, RLS, Zod, Vitest, pgTAP, Playwright.

**Spec:** `CHANGAS_MASTER_PLAN.md` Phase 04.

## Global Constraints

- Work only on `codex/phase-04-conversations`; never on `main`.
- Start from the approved Phase 03 HEAD and preserve all Phase 00–03 behavior.
- Do not implement proposals, jobs, payments, reviews, notifications or admin workflows from Phase 05+.
- A conversation is contextual to client + provider + service; do not add unrestricted generic direct messages.
- Only conversation participants may read conversation rows, messages, reports or attachments.
- System messages/events are immutable and are never user-editable text.
- No end-to-end encryption claim in V1 because dispute/moderation evidence remains a platform requirement.
- Private attachment URLs must not be persisted as public URLs; use private Storage paths and authorized downloads.
- Do not expose provider/client email, phone, exact address or other private profile fields through chat APIs.
- Realtime is an enhancement only: reconnect must converge from paginated database truth and must not duplicate messages.
- Pre-job obvious attempts to move contact/payment off-platform should produce a warning/log event, not silently mutate economic state.
- Blocking must stop new informal interaction while preserving existing conversation history for audit/contractual evidence.
- Keep the UI mobile-first and avoid a heavy chat dependency when native React/Supabase primitives are sufficient.

---

### Task 1: Conversation domain, schema and participant-only RLS

**Files:**

- Create: `supabase/migrations/20260831_phase_04_conversations.sql`
- Create: `supabase/tests/phase-04-conversations.sql`
- Create: `packages/domain/src/conversations.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `apps/web/src/lib/supabase/database.types.ts`

**Interfaces:**

- Produces enums/types `ConversationStatus`, `MessageKind`, `ConversationParticipantRole`.
- Produces tables `conversations`, `conversation_participants`, `messages`, `message_attachments`, `conversation_reads`, `user_blocks`, `conversation_reports`, `conversation_moderation_events`.
- `conversations.service_id` is immutable once created.
- Participant table contains exactly the client and provider for V1.

- [ ] **Step 1: Write pgTAP tests that fail before the schema exists**

Cover at minimum:

```sql
select ok(to_regclass('public.conversations') is not null, 'conversations table exists');
select ok(to_regclass('public.messages') is not null, 'messages table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.messages'::regclass), 'messages keep RLS enabled');
```

Add synthetic users A, B and C and assert C cannot select A/B conversation rows or messages after `set local role authenticated` plus `request.jwt.claim.sub`.

- [ ] **Step 2: Run the DB suite and prove red**

Run: `pnpm dlx supabase@2.116.0 db reset --local --no-seed && pnpm dlx supabase@2.116.0 test db --local`

Expected: Phase 04 assertions fail because the schema/functions do not exist.

- [ ] **Step 3: Implement the schema**

Use UUID primary keys, UTC timestamps and explicit foreign keys. Required shape:

```sql
create type public.conversation_status as enum ('OPEN', 'BLOCKED', 'CLOSED');
create type public.message_kind as enum ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');
create type public.conversation_participant_role as enum ('CLIENT', 'PROVIDER');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id),
  client_user_id uuid not null references auth.users(id),
  provider_user_id uuid not null references auth.users(id),
  status public.conversation_status not null default 'OPEN',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_message_at timestamptz,
  unique (service_id, client_user_id, provider_user_id),
  check (client_user_id <> provider_user_id)
);
```

`messages` must include `conversation_id`, `sender_user_id nullable`, `kind`, `body nullable`, `client_nonce uuid`, `created_at`; enforce TEXT body non-empty and SYSTEM sender null. Add a unique `(conversation_id, client_nonce)` to make retries idempotent.

`message_attachments` must hold `storage_path`, `mime_type`, `size_bytes`, `original_name`, and no public URL.

- [ ] **Step 4: Add deny-by-default grants and participant RLS**

Authenticated users may `SELECT` rows only where they participate. Direct INSERT/UPDATE/DELETE for economic/moderation-sensitive rows stays revoked; writes use bounded RPCs in later tasks. `service_role` keeps explicit administrative grants.

- [ ] **Step 5: Add indexes**

At minimum:

```sql
create index conversations_client_updated_idx on public.conversations (client_user_id, updated_at desc);
create index conversations_provider_updated_idx on public.conversations (provider_user_id, updated_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc, id desc);
```

- [ ] **Step 6: Implement TS domain types**

```ts
export const conversationStatuses = ["OPEN", "BLOCKED", "CLOSED"] as const;
export type ConversationStatus = (typeof conversationStatuses)[number];
export const messageKinds = ["TEXT", "IMAGE", "FILE", "SYSTEM"] as const;
export type MessageKind = (typeof messageKinds)[number];
```

- [ ] **Step 7: Re-run DB + type tests and commit**

Expected: new pgTAP schema/RLS assertions pass.

Commit: `feat(conversations): add participant-only conversation schema`

---

### Task 2: Contextual conversation start and inbox read model

**Files:**

- Create: `supabase/migrations/20260831_phase_04_conversation_rpcs.sql`
- Extend: `supabase/tests/phase-04-conversations.sql`
- Create: `apps/web/src/lib/conversations/server.ts`
- Modify: `apps/web/src/lib/supabase/database.types.ts`

**Interfaces:**

- Produces RPC `public.start_service_conversation(provider_slug text, service_slug text) returns uuid`.
- Produces RPC `public.list_my_conversations(limit_count integer, before_updated_at timestamptz, before_id uuid)`.
- Produces RPC `public.get_conversation_context(target_conversation_id uuid)`.
- Repeated start for the same client/provider/service returns the existing conversation id.

- [ ] **Step 1: Add failing pgTAP for start authorization/idempotency**

Assert:

- anonymous cannot start;
- client cannot start conversation with self;
- provider must be ACTIVE and service public/unpaused;
- provider/service slug mismatch fails;
- repeated call returns same id;
- third user cannot call context RPC for that id.

- [ ] **Step 2: Implement `start_service_conversation` as SECURITY DEFINER**

Resolve the public service/provider from server-authoritative tables, use `auth.uid()` as client, reject self-chat, and `insert ... on conflict (...) do update set updated_at = conversations.updated_at returning id` so retries remain idempotent without manufacturing activity.

- [ ] **Step 3: Implement bounded inbox/context RPCs**

Inbox returns only participant-safe fields: conversation id, service title/slug, provider/client display names and public avatar, last message preview/kind/time, unread count, status. It must never expose private contact/profile fields.

- [ ] **Step 4: Wrap RPCs in server helpers**

```ts
export async function startConversationFromService(
  providerSlug: string,
  serviceSlug: string,
): Promise<string>;
export async function listMyConversations(
  cursor?: ConversationCursor,
): Promise<ConversationSummary[]>;
export async function getConversationContext(
  id: string,
): Promise<ConversationContext | null>;
```

Map raw DB errors to `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | TRANSIENT`, never display raw PostgreSQL text.

- [ ] **Step 5: Run tests and commit**

Commit: `feat(conversations): add contextual start and inbox contracts`

---

### Task 3: Text messages, pagination, idempotency and abuse bounds

**Files:**

- Modify: `supabase/migrations/20260831_phase_04_conversation_rpcs.sql` or add a new incremental Phase 04 migration if already committed.
- Extend: `supabase/tests/phase-04-conversations.sql`
- Modify: `packages/validation/src/index.ts`
- Create: `apps/web/src/app/(account)/messages/actions.ts`
- Create: `apps/web/src/lib/conversations/messages.ts`

**Interfaces:**

- Produces `messageTextSchema`: trimmed 1..4000 chars.
- Produces RPC `send_conversation_text(target_conversation_id uuid, message_body text, message_nonce uuid)`.
- Produces RPC `list_conversation_messages(target_conversation_id uuid, before_created_at timestamptz, before_id uuid, page_size integer)` returning newest-first bounded pages, transformed to ascending UI order in TS.
- Maximum page size: 50.

- [ ] **Step 1: Add failing tests**

Assert participant can send; outsider cannot; empty/overlong body rejected; repeated nonce returns same message; blocked conversation rejects new text; page size >50 rejected.

- [ ] **Step 2: Add validation**

```ts
export const messageTextSchema = z.string().trim().min(1).max(4000);
```

- [ ] **Step 3: Implement send RPC with basic V1 rate protection**

Before insert, count sender messages in the conversation during the last minute. Reject above a conservative V1 ceiling such as 20/minute using SQLSTATE `42900`. Do not implement a global distributed limiter in this phase.

- [ ] **Step 4: Implement keyset pagination**

Order by `(created_at desc, id desc)` and use the pair as cursor. Do not use unbounded OFFSET pagination for chat history.

- [ ] **Step 5: Add server action**

`sendTextMessage(previousState, formData)` authenticates, validates UUID/body/nonce, calls only the RPC, returns actionable copy, and never inserts into tables directly.

- [ ] **Step 6: Run pgTAP/unit/type tests and commit**

Commit: `feat(conversations): add paginated idempotent text messaging`

---

### Task 4: Private image/file attachments

**Files:**

- Create: `supabase/migrations/20260831_phase_04_attachments.sql`
- Extend: `supabase/tests/phase-04-conversations.sql`
- Modify: `packages/validation/src/index.ts`
- Create: `apps/web/src/lib/conversations/attachments.ts`
- Create: `apps/web/src/app/(account)/messages/attachment-actions.ts`
- Create: `apps/web/scripts/phase-04-conversations-runtime.mjs`

**Interfaces:**

- Private bucket: `conversation-attachments`.
- Allowed V1 image MIME: `image/jpeg`, `image/png`, `image/webp`.
- Allowed V1 file MIME: `application/pdf`, `text/plain`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Maximum attachment: 10 MiB; maximum 4 attachments/message.
- Object path: `<conversation-id>/<message-id>/<random-uuid>/<sanitized-name>`.

- [ ] **Step 1: Add failing Storage/runtime tests**

Create two participants and an outsider. Prove participant upload/download succeeds and outsider/anonymous download fails.

- [ ] **Step 2: Create private bucket and Storage policies**

Policies must derive conversation id from the first path segment and authorize through `conversation_participants`. No public bucket and no public object URLs.

- [ ] **Step 3: Add attachment validation**

Validate MIME, size, count and original filename length <=180. Sanitize display/storage names server-side.

- [ ] **Step 4: Implement attachment flow**

Use a two-phase server-authorized flow: create message row with nonce/kind, upload to its private path, then register metadata through an RPC that verifies sender ownership and object path prefix. On registration failure, best-effort delete the just-uploaded object and surface a recoverable error.

- [ ] **Step 5: Authorized download helper**

`createConversationAttachmentSignedUrl(attachmentId)` must first read attachment via participant-protected RPC/table access, then create a short-lived signed URL (<= 5 minutes).

- [ ] **Step 6: Run DB/runtime tests and commit**

Commit: `feat(conversations): add private chat attachments`

---

### Task 5: Unread/read state and immutable system events

**Files:**

- Add incremental Phase 04 migration.
- Extend: `supabase/tests/phase-04-conversations.sql`
- Modify: `apps/web/src/lib/conversations/server.ts`
- Create: `apps/web/src/lib/conversations/events.ts`

**Interfaces:**

- RPC `mark_conversation_read(target_conversation_id uuid, through_message_id uuid)`.
- Internal/server-only RPC `append_conversation_system_event(...)` is not executable by anon/authenticated clients.
- Inbox unread count derives from last read position and participant-safe messages.

- [ ] **Step 1: Add failing unread/system-event tests**

Prove user A marking read never changes B's read state; outsider cannot mark; system event cannot be inserted through authenticated direct writes.

- [ ] **Step 2: Implement read cursor**

Use one row per `(conversation_id, user_id)` and a `last_read_message_id/last_read_at` cursor. Do not update every message with per-user booleans.

- [ ] **Step 3: Implement immutable system-event foundation**

SYSTEM rows have `sender_user_id = null`; authenticated clients have no function grant to manufacture them. This is only foundation for Phase 05+ proposal/job events.

- [ ] **Step 4: Run tests and commit**

Commit: `feat(conversations): add unread state and system event foundation`

---

### Task 6: Block/report and anti-leakage warning baseline

**Files:**

- Add incremental Phase 04 migration.
- Extend: `supabase/tests/phase-04-conversations.sql`
- Create: `packages/domain/src/contact-leakage.ts`
- Create: `packages/domain/src/contact-leakage.test.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `apps/web/src/lib/conversations/moderation.ts`
- Create: `apps/web/src/app/(account)/messages/moderation-actions.ts`

**Interfaces:**

- `detectContactLeakage(text: string): LeakageSignal[]` returns deterministic obvious signals only.
- Signals: `PHONE`, `EMAIL`, `PAYMENT_HANDLE`, `EXTERNAL_CONTACT_REQUEST`.
- RPCs `block_user_for_conversation`, `unblock_user`, `report_conversation`.
- Blocking preserves history and reports; it prevents new informal messages while active.

- [ ] **Step 1: Write unit tests for obvious leakage**

Examples expected to trigger: phone-number patterns, email addresses, phrases like `te paso mi whatsapp`, `pagame por mercado pago`, obvious payment aliases. Normal service numbers such as `Windows 11`, dimensions, prices and dates must not be broadly blocked.

- [ ] **Step 2: Implement conservative detector**

The detector returns signals/warning copy; it must not contain AI/LLM calls and must not claim certainty.

- [ ] **Step 3: Integrate warning before send**

Server action runs the detector. For a first obvious signal, return a structured warning requiring explicit resend confirmation (`leakageConfirmed=true`) and append a moderation warning event. Do not store private analytics copies of message text.

- [ ] **Step 4: Add block/report RPCs and RLS tests**

Block actor must be a participant. Blocking another user does not delete or hide prior messages. Reports store category/reason and conversation id but are participant-only until the future admin phase.

- [ ] **Step 5: Run unit + DB tests and commit**

Commit: `feat(conversations): add reporting blocking and leakage warnings`

---

### Task 7: Realtime subscription with deduplication and reconnect convergence

**Files:**

- Create: `apps/web/src/lib/conversations/realtime.ts`
- Create: `apps/web/src/lib/conversations/realtime.test.ts`
- Create: `apps/web/src/components/conversations/conversation-live-client.tsx`
- Modify migration to add `messages` to Supabase Realtime publication only if not already present.

**Interfaces:**

- `mergeMessagePage(current, incoming)` deduplicates by message `id`, sorts `(created_at,id)` ascending.
- Browser subscription filters `conversation_id=eq.<id>` and never subscribes to unrestricted all-message traffic.

- [ ] **Step 1: Write failing dedupe tests**

Cover initial page + same realtime message; reconnect receiving an already-loaded message; out-of-order realtime delivery.

- [ ] **Step 2: Implement pure merge utility**

No React dependency in the merge utility.

- [ ] **Step 3: Implement scoped Realtime subscription**

Use `apps/web/src/lib/supabase/client.ts`. On `SUBSCRIBED` after a reconnect, call the normal message fetcher for the newest boundary so database truth fills any gap. Do not trust channel history.

- [ ] **Step 4: Clean subscription lifecycle**

Unsubscribe on conversation change/unmount. Keep optimistic local nonce mapping separate from confirmed server ids.

- [ ] **Step 5: Run unit tests and commit**

Commit: `feat(conversations): add realtime delivery with dedupe`

---

### Task 8: Inbox, contextual start CTA and mobile chat UI

**Files:**

- Modify: `apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx`
- Modify: `apps/web/src/app/(account)/layout.tsx`
- Create: `apps/web/src/app/(account)/messages/page.tsx`
- Create: `apps/web/src/app/(account)/messages/[conversationId]/page.tsx`
- Create: `apps/web/src/components/conversations/inbox-list.tsx`
- Create: `apps/web/src/components/conversations/conversation-shell.tsx`
- Create: `apps/web/src/components/conversations/message-list.tsx`
- Create: `apps/web/src/components/conversations/message-composer.tsx`
- Create: `apps/web/src/components/conversations/attachment-list.tsx`
- Create: `apps/web/src/components/conversations/system-message.tsx`

**Interfaces:**

- Service CTA: `Consultar por este servicio`.
- Anonymous visitor is redirected to `/login?next=<encoded service URL>`; authenticated client calls contextual start and redirects to `/messages/<id>`.
- Inbox route is authenticated.

- [ ] **Step 1: Add browser test expectations before UI implementation**

Create `tests/e2e/phase-04-conversations.spec.ts` with selectors/roles for service CTA, inbox, conversation heading, composer, pagination and attachments.

- [ ] **Step 2: Replace Phase 03 placeholder copy on service page**

Keep the public service SEO/content unchanged; add only the contextual start CTA and trust copy: conversation stays in Changas and protected contact/payment flow remains inside the platform.

- [ ] **Step 3: Build inbox**

Mobile layout: compact list with avatar, counterparty display name, service title, preview, timestamp, unread badge. Desktop can widen but must not require a separate component architecture.

- [ ] **Step 4: Build conversation shell**

Header shows public display name + service context, not private contact info. History supports `Cargar mensajes anteriores`; composer remains reachable above mobile safe area/keyboard and has >=44px touch targets.

- [ ] **Step 5: Render message kinds**

TEXT, IMAGE, FILE and SYSTEM render separately. Never use raw HTML from message body. Attachment downloads call the authorized signed-url action.

- [ ] **Step 6: Integrate warning/block/report UI**

Leakage warning explains why Changas recommends keeping contact/payment in-platform. Block/report controls are secondary actions and do not erase the thread.

- [ ] **Step 7: Run Playwright desktop + Pixel 5 locally/CI and commit**

Commit: `feat(conversations): build contextual inbox and mobile chat UX`

---

### Task 9: Phase 04 runtime/security E2E coverage and CI gate

**Files:**

- Modify: `supabase/seed.sql`
- Extend: `apps/web/scripts/phase-04-conversations-runtime.mjs`
- Create/extend: `tests/e2e/phase-04-conversations.spec.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Synthetic seed adds one client test account and deterministic Phase 04 conversation only; never real personal data.

- [ ] **Step 1: Seed deterministic client credentials and conversation fixtures**

Use `.example.test` email addresses and a deterministic local Auth password hash as already used by provider E2E patterns. Do not seed jobs/proposals/payments.

- [ ] **Step 2: Runtime security script**

Programmatically create participant A/B + outsider C, then prove:

- A/B can read the conversation;
- C cannot;
- A/B attachment read succeeds and C fails;
- outsider message insert/RPC fails;
- block prevents future message but keeps history;
- idempotent nonce produces one message;
- participant-only signed attachment flow works.

- [ ] **Step 3: E2E journeys**

Desktop Chrome and Pixel 5 must prove:

1. authenticated client starts from public service;
2. sends text and sees it without duplicate;
3. provider account sees same thread in inbox;
4. older messages paginate;
5. obvious off-platform contact attempt displays warning;
6. anonymous/outsider cannot open conversation URL;
7. private attachment can be opened by participant only.

- [ ] **Step 4: Add CI step**

After general RLS/Storage checks, run:

```yaml
- name: Run Phase 04 conversation runtime security checks
  run: node apps/web/scripts/phase-04-conversations-runtime.mjs
```

Keep existing Phase 03 runtime, Lighthouse and browser gates intact.

- [ ] **Step 5: Run full CI-equivalent suite and commit**

Commit: `test(conversations): gate realtime chat security and mobile journeys`

---

### Task 10: Final audit, report and stop gate

**Files:**

- Create: `docs/reports/phase-04-conversations.md`
- Modify only Phase 04 files if audit finds a real defect.

- [ ] **Step 1: Run static gates**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
git diff --check
```

- [ ] **Step 2: Run clean Supabase gates**

```bash
pnpm dlx supabase@2.116.0 start --exclude edge-runtime
pnpm dlx supabase@2.116.0 db reset --local --no-seed
pnpm dlx supabase@2.116.0 test db --local
node apps/web/scripts/supabase-runtime-security.mjs
node apps/web/scripts/phase-03-discovery-runtime.mjs
node apps/web/scripts/phase-04-conversations-runtime.mjs
pnpm dlx supabase@2.116.0 db reset --local
```

- [ ] **Step 3: Run browser gates**

Build/start production app and run `pnpm test:e2e` for Desktop Chrome + Pixel 5. Preserve Phase 03 Lighthouse checks.

- [ ] **Step 4: Audit acceptance criteria against the Master Plan**

Explicitly prove in the report:

- URL/ID tampering cannot open another user's conversation;
- attachments remain private;
- Realtime dedupes and reconnect converges;
- history paginates;
- obvious pre-job leakage warnings work;
- blocking preserves historical record;
- no Phase 05 functionality leaked into this branch.

- [ ] **Step 5: Record exact HEAD and successful GitHub Actions run**

Do not write `PASS` before both `validate` and `supabase-integration` are actually completed successfully on the final functional HEAD.

- [ ] **Step 6: STOP**

Do not create `codex/phase-05-proposals` until Phase 04 receives a separate audit/approval gate.
