# Deployment Guide

This guide covers local development setup, Supabase project configuration, environment variables, Netlify deployment, database migrations, and seed data.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20 or later | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| npm | 10+ (ships with Node 20) | |
| Supabase CLI | 1.180+ | `npm install -g supabase` |
| Git | Any recent version | |

Optional but recommended:

- **Supabase account** at [supabase.com](https://supabase.com/) (free tier works for development)
- **Netlify account** at [netlify.com](https://www.netlify.com/) (free tier works for preview deploys)

---

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd OnboardingLocalvip
npm install
```

### 2. Supabase Local Development (Optional)

You can run Supabase locally using Docker for fully offline development:

```bash
# Start local Supabase (requires Docker)
supabase start

# This outputs local URLs and keys:
#   API URL:    http://127.0.0.1:54321
#   Anon key:   eyJ...
#   Service key: eyJ...
#   Studio URL: http://127.0.0.1:54323
```

If you prefer to develop against a hosted Supabase project, skip this step and use your project's URL and keys directly.

### 3. Environment Variables

Create `.env.local` in the project root:

```env
# Supabase connection
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
```

If using local Supabase, use the URLs and keys from `supabase start` output instead.

### 4. Database Setup

```bash
# Apply all migrations
npm run db:migrate

# Seed with initial data
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000). The root page redirects to `/login`.

---

## Supabase Project Setup

### Creating a New Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Choose a region close to your users (e.g., `us-east-1` for US-based operations).
3. Set a strong database password. Save it -- you will need it for direct database connections.
4. Wait for the project to finish provisioning (1-2 minutes).

### Getting Your Keys

Navigate to **Settings > API** in the Supabase dashboard:

- **Project URL** -- This is `NEXT_PUBLIC_SUPABASE_URL`.
- **anon / public key** -- This is `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Safe to expose in client-side code; RLS policies control what it can access.
- **service_role key** -- This is `SUPABASE_SERVICE_ROLE_KEY`. Never expose this in client-side code. It bypasses RLS.

### Linking the CLI

```bash
supabase link --project-ref your-project-ref
```

The project ref is the subdomain of your Supabase URL (e.g., if your URL is `https://abcdefgh.supabase.co`, the ref is `abcdefgh`).

### Configuring Auth

In the Supabase dashboard, go to **Authentication > Providers**:

1. **Email** -- Enabled by default. Confirm that "Enable Email Signup" is on.
2. **Confirm email** -- For development, you may want to disable email confirmation under **Authentication > Settings** to avoid needing a mail server. Re-enable for production.
3. **Site URL** -- Set to your production URL (e.g., `https://your-site.netlify.app`). For local dev, add `http://localhost:3000` to the **Redirect URLs** list.

### Configuring Storage

1. Go to **Storage** in the Supabase dashboard.
2. Create the following buckets:

| Bucket | Public | Purpose |
|---|---|---|
| `avatars` | Yes | User profile photos |
| `materials` | No | Operational documents (PDFs, images) |
| `qr-codes` | Yes | Generated QR code images and batch ZIPs |

3. For each bucket, configure storage policies to match RLS rules. Authenticated users in the same org can read from `materials`; only admins can upload.

---

## Environment Variables

### Required

| Variable | Where Used | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon key (public, RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key (bypasses RLS) |

### Optional

| Variable | Where Used | Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Client | Base URL for generating absolute links (defaults to `http://localhost:3000` in dev) |
| `NEXT_PUBLIC_DEFAULT_BRAND` | Client | Default brand for new orgs: `localvip` or `hato` |

### Security Notes

- Never commit `.env.local` to version control. It is already in `.gitignore`.
- The `SUPABASE_SERVICE_ROLE_KEY` has full database access. Only use it in server-side code (`src/lib/supabase/server.ts` via `createServiceClient()`).
- In Netlify, set environment variables through the dashboard, not in `netlify.toml`.

---

## Netlify Deployment

### Initial Setup

1. Log in to [app.netlify.com](https://app.netlify.com/).
2. Click **Add new site > Import an existing project**.
3. Connect your Git provider and select the repository.
4. Netlify auto-detects the `netlify.toml` configuration. Verify:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Node version:** 20
5. Add environment variables under **Site settings > Environment variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Click **Deploy site**.

### How It Works

The `netlify.toml` configuration:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

The `@netlify/plugin-nextjs` plugin handles:

- Converting Next.js server-side rendering to Netlify Functions.
- Setting up proper caching headers for static assets.
- Handling API routes as serverless functions.
- Image optimization passthrough.

### Preview Deploys

Every push to a non-production branch (and every pull request) gets an automatic preview deploy at a unique URL like `https://deploy-preview-42--your-site.netlify.app`. This is useful for QA before merging to `main`.

To use a separate Supabase project for preview deploys, set branch-specific environment variables in Netlify pointing to a staging Supabase project.

### Production Deploys

Merges to `main` (or your configured production branch) trigger a production deploy. Deploys are atomic -- the old version serves traffic until the new build is fully ready, then switches instantly.

### Custom Domain

1. In Netlify, go to **Domain management > Add custom domain**.
2. Enter your domain (e.g., `ops.localvip.com`).
3. Configure DNS as directed (CNAME or Netlify DNS).
4. Netlify provisions an SSL certificate automatically.
5. Update Supabase Auth's **Site URL** and **Redirect URLs** to use the custom domain.

---

## Supabase Migrations

### Creating a New Migration

```bash
# Generate a new migration file
supabase migration new descriptive_name

# This creates: supabase/migrations/<timestamp>_descriptive_name.sql
```

Edit the generated SQL file with your schema changes.

### Applying Migrations

```bash
# Push migrations to the linked remote project
npm run db:migrate
# (runs: supabase db push)

# Or apply to local Supabase
supabase db push --local
```

### Resetting the Database

```bash
# Drop all tables and re-run all migrations + seed
npm run db:reset
# (runs: supabase db reset)
```

This is destructive -- it drops everything and starts fresh. Use only in development.

### Migration Best Practices

- Each migration file should be independently runnable. Do not assume another migration has been applied unless it was created earlier (migrations run in timestamp order).
- Use `IF NOT EXISTS` for creating tables and indexes to make migrations idempotent when possible.
- Never modify a migration file that has already been pushed to a shared environment. Create a new migration instead.
- Include both the up and down operations in comments, even though Supabase migrations are forward-only. This documents intent for rollback scripts.
- RLS policies should be created in the same migration as their table.

### Generating TypeScript Types

After applying migrations, regenerate the database types:

```bash
supabase gen types typescript --linked > src/lib/types/database.ts
```

This keeps the TypeScript types in sync with the actual database schema. Run this after every migration.

---

## Seed Data

### What Gets Seeded

The seed script (`npm run db:seed`, which runs `scripts/seed.ts`) creates:

1. **Roles** -- All six role definitions (super_admin, internal_admin, school_cause_leader, business_onboarding_partner, influencer_affiliate, volunteer_intern).
2. **Demo city** -- A sample city record.
3. **Demo organization** -- A sample org linked to the demo city with `brand: 'localvip'`.
4. **Demo users** -- One user per role, each with a profile and stakeholder assignment to the demo org.
5. **Sample campaign** -- An active campaign in the demo org.
6. **Sample onboarding flow** -- A business onboarding flow with 5 steps.
7. **Sample tags** -- Common tags (industry categories, status labels).

### Running the Seed

```bash
# Seed the linked remote project
npm run db:seed

# The seed script is idempotent -- running it twice will not create duplicates.
# It checks for existing records before inserting.
```

### Demo Login Credentials

After seeding, the following demo accounts are available (all passwords are `localvip-demo-2024`):

| Role | Email |
|---|---|
| Super Admin | `superadmin@demo.localvip.com` |
| Internal Admin | `admin@demo.localvip.com` |
| School/Cause Leader | `leader@demo.localvip.com` |
| Business Partner | `partner@demo.localvip.com` |
| Influencer | `influencer@demo.localvip.com` |
| Volunteer | `volunteer@demo.localvip.com` |

Change these passwords immediately in any shared or staging environment.

### Custom Seed Data

To seed additional data for a specific city or campaign, create a new script in `scripts/` and add a corresponding npm script to `package.json`:

```bash
# Example
npx tsx scripts/seed-austin.ts
```
