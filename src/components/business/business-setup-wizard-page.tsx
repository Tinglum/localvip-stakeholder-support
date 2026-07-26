'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowRight, CheckCircle2, CreditCard, Image as ImageIcon, Loader2, PartyPopper, RefreshCw, Rocket, Store, Tag, Wallet } from 'lucide-react'
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

function splitProducts(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
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
  const { data: businesses, loading: businessLoading } = useBusinesses(businessFilters)
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
  const [reviewing, setReviewing] = React.useState(() => isStepKey(searchParams.get('step')))
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [stepValidation, setStepValidation] = React.useState<Partial<Record<StepKey, boolean>>>({})

  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [avgTicket, setAvgTicket] = React.useState('')
  const [products, setProducts] = React.useState('')
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null)
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [coverFile, setCoverFile] = React.useState<File | null>(null)
  const [captureHeadline, setCaptureHeadline] = React.useState('')
  const [captureDescription, setCaptureDescription] = React.useState('')
  const [captureValue, setCaptureValue] = React.useState('')
  const [cashbackPercent, setCashbackPercent] = React.useState(10)
  const [cashbackTouched, setCashbackTouched] = React.useState(false)
  const [activating, setActivating] = React.useState(false)
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
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = React.useRef('')
  // Identity of the record currently seeded into the inputs. We only re-seed when
  // this changes — see the seeding effect below.
  const seededKeyRef = React.useRef<string | null>(null)

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
    fetch('/api/qa/nonprofits')
      .then(res => (res.ok ? res.json() : []))
      .then((items: Array<{ id: number; name: string }>) => {
        if (cancelled || !Array.isArray(items)) return
        setCauseOptions(
          items
            .filter(c => c && c.id != null && c.name)
            .map(c => ({ id: String(c.id), name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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

    setName(business.name || '')
    setCategory(business.category || '')
    setDescription(business.public_description || portal.description || '')
    setAvgTicket(business.avg_ticket || portal.avg_ticket || '')
    setProducts((business.products_services || []).join(', '))
    setLogoUrl(business.logo_url || portal.logo_url || null)
    setCoverUrl(business.cover_photo_url || portal.cover_photo_url || null)
    setCaptureHeadline(captureOffer?.headline || '')
    setCaptureDescription(captureOffer?.description || '')
    setCaptureValue(captureOffer?.value_label || '')
    setCashbackPercent(cashbackOffer?.cashback_percent || 10)
    setCaptureOfferId(captureOffer?.id || null)
    setCashbackOfferId(cashbackOffer?.id || null)
    setSupportedCauseId(business.linked_cause_id || null)
    snapshotRef.current = JSON.stringify({
      name: business.name || '',
      category: business.category || '',
      description: business.public_description || portal.description || '',
      avgTicket: business.avg_ticket || portal.avg_ticket || '',
      products: (business.products_services || []).join(', '),
      logoUrl: business.logo_url || portal.logo_url || null,
      coverUrl: business.cover_photo_url || portal.cover_photo_url || null,
      captureHeadline: captureOffer?.headline || '',
      captureDescription: captureOffer?.description || '',
      captureValue: captureOffer?.value_label || '',
      cashbackPercent: cashbackOffer?.cashback_percent || 10,
      supportedCauseId: business.linked_cause_id || null,
    })
  }, [business, cashbackOffer?.cashback_percent, cashbackOffer?.id, captureOffer?.description, captureOffer?.headline, captureOffer?.id, captureOffer?.value_label, portal.avg_ticket, portal.cover_photo_url, portal.description, portal.logo_url])

  const persistChanges = React.useCallback(async (options?: {
    businessPatch?: Record<string, unknown>
    metadataOverrides?: Record<string, unknown>
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
        if (uploadResponse.ok && uploadResult.fileUrl) {
          nextLogoUrl = uploadResult.fileUrl
        }
        setLogoFile(null)
      }

      if (coverFile) {
        const formData = new FormData()
        formData.append('file', coverFile)
        formData.append('mediaType', 'cover_photo')
        const uploadResponse = await fetch(`/api/crm/businesses/${business.id}/media`, { method: 'POST', body: formData })
        const uploadResult = await uploadResponse.json().catch(() => ({}))
        if (uploadResponse.ok && uploadResult.fileUrl) {
          nextCoverUrl = uploadResult.fileUrl
        }
        setCoverFile(null)
      }

      const nextMetadata = {
        ...portal,
        logo_url: nextLogoUrl,
        cover_photo_url: nextCoverUrl,
        capture_offer_title: captureHeadline,
        capture_offer_description: captureDescription,
        capture_offer_value: captureValue,
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
        category: category || null,
        public_description: description || null,
        avg_ticket: avgTicket || null,
        products_services: splitProducts(products),
        launch_phase: launchPhase === 'setup' ? 'setup' : business.launch_phase || null,
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
      if (cashbackTouched || cashbackOfferId) {
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
      snapshotRef.current = JSON.stringify({
        name,
        category,
        description,
        avgTicket,
        products,
        logoUrl: nextLogoUrl,
        coverUrl: nextCoverUrl,
        captureHeadline,
        captureDescription,
        captureValue,
        cashbackPercent,
        supportedCauseId,
      })

      setSaveState('saved')
      refetchOffers({ silent: true })
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
    captureOfferId,
    captureValue,
    cashbackOfferId,
    cashbackPercent,
    cashbackTouched,
    category,
    coverFile,
    coverUrl,
    description,
    insertOffer,
    launchPhase,
    logoFile,
    logoUrl,
    name,
    portal,
    products,
    refetchOffers,
    supportedCauseId,
    updateBusiness,
    updateOffer,
  ])

  React.useEffect(() => {
    if (!business) return

    const snapshot = JSON.stringify({
      name,
      category,
      description,
      avgTicket,
      products,
      logoUrl,
      coverUrl,
      logoFile: logoFile?.name || null,
      coverFile: coverFile?.name || null,
      captureHeadline,
      captureDescription,
      captureValue,
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
  }, [avgTicket, business, captureDescription, captureHeadline, captureValue, cashbackPercent, category, coverFile, coverUrl, description, logoFile, logoUrl, name, persistChanges, products, supportedCauseId])

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
    description,
    logoUrl: logoUrl || (logoFile ? logoFile.name : null),
    coverUrl: coverUrl || (coverFile ? coverFile.name : null),
    captureHeadline,
    captureDescription,
    captureValue,
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
  const profileDescriptionMissing = !description.trim()
  const brandingLogoMissing = !(logoUrl || logoFile)
  const brandingCoverMissing = !(coverUrl || coverFile)
  const captureHeadlineMissing = !captureHeadline.trim()
  const captureDescriptionMissing = !captureDescription.trim()
  const captureValueMissing = !captureValue.trim()
  const cashbackMissing = !(cashbackTouched || !!cashbackOfferId)
  const stripeRequirements = stripeStatus ? stripeRequirementLabels(stripeStatus) : []

  function getStepCompletion(key: StepKey) {
    return !!stepCompletion.get(key)
  }

  function getNextStep(key: StepKey) {
    const currentIndex = STEP_SEQUENCE.indexOf(key)
    if (currentIndex < 0 || currentIndex === STEP_SEQUENCE.length - 1) return null
    return STEP_SEQUENCE[currentIndex + 1]
  }

  async function handleSaveAndNext(key: StepKey) {
    setStepValidation((current) => ({ ...current, [key]: true }))
    if (!getStepCompletion(key)) return

    const saved = await persistChanges()
    if (!saved) return

    const nextStep = getNextStep(key)
    if (!nextStep) return

    setStepValidation((current) => ({ ...current, [key]: false }))
    setStep(nextStep)
  }

  async function activatePortal() {
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

  // Nothing left to do: setup retires itself. The route stays reachable by
  // direct URL (and from the "review it anyway" button) so this is never a dead
  // end, but the wizard doesn't nag a business that has already finished.
  if (setupState.isComplete && !reviewing) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Business Setup"
          description="Every setup step is finished."
        />
        <Card className="border-success-200 bg-success-50/60">
          <CardContent className="flex flex-col gap-5 px-6 py-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-success-600 text-white">
              <PartyPopper className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-surface-950">You&apos;re all set</h2>
              <p className="max-w-2xl text-sm leading-6 text-surface-600">
                Your profile, branding, offers, cashback, cause, and Stripe connection are complete. Your live-review request has been submitted.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/portal/business">
                  Open My Business
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/portal/network">See my network</Link>
              </Button>
              <Button variant="ghost" onClick={() => setReviewing(true)}>
                Review my setup anyway
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Business Setup"
        description="Complete each requirement in order, connect payments, then submit your business for live review."
        actions={
          <div className="flex items-center gap-2 text-sm text-surface-500">
            {saveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : saveState === 'saved' ? <CheckCircle2 className="h-4 w-4 text-success-600" /> : null}
            <span>{saveState === 'saving' ? 'Saving changes...' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Autosave failed' : 'Changes save automatically'}</span>
          </div>
        }
      />

      <Card className="overflow-hidden border-surface-200">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b border-surface-200 bg-surface-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Setup progress</p>
              <p className="mt-1 text-sm font-semibold text-surface-950">
                {completedStepsCount} of {setupState.totalSteps} steps complete
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-36 overflow-hidden rounded-full bg-surface-200 sm:w-52">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-success-500 to-brand-500 transition-all"
                  style={{ width: `${completionRatio * 100}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-surface-700">{Math.round(completionRatio * 100)}%</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[820px] grid-cols-6">
              {STEPS.map((item, index) => {
                const complete = getStepCompletion(item.key)
                const isActive = step === item.key
                const previousIncomplete = STEPS.slice(0, index).some((previousStep) => !getStepCompletion(previousStep.key))
                const isLocked = !complete && !isActive && previousIncomplete

                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setStep(item.key)}
                    className={`relative flex min-h-28 flex-col items-center justify-center gap-2 border-r border-surface-200 px-3 py-4 text-center transition-colors last:border-r-0 ${
                      isActive
                        ? 'bg-brand-50 text-brand-800'
                        : complete
                          ? 'bg-white text-success-800 hover:bg-success-50'
                          : 'bg-white text-surface-400'
                    } ${isLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-surface-50'}`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                      complete
                        ? 'border-success-600 bg-success-600 text-white'
                        : isActive
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-surface-300 bg-white'
                    }`}>
                      {complete ? <CheckCircle2 className="h-4 w-4" /> : item.icon}
                    </span>
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
                      {complete ? 'Complete' : isActive ? `Step ${index + 1}` : isLocked ? 'Locked' : 'Next'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {saveError ? <p className="text-sm text-danger-600">{saveError}</p> : null}

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
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Category</label>
                  <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Coffee shop, restaurant, salon..." />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Average spend</label>
                  <Input value={avgTicket} onChange={(event) => setAvgTicket(event.target.value)} placeholder="$12, $25, $60..." />
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
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Products / services</label>
                  <Input value={products} onChange={(event) => setProducts(event.target.value)} placeholder="Coffee, pastries, sandwiches" />
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
            <Card className="min-h-[58vh]">
              <CardHeader>
                <CardTitle>Customer Capture Offer (Pre-launch)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold text-amber-900">This is the offer people get when they join your list before launch.</p>
                  <p className="mt-2 leading-6">
                    Customers will see this after they scan your QR code. Make it simple, specific, and easy to say yes to right away, like a free cookie with purchase, a free coffee, a free soda, or a small discount.
                  </p>
                  <p className="mt-2 leading-6">
                    The job of this offer is to help you collect your first 100 customers before you go live. This is separate from your LocalVIP cashback offer.
                  </p>
                </div>
                <div>
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
                <div>
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
                <div>
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
                    Save and next
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

                {!stripeLoading && stripeStatus && stripeStatus.status !== 'complete' ? (
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
                  <StatusPill label="100-List Offer" ready={completeCapture} onOpen={() => setStep('capture')} />
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
                  <Button onClick={() => void activatePortal()} disabled={!readyToActivate || activating}>
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
    || value === 'activate'
}
