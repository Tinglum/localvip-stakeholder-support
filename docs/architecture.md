# Architecture

## Overview

The LocalVIP Stakeholder Support System is an internal operations platform that manages stakeholder onboarding, contact tracking, outreach coordination, QR code campaigns, and materials distribution. It serves multiple user roles across two brands (LocalVIP and HATO) and is designed to be the single source of truth for all stakeholder and contact data.

---

## Stack Choices and Rationale

### Next.js 14 (App Router)

The App Router provides server components by default, which matters for an ops platform where most pages are data-heavy tables and dashboards. Server components fetch data without shipping JavaScript to the client, reducing bundle size and eliminating loading spinners for initial page loads. The file-system routing also maps cleanly to the platform's resource-oriented URL structure (`/businesses`, `/causes`, `/contacts`, etc.).

Layouts and route groups handle the two major sections of the app -- the unauthenticated auth pages and the authenticated dashboard -- with shared layout shells that persist across navigation.

### TypeScript (Strict Mode)

The data model has many entity types with precise relationships (stakeholder assignments, role-based access, polymorphic tags). Strict TypeScript catches shape mismatches at build time rather than at runtime in production. The Supabase CLI generates database types directly from the schema, so the types in code stay synchronized with the actual Postgres tables.

### Tailwind CSS + Radix UI Primitives

Tailwind provides utility-first styling with an extended design token system. The `tailwind.config.ts` defines brand color palettes (`brand-*` for LocalVIP, `hato-*` for HATO), semantic status colors (`success`, `warning`, `danger`), a neutral `surface` palette, and custom typography scales.

Radix UI primitives (Dialog, DropdownMenu, Select, Tabs, Tooltip, etc.) provide accessible, unstyled headless components. These are wrapped with Tailwind classes in `src/components/ui/` to create a shadcn/ui-style component library that is fully owned by the project -- no external component library dependency that could break on upgrade.

`class-variance-authority` and `tailwind-merge` handle variant-based component styling (e.g., Button with `variant="primary"` or `size="sm"`).

### Supabase

Supabase was chosen because it provides four services the platform needs in a single hosted product:

1. **Auth** -- Email/password and magic link authentication with JWT sessions. No separate auth service to manage.
2. **Postgres** -- Full relational database with joins, constraints, and indexes. The data model is highly relational (contacts belong to organizations, assignments link stakeholders to entities, etc.), so a document database would create consistency problems.
3. **Row-Level Security (RLS)** -- Access control is enforced at the database level, not just in application code. This means even if a bug in the API layer returns wrong data, Postgres will filter it based on the user's role and organization.
4. **Storage** -- Materials (PDFs, images, QR code batches) are stored in Supabase Storage buckets with the same RLS policies, so file access is consistent with data access.
5. **Edge Functions** -- Used for batch QR code generation and webhook processing without needing a separate serverless deployment.

### Netlify

Netlify deploys the Next.js app with zero configuration via `@netlify/plugin-nextjs`. The `netlify.toml` sets Node 20 and publishes the `.next` directory. Netlify handles CDN, HTTPS, preview deploys on PRs, and environment variable management. There is no container or server to manage.

---

## Folder Structure

```
src/
  app/                      # Routes and pages
    (auth)/                 # Route group: unauthenticated pages
    (dashboard)/            # Route group: authenticated pages
    api/                    # API route handlers
  components/
    ui/                     # Primitive components (Button, Input, Dialog)
    layout/                 # Shell, sidebar, header, breadcrumbs
    forms/                  # Multi-step form patterns, field groups
    data-display/           # Tables, stat cards, charts, empty states
  lib/
    supabase/               # Client and server Supabase instances
    types/                  # Database types (generated) and model aliases
    hooks/                  # React hooks for auth, roles, data fetching
    utils/                  # Pure utility functions
    validations/            # Zod schemas for form and API validation
    constants/              # Enums, role definitions, brand configuration
```

### Route Groups

The `(auth)` group contains login, signup, and password reset pages. These share a centered, minimal layout with no sidebar.

The `(dashboard)` group contains all authenticated pages. These share a shell layout with a sidebar navigation, header with user menu, and breadcrumbs. The sidebar content adapts based on the user's role.

### Component Organization

Components are organized by function, not by feature. A `ui/Button` is used everywhere, not duplicated per feature. Feature-specific components live alongside their route in the `app/` directory as client components imported by the server-rendered page.

