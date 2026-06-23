# QA Backend Handoff: Business Materials, Template Library, and QR Generation

## Summary

The frontend now treats business materials as two separate views:

1. **Template Library**: available superadmin-created templates the business or onboarding manager can choose from.
2. **My Materials**: only materials that have actually been uploaded, assigned, or generated/chosen for that specific business/cause.

The previous behavior was confusing because superadmin templates appeared in the business `My Materials` page before the business had selected or generated them. That is now blocked on the frontend, but the QA backend should support this model cleanly.

## Frontend Assumptions

The frontend now assumes:

- `MaterialTemplate` rows are library templates only.
- `GeneratedMaterial` rows are the source of truth for chosen/generated business/cause materials.
- A business/cause should not see a template in `My Materials` unless there is a generated/assigned row for that stakeholder.
- `/api/portal/ensure-materials` should prepare stakeholder/material workspace only. It should not auto-generate every available template.
- `/api/portal/generate` should create one `GeneratedMaterial` for the selected template and current stakeholder/business/cause.
- Generated files should include the correct business/cause QR code.
- Generated files need a usable `GeneratedFileUrl` that the dashboard can preview/download.

## Backend Updates Needed

### 1. Generated Material Creation

Endpoint:

`POST /api/dashboard/v1/GeneratedMaterial`

Expected request body from dashboard:

```json
{
  "stakeholderId": "123",
  "templateId": "456"
}
```

Backend should:

- Validate the stakeholder exists.
- Validate the template exists and is active.
- Generate exactly that one template for that stakeholder.
- Return the created/generated material row.
- Avoid generating all templates unless an explicit admin backfill endpoint is called.

Recommended response shape:

```json
{
  "id": 789,
  "stakeholderId": 123,
  "templateId": 456,
  "generatedFileUrl": "/uploads/generated/business-123-template-456.pdf",
  "generatedFileName": "barre-pizza-customer-capture.pdf",
  "libraryFolder": "customer_capture",
  "tags": "business,customer-capture,qr",
  "generationStatus": "completed",
  "isActive": true,
  "isOutdated": false,
  "generatedAt": "2026-06-23T10:00:00Z"
}
```

### 2. QR Must Be Embedded Into Generated Materials

For a QA business, QR data should come from the business customer-capture/join link, not a placeholder.

The frontend currently derives the QR resource from:

`GET /api/business-portal/collect?businessId={businessId}`

That returns:

- `joinUrl`
- `redirectUrl`
- `shortCode`
- `qrCodeId`
- `qrAppearance`

Backend material generation should use equivalent data:

- QR destination: business 100-list/customer capture join URL.
- QR visual: business QR appearance if available.
- QR ID/reference: stable business QR ID or generated QR code record.

Required outcome:

- Generated PDFs/images show a visible QR code.
- QR points to the business join/customer-capture page.
- QR should not be blank or missing because no separate QR row exists.

### 3. Generated Material Listing

Endpoint:

`GET /api/dashboard/v1/GeneratedMaterial?stakeholderId={id}`

Backend should return only generated/chosen rows for that stakeholder, not raw templates.

Required fields:

```json
[
  {
    "id": 789,
    "stakeholderId": 123,
    "templateId": 456,
    "generatedFileUrl": "/uploads/generated/business-123-template-456.pdf",
    "generatedFileName": "barre-pizza-customer-capture.pdf",
    "libraryFolder": "customer_capture",
    "tags": "business,customer-capture,qr",
    "generationStatus": "completed",
    "versionNumber": 1,
    "isActive": true,
    "isOutdated": false,
    "generatedAt": "2026-06-23T10:00:00Z",
    "updatedAt": "2026-06-23T10:00:00Z"
  }
]
```

Status mapping currently accepted by frontend:

- `completed` or `complete` maps to `generated`.
- `error` or `failed` maps to `failed`.
- `pending` stays pending.

### 4. Generated Material Delete

Endpoint:

`DELETE /api/dashboard/v1/GeneratedMaterial/{id}`

Backend should delete or deactivate the generated material by numeric backend ID.

Important:

- Frontend UI IDs may display internally as `gen-{id}` to distinguish generated rows from uploaded material rows.
- The dashboard delete helper strips `gen-` before calling the QA backend.
- Backend should receive only the real ID, e.g. `789`, not `gen-789`.

Expected behavior:

- Delete/deactivate generated material.
- Return success.
- Do not require `Material` table ID for generated rows.

### 5. Template Library Listing

Endpoint:

`GET /api/dashboard/v1/MaterialTemplate`

Templates should include:

```json
{
  "id": 456,
  "name": "Customer Capture Flyer",
  "templateType": "material_asset",
  "outputFormat": "pdf",
  "audienceTags": "business,customer-capture",
  "stakeholderTypes": "business",
  "libraryFolder": "customer_capture",
  "isActive": true,
  "tiers": "selfserve",
  "metadata": {
    "description": "Flyer for collecting first 100 customers."
  }
}
```

Required:

- Superadmin-created templates should be returned here.
- Business/cause accounts can browse these in Template Library.
- Templates should not appear in My Materials unless generated/assigned.

### 6. CRM/Admin Template Selection

The onboarding manager/admin should be able to generate materials for a business/cause from CRM.

Needed backend support:

- Same single-template generation behavior as self-serve.
- Optional batch endpoint for admin-selected templates only.
- Optional explicit backfill endpoint for generating all defaults, but this must be admin-only and not run from business portal workspace preparation.

Recommended admin batch endpoint:

`POST /api/dashboard/v1/GeneratedMaterial/batch`

```json
{
  "stakeholderId": 123,
  "templateIds": [456, 457, 458]
}
```

### 7. File URL Handling

Generated file URLs must be browser-accessible from the Netlify dashboard.

Acceptable:

- Absolute URL: `https://qa.localvip.com/uploads/generated/file.pdf`
- Relative URL: `/uploads/generated/file.pdf`, as long as it resolves correctly against QA host.

Avoid:

- Local filesystem paths.
- Private storage URLs requiring backend auth without signed URL support.
- Null `GeneratedFileUrl` for completed rows.

## Current Frontend Safeguards

Frontend changes already made:

- `My Materials` uses `GeneratedMaterial` rows for selected/generated materials.
- `My Materials` includes a dedicated customer QR card for business accounts.
- `Template Library` remains the browse/add page.
- `/api/portal/ensure-materials` no longer auto-generates all templates.
- Generated rows are labeled `Generated from template`.
- Generated material delete goes through the generated-material endpoint.

## Open Backend Questions

1. Does QA have a durable generated-material table separate from templates?
2. Can generated materials store `businessAccountId` or `causeAccountId` in addition to `stakeholderId`?
3. Does QA generation currently render QR zones from template metadata?
4. Should QR code scans be tied to a real QR code row, or can the business referral/join URL be the source of truth?
5. Should admin-selected materials be marked `userAccepted=true`, `isActive=true`, or both?

## Definition of Done

This is complete when:

- A superadmin can create a template.
- A business can see that template in Template Library.
- The template does not appear in My Materials yet.
- The business clicks `Add to My Materials`.
- A `GeneratedMaterial` row is created for that stakeholder/business.
- The generated file includes a visible QR code.
- The QR points to the business customer-capture/join page.
- The generated material appears in My Materials.
- The generated material can be previewed/downloaded.
- The generated material can be deleted/deactivated without `gen-1 is not valid` errors.

