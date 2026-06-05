# QA Business Action Map (2026-06-05)

This maps the CRM business detail page and execution workspace to the QA dashboard OpenAPI spec in `C:\Users\kenne\.codex\attachments\502df6ad-d6ac-496d-a241-9a2e15612803\pasted-text.txt`.

Status legend:

- `Aligned`: current code already targets a documented QA endpoint correctly.
- `Aligned via wrapper`: current code uses a local wrapper route, but that route delegates to documented QA endpoints.
- `Needs rewrite`: QA support exists, but the current client or proxy payload/path does not match the spec cleanly.
- `Undocumented / unsupported`: the current action depends on fields or links that are not documented in the QA business API spec.

## Business detail page actions

| Action | Current UI/code path | Current backend path | QA spec target | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Load QA business detail | `page.tsx` -> `BusinessExtrasEditor` / page loader | `GET /api/qa/businesses/{id}` | `GET /api/dashboard/v1/Business/{id}` | Aligned | This is the correct QA-native business read path. |
| Edit business hours + social links | `BusinessExtrasEditor.save()` | `PUT /api/qa/businesses/{id}` | `PUT /api/dashboard/v1/Business/{id}/setup` with `BusinessSetupRequest.businessHours` and `socialLinks` | Aligned via wrapper | Current wrapper correctly translates these two fields. |
| Upload logo | `business-execution-overview.tsx` -> `handleUploadMedia('logo')` | `POST /api/crm/businesses/{id}/media` -> QA upload route | `POST` or `PUT /api/dashboard/v1/Business/{id}/upload-logo` | Aligned via wrapper | Wrapper already uses the documented multipart field name `logoImage`. |
| Upload cover photo | `business-execution-overview.tsx` -> `handleUploadMedia('cover_photo')` | `POST /api/crm/businesses/{id}/media` -> QA upload route | `POST` or `PUT /api/dashboard/v1/Business/{id}/upload-cover-photo` | Aligned via wrapper | Wrapper already uses the documented multipart field name `file`. |
| Save initial connection contact info from lifecycle modal | `InitialConnectionModal.onSave()` -> `updateBusiness(writeBusinessId, { email, phone, website, city_id })` | `PUT /api/qa/businesses/{id}` when `writeBusinessId` is numeric QA id | `PUT /api/dashboard/v1/Business/{id}/setup` with `ownerEmail`, `ownerPhone`, and string address fields | Needs rewrite | Current QA wrapper explicitly rejects `email`, `phone`, `website`, and `city_id`. The spec supports owner email/phone, but not `website` or `cityId` in `BusinessSetupRequest`. |
| Change stage | `handleStageChange()` -> `updateBusiness(localStateBusinessId, { stage })` | Local-only UUID update path | No direct business-stage field documented on `BusinessSetupRequest` or `BusinessStatusRequest` | Undocumented / unsupported | The spec exposes business `active` status and onboarding endpoints, not the old local `stage` field. |
| Mark "not duplicate" | `handleNotDuplicate()` -> `updateBusiness(localStateBusinessId, { duplicate_of: null })` | Local-only UUID update path | No documented duplicate-resolution business endpoint | Undocumented / unsupported | No business duplicate field is present in the spec. |
| Archive as duplicate | `handleArchiveAsDuplicate()` -> `updateBusiness(localStateBusinessId, { status: 'archived' })` | Local-only UUID update path | `PATCH /api/dashboard/v1/Business/{id}/status` with `BusinessStatusRequest.active` | Needs rewrite | QA has a status endpoint, but it is boolean `active`, not the old string status model. |
| Link cause | `handleCauseLinkSave()` -> `updateBusiness(localStateBusinessId, { linked_cause_id })` | Local-only UUID update path | No documented business-to-cause link field on business setup/status | Undocumented / unsupported | This remains a local CRM concept, not a documented QA business field. |
| Link campaign | `handleCampaignLinkSave()` -> `updateBusiness(localStateBusinessId, { campaign_id })` | Local-only UUID update path | No documented business `campaignId` field on business setup/status | Undocumented / unsupported | QA has campaign CRUD, but no documented "attach this business to campaign" business update field. |

