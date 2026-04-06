# QA Field Alignment

Updated: 2026-04-06

This document tracks the canonical QA-aligned field names now used by the dashboard bridge layer.

## Implemented QA-Aligned Account Fields

These fields now exist as first-class properties on merged CRM business and cause records:

- `qa_account_id`
- `qa_account_type`
- `qa_business_type`
- `name`
- `headline`
- `description`
- `owner_name`
- `owner_email`
- `owner_phone`
- `address1`
- `address2`
- `city_name`
- `state`
- `country`
- `zip_code`
- `full_address`
- `latitude`
- `longitude`
- `distance_meter`
- `distance_kilometer`
- `distance_feet`
- `distance_mile`
- `active`
- `image_url`
- `sales_tax`
- `tax_id`
- `marketing`
- `tx_fee`
- `time_zone`
- `twilio_number`
- `twilio_welcome_message`
- `is_deleted`
- `stripe_onboarding_complete`

## Current QA Source Mapping

### QA `Accounts`

The dashboard now treats QA `Accounts` as the canonical backend source for:

- businesses
- nonprofits / causes
- shared account identity and location details
- shared owner/contact details
- shared financial configuration details already present in QA

### QA `AspNetUsers`

The dashboard still needs deeper integration work here. QA user/profile fields should eventually align with:

- `first_name`
- `middle_name`
- `last_name`
- `phone_number`
- `email`
- `address1`
- `address2`
- `city`
- `state`
- `country`
- `zip_code`
- `shared_url`
- role and account membership data

## Dashboard Compatibility Layer

The UI still keeps a compatibility layer so existing screens continue to work while names are being normalized.

Examples:

- business and cause list rows still expose `ownerName`, `ownerEmail`, and `city`
- merged account records also expose canonical QA-aligned fields such as `owner_name`, `owner_email`, and `city_name`
- local workflow fields such as `stage`, `campaign_id`, `tasks`, and `notes` remain dashboard-owned until QA support exists

## Dashboard-Only Fields Kept Local For Now

These are still local/dashboard-owned even when a business or cause has a QA account:

- `stage`
- `status`
- `campaign_id`
- `source`
- `source_detail`
- `linked_cause_id`
- `linked_material_id`
- `linked_qr_code_id`
- `linked_qr_collection_id`
- `cover_photo_url`
- `avg_ticket`
- `products_services`
- `launch_phase`
- `activation_status`
- CRM tasks, notes, outreach, materials, QR, stakeholder, and analytics workflow

See [qa-dashboard-backlog.md](/Users/kenne/Downloads/OnboardingLocalvip/docs/qa-dashboard-backlog.md) for the full list of dashboard-only domains that still need QA support.
