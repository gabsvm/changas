# CHANGAS — Master Product & Implementation Plan V1

**Repository:** `gabsvm/changas`  
**Status at plan creation:** repository created but completely empty; no branches or commits yet.  
**Target deployment:** Vercel  
**Primary backend:** Supabase  
**Primary product surface:** mobile-first responsive web app + installable PWA  
**Planned future mobile:** React Native + Expo, reusing backend/domain contracts  
**AI at launch:** explicitly OUT OF SCOPE  
**Real payments:** intentionally deferred until the rest of the marketplace is working end-to-end with a fake payment provider.

---

# 0. How this document must be used

This is the authoritative implementation plan for Changas V1.

It is designed for **incremental execution by Codex**, one phase at a time, with a human/ChatGPT audit between phases.

## Mandatory operating rule

Codex MUST NOT execute multiple phases in one pass.

Workflow:

1. Read this document completely.
2. Execute only the currently authorized phase.
3. Create a dedicated branch for that phase.
4. Make small, understandable commits.
5. Run all required validation.
6. Open a PR or leave the branch ready for review.
7. Produce an implementation report with evidence.
8. STOP.
9. Wait for audit/approval before starting another phase.

If a later phase requires changing an earlier architectural decision, Codex must:
- explain the conflict;
- propose the smallest safe change;
- never silently redesign the product.

## Core implementation principle

**Do not build speculative features.**

If something is listed under "Out of scope", "Later", or "Advanced", it must not be implemented unless explicitly authorized.

## Skills / working style

If Codex has access to planning, TDD, debugging, security-review, Next.js, Supabase, or Vercel skills, it should use the relevant ones.

Discovery/brainstorming is already complete for V1. Codex should treat the product decisions in this document as approved requirements, not reopen them unnecessarily.

---

# 1. Product vision

Changas is a marketplace that helps people monetize skills, trades, knowledge and practical abilities they already possess.

A person may know how to:
- repair computers;
- do electrical work;
- teach English;
- assemble furniture;
- install cameras;
- tutor mathematics;
- perform gardening;
- provide remote technical support;
- or offer many unrelated skills at the same time.

Changas allows that person to turn those abilities into structured services that clients can discover, compare, negotiate and hire.

The platform must support:

- in-person work;
- remote work;
- fixed-price work;
- hourly work;
- unit-based work;
- "starting at" pricing;
- work that requires a quote;
- client offers and provider counteroffers;
- scheduled work;
- flexible arrival windows;
- deadline-based work;
- unscheduled work.

The marketplace monetizes primarily through a commission on work successfully transacted through Changas.

---

# 2. Product principles

## 2.1 One person, many abilities

A provider profile represents a person, not a profession.

Example:

```text
Juan Pérez
├── Electricity
│   ├── Replace wall outlet
│   └── Install light fixture
├── Computers
│   ├── Windows optimization
│   └── PC diagnosis
└── Education
    └── Conversational English
```

## 2.2 Skill is not Service

A **Skill** is a capability/category of expertise.

Example:
`Computer repair`

A **Service** is something sellable.

Example:
`PC diagnosis and Windows optimization — ARS 30,000`

This distinction must be preserved in the data model and UI.

## 2.3 Same account can be customer and provider

Do NOT create separate customer/provider accounts.

A user can:
- hire someone today;
- activate provider mode tomorrow;
- do both indefinitely.

## 2.4 Reputation must come from real jobs

Public reviews can only be created after a verified completed job on Changas.

No generic Google-style anonymous reviews.

## 2.5 Changas should be valuable enough that users prefer staying on-platform

The solution to marketplace leakage is not just censorship.

On-platform advantages should include:
- verified reputation;
- payment protection once real payments exist;
- work history;
- structured proposals;
- dispute evidence;
- scheduling;
- easier repeat hiring;
- verified reviews;
- protected communication;
- provider visibility/ranking.

## 2.6 Public discovery must be frictionless

Unauthenticated visitors may:
- search;
- browse categories;
- view provider profiles;
- view services;
- read reviews.

Authentication is required for:
- messaging;
- making an offer;
- hiring;
- favoriting;
- provider onboarding;
- any private data/action.

## 2.7 Mobile first, not mobile only

The core experience should feel excellent on a low/mid-range Android phone while remaining fully usable on desktop.

The web app should not feel like a desktop SaaS dashboard squeezed onto mobile.

---

# 3. Locked V1 platform decisions

## Frontend

- Next.js App Router
- React
- TypeScript
- responsive design
- mobile-first
- installable PWA
- server-first architecture where practical
- client components only where interactivity/realtime requires them

Use the latest stable supported releases available at implementation time. Do not pin this plan to historical version numbers.

## Deployment

- Vercel
- preview deployments for PRs
- production from approved main branch

## Backend

Supabase:
- PostgreSQL
- Auth
- Storage
- Realtime
- Row Level Security
- database migrations
- Edge Functions only where they are actually appropriate

## Search V1

No AI.

Use:
- PostgreSQL full-text search;
- normalized tags;
- synonyms;
- `pg_trgm` / fuzzy matching where appropriate;
- curated categories/skills;
- PostGIS for location/radius queries.

Architecture should leave room for semantic/embedding search later without requiring a schema rewrite.

## Styling / UI

Use a maintainable design-token based system.

Recommended:
- Tailwind CSS
- accessible headless primitives / shadcn-style source components where useful
- custom Changas visual language on top

Do NOT ship a default shadcn/demo/template aesthetic.

Desired personality:
- trustworthy;
- modern;
- premium but approachable;
- professional;
- clear;
- not flashy/carnival-like;
- not corporate SaaS;
- marketplace/service-oriented.

## Forms / validation

Use schema-driven validation.

Recommended:
- Zod
- React Hook Form where client forms benefit from it
- server-side validation for every mutation regardless of client validation

## Testing

Required:
- unit tests for domain logic;
- integration tests for critical server/data behavior;
- RLS/database permission tests;
- Playwright E2E for core user journeys.

Recommended stack:
- Vitest
- React Testing Library
- Playwright
- Supabase local test environment / SQL tests where applicable

## Email

Use an email provider abstraction.

Recommended default for V1:
- Resend

Do not couple business logic directly to Resend-specific calls.

## Location / geocoding

Use an abstraction so provider can be changed.

For V1:
- browser geolocation when permission is granted;
- manual location selection;
- approximate public location only;
- PostGIS-based distance/radius filtering.

A concrete geocoder/map vendor may be selected during Discovery implementation without leaking vendor-specific concepts into domain tables.

Map is optional/secondary UI. List results are primary.

## Future mobile

