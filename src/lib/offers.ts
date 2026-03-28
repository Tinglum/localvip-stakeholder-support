import { getBusinessCashbackPercent, getBusinessPortalData } from '@/lib/business-portal'
import type { Business, Offer, OfferType } from '@/lib/types/database'

export interface ResolvedBusinessOffer {
  id: string | null
  business_id: string
  offer_type: OfferType
  status: 'draft' | 'active' | 'paused' | 'archived'
  headline: string
  description: string | null
  value_type: string | null
  value_label: string | null
  cashback_percent: number | null
  starts_at: string | null
  ends_at: string | null
  metadata: Record<string, unknown> | null
  isFallback: boolean
}

const STANDARD_CASHBACK_DESCRIPTION = 'This is the percentage customers receive back when they shop with you through LocalVIP.'

function normalizeCashbackDescription(value: string | null | undefined) {
  const normalized = (value || '').trim()
  if (!normalized) return STANDARD_CASHBACK_DESCRIPTION
  if (normalized.startsWith(STANDARD_CASHBACK_DESCRIPTION)) return STANDARD_CASHBACK_DESCRIPTION
  return normalized
}

function toResolved(offer: Offer): ResolvedBusinessOffer {
  return {
    ...offer,
    description: offer.offer_type === 'cashback' ? normalizeCashbackDescription(offer.description) : offer.description,
    isFallback: false,
  }
}

export function resolveBusinessOffer(
  business: Business,
  offers: Offer[],
  offerType: OfferType,
): ResolvedBusinessOffer {
  const tableOffer = offers.find((offer) => offer.offer_type === offerType)
  if (tableOffer) return toResolved(tableOffer)

  const portal = getBusinessPortalData(business)

  if (offerType === 'capture') {
    return {
      id: null,
      business_id: business.id,
      offer_type: 'capture',
      status: portal.capture_offer_title || portal.offer_title ? 'active' : 'draft',
      headline: portal.capture_offer_title || portal.offer_title || 'Join our list and get access to exclusive offers',
      description: portal.capture_offer_description || portal.offer_description || 'This offer is only used to collect your first 100 customers before you go live.',
      value_type: 'label',
      value_label: portal.capture_offer_value || portal.offer_value || null,
      cashback_percent: null,
      starts_at: null,
      ends_at: null,
      metadata: null,
      isFallback: true,
    }
  }

  const cashbackPercent = getBusinessCashbackPercent(business)

    return {
      id: null,
      business_id: business.id,
      offer_type: 'cashback',
      status: 'draft',
      headline: portal.cashback_offer_title || 'Standard LocalVIP Cashback',
      description: normalizeCashbackDescription(portal.cashback_offer_description),
      value_type: 'cashback_percent',
      value_label: `${cashbackPercent}% cashback`,
    cashback_percent: cashbackPercent,
    starts_at: null,
    ends_at: null,
    metadata: null,
    isFallback: true,
  }
}

export function formatCashbackLabel(percent: number | null | undefined) {
  const normalized = typeof percent === 'number' && !Number.isNaN(percent) ? percent : 10
  return `${normalized}% cashback`
}

export function isOfferReady(offer: ResolvedBusinessOffer) {
  if (offer.offer_type === 'capture') {
    return !!offer.headline.trim()
  }

  return typeof offer.cashback_percent === 'number' && offer.cashback_percent >= 5 && offer.cashback_percent <= 25
}
