# Data Model

This document describes every table in the Supabase Postgres database, including field descriptions, relationships, and the deduplication strategy that prevents duplicate outreach.

All tables include `id` (UUID, primary key, default `gen_random_uuid()`), `created_at` (timestamptz, default `now()`), and `updated_at` (timestamptz, auto-updated by trigger). Tables that support soft deletion include `deleted_at` (timestamptz, nullable).

---

## Identity and Access

### users

Managed by Supabase Auth. This table lives in the `auth` schema and is not directly modified by application code. Each row represents an authenticated account.

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key, referenced by `profiles.user_id` |
| email | text | Login email |
| encrypted_password | text | Managed by Supabase Auth |
| created_at | timestamptz | Account creation time |
| last_sign_in_at | timestamptz | Most recent login |

### profiles

Application-level user data. One row per authenticated user. Created automatically via a database trigger on `auth.users` insert.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK to `auth.users.id`, unique |
| first_name | text | |
| last_name | text | |
| display_name | text | Computed or overridden display name |
| phone | text | Nullable |
| avatar_url | text | Path in Supabase Storage |
| timezone | text | IANA timezone string, default `America/Chicago` |
| is_active | boolean | Soft disable without deleting the auth account |
| metadata | jsonb | Flexible key-value storage for profile extensions |

### roles

Lookup table for role definitions. Seeded at deploy time; not user-editable.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| name | text | Unique. One of: `super_admin`, `internal_admin`, `school_cause_leader`, `business_onboarding_partner`, `influencer_affiliate`, `volunteer_intern` |
| display_name | text | Human-readable label |
| description | text | What this role can do |
| permissions | jsonb | Structured permissions object (e.g., `{"contacts": "read_write", "settings": "none"}`) |

### stakeholder_assignments

Links a user (stakeholder) to an organization with a specific role. A user can belong to multiple organizations with different roles.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK to `profiles.user_id` |
| org_id | uuid | FK to `organizations.id` |
| role_id | uuid | FK to `roles.id` |
| assigned_by | uuid | FK to `profiles.user_id` (the admin who made the assignment) |
| status | text | `active`, `inactive`, `pending` |
| started_at | timestamptz | When the assignment became active |
| ended_at | timestamptz | Nullable; set when deactivated |
| notes | text | Reason for assignment or special instructions |

---

## Organizations and Geography

### organizations

A city-level operating unit. All data is scoped to an organization.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| name | text | e.g., "LocalVIP Austin" |
| slug | text | URL-safe identifier, unique |
| brand | text | `localvip` or `hato` |
| city_id | uuid | FK to `cities.id` |
| logo_url | text | Path in Supabase Storage |
| settings | jsonb | Org-level configuration (feature flags, defaults) |
| is_active | boolean | |

### cities

Geographic reference table.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| name | text | City name |
| state | text | State or province |
| country | text | Default `US` |
| timezone | text | IANA timezone |
| metadata | jsonb | Population, region, or other reference data |

---

## Campaigns

### campaigns

A time-bound initiative with assigned stakeholders, businesses, causes, QR codes, and materials.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| name | text | |
| slug | text | Unique within org |
| description | text | |
| brand | text | `localvip` or `hato` |
| status | text | `draft`, `active`, `paused`, `completed`, `archived` |
| start_date | date | |
| end_date | date | Nullable for open-ended campaigns |
| goals | jsonb | Target metrics: `{"signups": 500, "businesses_onboarded": 50}` |
| settings | jsonb | Campaign-specific config |

---

## Businesses and Causes

### businesses

External businesses being onboarded or already participating.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| name | text | |
| slug | text | Unique within org |
| category | text | Business type (restaurant, retail, service, etc.) |
| address | text | |
| city | text | |
| state | text | |
| zip | text | |
| phone | text | |
| email | text | Primary contact email |
| website | text | |
| status | text | `prospect`, `contacted`, `onboarding`, `active`, `churned` |
| onboarding_stage | text | Current step in the onboarding flow |
| external_id | text | ID in external CRM, nullable |
| sync_status | text | `synced`, `pending_push`, `pending_pull`, `conflict`, nullable |
| metadata | jsonb | |

### causes

