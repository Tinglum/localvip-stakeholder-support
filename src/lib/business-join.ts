import type { CornerStyle, DotStyle } from '@/lib/qr/generate'
import type { Business, Profile, QrCode } from '@/lib/types/database'
import { getBusinessOfferTitle, getBusinessPortalData } from '@/lib/business-portal'
import { BUSINESS_ACCENT_DARK_HEX, BUSINESS_ACCENT_HEX } from '@/lib/business-theme'
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
  qrAppearance: BusinessJoinQrAppearance
  offerTitle: string
  offerDescription: string
  offerValue: string | null
  supportLabel: string
}

export type BusinessJoinQrGradientType = 'none' | 'linear' | 'radial'

export interface BusinessJoinQrAppearance {
  foregroundColor: string
  backgroundColor: string
  frameText: string
  logoUrl: string | null
  useBusinessLogo: boolean
  dotStyle: DotStyle
  cornerStyle: CornerStyle
  gradientType: BusinessJoinQrGradientType
  gradientColors: [string, string]
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
  return portal.capture_offer_description || portal.offer_description || 'Join our list and be part of something local'
}

export function getBusinessJoinOfferValue(business: Business) {
  const portal = getBusinessPortalData(business)
  return portal.capture_offer_value || portal.offer_value || null
}

export function getBusinessJoinLogoUrl(business: Business) {
  const portal = getBusinessPortalData(business)
  return business.logo_url || portal.logo_url || null
}

export function getDefaultBusinessJoinQrAppearance(business: Business): BusinessJoinQrAppearance {
  return {
    foregroundColor: BUSINESS_ACCENT_HEX,
    backgroundColor: '#ffffff',
    frameText: 'GET MY OFFER',
    logoUrl: getBusinessJoinLogoUrl(business),
    useBusinessLogo: true,
    dotStyle: 'rounded',
    cornerStyle: 'rounded',
    gradientType: 'none',
    gradientColors: [BUSINESS_ACCENT_HEX, BUSINESS_ACCENT_DARK_HEX],
  }
}

export function getBusinessJoinQrAppearance(
  business: Business,
  qrCode?: Pick<QrCode, 'foreground_color' | 'background_color' | 'frame_text' | 'logo_url' | 'metadata'> | null,
): BusinessJoinQrAppearance {
  const defaults = getDefaultBusinessJoinQrAppearance(business)
  const metadata = (qrCode?.metadata as Record<string, unknown> | null) || null
  const rawAppearance = metadata?.qr_appearance
  const appearance = rawAppearance && typeof rawAppearance === 'object'
    ? rawAppearance as Record<string, unknown>
    : {}
  const useBusinessLogo = appearance.useBusinessLogo !== false
  const rawGradientColors = Array.isArray(appearance.gradientColors) ? appearance.gradientColors : null

  return {
    foregroundColor: qrCode?.foreground_color || asString(appearance.foregroundColor) || defaults.foregroundColor,
    backgroundColor: qrCode?.background_color || asString(appearance.backgroundColor) || defaults.backgroundColor,
    frameText: qrCode?.frame_text || asString(appearance.frameText) || defaults.frameText,
    logoUrl: useBusinessLogo ? getBusinessJoinLogoUrl(business) : (qrCode?.logo_url || null),
    useBusinessLogo,
    dotStyle: isDotStyle(appearance.dotStyle) ? appearance.dotStyle : defaults.dotStyle,
    cornerStyle: isCornerStyle(appearance.cornerStyle) ? appearance.cornerStyle : defaults.cornerStyle,
    gradientType: isGradientType(appearance.gradientType) ? appearance.gradientType : defaults.gradientType,
    gradientColors: isGradientPair(rawGradientColors)
      ? [rawGradientColors[0], rawGradientColors[1]]
      : defaults.gradientColors,
  }
}

export function mergeBusinessJoinQrAppearanceMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  appearance: BusinessJoinQrAppearance,
) {
  return {
    ...((existingMetadata as Record<string, unknown> | null) || {}),
    qr_appearance: {
      foregroundColor: appearance.foregroundColor,
      backgroundColor: appearance.backgroundColor,
      frameText: appearance.frameText,
      useBusinessLogo: appearance.useBusinessLogo,
      dotStyle: appearance.dotStyle,
      cornerStyle: appearance.cornerStyle,
      gradientType: appearance.gradientType,
      gradientColors: appearance.gradientColors,
    },
  }
}

export function getBusinessSupportLabel(business: Business, linkedCauseName?: string | null) {
  const portal = getBusinessPortalData(business)
  if (portal.capture_offer_title || portal.capture_offer_description) {
    return 'Used to get your first 100 customers'
  }

  if (linkedCauseName) return `Supporting ${linkedCauseName}`

  if (portal.linked_cause_name) return `Supporting ${portal.linked_cause_name}`

  return 'Supporting local schools'
}

export function isBusinessJoinQrCode(qrCode: Pick<QrCode, 'business_id' | 'metadata'>, businessId?: string | null) {
  const metadata = (qrCode.metadata as Record<string, unknown> | null) || null
  return (
    (!businessId || qrCode.business_id === businessId)
    && (
      metadata?.purpose === 'business_capture'
      || metadata?.purpose === 'business_100_list_capture'
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
    captureOffer?: {
      headline: string
      description: string | null
      valueLabel: string | null
    } | null
    qrCode?: Pick<QrCode, 'foreground_color' | 'background_color' | 'frame_text' | 'logo_url' | 'metadata'> | null
  },
): BusinessJoinResource {
  const joinUrl = getBusinessJoinUrl(options.joinSlug)
  const qrAppearance = getBusinessJoinQrAppearance(business, options.qrCode)

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
    frameText: qrAppearance.frameText,
    logoUrl: qrAppearance.logoUrl,
    qrAppearance,
    offerTitle: options.captureOffer?.headline || getBusinessOfferTitle(business),
    offerDescription: options.captureOffer?.description || getBusinessJoinOfferDescription(business),
    offerValue: options.captureOffer?.valueLabel || getBusinessJoinOfferValue(business),
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

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function isDotStyle(value: unknown): value is DotStyle {
  return value === 'square'
    || value === 'rounded'
    || value === 'dots'
    || value === 'classy'
    || value === 'classy-rounded'
    || value === 'extra-rounded'
}

function isCornerStyle(value: unknown): value is CornerStyle {
  return value === 'square'
    || value === 'rounded'
    || value === 'dots'
    || value === 'extra-rounded'
}

function isGradientType(value: unknown): value is BusinessJoinQrGradientType {
  return value === 'none' || value === 'linear' || value === 'radial'
}

function isGradientPair(value: unknown): value is [string, string] {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === 'string'
    && typeof value[1] === 'string'
}
