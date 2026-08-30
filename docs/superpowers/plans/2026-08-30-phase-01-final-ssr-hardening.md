# Phase 01 Final SSR Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Supabase SSR session-refresh cache safety by forwarding the pinned `@supabase/ssr` `setAll` headers from the Proxy to its final `NextResponse`.

**Architecture:** Keep the existing cookie propagation and `getClaims()` call in `apps/web/src/lib/supabase/proxy.ts`. Extend only the Proxy cookie adapter so it accepts `headers: Record<string, string>` from `@supabase/ssr` and copies every entry after rebuilding the response. Keep `apps/web/src/lib/supabase/server.ts` unchanged because Server Components cannot always write response headers.

**Tech Stack:** Next.js 16.3.3, Next `NextRequest`/`NextResponse`, `@supabase/ssr` 0.12.5, Vitest 4.1.11, TypeScript 6.0.3, pnpm 11.19.0, Node.js 24 project target.

**Spec:** User request “Changas — Phase 01 Final SSR Hardening”, including the pinned dependency type contract and required local/remote validation gates.

## Global Constraints

- Work only on `codex/phase-01-accounts` and push only `origin/codex/phase-01-accounts`.
- Change only the Proxy SSR refresh/cookie response behavior; do not copy the behavior to `server.ts`.
- Keep `getClaims()` in the Proxy, keep `getUser()` where Server Actions need the current user, and do not use `getSession()` for authorization.
- Do not start Phase 02 or modify categories, skills, services, marketplace, search, chat, jobs, or payments.
- Do not claim CI or Supabase runtime PASS when the external runner or local Docker prerequisite is unavailable.

---

### Task 1: Verify the branch, installed contract, and current behavior

**Files:**

- Inspect: `apps/web/src/lib/supabase/proxy.ts`
- Inspect: `apps/web/src/lib/supabase/server.ts`
- Inspect: `apps/web/node_modules/@supabase/ssr/dist/main/types.d.ts`
- Inspect: `apps/web/package.json`

- [ ] **Step 1: Confirm branch and clean baseline**

Run:

```powershell
git status --short --branch
git log -1 --oneline
```

Expected: branch `codex/phase-01-accounts`, no unrelated working-tree changes, and the previously published Phase 01 audit-fix head.

- [ ] **Step 2: Verify the pinned `setAll` signature**

Inspect the installed declaration and confirm the relevant contract is:

```ts
export type SetAllCookies = (
  cookies: { name: string; value: string; options: CookieOptions }[],
  headers: Record<string, string>,
) => Promise<void> | void;
```

Also confirm the package version with:

```powershell
pnpm --filter @changas/web list @supabase/ssr --depth 0
```

- [ ] **Step 3: Preserve the Server Component boundary**

Confirm `apps/web/src/lib/supabase/server.ts` is not part of the implementation diff. Its cookie adapter remains responsible only for cookies because Server Components do not own the final `NextResponse` headers.

---

### Task 2: Add a failing Proxy contract test

**Files:**

- Modify: `apps/web/src/lib/supabase/proxy-contract.test.ts`
- Test: `apps/web/src/lib/supabase/proxy-contract.test.ts`

**Interface under test:** `updateSession(request: NextRequest): Promise<NextResponse>` must return a response carrying both the cookie and every header delivered by `setAll(cookiesToSet, headers)`.

- [ ] **Step 1: Capture the cookie adapter and simulate Supabase refresh**

Extend the test double so `createServerClient` saves its third argument, then have `getClaims` invoke the saved adapter with this hand-derived fixture:

```ts
const cookiesToSet = [
  {
    name: "sb-changas-auth-token",
    value: "refreshed-token",
    options: { httpOnly: true, path: "/" },
  },
];
const headers = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};
serverClientOptions.cookies.setAll(cookiesToSet, headers);
```

Keep the existing assertions that `getClaims()` is called once and `getUser()` is never called. Add assertions against the returned `NextResponse` for the cookie value and the three literal header values. Do not inspect source text.

- [ ] **Step 2: Run the focused test and verify the expected RED failure**

Run:

```powershell
pnpm test -- apps/web/src/lib/supabase/proxy-contract.test.ts
```

Expected: the test fails because the current Proxy ignores the second `setAll` argument, while the `getClaims()` and `getUser()` assertions still pass.

---

### Task 3: Implement the minimal Proxy header forwarding

**Files:**

- Modify: `apps/web/src/lib/supabase/proxy.ts`
- Do not modify: `apps/web/src/lib/supabase/server.ts`

- [ ] **Step 1: Add the typed headers parameter**

Change only the Proxy adapter from `setAll(cookiesToSet)` to `setAll(cookiesToSet, headers)`. Preserve the existing request-cookie writes, response reconstruction, and response-cookie options. Then copy the installed `Record<string, string>` entries:

```ts
Object.entries(headers).forEach(([key, value]) => {
  supabaseResponse.headers.set(key, value);
});
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run the same focused command. Expected: cookie forwarding, cache headers, `getClaims()`, and the absence of `getUser()` all pass.

- [ ] **Step 3: Review the diff for scope**

Run:

```powershell
git diff -- apps/web/src/lib/supabase/proxy.ts apps/web/src/lib/supabase/server.ts apps/web/src/lib/supabase/proxy-contract.test.ts
```

Expected: only `proxy.ts` and its contract test change; `server.ts` has no diff.

---

### Task 4: Run final gates, update the report, publish, and stop

**Files:**

- Modify: `docs/reports/phase-01-accounts.md`
- Modify: `docs/superpowers/plans/2026-08-30-phase-01-final-ssr-hardening.md`

- [ ] **Step 1: Run every requested local gate on the final candidate**

Run each command and record its actual exit status:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
git diff --check
```

All seven local gates must return exit code 0 before publishing. The existing report must continue to distinguish these static checks from Supabase runtime checks.

- [ ] **Step 2: Update the phase report**

Record the finding, the verified `@supabase/ssr@0.12.5` signature, the Proxy-only fix, the new cookie/header contract test, the resulting local gate statuses, the new commit hash, and the remote CI result. State any billing or runtime limitation without calling it PASS.

- [ ] **Step 3: Commit and push only the requested branch**

Use a focused commit and publish it:

```powershell
git add apps/web/src/lib/supabase/proxy.ts apps/web/src/lib/supabase/proxy-contract.test.ts docs/reports/phase-01-accounts.md docs/superpowers/plans/2026-08-30-phase-01-final-ssr-hardening.md
git commit -m "fix(auth): forward proxy refresh cache headers"
git push origin codex/phase-01-accounts
```

- [ ] **Step 4: Verify the new remote run and stop**

Find the CI run for the pushed HEAD with `gh run list`, wait for completion, and inspect job conclusions and annotations. If billing blocks the jobs again, record `FAIL`/`NOT STARTED` as appropriate and do not claim CI or Supabase runtime PASS. Do not merge and do not begin Phase 02.