Do not build mobile now.

Future target:
- React Native
- Expo
- same Supabase backend
- same domain rules/contracts where portable

This is why domain/business logic must not be buried inside React components.

---

# 4. Explicitly OUT OF SCOPE for V1 launch build

Do not implement these now:

- AI natural-language intent classification;
- embeddings/semantic AI search;
- AI provider recommendations;
- native Android app;
- native iOS app;
- Expo app;
- voice calls;
- native video calls;
- custom Zoom/Meet replacement;
- GPS tracking in background;
- Uber-style live provider tracking;
- automatic recurring bookings/subscriptions;
- bidding marketplace where dozens of providers compete downward;
- gamified levels/XP;
- crypto;
- complex loyalty system;
- advertising marketplace;
- paid boosted ranking;
- automated KYC provider unless explicitly selected later;
- real payment provider until the dedicated payment phase;
- E2E encrypted chat;
- complex multi-country tax engine;
- chat bot / AI support agent.

---

# 5. Repository strategy

Because the repository is empty, initialize cleanly.

Recommended structure:

```text
/
├── apps/
│   └── web/
├── packages/
│   ├── domain/
│   ├── validation/
│   └── config/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── docs/
│   ├── architecture/
│   └── decisions/
├── .github/
│   └── workflows/
├── package.json
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```

Do NOT create packages just to make the repository look sophisticated.

`domain`, `validation`, and `config` are justified because future mobile reuse is planned.

Avoid a generic shared UI package intended for React Native reuse. Web and future native UI can diverge.

## Package manager

Use `pnpm`.

## Monorepo orchestration

A lightweight workspace is sufficient.

Turborepo may be used if it materially simplifies build/lint/test orchestration, but should not become architecture for architecture's sake.

---

# 6. Branch / PR protocol

Never develop directly on `main`.

Suggested phase branches:

```text
codex/phase-00-foundation
codex/phase-01-accounts
codex/phase-02-provider-marketplace
codex/phase-03-discovery
codex/phase-04-conversations
codex/phase-05-proposals
codex/phase-06-jobs
codex/phase-07-reputation
codex/phase-08-notifications
codex/phase-09-admin-trust
codex/phase-10-beta-hardening
codex/phase-11-payments
codex/phase-12-launch-hardening
```

Every PR should include:

- what was implemented;
- what was intentionally not implemented;
- screenshots for UI changes;
- migrations added;
- RLS policies added/changed;
- tests added;
- commands run;
- test output summary;
- manual QA steps;
- known limitations;
- any architectural decision made.

No phase may silently modify production data.

---

# 7. Security rules that apply from Phase 0 onward

These are non-negotiable.

## 7.1 RLS by default

Every user-related/private table must have RLS enabled before being considered complete.

Default posture:
**deny unless explicitly allowed**.

## 7.2 Never expose service role credentials to browser code

`SUPABASE_SERVICE_ROLE_KEY` or equivalent privileged credentials must NEVER appear in:
- client bundles;
- public environment variables;
- browser requests;
- committed files.

## 7.3 Private documents remain private

The following must never use public storage buckets:
- DNI front/back;
- identity selfies;
- CV files when private;
- chat attachments;
- dispute evidence;
- sensitive documents.

Use private buckets + authorized/signed access.

## 7.4 Public vs private identity

Public:
- display name;
- profile photo;
- approximate zone;
- bio;
- services;
- portfolio explicitly marked public;
- reviews;
- selected experience/education;
- verification badges.

Private:
- DNI number;
- DNI scans;
- date of birth;
- exact home address;
- bank/payment account information;
- private email;
- private phone before release rules;
- identity documents.

## 7.5 Critical mutations are server-authoritative

The browser may request actions.

It may not authoritatively decide:
- payment success;
- job state transitions;
- review eligibility;
- verification;
- admin status;
- commission;
- refunds;
- final provider payout.

## 7.6 Auditability

Critical actions must be traceable.

Examples:
- verification changes;
- proposal acceptance;
- job state transitions;
- cancellation;
- rebooking;
- admin actions;
- payment events later.

Do not build full event sourcing unless necessary.

Use append-only/auditable event records where appropriate.

## 7.7 Migration discipline

Once a migration has been applied/shared:
- do not rewrite it;
- create a new migration.

Migrations must be deterministic and reviewable.

---

# 8. Core domain model

This is conceptual. Codex should translate it into normalized PostgreSQL tables without mechanically creating one table per bullet if a better normalized representation exists.

## Identity / account

- `profiles`
- `provider_profiles`
- `provider_verifications`
- `provider_documents`
- `user_settings`
- `user_roles` / admin role model

## Marketplace catalog

- `categories`
- `skills`
- `skill_synonyms`
- `services`
- `service_tags`
- `service_media`
- `provider_skills`
- `service_areas`
- `availability_rules`
- `availability_blocks`

## Professional information

- `experiences`
- `education`
- `certifications`
- `portfolio_items`

## Discovery

- favorites
- location data
- search indexes / generated searchable fields as appropriate

## Conversation

- `conversations`
- `conversation_participants`
- `messages`
- `message_attachments`

Message types should support at least:

```text
TEXT
IMAGE
FILE
PROPOSAL_EVENT
SYSTEM_EVENT
```

Economic truth must not live only inside message text.

## Proposal / negotiation

- `proposals`
- `proposal_items` if necessary
- proposal revisions or immutable version representation
- offers/counteroffers represented as structured proposal versions

## Jobs

- `jobs`
- `job_events`
- `job_schedule`
- `job_scope_changes`
- `job_cancellations` if required by normalization

## Reputation

- `reviews`
- `review_replies`
- provider metrics / computed aggregates
- reports/moderation references

## Notifications

- `notifications`
- `push_subscriptions`
- notification preferences where needed

## Payments

Early phases:
- payment abstraction/domain types
- fake payment records sufficient for dev/test

Real phase:
- payment intents/transactions
- ledger entries
- commission
- refunds
- payouts
- provider account relation
- webhook event log

Do not design money as a single `paid = true` boolean.

---

# 9. Core enums / states

Use database constraints/enums or validated text values consistently.

## Provider status

```text
NOT_STARTED
PROFILE_INCOMPLETE
IDENTITY_PENDING
UNDER_REVIEW
ACTIVE
REJECTED
SUSPENDED
RESTRICTED
DEACTIVATED
```

## Service modality

```text
IN_PERSON
REMOTE
BOTH
```

## Price model

```text
FIXED
STARTING_AT
HOURLY
PER_UNIT
QUOTE
```

## Schedule type

```text
FIXED_SLOT
FLEXIBLE_WINDOW
DEADLINE
UNSCHEDULED
```

