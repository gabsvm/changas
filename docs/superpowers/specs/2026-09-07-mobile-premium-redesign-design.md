# Changas — Mobile Premium Redesign Design

**Status:** Approved product direction, written spec pending final user review  
**Date:** 2026-09-07  
**Branch:** `codex/mobile-premium-redesign`  
**Base branch:** `codex/phase-11-payments`  
**Base SHA:** `8d3c409c1fc4c9cf9c4a836c73f110f501403ec7`  
**Scope:** Mobile-first UI/UX architecture for Account, provider onboarding, identity documents, and authenticated navigation

## 1. Goal

Raise the authenticated mobile experience from a functional responsive web UI to a deliberate, premium, mobile-first product experience while preserving the marketplace contracts, Supabase schema, RLS, payment architecture, provider lifecycle, and existing business behavior.

The redesign must make it immediately clear:

- where the user is;
- what the primary action is;
- what information is public versus private;
- what onboarding step is active;
- what remains to be completed;
- what has been saved or uploaded;
- how to return to the rest of the product with one hand.

This work directly reinforces the locked V1 requirement in `CHANGAS_MASTER_PLAN.md` that the app feel excellent on low/mid-range Android phones and **not** feel like a desktop SaaS dashboard squeezed onto mobile.

## 2. Existing baseline and problems to solve

### 2.1 Authenticated navigation

Current implementation: `apps/web/src/app/(account)/layout.tsx`.

The account shell uses a desktop-style header with `flex-wrap` navigation links for Messages, Notifications, Account, Settings, and Favorites. On a narrow viewport this wraps unpredictably and creates a visually unstable header. It also consumes high-value top-screen space and places primary navigation outside the natural thumb zone.

### 2.2 Account/settings architecture

Current implementation:

- `apps/web/src/app/(account)/account/page.tsx`
- `apps/web/src/app/(account)/account/settings/page.tsx`
- `apps/web/src/components/account/account-form.tsx`

`/account` is already a useful summary page, but `/account/settings` mixes public profile data and sensitive private identity data in one long form. This creates a weak information hierarchy and makes "Configuración" function as both settings and identity editing.

### 2.3 Provider onboarding

Current implementation:

- `apps/web/src/app/(provider)/provider/onboarding/page.tsx`
- `apps/web/src/components/provider/onboarding-form.tsx`

The current onboarding page combines:

- a large editorial heading;
- raw provider status such as `PROFILE_INCOMPLETE`;
- a four-step overview;
- an independent "advance step" button;
- document upload;
- document history.

This produces scroll, cognitive overload, and a weak relationship between the visible step and the actual form/task the user should perform.

### 2.4 Identity file upload

`IdentityDocumentForm` currently exposes the browser's native `<input type="file">`. On Android/Chrome this renders as an unstyled browser control (for example `Choose File / No file chosen`), which visually breaks the product language and provides insufficient upload feedback.

### 2.5 Current visual system

`apps/web/src/app/globals.css` already defines the correct foundation:

- canvas `#f5f1e9`;
- ink `#163832`;
- moss `#285943`;
- terracotta `#b86145`;
- serif display typography;
- simple primary/secondary buttons.

The redesign should preserve this identity while systematizing it. The goal is refinement, not a rebrand.

## 3. Non-goals

This redesign does **not**:

- change Supabase tables, migrations, RLS, grants, Storage policies, or RPC contracts;
- alter provider lifecycle/status semantics;
- auto-approve providers;
- expose private identity data publicly;
- change payment logic or Mercado Pago integration;
- start Phase 12;
- change public marketplace discovery behavior;
- introduce a large third-party component framework unless implementation proves it necessary;
- convert the project to React Native;
- add speculative onboarding fields not already supported by the existing backend.

If a future design needs new persisted fields, that must be proposed separately rather than hidden inside this UI work.

## 4. Product design principles

### 4.1 One primary task per screen

A mobile screen should have one dominant objective. Supporting information can exist, but it must not compete with the primary action.

### 4.2 Thumb-first navigation

