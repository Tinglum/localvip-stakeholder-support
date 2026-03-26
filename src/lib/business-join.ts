import type { Business, Profile, QrCode } from '@/lib/types/database'
import { getBusinessOfferTitle, getBusinessPortalData } from '@/lib/business-portal'
import { normalizeDomain, slugify } from '@/lib/utils'

export interface BusinessJoinCaptureData {
  join_slug?: string
  join_url?: string
  redirect_url?: string
  short_code?: string
  qr_code_id?: string
  last_synced_at?: string
  future_hooks?: {
    sms_after_signup?: boolean
    email_confirmation?: boolean
    referral_tracking?: boolean
    school_cause_attribution?: boolean
    stakeholder_variants?: boolean
  }
}

export interface BusinessJoinResource {
  businessId: string
  businessName: string
  brand: 'localvip' | 'hato'
  joinSlug: string
  joinUrl: string
  displayUrl: string
  redirectUrl: string
  shortCode: string
  qrCodeId: string
  frameText: string
  logoUrl: string | null
  offerTitle: string
  offerDescription: string
  offerValue: string | null
  supportLabel: string
}

export function getAppBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (configured) return configured
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  return 'https://localvip.com'
}

export function getBusinessJoinCaptureData(business: Business | null | undefined): BusinessJoinCaptureData {
  const metadata = (business?.metadata as Record<string, unknown> | null) || null
  const capture = metadata?.customer_capture
  return capture && typeof capture === 'object'
    ? capture as BusinessJoinCaptureData
    : {}
}

export function getBusinessJoinSlugCandidate(business: Pick<Business, 'id' | 'name'>) {
  const base = slugify(business.name) || 'business'
  const suffix = business.id.replace(/-/g, '').slice(0, 6).toLowerCase()
  return `${base}-${suffix}`
}

export function getBusinessJoinSlug(business: Business) {
  return getBusinessJoinCaptureData(business).join_slug || getBusinessJoinSlugCandidate(business)
}

export function getBusinessJoinPath(slug: string) {
  return `/join/${slug}`
}

export function getBusinessJoinUrl(slug: string, baseUrl = getAppBaseUrl()) {
  return `${baseUrl}${getBusinessJoinPath(slug)}`
}

export function getBusinessRedirectUrl(shortCode: string, baseUrl = getAppBaseUrl()) {
  return `${baseUrl}/r/${shortCode}`
}

export function getBusinessJoinDisplayUrl(joinUrl: string) {
  try {
    const parsed = new URL(joinUrl)
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return joinUrl.replace(/^https?:\/\//, '')
  }
}

export function getBusinessJoinOfferDescription(business: Business) {
  const portal = getBusinessPortalData(business)
  return portal.offer_description || 'Join our list and be part of something local'
}

export function getBusinessJoinOfferValue(business: Business) {
  const portal = getBusinessPortalData(business)
  return portal.offer_value || null
}

export function getBusinessJoinLogoUrl(business: Business) {
  const portal = getBusinessPortalData(business)
  return portal.logo_url || null
}

export function getBusinessSupportLabel(business: Business, linkedCauseName?: string | null) {
  if (linkedCauseName) return `Supporting ${linkedCauseName}`

  const portal = getBusinessPortalData(business)
  if (portal.linked_cause_name) return `Supporting ${portal.linked_cause_name}`

  return 'Supporting local schools'
}

export function isBusinessJoinQrCode(qrCode: Pick<QrCode, 'business_id' | 'metadata'>, businessId?: string | null) {
  const metadata = (qrCode.metadata as Record<string, unknown> | null) || null
  return (
    (!businessId || qrCode.business_id === businessId)
    && (
      metadata?.purpose === 'business_100_list_capture'
      || metadata?.customer_capture === true
    )
  )
}

export function mergeBusinessJoinCaptureMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  capture: BusinessJoinCaptureData,
) {
  const metadata = { ...((existingMetadata as Record<string, unknown> | null) || {}) }
  const existingCapture = getNestedCapture(metadata)

  return {
    ...metadata,
    customer_capture: {
      ...existingCapture,
      ...capture,
      future_hooks: {
        sms_after_signup: false,
        email_confirmation: false,
        referral_tracking: false,
        school_cause_attribution: false,
        stakeholder_variants: false,
        ...(existingCapture.future_hooks || {}),
        ...(capture.future_hooks || {}),
      },
    },
  }
}

export function buildBusinessJoinResource(
  business: Business,
  options: {
    joinSlug: string
    shortCode: string
    redirectUrl: string
    qrCodeId: string
    linkedCauseName?: string | null
  },
): BusinessJoinResource {
  const joinUrl = getBusinessJoinUrl(options.joinSlug)

  return {
    businessId: business.id,
    businessName: business.name,
    brand: business.brand || 'localvip',
    joinSlug: options.joinSlug,
    joinUrl,
    displayUrl: getBusinessJoinDisplayUrl(joinUrl),
    redirectUrl: options.redirectUrl,
    shortCode: options.shortCode,
    qrCodeId: options.qrCodeId,
    frameText: 'GET MY OFFER',
    logoUrl: getBusinessJoinLogoUrl(business),
    offerTitle: getBusinessOfferTitle(business),
    offerDescription: getBusinessJoinOfferDescription(business),
    offerValue: getBusinessJoinOfferValue(business),
    supportLabel: getBusinessSupportLabel(business, options.linkedCauseName),
  }
}

export function canManageBusinessJoin(profile: Profile | null | undefined, business: Business | null | undefined) {
  if (!profile || !business) return false

  if (profile.role === 'super_admin' || profile.role === 'internal_admin') {
    return true
  }

  if (profile.business_id && profile.business_id === business.id) {
    return true
  }

  if (business.owner_user_id === profile.id || business.owner_id === profile.id) {
    return true
  }

  const profileDomain = getEmailDomain(profile.email)
  const businessEmailDomain = getEmailDomain(business.email)
  const businessWebsiteDomain = business.website ? normalizeDomain(business.website) : null

  return !!profileDomain && (profileDomain === businessEmailDomain || profileDomain === businessWebsiteDomain)
}

function getEmailDomain(email?: string | null) {
  if (!email) return null
  const [, domain] = email.trim().toLowerCase().split('@')
  return domain || null
}

function getNestedCapture(metadata: Record<string, unknown>) {
  const capture = metadata.customer_capture
  return capture && typeof capture === 'object'
    ? capture as BusinessJoinCaptureData
    : {}
}