---

## Auth Flow

```
Browser                    Next.js Server              Supabase Auth
  |                            |                            |
  |-- POST /login ------------>|                            |
  |                            |-- signInWithPassword() --->|
  |                            |<-- session + JWT ----------|
  |                            |-- Set cookie (httpOnly) -->|
  |<-- Redirect /dashboard ----|                            |
  |                            |                            |
  |-- GET /dashboard --------->|                            |
  |                            |-- Read cookie, refresh --->|
  |                            |<-- Valid session ----------|
  |                            |-- Fetch data with JWT ---->|
  |                            |<-- RLS-filtered rows ------|
  |<-- Rendered page ----------|                            |
```

1. The user submits credentials on the login page.
2. The server calls `supabase.auth.signInWithPassword()`.
3. Supabase returns a session with access and refresh tokens.
4. The `@supabase/ssr` package stores the session in httpOnly cookies.
5. On subsequent requests, the server middleware reads the cookie, refreshes the session if needed, and creates a Supabase client bound to that user's JWT.
6. All database queries go through this client, so RLS policies are enforced automatically.
7. The service role client (`createServiceClient()`) bypasses RLS and is used only for admin operations like user provisioning and batch jobs.

### Session Management

The middleware in `src/lib/supabase/middleware.ts` runs on every request to authenticated routes. It refreshes expired sessions transparently. If the session cannot be refreshed (e.g., the user was deactivated), it redirects to `/login`.

---

## Role-Based Access Control

### Role Hierarchy

| Role | Scope | Description |
|---|---|---|
| Super Admin | Global | Full access to all organizations, cities, and system settings |
| Internal Admin | Organization | Manages one or more organizations, assigns stakeholders, views all data within their orgs |
| School/Cause Leader | Assigned causes | Manages their assigned causes, tracks outreach to contacts within those causes |
| Business Onboarding Partner | Assigned businesses | Onboards businesses, manages materials and QR codes for their assignments |
| Influencer/Affiliate | Referral tracking | Tracks referrals and signups via personal QR codes and links |
| Volunteer/Intern | Limited, supervised | Read access to assigned tasks, can log outreach activities |

### How Roles Are Enforced

Roles are stored in a `roles` table with a join to `profiles`. A user can have one role per organization (tracked in a `user_roles` or `stakeholder_assignments` join table).

Access control operates at three layers:

1. **UI layer** -- The sidebar and page layouts conditionally render navigation items and action buttons based on the user's role. This is progressive disclosure, not security.
2. **API layer** -- Server components and API routes check the user's role before performing mutations. This catches direct API calls.
3. **Database layer (RLS)** -- Postgres RLS policies filter rows based on `auth.uid()` and the user's role/org memberships. This is the actual security boundary. Even if layers 1 and 2 have bugs, the database will not return unauthorized data.

### Progressive Disclosure

Each role sees a tailored dashboard on login:

- **Super Admin** sees a global overview with cross-org metrics.
- **Internal Admin** sees their organization's pipeline and team activity.
- **School/Cause Leader** sees their cause roster, outreach log, and pending tasks.
- **Business Onboarding Partner** sees their assigned businesses, onboarding stage, and materials.
- **Influencer/Affiliate** sees their referral performance and QR code analytics.
- **Volunteer/Intern** sees their task list and recent outreach.

---

## Data Architecture

### Supabase Postgres + RLS

The database is fully relational. Key design principles:

- **Unified contact table.** All external people (business owners, school principals, community contacts) live in a single `contacts` table. This prevents duplicate outreach -- before contacting someone, the system checks if they already exist.
- **Assignment tables.** Stakeholders are linked to entities (businesses, causes, campaigns) through explicit assignment tables rather than direct foreign keys. This supports many-to-many relationships and tracks assignment metadata (date assigned, status, notes).
- **Soft deletes.** Records are never hard-deleted. A `deleted_at` timestamp is used, and RLS policies filter out soft-deleted rows by default.
- **Audit log.** All mutations are recorded in an `audit_logs` table with the acting user, action type, entity type, entity ID, and a JSON diff of what changed.
- **Org-scoped data.** Most tables include an `org_id` column. RLS policies use this to restrict access to the user's organization(s).

### RLS Policy Pattern

