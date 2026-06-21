import type { QaBusinessDetail } from '@/lib/crm-api'
import type { Business, Stakeholder } from '@/lib/types/database'
import {
  BusinessJoinResource,
  getBusinessJoinDisplayUrl,
  getBusinessJoinUrl,
  getDefaultBusinessJoinQrAppearance,
  type BusinessJoinQrAppearance,
} from '@/lib/business-join'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { buildStakeholderJoinUrl } from '@/lib/material-engine'
import { sanitizeStakeholderCodeValue } from '@/lib/stakeholder-codes'
import { buildQaAccountMetadata, buildQaBusinessLogoUrl, joinAddress } from '@/lib/server/qa-dashboard-shared'
import { generateShortCode, slugify } from '@/lib/utils'

interface QaStakeholderRecord {
  id: string | number
  name?: string | null
  metadata?: unknown
  businessAccountId?: string | number | null
}

interface QaStakeholderCodeRecord {
  id?: string | number | null
  stakeholderId?: string | number | null
  referralCode?: string | null
  connectionCode?: string | null
  joinUrl?: string | null
  referral_code?: string | null
  connection_code?: string | null
  join_url?: string | null
}

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

const DEFAULT_JOIN_FRAME = 'GET MY OFFER'

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

async function fetchQaStakeholderByBusinessId(businessId: string) {
  const stakeholderRes = await fetchQaApi(`/api/dashboard/v1/Stakeholder?businessAccountId=${encodeURIComponent(businessId)}`)
  const stakeholderJson = await parseQaResponse<unknown>(stakeholderRes, 'Failed to load stakeholder.')
  return asItems<QaStakeholderRecord>(stakeholderJson)[0] || null
}

async function createQaStakeholder(
  qaBusiness: QaBusinessDetail,
  existing: QaStakeholderRecord | null,
) {
  if (existing) return existing

  const metadata = JSON.stringify({
    auto_created: true,
    source: 'dashboard_auto_provision',
    business_name: qaBusiness.name,
    business_account_id: qaBusiness.id,
  })

  try {
    const createRes = await fetchQaApi('/api/dashboard/v1/Stakeholder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'business',
        name: qaBusiness.name,
        businessAccountId: qaBusiness.id,
        status: qaBusiness.active ? 'active' : 'pending',
        source: 'dashboard_auto_provision',
        sourceDetail: 'Auto-created from the business portal or CRM workspace',
        metadata,
      }),
    })
    const created = await parseQaResponse<unknown>(createRes, 'Failed to create stakeholder.')
    return (asItems<QaStakeholderRecord>(created)[0] || null)
  } catch {
    return fetchQaStakeholderByBusinessId(String(qaBusiness.id))
  }
}

async function fetchQaStakeholderCode(stakeholderId: string) {
  try {
    const directRes = await fetchQaApi(`/api/dashboard/v1/StakeholderCode/${encodeURIComponent(stakeholderId)}`)
    const directJson = await parseQaResponse<unknown>(directRes, 'Failed to load stakeholder codes.')
    const direct = asItems<QaStakeholderCodeRecord>(directJson)[0]
    if (direct) return direct
  } catch {
    // Fall through to the query endpoint.
  }

  const listRes = await fetchQaApi(`/api/dashboard/v1/StakeholderCode?stakeholderId=${encodeURIComponent(stakeholderId)}`)
  const listJson = await parseQaResponse<unknown>(listRes, 'Failed to load stakeholder codes.')
  return asItems<QaStakeholderCodeRecord>(listJson)[0] || null
}

function buildCodeSeed(source: string, fallbackPrefix: string) {
  const normalized = sanitizeStakeholderCodeValue(source)
  if (normalized) return normalized
  return sanitizeStakeholderCodeValue(`${fallbackPrefix}-${generateShortCode(6).toLowerCase()}`) || `${fallbackPrefix}-${generateShortCode(6).toLowerCase()}`
}