Primary authenticated destinations move to a bottom navigation pattern on mobile. Top bars become contextual: back, title, optional status/action.

### 4.3 Human language over backend language

Never surface raw enum names such as `PROFILE_INCOMPLETE` as primary UI copy. Map them to user-facing labels such as `Perfil incompleto`, `En revisión`, or `Activo` while preserving backend values internally.

### 4.4 Progress should be actionable

A stepper is not decoration. Every step communicates status, purpose, and what the user can do next.

### 4.5 Sensitive actions need confidence

Private identity and document upload surfaces require explicit privacy cues, deterministic state feedback, and clear completion signals.

### 4.6 Premium through precision

Premium means consistent spacing, typography, interaction states, copy, and hierarchy. Avoid excessive gradients, glass effects, animation, giant headings, decorative noise, or generic SaaS dashboard styling.

## 5. Navigation architecture

### 5.1 Mobile authenticated bottom navigation

Use four primary items:

1. **Inicio** — `/`
2. **Mensajes** — `/messages`
3. **Actividad** — `/account/notifications`
4. **Cuenta** — `/account`

`Guardados` and `Configuración` move inside the Account hub instead of consuming primary navigation slots.

Requirements:

- visible on authenticated primary/root screens at mobile widths;
- fixed/sticky to the viewport bottom with safe-area handling;
- minimum 48 px touch target per item;
- active route state is visually obvious;
- unread notifications may show a compact badge on Activity;
- desktop may retain a top-navigation treatment, but must not reuse the wrapping mobile layout.

### 5.2 Contextual top app bar

Detail/edit flows use a compact top bar:

- back button;
- concise page title;
- optional trailing status/action;
- 56 px target height before safe-area inset.

Provider onboarding hides the global bottom nav while the user is inside a focused step and restores it when returning to Account.

## 6. Account information architecture

### 6.1 `/account` becomes the definitive account hub

The current account summary is retained conceptually but redesigned as a mobile-first hub.

Top section:

- compact identity row with display name;
- access email as secondary text;
- provider status if present.

Primary provider-progress card:

- human status label;
- completion/progress indicator;
- concise consequence text;
- primary CTA: `Continuar verificación` or `Gestionar servicios` when ACTIVE.

Account destinations:

- Mi perfil público;
- Identidad y verificación;
- Guardados;
- Notificaciones;
- Configuración;
- Cerrar sesión.

The account page should not expose a long editable form.

### 6.2 Separate public and private editing

Replace the current monolithic `/account/settings` information architecture with dedicated tasks.

Recommended routes:

- `/account/profile` — public profile data supported today: display name, public zone, bio, avatar URL/photo handling if retained;
- `/account/identity` — private legal name, phone, birth date, DNI, exact address;
- `/account/settings` — actual app/account preferences, notification entry point, sign-out, and future non-profile settings.

Server actions may remain shared initially if doing so avoids unnecessary backend changes, but UI responsibilities should be separated.

## 7. Provider onboarding architecture

### 7.1 `/provider/onboarding` becomes overview/progress

This route is a progress hub, not a page containing every onboarding control.

Header:

- back to Account;
- title `Verificación`;
- mapped status badge.

Hero/progress block:

- human status (`Perfil incompleto`, etc.);
- `X de 4 pasos completos` or equivalent;
- progress bar;
- one primary CTA to the next actionable step.

Step list:

1. Datos básicos
2. Identidad privada
3. Documentos
4. Revisión

Each step contains:

- number or check icon;
- title;
- one-line explanation;
- state: completo / en curso / pendiente / bloqueado;
- action affordance when accessible.

### 7.2 Dedicated step routes

Recommended child routes:

- `/provider/onboarding/profile`
- `/provider/onboarding/identity`
- `/provider/onboarding/documents`
- `/provider/onboarding/review`

These routes can reuse the same persisted data/actions that already exist. The route split is a presentation/navigation change, not a schema change.

### 7.3 Step progression semantics

Do not allow the UI to advance onboarding solely because the user tapped a generic "next step" button.

The UI should tie continuation to the actual step task:

- profile step saves the supported public/basic data;
- identity step saves supported private identity data;
- documents step confirms required upload state according to current product rules;
- review step summarizes completion and invokes only the existing supported state transition/action.

If the current backend action only increments `onboarding_step` without field-completion validation, implementation should preserve server behavior but make the UI progression explicit and testable. Any deeper business-rule hardening must be proposed separately rather than silently introduced.

## 8. Screen specifications

### 8.1 Account hub

Mobile structure:

1. top app bar / account identity;
2. provider progress card when provider record exists;
3. "Tu cuenta" navigation list;
4. optional public-profile preview summary;
5. sign-out as low-emphasis destructive/text action.

Provider card states:

- no provider profile: `¿Querés ofrecer tus servicios?` + `Empezar`;
- incomplete: progress + `Continuar verificación`;
- pending/manual review: status + explanatory text, no misleading CTA;
- active: `Gestionar servicios`.

### 8.2 Public profile editor

Content:

- `Nombre visible`;
- `Zona aproximada`;
- `Bio`;
- current avatar/photo field if retained.

UI behavior:

- compact intro: `Así te van a ver`;
- field helper text;
- bio character counter;
- client-side immediate validation where useful plus existing server validation;
- bottom sticky save CTA on mobile;
- success/error state near CTA and relevant field where possible.

### 8.3 Private identity editor

Content only from fields already supported by `profile_private` and current action contract:

- legal name;
- private phone;
- date of birth;
- DNI number;
- exact address.

Privacy notice:

- shield/lock icon;
- `Estos datos son privados y se usan para tu identidad y revisión.`

Do not imply automated verification if the product still uses manual review.

### 8.4 Documents step

Replace visible native file control with a custom upload surface backed by an accessible hidden file input.

Default state:

- document type selector;
- upload panel;
- accepted types and size;
- `Tomar foto` where browser/device capabilities allow a camera-oriented file input;
- `Elegir archivo`.

Selected state:

- filename;
- detected type;
- file size;
- image thumbnail when safe/practical;
- `Cambiar` and `Quitar` before submission.

Uploading state:

- CTA disabled;
- progress/working state without layout shift;
- `Subiendo…`;
- prevent duplicate submission.

Success state:

- explicit `Documento recibido` confirmation;
- newly uploaded document reflected in the list;
- next document type suggested where useful.

Error state:

- user-facing reason for invalid type/size/server failure;
- selected file remains recoverable when practical.

Document history:

- compact rows/cards;
- human labels (`DNI frente`, `DNI dorso`, `Selfie de validación`);
- received date;
- no object path or storage internals.

### 8.5 Review step

Summary cards/checklist:

- public/basic profile;
- private identity;
- documents;
- current provider status.

The review screen should explain what is complete and what still blocks submission. It must not claim success or manual approval before the backend state supports it.

Primary CTA must correspond to the existing allowed transition for this phase.

## 9. Lightweight design system

### 9.1 Preserve brand foundation

Keep:

- canvas `#F5F1E9`;
- ink `#163832`;
- moss `#285943`;
- terracotta `#B86145`.

Add semantic tokens instead of hard-coding variants repeatedly.

Suggested tokens:

- `--color-surface: #FFFCF7`;
- `--color-surface-muted: #F0ECE4`;
- `--color-border: rgb(22 56 50 / 12%)`;
- `--color-text-muted: rgb(22 56 50 / 62%)`;
- `--color-success: #3F7556`;
- `--color-warning: #A56B2A`;
- `--color-danger: #A94F43`.

Exact final values may be adjusted for WCAG contrast during implementation.

### 9.2 Typography

Retain serif display + sans UI, but constrain usage.

Mobile scale:

- display hero: 36/40 max for rare marketing-like moments;
- page title: 30/36;
- section title: 22/28;
- list/card title: 16/22;
- body: 16/24;
- supporting body: 14/20;
- caption: 12/16.

Do not use `text-5xl` as the default authenticated page heading on mobile.

### 9.3 Spacing

Use a 4/8-based rhythm.

