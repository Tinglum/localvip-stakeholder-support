# Product Decisions

This document records the key product decisions that shape the LocalVIP Stakeholder Support System, the reasoning behind each one, and the implications for how the platform is built.

---

## 1. This Is an Internal Ops Platform, Not a Consumer App

**Decision:** The platform is used exclusively by internal stakeholders (admins, leaders, partners, influencers, volunteers). External users (business owners, community members) never log in to this system.

**Why:** Consumer apps optimize for acquisition funnels, onboarding UX, and engagement metrics. This platform optimizes for operational efficiency -- how quickly an admin can assign a stakeholder, how reliably a partner can track their outreach, how accurately leadership can see pipeline status. The design priorities are information density, fast data entry, and reliable workflows. Not delight, not virality.

**Implications:**
- No public-facing pages (except QR code redirects and signup landing pages).
- No self-service signup. Users are provisioned by admins.
- UI favors tables, filters, and bulk actions over cards and visual layouts.
- Authentication is email/password or magic link, not social login.
- Mobile responsiveness matters (stakeholders work in the field) but is secondary to desktop.

---

## 2. Supabase CRM Is the Source of Truth

**Decision:** All stakeholder, contact, business, cause, and campaign data lives in Supabase Postgres. This is the canonical data store. External CRMs (if connected later) are downstream consumers, not upstream sources.

**Why:** The platform was built because existing tools (spreadsheets, disconnected CRMs, email threads) caused data fragmentation. Making Supabase the single source of truth means every stakeholder sees the same data. If a future CRM sync is added, the sync pushes from Supabase outward -- Supabase is never overwritten by an external system without manual conflict resolution.

**Implications:**
- All mutations go through the Supabase API with RLS enforcement.
- The `audit_logs` table creates a full change history that any future integration can replay.
- External CRM sync is designed as a push-first model with conflict detection.
- Data exports (CSV, reports) always pull from Supabase, not from cached views.

---

## 3. Unified Data Model Prevents Duplicate Outreach

**Decision:** All external people (business owners, school admins, community members) live in a single `contacts` table with deduplication enforced by unique constraints and lookup-before-create logic.

**Why:** The biggest operational problem reported by stakeholders was contacting the same person multiple times through different channels, or two stakeholders reaching out to the same business without knowing. A unified contact table with dedup makes this structurally impossible rather than relying on manual coordination.

**Implications:**
- There is no separate "business contacts" table and "cause contacts" table. One person, one record.
- A contact can be linked to both a business and a cause simultaneously.
- CSV imports run dedup matching before inserting.
- QR code signups and referrals check for existing contacts before creating new ones.
- The merge workflow handles cases where duplicates slip through.

---

## 4. Multi-Brand Support via Brand Field

**Decision:** The platform supports multiple brands (currently LocalVIP and HATO) through a `brand` field on organizations, campaigns, and materials -- not through separate deployments or tenants.

**Why:** LocalVIP and HATO serve different communities (business loyalty vs. education/causes) but share operational processes, stakeholder pools, and city-level infrastructure. Running separate systems would mean duplicate admin work and no cross-brand visibility. A single deployment with brand-aware filtering gives each brand its own identity while sharing the operational backbone.

**Implications:**
- Organizations have a `brand` field that determines their color scheme and default materials.
- Campaigns inherit brand from their organization but can override it.
- The Tailwind config defines separate color palettes (`brand-*` for LocalVIP, `hato-*` for HATO).
- Reports can be filtered by brand or viewed across brands.
- A stakeholder can work across both brands within the same org.

---

## 5. Role-Based Dashboards with Progressive Disclosure

**Decision:** Each role sees a different default dashboard and navigation set. Features are progressively revealed as role scope increases.

**Why:** A Volunteer/Intern who sees the same admin dashboard as a Super Admin will be overwhelmed and confused. Conversely, a Super Admin who has to navigate through a simplified UI to reach admin features will be frustrated. Progressive disclosure gives each role exactly the information and actions they need, with no clutter from things they cannot or should not do.

