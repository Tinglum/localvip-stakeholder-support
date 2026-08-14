import type { QaBusinessDetail } from '@/lib/crm-api'
import type { Business } from '@/lib/types/database'
import {
  BusinessJoinResource,
  getBusinessJoinDisplayUrl,
  getBusinessJoinUrl,
  getDefaultBusinessJoinQrAppearance,
  type BusinessJoinQrAppearance,
} from '@/lib/business-join'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { sanitizeStakeholderCodeValue } from '@/lib/stakeholder-codes'
import { buildQaAccountMetadata, buildQaBusinessLogoUrl, joinAddress } from '@/lib/server/qa-dashboard-shared'
import { slugify } from '@/lib/utils'
import { ENGAGEMENT_CODES, isBoomerangEnabled } from '@/lib/engagement-codes'

interface QaOfferRecord {
  id?: string | number | null
  title?: string | null
  headline?: string | null
  name?: string | null
  description?: string | null
  valueLabel?: string | null
  value_label?: string | null
  discountValue?: string | number | null
  discount_value?: string | number | null
  offerType?: string | null
  offer_type?: string | null
  type?: string | null
  status?: string | null
}

interface QaQrCodeRecord {
  id?: string | number | null
  code?: string | null
  targetUrl?: string | null
  target_url?: string | null
  qrImageUrl?: string | null
  qr_image_url?: string | null
  metadata?: unknown
}

const DEFAULT_JOIN_FRAME = 'GET MY OFFER'
const qaEngagementAssetPromises = new Map<string, Promise<QaBusinessEngagementAssets>>()

export interface QaBusinessQrAsset {
  id: string
  code: string | null
  targetUrl: string
  qrImageUrl: string | null
  logoUrl: string | null
}

/**
 * Two intentionally separate distribution channels for a business.
 *
 * Boomerang assets build the business's own customer list. LocalVIP referral
 * assets add people, businesses, or causes to the LocalVIP network. Neither
 * value may be inferred from the other.
 *
 * Every Boomerang field is nullable because the business may have declined the
 * Boomerang list, in which case none of it is created. Callers must handle null
 * rather than assume a capture asset always exists.
 */