Core values:

- screen horizontal padding: 20 px;
- section gap: 24–32 px;
- card padding: 20 px;
- field gap: 16 px;
- label-to-control: 8 px;
- helper gap: 6 px;
- minimum tap target: 48 px.

### 9.4 Shape/elevation

- input radius: 14 px;
- card radius: 18–20 px;
- button radius: 14–16 px or controlled pill where appropriate;
- status chip: full pill;
- shadows: very subtle; prefer border + tonal surface over heavy floating cards.

### 9.5 Buttons

Primary:

- 52 px mobile height;
- full width for flow CTAs;
- dark ink/moss surface with white text;
- disabled/loading states explicit.

Secondary:

- tonal or bordered;
- never visually compete with the one primary action.

Remove hover-only movement as a core affordance on mobile. Hover effects may remain for pointer devices but cannot be required to communicate interactivity.

## 10. Reusable component boundaries

Create small UI primitives rather than letting pages repeat Tailwind strings.

Recommended components:

- `MobileAppBar`
- `AuthenticatedBottomNav`
- `AccountMenuItem`
- `StatusBadge`
- `ProgressBar`
- `OnboardingStepCard`
- `FormField`
- `FieldMessage`
- `StickyActionBar`
- `PrivacyNotice`
- `DocumentUploader`
- `DocumentListItem`
- `InlineFeedback` / toast pattern

Avoid introducing a generic mega-component that owns routing, data loading, and visual rendering simultaneously.

## 11. Data flow and server/client boundaries

Preserve the current server-first architecture.

- pages/server components load Supabase data;
- client components own form interaction, selected-file state, character counters, temporary previews, and pending feedback;
- server actions remain authoritative for mutations;
- no private data is placed in URL query strings or client-global state;
- Storage upload continues through the existing secure action/bucket flow;
- raw provider status values are mapped to presentation labels at the UI boundary.

No migration is required for this redesign.

## 12. Accessibility and one-hand usability

Required:

- visible focus states;
- semantic labels for all fields;
- status updates through `aria-live` where asynchronous;
- bottom nav active state exposed accessibly;
- file uploader usable without drag-and-drop;
- no color-only status communication;
- minimum 48 px touch targets;
- sticky CTA must respect `env(safe-area-inset-bottom)`;
- content must remain usable at 320 px CSS width;
- page must not require horizontal scrolling at 200% zoom equivalent;
- reduced-motion users should not depend on motion to understand state.

## 13. Responsive behavior

### Mobile: `< 640 px`

This is the primary design target.

- bottom navigation;
- single-column forms;
- compact app bars;
- sticky action footer;
- no large editorial account headers;
- cards/list rows optimized for thumb interaction.

### Tablet / desktop: `>= 640 px`

- layouts may expand to 2 columns where information remains logically related;
- sticky mobile action bar can become normal inline actions;
- desktop account navigation may use top/side navigation;
- do not simply stretch the mobile cards to `max-w-6xl` without hierarchy.

## 14. Microinteractions

Use restrained transitions, 120–200 ms where useful:

- active bottom-nav indicator;
- progress change;
- success feedback;
- uploader selected/success state;
- sticky action elevation while content scrolls beneath it.

Do not add decorative animation to headings/cards.

## 15. Error, loading, empty, and read-only states

Every redesigned flow must explicitly support:

### Loading

- preserve layout dimensions;
- button-level pending state for mutations;
- use skeletons only where server navigation meaningfully waits.

### Success

- clear saved/uploaded confirmation;
- no ambiguous success text disconnected from the action.

### Error

- human-readable message;
- inline near the affected action/field;
- retain entered form values whenever the existing action architecture allows it.

### Empty

- explain what the user can do next;
- document history should not end at `Todavía no subiste documentos` without a clear upload affordance already visible.

### Read-only review

When provider status makes the step non-editable:

- controls should not merely become silently disabled;
- show why editing is unavailable and what happens next.

## 16. Technical files likely affected

Existing files expected to change:

- `apps/web/src/app/globals.css`
- `apps/web/src/app/(account)/layout.tsx`
- `apps/web/src/app/(account)/account/page.tsx`
- `apps/web/src/app/(account)/account/settings/page.tsx`
- `apps/web/src/components/account/account-form.tsx`
- `apps/web/src/app/(provider)/provider/onboarding/page.tsx`
- `apps/web/src/components/provider/onboarding-form.tsx`

Likely new routes/components:

- `apps/web/src/app/(account)/account/profile/page.tsx`
- `apps/web/src/app/(account)/account/identity/page.tsx`
- onboarding step pages under `apps/web/src/app/(provider)/provider/onboarding/*`
- shared navigation/form/progress/upload components under `apps/web/src/components/`

Existing server actions should be reused or split only when necessary for clearer responsibility. Do not add database schema solely to support visual state.

## 17. Test strategy

### Unit/component-contract tests

Add tests for pure presentation/domain mapping logic where appropriate:

- provider status -> human UI status;
- onboarding step metadata/state derivation;
- active navigation route derivation;
- document type -> human label;
- file validation helpers if moved client-side.

### Existing server tests

All current domain/server/payment/security tests must remain green. UI work must not weaken existing server-side validation.

### Browser/E2E tests

At minimum validate mobile viewport flows:

1. authenticated account hub renders without nav wrapping;
2. bottom nav reaches Messages / Activity / Account;
3. public profile edit can save and return;
4. private identity edit can save and return;
5. provider onboarding overview identifies current step correctly;
6. documents step selects a valid synthetic fixture and uploads once;
7. success/error/read-only document states are visible;
8. no horizontal overflow at 320/360/390 px widths;
9. sticky action bar does not cover final content or Android safe area.

Use existing synthetic identity fixture where compatible; never use real identity data in tests.

## 18. Performance constraints

The redesign must not regress the mobile-first baseline.

- avoid a UI framework dependency solely for icons/cards;
- prefer CSS/Tailwind and lightweight SVG icons;
- keep server components server-side;
- client boundaries should be limited to components that truly need interaction;
- no large animation library;
- image previews must use object URLs and release them appropriately;
- bottom navigation must not trigger unnecessary client-wide rerenders.

Run the existing mobile performance check and normal build/type/lint gates.

## 19. Acceptance criteria for the finished redesign

The redesign is accepted when all of the following are true:

1. At 360–390 px widths, authenticated navigation no longer wraps into multiple text rows.
2. Primary authenticated destinations are reachable from a thumb-friendly mobile bottom navigation.
3. Account is a hub; editing public and private identity data is no longer presented as one undifferentiated long settings form.
4. Raw provider status enum names are not exposed as primary user-facing copy.
5. Provider onboarding overview communicates current progress and one clear next action.
6. Onboarding tasks are separated into focused step screens or equivalently isolated views.
7. Identity upload no longer exposes the browser-native file input as the visible primary control.
8. Upload selection, pending, success, failure, empty, and read-only states are explicitly designed and implemented.
9. Primary flow CTAs are reachable at the bottom of the viewport without forcing users to scroll back to find them.
10. Existing backend contracts, RLS, Storage rules, payments, and provider lifecycle semantics remain unchanged unless separately approved.
11. Existing tests remain green and new mobile UX tests cover the primary account/onboarding flow.
12. No horizontal overflow exists at 320 px CSS width.
13. Focus, labels, status announcements, and touch targets meet the accessibility requirements in this spec.
14. The result preserves Changas's warm editorial identity while reading as a coherent product UI rather than a desktop layout compressed onto mobile.

## 20. Scope boundary for implementation planning

The implementation plan should decompose this redesign into independently verifiable increments, approximately:

- navigation shell + mobile design tokens;
- Account hub information architecture;
- public/private profile form split;
- onboarding overview and status mapping;
- dedicated onboarding step routing;
- premium document uploader and document states;
- accessibility/responsive polish;
- Playwright/mobile regression coverage.

Do not combine unrelated backend hardening, Security Advisor remediation, Vercel environment repair, or Phase 12 launch work into this UI branch.