Schools, nonprofits, or community causes being supported.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| name | text | |
| slug | text | Unique within org |
| type | text | `school`, `nonprofit`, `community_group`, `other` |
| address | text | |
| city | text | |
| state | text | |
| zip | text | |
| phone | text | |
| email | text | |
| website | text | |
| status | text | `prospect`, `contacted`, `onboarding`, `active`, `inactive` |
| external_id | text | |
| sync_status | text | |
| metadata | jsonb | |

---

## Contacts

### contacts

Unified table for all external people. This is the core deduplication entity -- see the Deduplication Strategy section below.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| first_name | text | |
| last_name | text | |
| email | text | Nullable; unique within org when present |
| phone | text | Nullable; unique within org when present |
| title | text | Job title or role at their organization |
| contact_type | text | `business_owner`, `school_admin`, `teacher`, `nonprofit_leader`, `community_member`, `other` |
| business_id | uuid | FK to `businesses.id`, nullable |
| cause_id | uuid | FK to `causes.id`, nullable |
| source | text | How they entered the system: `manual`, `import`, `qr_signup`, `referral`, `web_form` |
| status | text | `active`, `inactive`, `do_not_contact` |
| external_id | text | |
| sync_status | text | |
| last_contacted_at | timestamptz | Denormalized from `outreach_activities` for quick filtering |
| metadata | jsonb | |

---

## Assignments

### business_assignments

Links stakeholders to businesses they are responsible for.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| business_id | uuid | FK to `businesses.id` |
| user_id | uuid | FK to `profiles.user_id` |
| role | text | `primary`, `secondary`, `support` |
| campaign_id | uuid | FK to `campaigns.id`, nullable |
| assigned_at | timestamptz | |
| status | text | `active`, `completed`, `reassigned` |

### cause_assignments

Links stakeholders to causes they are responsible for.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| cause_id | uuid | FK to `causes.id` |
| user_id | uuid | FK to `profiles.user_id` |
| role | text | `primary`, `secondary`, `support` |
| campaign_id | uuid | FK to `campaigns.id`, nullable |
| assigned_at | timestamptz | |
| status | text | `active`, `completed`, `reassigned` |

---

## Activity Tracking

### outreach_activities

Every touchpoint with a contact -- calls, emails, visits, texts.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| user_id | uuid | FK to `profiles.user_id` (the stakeholder who did the outreach) |
| contact_id | uuid | FK to `contacts.id` |
| business_id | uuid | FK to `businesses.id`, nullable |
| cause_id | uuid | FK to `causes.id`, nullable |
| campaign_id | uuid | FK to `campaigns.id`, nullable |
| type | text | `call`, `email`, `visit`, `text`, `meeting`, `other` |
| outcome | text | `connected`, `voicemail`, `no_answer`, `follow_up_needed`, `completed` |
| notes | text | Free-form notes about the interaction |
| occurred_at | timestamptz | When the outreach happened (may differ from `created_at`) |
| duration_minutes | integer | Nullable |

### tasks

Actionable items assigned to stakeholders.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| assigned_to | uuid | FK to `profiles.user_id` |
| assigned_by | uuid | FK to `profiles.user_id` |
| title | text | |
| description | text | |
| status | text | `pending`, `in_progress`, `completed`, `cancelled` |
| priority | text | `low`, `medium`, `high`, `urgent` |
| due_date | timestamptz | Nullable |
| completed_at | timestamptz | Nullable |
| related_entity_type | text | `business`, `cause`, `contact`, `campaign`, nullable |
| related_entity_id | uuid | Nullable |

### notes

General-purpose notes attached to any entity.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| author_id | uuid | FK to `profiles.user_id` |
| entity_type | text | `business`, `cause`, `contact`, `campaign` |
| entity_id | uuid | The ID of the entity this note is attached to |
| content | text | Markdown-supported note body |
| is_pinned | boolean | Default `false` |

---

## Onboarding

### onboarding_flows

A named pipeline with ordered steps. Used for business onboarding, cause onboarding, and stakeholder onboarding.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| name | text | e.g., "Business Onboarding - Standard" |
| entity_type | text | `business`, `cause`, `stakeholder` |
| brand | text | `localvip` or `hato` |
| is_active | boolean | Only one active flow per entity_type + brand + org |
| steps_count | integer | Denormalized count of steps |

