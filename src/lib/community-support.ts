import type { Cause, Profile, QrCode } from '@/lib/types/database'
import { getAppBaseUrl } from '@/lib/business-join'
import { slugify } from '@/lib/utils'

export interface CommunitySupportCaptureData {
  support_slug?: string
  support_url?: string
  redirect_url?: string
  short_code?: string
  qr_code_id?: string
  last_synced_at?: string
  future_hooks?: {
    sms_after_signup?: boolean
    email_confirmation?: boolean
    referral_tracking?: boolean
    stakeholder_variants?: boolean
  }
}

export interface CommunitySupportResource {
  causeId: string
  causeName: string
  brand: 'localvip' | 'hato'
  supportSlug: string
  supportUrl: string
  displayUrl: string
  redirectUrl: string
  shortCode: string
  qrCodeId: string
  frameText: string
  headline: string
  description: string
}

function getCauseMetadata(cause: Cause | null | undefined) {
  if (!cause?.metadata || typeof cause.metadata !== 'object') return {}
  return cause.metadata as Record<string, unknown>
}

export function getCommunitySupportCaptureData(cause: Cause | null | undefined): CommunitySupportCaptureData {
  const metadata = getCauseMetadata(cause)
  const capture = metadata.supporter_capture
  return capture && typeof capture === 'object'
    ? capture as CommunitySupportCaptureData
    : {}
}

export function getCommunitySupportSlugCandidate(cause: Pick<Cause, 'id' | 'name'>) {
  const base = slugify(cause.name) || 'community'
  const suffix = cause.id.replace(/-/g, '').slice(0, 6).toLowerCase()
  return `${base}-${suffix}`
}

export function getCommunitySupportSlug(cause: Cause) {
  return getCommunitySupportCaptureData(cause).support_slug || getCommunitySupportSlugCandidate(cause)
}

export function getCommunitySupportPath(slug: string) {
  return `/support/${slug}`
}

export function getCommunitySupportUrl(slug: string, baseUrl = getAppBaseUrl()) {
  return `${baseUrl}${getCommunitySupportPath(slug)}`
}

export function getCommunityRedirectUrl(shortCode: string, baseUrl = getAppBaseUrl()) {
  return `${baseUrl}/r/${shortCode}`
}

export function getCommunitySupportDisplayUrl(supportUrl: string) {
  try {
    const parsed = new URL(supportUrl)
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return supportUrl.replace(/^https?:\/\//, '')
  }
}

export function getCommunitySupportMessage(cause: Cause) {
  const metadata = getCauseMetadata(cause)
  const supportMessage = metadata.support_message
  if (typeof supportMessage === 'string' && supportMessage.trim()) return supportMessage.trim()
  return `Support ${cause.name} by simply choosing it when you shop locally. It takes 10 seconds and makes a real difference.`
}

export function isCommunitySupportQrCode(qrCode: Pick<QrCode, 'cause_id' | 'metadata'>, causeId?: string | null) {
  const metadata = (qrCode.metadata as Record<string, unknown> | null) || null
  return (
    (!causeId || qrCode.cause_id === causeId)
    && (
      metadata?.purpose === 'community_supporter'
      || metadata?.supporter_capture === true
    )
  )
}

export function mergeCommunitySupportMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  capture: CommunitySupportCaptureData,
) {
  const metadata = { ...((existingMetadata as Record<string, unknown> | null) || {}) }
  const existingCapture = getCommunitySupportCaptureData({ metadata } as Cause)

  return {
    ...metadata,
    supporter_capture: {
      ...existingCapture,
      ...capture,
      future_hooks: {
        sms_after_signup: false,
        email_confirmation: false,
        referral_tracking: false,
        stakeholder_variants: false,
        ...(existingCapture.future_hooks || {}),
        ...(capture.future_hooks || {}),
      },
    },
  }
}

export function buildCommunitySupportResource(
  cause: Cause,
  options: {
    supportSlug: string
    shortCode: string
    redirectUrl: string
    qrCodeId: string
  },
): CommunitySupportResource {
  const supportUrl = getCommunitySupportUrl(options.supportSlug)
  return {
    causeId: cause.id,
    causeName: cause.name,
    brand: cause.brand || 'localvip',
    supportSlug: options.supportSlug,
    supportUrl,
    displayUrl: getCommunitySupportDisplayUrl(supportUrl),
    redirectUrl: options.redirectUrl,
    shortCode: options.shortCode,
    qrCodeId: options.qrCodeId,
    frameText: 'SUPPORT US',
    headline: `Support ${cause.name}`,
    description: getCommunitySupportMessage(cause),
  }
}

export function canManageCommunitySupport(profile: Profile | null | undefined, cause: Cause | null | undefined) {
  if (!profile || !cause) return false

  if (profile.role === 'admin' || profile.role === 'super_admin' || profile.role === 'internal_admin') {
    return true
  }

  if (cause.owner_id === profile.id) return true
  return !!profile.organization_id && profile.organization_id === cause.organization_id
}
