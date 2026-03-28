'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle2, Image as ImageIcon, Loader2, Rocket, Store, Tag, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { resolveBusinessOffer } from '@/lib/offers'
import { getBusinessLaunchPhase, getBusinessPortalData, resolveScopedBusiness } from '@/lib/business-portal'
import {
  useBusinesses,
  useBusinessUpdate,
  useContacts,
  useOfferInsert,
  useOffers,
  useOfferUpdate,
} from '@/lib/supabase/hooks'
import { createClient } from '@/lib/supabase/client'

type StepKey = 'profile' | 'branding' | 'capture' | 'cashback' | 'activate'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const STEPS: Array<{ key: StepKey; label: string; description: string; icon: React.ReactNode }> = [
  { key: 'profile', label: 'Business Profile', description: 'Tell us the basics customers need to understand your business.', icon: <Store className="h-4 w-4" /> },
  { key: 'branding', label: 'Branding', description: 'Add a logo and cover image for your business-facing pages.', icon: <ImageIcon className="h-4 w-4" /> },
  { key: 'capture', label: '100-List Offer', description: 'Create the pre-launch offer used only to collect your first 100 customers.', icon: <Tag className="h-4 w-4" /> },
  { key: 'cashback', label: 'LocalVIP Cashback', description: 'Set the live cashback customers will receive through LocalVIP.', icon: <Wallet className="h-4 w-4" /> },
  { key: 'activate', label: 'Activate', description: 'Review your setup and unlock your QR and 100 List.', icon: <Rocket className="h-4 w-4" /> },
]

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function splitProducts(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function BusinessSetupWizardPage() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const supabase = React.useMemo(() => createClient(), [])
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
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [saveError, setSaveError] = React.useState<string | null>(null)

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
  const [captureOfferId, setCaptureOfferId] = React.useState<string | null>(null)
  const [cashbackOfferId, setCashbackOfferId] = React.useState<string | null>(null)
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = React.useRef('')

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

  React.useEffect(() => {
    if (!business) return

    setName(business.name || '')
    setCategory(business.category || '')
    setDescription(business.public_description || portal.description || '')
    setAvgTicket(business.avg_ticket || portal.avg_ticket || '')
    setProducts((business.products_services || []).join(', '))
    setLogoUrl(portal.logo_url || null)
    setCoverUrl(portal.cover_photo_url || null)
    setCaptureHeadline(captureOffer?.headline || '')
    setCaptureDescription(captureOffer?.description || '')
    setCaptureValue(captureOffer?.value_label || '')
    setCashbackPercent(cashbackOffer?.cashback_percent || 10)
    setCaptureOfferId(captureOffer?.id || null)
    setCashbackOfferId(cashbackOffer?.id || null)
    snapshotRef.current = JSON.stringify({
      name: business.name || '',
      category: business.category || '',
      description: business.public_description || portal.description || '',
      avgTicket: business.avg_ticket || portal.avg_ticket || '',
      products: (business.products_services || []).join(', '),
      logoUrl: portal.logo_url || null,
      coverUrl: portal.cover_photo_url || null,
      captureHeadline: captureOffer?.headline || '',
      captureDescription: captureOffer?.description || '',
      captureValue: captureOffer?.value_label || '',
      cashbackPercent: cashbackOffer?.cashback_percent || 10,
    })
  }, [business, cashbackOffer?.cashback_percent, cashbackOffer?.id, captureOffer?.description, captureOffer?.headline, captureOffer?.id, captureOffer?.value_label, portal.avg_ticket, portal.cover_photo_url, portal.description, portal.logo_url])

  const persistChanges = React.useCallback(async () => {
    if (!business) return

    try {
      setSaveState('saving')
      setSaveError(null)

      let nextLogoUrl = logoUrl
      let nextCoverUrl = coverUrl

      if (logoFile) {
        const filePath = `business-logos/${business.id}/logo-${Date.now()}-${logoFile.name}`
        const uploadResult = await supabase.storage.from('public-assets').upload(filePath, logoFile, { upsert: true })
        if (uploadResult.error) {
          nextLogoUrl = await fileToDataUrl(logoFile)
        } else {
          nextLogoUrl = supabase.storage.from('public-assets').getPublicUrl(filePath).data.publicUrl
        }
        setLogoFile(null)
      }

      if (coverFile) {
        const filePath = `business-covers/${business.id}/cover-${Date.now()}-${coverFile.name}`
        const uploadResult = await supabase.storage.from('public-assets').upload(filePath, coverFile, { upsert: true })
        if (uploadResult.error) {
          nextCoverUrl = await fileToDataUrl(coverFile)
        } else {
          nextCoverUrl = supabase.storage.from('public-assets').getPublicUrl(filePath).data.publicUrl
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
      }

      await updateBusiness(business.id, {
        name,
        category: category || null,
        public_description: description || null,
        avg_ticket: avgTicket || null,
        products_services: splitProducts(products),
        launch_phase: launchPhase === 'setup' ? 'setup' : business.launch_phase || null,
        metadata: nextMetadata as Record<string, unknown>,
      })

      const capturePayload = {
        business_id: business.id,
        offer_type: 'capture' as const,
        status: captureHeadline ? 'active' as const : 'draft' as const,
        headline: captureHeadline || 'Join our list and get access to exclusive offers',
        description: captureDescription || 'This offer is only used to collect your first 100 customers before you go live.',
        value_type: 'label',
        value_label: captureValue || null,
        cashback_percent: null,
        starts_at: null,
        ends_at: null,
        metadata: { source: 'business_setup' },
      }

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

      const savedCapture = captureOfferId
        ? await updateOffer(captureOfferId, capturePayload)
        : await insertOffer(capturePayload)
      const savedCashback = cashbackOfferId
        ? await updateOffer(cashbackOfferId, cashbackPayload)
        : await insertOffer(cashbackPayload)

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
      })

      setSaveState('saved')
      refetchOffers({ silent: true })
    } catch (error) {
      setSaveState('error')
      setSaveError(error instanceof Error ? error.message : 'Changes could not be saved.')
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
    supabase.storage,
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
    })

    if (!snapshotRef.current || snapshot === snapshotRef.current) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void persistChanges()
    }, 650)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [avgTicket, business, captureDescription, captureHeadline, captureValue, cashbackPercent, category, coverFile, coverUrl, description, logoFile, logoUrl, name, persistChanges, products])

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
        description="A business needs to be linked to this account before setup can begin."
      />
    )
  }

  const scopedBusiness = business

  const completeProfile = !!name.trim() && !!category.trim() && !!description.trim()
  const completeCapture = !!captureHeadline.trim()
  const completeCashback = cashbackPercent >= 5 && cashbackPercent <= 25
  const readyToActivate = completeProfile && completeCapture && completeCashback
  const completedStepsCount = STEPS.filter((item) =>
    item.key === 'profile' ? completeProfile
      : item.key === 'capture' ? completeCapture
        : item.key === 'cashback' ? completeCashback
          : item.key === 'activate' ? readyToActivate && launchPhase !== 'setup'
            : true
  ).length
  const completionRatio = completedStepsCount / STEPS.length
  const activeStepMeta = STEPS.find((item) => item.key === step) || STEPS[0]

  function getStepCompletion(key: StepKey) {
    if (key === 'profile') return completeProfile
    if (key === 'capture') return completeCapture
    if (key === 'cashback') return completeCashback
    if (key === 'activate') return readyToActivate && launchPhase !== 'setup'
    return true
  }

  async function activatePortal() {
    await persistChanges()
    const activated = await updateBusiness(scopedBusiness.id, {
      launch_phase: 'capturing_100',
      activation_status: 'in_progress',
    })
    if (!activated) return
    window.location.href = '/portal/clients'
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Business Setup"
        description="Finish your profile, create your pre-launch customer capture offer, set your live cashback, and unlock your 100 List."
        actions={
          <div className="flex items-center gap-2 text-sm text-surface-500">
            {saveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : saveState === 'saved' ? <CheckCircle2 className="h-4 w-4 text-success-600" /> : null}
            <span>{saveState === 'saving' ? 'Saving changes...' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Autosave failed' : 'Changes save automatically'}</span>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Setup Flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Progress</p>
                  <p className="text-sm font-semibold text-surface-950">
                    {completedStepsCount} of {STEPS.length} setup steps finished
                  </p>
                  <p className="text-xs leading-5 text-surface-500">
                    Completed steps stay available, so you can reopen them any time to review or change them.
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-surface-200">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Complete</p>
                  <p className="text-lg font-semibold text-surface-950">{Math.round(completionRatio * 100)}%</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-success-500 to-brand-500 transition-all"
                  style={{ width: `${Math.max(completionRatio * 100, completedStepsCount ? 12 : 0)}%` }}
                />
              </div>
            </div>
            {STEPS.map((item, index) => {
              const complete = getStepCompletion(item.key)
              const isActive = step === item.key
              const previousIncomplete = STEPS.slice(0, index).some((previousStep) => !getStepCompletion(previousStep.key))
              const isLocked = !complete && !isActive && previousIncomplete

              const cardClass = complete
                ? isActive
                  ? 'border-success-400 bg-success-50 shadow-[0_0_0_1px_rgba(34,197,94,0.08)]'
                  : 'border-success-200 bg-white hover:border-success-300'
                : isActive
                  ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_1px_rgba(59,130,246,0.08)]'
                  : isLocked
                    ? 'border-surface-200 bg-surface-50'
                    : 'border-surface-200 bg-white hover:border-surface-300'

              const badgeClass = complete
                ? 'border-success-200 bg-success-100 text-success-800'
                : isActive
                  ? 'border-brand-200 bg-brand-100 text-brand-800'
                  : isLocked
                    ? 'border-surface-200 bg-surface-100 text-surface-500'
                    : 'border-amber-200 bg-amber-100 text-amber-800'

              const markerClass = complete
                ? 'border-success-600 bg-success-600 text-white'
                : isActive
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : isLocked
                    ? 'border-surface-300 bg-white text-surface-400'
                    : 'border-surface-300 bg-white text-surface-700'

              const helperCopy = complete
                ? 'Finished and saved'
                : isActive
                  ? 'Open now'
                  : isLocked
                    ? 'Complete the step above first'
                    : 'Up next'

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStep(item.key)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${cardClass}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-0.5">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold shadow-sm ${markerClass}`}>
                        {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </span>
                      {index < STEPS.length - 1 ? (
                        <span className={`mt-2 h-10 w-px ${complete ? 'bg-success-200' : 'bg-surface-200'}`} />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className={`flex items-center gap-2 text-sm font-semibold ${complete ? 'text-success-950' : 'text-surface-950'}`}>
                            <span className={complete ? 'text-success-700' : isActive ? 'text-brand-700' : 'text-surface-500'}>
                              {item.icon}
                            </span>
                            <span>{item.label}</span>
                          </div>
                          <p className="text-xs leading-5 text-surface-500">{item.description}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${badgeClass}`}>
                          {complete ? 'Done' : isActive ? 'Current' : isLocked ? 'Locked' : 'Next'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className={complete ? 'font-medium text-success-700' : isActive ? 'font-medium text-brand-700' : 'text-surface-500'}>
                          {helperCopy}
                        </span>
                        {complete ? (
                          <span className="inline-flex items-center gap-1 text-success-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Reopen anytime
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1 text-brand-700">
                            Continue below
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
            {saveError && <p className="text-sm text-danger-600">{saveError}</p>}
          </CardContent>
        </Card>

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
            <Card>
              <CardHeader>
                <CardTitle>Business Profile</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Business name</label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} />
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
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
                  <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Products / services</label>
                  <Input value={products} onChange={(event) => setProducts(event.target.value)} placeholder="Coffee, pastries, sandwiches" />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'branding' && (
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-surface-700">Business logo</label>
                    <p className="text-sm leading-6 text-surface-500">
                      This is your main brand mark. We use it in the middle of your QR code and in smaller places where people should recognize your business right away.
                    </p>
                    <p className="text-xs leading-5 text-surface-400">
                      Best choice: a square logo with a simple shape and a clean or transparent background, so it still looks sharp when it is shown small.
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} />
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-surface-300 bg-surface-50">
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
                    <label className="block text-sm font-medium text-surface-700">Cover image</label>
                    <p className="text-sm leading-6 text-surface-500">
                      This is the larger photo customers see first on your business page. Use it to show the feel of your business, like your food, your space, your storefront, or your experience.
                    </p>
                    <p className="text-xs leading-5 text-surface-400">
                      Best choice: a wide photo that feels inviting and easy to understand at a glance.
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-surface-300 bg-surface-50">
                    {coverFile || coverUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={coverFile ? URL.createObjectURL(coverFile) : coverUrl || ''} alt="Cover preview" className="h-full w-full object-cover" />
                    ) : (
                      <p className="text-sm text-surface-400">Upload the main photo that should represent your business</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'capture' && (
            <Card>
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
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Offer headline</label>
                  <p className="mb-2 text-sm leading-6 text-surface-500">
                    This is the first line customers notice. Keep it short, clear, and specific, like “Free cookie with any coffee.”
                  </p>
                  <Input value={captureHeadline} onChange={(event) => setCaptureHeadline(event.target.value)} placeholder="Free coffee with purchase" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Offer description</label>
                  <p className="mb-2 text-sm leading-6 text-surface-500">
                    Explain exactly what they get and any simple condition that comes with it, like “with purchase” or “one per customer.” This is the fuller explanation under the headline.
                  </p>
                  <Textarea value={captureDescription} onChange={(event) => setCaptureDescription(event.target.value)} rows={4} placeholder="Tell customers exactly what they get when they join your list." />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Offer value label</label>
                  <p className="mb-2 text-sm leading-6 text-surface-500">
                    This is the shorter version we use in tighter spaces, like QR cards, badges, and smaller materials. Keep it compact and easy to scan quickly.
                  </p>
                  <Input value={captureValue} onChange={(event) => setCaptureValue(event.target.value)} placeholder="Free cookie with purchase" />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'cashback' && (
            <Card>
              <CardHeader>
                <CardTitle>LocalVIP Cashback (Live)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                  This is the percentage customers receive back when they shop with you through LocalVIP.
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
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
                    onChange={(event) => setCashbackPercent(Number(event.target.value))}
                    className="mt-5 w-full"
                  />
                  <div className="mt-2 flex justify-between text-xs text-surface-400">
                    <span>5%</span>
                    <span>10%</span>
                    <span>25%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'activate' && (
            <Card>
              <CardHeader>
                <CardTitle>Activate Your Portal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <StatusPill label="Profile" ready={completeProfile} />
                  <StatusPill label="100-List Offer" ready={completeCapture} />
                  <StatusPill label="Cashback" ready={completeCashback} />
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <p className="text-sm font-semibold text-surface-900">What unlocks next</p>
                  <p className="mt-2 text-sm leading-6 text-surface-600">
                    Once activated, you can use your QR system, build your 100 List, and start collecting customer signups through your capture offer.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void activatePortal()} disabled={!readyToActivate}>
                    Activate business portal
                    <Rocket className="h-4 w-4" />
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
    </div>
  )
}

function StatusPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${ready ? 'border-success-200 bg-success-50' : 'border-surface-200 bg-surface-50'}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-surface-900">{ready ? 'Ready' : 'Needs work'}</p>
    </div>
  )
}

function isStepKey(value: string | null): value is StepKey {
  return value === 'profile'
    || value === 'branding'
    || value === 'capture'
    || value === 'cashback'
    || value === 'activate'
}
