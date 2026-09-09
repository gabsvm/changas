# Changas Marketplace App-First Redesign

## Purpose

Transform the authenticated/public Changas experience from a polished web mockup into a mature mobile marketplace product. The target quality bar is the interaction density, hierarchy, consistency, and operational clarity associated with established apps such as Uber, PedidosYa, Rappi, and Airbnb, while preserving Changas' own brand identity and product semantics.

This is a presentation and interaction architecture redesign. Existing domain rules, Supabase security, payment contracts, provider verification contracts, image-compression pipeline, PWA behavior, and admin operations remain authoritative unless a UI surface needs to consume an already-existing capability.

## Product Direction

Use a **Marketplace app-first** visual model:

- less decoration, more usable content;
- mobile-first density without visual clutter;
- lists and rows for operational information;
- cards only when grouping materially improves comprehension;
- search and marketplace supply visible early;
- compact navigation and headers;
- subdued surfaces, almost no decorative shadows;
- orange as action/selection, not ambient decoration;
- gradients reserved for brand/logo/celebratory moments;
- typography and spacing optimized for repeated daily use, not a landing page.

## Brand Constraints

Preserve the existing Changas palette:

- Brand Orange: `#FF6B35`
- Brand Yellow: `#FFC857`
- Brand Pink: `#FF0A78`
- Accessible Pink: `#D60060`
- Functional Blue: `#2563EB`
- Canvas remains warm and near-white
- Ink remains dark neutral

Use Inter as the primary UI family with system fallbacks. The UI should generally use 400/500/600/700 weights. Avoid oversized ultra-bold display typography except for rare high-value moments.

## Global Visual System

### Density

Target mobile dimensions:

- screen headings: 26-32 px;
- body: 15-17 px;
- labels/meta: 12-14 px;
- buttons: 48-52 px high;
- standard rows: 56-84 px depending on content;
- standard card radius: 12-16 px;
- input radius: 10-14 px;
- vertical section spacing: 16-24 px;
- mobile horizontal page padding: 16 px, 20 px only where composition requires it.

### Surfaces

- Prefer page surface + separators over nested cards.
- Avoid large rounded containers around forms.
- Avoid repetitive shadows.
- Use border/divider contrast in the 6-10% range where possible.
- Elevation is reserved for sticky navigation, bottom sheets, dialogs, menus, and exceptional CTA surfaces.

### Interaction States

All interactive controls require visible states:

- pressed: subtle `scale(.98)` or equivalent tactile feedback;
- hover only for pointer devices;
- disabled state with preserved readability;
- skeletons for asynchronous data;
- inline success/error feedback close to the action;
- `prefers-reduced-motion` respected;
- transitions generally 150-200 ms.

## Shared UI Kit

The redesign must centralize reusable components instead of repeating large Tailwind class strings across screens.

Required shared primitives:

- `AppHeader`
- `SearchField`
- `BottomNavigation`
- `SectionHeader`
- `ListRow`
- `Avatar`
- `ServiceCard`
- `ProviderCard`
- `StatusChip`
- `SettingsRow`
- `Switch`
- `EmptyState`
- `InlineNotice`
- `BottomSheet`
- `PrimaryButton`
- `SecondaryButton`
- `IconButton`
- `FormField`
- `TextareaField`
- `Skeleton`
- `Toast`

Components should expose semantic props rather than styling implementation details where practical.

## Navigation

Keep the authenticated mobile information architecture:

- Inicio
- Mensajes
- Actividad
- Cuenta

Redesign the bottom navigation:

- approximately 64 px content height plus safe area;
- 22-24 px icons;
- 11-12 px labels;
- no large rounded active background tile;
- active state uses orange icon/text and a small, subtle marker;
- thin top divider or understated elevation;
- unread badges remain compact and accessible;
- preserve `aria-current="page"`.

Desktop may use a wider header/navigation appropriate to the viewport, but mobile is the source of truth for composition.

## Home / Discovery

The home screen must behave like a marketplace rather than a marketing landing page.

### Remove or demote on authenticated mobile

- oversized marketing kicker;
- oversized hero headline;
- explanatory marketing paragraph above primary marketplace actions;
- giant card wrapping the search form;
- floating text links for remote/provider actions;
- oversized category cards;
- marketing footer copy inside the app experience.

### New hierarchy

