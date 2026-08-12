'use client'

/**
 * THE BUSINESS EDITOR — one implementation, two presentations.
 *
 * Every field a business owner can change about itself lives here exactly once:
 * profile, branding, the Boomerang-list choice + its offer, the LocalVIP deal,
 * Stripe, and the go-live submission.
 *
 *  - `/portal/business` ("My Business") renders every group at once. It is the
 *    permanent editing surface.
 *  - `/portal/setup` (the first-run wizard) renders the same groups one step at
 *    a time with a progress rail.
 *
 * Both call `useBusinessEditor()`, so there is a single autosave path, a single
 * snapshot/seed rule, and no way for the two screens to disagree.
 */

import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth/context'
import { resolveBusinessOffer } from '@/lib/offers'
import {
  getBusinessQaAccountId,
  getBusinessLaunchPhase,
  getBusinessPortalData,
  resolveScopedBusiness,
} from '@/lib/business-portal'
import {
  getBusinessSetupState,
  type BusinessSetupStepKey,
  type BusinessSetupSignals,
  type BusinessSetupState,
  type BusinessSetupStepState,
} from '@/lib/business-setup'
import {
  parseStripeOnboardingStatus,
  stripeRequirementLabels,
  stripeStatusLabel,
  stripeStatusSummary,
  type StripeOnboardingStatus,
} from '@/lib/stripe-onboarding'
import {
  useBusinesses,
  useBusinessUpdate,
  useContacts,
  useDeals,
  useOfferInsert,
  useOffers,
  useOfferUpdate,
  type QaDealRow,
} from '@/lib/supabase/hooks'
import {
  BUSINESS_CATEGORIES,
  getBusinessCategoryById,
  getBusinessCategoryId,
  getKeywordGroupsForCategory,
} from '@/lib/business-catalog'
import type { Business, Contact, Offer } from '@/lib/types/database'
import { BOOMERANG_SURFACE, ENGAGEMENT_CODES, isBoomerangEnabled } from '@/lib/engagement-codes'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
export type HundredListInterest = 'interested' | 'not_now' | null

export function normalizeKeywords(values: string[]) {
  const seen = new Set<string>()
  return values.reduce<string[]>((result, value) => {
    const keyword = value.trim().replace(/\s+/g, ' ')
    const key = keyword.toLocaleLowerCase()
    if (!keyword || seen.has(key)) return result
    seen.add(key)
    result.push(keyword)
    return result
  }, [])
}

function parseKeywords(value: string[] | string | null | undefined) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  return normalizeKeywords(values)
}