## Proposal status

Suggested:

```text
DRAFT
SENT
COUNTERED
ACCEPTED
REJECTED
EXPIRED
WITHDRAWN
SUPERSEDED
```

Accepted terms must be immutable/auditable.

## Job state

Core:

```text
DRAFT
PROPOSED
ACCEPTED
AWAITING_PAYMENT
CONFIRMED
IN_PROGRESS
COMPLETION_REQUESTED
COMPLETED
```

Side/final states:

```text
CANCELLED
DISPUTED
REFUNDED
PARTIALLY_REFUNDED
EXPIRED
NO_SHOW
```

Do not allow arbitrary state writes.

Create a centralized state-transition service/function with explicit legal transitions.

---

# 10. Provider model requirements

A user may activate provider mode.

Provider onboarding should be resumable.

Target steps:

1. Personal data
2. Identity documents
3. Professional profile
4. Skills
5. Services
6. Location / modality
7. Payout readiness placeholder
8. Review / publish

## Provider public profile

Must support:
- profile photo;
- name;
- approximate area;
- bio;
- identity verification indicator;
- skills;
- services;
- experience;
- education;
- certifications;
- portfolio;
- reviews;
- completed work count;
- rating;
- repeat client metric when enough data exists.

Do not display sensitive identity fields.

## Skills

Skills come from a Changas-controlled catalog.

Users cannot create arbitrary public skill strings.

Allow a "request new skill" workflow later/admin-assisted if needed.

## Service requirements

A service should support:

- provider;
- associated skill;
- title;
- description;
- modality;
- pricing model;
- price amount when applicable;
- optional unit;
- `accepts_offers`;
- expected duration when applicable;
- schedule type/default;
- includes;
- excludes;
- materials behavior/notes;
- location/radius if applicable;
- published/paused status.

A provider may pause:
- entire provider availability;
- individual services.

---

# 11. Discovery V1 requirements

No AI.

## Public home

Should include:
- main search;
- current/manual location;
- curated categories;
- nearby providers/services where location exists;
- remote services section;
- provider CTA ("Empezá a ganar con Changas").

## Search

Search across normalized:
- service title;
- service description where appropriate;
- skill names;
- categories;
- tags;
- synonyms.

Examples V1 should reasonably handle through curated indexing:

```text
electricista
arreglar pc
pc se apaga
clases ingles
instalar camara
armar mueble
```

Do not promise generalized human-language understanding.

## Filters

Initial:
- modality;
- distance;
- price/range where meaningful;
- rating;
- availability;
- identity verified;
- accepts offers;
- pricing model.

Do not show irrelevant filters for a category/query.

## Sort options

Default: `Recommended`

Additional:
- nearest;
- best rated;
- most completed jobs;
- price ascending;
- price descending.

Do not default to cheapest.

## Ranking

V1 ranking may combine:
- textual relevance;
- service/skill match;
- distance;
- adjusted rating confidence;
- completed jobs;
- completion rate;
- availability;
- response time;
- controlled new-provider exposure.

A provider with 5.0 from 2 jobs should not automatically outrank 4.9 from 400 jobs.

Use a statistically reasonable rating confidence approach rather than raw stars only.

## Result cards

Show enough to decide:
- provider;
- photo;
- verification indicator;
- rating + count;
- relevant service;
- price model;
- distance or remote;
- availability indicator;
- CTA.

## Public URLs

Provider:
```text
/p/[slug]
```

Service:
```text
/p/[provider-slug]/[service-slug]
```

or an equally clean stable scheme.

Generate:
- canonical metadata;
- social metadata/OpenGraph;
- sitemap entries;
- meaningful titles/descriptions.

The provider page should contextualize/highlight the service the visitor came from.

---

# 12. Conversation requirements

Chat is contextual, not generic social DMs.

Conversations should start from:
- service inquiry;
- quote request;
- offer;
- existing job.

## V1 content

- text;
- images;
- files;
- structured proposal cards/events;
- system events.

No native calls/video.

## Realtime

Use Supabase Realtime carefully:
- authorize access;
- avoid over-subscribing;
- unsubscribe cleanly;
- paginate history;
- optimistic UX only where safe.

## Anti-leakage V1

Before a job is confirmed:
- detect obvious phone numbers;
- WhatsApp links;
- direct external payment details such as CBU/CVU/aliases where feasible;
- obvious external contact handles/links.

Initial approach should prioritize:
- warning;
- friction;
- logging;
- clear explanation of lost Changas protections.

Avoid an over-aggressive system with high false-positive rates.

Rules should be configurable and testable.

## Data release

Before confirmed paid job:
- public approximate location only;
- no exact private address;
- no need to expose personal phone/email.

Once a real/approved job is confirmed:
- allow exact information needed to perform that job under explicit rules.

---

# 13. Proposal / booking model

Changas supports three entry modes:

## 13.1 Instant Booking

Known price.

Example:
`English class — ARS 12,000/hour`

## 13.2 Quote

Provider evaluates requirement and sends structured proposal.

## 13.3 Offer

Client offers amount.
Provider may:
- accept;
- reject;
- counteroffer.

All paths converge into:

```text
AGREEMENT
↓
AWAITING_PAYMENT
↓
CONFIRMED JOB
```

During development, `AWAITING_PAYMENT` is completed through `FakePaymentProvider`.

## Structured proposal

Must contain enough immutable context:

- service;
- client;
- provider;
- modality;
- agreed scope;
- price;
- currency;
- schedule type;
- date/window/deadline where applicable;
- duration estimate;
- includes;
- materials notes;
- version;
- timestamps.

Accepted proposal data must remain auditable even if the original service is later edited.

---

# 14. Scheduling requirements

Provider has general availability plus exceptions.

## Availability

Recurring rules:
- weekday;
- start/end time;
- timezone.

Blocks:
- personal unavailable time;
- vacations;
- manual blocks;
- existing confirmed Changas jobs.

## Job schedule types

### FIXED_SLOT
Example:
`Tuesday 18:00–19:00`

### FLEXIBLE_WINDOW
Example:
`Arrives Tuesday between 10:00–12:00`

### DEADLINE
Example:
`Translation delivered before Friday 18:00`

### UNSCHEDULED
Example:
`Date to be coordinated`

## Concurrency

Slot availability must be revalidated server-side at booking.

Do not trust the client view.

Implement protection against double booking.

## Payment hold

The architecture should support temporarily holding a slot while a payment attempt is in progress.

During FakePaymentProvider phase this can be simulated.

Do not overbuild distributed locking if a safe PostgreSQL transactional/constraint solution handles it.