## Activity, tasks, and notes tabs

| Action | Current UI/code path | Current backend path | QA spec target | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Log outreach activity from Activity tab | `ActivityTab.handleSubmit()` -> `insertOutreach(...)` | `POST /api/qa/dashboard/outreach_activities` | `POST /api/dashboard/v1/Outreach` with `OutreachCreateRequest` | Aligned via wrapper | Payload shape is mostly correct. `performed_by` is dropped unless it is a numeric QA user id, which is acceptable but worth noting. |
| Log outreach from owner conversation modal | `OwnerConversationModal.onLogOutreach()` -> `insertOutreach(...)` | `POST /api/qa/dashboard/outreach_activities` | `POST /api/dashboard/v1/Outreach` | Aligned via wrapper | Same path as the Activity tab. |
| Add task | `TasksTab.handleSubmit()` -> `insertTask(...)` | `POST /api/qa/dashboard/tasks` | `POST /api/dashboard/v1/Task` with `TaskCreateRequest` | Needs rewrite | The overall endpoint is right, but the current payload still carries Supabase-era fields like `created_by`, and the UI sends `due_date` as a date string while the spec declares `date-time`. |
| Toggle task complete | `TasksTab.toggleComplete()` -> `updateTask(task.id, { status, completed_at })` | `PUT /api/qa/dashboard/tasks/{id}` | `PATCH /api/dashboard/v1/Task/{id}/complete` or `PUT /api/dashboard/v1/Task/{id}` | Needs rewrite | QA exposes a first-class completion endpoint. The current generic update also sends `completed_at`, which is not part of `TaskCreateRequest`. |
| Add note | `NotesTab.handleSubmit()` -> `insertNote(...)` | `POST /api/qa/dashboard/notes` | `POST /api/dashboard/v1/Note` with `NoteCreateRequest` | Aligned via wrapper | The meaningful fields line up. The old `created_by` field is not part of the spec and is effectively optional/no-op in QA mode. |

## Execution workspace actions

| Action | Current UI/code path | Current backend path | QA spec target | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Save stakeholder referral + connection codes | `handleSaveCodes()` | `POST /api/crm/businesses/{id}/materials` | `POST /api/dashboard/v1/StakeholderCode` with `StakeholderCodeCreateRequest` | Aligned via wrapper | The wrapper builds the correct QA payload after resolving the stakeholder. |
| Generate all materials | `handleGenerateMaterials()` / background generation | `POST /api/crm/businesses/{id}/materials` | `POST /api/dashboard/v1/GeneratedMaterial` with `GenerateMaterialRequest` | Aligned via wrapper | Uses stakeholder-scoped material generation as documented. |
| Regenerate all existing materials | `handleRegenerateAll()` | `POST /api/crm/businesses/{id}/materials` | Loop over `POST /api/dashboard/v1/GeneratedMaterial/{id}/regenerate` | Aligned via wrapper | The wrapper fans out to the documented regenerate endpoint. |
| Restore prior material version | `handleRestoreVersion()` | `POST /api/crm/businesses/{id}/materials` | `GET /api/dashboard/v1/GeneratedMaterial/{id}/versions` then `POST /api/dashboard/v1/GeneratedMaterial/{id}/restore?versionId=...` | Aligned via wrapper | Correct QA flow, but currently restores the newest prior version automatically. |
| Complete onboarding step | `handleCompleteStep()` | `POST /api/crm/businesses/{id}/execution` | `PATCH /api/dashboard/v1/Onboarding/steps/{stepId}/complete` | Aligned via wrapper | This is already on the documented QA step-completion endpoint. |
| Save launch/capture offers | `handleSaveOffers()` -> `insertOffer()` / `updateOffer()` | `POST` or `PUT /api/qa/dashboard/offers` | `POST` or `PUT /api/dashboard/v1/Offer` with `OfferCreateRequest` | Needs rewrite | Current offer payload uses local fields like `headline`, `value_type`, `value_label`, `cashback_percent`, `starts_at`, and `ends_at`. The spec expects `title`, `discountValue`, `offerType`, `startDate`, and `endDate`. |
| Save branding media from execution workspace | `handleUploadMedia()` | `POST /api/crm/businesses/{id}/media` | `POST` or `PUT /api/dashboard/v1/Business/{id}/upload-logo` and `/upload-cover-photo` | Aligned via wrapper | This is the correct QA path for branding assets. |
| Save initial connection data from lifecycle modal | `InitialConnectionModal.onSave()` | `PUT /api/qa/businesses/{id}` | `PUT /api/dashboard/v1/Business/{id}/setup` | Needs rewrite | Same mismatch as the business detail card action above. |
| Save offers from launch decision modal | `LaunchDecisionModal.onSaveOffers()` -> `handleSaveOffers()` | `POST` or `PUT /api/qa/dashboard/offers` | `POST` or `PUT /api/dashboard/v1/Offer` | Needs rewrite | Same offer-schema mismatch as above. |