export interface QaBusinessEngagementAssets {
  business: QaBusinessDetail
  customerCapture: {
    captureCode: string | null
    captureUrl: string | null
    qrCode: QaBusinessQrAsset | null
    /** Why this QR is missing, when it should have been there. */
    error: string | null
  }
  networkReferral: {
    networkReferralCode: string | null
    networkReferralUrl: string | null
    qrCode: QaBusinessQrAsset | null
    /** Why this QR is missing, when it should have been there. */
    error: string | null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (isRecord(value) && Array.isArray(value.items)) return value.items as T[]
  if (isRecord(value)) return [value as T]
  return []
}

function buildSyntheticBusiness(qaBusiness: QaBusinessDetail): Business {
  return {
    id: String(qaBusiness.id),
    name: qaBusiness.name,
    website: null,
    email: qaBusiness.ownerEmail || null,
    phone: qaBusiness.ownerPhone || null,
    address:
      qaBusiness.fullAddress ||
      joinAddress([
        qaBusiness.address1,
        qaBusiness.address2,
        qaBusiness.city,
        qaBusiness.state,
        qaBusiness.zipCode,
        qaBusiness.country,
      ]) ||
      null,
    city_id: null,
    category: null,
    brand: 'localvip',
    stage: 'lead',
    owner_id: null,
    owner_user_id: null,
    source: 'qa_server',
    source_detail: 'QA business',
    campaign_id: null,
    linked_cause_id: null,
    linked_material_id: null,
    linked_qr_code_id: null,
    logo_url: buildQaBusinessLogoUrl(qaBusiness),
    cover_photo_url: null,
    linked_qr_collection_id: null,
    duplicate_of: null,
    external_id: String(qaBusiness.id),
    public_description: qaBusiness.description || null,
    avg_ticket: null,
    products_services: null,
    activation_status: null,
    launch_phase: null,
    status: qaBusiness.active ? 'active' : 'inactive',
    metadata: {
      qaAccountId: qaBusiness.id,
      qaBusinessId: qaBusiness.id,
      qaApi: buildQaAccountMetadata(qaBusiness),
    },
    created_at: qaBusiness.createdDate,
    updated_at: qaBusiness.createdDate,
  }
}

function normalizeAppearance(
  business: Business,
  metadata: Record<string, unknown>,
): BusinessJoinQrAppearance {
  const defaults = getDefaultBusinessJoinQrAppearance(business)
  const raw = isRecord(metadata.qr_appearance) ? metadata.qr_appearance : {}
  const useBusinessLogo = raw.useBusinessLogo !== false
  const gradientColors = Array.isArray(raw.gradientColors)
    && raw.gradientColors.length >= 2
    && typeof raw.gradientColors[0] === 'string'
    && typeof raw.gradientColors[1] === 'string'
    ? [raw.gradientColors[0], raw.gradientColors[1]] as [string, string]
    : defaults.gradientColors

  return {
    ...defaults,
    foregroundColor: typeof raw.foregroundColor === 'string' ? raw.foregroundColor : defaults.foregroundColor,
    backgroundColor: typeof raw.backgroundColor === 'string' ? raw.backgroundColor : defaults.backgroundColor,
    frameText: typeof raw.frameText === 'string' && raw.frameText.trim() ? raw.frameText : defaults.frameText,
    useBusinessLogo,
    logoUrl: useBusinessLogo ? defaults.logoUrl : null,
    dotStyle: raw.dotStyle === 'square' || raw.dotStyle === 'rounded' || raw.dotStyle === 'dots' || raw.dotStyle === 'classy' || raw.dotStyle === 'classy-rounded' || raw.dotStyle === 'extra-rounded'
      ? raw.dotStyle
      : defaults.dotStyle,
    cornerStyle: raw.cornerStyle === 'square' || raw.cornerStyle === 'rounded' || raw.cornerStyle === 'dots' || raw.cornerStyle === 'extra-rounded'
      ? raw.cornerStyle
      : defaults.cornerStyle,
    gradientType: raw.gradientType === 'linear' || raw.gradientType === 'radial' || raw.gradientType === 'none'
      ? raw.gradientType
      : defaults.gradientType,
    gradientColors,
  }
}

function getQaBusinessNetworkReferralCode(qaBusiness: QaBusinessDetail) {
  return sanitizeStakeholderCodeValue(qaBusiness.referralCode)
}

function parseQrMetadata(value: unknown) {
  if (isRecord(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

type QaQrPurpose = 'business_capture' | 'business_network_referral'

/**
 * Find this business's existing QR for a purpose.
 *
 * Identity is the CODE, not the target URL. The old version also required
 * `recordTarget === targetUrl`, which is what produced "QR code already
 * exists.": the backend enforces uniqueness on Code alone and globally, so as
 * soon as a stored row's target drifted from the one being requested — a
 * changed join-URL base, a business that gained a branchReferralUrl — the
 * lookup missed a row whose slug was identical, the caller went on to create a
 * duplicate of that slug, and the backend rejected it. The rejection then took
 * down the whole engagement-assets call, so the logo and the LocalVIP referral
 * link disappeared along with it.
 *
 * It also queries by entityId only, without pinning entityType, so a row
 * written under an older entityType is still found instead of being duplicated.
 */
async function findQaBusinessQr(
  businessId: string,
  purpose: QaQrPurpose,
  code: string,
) {
  const response = await fetchQaApi(
    `/api/dashboard/v1/QrCode?entityId=${encodeURIComponent(businessId)}&pageSize=200`,
  )
  const json = await parseQaResponse<unknown>(response, 'Failed to load business QR codes.')
  const records = asItems<QaQrCodeRecord>(json)

  // The code is the uniqueness key the backend actually enforces, so match it
  // first and ignore where the row currently points.
  const byCode = records.find((record) => (record.code || '') === code)
  if (byCode) return byCode

  return records.find((record) => {
    const metadata = parseQrMetadata(record.metadata)
    return metadata.purpose === purpose
      && String(metadata.business_account_id || '') === businessId
  }) || null
}

async function ensureQaBusinessQr(
  qaBusiness: QaBusinessDetail,
  input: {
    purpose: QaQrPurpose
    name: string
    code: string
    targetUrl: string
    metadata: Record<string, unknown>
  },
) {
  const businessId = String(qaBusiness.id)
  const logoUrl = buildQaBusinessLogoUrl(qaBusiness)
  let qrCode = await findQaBusinessQr(businessId, input.purpose, input.code)

  if (!qrCode) {
    const metadata = {
      name: input.name,
      purpose: input.purpose,
      business_account_id: qaBusiness.id,
      business_id: String(qaBusiness.id),
      logo_url: logoUrl,
      qr_appearance: {
        useBusinessLogo: Boolean(logoUrl),
        logoUrl,
        dotStyle: 'rounded',
        cornerStyle: 'rounded',
        errorCorrectionLevel: 'H',
      },
      ...input.metadata,
    }

    try {
      const response = await fetchQaApi('/api/dashboard/v1/QrCode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entityType: input.purpose,
          entityId: qaBusiness.id,
          code: input.code,
          targetUrl: input.targetUrl,
          metadata: JSON.stringify(metadata),
        }),
      })
      qrCode = await parseQaResponse<QaQrCodeRecord>(response, 'Failed to create the business QR code.')
    } catch (error) {
      // Two ways to land here: a genuine race, or the slug already exists on a
      // row this business's lookup does not reach. Either way the row exists,
      // so look again rather than failing.
      qrCode = await findQaBusinessQr(businessId, input.purpose, input.code)
      if (!qrCode) throw error
    }
  }

  if (!qrCode?.id) throw new Error('The business QR code could not be prepared.')

  // A reused row can still point at where it pointed when it was made. Since we
  // now match on the code rather than the target, that drift is no longer a
  // reason to fail — but it must be corrected, not ignored, or the QR keeps
  // sending people to the old destination.
  let storedTarget = qrCode.targetUrl || qrCode.target_url || ''
  if (storedTarget && storedTarget !== input.targetUrl) {
    try {
      const patch = await fetchQaApi(`/api/dashboard/v1/QrCode/${encodeURIComponent(String(qrCode.id))}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUrl: input.targetUrl }),
      })
      await parseQaResponse<unknown>(patch, 'Failed to update the business QR destination.')
      storedTarget = input.targetUrl
    } catch {
      // Report where it ACTUALLY points, rather than where we wish it did.
      // Claiming the new URL while the row still holds the old one would make
      // this impossible to diagnose from the screen.
    }
  }

  return {
    id: String(qrCode.id),
    code: qrCode.code || null,
    targetUrl: storedTarget || input.targetUrl,
    qrImageUrl: qrCode.qrImageUrl || qrCode.qr_image_url || null,
    logoUrl,
  }
}

export function ensureQaBusinessEngagementAssets(businessId: string) {
  const key = String(businessId)
  const active = qaEngagementAssetPromises.get(key)
  if (active) return active

  const operation = (async () => {
    const ensureRes = await fetchQaApi(
      `/api/dashboard/v1/Business/${encodeURIComponent(businessId)}/ensure-referral-assets`,
      { method: 'POST' },
    )
    await parseQaResponse<unknown>(ensureRes, 'Failed to prepare the business referral assets.')

    const businessRes = await fetchQaApi(`/api/dashboard/v1/Business/${encodeURIComponent(businessId)}`)
    const qaBusiness = await parseQaResponse<QaBusinessDetail>(businessRes, 'Failed to load business.')
    if (!qaBusiness) throw new Error('The QA business could not be loaded.')

    // The Boomerang QR is only PROVISIONED for a business that opted in.
    //
    // Hiding the Boomerang surfaces was not enough: this function ran on every
    // call to /api/portal/qr-context, so merely opening the QR dialog minted a
    // business_capture QR for a business that had answered "Not right now". The
    // asset then existed, with a live join URL, for a business that declined the
    // whole feature. Gating display without gating creation is not an opt-out.
    const boomerangEnabled = isBoomerangEnabled(qaBusiness.hundredListInterest ?? null)
    const captureCode = boomerangEnabled ? buildJoinSlug(qaBusiness) : null
    const captureUrl = captureCode ? getBusinessJoinUrl(captureCode) : null
    // Each QR is provisioned independently and reports its own failure.
    //
    // These used to throw straight out of the function, so ONE QR that could
    // not be prepared nulled the entire context — the business logo, the
    // LocalVIP referral link and the styled templates all vanished with it,
    // and the dialog showed the raw backend string where the destination URL
    // belongs. The logo does not depend on the capture QR existing.
    let captureError: string | null = null
    const captureQr = captureCode && captureUrl
      ? await ensureQaBusinessQr(qaBusiness, {
          purpose: 'business_capture',
          name: `${qaBusiness.name} ${ENGAGEMENT_CODES.business_capture.qrLabel}`,
          code: captureCode,
          targetUrl: captureUrl,
          metadata: {
            capture_code: captureCode,
            capture_url: captureUrl,
          },
        }).catch((error: unknown) => {
          captureError = error instanceof Error ? error.message : 'The Boomerang list QR could not be prepared.'
          return null
        })
      : null

    const networkReferralCode = getQaBusinessNetworkReferralCode(qaBusiness)
    const networkReferralUrl = qaBusiness.branchReferralUrl?.trim()
      || (networkReferralCode
        ? `https://my.localvip.com/auth/signup?ref=${encodeURIComponent(networkReferralCode)}`
        : null)
    let networkError: string | null = null
    const networkQr = networkReferralCode && networkReferralUrl
      ? await ensureQaBusinessQr(qaBusiness, {
          purpose: 'business_network_referral',
          name: `${qaBusiness.name} ${ENGAGEMENT_CODES.business_network_referral.qrLabel}`,
          code: `network-${qaBusiness.id}-${networkReferralCode}`,
          targetUrl: networkReferralUrl,
          metadata: {
            network_referral_code: networkReferralCode,
            network_referral_url: networkReferralUrl,
          },
        }).catch((error: unknown) => {
          networkError = error instanceof Error ? error.message : 'The LocalVIP referral QR could not be prepared.'
          return null
        })
      : null

    return {
      business: qaBusiness,
      customerCapture: { captureCode, captureUrl, qrCode: captureQr, error: captureError as string | null },
      networkReferral: {
        networkReferralCode,
        networkReferralUrl,
        qrCode: networkQr,
        error: networkError as string | null,
      },
    }
  })().finally(() => {
    qaEngagementAssetPromises.delete(key)
  })

  qaEngagementAssetPromises.set(key, operation)
  return operation
}

/** @deprecated Use ensureQaBusinessEngagementAssets for explicit capture/network assets. */
export const ensureQaBusinessReferralAssets = ensureQaBusinessEngagementAssets

async function fetchQaCaptureOffer(businessId: string) {
  try {
    const offersRes = await fetchQaApi(`/api/dashboard/v1/Offer?businessAccountId=${encodeURIComponent(businessId)}`)
    const offersJson = await parseQaResponse<unknown>(offersRes, 'Failed to load offers.')
    const offers = asItems<QaOfferRecord>(offersJson)
    return offers.find((offer) => {
      const type = `${offer.offerType || offer.offer_type || offer.type || ''}`.toLowerCase()
      return type === 'capture'
    }) || offers.find((offer) => `${offer.status || ''}`.toLowerCase() === 'active') || offers[0] || null
  } catch {
    return null
  }
}

function buildOfferSummary(offer: QaOfferRecord | null) {
  const title = offer?.headline || offer?.title || offer?.name || 'Join our list and get access to exclusive offers'
  const description = offer?.description || 'Join our list and be part of something local.'
  const rawValue = offer?.valueLabel ?? offer?.value_label ?? offer?.discountValue ?? offer?.discount_value ?? null
  return {
    title,
    description,
    value: rawValue == null ? null : String(rawValue),
  }
}

function buildJoinSlug(qaBusiness: QaBusinessDetail) {
  return slugify(`${qaBusiness.name}-${qaBusiness.id}`) || `business-${qaBusiness.id}`
}

export async function ensureQaBusinessStakeholderContext(businessId: string) {
  const assets = await ensureQaBusinessEngagementAssets(businessId)
  return {
    business: assets.business,
    // Compatibility for older material callers. This is a synthetic local shape;
    // no QA Stakeholder endpoint is read or written.
    stakeholder: {
      id: `qa-business-${assets.business.id}`,
      name: assets.business.name,
      businessAccountId: assets.business.id,
    },
    codes: {
      referralCode: assets.networkReferral.networkReferralCode,
      joinUrl: assets.customerCapture.captureUrl,
    },
    qrCode: assets.customerCapture.qrCode,
  }
}

export async function buildQaBusinessJoinResource(businessId: string): Promise<BusinessJoinResource> {
  const businessRes = await fetchQaApi(`/api/dashboard/v1/Business/${encodeURIComponent(businessId)}`)
  const qaBusiness = await parseQaResponse<QaBusinessDetail>(businessRes, 'Failed to load business.')
  if (!qaBusiness) {
    throw new Error('The QA business could not be loaded.')
  }

  const syntheticBusiness = buildSyntheticBusiness(qaBusiness)
  // The saved look is persisted as a JSON blob on the business (Account.QrAppearance).
  // normalizeAppearance reads it from metadata.qr_appearance and falls back to the
  // business-derived defaults for any field that isn't set.
  let storedAppearance: Record<string, unknown> = {}
  const rawStored = (qaBusiness as { qrAppearance?: string | null }).qrAppearance
  if (rawStored) {
    try {
      const parsed = JSON.parse(rawStored)
      if (parsed && typeof parsed === 'object') storedAppearance = { qr_appearance: parsed }
    } catch {
      /* ignore malformed stored appearance */
    }
  }
  const appearance = normalizeAppearance(syntheticBusiness, storedAppearance)
  const offer = buildOfferSummary(await fetchQaCaptureOffer(businessId))

  // Drive the QR + offer link straight off the business's own referral code and
  // Branch.io link from QA. Every QA business is created with these, so there is
  // no stakeholder / StakeholderCode indirection to set up.
  const joinSlug = buildJoinSlug(qaBusiness)
  // The QR + offer link must point at our own "100-list" join page (which shows
  // the capture offer and the join form), NOT the branch.io app deep link.
  const joinUrl = getBusinessJoinUrl(joinSlug)

  return {
    businessId: String(qaBusiness.id),
    businessName: qaBusiness.name,
    brand: 'localvip',
    joinSlug,
    joinUrl,
    displayUrl: getBusinessJoinDisplayUrl(joinUrl),
    redirectUrl: joinUrl,
    // `shortCode` is only a legacy display field. Capture identity is joinSlug;
    // the owner referral code is kept in the explicit network fields below.
    shortCode: joinSlug,
    qrCodeId: `qa-business-${qaBusiness.id}`,
    frameText: appearance.frameText || DEFAULT_JOIN_FRAME,
    logoUrl: appearance.logoUrl,
    qrAppearance: appearance,
    offerTitle: offer.title,
    offerDescription: offer.description,
    offerValue: offer.value,
    supportLabel: 'Used to get your first 100 customers',
    // The LocalVIP network (node) referral link — for inviting people onto the
    // platform. Separate from joinUrl (the 100-list customer page).
    appReferralUrl: (qaBusiness.branchReferralUrl || '').trim() || null,
    networkReferralCode: getQaBusinessNetworkReferralCode(qaBusiness),
    networkReferralUrl: (qaBusiness.branchReferralUrl || '').trim() || null,
  }
}

export async function updateQaBusinessStakeholderAppearance(
  businessId: string,
  appearancePatch: Partial<BusinessJoinQrAppearance>,
) {
  // Merge the requested look onto whatever is currently saved (or the defaults),
  // then PERSIST it on the business so it survives reloads. Stakeholders are gone;
  // the look now lives in Account.QrAppearance (JSON), round-tripped by the
  // Business detail/setup endpoints.
  const resource = await buildQaBusinessJoinResource(businessId)
  const current = resource.qrAppearance
  const nextAppearance: BusinessJoinQrAppearance = {
    ...current,
    ...appearancePatch,
    useBusinessLogo: appearancePatch.useBusinessLogo ?? current.useBusinessLogo,
    logoUrl: (appearancePatch.useBusinessLogo ?? current.useBusinessLogo) ? current.logoUrl : null,
    gradientColors: Array.isArray(appearancePatch.gradientColors) && appearancePatch.gradientColors.length >= 2
      ? [appearancePatch.gradientColors[0], appearancePatch.gradientColors[1]]
      : current.gradientColors,
  }

  // Only the user-chosen fields are stored; logoUrl is derived from useBusinessLogo
  // at read time, so it isn't persisted.
  const toStore = {
    foregroundColor: nextAppearance.foregroundColor,
    backgroundColor: nextAppearance.backgroundColor,
    frameText: nextAppearance.frameText,
    useBusinessLogo: nextAppearance.useBusinessLogo,
    dotStyle: nextAppearance.dotStyle,
    cornerStyle: nextAppearance.cornerStyle,
    gradientType: nextAppearance.gradientType,
    gradientColors: nextAppearance.gradientColors,
  }
  const saveRes = await fetchQaApi(`/api/dashboard/v1/Business/${encodeURIComponent(businessId)}/setup`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrAppearance: JSON.stringify(toStore) }),
  })
  await parseQaResponse(saveRes, 'The QR appearance could not be saved.')

  // Rebuild from the persisted state so the caller gets exactly what's now stored.
  return buildQaBusinessJoinResource(businessId)
}