## Rescheduling

Changes after confirmation require explicit agreement where appropriate.

Record:
- old schedule;
- requested new schedule;
- requester;
- acceptance/rejection;
- timestamps.

---

# 15. Job lifecycle requirements

Once a proposal is accepted and payment is considered successful, a real `Job` exists.

A job must reference an immutable snapshot/version of agreed terms.

## Start

Provider can mark the job in progress only when state transition is legal.

For V1:
- no GPS proof requirement;
- no live tracking.

## Completion

Provider:
`Request completion`

Client:
- confirm completed;
- report problem.

Later real payment system:
- confirmed completion triggers payout eligibility;
- dispute pauses payout.

## Non-response

Architecture must support automatic completion after a configurable period later.

Do not hardwire one universal 48-hour rule into domain code unless explicitly configured.

## Scope changes

A provider cannot unilaterally increase price.

Create structured scope-change proposal:
- current total;
- additional scope;
- additional amount;
- new total;
- client acceptance.

With FakePaymentProvider:
- simulate additional payment.

With real payment provider later:
- collect difference before updated terms become financially final.

## Cancellation / no-show

Model enough data to distinguish:
- client cancellation;
- provider cancellation;
- provider no-show;
- client no-show;
- system expiry.

Policies/fees may be configured later by service/category.

Do not hardcode a complex universal cancellation fee model before real payments.

---

# 16. Reputation requirements

Review eligibility:
- only participants of a completed Changas job;
- only for that job;
- enforce uniqueness per reviewer/job/role as appropriate.

Client reviews provider.

Provider may also review client, but public client reputation may be represented differently.

## Review content

Initial:
- overall 1–5 stars;
- text;
- optional simple dimensions if implemented without excessive complexity:
  - quality;
  - punctuality;
  - communication.

Do not build 10+ dimensions.

## Context

Review retains:
- job;
- service;
- skill/category context.

Allow provider rating summaries by relevant skill/service context.

## Provider reply

Provider can add one public reply.

## Reporting

Reviews can be reported for:
- threats;
- insults;
- private information;
- discrimination;
- irrelevant content;
- extortion;
- abuse.

A merely negative review is not removable just because provider dislikes it.

## Ranking

Store/calculate metrics such as:
- completed jobs;
- completion rate;
- cancellation rate;
- no-show rate;
- rating;
- review volume;
- response time;
- repeat clients.

Do not expose a mysterious public "87/100 reputation score".

Prefer understandable metrics.

---

# 17. Repeat hiring

V1 should support fast rehire.

From completed job/provider:

`Contratar nuevamente`

Reuse:
- provider;
- service;
- previous context where safe.

Require:
- new date/schedule;
- current service terms or new proposal;
- a new Job.

Do not silently reuse an old price if provider changed it.

Automatic recurring jobs are out of V1.

---

# 18. Notifications

## In-app notification center

Events:
- new message;
- new quote/proposal;
- counteroffer;
- proposal accepted/rejected;
- fake/real payment status;
- upcoming job;
- reschedule request;
- job started;
- completion requested;
- review received;
- verification result;
- moderation/admin action where appropriate.

## Web Push

PWA push for meaningful/actionable events.

Do not push every trivial message if it causes notification spam.

## Email

Transactional:
- account;
- verification;
- important job changes;
- payment receipt later;
- dispute/security;
- recovery.

Do not email for every `ok` chat message.

## Preferences

Support reasonable defaults first.
Promotional notifications should be separable from critical transactional/security notifications.

---

# 19. Admin / trust & safety minimum

Do not launch a two-sided marketplace with no admin surface.

V1 admin must support at least:

- search/view users;
- search/view providers;
- provider status;
- identity-review queue;
- approve/reject identity manually;
- category management;
- skill management;
- synonym/tag management;
- view services;
- disable/flag service;
- review reports;
- review reported reviews/messages where authorized;
- suspend/restrict provider/user;
- inspect job state/history;
- inspect audit events;
- future payment/dispute visibility.

Admin authorization must be server-enforced and cannot rely only on hidden routes.

Admin actions must be audited.

---

# 20. Identity verification V1

A full automated KYC vendor is not required for the initial product build.

V1 may use **manual admin verification**:

Provider uploads:
- DNI front;
- DNI back;
- requested identity/selfie evidence if required.

Storage:
- private bucket.

Admin:
- reviews;
- approves/rejects;
- records reason/status.

Public:
- only shows `Identidad verificada` when approved.

Design provider verification through an abstraction/state model so a real external KYC provider can replace/augment manual review later.

---

# 21. Payment architecture before real payments

Real payments are deferred, but architecture must be prepared from the beginning.

Define a provider interface conceptually similar to:

```ts
interface PaymentProvider {
  createPayment(...): Promise<...>
  getPaymentStatus(...): Promise<...>
  refund(...): Promise<...>
  createAdditionalCharge(...): Promise<...>
}
```

Exact API can evolve.

Early implementation:
`FakePaymentProvider`

Capabilities:
- simulate success;
- simulate failure;
- simulate pending;
- simulate refund;
- simulate additional payment;
- produce deterministic test records.

Fake payment actions must only be enabled:
- in local/dev/test;
- optionally protected preview environments.

They must never accidentally act as a production real-money mechanism.

The domain should use payment status/events, not provider-specific names.

---

# 22. Real payment requirements — later phase

Provider selection is intentionally deferred.

The chosen provider must be evaluated for marketplace capabilities in Argentina and expected expansion, including:

- customer payment collection;
- provider onboarding/account model;
- split/marketplace payments if supported;
- platform commission;
- delayed release/settlement behavior;
- refunds;
- partial refunds;
- chargebacks;
- webhook reliability;
- payout flow;
- identity/KYC requirements;
- tax/legal implications;
- supported payment methods;
- fee model.

Do not call a flow "escrow" in legal/product copy unless the actual provider/legal structure supports that claim.

Product wording can use a safer concept such as:
`Pago protegido por Changas`
only after legal/payment behavior justifies it.

---

# 23. Performance requirements

Target low/mid-range Android first.

Guidelines:
- minimize hydration;
- server-render public marketplace pages;
- paginate/virtualize long lists where needed;
- responsive images;
- avoid huge client bundles;
- lazy load map and heavy components;
- do not load Realtime where not needed;
- cache public catalog safely;
- no giant animation libraries for basic UI;
- avoid expensive background JS;
- keep interactions responsive.

PWA:
- do not aggressively cache authenticated/private pages;
- avoid stale job/payment state;
- offline behavior should be conservative;
- provide offline shell/status only where safe.

---