### onboarding_steps

Individual steps within a flow. Ordered by `position`.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| flow_id | uuid | FK to `onboarding_flows.id` |
| position | integer | Order within the flow (1-based) |
| name | text | Step title shown in the UI |
| description | text | Instructions for the stakeholder |
| type | text | `form`, `task`, `approval`, `document_upload`, `notification` |
| config | jsonb | Step-specific configuration (form fields, required documents, approval chain) |
| is_required | boolean | Whether the step must be completed to advance |
| estimated_minutes | integer | Nullable; used for time estimates |

---

## Materials

### materials

Files (PDFs, images, documents) stored in Supabase Storage with metadata in Postgres.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| name | text | Display name |
| description | text | |
| type | text | `flyer`, `contract`, `guide`, `presentation`, `image`, `other` |
| brand | text | `localvip` or `hato` |
| file_url | text | Path in Supabase Storage |
| file_size | integer | Bytes |
| mime_type | text | |
| version | integer | Incremented on re-upload |
| is_template | boolean | Whether this can be used to generate personalized copies |
| status | text | `draft`, `active`, `archived` |

### material_templates

Templates with placeholder variables for generating personalized materials.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| material_id | uuid | FK to `materials.id` |
| template_type | text | `pdf_overlay`, `image_overlay`, `html` |
| variables | jsonb | Array of variable definitions: `[{"name": "business_name", "type": "text", "required": true}]` |
| template_config | jsonb | Layout and positioning data for overlays |

### material_assignments

Tracks which materials have been sent or assigned to which entities.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| material_id | uuid | FK to `materials.id` |
| entity_type | text | `business`, `cause`, `campaign`, `user` |
| entity_id | uuid | |
| assigned_by | uuid | FK to `profiles.user_id` |
| status | text | `assigned`, `delivered`, `acknowledged` |
| delivered_at | timestamptz | Nullable |

---

## QR Codes

### qr_codes

Each QR code is a tracked entity with a unique short code.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| code | text | Unique short code used in the redirect URL |
| target_url | text | Where the QR code redirects to |
| label | text | Human-readable label for internal reference |
| type | text | `business`, `cause`, `campaign`, `referral`, `general` |
| entity_id | uuid | FK to the related business, cause, campaign, or user; nullable |
| collection_id | uuid | FK to `qr_code_collections.id`, nullable |
| campaign_id | uuid | FK to `campaigns.id`, nullable |
| format | text | `svg`, `png` |
| style_config | jsonb | Colors, logo overlay, size |
| is_active | boolean | Inactive QR codes return a "deactivated" page instead of redirecting |
| scan_count | integer | Denormalized total scans for quick display |

### qr_code_collections

A batch of related QR codes generated together.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| name | text | e.g., "Spring 2025 Business QR Batch" |
| campaign_id | uuid | FK to `campaigns.id`, nullable |
| generation_config | jsonb | Parameters used to generate the batch |
| file_url | text | Path to ZIP file in Supabase Storage |
| qr_count | integer | Number of QR codes in the collection |
| status | text | `generating`, `ready`, `failed` |

### qr_code_events

Raw scan event log.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| qr_code_id | uuid | FK to `qr_codes.id` |
| scanned_at | timestamptz | |
| user_agent | text | |
| referer | text | Nullable |
| ip_hash | text | Hashed for privacy; not stored in plain text |
| geo_city | text | Nullable; derived from IP if available |
| geo_region | text | Nullable |
| geo_country | text | Nullable |

---

## Referrals and Signups

### signups

New user signups or registrations attributed to a source.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| contact_id | uuid | FK to `contacts.id`, nullable (linked after dedup) |
| email | text | |
| first_name | text | |
| last_name | text | |
| source | text | `qr_code`, `referral_link`, `web_form`, `manual` |
| source_id | uuid | FK to `qr_codes.id` or `referrals.id`, nullable |
| campaign_id | uuid | FK to `campaigns.id`, nullable |
| status | text | `new`, `contacted`, `converted`, `rejected` |
| metadata | jsonb | Any extra data collected at signup |

### referrals