export function buildImportedBusinessPayload(
  actorId: string | null,
  qaBusiness: QaBusinessDetail,
): Partial<Business> {
  return {
    name: qaBusiness.name,
    website: null,
    email: qaBusiness.ownerEmail || null,
    phone: qaBusiness.ownerPhone || null,
    address:
      qaBusiness.fullAddress ||
      joinAddress([
        qaBusiness.address1,
        qaBusiness.address2,
        qaBusiness.city,
        qaBusiness.state,
        qaBusiness.zipCode,
        qaBusiness.country,
      ]) ||
      null,
    city_id: null,
    category: null,
    brand: 'localvip',
    stage: 'lead',
    owner_id: actorId,
    owner_user_id: null,
    source: 'qa_server',
    source_detail: 'Imported from QA on first open',
    campaign_id: null,
    linked_cause_id: null,
    linked_material_id: null,
    linked_qr_code_id: null,
    logo_url: buildQaBusinessLogoUrl(qaBusiness),
    cover_photo_url: null,
    linked_qr_collection_id: null,
    duplicate_of: null,
    external_id: String(qaBusiness.id),
    public_description: qaBusiness.description || null,
    avg_ticket: null,
    products_services: null,
    activation_status: null,
    launch_phase: null,
    status: qaBusiness.active ? 'active' : 'inactive',
    metadata: {
      created_from: 'qa_business_import',
      qa_import_mode: 'first_open',
      imported_by: actorId,
      qaAccountId: qaBusiness.id,
      qaBusinessId: qaBusiness.id,
      qaImportedAt: new Date().toISOString(),
      qaApi: buildQaAccountMetadata(qaBusiness),
    },
  }
}