# 24. Accessibility

Required:
- semantic HTML;
- keyboard navigation;
- visible focus;
- accessible dialog/sheet behavior;
- labels for forms;
- sufficient contrast;
- reasonable touch targets;
- screen-reader names for icon controls;
- no color-only state signaling.

---

# 25. Error handling

Every critical flow must distinguish:
- validation error;
- unauthorized;
- forbidden;
- conflict;
- not found;
- rate limit;
- transient server/provider error.

User-facing copy must be actionable.

Do not show raw Supabase/PostgreSQL exceptions.

Critical state-changing operations should be idempotent where retries are plausible.

---

# 26. Analytics / observability

Do not allow analytics to delay core development, but prepare basic observability before beta.

Track product events without sensitive content:

- search performed;
- result opened;
- provider profile opened;
- service opened;
- inquiry created;
- proposal sent;
- proposal accepted;
- fake/real payment success;
- job completed;
- review created;
- rehire initiated.

Do not log:
- DNI content;
- private message content into analytics;
- bank details;
- secrets.

Error monitoring can be added in hardening phase.

---

# 27. Implementation phases

---

# PHASE 00 — Foundation

**Branch:** `codex/phase-00-foundation`

## Goal

Create the engineering foundation and nothing more.

## Tasks

1. Initialize repository.
2. Configure pnpm workspace.
3. Create `apps/web`.
4. Create justified shared packages.
5. Configure TypeScript strict mode.
6. Configure lint/format.
7. Configure testing foundation.
8. Configure Next.js app.
9. Configure Tailwind/design tokens foundation.
10. Configure Supabase local structure.
11. Create typed Supabase client patterns:
    - browser;
    - server;
    - privileged server-only.
12. Create `.env.example`.
13. Configure PWA basics:
    - manifest;
    - icons placeholders;
    - installability baseline;
    - safe service worker strategy.
14. Configure GitHub CI:
    - install;
    - lint;
    - typecheck;
    - unit tests;
    - build.
15. Configure Vercel-compatible build.
16. Add architecture docs.
17. Add initial database extensions/migration:
    - required UUID support if needed;
    - PostGIS;
    - pg_trgm;
    - other justified extensions only.
18. Add health/smoke page or route.
19. Add error boundary/not-found baseline.
20. Add README with local setup commands.

## Do NOT implement

- real profile UX;
- marketplace;
- chat;
- jobs;
- payments;
- admin UI.

## Acceptance criteria

- clean clone can install and build;
- local app starts;
- tests run;
- CI passes;
- PWA manifest valid;
- no secrets committed;
- Supabase local config/migrations are reproducible;
- repo structure is documented;
- no obvious unnecessary dependency bloat.

## Required audit evidence

- tree of created files;
- package list with reason for nontrivial deps;
- CI output;
- build output;
- screenshot mobile + desktop of baseline shell;
- migration list.

**STOP AFTER PHASE 00.**

---

# PHASE 01 — Accounts, auth and provider identity skeleton

**Branch:** `codex/phase-01-accounts`

## Goal

Users can authenticate, manage a basic profile and start/resume provider onboarding.

## Tasks

1. Supabase Auth integration.
2. Email/password authentication.
3. Google OAuth if credentials/config are available; otherwise prepare clean integration point without blocking core.
4. Auth callback/session handling.
5. `profiles`.
6. provider activation.
7. `provider_profiles`.
8. private identity fields/schema.
9. identity document upload to private Storage.
10. resumable onboarding progress.
11. provider status model.
12. basic account settings.
13. RLS for all tables.
14. tests proving:
    - user reads/edits own profile;
    - cannot edit another;
    - identity docs are private;
    - provider status cannot be self-promoted to ACTIVE if admin approval is required.
15. temporary manual identity state visible in UI.
16. clear public/private data separation.

## UI

Build:
- sign up;
- login;
- forgot/recovery;
- account;
- start provider CTA;
- onboarding shell/progress;
- personal data;
- identity upload.

Do not finish skills/services yet.

## Acceptance criteria

- auth works end-to-end;
- provider onboarding can be abandoned/resumed;
- sensitive docs cannot be accessed by another normal user;
- mobile UX is polished;
- no service-role exposure;
- all permission tests pass.

**STOP AFTER PHASE 01.**

---

# PHASE 02 — Provider marketplace data

**Branch:** `codex/phase-02-provider-marketplace`

## Goal

A verified/test provider can create a professional public offering.

## Tasks

1. Categories.
2. Skills.
3. Skill synonyms/tags.
4. Provider skills.
5. Services.
6. Pricing models.
7. Modality.
8. Offer acceptance setting.
9. Experience.
10. Education.
11. Certifications.
12. Portfolio.
13. Service areas.
14. Availability rules.
15. Availability blocks.
16. Provider/service pause states.
17. public provider profile.
18. public service page.
19. admin/test path to mark provider ACTIVE until admin phase exists.
20. seed realistic initial category/skill data.

## Initial seed categories

At minimum representative categories such as:
- Hogar;
- Tecnología;
- Educación;
- Mascotas;
- Servicios profesionales;
- Belleza/Bienestar where appropriate;
- Otros.

Do not try to catalog every profession on Earth.

## Acceptance criteria

- provider can create multiple unrelated skills/services;
- skill and service are structurally separate;
- all price types work;
- remote/in-person/both works;
- public visitor sees only public fields;
- exact private address is not public;
- service can be paused without deleting it;
- provider can pause availability;
- RLS tests pass.

**STOP AFTER PHASE 02.**

---

# PHASE 03 — Public discovery, search and SEO

**Branch:** `codex/phase-03-discovery`

## Goal

Changas becomes a browseable public marketplace.

## Tasks

1. Public home.
2. Search.
3. Category browsing.
4. PostgreSQL FTS.
5. synonyms/tags.
6. fuzzy typo matching where justified.
7. location permission UX.
8. manual location.
9. PostGIS radius query.
10. remote service discovery.
11. filters.
12. sorting.
13. recommended ranking baseline.
14. statistically adjusted rating placeholder/utility.
15. new provider exposure rule.
16. result cards.
17. list-first results.
18. optional/lazy map if provider decision is ready.
19. favorites for logged-in users.
20. SEO metadata.
21. sitemaps.
22. OpenGraph/social previews.
23. public provider/service URLs.

## Search acceptance examples

Seeded data should allow meaningful matches for examples like:
- `electricista`
- `arreglar pc`
- `pc se apaga`
- `clases ingles`
- `instalar camara`

without AI.

## Acceptance criteria