**Implications:**
- The sidebar navigation is dynamically generated based on the user's role.
- Dashboard home pages are different for each role (see Architecture doc for details).
- UI components like bulk action buttons are conditionally rendered.
- The actual security enforcement is in RLS, not in the UI. The UI hides things for usability; the database hides things for security.

---

## 6. QR Codes Are First-Class Entities with Analytics

**Decision:** QR codes are not just generated images. Each QR code is a database record with a unique short code, metadata, scan event tracking, and aggregated analytics.

**Why:** QR codes are a primary distribution mechanism for both brands. Business window stickers, cause flyers, and event handouts all carry QR codes. Knowing which codes are scanned, when, and where directly measures the effectiveness of physical distribution. Treating QR codes as trackable entities (not disposable images) makes this possible.

**Implications:**
- Every QR code has a row in the `qr_codes` table.
- Scanning a QR code hits an API route that logs the event before redirecting.
- QR codes can be deactivated without changing the printed material (the redirect just goes to a "deactivated" page).
- Batch generation creates a `qr_code_collections` record linking all codes in the batch.
- QR scan data feeds into the analytics rollup pipeline.
- QR codes can be filtered, searched, and reported on like any other entity.

---

## 7. Materials Library Is Operational, Not Creative

**Decision:** The materials library stores, organizes, and distributes operational documents (contracts, guides, flyers, presentations). It does not include a design editor or creative tools.

**Why:** Materials are created by the marketing/design team using external tools (Canva, Figma, InDesign). The ops platform's job is to make sure the right materials get to the right stakeholders at the right time, track whether they were delivered, and manage versions. Building a design editor would be a massive scope increase that duplicates existing tools.

**Implications:**
- Materials are uploaded as finished files (PDF, PNG, PPTX).
- The template system supports variable substitution (e.g., overlaying a business name on a flyer template) but not freeform design.
- Version tracking is simple: a version number incremented on re-upload.
- Material assignments track delivery status (assigned, delivered, acknowledged).
- Materials are tagged by brand, type, and campaign for filtering.

---

## 8. Onboarding Flows Are Pipeline-Style, Not Just Forms

**Decision:** Onboarding is modeled as a multi-step pipeline with ordered stages, not a single form submission. Each step can be a form, a task, an approval gate, a document upload, or a notification.

**Why:** Business onboarding involves multiple interactions over days or weeks: initial contact, agreement signing, materials delivery, QR code setup, training, and launch. A single form cannot model this. A pipeline with tracked stages lets leadership see where every business is in the process, which stages are bottlenecks, and which stakeholders are falling behind.

**Implications:**
- `onboarding_flows` and `onboarding_steps` are separate tables (flow has many steps).
- Each step has a `type` that determines how it is rendered and completed.
- Business and cause records have an `onboarding_stage` field that denormalized their current step for quick filtering.
- The onboarding view shows a Kanban-style pipeline grouped by stage.
- Flows are configurable per org/brand without code changes.
- Completion of a step can trigger notifications or auto-create follow-up tasks.

---

## 9. Future Extensibility

The following features are not built yet but the data model and architecture are designed to support them without major refactoring.

### Generosity Jackpot

A gamification module where referrals, signups, and engagement milestones earn entries into prize drawings. The existing `referrals`, `signups`, and `analytics_rollups` tables provide the data inputs. The Jackpot module would add a `jackpot_entries` table and a drawing mechanism, reading from existing data.

### External CRM Sync

Bidirectional sync with Salesforce, HubSpot, or other CRMs. The `external_id` and `sync_status` fields on contacts, businesses, and causes are already in the schema. The `audit_logs` table provides a change feed. A sync worker would process the change feed and push/pull records.

### Cohort Programs

Time-bound training or engagement programs that group stakeholders into cohorts (e.g., "Spring 2025 Volunteer Cohort"). These can reuse `campaigns` for the container, `onboarding_flows` for the curriculum, and `stakeholder_assignments` for enrollment. A `cohorts` table may be added for cohort-specific metadata (graduation date, certificates).

### External Dashboards

Read-only dashboards for city officials, sponsors, or school administrators who need visibility into program metrics without full platform access. These would use the same `analytics_rollups` tables with a separate set of RLS policies scoped to a "viewer" role.
