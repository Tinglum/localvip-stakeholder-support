# LocalVIP Stakeholder Support System

Internal operations platform for managing stakeholder onboarding, outreach tracking, QR code campaigns, and materials distribution across the LocalVIP and HATO brands.

This is **not** a consumer-facing application. It is a CRM and workflow tool used by internal admins, school/cause leaders, business onboarding partners, influencers, and volunteers to coordinate community engagement at the city level.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3.4 + Radix UI primitives |
| Database | Supabase Postgres with Row-Level Security |
| Auth | Supabase Auth (email/password, magic link) |
| File Storage | Supabase Storage |
| QR Codes | `qrcode` (client-side) + Supabase Edge Functions (batch) |
| Charts | Recharts |
| Validation | Zod |
| Notifications | Sonner (toast) |
| Icons | Lucide React |
| Deployment | Netlify with `@netlify/plugin-nextjs` |
| Node | 20+ |

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm
- Supabase CLI (`npm install -g supabase`)
- A Supabase project (free tier works for development)

### Installation

```bash
git clone <repo-url>
cd OnboardingLocalvip
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Database Setup

```bash
# Link your Supabase project
supabase link --project-ref your-project-ref

# Run migrations
npm run db:migrate

# Seed initial data (roles, demo users, sample city)
npm run db:seed

# Full reset (drops and recreates everything)
npm run db:reset
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/login`.

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Folder Structure

```
src/
  app/                    # Next.js App Router pages and layouts
    (auth)/               # Auth group: login, signup, forgot-password
    (dashboard)/          # Authenticated dashboard group
      admin/              # Super Admin and Internal Admin views
      businesses/         # Business management and onboarding
      campaigns/          # Campaign management
      causes/             # Cause/school management
      contacts/           # Unified contact directory
      materials/          # Materials library
      onboarding/         # Onboarding flow management
      outreach/           # Outreach activity tracking
      qr-codes/           # QR code generation and analytics
      reports/            # Analytics and rollup reports
      settings/           # User and org settings
    api/                  # API route handlers
      qr/                 # QR redirect and event tracking
      webhooks/           # Supabase webhook receivers
    globals.css           # Tailwind base, component, and utility layers
    layout.tsx            # Root layout with Sonner toast provider
    page.tsx              # Root redirect to /login
  components/
    ui/                   # Shared UI primitives (Button, Dialog, Select, etc.)
    layout/               # Shell, sidebar, header components
    forms/                # Reusable form patterns
    data-display/         # Tables, stat cards, charts
  lib/
    supabase/
      client.ts           # Browser Supabase client
      server.ts           # Server Supabase client + service role client
      middleware.ts        # Auth session refresh middleware
    types/
      database.ts         # Generated Supabase database types
      models.ts           # Application-level type aliases
    hooks/                # React hooks (useAuth, useRole, useOrg)
    utils/                # Date formatting, cn(), slug generation
    validations/          # Zod schemas
    constants/            # Role names, status enums, brand config
supabase/
  migrations/             # SQL migration files
  seed.sql                # Seed data
  config.toml             # Supabase local dev config
scripts/
  seed.ts                 # TypeScript seed script
netlify.toml              # Netlify build configuration
tailwind.config.ts        # Extended color palette (brand, hato, semantic)
```

## Brands

The platform supports multiple brands through a `brand` field on organizations and campaigns:

- **LocalVIP** -- community loyalty and business engagement
- **HATO** -- education-focused cause and school partnerships

Brand theming is handled via the extended Tailwind color palette (`brand-*` and `hato-*` tokens).

## Key Concepts

- **Stakeholders** are the people using this platform: admins, leaders, partners, influencers, volunteers.
- **Contacts** are external individuals (business owners, cause leaders, community members) tracked for outreach.
- **Organizations** represent a city-level operating unit.
- **Campaigns** are time-bound initiatives with QR codes, materials, and assigned stakeholders.
- **Onboarding Flows** are multi-step pipelines (not just forms) that track progress through stages.

## Documentation

- [Architecture](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [Product Decisions](docs/product-decisions.md)
- [Deployment Guide](docs/deployment.md)

## License

Proprietary. Internal use only.