- anonymous browsing works;
- no auth wall before browsing;
- search has useful results;
- radius queries are server-backed;
- private coordinates/address are not leaked improperly;
- public pages are SSR/indexable where appropriate;
- Lighthouse/performance is reasonable on mobile;
- heavy map code is not loaded when map isn't used.

**STOP AFTER PHASE 03.**

---

# PHASE 04 — Conversations and realtime

**Branch:** `codex/phase-04-conversations`

## Goal

Client and provider can discuss a service without leaving Changas.

## Tasks

1. conversation model.
2. participant authorization.
3. contextual conversation start from service.
4. inbox.
5. message pagination.
6. text messages.
7. image attachments.
8. file attachments.
9. private Storage.
10. Realtime updates.
11. system-message/event rendering foundation.
12. unread state.
13. basic report/block infrastructure.
14. anti-leakage detector baseline.
15. warnings/logging.
16. rate/abuse protections appropriate for V1.
17. mobile chat UX.

## Acceptance criteria

- cannot open another user's conversation by changing URL/ID;
- attachment access is private;
- Realtime doesn't duplicate messages;
- reconnect behavior is sane;
- chat history paginates;
- pre-job leakage warnings work for obvious cases;
- blocking does not silently destroy an active contractual record.

**STOP AFTER PHASE 04.**

---

# PHASE 05 — Offers, quotes, proposals and FakePaymentProvider

**Branch:** `codex/phase-05-proposals`

## Goal

Negotiation becomes structured and a proposal can be accepted and "paid" without real money.

## Tasks

1. proposal schema.
2. proposal versions/revisions.
3. direct fixed-price booking proposal.
4. quote request.
5. client offer.
6. provider counteroffer.
7. accept/reject/withdraw/expire.
8. immutable accepted snapshot.
9. proposal cards inside conversation.
10. legal state-transition rules.
11. payment-provider domain abstraction.
12. `FakePaymentProvider`.
13. fake success/pending/failure.
14. `AWAITING_PAYMENT`.
15. successful fake payment creates/confirms Job safely.
16. idempotency for acceptance/payment transition.
17. audit/system events.
18. tests for race cases.

## Acceptance criteria

- informal chat text cannot mutate economic truth;
- accepted price/scope is auditable;
- old service edit does not modify accepted proposal;
- client cannot accept someone else's proposal;
- provider cannot accept on behalf of client;
- duplicate fake payment callback cannot create duplicate Job;
- production mode cannot expose dev fake-payment button.

**STOP AFTER PHASE 05.**

---

# PHASE 06 — Scheduling and complete job lifecycle

**Branch:** `codex/phase-06-jobs`

## Goal

A fake-paid job can proceed from confirmation through completion/cancellation.

## Tasks

1. schedule model.
2. FIXED_SLOT.
3. FLEXIBLE_WINDOW.
4. DEADLINE.
5. UNSCHEDULED.
6. recurring availability.
7. availability exceptions.
8. conflict prevention.
9. transactional revalidation.
10. temporary slot hold abstraction.
11. job state machine.
12. start job.
13. completion request.
14. client completion confirmation.
15. report-problem/dispute placeholder state.
16. cancellation reason/actor.
17. no-show actor.
18. reschedule request/accept/reject.
19. scope change proposal.
20. fake additional payment.
21. job timeline UI.
22. exact-location release rules for confirmed in-person jobs.
23. upcoming work views.

## Acceptance criteria

- double booking prevented;
- illegal state transitions fail server-side;
- job terms stay immutable/auditable;
- reschedule leaves history;
- scope change cannot raise price without client acceptance;
- cancellation records actor/reason;
- exact private address is not exposed to arbitrary users.

**STOP AFTER PHASE 06.**

---

# PHASE 07 — Reviews, ranking and repeat hiring

**Branch:** `codex/phase-07-reputation`

## Goal

Completed jobs build trustworthy provider reputation.

## Tasks

1. review eligibility.
2. 1–5 rating.
3. review text.
4. job/service relation.
5. optional limited dimensions.
6. provider public reply.
7. review reporting.
8. aggregate provider metrics.
9. skill/service-specific aggregates.
10. completion/cancellation metrics.
11. response-time metric if reliable.
12. repeat-client count.
13. ranking calculation update.
14. favorites polish.
15. rehire from completed job/provider.
16. "new provider" ranking exposure.
17. anti-manipulation constraints.

## Acceptance criteria

- no review without completed job;
- no duplicate unauthorized review;
- user cannot review themselves;
- service context retained;
- provider cannot delete bad review;
- raw rating is not only ranking signal;
- rehire creates a new proposal/job flow, not reopens old job.

**STOP AFTER PHASE 07.**

---

# PHASE 08 — Notifications and PWA product polish

**Branch:** `codex/phase-08-notifications`

## Goal

Users reliably know when something important happened.

## Tasks

1. notification model.
2. notification center.
3. unread counts.
4. push subscription.
5. Web Push.
6. meaningful event routing.
7. email provider abstraction.
8. Resend implementation if configured.
9. transactional templates.
10. job reminders.
11. proposal alerts.
12. verification alerts.
13. settings/preferences baseline.
14. install PWA UX.
15. app icons/final manifest assets placeholder or brand-ready integration.
16. offline/error shell.
17. update/service-worker strategy.
18. test iOS/Android browser limitations where possible.

## Acceptance criteria

- push is opt-in;
- app still works if push denied;
- emails are not sent for trivial chat messages;
- no sensitive chat text in push lock-screen copy unless explicitly safe;
- PWA install/update doesn't cause stale job/payment data;
- mobile navigation feels app-like without hiding web strengths.

**STOP AFTER PHASE 08.**

---

# PHASE 09 — Admin, manual verification and trust/safety

**Branch:** `codex/phase-09-admin-trust`

## Goal

Changas can actually be operated safely by administrators.

## Tasks

1. real admin role enforcement.
2. admin layout/routes.
3. user search/details.
4. provider search/details.
5. manual identity review.
6. approve/reject with reason.
7. category CRUD.
8. skill CRUD.
9. synonym/tag CRUD.
10. service moderation.
11. report queue.
12. review moderation workflow.
13. user/provider restrictions.
14. suspension.
15. job inspection.
16. audit log viewer.
17. security around admin actions.
18. storage access for authorized identity review only.

## Acceptance criteria

- route hiding is not the security model;
- non-admin API/database access is denied;
- admin actions audited;
- provider cannot approve own identity;
- identity docs remain private;
- moderation changes are reversible/auditable where appropriate.

**STOP AFTER PHASE 09.**

---

# PHASE 10 — End-to-end beta hardening before real money

**Branch:** `codex/phase-10-beta-hardening`

