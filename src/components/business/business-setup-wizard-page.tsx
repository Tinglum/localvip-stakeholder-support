'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowRight, CheckCircle2, CreditCard, Image as ImageIcon, Loader2, Plus, RefreshCw, Rocket, Search, Store, Tag, Users, Wallet, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { resolveBusinessOffer } from '@/lib/offers'
import {
  getBusinessLaunchPhase,
  getBusinessPortalData,
  resolveScopedBusiness,
} from '@/lib/business-portal'
import {
  BUSINESS_SETUP_CONFIG_STEPS,
  getBusinessSetupState,
  type BusinessSetupStepKey,
  type BusinessSetupSignals,
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
  useOfferInsert,
  useOffers,
  useOfferUpdate,
} from '@/lib/supabase/hooks'
import {
  BUSINESS_CATEGORIES,
  getBusinessCategoryById,
  getBusinessCategoryId,
  getKeywordGroupsForCategory,
} from '@/lib/business-catalog'
// Client-side Supabase removed — media uploads now use the /api/crm/businesses/[id]/media route

/** The steps that are actually edited on this page. The full checklist — these
 *  plus the do-it-on-another-page tasks — lives in `@/lib/business-setup`. */
type StepKey = BusinessSetupStepKey
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const STEP_ICONS: Record<BusinessSetupStepKey, React.ReactNode> = {
  profile: <Store className="h-4 w-4" />,
  branding: <ImageIcon className="h-4 w-4" />,
  capture: <Tag className="h-4 w-4" />,
  cashback: <Wallet className="h-4 w-4" />,
  stripe: <CreditCard className="h-4 w-4" />,
  activate: <Rocket className="h-4 w-4" />,
}

const STEPS = BUSINESS_SETUP_CONFIG_STEPS.map((step) => ({
  key: step.key as StepKey,
  label: step.label,
  description: step.description,
  icon: STEP_ICONS[step.key],
}))
const STEP_SEQUENCE: StepKey[] = STEPS.map((step) => step.key)

function normalizeKeywords(values: string[]) {
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
  hundredListInterest: 'interested' | 'not_now' | null
  cashbackPercent: number
  supportedCauseId: string | null
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
    cashbackPercent: input.cashbackPercent,
    supportedCauseId: input.supportedCauseId,
  })
}

