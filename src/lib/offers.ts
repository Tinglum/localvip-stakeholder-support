import { getBusinessPortalData } from '@/lib/business-portal'
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

function toResolved(offer: Offer): ResolvedBusinessOffer {
  return {
    ...offer,
    isFallback: false,
  }
}

export function resolveBusinessOffer(
  business: Business,
  offers: Offer[],
  offerType: 'capture',
): ResolvedBusinessOffer {
  const tableOffer = offers.find((offer) => offer.offer_type === offerType)
  if (tableOffer) return toResolved(tableOffer)

  const portal = getBusinessPortalData(business)

  return {
    id: null,
    business_id: business.id,
    offer_type: 'capture',
    status: portal.capture_offer_title || portal.offer_title ? 'active' : 'draft',
    headline: portal.capture_offer_title || portal.offer_title || 'Join our list and get access to exclusive VIP savings',
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

export function formatCashbackLabel(percent: number | null | undefined) {
  return typeof percent === 'number' && Number.isFinite(percent)
    ? `${percent}% cashback`
    : 'No deal configured'
}