## Goal

Prove Changas works as a complete marketplace using fake money before integrating a payment provider.

## Required E2E journeys

### Journey A — fixed remote service

```text
Sign up provider
→ provider onboarding
→ admin verify
→ create English service
→ client searches
→ opens service
→ books time
→ fake payment
→ job confirmed
→ provider starts
→ completion requested
→ client completes
→ review
→ rehire
```

### Journey B — in-person quote

```text
Provider publishes electrical service
→ client finds provider by radius
→ starts inquiry
→ uploads photo
→ provider sends quote
→ client counteroffers
→ provider accepts
→ client fake-pays
→ location released
→ reschedule
→ job starts
→ scope increase
→ fake additional payment
→ complete
→ review
```

### Journey C — failures

Test:
- unauthorized access;
- payment fake failure;
- proposal race;
- double booking attempt;
- cancelled job;
- no-show;
- message attachment access;
- invalid review;
- suspended provider;
- expired proposal.

## Hardening tasks

- full RLS audit;
- storage policy audit;
- auth/session audit;
- dependency audit;
- error handling;
- idempotency review;
- concurrency review;
- performance audit;
- mobile audit;
- accessibility audit;
- SEO audit;
- CI reliability;
- Vercel preview smoke tests;
- seed/demo environment;
- backup/recovery documentation;
- observability baseline.

## Acceptance criteria

No real payment integration until this phase passes audit.

**STOP AFTER PHASE 10.**

---

# PHASE 11 — Real payment provider

**Branch:** `codex/phase-11-payments`

## Goal

Replace fake economic execution with a real payment provider without changing marketplace behavior.

## Step 1 — Provider decision memo

Before writing integration code, produce:

`docs/decisions/payment-provider.md`

Evaluate suitable providers for Changas/Argentina against:

- marketplace support;
- platform commission;
- onboarding;
- split payments;
- delayed settlement;
- refunds;
- partial refunds;
- chargebacks;
- payouts;
- webhooks;
- fees;
- currency;
- tax/legal implications;
- operational burden.

Do not choose based only on familiarity.

## Step 2 — Adapter implementation

Implement selected provider behind existing payment abstraction.

## Required components

- payment creation;
- webhook validation;
- webhook persistence;
- idempotency;
- payment status;
- commission calculation;
- provider net amount;
- refund;
- partial refund if supported/required;
- payout/settlement model;
- additional scope payment;
- receipts/reference;
- reconciliation tools;
- admin visibility.

## Ledger

Use explicit financial records.

Avoid deriving financial truth exclusively from mutable job fields.

Store money using integer minor units or another precise representation.

Never floating point.

## Security

- validate webhook signatures;
- never trust redirect success page;
- webhook/server reconciliation is authoritative;
- idempotency keys;
- audit raw provider event IDs/status, respecting sensitive-data policy.

## Acceptance criteria

- fake provider still available in test;
- real provider works in approved environment;
- duplicate webhooks are safe;
- payment redirect spoof cannot mark paid;
- commission transparent;
- refund produces correct state/accounting;
- payment failure leaves job in correct state;
- no production secrets committed.

**STOP AFTER PHASE 11.**

---

# PHASE 12 — Final launch hardening and production

**Branch:** `codex/phase-12-launch-hardening`

## Goal

Prepare actual production release on Vercel.

## Tasks

1. final database migration review.
2. production RLS audit.
3. production Storage audit.
4. payment test/production credential separation.
5. environment validation.
6. CSP/security headers.
7. rate limits / abuse protections.
8. auth callback domain validation.
9. PWA production validation.
10. SEO production validation.
11. sitemap/robots.
12. transactional email production validation.
13. push production validation.
14. admin recovery/access process.
15. error monitoring.
16. analytics/privacy review.
17. legal copy placeholders:
    - terms;
    - privacy;
    - cancellation;
    - prohibited services;
    - dispute/payment wording.
18. backup/recovery runbook.
19. incident runbook.
20. final Playwright production-smoke suite.
21. mobile testing.
22. desktop testing.
23. Vercel production deployment.
24. post-deploy smoke test.

## Launch gate

Do not call the product production-ready merely because it deploys.

Must validate:

- auth;
- provider onboarding;
- private DNI access;
- public search;
- conversation;
- proposal;
- real payment;
- booking conflict;
- job completion;
- review;
- admin;
- refund path;
- mobile performance.

---

# 28. Required Codex report format after EVERY phase

Codex must finish each phase with:

```markdown
# Phase XX Implementation Report

## Branch
...

## Commits
- ...

## Implemented
- ...

## Explicitly not implemented
- ...

## Database migrations
- ...

## RLS / security changes
- ...

## Tests added
- ...

## Commands run
- `...`

## Results
- lint:
- typecheck:
- unit:
- integration:
- e2e:
- build:

## Manual QA performed
1. ...
2. ...

## Screenshots / preview
- ...

## Known limitations
- ...

## Risks / things reviewer should inspect
- ...

## Deviations from master plan
- None / explain exactly.

## STOP
Phase complete. No later phase work was started.
```

A phase without this report is not considered review-ready.

---

# 29. Global Definition of Done

A task is not complete because UI exists.

For each feature, verify as applicable:

- database schema;
- migration;
- validation;
- authorization;
- RLS;
- server mutation;
- UI;
- loading;
- empty;
- error;
- success;
- mobile;
- accessibility;
- test;
- audit/event;
- documentation.

---

# 30. Rules for Codex when encountering ambiguity

Codex should not stop for minor aesthetic/implementation ambiguity.

Use these priorities:

1. preserve approved product behavior;
2. preserve security;
3. preserve domain invariants;
4. prefer simplest maintainable implementation;
5. avoid premature abstraction;
6. document material choices.

Codex SHOULD stop and flag the issue if ambiguity could change:

- money;
- authorization;
- privacy;
- destructive data migration;
- legal meaning;
- job state behavior;
- public/private data boundary.

---

# 31. UI/UX acceptance baseline

All phases with UI must validate:

## Mobile

Primary target viewport examples:
- ~360×800
- ~393×873
- ~412×915

Do not optimize for only an iPhone Pro Max.

Test throttled/low-performance conditions where possible.

## Navigation

Customer experience should emphasize:
- discover;
- search;
- jobs;
- messages;
- profile.

Provider experience should contextualize:
- new inquiries;
- upcoming jobs;
- earnings placeholder/later real;
- services;
- availability.

Same account, contextual UI.

Avoid two completely disconnected applications.

## Marketplace tone

The product should communicate:
- trust;
- competence;
- proximity;
- clear pricing;
- verified history.

