# Changas — Premium Product Redesign V2

**Status:** Approved for implementation  
**Date:** 2026-09-08  
**Branch:** `codex/premium-product-redesign-v2`  
**Base:** `main` at `8df7facde71ae7e7156d97cdc395d51decddfc86`

## Goal

Make Changas feel like one coherent, premium, mobile-first marketplace PWA instead of a mix of polished app screens and desktop-oriented forms. Preserve the existing marketplace, Supabase, security, provider-lifecycle, notifications, jobs, conversations, proposals, and Mercado Pago contracts.

## Locked constraints

- Do not change database schema, migrations, RLS, grants, Storage policies, payment contracts, provider lifecycle semantics, or Phase 12 scope.
- Do not expose private identity/document paths.
- Do not use GitHub Actions as an implementation or verification mechanism.
- Do not create or trigger Vercel deployments for this work unless the user explicitly asks later.
- Work only on `codex/premium-product-redesign-v2`; do not edit `main` directly.
- Keep the current Changas brand palette from `docs/design/changas-brand-system.md`.

## Product principles

1. **One product shell.** An authenticated user must not feel that they leave the app when moving from Home to Search, Category, Provider, or Service surfaces.
2. **Mobile progressive disclosure.** Advanced filters and long provider-management forms must not be dumped into the main mobile viewport.
3. **Human language.** Never show backend enums, storage terminology, OAuth/token language, or engineering implementation details in customer-facing UI.
4. **Trust before density.** Provider/service surfaces prioritize identity, reputation, price, modality, zone, and action hierarchy before secondary metadata.
5. **Immersive task flows.** Conversation detail and focused editing flows may hide global navigation when persistent UI would interfere with the task.
6. **Consistent visual grammar.** Typography, spacing, shape, empty states, controls, and status treatment should be reusable rather than page-specific.

## Brand and typography

### Palette

Preserve the current brand system:

- Canvas `#FFF9F3`
- Ink `#202124`
- Primary orange `#FF6B35`
- Yellow `#FFC857`
- Functional blue `#2563EB`
- Pink accent `#FF0A78`
- Accessible strong pink `#D60060`

Orange remains the primary CTA/progress color. Blue remains functional/focus/link. Pink stays sparse and brand/notification-oriented. Gradients remain emotional/brand surfaces, not general-purpose containers.

### Typography

Replace Trebuchet/Arial with **Plus Jakarta Sans Variable** as the single product family. Use `next/font/google` so the font is self-hosted by Next.js at build output rather than requested by the browser from Google.

Recommended hierarchy:

- Hero: 40–44px mobile, 60–68px desktop, 800
- Page H1: 32–38px mobile, 40–48px desktop, 800
- H2: 26–32px, 750–800
- H3: 20–24px, 700
- Body: 16/24, 450–500
- Supporting body: 14/21, 500
- Label/button: 14–16, 700
- Bottom nav: 12, 650–700

Reduce repeated extreme letter-spacing and uppercase kickers. Brand kickers remain occasional, not mandatory on every screen.

## Consumer app shell

Create a reusable server-first `ConsumerShell` for public marketplace routes. It must:

- load the current session;
- show one consistent Changas header;
- show `Ingresar` only when anonymous;
- show `Mi cuenta` when authenticated;
- render the authenticated mobile bottom nav when logged in;
- respect bottom safe-area padding;
- accept page content without owning business data.

Apply it to:

- `/`
- `/buscar`
- `/categoria/[slug]`
- `/p/[slug]`
- `/p/[slug]/[serviceSlug]`

The account/provider layouts remain separate authenticated shells.

## Bottom navigation and Activity

Keep four tabs:

1. Inicio
2. Mensajes
3. Actividad
4. Cuenta

Change Activity destination from raw notifications to `/activity`.

`/activity` becomes the transactional hub:

- prominent `Trabajos` entry/summary;
- notification activity summary/feed entry;
- unread count remains reflected on the Activity tab;
- `/jobs` and `/jobs/*` map to Activity for active-nav state.

Notification preferences and Web Push settings remain under account settings rather than defining the Activity information architecture.

## Home

Reduce marketing density. Mobile-first order:

1. compact brand header;
2. concise `¿Qué necesitás?` search hero;
3. location;
4. quick remote/discovery actions;
5. categories;
6. services;
7. useful marketplace empty state when no services exist.

The large gradient explainer panel is reduced or removed from the primary mobile flow.

## Search and discovery

Desktop may retain visible advanced controls. Mobile must use progressive disclosure:

- query + location remain primary;
- compact quick-filter chips for modality/nearby/price where appropriate;
- advanced filters live inside a native-accessible disclosure or modal-like sheet pattern;
- selected filter count is visible;
- submitting keeps the existing query-string contract.

Discovery cards prioritize:

1. media/fallback;
2. service title;
3. provider + reputation;
4. price;
5. modality/zone;
6. maximum 1–2 skill chips plus overflow count.

No discovery RPC/domain contract changes.

## Provider and service public surfaces

Provider profile begins with a trust hero: avatar, name, reputation, public zone, completion/completed work, and appropriate trust/status cues. Services become the first major content section. Secondary biography/portfolio/experience content follows.

Service detail prioritizes service title, price, provider/reputation, modality/zone, description, media/portfolio, availability/reputation, and a clear contact CTA. On mobile, contact remains easy to reach and must not be covered by the global bottom nav.

All modality, distance, price-model, status, and schedule values are humanized at the UI boundary.

## Messages

Conversation list keeps the bottom nav. Conversation detail is immersive:

- global bottom nav hidden on `/messages/[conversationId]` mobile;
- compact conversation app bar with back, peer, and service context;
- message history takes the available viewport;
- the message composer respects safe area/keyboard;
- attachment action is integrated into the composer rather than displayed as a second browser-style upload row;
- block/report remain available through the contextual menu.

No conversation/realtime/moderation contract changes.

## Jobs

`/jobs` becomes a first-class mobile surface under Activity. Humanize job statuses instead of `replaceAll("_", " ")`.

Job detail should progressively present the lifecycle as:

1. Acuerdo
2. Pago
3. Coordinación
4. Trabajo
5. Finalización
6. Reseña

Only actions relevant to the current state should dominate. Technical IDs, raw payment tokens, reconciliation metadata, and backend status vocabulary should not be part of primary UI hierarchy.

## Provider onboarding

Keep the already implemented four-step route structure. Replace engineering-facing copy in Documents and Review with product copy:

- privacy and allowed formats;
- what the user needs to do;
- what happens next;
- whether the profile is pending review.

Do not describe server actions, arbitrary client code, Storage internals, or implementation safeguards to end users.

## Provider management

Convert `/provider/manage` from a mega-form presentation into a dashboard-style hub. The first viewport should summarize and link to manageable areas:

- public profile;
- services;
- availability;
- portfolio;
- experience/education/languages;
- service areas;
- Mercado Pago.

Where existing components cannot yet be safely split without backend risk, use disclosure sections as an interim presentation boundary rather than altering mutation contracts.

Mercado Pago UI shows user-relevant state (`Conectada`, `Requiere reconexión`, etc.) and action. Token expiration/reference details become secondary diagnostics or are omitted from the normal user-facing card.

## Account and settings

Keep the current Account hub architecture. Add a visible route to Activity/Jobs. Notification preferences and Push belong in Settings.

Avatar must eventually be a real upload interaction rather than a URL field; implement only if it can reuse existing safe upload infrastructure without schema/security changes. Otherwise remove unnecessary prominence from the raw URL field and leave upload as a separate follow-up.

## Empty/error states

Create one reusable visual pattern for:

- no search results;
- no services;
- no messages;
- no jobs;
- no favorites;
- no notifications.

Pattern: optional icon/mark, concise title, useful explanation, one primary action, optional secondary action. No giant decorative placeholders or inconsistent dashed panels unless context specifically benefits.

## PWA surfaces

Install prompt must not cover bottom navigation and should be dismissible without immediately reappearing. Push permission remains explicit-user-action only and lives under Settings.

## SEO / production configuration

Do not hard-code preview domains. Before a production launch, `getPublicSiteUrl()` must resolve the real Changas production origin so canonical/OpenGraph URLs are not localhost. This redesign does not invent the domain value.

## Accessibility and performance

- 48px minimum interactive targets on mobile.
- visible keyboard focus.
- `aria-current` for active nav.
- no color-only status communication.
- no horizontal scrolling at 320px CSS width.
- safe-area-aware fixed/sticky UI.
- reduced-motion respected.
- avoid a heavy third-party UI framework.
- prefer server components; client components only for interactive disclosure, composer/file state, and route-aware nav.

## Acceptance criteria

The redesign is successful when:

- authenticated navigation stays coherent across marketplace/public surfaces;
- `/jobs` is represented under Activity rather than incorrectly activating Home;
- chat detail has no bottom-nav/composer collision;
- Search mobile no longer displays every advanced filter by default;
- no raw provider/job/backend enums are shown in primary customer UI;
- onboarding no longer exposes engineering implementation copy;
- the product uses Plus Jakarta Sans consistently;
- existing Supabase/payment/security contracts remain untouched.