1. compact app header with Changas identity and account/avatar affordance;
2. contextual heading such as `¿Qué necesitás hoy?`;
3. primary search field immediately visible;
4. location/current mode affordance;
5. compact category shortcuts;
6. real marketplace content:
   - nearby/recommended services;
   - providers or published services;
   - remote discovery when applicable;
7. compact section headers with `Ver todo`/arrow affordances.

If there is no marketplace supply, render an honest empty state instead of leaving large unexplained blank space.

## Search and Category Results

Search/category screens must prioritize comparison:

- compact sticky/return header as appropriate;
- query and location controls remain accessible;
- filters use chips or a bottom sheet rather than a large form block;
- results use reusable service/provider cards optimized for scanning;
- cards display only real available information;
- no invented ratings, availability, or pricing;
- empty/loading/error states use the shared system.

## Service and Provider Detail

Detail pages should resemble a mature marketplace transaction surface:

- strong identity/hero information at top;
- essential trust/context information visible without excessive cards;
- service description and provider context in readable sections;
- contextual sticky CTA when a primary action exists;
- do not create visual claims for trust attributes that backend data does not support;
- portfolio imagery uses the existing compressed image pipeline and responsive display.

## Messages

### Empty state

Remove the giant card container. Use a compact centered empty state with one primary CTA.

### Populated state

Conversation list rows should expose:

- avatar;
- participant/provider name;
- service context;
- last message preview;
- timestamp;
- unread count when present.

Rows should be approximately 72-84 px and separated by whitespace/dividers, not separate oversized cards.

Conversation detail should preserve existing messaging semantics and attachment privacy while adopting the new UI kit.

## Activity / Notifications

Replace explanatory, card-heavy presentation with an activity feed.

### Empty

Use a compact `Todo al día` state.

### Populated

Group notifications by useful temporal sections when data allows, for example `Hoy`, `Ayer`, `Anteriores`.

Each activity item should expose:

- semantic icon/status;
- concise title;
- supporting context;
- timestamp;
- unread/read state;
- deep link when one exists.

Avoid redundant prose explaining what notifications are.

## Notification Preferences

Replace card-per-setting + checkbox + explicit save button with a native settings-list model.

Rows:

- Push
- Correos importantes
- Recordatorios de trabajos
- Propuestas
- Verificación
- Promociones

Use accessible switches. Persist changes immediately when the existing backend contract permits it; provide local pending/error feedback. If an existing endpoint only supports batch persistence, preserve correctness while making the UI behave as close to immediate persistence as safely possible.

## Account Home

Use a compact identity header:

- avatar;
- display name;
- email;
- account/profile affordance.

Provider verification/progress should appear as one purposeful progress surface rather than a large decorative hero.

Group settings into sections such as:

### Cuenta
- Perfil público
- Identidad y seguridad
- Guardados
- Notificaciones

### Proveedor
- onboarding/progress or provider management entry;
- services;
- availability where implemented;
- payments where implemented.

### Support / Session
- help/support only if currently implemented;
- sign out as a plain destructive/text action, not a dominant CTA.

Do not show unavailable product areas merely to make the screen look complete.

## Profile Public Editing

Remove `Foto de perfil por URL` from the user-facing product.

Replace with direct media selection:

1. user taps avatar/change-photo;
2. chooses supported image from device/camera where browser capabilities permit;
3. image is routed through the existing common client-side compression pipeline;
4. target stored image is approximately 100 KiB with quality-preserving logic and maximum long edge consistent with the media pipeline;
5. upload remains private/public according to the existing profile image contract;
6. UI shows immediate preview and final persisted state;
7. never require the user to type or understand a storage URL.

Form layout should live directly on the page surface on mobile. Use clear labels, compact supporting copy, and sticky save action only when needed.

## Forms

All account/provider forms should adopt common form primitives:

- label above control;
- helper/error text directly below;
- 48+ px controls;
- minimal card nesting;
- keyboard-safe mobile composition;
- semantic input types and autocomplete attributes where applicable;
- sticky action bar only for long forms;
- success feedback should not require scanning the top of the page.

## Provider Onboarding

Preserve current provider state machine and server-authoritative identity submission behavior.

Redesign presentation to:

- compact step header/progress;
- one task per screen;
- clear next action;
- remove raw enums from user-facing UI;
- direct photo/document upload UX;
- existing ~100 KiB image compression remains active;
- PDF remains an allowed non-image where current contracts support it;
- submission to review occurs only through the current explicit server-authoritative review action.