Avoid:
- neon marketplace clutter;
- excessive gradients;
- fake urgency;
- dashboard density on consumer screens;
- dozens of badges.

---

# 32. Data seeding strategy

Development should have realistic seed users, not `Test User 1`.

Include synthetic examples:
- electrician;
- English teacher;
- PC technician;
- furniture assembler;
- remote designer/consultant.

Seed:
- categories;
- skills;
- services;
- locations;
- fake reviews only clearly in local/demo seed environments;
- availability.

Never seed fake reviews into real production profiles.

---

# 33. Environment strategy

At minimum:

```text
local
preview/staging
production
```

Use separate Supabase environments/projects/branching strategy as available and appropriate.

Never point arbitrary PR previews at production write access.

`.env.example` documents keys without values.

Production secrets live in approved secret/environment managers, not Git.

---

# 34. Future-ready decisions (do not implement yet)

The schema/architecture should avoid blocking these later additions:

## AI search

Future:

```text
user text
→ intent extraction
→ skill/service match
→ semantic search
→ clarification if needed
→ provider ranking
```

V1 tags/synonyms/categories become useful training/retrieval metadata.

## Expo mobile

Future app should consume same:
- auth;
- data;
- domain constraints;
- APIs;
- job states;
- payment behavior.

## Recurring services

Potential:
- weekly classes;
- biweekly cleaning;
- maintenance contracts.

## Advanced reputation

Potential:
- category-specific confidence;
- verified credential weighting;
- fraud detection;
- quality signals.

## External KYC

Manual identity flow can be upgraded.

---

# 35. Anti-goals

Do not let Changas become:

## A generic job board

The unit is a service/job transaction, not CV applications to employers.

## A social network

No arbitrary follower/feed mechanics in V1.

## A race to the cheapest provider

Ranking must reward relevance and trust, not only low price.

## A WhatsApp directory

Communication/negotiation/job lifecycle should have real on-platform value.

## Uber copied literally

No unnecessary driver-map/GPS metaphors.

Changas handles many types of services with different scheduling semantics.

---

# 36. First prompt to give Codex

Use this after this plan is available to Codex:

```text
Work on repository gabsvm/changas.

Read CHANGAS_MASTER_PLAN.md in full before changing anything.

We are starting from an empty repository.

Execute ONLY PHASE 00 — Foundation.

Mandatory constraints:
- Do not work directly on main.
- Create/use branch codex/phase-00-foundation.
- Do not implement any Phase 01+ product features.
- Keep dependencies minimal and justified.
- Use pnpm.
- Next.js App Router + TypeScript strict.
- Supabase local project/migrations foundation.
- PWA baseline.
- Vercel-compatible architecture.
- CI must run lint, typecheck, tests and build.
- Never commit secrets.
- Follow the security rules in the master plan even if the current phase has little user data.
- Use relevant installed skills if available.
- Make small coherent commits.
- Run all validation before stopping.

At completion, produce the exact "Phase XX Implementation Report" required by the master plan and STOP. Do not begin Phase 01 even if Phase 00 succeeds.
```

---

# 37. Prompts for later phases

After audit approval, use the same pattern.

Example Phase 01:

```text
Read CHANGAS_MASTER_PLAN.md and the approved Phase 00 implementation.

Execute ONLY PHASE 01 — Accounts, auth and provider identity skeleton.

Work from the approved current main/base commit in branch:
codex/phase-01-accounts

Do not implement Phase 02+.

Preserve all master-plan security constraints.
Add migrations and RLS with tests.
Run lint, typecheck, tests and build.
Provide the required Phase 01 Implementation Report.
STOP after Phase 01.
```

For every later phase replace the number/name/branch and retain the same STOP rule.

---

# 38. Audit checklist for reviewer after every PR

Reviewer should verify:

## Scope
- Did Codex implement only this phase?
- Did it sneak in future features?
- Did it omit required acceptance criteria?

## Architecture
- Is domain logic separated from UI?
- Is there accidental provider/vendor lock-in?
- Is complexity justified?

## Database
- migrations safe?
- constraints present?
- indexes justified?
- money/time/location represented safely?
- immutable accepted data preserved?

## RLS
- enabled?
- tests prove allowed AND forbidden cases?
- any broad `authenticated = true` policies that leak data?

## Storage
- correct bucket privacy?
- signed/authorized access?
- MIME/size limits?
- orphan cleanup strategy where relevant?

## Security
- service role server-only?
- no secret leaks?
- server authoritative?
- IDs not enough to authorize access?

## UX
- mobile first?
- loading/empty/error states?
- accessible?
- no template-looking regressions?

## Performance
- excessive client JS?
- N+1 queries?
- unbounded lists?
- heavy components lazy-loaded?
- Realtime scoped?

## Testing
- tests meaningful or cosmetic?
- failure/race cases?
- build passes?

Only after audit:
- approve/merge;
- authorize next phase.

---

# 39. V1 launch definition

Changas V1 is functionally complete when a real user can:

```text
Create account
↓
become provider
↓
verify identity
↓
publish skills/services
↓
appear in search
↓
receive inquiry
↓
negotiate structured proposal
↓
receive confirmed payment
↓
schedule job
↓
perform job
↓
request completion
↓
client confirms
↓
provider receives correct financial outcome
↓
client leaves verified review
↓
client can hire again
```

And administrators can safely:
- inspect;
- verify;
- moderate;
- suspend;
- audit;
- handle essential payment/refund states.

Anything beyond that is not required to call V1 a coherent marketplace.

---

# 40. Final product decisions frozen by this plan

- PWA first.
- Vercel deployment.
- Next.js + TypeScript.
- Supabase backend.
- same account can be client/provider.
- in-person + remote.
- multiple unrelated skills per provider.
- skill != service.
- controlled skill catalog.
- structured services.
- fixed/starting/hour/unit/quote pricing.
- offers optional per service.
- instant booking + quote + offer.
- structured proposals.
- contextual chat.
- realtime messaging.
- private attachments.
- controlled contact-data leakage.
- exact location protected until required.
- availability and scheduling.
- fixed slot / flexible window / deadline / unscheduled.
- structured Job state machine.
- reviews only from completed jobs.
- reputation contextual and statistically sensible.
- repeat hiring.
- admin/trust & safety before launch.
- manual identity verification is acceptable V1.
- no AI at launch.
- no native mobile at launch.
- no custom voice/video calls at launch.
- no recurring auto-booking at launch.
- FakePaymentProvider until marketplace is fully validated.
- real payment integration near the end.
- final production hardening after payments.

This document is the source of truth unless an explicitly approved decision supersedes it.
