# QA Dashboard Integration Backlog

Updated: 2026-04-06

This file tracks dashboard functionality that still exists only in the dashboard layer and must be added to the QA server before it can fully move out of Supabase/local workflow storage.

## Dashboard-Only Features To Add To QA

### CRM workflow
- `campaigns`
- `onboarding_flows`
- `onboarding_steps`
- dashboard pipeline `stage`
- dashboard execution `launch_phase`
- dashboard execution `activation_status`

### CRM execution and coordination
- `tasks`
- `notes`
- `outreach_activities`
- `outreach_scripts`
- `business_referrals`
- `city_access_requests`

### Ownership and stakeholder workflow
- `stakeholders`
- `stakeholder_assignments`
- `ownership_status`
- `stakeholder_codes`
- `connection_code`
- `join_url`

### Marketing and launch assets
- `offers`
- `capture_offer_id`
- `materials`
- `material_templates`
- `generated_materials`
- `material_assignments`
- `template_rules`
- `admin_tasks`

### QR and redirect tracking
- `qr_code_collections`
- `qr_codes`
- `qr_code_events`
- `redirects`

### Dashboard analytics and admin tooling
- `analytics_rollups`
- `tags`
- `entity_tags`
- `audit_logs`
- `notifications`

### Dashboard business and cause fields not present in QA schema
- `cover_photo_url`
- `linked_cause_id`
- `linked_material_id`
- `linked_qr_code_id`
- `linked_qr_collection_id`
- `avg_ticket`
- `products_services`
- `created_by_user_id`
- `tag`
- `list_status`
- `invited_at`
- `joined_at`
- `normalized_email`
- `normalized_phone`

## QA Domains Not Yet Surfaced In The Dashboard

These already exist in QA and should be added as next API phases after the current account/business/nonprofit alignment work.

### Account membership and identity
- `AccountUsers`
- `AspNetRoles`
- `AspNetRoleClaims`
- `AspNetUserClaims`
- `AspNetUserLogins`
- `AspNetUserRoles`
- `AspNetUserTokens`

### Commerce and payment
- `Deals`
- `Transactions`
- `Cashbacks`
- `BonusCash`
- `Wallet`
- `StripeAccounts`
- `StripeConnectedAccounts`
- `StripeCustomers`
- `DwollaAccounts`
- `PlaidUserToken`
- `UserFailedTransfers`

### Messaging and contact intake
- `BusinessVIP`
- `MessageLogs`
- `lvip_contacts`

### Referral and community graph
- `ConsumerFiveFriends`
- `ConsumerTenCauses`
- `Referrals`
- `ReferralLevels`
- `PlatinumExecutiveAccountMapping`
- `PlatinumRobin`

### Devices and system/webhook infrastructure
- `Devices`
- `UserDevices`
- `WebhookPayloads`
- `WebhookPayloadsRaw`
- `StripeWebhookRawPayload`
- `StripeWebhooks`

## Current Alignment Direction

The dashboard is being aligned to QA around the backend account model first:

- QA `Accounts` -> dashboard business/cause CRM records
- QA `AspNetUsers` -> dashboard profile/user identity mapping
- QA-owned account fields stay QA-backed
- dashboard-only workflow fields remain local until QA support exists

This keeps the current dashboard UI and workflow intact while moving backend-owned data toward QA naming and QA fetch logic.