## Jobs / Marketplace Workflow

Jobs/proposals/work screens should use the same list/detail primitives:

- status is a `StatusChip`;
- primary actions are contextual, not repeated as giant full-width blocks unless the action is truly primary;
- chronological or state progression should be visually scannable;
- payment/proposal status copy remains derived from real domain state.

## Payments

Do not alter payment contracts. Redesign only presentation:

- compact state/status presentation;
- clear amounts and counterparty/service context;
- important warnings near action;
- no decorative card stacking;
- use bottom sheets/dialogs for confirmations on mobile.

## PWA / Mobile Behavior

The redesign must remain compatible with browser and installed-PWA contexts.

Required:

- safe-area handling;
- no horizontal overflow at 320, 360, or 390 px;
- bottom navigation never covers actionable content;
- sticky actions account for nav/safe-area height;
- keyboard-visible form states remain usable;
- touch targets at least 44x44, preferably 48x48 for primary controls.

## Accessibility

Required:

- WCAG-compatible contrast for text and controls;
- visible focus states;
- semantic labels for icon-only controls;
- `aria-current` for current navigation;
- switches announce checked state correctly;
- reduced-motion support;
- empty/error/loading states announced appropriately when dynamic.

## Error and Loading UX

The generic app error boundary remains a fallback, not a normal product path.

For normal recoverable failures:

- show inline error near the failed operation;
- preserve user-entered form values where possible;
- use retry actions for recoverable reads/uploads;
- use skeletons for primary loading states instead of blank canvas;
- authentication expiry should redirect through existing auth handling rather than present a generic crash screen.

## Technical Boundaries

Do not casually modify:

- Supabase schema/migrations;
- RLS policies;
- provider lifecycle semantics;
- identity review semantics;
- payment contracts;
- admin permission model;
- storage privacy contracts.

If a visual requirement appears to need backend work, first prove the required data/capability does not already exist. Any genuinely necessary backend change must be separately scoped and tested.

## Admin

The recently redesigned Admin is a separate operational surface and is not part of this consumer marketplace visual rewrite. Shared low-level primitives may be reused only where they do not degrade the dark admin system.

## Testing Strategy

### Unit/component tests

Cover shared navigation/state helpers and UI logic where behavior is non-trivial.

### E2E mobile

At minimum verify 320, 360, and 390 px for:

- Home/discovery
- Search/results
- Messages empty and populated fixture where available
- Activity/preferences
- Account home
- Profile editing including image upload/compression
- Provider onboarding critical path

Assertions include:

- no horizontal overflow;
- bottom nav current state;
- minimum usable touch targets;
- no giant legacy active nav tile;
- profile photo does not expose URL input;
- notification preferences use switches;
- image upload stores the optimized image rather than original multi-megabyte input;
- auth/session redirects remain intact.

### Regression

Run:

- lint;
- typecheck;
- unit tests;
- Next production build;
- directed Prettier on changed files;
- `git diff --check`;
- relevant pgTAP only if no backend migration is introduced;
- affected Playwright suites.

Global Prettier baseline debt is not a reason to reformat unrelated files.

## Rollout Constraints

- Work on a single feature branch for the entire redesign.
- Do not create one branch per phase.
- Do not use GitHub Actions as an implementation or verification mechanism.
- Do not inspect workflow runs/jobs/logs/artifacts.
- Do not deploy Vercel until the full redesign is locally verified and explicitly approved for production.
- Keep Vercel automatic Git deployments disabled.
- Do not apply backend production changes as part of this visual redesign unless separately approved.

## Acceptance Criteria

The redesign is complete when:

1. authenticated mobile surfaces no longer read visually as a landing/mockup;
2. navigation, type, density, spacing, cards, forms, empty states, and settings share one coherent design system;
3. Home exposes marketplace discovery before marketing prose;
4. Messages uses compact rows and a lightweight empty state;
5. Activity behaves like a feed and notification preferences use switches;
6. Account is organized as grouped settings rather than large decorative cards;
7. public profile photo is selected/uploaded directly, never entered as a URL;
8. provider onboarding preserves all current verification/security contracts;
9. key flows work at 320/360/390 px with no horizontal overflow;
10. accessibility and reduced-motion requirements are met;
11. existing media compression, Supabase privacy, auth, payments, provider states, and admin behavior remain intact;
12. local lint, typecheck, tests, production build, directed formatting, diff check, and affected E2E suites pass before merge/deploy.