## Critical read-path gaps that affect the page

These are not button clicks, but they directly affect whether the business page can show the right QA-backed workspace state.

| Read path | Current path | QA spec target | Status | Notes |
| --- | --- | --- | --- | --- |
| Stakeholder lookup for QA-only business workspace | `useStakeholders({ business_id })` -> `GET /api/qa/dashboard/stakeholders?business_id=...` | Spec only documents `GET /api/dashboard/v1/Stakeholder` with filters like `type`, `status`, `cityId`, `stage`, `search`, `brand` | Needs rewrite | Current code assumes an undocumented `businessAccountId` filter. The custom materials/execution wrappers make the same assumption. |
| Stakeholder code read | `useStakeholderCodes({ stakeholder_id })` -> `GET /api/qa/dashboard/stakeholder_codes?stakeholder_id=...` | `GET /api/dashboard/v1/StakeholderCode/{stakeholderId}` | Needs rewrite | The current generic list route does not match the documented path-style GET. |
| Onboarding step read | `useOnboardingSteps({ flow_id })` -> `GET /api/qa/dashboard/onboarding_steps?flow_id=...` | `GET /api/dashboard/v1/Onboarding/{flowId}/steps` | Needs rewrite | The generic `onboarding_steps` mapping still points at the base onboarding endpoint, not the documented steps endpoint. |
| QR code read for business workspace | `useQrCodes({ business_id })` -> `GET /api/qa/dashboard/qr_codes?business_id=...` | `GET /api/dashboard/v1/QrCode?entityType=business&entityId=...` | Needs rewrite | The current query key is still Supabase-shaped. The spec uses `entityType` and `entityId`. |

## What the spec clearly supports today

- QA-native business reads and business setup updates.
- QA-native business logo and cover photo uploads.
- Outreach, task, note, offer, contact, QR code, stakeholder, stakeholder code, generated material, and onboarding endpoints.
- A QA-native business local-state endpoint: `GET /api/dashboard/v1/Business/{id}/local-state`.

## Implementation order

1. Add dedicated QA read routes/hooks for stakeholder codes, onboarding steps, and QR codes so the QA-only workspace can load state from documented endpoints.
2. Rewrite business update payload translation for QA-only lifecycle edits so `ownerEmail`, `ownerPhone`, address strings, and other supported `BusinessSetupRequest` fields are sent correctly.
3. Replace the offer save payload mapping with an explicit QA offer translator that writes `title`, `offerType`, `discountValue`, `startDate`, and `endDate`.
4. Decide which legacy CRM-only fields should stay disabled because the QA spec does not document them: `stage`, `duplicate_of`, `linked_cause_id`, and `campaign_id`.