function readUsdInput(value: string | null | undefined) {
  const parsed = Number(String(value || '').replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : ''
}

function formatUsdForStorage(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : null
}

type SetupSnapshotInput = {
  name: string
  categoryId: string
  description: string
  avgTicket: string
  keywords: string[]
  logoUrl: string | null
  coverUrl: string | null
  logoFileName: string | null
  coverFileName: string | null
  captureHeadline: string
  captureDescription: string
  captureValue: string
  hundredListInterest: HundredListInterest
  visibleInReferrerSearch: boolean
}

function serializeSetupSnapshot(input: SetupSnapshotInput) {
  return JSON.stringify({
    name: input.name,
    categoryId: input.categoryId,
    description: input.description,
    avgTicket: input.avgTicket,
    keywords: normalizeKeywords(input.keywords),
    logoUrl: input.logoUrl,
    coverUrl: input.coverUrl,
    logoFile: input.logoFileName,
    coverFile: input.coverFileName,
    captureHeadline: input.captureHeadline,
    captureDescription: input.captureDescription,
    captureValue: input.captureValue,
    hundredListInterest: input.hundredListInterest,
    visibleInReferrerSearch: input.visibleInReferrerSearch,
  })
}

export interface BusinessEditor {
  loading: boolean
  business: Business | null
  contacts: Contact[]
  offers: Offer[]
  deals: QaDealRow[]
  captureOffer: ReturnType<typeof resolveBusinessOffer> | null
  launchPhase: string
  qaBusinessId: string | null

  saveState: SaveState
  saveError: string | null
  persistChanges: (options?: {
    businessPatch?: Record<string, unknown>
    metadataOverrides?: Record<string, unknown>
  }) => Promise<boolean>
  refetchDeals: (options?: { silent?: boolean }) => void

  name: string
  setName: (value: string) => void
  categoryId: string
  setCategoryId: (value: string) => void
  description: string
  setDescription: (value: string) => void
  avgTicket: string
  setAvgTicket: (value: string) => void
  keywords: string[]
  keywordSearch: string
  setKeywordSearch: (value: string) => void
  customKeyword: string
  setCustomKeyword: (value: string) => void
  keywordGroups: ReturnType<typeof getKeywordGroupsForCategory>
  toggleKeyword: (keyword: string) => void
  addCustomKeyword: () => void

  logoUrl: string | null
  coverUrl: string | null
  logoFile: File | null
  setLogoFile: (file: File | null) => void
  coverFile: File | null
  setCoverFile: (file: File | null) => void

  captureHeadline: string
  setCaptureHeadline: (value: string) => void
  captureDescription: string
  setCaptureDescription: (value: string) => void
  captureValue: string
  setCaptureValue: (value: string) => void
  hundredListInterest: HundredListInterest
  setHundredListInterest: (value: HundredListInterest) => void
  /** Referrer-search opt-in. Businesses default to ON when never answered. */
  visibleInReferrerSearch: boolean
  setVisibleInReferrerSearch: (value: boolean) => void

  stripeStatus: StripeOnboardingStatus | null
  stripeLoading: boolean
  stripeError: string | null
  openingStripe: boolean
  openStripeOnboarding: () => Promise<void>
  refreshStripe: () => void

  activating: boolean
  submitForLiveReview: () => Promise<boolean>

  signals: BusinessSetupSignals
  setupState: BusinessSetupState
  missingSteps: BusinessSetupStepState[]
  isStepComplete: (key: BusinessSetupStepKey) => boolean
}

export function useBusinessEditor(): BusinessEditor {
  const { profile } = useAuth()
  const businessFilters = React.useMemo<Record<string, string>>(() => {
    const filters: Record<string, string> = {}
    if (profile.business_id) {
      filters.id = profile.business_id
    } else {
      filters.owner_id = profile.id
    }
    return filters
  }, [profile.business_id, profile.id])

  const { data: businesses, loading: businessLoading, refetch: refetchBusinesses } = useBusinesses(businessFilters)
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])
  const { data: contacts } = useContacts({ business_id: business?.id || '__none__' })
  const { data: offers, refetch: refetchOffers } = useOffers({ business_id: business?.id || '__none__' })
  const { data: deals, refetch: refetchDeals } = useDeals({ business_account_id: business?.id || '__none__' })
  const { update: updateBusiness } = useBusinessUpdate()
  const { insert: insertOffer } = useOfferInsert()
  const { update: updateOffer } = useOfferUpdate()

  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const [name, setName] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [avgTicket, setAvgTicket] = React.useState('')
  const [keywords, setKeywords] = React.useState<string[]>([])
  const [keywordSearch, setKeywordSearch] = React.useState('')
  const [customKeyword, setCustomKeyword] = React.useState('')
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null)
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [coverFile, setCoverFile] = React.useState<File | null>(null)
  const [captureHeadline, setCaptureHeadline] = React.useState('')
  const [captureDescription, setCaptureDescription] = React.useState('')
  const [captureValue, setCaptureValue] = React.useState('')
  const [hundredListInterest, setHundredListInterest] = React.useState<HundredListInterest>(null)
  // Businesses default to visible; null/undefined means "never answered".
  const [visibleInReferrerSearch, setVisibleInReferrerSearch] = React.useState(true)
  const [activating, setActivating] = React.useState(false)
  const [stripeStatus, setStripeStatus] = React.useState<StripeOnboardingStatus | null>(null)
  const [stripeLoading, setStripeLoading] = React.useState(true)
  const [stripeError, setStripeError] = React.useState<string | null>(null)
  const [stripeRefreshKey, setStripeRefreshKey] = React.useState(0)
  const [openingStripe, setOpeningStripe] = React.useState(false)
  const [captureOfferId, setCaptureOfferId] = React.useState<string | null>(null)

  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = React.useRef('')
  // Identity of the record currently seeded into the inputs. We only re-seed
  // when this changes — see the seeding effect below.
  const seededKeyRef = React.useRef<string | null>(null)

  const keywordGroups = React.useMemo(() => {
    const query = keywordSearch.trim().toLocaleLowerCase()
    return getKeywordGroupsForCategory(categoryId)
      .map((group) => ({
        ...group,
        keywords: group.keywords.filter((keyword) => !query || keyword.toLocaleLowerCase().includes(query)),
      }))
      .filter((group) => group.keywords.length > 0)
  }, [categoryId, keywordSearch])

  const portal = React.useMemo(() => (business ? getBusinessPortalData(business) : {}), [business])
  const qaBusinessId = React.useMemo(() => getBusinessQaAccountId(business), [business])
  const captureOffer = business ? resolveBusinessOffer(business, offers, 'capture') : null
  const launchPhase = business ? getBusinessLaunchPhase(business, contacts) : 'setup'

  const refreshStripeStatus = React.useCallback(async (): Promise<StripeOnboardingStatus | null> => {
    if (!business) return null
    if (!qaBusinessId) {
      setStripeStatus(null)
      setStripeError('This business is not linked to a QA business account.')
      setStripeLoading(false)
      return null
    }
    setStripeLoading(true)
    setStripeError(null)
    try {
      const query = `?businessId=${encodeURIComponent(qaBusinessId)}`
      const response = await fetch(`/api/business-portal/stripe-onboarding${query}`, { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.error) throw new Error(result.error || 'Stripe status could not be loaded.')
      const parsed = parseStripeOnboardingStatus(result)
      if (!parsed) throw new Error('Stripe returned an invalid status response.')
      setStripeStatus(parsed)
      return parsed
    } catch (error) {
      setStripeStatus(null)
      setStripeError(error instanceof Error ? error.message : 'Stripe status could not be loaded.')
      return null
    } finally {
      setStripeLoading(false)
    }
  }, [business, qaBusinessId])

  React.useEffect(() => {
    void refreshStripeStatus()
  }, [refreshStripeStatus, stripeRefreshKey])

  React.useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshStripeStatus()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('pageshow', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('pageshow', refreshWhenVisible)
    }
  }, [refreshStripeStatus])

  const openStripeOnboarding = React.useCallback(async () => {
    if (!business) return
    if (!qaBusinessId) {
      setStripeError('This business is not linked to a QA business account.')
      return
    }
    setOpeningStripe(true)
    setStripeError(null)
    try {
      const response = await fetch(
        `/api/business-portal/stripe-onboarding?businessId=${encodeURIComponent(qaBusinessId)}`,
        { method: 'POST' },
      )
      const result = (await response.json().catch(() => ({}))) as { onboardingUrl?: string; error?: string }
      if (response.status === 409) {
        const refreshedStatus = await refreshStripeStatus()
        if (refreshedStatus?.status === 'complete') {
          setStripeError(null)
          return
        }
        throw new Error('Stripe onboarding cannot be opened for this account yet.')
      }
      if (!response.ok || !result.onboardingUrl) throw new Error(result.error || 'Stripe onboarding could not be opened.')
      window.location.assign(result.onboardingUrl)
    } catch (error) {
      setStripeError(error instanceof Error ? error.message : 'Stripe onboarding could not be opened.')
    } finally {
      setOpeningStripe(false)
    }
  }, [business, qaBusinessId, refreshStripeStatus])

  React.useEffect(() => {
    if (!business) return

    // Only re-seed the inputs when the underlying record IDENTITY changes — a
    // different business, or the capture offer finishing its load. Re-seeding
    // on every `business` update (e.g. the one returned by our own autosave)
    // overwrites characters typed during the save round-trip.
    const seedKey = `${business.id}|${captureOffer?.id || ''}`
    if (seededKeyRef.current === seedKey) return
    seededKeyRef.current = seedKey

    const savedCategoryId = business.business_type || getBusinessCategoryId(business.category)
    const nextInterest: HundredListInterest =
      portal.hundred_list_interest === 'interested' || portal.hundred_list_interest === 'not_now'
        ? portal.hundred_list_interest
        : captureOffer?.id
          ? 'interested'
          : null

    const nextVisibleInReferrerSearch = portal.is_visible_in_referrer_search !== false

    setName(business.name || '')
    setCategoryId(savedCategoryId ? String(savedCategoryId) : '')
    setDescription(business.public_description || portal.description || '')
    setAvgTicket(readUsdInput(business.avg_ticket || portal.avg_ticket || ''))
    setKeywords(parseKeywords(business.products_services || portal.products_services))
    setLogoUrl(business.logo_url || portal.logo_url || null)
    setCoverUrl(business.cover_photo_url || portal.cover_photo_url || null)
    setCaptureHeadline(captureOffer?.headline || '')
    setCaptureDescription(captureOffer?.description || '')
    setCaptureValue(captureOffer?.value_label || '')
    setHundredListInterest(nextInterest)
    setVisibleInReferrerSearch(nextVisibleInReferrerSearch)
    setCaptureOfferId(captureOffer?.id || null)
    snapshotRef.current = serializeSetupSnapshot({
      name: business.name || '',
      categoryId: savedCategoryId ? String(savedCategoryId) : '',
      description: business.public_description || portal.description || '',
      avgTicket: readUsdInput(business.avg_ticket || portal.avg_ticket || ''),
      keywords: parseKeywords(business.products_services || portal.products_services),
      logoUrl: business.logo_url || portal.logo_url || null,
      coverUrl: business.cover_photo_url || portal.cover_photo_url || null,
      logoFileName: null,
      coverFileName: null,
      captureHeadline: captureOffer?.headline || '',
      captureDescription: captureOffer?.description || '',
      captureValue: captureOffer?.value_label || '',
      hundredListInterest: nextInterest,
      visibleInReferrerSearch: nextVisibleInReferrerSearch,
    })
  }, [
    business,
    captureOffer?.description,
    captureOffer?.headline,
    captureOffer?.id,
    captureOffer?.value_label,
    portal.avg_ticket,
    portal.cover_photo_url,
    portal.description,
    portal.hundred_list_interest,
    portal.is_visible_in_referrer_search,
    portal.logo_url,
    portal.products_services,
  ])

  const persistChanges = React.useCallback(
    async (options?: {
      businessPatch?: Record<string, unknown>
      metadataOverrides?: Record<string, unknown>
    }): Promise<boolean> => {
      if (!business) return false

      try {
        setSaveState('saving')
        setSaveError(null)

        let nextLogoUrl = logoUrl
        let nextCoverUrl = coverUrl

        // Upload via the server API route which handles storage + top-level
        // column updates.
        if (logoFile) {
          const formData = new FormData()
          formData.append('file', logoFile)
          formData.append('mediaType', 'logo')
          const uploadResponse = await fetch(`/api/crm/businesses/${business.id}/media`, { method: 'POST', body: formData })
          const uploadResult = await uploadResponse.json().catch(() => ({}))
          if (!uploadResponse.ok || !uploadResult.fileUrl) throw new Error(uploadResult.error || 'The logo could not be uploaded.')
          nextLogoUrl = uploadResult.fileUrl
          setLogoFile(null)
        }

        if (coverFile) {
          const formData = new FormData()
          formData.append('file', coverFile)
          formData.append('mediaType', 'cover_photo')
          const uploadResponse = await fetch(`/api/crm/businesses/${business.id}/media`, { method: 'POST', body: formData })
          const uploadResult = await uploadResponse.json().catch(() => ({}))
          if (!uploadResponse.ok || !uploadResult.fileUrl) throw new Error(uploadResult.error || 'The cover image could not be uploaded.')
          nextCoverUrl = uploadResult.fileUrl
          setCoverFile(null)
        }

        const nextMetadata = {
          ...portal,
          logo_url: nextLogoUrl,
          cover_photo_url: nextCoverUrl,
          capture_offer_title: captureHeadline,
          capture_offer_description: captureDescription,
          capture_offer_value: captureValue,
          hundred_list_interest: hundredListInterest || undefined,
          hundred_list_interest_recorded_at: hundredListInterest
            ? portal.hundred_list_interest_recorded_at || new Date().toISOString()
            : undefined,
          hundred_list_activation_status:
            hundredListInterest === 'interested'
              ? portal.hundred_list_activation_status === 'active' || portal.hundred_list_activation_status === 'in_setup'
                ? portal.hundred_list_activation_status
                : 'requested'
              : hundredListInterest === 'not_now'
                ? 'not_requested'
                : undefined,
          is_visible_in_referrer_search: visibleInReferrerSearch,
          offer_title: captureHeadline,
          offer_description: captureDescription,
          offer_value: captureValue,
          ...(options?.metadataOverrides || {}),
        }

        const savedBusiness = await updateBusiness(business.id, {
          name,
          category: getBusinessCategoryById(categoryId)?.label || null,
          business_type: getBusinessCategoryById(categoryId)?.id || null,
          public_description: description || null,
          avg_ticket: formatUsdForStorage(avgTicket),
          products_services: normalizeKeywords(keywords),
          logo_url: nextLogoUrl || null,
          cover_photo_url: nextCoverUrl || null,
          metadata: nextMetadata as Record<string, unknown>,
          ...(options?.businessPatch || {}),
        })
        if (!savedBusiness) {
          throw new Error('Business setup could not be saved.')
        }

        // Only persist a capture offer once the business has actually written a
        // headline (or one already exists). Avoids eagerly creating a
        // placeholder offer that makes the 100-List step look "Done".
        let savedCapture: { id?: string } | null = null
        if (captureHeadline.trim() || captureOfferId) {
          const capturePayload = {
            business_id: business.id,
            offer_type: 'capture' as const,
            status: captureHeadline.trim() ? ('active' as const) : ('draft' as const),
            headline: captureHeadline.trim() || 'Boomerang list offer',
            description: captureDescription || '',
            value_type: 'label',
            value_label: captureValue || null,
            cashback_percent: null,
            starts_at: null,
            ends_at: null,
            metadata: { source: 'business_setup' },
          }
          savedCapture = captureOfferId
            ? await updateOffer(captureOfferId, capturePayload)
            : await insertOffer(capturePayload)
          if (!savedCapture) {
            throw new Error('The Boomerang list offer could not be saved.')
          }
        }

        if (savedCapture?.id) setCaptureOfferId(savedCapture.id)

        setLogoUrl(nextLogoUrl)
        setCoverUrl(nextCoverUrl)
        snapshotRef.current = serializeSetupSnapshot({
          name,
          categoryId,
          description,
          avgTicket,
          keywords,
          logoUrl: nextLogoUrl,
          coverUrl: nextCoverUrl,
          logoFileName: null,
          coverFileName: null,
          captureHeadline,
          captureDescription,
          captureValue,
          hundredListInterest,
          visibleInReferrerSearch,
        })

        setSaveState('saved')
        refetchOffers({ silent: true })
        refetchBusinesses({ silent: true })
        return true
      } catch (error) {
        setSaveState('error')
        setSaveError(error instanceof Error ? error.message : 'Changes could not be saved.')
        return false
      }
    },
    [
      avgTicket,
      business,
      captureDescription,
      captureHeadline,
      hundredListInterest,
      captureOfferId,
      captureValue,
      categoryId,
      coverFile,
      coverUrl,
      description,
      insertOffer,
      logoFile,
      logoUrl,
      name,
      portal,
      keywords,
      refetchBusinesses,
      refetchOffers,
      updateBusiness,
      updateOffer,
      visibleInReferrerSearch,
    ],
  )

  React.useEffect(() => {
    if (!business) return

    const snapshot = serializeSetupSnapshot({
      name,
      categoryId,
      description,
      avgTicket,
      keywords,
      logoUrl,
      coverUrl,
      logoFileName: logoFile?.name || null,
      coverFileName: coverFile?.name || null,
      captureHeadline,
      captureDescription,
      captureValue,
      hundredListInterest,
      visibleInReferrerSearch,
    })

    if (!snapshotRef.current || snapshot === snapshotRef.current) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void persistChanges()
    }, 650)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [
    avgTicket,
    business,
    captureDescription,
    captureHeadline,
    captureValue,
    categoryId,
    coverFile,
    coverUrl,
    description,
    hundredListInterest,
    keywords,
    logoFile,
    logoUrl,
    name,
    persistChanges,
    visibleInReferrerSearch,
  ])

  const toggleKeyword = React.useCallback((keyword: string) => {
    setKeywords((current) => {
      const exists = current.some((value) => value.localeCompare(keyword, undefined, { sensitivity: 'accent' }) === 0)
      return exists
        ? current.filter((value) => value.localeCompare(keyword, undefined, { sensitivity: 'accent' }) !== 0)
        : normalizeKeywords([...current, keyword])
    })
  }, [])

  const addCustomKeyword = React.useCallback(() => {
    const keyword = customKeyword.trim().replace(/\s+/g, ' ')
    if (!keyword) return
    setKeywords((current) => normalizeKeywords([...current, keyword]))
    setCustomKeyword('')
  }, [customKeyword])

  // Completion is evaluated against the DRAFT values in these inputs, so every
  // rail, pill, and nav badge updates as the owner types.
  const signals: BusinessSetupSignals = {
    name,
    category: getBusinessCategoryById(categoryId)?.label || '',
    description,
    logoUrl: logoUrl || (logoFile ? logoFile.name : null),
    coverUrl: coverUrl || (coverFile ? coverFile.name : null),
    captureHeadline,
    captureDescription,
    captureValue,
    hundredListInterest,
    dealConfigured: deals.some((deal) => {
      const cashback = Number(deal.cash_back)
      if (!Number.isFinite(cashback) || cashback < 1 || cashback > 36) return false
      if (!deal.start_date || !deal.end_date) return false
      const start = new Date(deal.start_date)
      const end = new Date(deal.end_date)
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start
    }),
    stripeConnected: stripeStatus?.status === 'complete',
    liveReviewSubmitted:
      String(business?.status || '') === 'pending_live_review'
      || String(business?.status || '') === 'live'
      || business?.stage === 'live',
  }

  const setupState = getBusinessSetupState(signals)
  const stepCompletion = React.useMemo(
    () => new Map(setupState.steps.map((step) => [step.key, step.complete])),
    [setupState],
  )
  const isStepComplete = React.useCallback(
    (key: BusinessSetupStepKey) => !!stepCompletion.get(key),
    [stepCompletion],
  )
  const missingSteps = setupState.steps.filter((item) => item.key !== 'activate' && !item.complete)

  const submitForLiveReview = React.useCallback(async () => {
    setActivating(true)
    try {
      const requestedAt = new Date().toISOString()
      return await persistChanges({
        businessPatch: {
          stage: 'onboarded',
          launch_phase: 'ready_to_go_live',
          activation_status: 'in_progress',
        },
        metadataOverrides: {
          portal_activation_review_state: 'pending',
          portal_activation_requested_at: requestedAt,
          portal_activation_requested_by: profile.id,
          portal_activation_reviewed_at: null,
          portal_activation_reviewed_by: null,
        },
      })
    } finally {
      setActivating(false)
    }
  }, [persistChanges, profile.id])

  return {
    loading: businessLoading,
    business,
    contacts,
    offers,
    deals,
    captureOffer,
    launchPhase,
    qaBusinessId,

    saveState,
    saveError,
    persistChanges,
    refetchDeals,

    name,
    setName,
    categoryId,
    setCategoryId,
    description,
    setDescription,
    avgTicket,
    setAvgTicket,
    keywords,
    keywordSearch,
    setKeywordSearch,
    customKeyword,
    setCustomKeyword,
    keywordGroups,
    toggleKeyword,
    addCustomKeyword,

    logoUrl,
    coverUrl,
    logoFile,
    setLogoFile,
    coverFile,
    setCoverFile,

    captureHeadline,
    setCaptureHeadline,
    captureDescription,
    setCaptureDescription,
    captureValue,
    setCaptureValue,
    hundredListInterest,
    setHundredListInterest,
    visibleInReferrerSearch,
    setVisibleInReferrerSearch,

    stripeStatus,
    stripeLoading,
    stripeError,
    openingStripe,
    openStripeOnboarding,
    refreshStripe: () => setStripeRefreshKey((value) => value + 1),

    activating,
    submitForLiveReview,

    signals,
    setupState,
    missingSteps,
    isStepComplete,
  }
}