async function ensureQaStakeholderCodes(
  stakeholder: QaStakeholderRecord,
  qaBusiness: QaBusinessDetail,
) {
  const stakeholderId = String(stakeholder.id)
  const existing = await fetchQaStakeholderCode(stakeholderId)
  const referralCode = sanitizeStakeholderCodeValue(existing?.referralCode || existing?.referral_code)
    || buildCodeSeed(`${qaBusiness.name}-${qaBusiness.id}`, 'biz')
  const connectionCode = sanitizeStakeholderCodeValue(existing?.connectionCode || existing?.connection_code)
    || buildCodeSeed(`${qaBusiness.name}-${stakeholderId}`, 'join')
  const joinUrl = existing?.joinUrl || existing?.join_url || buildStakeholderJoinUrl('business', connectionCode)

  const needsWrite =
    !existing
    || !sanitizeStakeholderCodeValue(existing.referralCode || existing.referral_code)
    || !sanitizeStakeholderCodeValue(existing.connectionCode || existing.connection_code)
    || !(existing.joinUrl || existing.join_url)

  if (needsWrite) {
    const payload = {
      stakeholderId,
      referralCode,
      connectionCode,
      joinUrl,
    }

    // Best-effort persistence: the codes above are already computed locally, so a
    // failure to write them back to QA should not break the whole QR/offer-link
    // resource. Swallow write errors and continue with the computed values.
    try {
      if (existing?.id != null) {
        const putRes = await fetchQaApi(`/api/dashboard/v1/StakeholderCode/${encodeURIComponent(String(existing.id))}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        await parseQaResponse<unknown>(putRes, 'Failed to save stakeholder codes.')
      } else {
        const postRes = await fetchQaApi('/api/dashboard/v1/StakeholderCode', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        await parseQaResponse<unknown>(postRes, 'Failed to create stakeholder codes.')
      }
    } catch {
      // Ignore — fall back to the locally computed codes.
    }
  }

  return {
    id: existing?.id || null,
    stakeholderId,
    referralCode,
    connectionCode,
    joinUrl,
  }
}

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
  const businessRes = await fetchQaApi(`/api/dashboard/v1/Business/${encodeURIComponent(businessId)}`)
  const qaBusiness = await parseQaResponse<QaBusinessDetail>(businessRes, 'Failed to load business.')
  if (!qaBusiness) {
    throw new Error('The QA business could not be loaded.')
  }
  const stakeholder = await createQaStakeholder(qaBusiness, await fetchQaStakeholderByBusinessId(businessId))
  if (!stakeholder?.id) {
    throw new Error('The stakeholder could not be prepared for this business.')
  }

  const codes = await ensureQaStakeholderCodes(stakeholder, qaBusiness)
  return {
    business: qaBusiness,
    stakeholder,
    codes,
  }
}

export async function buildQaBusinessJoinResource(businessId: string): Promise<BusinessJoinResource> {
  const businessRes = await fetchQaApi(`/api/dashboard/v1/Business/${encodeURIComponent(businessId)}`)
  const qaBusiness = await parseQaResponse<QaBusinessDetail>(businessRes, 'Failed to load business.')
  if (!qaBusiness) {
    throw new Error('The QA business could not be loaded.')
  }

  const syntheticBusiness = buildSyntheticBusiness(qaBusiness)
  const appearance = normalizeAppearance(syntheticBusiness, {})
  const offer = buildOfferSummary(await fetchQaCaptureOffer(businessId))

  // Drive the QR + offer link straight off the business's own referral code and
  // Branch.io link from QA. Every QA business is created with these, so there is
  // no stakeholder / StakeholderCode indirection to set up.
  const referralCode = sanitizeStakeholderCodeValue(qaBusiness.referralCode) || `biz-${qaBusiness.id}`
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
    shortCode: referralCode,
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
  }
}

export async function updateQaBusinessStakeholderAppearance(
  businessId: string,
  appearancePatch: Partial<BusinessJoinQrAppearance>,
) {
  // QR appearance is no longer persisted through a stakeholder record. Apply the
  // requested look on top of the business-derived defaults and return the
  // updated resource.
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

  return {
    ...resource,
    frameText: nextAppearance.frameText || resource.frameText,
    logoUrl: nextAppearance.logoUrl,
    qrAppearance: nextAppearance,
  }
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
