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

      <div className="grid gap-6 xl:grid-cols-[280px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Setup Flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-success-200 bg-success-50/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success-700">Completed so far</p>
              <p className="mt-2 text-sm text-success-900">
                {STEPS.filter((item) =>
                  item.key === 'profile' ? completeProfile
                    : item.key === 'capture' ? completeCapture
                      : item.key === 'cashback' ? completeCashback
                        : item.key === 'activate' ? readyToActivate && launchPhase !== 'setup'
                          : true
                ).length}
                {' '}of {STEPS.length} setup items are finished.
              </p>
            </div>
            {STEPS.map((item, index) => {
              const complete =
                item.key === 'profile' ? completeProfile
                  : item.key === 'capture' ? completeCapture
                    : item.key === 'cashback' ? completeCashback
                      : item.key === 'activate' ? readyToActivate && launchPhase !== 'setup'
                        : true

              const cardClass = complete
                ? step === item.key
                  ? 'border-success-400 bg-success-50 shadow-[0_0_0_1px_rgba(34,197,94,0.16)]'
                  : 'border-success-200 bg-success-50/70 hover:border-success-300'
                : step === item.key
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-surface-200 bg-surface-0 hover:border-surface-300'

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStep(item.key)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${cardClass}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs shadow-sm ${complete ? 'bg-success-600 text-white' : 'bg-white text-surface-700'}`}>
                          {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                        </span>
                        {item.icon}
                        {item.label}
                      </div>
                      <p className="text-xs leading-5 text-surface-500">{item.description}</p>
                      {complete ? (
                        <p className="text-xs font-medium text-success-700">Completed and saved.</p>
                      ) : (
                        <p className="text-xs font-medium text-amber-700">Still needs attention.</p>
                      )}
                    </div>
                    {complete ? <Badge variant="success">Completed</Badge> : <Badge variant="warning">Next</Badge>}
                  </div>
                </button>
              )
            })}
            {saveError && <p className="text-sm text-danger-600">{saveError}</p>}
          </CardContent>
        </Card>

        <div className="space-y-6">
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
                      This is the small brand image customers will recognize first. It shows up in your QR code, your business card, and other compact LocalVIP surfaces.
                    </p>
                    <p className="text-xs leading-5 text-surface-400">
                      Best choice: a simple square logo with a clean background so it stays clear at small sizes.
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} />
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-surface-300 bg-surface-50">
                    {logoFile || logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={logoFile ? URL.createObjectURL(logoFile) : logoUrl || ''} alt="Logo preview" className="h-full w-full object-contain p-4" />
                    ) : (
                      <p className="text-sm text-surface-400">Upload the logo customers already know</p>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-surface-700">Cover image</label>
                    <p className="text-sm leading-6 text-surface-500">
                      This is the larger photo that sets the mood for your business. It is used on your business page and other full-width visual areas.
                    </p>
                    <p className="text-xs leading-5 text-surface-400">
                      Best choice: a strong horizontal photo of your storefront, food, space, team, or experience.
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-surface-300 bg-surface-50">
                    {coverFile || coverUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={coverFile ? URL.createObjectURL(coverFile) : coverUrl || ''} alt="Cover preview" className="h-full w-full object-cover" />
                    ) : (
                      <p className="text-sm text-surface-400">Upload a photo that helps customers feel your business</p>
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
                  <p className="font-semibold text-amber-900">Use this to get your first 100 customers before launch.</p>
                  <p className="mt-2 leading-6">
                    This is the offer customers see when they scan your QR code and join your list. Think of it as your
                    early sign-up incentive, like a free cookie, free coffee, free soda, or a simple discount tied to purchase.
                  </p>
                  <p className="mt-2 leading-6">
                    This is separate from your LocalVIP cashback. Cashback comes later when you are live. This section is only
                    for the pre-launch customer capture offer.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Offer headline</label>
                  <p className="mb-2 text-sm leading-6 text-surface-500">
                    The short promise customers should notice first. Keep it simple and specific.
                  </p>
                  <Input value={captureHeadline} onChange={(event) => setCaptureHeadline(event.target.value)} placeholder="Free coffee with purchase" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Offer description</label>
                  <p className="mb-2 text-sm leading-6 text-surface-500">
                    Explain what they get, when they get it, and any simple condition. This is the fuller version customers
                    will read after the headline.
                  </p>
                  <Textarea value={captureDescription} onChange={(event) => setCaptureDescription(event.target.value)} rows={4} placeholder="Tell customers exactly what they get when they join your list." />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Offer value label</label>
                  <p className="mb-2 text-sm leading-6 text-surface-500">
                    A short version of the offer used in tighter spaces, like cards, badges, and QR materials.
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