```sql
-- Example: users can only see contacts in their organization
CREATE POLICY "Users see own org contacts"
  ON contacts FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM stakeholder_assignments
      WHERE user_id = auth.uid()
    )
  );
```

Policies are defined per table and per operation (SELECT, INSERT, UPDATE, DELETE). Super Admins have policies that return `true` for all rows.

---

## QR Code System

### Architecture

QR codes are first-class entities, not just generated images. Each QR code has a database record that tracks its purpose, target URL, creation context, and scan analytics.

```
QR Code Generation
  |
  |-- Client-side (single)
  |     Uses `qrcode` npm package
  |     Generates SVG/PNG in the browser
  |     Saves metadata to `qr_codes` table
  |
  |-- Server-side (batch)
        Supabase Edge Function
        Generates ZIP of QR code images
        Creates `qr_code_collections` record
        Stores ZIP in Supabase Storage
```

### Redirect Tracking

Each QR code has a short redirect URL: `/api/qr/[code]`

When scanned:

1. The API route looks up the QR code record.
2. It logs a `qr_code_events` row (timestamp, user agent, referer, geo if available).
3. It returns a 302 redirect to the target URL.

This gives full scan analytics without requiring the target destination to have any tracking code.

### Collections

QR codes can be grouped into collections for batch operations -- e.g., generating 50 QR codes for all businesses in a campaign. The collection record tracks the generation parameters, and each individual QR code links back to the collection.

---

## Analytics Architecture

### Event Tracking

Raw events are stored in dedicated event tables:

- `qr_code_events` -- QR code scans
- `outreach_activities` -- Stakeholder outreach logs (calls, emails, visits)
- `signups` -- New signups attributed to referral sources
- `referrals` -- Referral chain tracking

### Rollup Tables

For dashboard performance, raw events are aggregated into `analytics_rollups`:

```
analytics_rollups
  id
  entity_type    -- 'campaign', 'business', 'cause', 'user'
  entity_id
  metric         -- 'qr_scans', 'outreach_count', 'signups', 'conversion_rate'
  period         -- 'day', 'week', 'month'
  period_start
  value
  metadata       -- JSONB for breakdowns
```

Rollups are computed by a scheduled Supabase Edge Function (or a cron-triggered database function) that runs nightly. Dashboards read from rollup tables for fast rendering, falling back to raw event queries only for drill-down views.

### Chart Rendering

Recharts is used for all data visualization. Chart components receive pre-processed data from server components that query rollup tables.

---

## Integration Layer

### Current State

The platform is currently self-contained -- Supabase is the source of truth for all stakeholder, contact, and campaign data.

### Future CRM Sync

The data model is designed to support bidirectional sync with external CRMs (Salesforce, HubSpot, etc.):

- Each contact and business record has an `external_id` field for storing the CRM's record ID.
- A `sync_status` field tracks whether the record is in sync, pending push, or pending pull.
- The `audit_logs` table provides a change feed that a sync worker can consume.
- Webhook endpoints in `src/app/api/webhooks/` are the inbound receivers for CRM push notifications.

The sync layer is not yet implemented, but the schema is ready for it.

### Future Extensions

- **Generosity Jackpot** -- A gamification module that can query campaign and referral data to award prizes.
- **Cohort Programs** -- Time-bound programs that group stakeholders for training; will use the existing `campaigns` and `onboarding_flows` infrastructure.
- **External Dashboards** -- Read-only views for city officials or sponsors, using the same rollup tables with a separate RLS policy set.

---

## Deployment on Netlify

### Build Process

```
netlify.toml
  [build]
    command = "npm run build"
    publish = ".next"
  [build.environment]
    NODE_VERSION = "20"
  [[plugins]]
    package = "@netlify/plugin-nextjs"
```

The `@netlify/plugin-nextjs` plugin handles:

- Converting Next.js API routes to Netlify Functions
- Setting up ISR (Incremental Static Regeneration) if used
- Configuring the CDN for static assets
- Handling Next.js image optimization

### Environment Variables

Set in Netlify's dashboard under Site Settings > Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Preview Deploys

Every pull request gets an automatic preview deploy with its own URL. This uses the same Supabase project (or a staging project if configured via branch-specific environment variables).

### Production Deploy

Merges to `main` trigger a production deploy. The deploy is atomic -- the new version replaces the old one with zero downtime.