Tracks referral relationships between users and new signups.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| referrer_id | uuid | FK to `profiles.user_id` (the person who referred) |
| referred_signup_id | uuid | FK to `signups.id` |
| referral_code | text | The code used, links back to a QR code or shareable URL |
| status | text | `pending`, `verified`, `rewarded` |
| reward_type | text | Nullable; e.g., `points`, `cash`, `donation` |
| reward_value | numeric | Nullable |
| rewarded_at | timestamptz | Nullable |

### redirects

General-purpose tracked redirect links (not QR-specific).

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| slug | text | Short URL slug, unique |
| target_url | text | |
| campaign_id | uuid | FK to `campaigns.id`, nullable |
| click_count | integer | Denormalized |
| is_active | boolean | |

---

## Analytics

### analytics_rollups

Pre-aggregated metrics for fast dashboard queries.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| entity_type | text | `campaign`, `business`, `cause`, `user`, `org` |
| entity_id | uuid | |
| metric | text | `qr_scans`, `outreach_count`, `signups`, `conversion_rate`, `materials_delivered` |
| period | text | `day`, `week`, `month`, `quarter` |
| period_start | date | Start of the aggregation period |
| value | numeric | The aggregated value |
| metadata | jsonb | Breakdowns, e.g., `{"by_type": {"call": 12, "email": 8}}` |

A unique constraint on `(org_id, entity_type, entity_id, metric, period, period_start)` prevents duplicate rollups. Rollups are upserted nightly.

---

## Tagging

### tags

Flexible tagging system for any entity.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| name | text | Tag label, unique within org |
| color | text | Hex color for display |
| category | text | Grouping for tag management: `status`, `industry`, `interest`, `custom` |

### entity_tags

Join table linking tags to entities.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| tag_id | uuid | FK to `tags.id` |
| entity_type | text | `business`, `cause`, `contact`, `campaign` |
| entity_id | uuid | |
| tagged_by | uuid | FK to `profiles.user_id` |

Unique constraint on `(tag_id, entity_type, entity_id)`.

---

## Audit

### audit_logs

Immutable log of all data mutations.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK to `organizations.id` |
| user_id | uuid | FK to `profiles.user_id` (who performed the action) |
| action | text | `create`, `update`, `delete`, `assign`, `unassign`, `login`, `export` |
| entity_type | text | Table name that was modified |
| entity_id | uuid | |
| changes | jsonb | `{"field": {"old": "value1", "new": "value2"}}` |
| ip_address | text | Nullable |
| user_agent | text | Nullable |

Audit logs are append-only. No UPDATE or DELETE operations are permitted on this table (enforced by RLS policy and absence of update/delete policies).

---

## Deduplication Strategy

Duplicate outreach is the primary operational risk this data model is designed to prevent.

### How Duplicates Are Prevented

1. **Unique constraints on contacts.** Within an organization, `(org_id, email)` and `(org_id, phone)` have unique partial indexes (only applied when the value is not null). This means two contacts in the same org cannot share an email or phone number.

2. **Lookup before create.** All contact creation flows (manual entry, CSV import, QR code signup, referral) first check for an existing contact by email, then by phone, then by name + business/cause combination. If a match is found, the existing contact is returned and optionally updated rather than creating a duplicate.

3. **Merge capability.** When duplicates are discovered after the fact (e.g., one record has email, another has phone, and they turn out to be the same person), an admin can merge contacts. The merge operation:
   - Keeps the older record as the canonical one.
   - Moves all related records (outreach activities, assignments, notes, signups) to the canonical contact.
   - Soft-deletes the duplicate.
   - Logs the merge in `audit_logs`.

4. **Import dedup.** CSV imports run a matching pass before inserting. Each row is checked against existing contacts. The import UI shows a preview of matches, new records, and conflicts before committing.

5. **Cross-entity awareness.** A contact can be linked to both a `business_id` and a `cause_id`. This handles the case where a business owner is also involved in a cause -- they are one contact, not two.

### External ID Mapping

For future CRM sync, each contact, business, and cause has an `external_id` field. When syncing:

- Records created locally get their `external_id` populated after the first push to the external CRM.
- Records pulled from the external CRM are matched by `external_id` first, then by email/phone as a fallback.
- Conflicts (both sides changed) are flagged with `sync_status = 'conflict'` for manual resolution.
