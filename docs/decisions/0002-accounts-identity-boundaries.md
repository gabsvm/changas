# ADR 0002: Account and provider identity boundaries

## Status

Accepted for Phase 01.

## Decision

Keep public profile data, private identity data, provider onboarding state, and identity document metadata in separate tables. Enforce owner access with PostgreSQL RLS and keep the identity-document Storage bucket private with a first-folder UUID policy.

Authentication uses Supabase Auth with the cookie-aware browser/server clients. Next.js `proxy.ts` refreshes claims with `auth.getClaims()`. Mutations use server actions that resolve the authenticated user again with `auth.getUser()` and never accept a user ID or provider status as authority from a form.

Provider owners can create and update only `PROFILE_INCOMPLETE` or `IDENTITY_PENDING`. States such as `UNDER_REVIEW` and `ACTIVE` are reserved for a later administrative workflow.

## Consequences

- A future public search projection must be explicit and cannot read `profile_private` by accident.
- Replacing a document keeps one metadata row per user/document type and removes the previous private object after the new metadata and provider transition succeed.
- Local runtime verification requires Docker or Podman because the repository includes pgTAP and Storage policy checks that cannot be proven by TypeScript or build checks.
- Google OAuth is an optional integration point controlled by `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`; email/password remains the baseline flow.