export function buildImportedBusinessSyncPatch(
  localBusiness: Business | null,
  qaBusiness: QaBusinessDetail,
): Partial<Business> {
  return {
    name: qaBusiness.name,
    email: qaBusiness.ownerEmail || localBusiness?.email || null,
    phone: qaBusiness.ownerPhone || localBusiness?.phone || null,
    address:
      qaBusiness.fullAddress ||
      joinAddress([
        qaBusiness.address1,
        qaBusiness.address2,
        qaBusiness.city,
        qaBusiness.state,
        qaBusiness.zipCode,
        qaBusiness.country,
      ]) ||
      localBusiness?.address ||
      null,
    logo_url: buildQaBusinessLogoUrl(qaBusiness) || localBusiness?.logo_url || null,
    external_id: String(qaBusiness.id),
    public_description: qaBusiness.description || localBusiness?.public_description || null,
    status:
      localBusiness?.status === 'archived'
        ? 'archived'
        : qaBusiness.active
          ? 'active'
          : 'inactive',
    metadata: {
      ...((localBusiness?.metadata as Record<string, unknown> | null) || {}),
      qaAccountId: qaBusiness.id,
      qaBusinessId: qaBusiness.id,
      qaImportedAt: new Date().toISOString(),
      qaApi: buildQaAccountMetadata(qaBusiness),
    },
  }
}
