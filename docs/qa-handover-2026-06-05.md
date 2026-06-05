# QA Dashboard Handover

Updated: 2026-06-05

This document captures the current state of the QA-only dashboard migration, the latest auth/data changes, and the main blockers that still need follow-through.

## Summary

The dashboard auth/session path has now been moved to QA-only semantics:

- QA login/logout no longer calls live Supabase auth
- session shaping now uses QA claims plus QA `User/profile`
- auth source is now `qa` or `demo`, never `supabase`

However, the app is **not yet fully QA-only end to end**. Many legacy feature routes still reference the old local `createServiceClient()` helper, even though the helper is now only a stub and no longer a real source of truth.

## Latest Relevant Commits

- `204f472` `Make auth session QA-only`
- `07ff1e7` `Remove Supabase bridge from QA auth flow`
- `640e0ec` `Gracefully degrade unresolved QA consumer dashboards`
- `74c33f0` `Fix QA dashboard token refresh and consumer loading`
- `df0d1c2` `Require QA for CRM list routes`

## What Is Now QA-Only

### Auth/session

Files:

- [src/lib/server/auth-session.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/lib/server/auth-session.ts)
- [src/app/api/auth/session/route.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/app/api/auth/session/route.ts)
- [src/app/api/auth/qa/callback/route.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/app/api/auth/qa/callback/route.ts)
- [src/app/api/auth/logout/route.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/app/api/auth/logout/route.ts)
- [src/lib/auth/qa-auth.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/lib/auth/qa-auth.ts)

Behavior:

- QA sessions are built directly from QA cookies and QA claims
- `User/profile` is used to enrich the in-app profile
- the old local-profile provisioning bridge was removed from the auth path
- Supabase env vars are no longer used as QA auth fallback secrets

### Core QA read client

File:

- [src/lib/auth/qa-api.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/lib/auth/qa-api.ts)

Behavior:

- QA access token is read from QA cookies
- if a QA API call returns `401` and a `refresh_token` exists, the app retries once with a refreshed access token

## Direct QA Read Probes

These routes exist specifically to test authenticated QA reads without the rest of the dashboard getting in the way:

- [src/app/api/qa/debug/profile/route.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/app/api/qa/debug/profile/route.ts)
  - checks `GET /api/dashboard/v1/User/profile`
- [src/app/api/qa/debug/businesses/route.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/app/api/qa/debug/businesses/route.ts)
  - checks `GET /api/dashboard/v1/Business`
- [src/app/api/qa/debug/consumers/route.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/app/api/qa/debug/consumers/route.ts)
  - checks `GET /api/dashboard/v1/Consumer`

Each route returns:

- whether the read succeeded
- the current QA claims/session basics
- either a sample payload or the exact error

## What Was Verified Locally

- `npm run build` passes after the auth/session cleanup and QA debug probe additions
- `http://localhost:3000/login` recovered after restarting a broken `next dev` process
- unauthenticated `GET /api/auth/session` returns:

```json
{"authenticated":false,"source":null,"profile":null}
```

- unauthenticated access to `/api/qa/debug/profile` redirects back to login, which is correct

## Main Open Issues

### 1. QA session exists, but some dashboard pages still show no data

Most likely causes now:

- the page is hitting a QA endpoint that still returns `401`
- the page depends on a legacy local-only route instead of a true QA read
- the page resolves the wrong QA id for a business/consumer context

### 2. Businesses page still shows zero items for some QA sessions

Relevant files:

- [src/app/api/crm/businesses/route.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/app/api/crm/businesses/route.ts)
- [src/lib/server/qa-dashboard-businesses.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/lib/server/qa-dashboard-businesses.ts)

Current shape:

- route requires a QA session
- route reads from `GET /api/dashboard/v1/Business`
- if QA returns `401`, UI falls back to empty list plus warning

Next check:

- hit `/api/qa/debug/businesses` while logged in

### 3. Consumer/client dashboard can still fail to resolve the current QA consumer

Relevant file:

- [src/app/api/qa/me/consumer-dashboard/route.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/app/api/qa/me/consumer-dashboard/route.ts)

Current shape:

- verifies candidate ids using `GET /Consumer/{id}`
- falls back to email match from QA consumer list
- if summary fails, builds a fallback summary from other QA consumer endpoints
- if no QA consumer row can be resolved, returns a profile-based fallback instead of hard-failing

Next check:

- hit `/api/qa/debug/consumers` while logged in
- confirm the logged-in email exists in the QA consumer list

### 4. Large parts of the app still reference legacy local workflow/storage

This is the biggest remaining structural gap.

Examples still using `createServiceClient()`:

- support/join flows
- stakeholder codes
- business portal routes
- CRM business/cause execution/materials/media routes
- materials library/generation flows
- notifications
- admin invite/impersonate tooling
- QR redirect and capture flows

These are not all actively hitting real Supabase anymore, but they are still coded as if a local workflow store exists.

## Current Truth About Supabase

There is **no live Supabase source of truth** anymore.

What still exists:

- [src/lib/supabase/server.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/lib/supabase/server.ts)
- [src/lib/supabase/client.ts](C:/Users/kenne/Downloads/OnboardingLocalvip/src/lib/supabase/client.ts)

These are now stub helpers that return empty data or disabled auth/storage behavior. They should be treated as migration scaffolding only.

## Recommended Next Steps

### Immediate verification

1. Log in through QA.
2. Hit these routes in the same browser session:
   - `/api/qa/debug/profile`
   - `/api/qa/debug/businesses`
   - `/api/qa/debug/consumers`
3. Capture the returned JSON.

This will tell us:

- whether QA auth is really present in that browser
- whether `User/profile` works
- whether business list reads work
- whether consumer list reads work

### Highest-value cleanup after that

1. Convert CRM business detail/execution/materials routes to pure QA reads/writes wherever QA endpoints already exist.
2. Remove or isolate legacy `createServiceClient()` usage behind explicit migration boundaries.
3. Replace local-only QR/support/join/material flows with QA-backed equivalents, or mark them unavailable until QA support exists.
4. Continue shrinking the old local data model assumptions from `stakeholders`, `codes`, `admin tasks`, `materials`, and `notifications`.

## Notes For The Next Person

- Do not treat the old `Using synthetic fallback for QA user` warning as a login failure. That path was part of the removed local-profile bridge.
- If localhost starts throwing odd Next.js module errors like `Cannot find module './1682.js'`, restart the `next dev` server before debugging auth/data.
- Use the new QA debug routes first before debugging full pages. They isolate whether the problem is:
  - no QA session
  - QA `401`
  - wrong QA entity resolution
  - or a page-specific legacy dependency
