# Changas Admin Mobile + Provider Operations Design

## Context

The current admin UI is desktop-first: a wide header with nine horizontal pills, sparse page layouts, and no direct way to convert a normal user into a provider. The identity queue only shows providers whose `provider_profiles.status` is `IDENTITY_PENDING` or `UNDER_REVIEW`.

Production diagnosis on 2026-09-08 showed the recent admin user Alejandro Vera has a provider profile in `PROFILE_INCOMPLETE`, `onboarding_step = 4`, all private identity fields completed, but **zero `provider_documents`, zero Storage objects in `identity-documents`, and zero identity review history**. The documents step currently allows continuing to the review screen with no files, so reaching step 4 does not mean the identity was submitted. This explains why `/admin/identity` is empty.

## Goals

1. Make provider submission state truthful: a user cannot enter the admin identity queue until required identity documents are present and the user explicitly submits them.
2. Give admins two distinct provider controls:
   - **Invitar a completar perfil**: create/prepare `provider_profiles` in `PROFILE_INCOMPLETE` without bypassing verification.
   - **Activar manualmente**: deliberately bypass onboarding/identity review and set the provider to `ACTIVE`, with a required reason and immutable admin audit event.
3. Redesign the entire admin experience mobile-first, using the organizational strengths of `Smart-Intercom-SHOMER`: sticky compact header, pending work first, mobile cards, desktop tables only when useful, strong action hierarchy, clear empty states, and compact modal/sheet patterns.
4. Preserve Changas branding rather than copying Shomer colors.

## Provider submission model

Required identity documents for normal verification are:
- `DNI_FRONT`
- `DNI_BACK`
- `SELFIE`

Uploading a file only stores/replaces the document. It does not itself claim that the provider has submitted for review.

A new server-authoritative RPC `submit_provider_identity_review()` validates:
- authenticated user owns the provider profile;
- status is `PROFILE_INCOMPLETE` or `IDENTITY_PENDING`;
- public profile is complete;
- private identity profile is complete;
- all three required documents exist and their Storage objects exist.

If valid, it changes status to `IDENTITY_PENDING`, sets onboarding step 4, and returns successfully. The admin queue remains driven by `IDENTITY_PENDING`/`UNDER_REVIEW`.

## Admin provider controls

New admin RPCs:

### `admin_prepare_provider(target_user_id uuid)`
- requires admin;
- rejects null/nonexistent target;
- inserts `provider_profiles` with `PROFILE_INCOMPLETE`, step 1 when absent;
- leaves an existing provider untouched;
- writes `PROVIDER_ONBOARDING_PREPARED` to `admin_audit_events`.

### `admin_activate_provider(target_user_id uuid, requested_reason text)`
- requires admin;
- requires a meaningful reason;
- inserts provider profile if absent or updates it to `ACTIVE`, step 4;
- deliberately bypasses document/onboarding requirements;
- writes `PROVIDER_MANUALLY_ACTIVATED` to `admin_audit_events`, including prior status and reason.

No admin UI action silently grants provider access. Manual activation is visually marked as a bypass and requires confirmation/reason.

## Admin information architecture

### Mobile shell
- Dark operational canvas specific to admin: near-black navy surfaces.
- Changas orange `#FF6B35` is primary action/accent.
- Changas yellow `#FFC857` represents pending attention.
- Changas blue `#2563EB` represents informational/support actions.
- Changas strong pink `#D60060` is reserved for urgent counts/destructive attention.
- Sticky compact top app bar with Changas/Admin identity and link back to site.
- Bottom navigation for the four highest-frequency destinations: Resumen, Identidad, Usuarios, Más.
- `Más` exposes Prestadores, Catálogo, Reportes, Trabajos, Pagos and Auditoría in a mobile sheet/menu.
- Desktop retains the same hierarchy with a compact sidebar/rail instead of horizontal pills.

### Dashboard `/admin`
Operational dashboard, not a directory of links.
Priority order:
1. identity pending count;
2. open reports;
3. provider/account exceptions;
4. jobs/payments summaries;
5. quick links to lower-frequency areas.

### Users `/admin/users`
Mobile cards show name/email, role, provider status and contextual actions.
Provider actions:
- no provider profile -> `Invitar a completar perfil` + `Activar manualmente`;
- `PROFILE_INCOMPLETE` -> `Ver onboarding`/provider context + `Activar manualmente`;
- pending -> `Revisar identidad`;
- active -> status only plus existing restriction controls.

### Providers `/admin/providers`
Mobile provider cards replace compressed table-like layouts. Detail includes onboarding step, docs/services count, operational pause state, and contextual actions.

### Identity `/admin/identity`
Pending cases are the first content. Each card shows human-readable status, document completeness, date, and an obvious review action. Detail keeps signed/private document access and approve/reject controls.

### Other admin sections
Catalog, Reports, Jobs, Payments and Audit adopt the shared page header, dark surface cards, compact mobile rows/cards, human-readable badges and responsive desktop enhancements. Existing backend behavior remains unchanged except for the provider operations described above.

## Security

- All privileged provider mutations remain PostgreSQL-authoritative through `require_admin()`.
- Manual provider activation writes immutable audit history.
- Normal identity submission is owned-user only and verifies real document metadata + Storage object presence.
- No RLS weakening, no public document exposure, no service-role key in the browser.

## Testing

- SQL/runtime tests for `submit_provider_identity_review`, `admin_prepare_provider`, and `admin_activate_provider` including unauthorized and audit cases.
- Unit tests for admin navigation and human status presentation.
- Mobile E2E/admin regression at 320/360/390 widths: no horizontal overflow, bottom nav works, user provider actions are visible, identity cards are usable, tables do not leak into mobile layouts.
- Existing lint, typecheck, tests, Next build and `git diff --check` remain required.
- No GitHub Actions are used for implementation or verification; no Vercel deployment is triggered automatically.