/* ------------------------------------------------------------------ */
/* Field groups. Shared verbatim by My Business and the setup wizard.  */
/* ------------------------------------------------------------------ */

export function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-surface-700">
      {children}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </label>
  )
}

export function RequiredFieldHint() {
  return <p className="mt-1 text-sm font-medium text-red-600">(Required field)</p>
}

export function SaveStateLabel({ editor }: { editor: BusinessEditor }) {
  const { saveState } = editor
  return (
    <span className="flex items-center gap-2 text-sm text-surface-500">
      {saveState === 'saving' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saveState === 'saved' ? (
        <CheckCircle2 className="h-4 w-4 text-success-600" />
      ) : null}
      <span className={saveState === 'error' ? 'text-danger-600' : undefined}>
        {saveState === 'saving'
          ? 'Saving changes...'
          : saveState === 'saved'
            ? 'All changes saved'
            : saveState === 'error'
              ? 'Autosave failed'
              : 'Changes save automatically'}
      </span>
    </span>
  )
}

export function ProfileFields({ editor, showValidation = false }: { editor: BusinessEditor; showValidation?: boolean }) {
  const nameMissing = !editor.name.trim()
  const categoryMissing = !getBusinessCategoryById(editor.categoryId)
  const descriptionMissing = !editor.description.trim()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <FieldLabel required>Business name</FieldLabel>
        <Input
          value={editor.name}
          onChange={(event) => editor.setName(event.target.value)}
          placeholder="Main Street Coffee"
          className={showValidation && nameMissing ? 'border-red-500 focus-visible:ring-red-200' : ''}
        />
        <p className="mt-1 text-xs text-surface-500">Write it exactly how customers know it.</p>
        {showValidation && nameMissing ? <RequiredFieldHint /> : null}
      </div>
      <div>
        <FieldLabel required>Category</FieldLabel>
        <select
          value={editor.categoryId}
          onChange={(event) => editor.setCategoryId(event.target.value)}
          className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-surface-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
            showValidation && categoryMissing ? 'border-red-500' : 'border-surface-300'
          }`}
          aria-invalid={showValidation && categoryMissing}
          aria-label="Business category"
        >
          <option value="">Choose a category</option>
          {BUSINESS_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {showValidation && categoryMissing ? <RequiredFieldHint /> : null}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-surface-700" htmlFor="average-spend">
          Average spend per client
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-surface-500">$</span>
          <Input
            id="average-spend"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={editor.avgTicket}
            onChange={(event) => editor.setAvgTicket(event.target.value)}
            placeholder="25.00"
            className="pl-7"
          />
        </div>
        <p className="mt-1.5 text-xs text-surface-500">Typical amount one client spends in USD.</p>
      </div>
      <div className="md:col-span-2">
        <FieldLabel required>Description</FieldLabel>
        <Textarea
          value={editor.description}
          onChange={(event) => editor.setDescription(event.target.value)}
          rows={4}
          placeholder="We serve specialty coffee, fresh pastries, and quick lunch options for busy locals."
          className={showValidation && descriptionMissing ? 'border-red-500 focus-visible:ring-red-200' : ''}
        />
        <p className="mt-1 text-xs text-surface-500">
          Keep it simple. Write the way you would explain the business to a new customer.
        </p>
        {showValidation && descriptionMissing ? <RequiredFieldHint /> : null}
      </div>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-surface-700" htmlFor="keyword-search">
          Keywords / products &amp; services
        </label>
        <p className="mb-3 text-sm leading-6 text-surface-500">
          Choose words customers can use to find your business and what you offer.
        </p>

        {editor.keywords.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {editor.keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => editor.toggleKeyword(keyword)}
                  className="rounded-full p-0.5 text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  aria-label={`Remove ${keyword}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-surface-200 bg-surface-50">
          <div className="border-b border-surface-200 bg-white p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <Input
                id="keyword-search"
                value={editor.keywordSearch}
                onChange={(event) => editor.setKeywordSearch(event.target.value)}
                placeholder="Search keywords, such as pizza, Italian, massage..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-3">
            {editor.keywordGroups.length > 0 ? (
              editor.keywordGroups.map((group) => (
                <div key={group.id} className="mb-4 last:mb-0">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-surface-500">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.keywords.map((keyword) => {
                      const selected = editor.keywords.some(
                        (value) => value.toLocaleLowerCase() === keyword.toLocaleLowerCase(),
                      )
                      return (
                        <button
                          key={keyword}
                          type="button"
                          onClick={() => editor.toggleKeyword(keyword)}
                          aria-pressed={selected}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                            selected
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-surface-300 bg-white text-surface-700 hover:border-brand-300 hover:bg-brand-50'
                          }`}
                        >
                          {selected ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : null}
                          {keyword}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-surface-500">No catalog keywords match that search.</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={editor.customKeyword}
            onChange={(event) => editor.setCustomKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                editor.addCustomKeyword()
              }
            }}
            placeholder="Add a custom keyword"
            aria-label="Add a custom keyword"
          />
          <Button
            type="button"
            variant="outline"
            onClick={editor.addCustomKeyword}
            disabled={!editor.customKeyword.trim()}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add keyword
          </Button>
        </div>
        <p className="mt-2 text-xs text-surface-500">New keywords are added to your business profile when you save.</p>
      </div>

      <div className="md:col-span-2">
        <ReferrerSearchVisibilityField editor={editor} />
      </div>
    </div>
  )
}

/**
 * The referrer-search opt-in. Businesses default to ON, so this reads as a
 * privacy control the owner can switch off — not a feature they must enable.
 *
 * Lives in ProfileFields so it renders in BOTH the first-run setup wizard and
 * My Business from one definition, and saves through the same autosave path as
 * every other profile field.
 */
export function ReferrerSearchVisibilityField({ editor }: { editor: BusinessEditor }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
      <div className="flex items-start gap-3">
        <input
          id="business-referrer-search-visibility"
          type="checkbox"
          checked={editor.visibleInReferrerSearch}
          onChange={(event) => editor.setVisibleInReferrerSearch(event.target.checked)}
          aria-describedby="business-referrer-search-visibility-help"
          className="mt-1 h-4 w-4 shrink-0 rounded border-surface-400 text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        />
        <div className="min-w-0">
          <label
            htmlFor="business-referrer-search-visibility"
            className="block text-sm font-semibold text-surface-900"
          >
            Show my basic details in the search overview
          </label>
          <p id="business-referrer-search-visibility-help" className="mt-1 text-sm leading-6 text-surface-600">
            When someone signs up after you told them about LocalVIP, they are asked who referred them. Leaving this on
            lets them find your business by name and pick you, so you get credit for the businesses, causes and
            customers you bring in. Only your name, city and account type are ever shown &mdash; never your email or
            phone number.
          </p>
        </div>
      </div>
    </div>
  )
}

export function BrandingFields({ editor, showValidation = false }: { editor: BusinessEditor; showValidation?: boolean }) {
  const logoMissing = !(editor.logoUrl || editor.logoFile)
  const coverMissing = !(editor.coverUrl || editor.coverFile)

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <div className="space-y-1">
          <FieldLabel required>Business logo</FieldLabel>
          <p className="text-sm leading-6 text-surface-500">
            This is your main brand mark. We use it in the middle of your QR code and in smaller places where people
            should recognize your business right away.
          </p>
          <p className="text-xs leading-5 text-surface-400">
            Best choice: a square logo with a simple shape and a clean or transparent background, so it still looks
            sharp when it is shown small.
          </p>
        </div>
        <input
          type="file"
          accept="image/*"
          aria-label="Upload business logo"
          onChange={(event) => editor.setLogoFile(event.target.files?.[0] || null)}
        />
        {showValidation && logoMissing ? <RequiredFieldHint /> : null}
        <div
          className={`flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-surface-50 ${
            showValidation && logoMissing ? 'border-red-400' : 'border-surface-300'
          }`}
        >
          {editor.logoFile || editor.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={editor.logoFile ? URL.createObjectURL(editor.logoFile) : editor.logoUrl || ''}
              alt="Logo preview"
              className="h-full w-full object-contain p-4"
            />
          ) : (
            <p className="text-sm text-surface-400">Upload the logo you want people to recognize first</p>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <FieldLabel required>Cover image</FieldLabel>
          <p className="text-sm leading-6 text-surface-500">
            This is the larger photo customers see first on your business page. Use it to show the feel of your
            business, like your food, your space, your storefront, or your experience.
          </p>
          <p className="text-xs leading-5 text-surface-400">
            Best choice: a wide photo that feels inviting and easy to understand at a glance.
          </p>
        </div>
        <input
          type="file"
          accept="image/*"
          aria-label="Upload cover image"
          onChange={(event) => editor.setCoverFile(event.target.files?.[0] || null)}
        />
        {showValidation && coverMissing ? <RequiredFieldHint /> : null}
        <div
          className={`flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-surface-50 ${
            showValidation && coverMissing ? 'border-red-400' : 'border-surface-300'
          }`}
        >
          {editor.coverFile || editor.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={editor.coverFile ? URL.createObjectURL(editor.coverFile) : editor.coverUrl || ''}
              alt="Cover preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <p className="text-sm text-surface-400">Upload the main photo that should represent your business</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The Boomerang-list choice, plus the offer copy shown to someone joining it.
 *
 * The three offer inputs are intentionally not shown during first-run setup
 * (`variant="choice"`) — the LocalVIP team writes them with the owner. On My
 * Business (`variant="full"`) they ARE editable, which is the one place an
 * owner can change that offer themselves.
 *
 * The choice itself always renders: it is the question, not a Boomerang surface,
 * and it is how a business changes its mind in either direction. Everything
 * downstream of a "yes" is gated on that answer.
 */
export function CaptureFields({
  editor,
  showValidation = false,
  variant = 'full',
}: {
  editor: BusinessEditor
  showValidation?: boolean
  variant?: 'full' | 'choice'
}) {
  const choiceMissing = editor.hundredListInterest === null
  const boomerangEnabled = isBoomerangEnabled(editor.hundredListInterest)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-surface-900">
          Do you want a {BOOMERANG_SURFACE.tab.toLowerCase()}?
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-600">
          {ENGAGEMENT_CODES.business_capture.outcome} You get a shareable signup page, a QR code, and a simple
          launch offer that gives people a reason to join early. This is separate from your{' '}
          {ENGAGEMENT_CODES.business_network_referral.linkLabel.toLowerCase()}, which you keep either way. You can
          change this answer at any time.
        </p>
        <div role="radiogroup" aria-label={`${BOOMERANG_SURFACE.tab} interest`} className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            role="radio"
            aria-checked={editor.hundredListInterest === 'interested'}
            onClick={() => editor.setHundredListInterest('interested')}
            className={`rounded-2xl border-2 p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
              editor.hundredListInterest === 'interested'
                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                : 'border-surface-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-bold text-surface-950">
                  Yes, set up my {BOOMERANG_SURFACE.tab.toLowerCase()}
                </p>
                <p className="mt-2 text-sm leading-6 text-surface-600">
                  You get a {BOOMERANG_SURFACE.tab.toLowerCase()} tab of your own, its QR code and link, and its
                  printable materials.
                </p>
              </div>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                  editor.hundredListInterest === 'interested'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-surface-300'
                }`}
              >
                {editor.hundredListInterest === 'interested' ? <CheckCircle2 className="h-4 w-4" /> : null}
              </span>
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={editor.hundredListInterest === 'not_now'}
            onClick={() => editor.setHundredListInterest('not_now')}
            className={`rounded-2xl border-2 p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
              editor.hundredListInterest === 'not_now'
                ? 'border-surface-500 bg-surface-100'
                : 'border-surface-200 bg-white hover:border-surface-400 hover:bg-surface-50'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-bold text-surface-950">Not right now</p>
                <p className="mt-2 text-sm leading-6 text-surface-600">
                  No problem — none of it will be shown to you. Everything else, including your{' '}
                  {ENGAGEMENT_CODES.business_network_referral.linkLabel.toLowerCase()}, is unaffected. You can turn
                  it on here later.
                </p>
              </div>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                  editor.hundredListInterest === 'not_now'
                    ? 'border-surface-600 bg-surface-600 text-white'
                    : 'border-surface-300'
                }`}
              >
                {editor.hundredListInterest === 'not_now' ? <CheckCircle2 className="h-4 w-4" /> : null}
              </span>
            </div>
          </button>
        </div>
        {showValidation && choiceMissing ? (
          <p className="mt-3 text-sm font-medium text-red-600">Choose one option to continue.</p>
        ) : null}
      </div>

      {/* The offer only exists to give someone a reason to join the Boomerang
          list, so it is meaningless — and must not be shown — when there is no
          list. It appears the moment the answer above becomes yes. */}
      {variant === 'full' && boomerangEnabled ? (
        <div className="grid gap-4 border-t border-surface-100 pt-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="text-sm font-semibold text-surface-900">
              What someone gets for joining your {BOOMERANG_SURFACE.tab.toLowerCase()}
            </p>
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Offer headline</FieldLabel>
            <p className="mb-2 text-sm leading-6 text-surface-500">
              The first line customers notice. Keep it short, clear, and specific.
            </p>
            <Input
              value={editor.captureHeadline}
              onChange={(event) => editor.setCaptureHeadline(event.target.value)}
              placeholder="Free coffee with purchase"
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Offer description</FieldLabel>
            <p className="mb-2 text-sm leading-6 text-surface-500">
              Explain exactly what they get and any simple condition, like &ldquo;with purchase&rdquo; or &ldquo;one
              per customer.&rdquo;
            </p>
            <Textarea
              value={editor.captureDescription}
              onChange={(event) => editor.setCaptureDescription(event.target.value)}
              rows={4}
              placeholder="Tell customers exactly what they get when they join your list."
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Offer value label</FieldLabel>
            <p className="mb-2 text-sm leading-6 text-surface-500">
              The shorter version used in tighter spaces like QR cards and badges.
            </p>
            <Input
              value={editor.captureValue}
              onChange={(event) => editor.setCaptureValue(event.target.value)}
              placeholder="Free cookie with purchase"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function StripeFields({ editor }: { editor: BusinessEditor }) {
  const { stripeStatus, stripeLoading, stripeError, openingStripe } = editor
  const requirements = stripeStatus ? stripeRequirementLabels(stripeStatus) : []
  const onboardingStarted = stripeStatus?.onboardingStarted === true

  return (
    <div className="space-y-5">
      <div className="max-w-3xl">
        <p className="text-base leading-7 text-surface-700">
          LocalVIP uses Stripe to securely process customer payments and send your share directly to your business bank
          account.
        </p>
        <p className="mt-2 text-sm leading-6 text-surface-500">
          Stripe verifies the business and payout details. LocalVIP never stores your bank credentials.
        </p>
      </div>

      {stripeLoading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-5 py-5 text-sm text-surface-600">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Checking your Stripe connection...
        </div>
      ) : null}

      {!stripeLoading && stripeStatus?.status === 'complete' ? (
        <div className="rounded-2xl border border-success-300 bg-success-50 px-5 py-5">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-semibold text-success-950">Stripe is connected</p>
              <p className="mt-1 text-sm leading-6 text-success-800">
                Your business can receive LocalVIP customer payments. This requirement is complete.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!stripeLoading && stripeStatus && stripeStatus.status !== 'complete' && onboardingStarted ? (
        <div
          className={`rounded-2xl border px-5 py-5 ${
            stripeStatus.status === 'restricted' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'
          }`}
        >
          <div className="flex items-start gap-4">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${
                stripeStatus.status === 'restricted' ? 'bg-red-600' : 'bg-amber-500'
              }`}
            >
              {stripeStatus.status === 'restricted' ? <AlertTriangle className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
            </span>
            <div>
              <p className={`text-lg font-semibold ${stripeStatus.status === 'restricted' ? 'text-red-950' : 'text-amber-950'}`}>
                {stripeStatusLabel(stripeStatus.status)}
              </p>
              <p className={`mt-1 text-sm leading-6 ${stripeStatus.status === 'restricted' ? 'text-red-800' : 'text-amber-800'}`}>
                {stripeStatusSummary(stripeStatus)}
              </p>
              {stripeStatus.nextAction ? (
                <p className="mt-3 text-sm font-medium text-surface-800">Next: {stripeStatus.nextAction}</p>
              ) : null}
              {requirements.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-600">Still needed</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-surface-700">
                    {requirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!stripeLoading && stripeStatus && stripeStatus.status !== 'complete' && !onboardingStarted ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 px-5 py-5">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <CreditCard className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-semibold text-surface-950">Connect Stripe to receive payments</p>
              <p className="mt-1 text-sm leading-6 text-surface-700">
                Start the secure Stripe setup when you are ready. We will show any remaining requirements after you
                begin.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {stripeError ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-5">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold text-red-950">Stripe status could not be checked</p>
              <p className="mt-1 text-sm leading-6 text-red-800">
                {stripeError} Go Live remains locked until QA confirms the connection.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!stripeLoading && stripeStatus?.status !== 'complete' ? (
          <Button onClick={() => void editor.openStripeOnboarding()} disabled={openingStripe} className="h-11 px-5 font-semibold">
            {openingStripe ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {openingStripe ? 'Opening Stripe...' : 'Complete Stripe setup'}
          </Button>
        ) : null}
        {stripeError || (!stripeLoading && stripeStatus?.status !== 'complete') ? (
          <Button variant="outline" onClick={editor.refreshStripe} disabled={stripeLoading}>
            <RefreshCw className="h-4 w-4" />
            Check status again
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function StatusPill({ label, ready, onOpen }: { label: string; ready: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}: ${ready ? 'ready' : 'needs work'}. Open this step.`}
      className={`rounded-2xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
        ready ? 'border-success-200 bg-success-50 hover:border-success-300' : 'border-surface-200 bg-surface-50 hover:border-surface-300'
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-surface-900">{ready ? 'Ready' : 'Needs work'}</p>
    </button>
  )
}
