# Material System V2 Implementation Plan

## Outcome

One material classification and eligibility system powers admin upload, automated generation, optional customization, ready-to-use resources, and every stakeholder library.

The user-facing model answers five questions:

1. What is it?
2. Who is it for?
3. What does it help them do?
4. Where is it available?
5. How is it delivered?

Legacy role, subtype, scope, folder, tier, and tag fields remain internal during migration. Users do not need to understand them.

## Canonical material contract

### Type

- flyer
- poster
- social_post
- email
- text_message
- presentation
- guide
- video
- other

### Audience

- customers_families
- businesses
- schools
- causes_nonprofits
- launch_partners
- field_team
- influencers
- internal_team
- everyone

Multiple audiences are allowed. Everyone is exclusive.

### Purpose

One primary purpose and one optional secondary purpose:

- explain_localvip
- join_localvip
- invite_customers
- recruit_businesses
- recruit_schools_causes
- promote_offer
- promote_give_back_day
- explain_payments_rewards
- complete_onboarding
- training_internal_support
- recruit_supporters
- promote_campaign

### Availability

- everywhere
- selected_cities
- selected_campaigns
- selected_causes
- selected_businesses
- internal_only

Restricted modes contain explicit entity identifiers. Everywhere and internal only contain no entity identifiers.

### Delivery

- automatic
- customizable
- ready_to_use

Delivery does not determine access. Audience, availability, publication status, and entity state determine access. Delivery determines whether LocalVIP generates a file, offers a template, or exposes a finished resource.

## One eligibility engine

All previews, search checks, libraries, and generation jobs call the same server-side evaluator.

Input:

- normalized material targeting
- entity or user identity
- linked accounts
- city and campaign memberships
- entity status
- template requirements
- current generated versions

Output:

- canAccess
- canCustomize
- canGenerate
- access status: eligible, blocked, ineligible, generated, outdated
- matched rules
- failed rules
- missing-data blockers
- access-through entity for linked users

No client may recreate eligibility rules independently.

## Admin upload flow

### Step 1: File and details

- drag and drop
- preview
- title inferred from filename
- optional description
- type
- brand

### Step 2: Audience

Large audience cards with plain-language descriptions. Multiple selections are permitted except Everyone.

### Step 3: Purpose

Show only purposes relevant to the chosen audience. Select one primary and optionally one secondary purpose.

### Step 4: Availability and delivery

Default availability to Everywhere. Reveal city, campaign, cause, or business selectors only when the uploader limits availability.

Choose Automatic, Customizable, or Ready to use. Reveal template configuration only for Automatic or Customizable.

### Automatic review reach

Before activation, show:

- will receive it
- will not receive it
- missing required data
- already generated
- outdated
- would generate now

Provide a paginated entity table, type and status filters, reasons, blockers, and a search checker that returns green, yellow, red, or blue status.

Allow a one-entity personalized preview before generation.

Generation controls:

- all eligible
- only missing
- only outdated
- explicitly selected entities
- one test entity

Require a count confirmation for 250 or more new or replaced files. All bulk work runs as a background job with progress and a saved audience snapshot.

## Stakeholder libraries

### Shared sections

- Made for you
- Customize a template
- Resource library
- Saved and recent

The same eligibility result decides inclusion. Delivery decides the section.

### Business

Organize by Start here, Bring in customers, Promote an offer, Support your cause, Grow your business network, and Saved files. Insert business name, logo, offer, slow day, cause, referral link, and QR code where supported.

### Cause or school

Label the area Campaign Materials. Organize by Launch your campaign, Recruit supporters, Recruit businesses, Keep the community engaged, Brand library, and Saved files. Insert cause identity, branding, supporter and business links, landing-page URL, and QR codes.

### Customer or family

Label the area Share LocalVIP. Present My links and images, Create something to share, and Helpful resources. Actions are Share, Copy link, Copy message, and Save image. Do not expose library or template terminology.

### Launch partner, field team, and influencer

Organize around assigned cities, campaigns, current tasks, outreach targets, training, and personal referral attribution.

### Admin

Provide the same simple library plus an Advanced targeting area for exact scopes, evaluator explanations, versions, assignments, generation history, and audit data.

## Contextual delivery

Onboarding and task cards link directly to the correct material or missing prerequisite. A missing logo warning opens the logo field. A recruit-businesses task opens the approved recruitment kit. Users should not search for a file the dashboard already knows they need.

## Data migration

1. Add the normalized targeting record and delivery mode.
2. Map legacy roles and subtypes to audiences.
3. Map category and use case to purposes.
4. Map folders and scopes to availability.
5. Map template tiers to delivery.
6. Combine legacy custom and automation tags into search tags.
7. Produce a conflict report instead of guessing contradictory records.
8. Dual-read new first and legacy second.
9. Dual-write compatibility fields during rollout.
10. Compare old and new visibility for every existing material.
11. Retire legacy controls only after production verification.

## Verification matrix

Test each delivery mode against every audience and availability mode, including linked users with multiple entities. Verify eligible, blocked, ineligible, generated, and outdated results. Confirm preview, search, library display, and generation return the same decision and reasons.

Security checks verify internal-only isolation, inactive material exclusion, cross-city and cross-campaign isolation, membership enforcement, admin-only activation, and server-side pagination.

## Deployment gate

No deployment occurs until:

- migrations apply cleanly
- backend and dashboard builds pass
- eligibility and parity tests pass
- legacy visibility comparison is reviewed
- local smoke tests cover admin, business, cause, and customer paths
- the final commit list and deployment order are presented to the owner
- the owner explicitly approves deployment