export function BusinessSetupWizardPage() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  // supabase client removed — media uploads now use the server API route
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
  const { update: updateBusiness } = useBusinessUpdate()
  const { insert: insertOffer } = useOfferInsert()
  const { update: updateOffer } = useOfferUpdate()

  const initialStep = React.useMemo<StepKey>(() => {
    const requested = searchParams.get('step')
    return isStepKey(requested) ? requested : 'profile'
  }, [searchParams])
  const [step, setStep] = React.useState<StepKey>(initialStep)
  // A `?step=` link means the owner asked for a specific step — always honour it,
  // even after setup is finished.
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [stepValidation, setStepValidation] = React.useState<Partial<Record<StepKey, boolean>>>({})

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
  const [hundredListInterest, setHundredListInterest] = React.useState<'interested' | 'not_now' | null>(null)
  const [cashbackPercent, setCashbackPercent] = React.useState(10)
  const [cashbackTouched, setCashbackTouched] = React.useState(false)
  const [activating, setActivating] = React.useState(false)
  const [completionAttempted, setCompletionAttempted] = React.useState(false)
  const [stripeStatus, setStripeStatus] = React.useState<StripeOnboardingStatus | null>(null)
  const [stripeLoading, setStripeLoading] = React.useState(true)
  const [stripeError, setStripeError] = React.useState<string | null>(null)
  const [stripeRefreshKey, setStripeRefreshKey] = React.useState(0)
  const [openingStripe, setOpeningStripe] = React.useState(false)
  const [captureOfferId, setCaptureOfferId] = React.useState<string | null>(null)
  const [cashbackOfferId, setCashbackOfferId] = React.useState<string | null>(null)
  // The cause this business supports. Auto-attached as the first cause to every
  // customer who joins through this business's referral link.
  const [supportedCauseId, setSupportedCauseId] = React.useState<string | null>(null)
  const [causeOptions, setCauseOptions] = React.useState<Array<{ id: string; name: string }>>([])
  const [causeError, setCauseError] = React.useState<string | null>(null)
  const [causeRetryKey, setCauseRetryKey] = React.useState(0)
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = React.useRef('')
  // Identity of the record currently seeded into the inputs. We only re-seed when
  // this changes — see the seeding effect below.
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

  const portal = React.useMemo(
    () => (business ? getBusinessPortalData(business) : {}),
    [business]
  )
  const captureOffer = business ? resolveBusinessOffer(business, offers, 'capture') : null
  const cashbackOffer = business ? resolveBusinessOffer(business, offers, 'cashback') : null
  const launchPhase = business ? getBusinessLaunchPhase(business, contacts) : 'setup'

  React.useEffect(() => {
    setStep(initialStep)
  }, [initialStep])

  // Load the cause list so the business can pick the cause it supports.
  React.useEffect(() => {
    let cancelled = false
    setCauseError(null)
    fetch('/api/qa/nonprofits')
      .then(res => {
        if (!res.ok) throw new Error('Cause request failed')
        return res.json()
      })
      .then((items: Array<{ id: number; name: string }>) => {
        if (cancelled || !Array.isArray(items)) return
        setCauseOptions(
          items
            .filter(c => c && c.id != null && c.name)
            .map(c => ({ id: String(c.id), name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      })
      .catch(() => {
        if (!cancelled) setCauseError('Causes could not be loaded. Try again.')
      })
    return () => { cancelled = true }
  }, [causeRetryKey])

  const refreshStripeStatus = React.useCallback(async (): Promise<StripeOnboardingStatus | null> => {
    if (!business) return null
    const businessId = business.id
    if (!businessId) {
      setStripeStatus(null)
      setStripeError('This business is not linked to a QA business account.')
      setStripeLoading(false)
      return null
    }
    setStripeLoading(true)
    setStripeError(null)
    try {
      const query = `?businessId=${encodeURIComponent(businessId)}`
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
  }, [business])

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
    const businessId = business.id
    if (!businessId) {
      setStripeError('This business is not linked to a QA business account.')
      return
    }
    setOpeningStripe(true)
    setStripeError(null)
    try {
      const response = await fetch(`/api/business-portal/stripe-onboarding?businessId=${encodeURIComponent(businessId)}`, { method: 'POST' })
      const result = await response.json().catch(() => ({})) as { onboardingUrl?: string; error?: string }
      if (response.status === 409) {
        const refreshedStatus = await refreshStripeStatus()
        if (refreshedStatus?.status === 'complete') {
          setStripeError(null)
          setStep('activate')
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
  }, [business, refreshStripeStatus])

  React.useEffect(() => {
    if (!business) return

    // Only re-seed the inputs when the underlying record IDENTITY changes — a
    // different business, or the capture/cashback offers finishing their load.
    // Re-seeding on every `business` object update (e.g. the one returned by our
    // own autosave) overwrites characters the user typed during the save
    // round-trip, which made typing feel staccato / jump backwards.
    const seedKey = `${business.id}|${captureOffer?.id || ''}|${cashbackOffer?.id || ''}`
    if (seededKeyRef.current === seedKey) return
    seededKeyRef.current = seedKey

    const savedCategoryId = business.business_type || getBusinessCategoryId(business.category)

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
    setHundredListInterest(
      portal.hundred_list_interest === 'interested' || portal.hundred_list_interest === 'not_now'
        ? portal.hundred_list_interest
        : captureOffer?.id
          ? 'interested'
          : null,
    )
    setCashbackPercent(cashbackOffer?.cashback_percent || 10)
    setCaptureOfferId(captureOffer?.id || null)
    setCashbackOfferId(cashbackOffer?.id || null)
    setSupportedCauseId(business.linked_cause_id || null)
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
      hundredListInterest:
        portal.hundred_list_interest === 'interested' || portal.hundred_list_interest === 'not_now'
          ? portal.hundred_list_interest
          : captureOffer?.id
            ? 'interested'
            : null,
      cashbackPercent: cashbackOffer?.cashback_percent || 10,
      supportedCauseId: business.linked_cause_id || null,
    })
  }, [business, cashbackOffer?.cashback_percent, cashbackOffer?.id, captureOffer?.description, captureOffer?.headline, captureOffer?.id, captureOffer?.value_label, portal.avg_ticket, portal.cover_photo_url, portal.description, portal.hundred_list_interest, portal.logo_url, portal.products_services])

  const persistChanges = React.useCallback(async (options?: {
    businessPatch?: Record<string, unknown>
    metadataOverrides?: Record<string, unknown>
    forceCashback?: boolean
  }): Promise<boolean> => {
    if (!business) return false

    try {
      setSaveState('saving')
      setSaveError(null)

      let nextLogoUrl = logoUrl
      let nextCoverUrl = coverUrl

      // Upload via the server API route which handles storage + top-level column updates
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
        hundred_list_activation_status: hundredListInterest === 'interested'
          ? portal.hundred_list_activation_status === 'active' || portal.hundred_list_activation_status === 'in_setup'
            ? portal.hundred_list_activation_status
            : 'requested'
          : hundredListInterest === 'not_now'
            ? 'not_requested'
            : undefined,
        offer_title: captureHeadline,
        offer_description: captureDescription,
        offer_value: captureValue,
        cashback_percent: cashbackPercent,
        cashback_offer_title: 'Standard LocalVIP Cashback',
        cashback_offer_description: 'This is the percentage customers receive back when they shop with you through LocalVIP.',
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
        linked_cause_id: supportedCauseId,
        metadata: nextMetadata as Record<string, unknown>,
        ...(options?.businessPatch || {}),
      })
      if (!savedBusiness) {
        throw new Error('Business setup could not be saved.')
      }

      // Only persist a capture offer once the business has actually written a
      // headline (or one already exists). Avoids eagerly creating a placeholder
      // offer that makes the 100-List step look "Done" before it really is.
      let savedCapture: { id?: string } | null = null
      if (captureHeadline.trim() || captureOfferId) {
        const capturePayload = {
          business_id: business.id,
          offer_type: 'capture' as const,
          status: captureHeadline.trim() ? 'active' as const : 'draft' as const,
          headline: captureHeadline.trim() || 'Customer capture offer',
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
          throw new Error('The 100-list offer could not be saved.')
        }
      }

      // Likewise, only write the cashback offer once the business has explicitly
      // set a rate this session (or one already exists). The 10% default is a
      // suggestion, not a completed choice.
      let savedCashback: { id?: string } | null = null
      if (options?.forceCashback || cashbackTouched || cashbackOfferId) {
        const cashbackPayload = {
          business_id: business.id,
          offer_type: 'cashback' as const,
          status: 'active' as const,
          headline: 'Standard LocalVIP Cashback',
          description: 'This is the percentage customers receive back when they shop with you through LocalVIP.',
          value_type: 'cashback_percent',
          value_label: `${cashbackPercent}% cashback`,
          cashback_percent: cashbackPercent,
          starts_at: null,
          ends_at: null,
          metadata: { source: 'business_setup' },
        }
        savedCashback = cashbackOfferId
          ? await updateOffer(cashbackOfferId, cashbackPayload)
          : await insertOffer(cashbackPayload)
        if (!savedCashback) {
          throw new Error('The cashback offer could not be saved.')
        }
      }

      if (savedCapture?.id) setCaptureOfferId(savedCapture.id)
      if (savedCashback?.id) setCashbackOfferId(savedCashback.id)

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
        cashbackPercent,
        supportedCauseId,
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
  }, [
    avgTicket,
    business,
    captureDescription,
    captureHeadline,
    hundredListInterest,
    captureOfferId,
    captureValue,
    cashbackOfferId,
    cashbackPercent,
    cashbackTouched,
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
    supportedCauseId,
    updateBusiness,
    updateOffer,
  ])

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
      cashbackPercent,
      supportedCauseId,
    })

    if (!snapshotRef.current || snapshot === snapshotRef.current) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void persistChanges()
    }, 650)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [avgTicket, business, captureDescription, captureHeadline, captureValue, cashbackPercent, categoryId, coverFile, coverUrl, description, hundredListInterest, keywords, logoFile, logoUrl, name, persistChanges, supportedCauseId])

  if (businessLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading business setup...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Store className="h-8 w-8" />}
        title="Business setup will appear here"
        description="We couldn't find your business details for this account yet."
      />
    )
  }

  // Completion is evaluated by the shared checklist against the DRAFT values in
  // these inputs, so the rail updates as the owner types and can never drift
  // from what the nav and the dashboard believe.
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
    cashbackPercent,
    cashbackChosen: cashbackTouched || !!cashbackOfferId,
    supportedCauseId,
    stripeConnected: stripeStatus?.status === 'complete',
    liveReviewSubmitted:
      String(business.status || '') === 'pending_live_review'
      || String(business.status || '') === 'live'
      || business.stage === 'live',
  }
  const setupState = getBusinessSetupState(signals)
  const stepCompletion = new Map(setupState.steps.map((step) => [step.key, step.complete]))
  const completeProfile = !!stepCompletion.get('profile')
  const completeBranding = !!stepCompletion.get('branding')
  const completeCapture = !!stepCompletion.get('capture')
  const completeCashback = !!stepCompletion.get('cashback')
  const completeStripe = !!stepCompletion.get('stripe')
  const readyToActivate = setupState.readyToActivate
  const completedStepsCount = setupState.completedCount
  const completionRatio = setupState.ratio
  const activeStepMeta = STEPS.find((item) => item.key === step) || STEPS[0]
  const showProfileValidation = !!stepValidation.profile
  const showBrandingValidation = !!stepValidation.branding
  const showCaptureValidation = !!stepValidation.capture
  const showCashbackValidation = !!stepValidation.cashback
  const profileNameMissing = !name.trim()
  const profileCategoryMissing = !getBusinessCategoryById(categoryId)
  const profileDescriptionMissing = !description.trim()
  const brandingLogoMissing = !(logoUrl || logoFile)
  const brandingCoverMissing = !(coverUrl || coverFile)
  const hundredListChoiceMissing = hundredListInterest === null
  const captureHeadlineMissing = !captureHeadline.trim()
  const captureDescriptionMissing = !captureDescription.trim()
  const captureValueMissing = !captureValue.trim()
  const cashbackMissing = !(cashbackTouched || !!cashbackOfferId)
  const stripeRequirements = stripeStatus ? stripeRequirementLabels(stripeStatus) : []
  const stripeOnboardingStarted = stripeStatus?.onboardingStarted === true
  const missingSetupSteps = setupState.steps.filter((item) => item.key !== 'activate' && !item.complete)
  const firstMissingSetupStep = missingSetupSteps[0] || null

  function getStepCompletion(key: StepKey) {
    return !!stepCompletion.get(key)
  }

  function getNextStep(key: StepKey) {
    const currentIndex = STEP_SEQUENCE.indexOf(key)
    if (currentIndex < 0 || currentIndex === STEP_SEQUENCE.length - 1) return null
    return STEP_SEQUENCE[currentIndex + 1]
  }

  function toggleKeyword(keyword: string) {
    setKeywords((current) => {
      const exists = current.some((value) => value.localeCompare(keyword, undefined, { sensitivity: 'accent' }) === 0)
      return exists
        ? current.filter((value) => value.localeCompare(keyword, undefined, { sensitivity: 'accent' }) !== 0)
        : normalizeKeywords([...current, keyword])
    })
  }

  function addCustomKeyword() {
    const keyword = customKeyword.trim().replace(/\s+/g, ' ')
    if (!keyword) return
    setKeywords((current) => normalizeKeywords([...current, keyword]))
    setCustomKeyword('')
  }

  async function handleSaveAndNext(key: StepKey) {
    setStepValidation((current) => ({ ...current, [key]: true }))
    const readyToSave = key === 'cashback'
      ? cashbackPercent >= 5 && cashbackPercent <= 25 && !!supportedCauseId
      : getStepCompletion(key)
    if (!readyToSave) return

    if (key === 'cashback') setCashbackTouched(true)
    const saved = await persistChanges({ forceCashback: key === 'cashback' })
    if (!saved) return

    const nextStep = getNextStep(key)
    if (!nextStep) return

    setStepValidation((current) => ({ ...current, [key]: false }))
    setStep(nextStep)
  }

  async function activatePortal() {
    if (!readyToActivate) {
      setCompletionAttempted(true)
      setStepValidation((current) => ({
        ...current,
        ...Object.fromEntries(missingSetupSteps.map((item) => [item.key, true])),
      }))
      if (firstMissingSetupStep) setStep(firstMissingSetupStep.key)
      return
    }

    setActivating(true)
    try {
      const requestedAt = new Date().toISOString()
      const saved = await persistChanges({
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
      if (!saved) return
      window.location.href = '/portal/clients?review=submitted'
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Business Setup"
        description="Open any step, finish the requirements, then complete onboarding for live review."
        actions={
          <div className="flex items-center gap-2 text-sm text-surface-500">
            {saveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : saveState === 'saved' ? <CheckCircle2 className="h-4 w-4 text-success-600" /> : null}
            <span>{saveState === 'saving' ? 'Saving changes...' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Autosave failed' : 'Changes save automatically'}</span>
          </div>
        }
      />

      <Card className="overflow-hidden border-surface-200">
        <CardContent className="p-0">
          <div className="border-b border-surface-200 bg-surface-50 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Setup progress</p>
                <p className="mt-1 text-sm font-semibold text-surface-950">
                  {completedStepsCount} of {setupState.totalSteps} steps complete
                </p>
              </div>
              <div className="flex items-center gap-3 sm:min-w-64 sm:justify-end">
                <div
                  className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-200 sm:max-w-64"
                  role="progressbar"
                  aria-label="Onboarding completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(completionRatio * 100)}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-success-500 via-teal-500 to-brand-500 transition-all duration-500"
                    style={{ width: `${completionRatio * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-bold tabular-nums text-surface-800">{Math.round(completionRatio * 100)}%</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto px-3 py-5 sm:px-5">
            <ol className="flex min-w-[840px] items-start sm:min-w-0">
              {STEPS.map((item, index) => {
                const complete = getStepCompletion(item.key)
                const isActive = step === item.key
                const statusLabel = complete ? 'Complete' : isActive ? 'Current step' : 'Open step'
                return (
                  <li key={item.key} className="relative flex min-w-[140px] flex-1 justify-center">
                    {index < STEPS.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className={`absolute left-1/2 right-[-50%] top-6 h-1 -translate-y-1/2 ${complete ? 'bg-success-500' : 'bg-surface-200'}`}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setStep(item.key)}
                      className={`relative z-10 flex w-full flex-col items-center gap-2 rounded-xl px-2 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                        isActive ? 'bg-brand-50 text-brand-800' : complete ? 'text-success-800 hover:bg-success-50' : 'text-surface-500 hover:bg-surface-50'
                      }`}
                      aria-current={isActive ? 'step' : undefined}
                      aria-label={`${item.label}: ${statusLabel}. Open this step.`}
                    >
                      <span className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-white shadow-sm ${
                        complete
                          ? 'border-success-600 bg-success-600 text-white'
                          : isActive
                            ? 'border-brand-600 bg-brand-600 text-white ring-4 ring-brand-100'
                            : 'border-surface-300 text-surface-500'
                      }`}>
                        {complete ? <CheckCircle2 className="h-5 w-5" /> : isActive ? item.icon : <span className="text-sm font-bold">{index + 1}</span>}
                      </span>
                      <span className="max-w-[130px] text-xs font-bold leading-4 sm:text-sm">{item.label}</span>
                      <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${complete ? 'text-success-700' : isActive ? 'text-brand-700' : 'text-surface-400'}`}>
                        {statusLabel}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </CardContent>
      </Card>

      {saveError ? <p className="text-sm text-danger-600">{saveError}</p> : null}

      <Card className={setupState.isComplete ? 'border-success-200 bg-success-50/60' : 'border-brand-200 bg-gradient-to-r from-brand-50 via-white to-white'}>
        <CardContent className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${setupState.isComplete ? 'bg-success-600 text-white' : 'bg-brand-600 text-white'}`}>
              {setupState.isComplete ? <CheckCircle2 className="h-6 w-6" /> : <Rocket className="h-6 w-6" />}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-surface-950">{setupState.isComplete ? 'Onboarding complete' : 'Finish your onboarding'}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-600">
                {setupState.isComplete
                  ? 'All setup requirements are complete and your live-review request has been submitted.'
                  : 'Click the button to check every requirement. Any missing steps will be highlighted and opened for you.'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void activatePortal()}
            disabled={activating}
            className={`h-12 shrink-0 px-5 font-bold ${setupState.isComplete || readyToActivate ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
          >
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : setupState.isComplete || readyToActivate ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {activating ? 'Completing...' : 'COMPLETE ONBOARDING'}
          </Button>
        </CardContent>
      </Card>

      {completionAttempted && missingSetupSteps.length > 0 ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-950">Finish these steps before onboarding is complete</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {missingSetupSteps.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="outline"
                onClick={() => setStep(item.key)}
                className="border-red-300 bg-white text-red-800 hover:bg-red-100"
              >
                {item.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
          <Card className="border-surface-200 bg-gradient-to-r from-white via-surface-50 to-white">
            <CardContent className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-surface-950">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm ${
                    getStepCompletion(step)
                      ? 'border-success-600 bg-success-600 text-white'
                      : 'border-brand-500 bg-brand-500 text-white'
                  }`}>
                    {getStepCompletion(step) ? <CheckCircle2 className="h-4 w-4" /> : activeStepMeta.icon}
                  </span>
                  {activeStepMeta.label}
                </div>
                <p className="text-sm text-surface-600">{activeStepMeta.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStepCompletion(step) ? 'border-success-200 bg-success-100 text-success-800' : 'border-brand-200 bg-brand-100 text-brand-800'}>
                  {getStepCompletion(step) ? 'Completed' : 'Editing now'}
                </Badge>
                <span className="text-xs text-surface-500">
                  Step {STEPS.findIndex((item) => item.key === step) + 1} of {STEPS.length}
                </span>
              </div>
            </CardContent>
          </Card>

          {step === 'profile' && (
            <Card className="min-h-[58vh]">
              <CardHeader>
                <CardTitle>Business Profile</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel required>Business name</FieldLabel>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={showProfileValidation && profileNameMissing ? 'border-red-500 focus-visible:ring-red-200' : ''}
                  />
                  {showProfileValidation && profileNameMissing ? <RequiredFieldHint /> : null}
                </div>
                <div>
                  <FieldLabel required>Category</FieldLabel>
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-surface-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
                      showProfileValidation && profileCategoryMissing ? 'border-red-500' : 'border-surface-300'
                    }`}
                    aria-invalid={showProfileValidation && profileCategoryMissing}
                  >
                    <option value="">Choose a category</option>
                    {BUSINESS_CATEGORIES.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                  {showProfileValidation && profileCategoryMissing ? <RequiredFieldHint /> : null}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700" htmlFor="average-spend">Average spend per client</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-surface-500">$</span>
                    <Input
                      id="average-spend"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={avgTicket}
                      onChange={(event) => setAvgTicket(event.target.value)}
                      placeholder="25.00"
                      className="pl-7"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-surface-500">Typical amount one client spends in USD.</p>
                </div>
                <div className="md:col-span-2">
                  <FieldLabel required>Description</FieldLabel>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    className={showProfileValidation && profileDescriptionMissing ? 'border-red-500 focus-visible:ring-red-200' : ''}
                  />
                  {showProfileValidation && profileDescriptionMissing ? <RequiredFieldHint /> : null}
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-surface-700" htmlFor="keyword-search">Keywords</label>
                  <p className="mb-3 text-sm leading-6 text-surface-500">Choose words customers can use to find your business and what you offer.</p>

                  {keywords.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {keywords.map((keyword) => (
                        <span key={keyword} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">
                          {keyword}
                          <button
                            type="button"
                            onClick={() => toggleKeyword(keyword)}
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
                          value={keywordSearch}
                          onChange={(event) => setKeywordSearch(event.target.value)}
                          placeholder="Search keywords, such as pizza, Italian, massage..."
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-3">
                      {keywordGroups.length > 0 ? keywordGroups.map((group) => (
                        <div key={group.id} className="mb-4 last:mb-0">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-surface-500">{group.label}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.keywords.map((keyword) => {
                              const selected = keywords.some((value) => value.toLocaleLowerCase() === keyword.toLocaleLowerCase())
                              return (
                                <button
                                  key={keyword}
                                  type="button"
                                  onClick={() => toggleKeyword(keyword)}
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
                      )) : (
                        <p className="py-4 text-center text-sm text-surface-500">No catalog keywords match that search.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={customKeyword}
                      onChange={(event) => setCustomKeyword(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addCustomKeyword()
                        }
                      }}
                      placeholder="Add a custom keyword"
                    />
                    <Button type="button" variant="outline" onClick={addCustomKeyword} disabled={!customKeyword.trim()} className="shrink-0">
                      <Plus className="h-4 w-4" />
                      Add keyword
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-surface-500">New keywords are added to your business profile when you save.</p>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button className="h-12 px-6 text-base font-semibold" onClick={() => void handleSaveAndNext('profile')}>
                    Save and next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'branding' && (
            <Card className="min-h-[58vh]">
              <CardHeader>
                <CardTitle>Branding</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <FieldLabel required>Business logo</FieldLabel>
                    <p className="text-sm leading-6 text-surface-500">
                      This is your main brand mark. We use it in the middle of your QR code and in smaller places where people should recognize your business right away.
                    </p>
                    <p className="text-xs leading-5 text-surface-400">
                      Best choice: a square logo with a simple shape and a clean or transparent background, so it still looks sharp when it is shown small.
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} />
                  {showBrandingValidation && brandingLogoMissing ? <RequiredFieldHint /> : null}
                  <div className={`flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-surface-50 ${showBrandingValidation && brandingLogoMissing ? 'border-red-400' : 'border-surface-300'}`}>
                    {logoFile || logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={logoFile ? URL.createObjectURL(logoFile) : logoUrl || ''} alt="Logo preview" className="h-full w-full object-contain p-4" />
                    ) : (
                      <p className="text-sm text-surface-400">Upload the logo you want people to recognize first</p>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <FieldLabel required>Cover image</FieldLabel>
                    <p className="text-sm leading-6 text-surface-500">
                      This is the larger photo customers see first on your business page. Use it to show the feel of your business, like your food, your space, your storefront, or your experience.
                    </p>
                    <p className="text-xs leading-5 text-surface-400">
                      Best choice: a wide photo that feels inviting and easy to understand at a glance.
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
                  {showBrandingValidation && brandingCoverMissing ? <RequiredFieldHint /> : null}
                  <div className={`flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-surface-50 ${showBrandingValidation && brandingCoverMissing ? 'border-red-400' : 'border-surface-300'}`}>
                    {coverFile || coverUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={coverFile ? URL.createObjectURL(coverFile) : coverUrl || ''} alt="Cover preview" className="h-full w-full object-cover" />
                    ) : (
                      <p className="text-sm text-surface-400">Upload the main photo that should represent your business</p>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button className="h-12 px-6 text-base font-semibold" onClick={() => void handleSaveAndNext('branding')}>
                    Save and next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'capture' && (
            <Card className="min-h-[58vh] overflow-hidden">
              <CardContent className="space-y-7 p-6 md:p-10">
                <div className="mx-auto max-w-3xl text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-brand-600 text-white shadow-lg shadow-brand-200">
                    <Users className="h-7 w-7" />
                  </span>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Your launch audience</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-surface-950">Want to build your first 100 customers?</h2>
                  <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-surface-600">
                    LocalVIP can help turn local interest into a ready-to-reach customer list. You get a shareable signup experience, a QR code, and a simple launch offer that gives people a reason to join early.
                  </p>
                </div>

                <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setHundredListInterest('interested')}
                    className={`rounded-3xl border-2 p-6 text-left transition ${
                      hundredListInterest === 'interested'
                        ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100'
                        : 'border-surface-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold text-surface-950">Yes, help me build my 100 List</p>
                        <p className="mt-2 text-sm leading-6 text-surface-600">Flag this for the LocalVIP team so we can activate your customer-capture tools and help you start building momentum.</p>
                      </div>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${hundredListInterest === 'interested' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-surface-300'}`}>
                        {hundredListInterest === 'interested' ? <CheckCircle2 className="h-4 w-4" /> : null}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHundredListInterest('not_now')}
                    className={`rounded-3xl border-2 p-6 text-left transition ${
                      hundredListInterest === 'not_now'
                        ? 'border-surface-500 bg-surface-100'
                        : 'border-surface-200 bg-white hover:border-surface-400 hover:bg-surface-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold text-surface-950">Not right now</p>
                        <p className="mt-2 text-sm leading-6 text-surface-600">No problem. You can turn it on later from your business portal when you are ready to grow your list.</p>
                      </div>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${hundredListInterest === 'not_now' ? 'border-surface-600 bg-surface-600 text-white' : 'border-surface-300'}`}>
                        {hundredListInterest === 'not_now' ? <CheckCircle2 className="h-4 w-4" /> : null}
                      </span>
                    </div>
                  </button>
                </div>

                {showCaptureValidation && hundredListChoiceMissing ? (
                  <p className="text-center text-sm font-medium text-red-600">Choose one option to continue.</p>
                ) : null}

                <div className="hidden">
                  <FieldLabel required>Offer headline</FieldLabel>
                  <p className="mb-2 text-sm leading-6 text-surface-500">
                    This is the first line customers notice. Keep it short, clear, and specific, like “Free cookie with any coffee.”
                  </p>
                  <Input
                    value={captureHeadline}
                    onChange={(event) => setCaptureHeadline(event.target.value)}
                    placeholder="Free coffee with purchase"
                    className={showCaptureValidation && captureHeadlineMissing ? 'border-red-500 focus-visible:ring-red-200' : ''}
                  />
                  {showCaptureValidation && captureHeadlineMissing ? <RequiredFieldHint /> : null}
                </div>
                <div className="hidden">
                  <FieldLabel required>Offer description</FieldLabel>
                  <p className="mb-2 text-sm leading-6 text-surface-500">
                    Explain exactly what they get and any simple condition that comes with it, like “with purchase” or “one per customer.” This is the fuller explanation under the headline.
                  </p>
                  <Textarea
                    value={captureDescription}
                    onChange={(event) => setCaptureDescription(event.target.value)}
                    rows={4}
                    placeholder="Tell customers exactly what they get when they join your list."
                    className={showCaptureValidation && captureDescriptionMissing ? 'border-red-500 focus-visible:ring-red-200' : ''}
                  />
                  {showCaptureValidation && captureDescriptionMissing ? <RequiredFieldHint /> : null}
                </div>
                <div className="hidden">
                  <FieldLabel required>Offer value label</FieldLabel>
                  <p className="mb-2 text-sm leading-6 text-surface-500">
                    This is the shorter version we use in tighter spaces, like QR cards, badges, and smaller materials. Keep it compact and easy to scan quickly.
                  </p>
                  <Input
                    value={captureValue}
                    onChange={(event) => setCaptureValue(event.target.value)}
                    placeholder="Free cookie with purchase"
                    className={showCaptureValidation && captureValueMissing ? 'border-red-500 focus-visible:ring-red-200' : ''}
                  />
                  {showCaptureValidation && captureValueMissing ? <RequiredFieldHint /> : null}
                </div>
                <div className="flex justify-end">
                  <Button className="h-12 px-6 text-base font-semibold" onClick={() => void handleSaveAndNext('capture')}>
                    Save choice and continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'cashback' && (
            <Card className="min-h-[58vh]">
              <CardHeader>
                <CardTitle>LocalVIP Cashback (Live)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                  This is the percentage customers receive back when they shop with you through LocalVIP.
                </div>
                <div>
                  <FieldLabel required>Cashback percentage</FieldLabel>
                  {showCashbackValidation && cashbackMissing ? <RequiredFieldHint /> : null}
                </div>
                <div className={`rounded-2xl border bg-surface-50 px-4 py-4 ${showCashbackValidation && cashbackMissing ? 'border-red-400' : 'border-surface-200'}`}>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-surface-500">Cashback</p>
                      <p className="mt-2 text-4xl font-bold text-surface-900">{cashbackPercent}%</p>
                    </div>
                    <Badge variant="info">{cashbackPercent === 10 ? 'Recommended default' : cashbackPercent > 10 ? 'Faster growth potential' : 'Lower intro offer'}</Badge>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={25}
                    step={1}
                    value={cashbackPercent}
                    onChange={(event) => {
                      setCashbackPercent(Number(event.target.value))
                      setCashbackTouched(true)
                    }}
                    className="mt-5 w-full"
                  />
                  <div className="mt-2 flex justify-between text-xs text-surface-400">
                    <span>5%</span>
                    <span>10%</span>
                    <span>25%</span>
                  </div>
                </div>

                <div>
                  <FieldLabel required>The cause you support</FieldLabel>
                  <p className="mb-2 text-sm text-surface-500">
                    Every customer who joins LocalVIP through your link automatically supports this cause first. You&apos;re picking the one cause you want to champion above all others.
                  </p>
                  <select
                    value={supportedCauseId ?? ''}
                    onChange={(event) => setSupportedCauseId(event.target.value || null)}
                    className={`h-12 w-full rounded-xl border bg-surface-0 px-3 text-sm text-surface-900 ${showCashbackValidation && !supportedCauseId ? 'border-red-400' : 'border-surface-200'}`}
                  >
                    <option value="">Select a cause…</option>
                    {causeOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {causeError ? (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <span>{causeError}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => setCauseRetryKey((value) => value + 1)}>
                        Try again
                      </Button>
                    </div>
                  ) : null}
                  {showCashbackValidation && !supportedCauseId ? <RequiredFieldHint /> : null}
                </div>

                <div className="flex justify-end">
                  <Button className="h-12 px-6 text-base font-semibold" onClick={() => void handleSaveAndNext('cashback')}>
                    Save and next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'stripe' && (
            <Card className="min-h-[58vh]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-brand-600" />
                  Connect Stripe Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="max-w-3xl">
                  <p className="text-base leading-7 text-surface-700">
                    LocalVIP uses Stripe to securely process customer payments and send your share directly to your business bank account.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-surface-500">
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
                  <div className="rounded-2xl border border-success-300 bg-success-50 px-5 py-6">
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

                {!stripeLoading && stripeStatus && stripeStatus.status !== 'complete' && stripeOnboardingStarted ? (
                  <div className={`rounded-2xl border px-5 py-6 ${stripeStatus.status === 'restricted' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                    <div className="flex items-start gap-4">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${stripeStatus.status === 'restricted' ? 'bg-red-600' : 'bg-amber-500'}`}>
                        {stripeStatus.status === 'restricted' ? <AlertTriangle className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
                      </span>
                      <div>
                        <p className={`text-lg font-semibold ${stripeStatus.status === 'restricted' ? 'text-red-950' : 'text-amber-950'}`}>{stripeStatusLabel(stripeStatus.status)}</p>
                        <p className={`mt-1 text-sm leading-6 ${stripeStatus.status === 'restricted' ? 'text-red-800' : 'text-amber-800'}`}>{stripeStatusSummary(stripeStatus)}</p>
                        {stripeStatus.nextAction ? <p className="mt-3 text-sm font-medium text-surface-800">Next: {stripeStatus.nextAction}</p> : null}
                        {stripeRequirements.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-surface-600">Still needed</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-surface-700">
                              {stripeRequirements.map(item => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {!stripeLoading && stripeStatus && stripeStatus.status !== 'complete' && !stripeOnboardingStarted ? (
                  <div className="rounded-2xl border border-brand-200 bg-brand-50 px-5 py-6">
                    <div className="flex items-start gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                        <CreditCard className="h-6 w-6" />
                      </span>
                      <div>
                        <p className="text-lg font-semibold text-surface-950">Connect Stripe to receive payments</p>
                        <p className="mt-1 text-sm leading-6 text-surface-700">
                          Start the secure Stripe setup when you are ready. We will show any remaining requirements after you begin.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {stripeError ? (
                  <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-6">
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
                    <Button
                      onClick={() => void openStripeOnboarding()}
                      disabled={openingStripe}
                      className="h-12 px-6 text-base font-semibold"
                    >
                      {openingStripe ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      {openingStripe ? 'Opening Stripe...' : 'Complete Stripe setup'}
                    </Button>
                  ) : null}
                  {!stripeLoading && stripeStatus?.status === 'complete' ? (
                    <Button
                      onClick={() => setStep('activate')}
                      className="h-12 px-6 text-base font-semibold"
                    >
                      Continue to Go Live
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {stripeError || (!stripeLoading && stripeStatus?.status !== 'complete') ? (
                    <Button
                      variant="outline"
                      onClick={() => setStripeRefreshKey(value => value + 1)}
                      disabled={stripeLoading}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Check status again
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'activate' && (
            <Card className="min-h-[58vh]">
              <CardHeader>
                <CardTitle>Submit for Live Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <StatusPill label="Profile" ready={completeProfile} onOpen={() => setStep('profile')} />
                  <StatusPill label="Branding" ready={completeBranding} onOpen={() => setStep('branding')} />
                  <StatusPill label="100 List choice" ready={completeCapture} onOpen={() => setStep('capture')} />
                  <StatusPill label="Cashback" ready={completeCashback} onOpen={() => setStep('cashback')} />
                  <StatusPill label="Stripe" ready={completeStripe} onOpen={() => setStep('stripe')} />
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <p className="text-sm font-semibold text-surface-900">What unlocks next</p>
                  <p className="mt-2 text-sm leading-6 text-surface-600">
                    Once you submit this, LocalVIP can review the business, confirm everything looks right, and then make it live in the system.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void activatePortal()} disabled={activating}>
                    {activating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit for live review
                        <Rocket className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/portal/business">
                      Open My Business
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
    </div>
  )
}

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-surface-700">
      {children}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </label>
  )
}

function RequiredFieldHint() {
  return <p className="mt-1 text-sm font-medium text-red-600">(Required field)</p>
}

function StatusPill({ label, ready, onOpen }: { label: string; ready: boolean; onOpen: () => void }) {
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

function isStepKey(value: string | null): value is StepKey {
  return value === 'profile'
    || value === 'branding'
    || value === 'capture'
    || value === 'cashback'
    || value === 'stripe'
    || value === 'activate'
}
