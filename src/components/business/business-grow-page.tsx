'use client'

import * as React from 'react'
import {
  ArrowRight,
  Building2,
  Check,
  Copy,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Search,
  SendHorizontal,
  Share2,
  Sparkles,
  Store,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { resolveScopedBusiness } from '@/lib/business-portal'
import { resolveBusinessOffer } from '@/lib/offers'
import {
  useBusinesses,
  useBusinessReferrals,
  useCities,
  useContacts,
  useOffers,
} from '@/lib/supabase/hooks'
import {
  BUSINESS_REFERRAL_CHANNEL_OPTIONS,
  BUSINESS_REFERRAL_SCRIPT_TYPE_OPTIONS,
  BUSINESS_REFERRAL_TIER_OPTIONS,
  generateBusinessReferralScript,
  type BusinessReferralChannel,
  type BusinessReferralScriptType,
} from '@/lib/business-referral-script-engine'
import type { OutreachScriptTier } from '@/lib/types/database'
import { cn, formatDateTime, normalizeBusinessName } from '@/lib/utils'

interface BusinessReferralCandidate {
  id: string
  name: string
  category: string | null
  address: string | null
  city_id: string | null
  city_label: string
  stage: string
  source: string | null
  status: string
}

type SuggestionSection = {
  key: BusinessReferralScriptType
  title: string
  description: string
  items: BusinessReferralCandidate[]
}

function clean(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function categoryFamily(value: string | null | undefined) {
  const normalized = clean(value).toLowerCase()
  if (/coffee|cafe|bakery|tea/.test(normalized)) return 'coffee'
  if (/restaurant|pizza|grill|bbq|bistro|diner|eatery|food|burger|taco/.test(normalized)) return 'restaurant'
  if (/gym|fitness|yoga|pilates|spin|crossfit|training|workout/.test(normalized)) return 'fitness'
  if (/salon|barber|spa|beauty|nail|lashes/.test(normalized)) return 'beauty'
  if (/family|kids|arcade|play|venue|trampoline|indoor|entertainment|bowling/.test(normalized)) return 'family'
  return 'general'
}

function isComplementary(sourceCategory: string | null | undefined, targetCategory: string | null | undefined) {
  const source = categoryFamily(sourceCategory)
  const target = categoryFamily(targetCategory)
  if (source === 'general' || target === 'general') return source !== target

  const complementMap: Record<string, string[]> = {
    coffee: ['restaurant', 'beauty', 'fitness', 'family'],
    restaurant: ['coffee', 'family', 'beauty', 'fitness'],
    fitness: ['coffee', 'restaurant', 'beauty'],
    beauty: ['coffee', 'restaurant', 'fitness'],
    family: ['restaurant', 'coffee', 'beauty'],
    general: ['coffee', 'restaurant', 'fitness', 'beauty', 'family'],
  }

  return complementMap[source]?.includes(target) || false
}

function matchesAlreadyGo(targetCategory: string | null | undefined) {
  return ['coffee', 'restaurant', 'beauty', 'fitness'].includes(categoryFamily(targetCategory))
}

function matchesCustomerOverlap(targetCategory: string | null | undefined) {
  return ['restaurant', 'coffee', 'family', 'fitness'].includes(categoryFamily(targetCategory))
}

function badgeVariantForStage(stage: string): 'default' | 'info' | 'warning' | 'success' {
  if (stage === 'live' || stage === 'onboarded') return 'success'
  if (stage === 'in_progress' || stage === 'interested') return 'warning'
  if (stage === 'contacted') return 'info'
  return 'default'
}

const REFERRAL_STATUS_OPTIONS = [
  { value: 'not_contacted', label: 'Not contacted', variant: 'default' as const },
  { value: 'contacted', label: 'Contacted', variant: 'info' as const },
  { value: 'responded', label: 'Responded', variant: 'info' as const },
  { value: 'interested', label: 'Interested', variant: 'warning' as const },
  { value: 'onboarded', label: 'Onboarded', variant: 'success' as const },
] as const

type ReferralStatusValue = (typeof REFERRAL_STATUS_OPTIONS)[number]['value']

function humanizeStage(value: string | null | undefined) {
  const normalized = clean(value)
  if (!normalized) return 'Lead'
  return normalized.replace(/_/g, ' ')
}

function dedupeCandidates(items: BusinessReferralCandidate[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function buildSuggestionSections(
  candidates: BusinessReferralCandidate[],
  sourceCategory: string | null | undefined,
): SuggestionSection[] {
  const nearby = dedupeCandidates(candidates).slice(0, 6)
  const complementary = dedupeCandidates(candidates.filter((candidate) => isComplementary(sourceCategory, candidate.category))).slice(0, 6)
  const alreadyGo = dedupeCandidates(candidates.filter((candidate) => matchesAlreadyGo(candidate.category))).slice(0, 6)
  const customerOverlap = dedupeCandidates(candidates.filter((candidate) => matchesCustomerOverlap(candidate.category))).slice(0, 6)

  return [
    {
      key: 'nearby_business',
      title: 'Businesses nearby',
      description: 'Other local businesses already serving the same area.',
      items: nearby,
    },
    {
      key: 'complementary_business',
      title: 'Complementary businesses',
      description: 'Businesses that make sense alongside yours without being direct copies.',
      items: complementary,
    },
    {
      key: 'places_you_already_go',
      title: 'Places you already go',
      description: 'Good fits for a more personal, relationship-based intro.',
      items: alreadyGo,
    },
    {
      key: 'customers_also_visit',
      title: 'Businesses your customers also visit',
      description: 'Great for messages built around shared local traffic and repeat behavior.',
      items: customerOverlap,
    },
  ]
}

function GrowthStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-surface-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-surface-500">{hint}</p>
    </div>
  )
}

function InputBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">{label}</p>
      {children}
    </div>
  )
}

function defaultFitReason(
  scriptType: BusinessReferralScriptType,
  candidate: BusinessReferralCandidate,
  cityName: string,
) {
  switch (scriptType) {
    case 'complementary_business':
      return `Our customers already make room for businesses like ${candidate.name} in the same week, so it feels like a natural complementary fit.`
    case 'places_you_already_go':
      return `${candidate.name} already feels like one of the local spots people around ${cityName} know and trust.`
    case 'customers_also_visit':
      return `People who already know us likely visit ${candidate.name} too, so the local customer overlap feels real.`
    default:
      return `${candidate.name} is already part of the local business mix around ${cityName}.`
  }
}

function getOfferReference(offer: { value_label: string | null; headline: string } | null) {
  return offer?.value_label || offer?.headline || null
}

export function BusinessGrowPage() {
  const { profile } = useAuth()
  const { data: cities } = useCities()
  const { data: ownedBusinesses, loading } = useBusinesses(profile.business_id ? { id: profile.business_id } : { owner_id: profile.id })
  const business = React.useMemo(() => resolveScopedBusiness(profile, ownedBusinesses), [ownedBusinesses, profile])
  const { data: referrals, refetch } = useBusinessReferrals({ source_business_id: business?.id || '__none__' })
  const { data: sourceOffers } = useOffers({ business_id: business?.id || '__none__' })
  const { data: sourceContacts } = useContacts({ business_id: business?.id || '__none__' })

  const [candidates, setCandidates] = React.useState<BusinessReferralCandidate[]>([])
  const [candidatesLoading, setCandidatesLoading] = React.useState(false)
  const [candidatesError, setCandidatesError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const deferredSearch = React.useDeferredValue(search)
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null)
  const [scriptType, setScriptType] = React.useState<BusinessReferralScriptType>('nearby_business')
  const [tier, setTier] = React.useState<OutreachScriptTier>('better')
  const [channel, setChannel] = React.useState<BusinessReferralChannel>('sms')
  const [targetBusinessName, setTargetBusinessName] = React.useState('')
  const [targetCategory, setTargetCategory] = React.useState('')
  const [targetOwnerName, setTargetOwnerName] = React.useState('')
  const [targetEmail, setTargetEmail] = React.useState('')
  const [targetPhone, setTargetPhone] = React.useState('')
  const [fitReason, setFitReason] = React.useState('')
  const [relationshipNote, setRelationshipNote] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [editorContent, setEditorContent] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  const [actionMessage, setActionMessage] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = React.useState<string | null>(null)

  const lastAutoMessageRef = React.useRef('')

  const cityName = React.useMemo(() => {
    const city = cities.find((item) => item.id === business?.city_id)
    return city?.name || 'your city'
  }, [business?.city_id, cities])

  const captureOffer = React.useMemo(() => (
    business ? resolveBusinessOffer(business, sourceOffers, 'capture') : null
  ), [business, sourceOffers])

  const cashbackOffer = React.useMemo(() => (
    business ? resolveBusinessOffer(business, sourceOffers, 'cashback') : null
  ), [business, sourceOffers])

  const joinedCount = React.useMemo(
    () => sourceContacts.filter((contact) => contact.list_status === 'joined' || !!contact.joined_at).length,
    [sourceContacts],
  )

  const loadCandidates = React.useCallback(async () => {
    if (!business?.id) return

    setCandidatesLoading(true)
    setCandidatesError(null)

    try {
      const response = await fetch(`/api/business-portal/referrals?businessId=${encodeURIComponent(business.id)}`, {
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setCandidatesError(payload.error || 'Could not load local business suggestions.')
        setCandidates([])
        return
      }
      setCandidates((payload.candidates || []) as BusinessReferralCandidate[])
    } catch {
      setCandidatesError('Could not load local business suggestions.')
      setCandidates([])
    } finally {
      setCandidatesLoading(false)
    }
  }, [business?.id])

  React.useEffect(() => {
    void loadCandidates()
  }, [loadCandidates])

  const filteredCandidates = React.useMemo(() => {
    const term = deferredSearch.trim().toLowerCase()
    if (!term) return candidates

    return candidates.filter((candidate) => {
      const haystack = [
        candidate.name,
        candidate.category || '',
        candidate.address || '',
        candidate.city_label,
      ].join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [candidates, deferredSearch])

  const suggestionSections = React.useMemo(
    () => buildSuggestionSections(filteredCandidates, business?.category),
    [business?.category, filteredCandidates],
  )

  const selectedCandidate = React.useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) || null,
    [candidates, selectedCandidateId],
  )

  const exactNameMatch = React.useMemo(() => {
    const normalizedTarget = normalizeBusinessName(targetBusinessName)
    if (!normalizedTarget) return null
    return candidates.find((candidate) => normalizeBusinessName(candidate.name) === normalizedTarget) || null
  }, [candidates, targetBusinessName])

  const crmTarget = selectedCandidate || exactNameMatch

  const generatedScript = React.useMemo(() => {
    if (!business || !targetBusinessName.trim()) return null

    return generateBusinessReferralScript({
      sourceBusinessName: business.name,
      sourceBusinessCategory: business.category,
      sourceCity: cityName,
      sourceCaptureOffer: getOfferReference(captureOffer),
      sourceCashbackPercent: cashbackOffer?.cashback_percent || null,
      sourceJoinedCount: joinedCount,
      targetBusinessName,
      targetBusinessCategory: targetCategory,
      targetOwnerName,
      targetArea: crmTarget?.city_label || cityName,
      fitReason,
      relationshipNote,
      tier,
      channel,
      scriptType,
    })
  }, [
    business,
    captureOffer,
    cashbackOffer?.cashback_percent,
    channel,
    cityName,
    crmTarget?.city_label,
    fitReason,
    joinedCount,
    relationshipNote,
    scriptType,
    targetBusinessName,
    targetCategory,
    targetOwnerName,
    tier,
  ])

  React.useEffect(() => {
    if (!generatedScript) {
      setEditorContent('')
      lastAutoMessageRef.current = ''
      return
    }

    setEditorContent((current) => {
      if (!current || current === lastAutoMessageRef.current) {
        lastAutoMessageRef.current = generatedScript.body
        return generatedScript.body
      }
      return current
    })
  }, [generatedScript])

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          Loading growth tools...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Share2 className="h-8 w-8" />}
        title="Growth tools will show up here"
        description="A business needs to be linked to this account before nearby-business invites can be tracked."
      />
    )
  }

  const scopedBusiness = business
  const trackedCrmCount = referrals.filter((referral) => !!referral.target_business_id).length
  const newLeadCount = referrals.filter((referral) => {
    const metadata = (referral.metadata as Record<string, unknown> | null) || null
    return metadata?.created_new_business_lead === true
  }).length

  function selectCandidate(candidate: BusinessReferralCandidate, nextType?: BusinessReferralScriptType) {
    setSelectedCandidateId(candidate.id)
    setTargetBusinessName(candidate.name)
    setTargetCategory(candidate.category || '')
    setTargetOwnerName('')
    setTargetEmail('')
    setTargetPhone('')
    setFitReason((current) => current || defaultFitReason(nextType || scriptType, candidate, cityName))
    setRelationshipNote('')
    setSubmitError(null)
    setActionMessage(null)
    if (nextType) setScriptType(nextType)
  }

  async function handleCopy() {
    if (!generatedScript || !editorContent.trim()) return

    const payload = generatedScript.subject
      ? `Subject: ${generatedScript.subject}\n\n${editorContent}`
      : editorContent

    await navigator.clipboard.writeText(payload)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  async function handleTrack(copyFirst: boolean) {
    if (!generatedScript || !targetBusinessName.trim() || !editorContent.trim()) return

    setSubmitting(true)
    setSubmitError(null)
    setActionMessage(null)

    try {
      if (copyFirst) {
        await handleCopy()
      }

      const response = await fetch('/api/business-portal/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBusinessId: scopedBusiness.id,
          targetBusinessId: crmTarget?.id || null,
          targetBusinessName,
          targetCategory: targetCategory || null,
          targetOwnerName: targetOwnerName || null,
          targetEmail: targetEmail || null,
          targetPhone: targetPhone || null,
          channel,
          scriptType,
          tier,
          message: editorContent,
          notes: notes || null,
          fitReason: fitReason || null,
          relationshipNote: relationshipNote || null,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSubmitError(payload.error || 'Could not track this invite.')
        return
      }

      const createdNewLead = Boolean(payload.createdNewBusinessLead)
      setActionMessage(
        createdNewLead
          ? `${targetBusinessName} was opened in the CRM and the intro was logged.`
          : `${targetBusinessName} was linked to the CRM and the intro was logged.`,
      )

      setSelectedCandidateId(null)
      setTargetBusinessName('')
      setTargetCategory('')
      setTargetOwnerName('')
      setTargetEmail('')
      setTargetPhone('')
      setFitReason('')
      setRelationshipNote('')
      setNotes('')
      setEditorContent('')
      lastAutoMessageRef.current = ''
      refetch({ silent: true })
      void loadCandidates()
    } catch {
      setSubmitError('Could not track this invite.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusUpdate(referralId: string, status: ReferralStatusValue) {
    setStatusUpdatingId(referralId)
    setSubmitError(null)
    setActionMessage(null)

    try {
      const response = await fetch('/api/business-portal/referrals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBusinessId: scopedBusiness.id,
          referralId,
          status,
          note: `Status updated to ${status.replace(/_/g, ' ')}.`,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSubmitError(payload.error || 'Could not update this invite.')
        return
      }

      setActionMessage(`Invite status updated to ${status.replace(/_/g, ' ')}.`)
      refetch({ silent: true })
      void loadCandidates()
    } catch {
      setSubmitError('Could not update this invite.')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Grow with Other Businesses"
        description="Use real local referrals to open CRM leads, send a stronger message, and keep every intro tied into the system."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <GrowthStat
          label="Current capture offer"
          value={captureOffer?.value_label || captureOffer?.headline || 'Offer not set'}
          hint="This is the pre-launch offer you can reference when telling another business your setup is already in motion."
        />
        <GrowthStat
          label="Customers collected"
          value={`${joinedCount}`}
          hint="Your 100-list progress gives the message a more credible business-to-business proof point."
        />
        <GrowthStat
          label="CRM invites tracked"
          value={`${trackedCrmCount}`}
          hint={`${newLeadCount} of these opened brand-new CRM business leads.`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Card className="overflow-hidden border-surface-200">
          <CardHeader className="border-b border-surface-100 bg-surface-50/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Who to Invite</CardTitle>
                <CardDescription>These suggestions come from the CRM, scoped to your city, so you can open or continue the right business lead instead of starting from scratch.</CardDescription>
              </div>
              <Badge variant="info">
                <Building2 className="h-3.5 w-3.5" />
                CRM-connected
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="rounded-2xl border border-surface-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-surface-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search nearby businesses already in the CRM..."
                  className="border-0 px-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            {candidatesError && (
              <div className="rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
                {candidatesError}
              </div>
            )}

            {candidatesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
              </div>
            ) : suggestionSections.every((section) => section.items.length === 0) ? (
              <EmptyState
                icon={<Store className="h-7 w-7" />}
                title="No CRM suggestions yet"
                description="Type a business on the right and we will open a CRM lead the moment you track the intro."
                className="border border-dashed border-surface-200 py-12"
              />
            ) : (
              <div className="space-y-4">
                {suggestionSections.map((section) => (
                  <div key={section.key} className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{section.title}</p>
                        <p className="mt-1 text-xs text-surface-500">{section.description}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={scriptType === section.key ? 'default' : 'outline'}
                        onClick={() => setScriptType(section.key)}
                      >
                        Use this angle
                      </Button>
                    </div>

                    {section.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-surface-200 bg-white px-4 py-4 text-sm text-surface-500">
                        No strong matches in this group yet. You can still type a business manually on the right.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {section.items.map((candidate) => {
                          const active = candidate.id === selectedCandidateId

                          return (
                            <button
                              key={`${section.key}-${candidate.id}`}
                              type="button"
                              onClick={() => selectCandidate(candidate, section.key)}
                              className={cn(
                                'rounded-2xl border bg-white px-4 py-3 text-left transition-colors',
                                active
                                  ? 'border-brand-400 bg-brand-50/70 shadow-sm'
                                  : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50',
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-surface-900">{candidate.name}</p>
                                  <p className="mt-1 text-xs text-surface-500">
                                    {candidate.category || 'Local business'}
                                    {candidate.address ? ` / ${candidate.address}` : ''}
                                  </p>
                                  <p className="mt-2 text-xs text-surface-400">{candidate.city_label}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">Already in CRM</Badge>
                                  <Badge variant={badgeVariantForStage(candidate.stage)}>
                                    {humanizeStage(candidate.stage)}
                                  </Badge>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden border-brand-100 shadow-panel">
            <CardHeader className="border-b border-brand-100 bg-brand-50/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Invite Composer</CardTitle>
                  <CardDescription>Pick an existing CRM prospect or type a new one. If it does not exist yet, tracking this invite will open the business in the CRM automatically.</CardDescription>
                </div>
                <Badge variant={crmTarget ? 'info' : targetBusinessName.trim() ? 'warning' : 'default'}>
                  {crmTarget ? 'Existing CRM business' : targetBusinessName.trim() ? 'Will open new CRM lead' : 'Choose a target'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <InputBlock label="Business to invite">
                  <Input
                    value={targetBusinessName}
                    onChange={(event) => {
                      setTargetBusinessName(event.target.value)
                      if (selectedCandidateId && event.target.value !== selectedCandidate?.name) {
                        setSelectedCandidateId(null)
                      }
                    }}
                    placeholder="Neighborhood coffee shop, gym, salon..."
                  />
                </InputBlock>
                <InputBlock label="Category">
                  <Input
                    value={targetCategory}
                    onChange={(event) => setTargetCategory(event.target.value)}
                    placeholder="Coffee shop, restaurant, salon..."
                  />
                </InputBlock>
                <InputBlock label="Owner / Contact Name">
                  <Input
                    value={targetOwnerName}
                    onChange={(event) => setTargetOwnerName(event.target.value)}
                    placeholder="Owner or main contact"
                  />
                </InputBlock>
                <InputBlock label="Email">
                  <Input
                    value={targetEmail}
                    onChange={(event) => setTargetEmail(event.target.value)}
                    placeholder="owner@business.com"
                    type="email"
                  />
                </InputBlock>
                <InputBlock label="Phone">
                  <Input
                    value={targetPhone}
                    onChange={(event) => setTargetPhone(event.target.value)}
                    placeholder="(404) 555-0000"
                    type="tel"
                  />
                </InputBlock>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">CRM outcome</p>
                  <p className="mt-2 text-sm font-medium text-surface-800">
                    {crmTarget
                      ? `${crmTarget.name} will be updated inside the CRM when you track this intro.`
                      : targetBusinessName.trim()
                        ? `${targetBusinessName.trim()} will be created as a new CRM business lead when you track this intro.`
                        : 'Select or type a business to see what will happen in the CRM.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InputBlock label="Why this business">
                  <Textarea
                    value={fitReason}
                    onChange={(event) => setFitReason(event.target.value)}
                    rows={3}
                    placeholder="Why does this business feel like a fit? Nearby, complementary, shared customers, etc."
                  />
                </InputBlock>
                <InputBlock label="Relationship note">
                  <Textarea
                    value={relationshipNote}
                    onChange={(event) => setRelationshipNote(event.target.value)}
                    rows={3}
                    placeholder="Anything personal you actually know about this business or owner."
                  />
                </InputBlock>
              </div>

              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  <p className="text-sm font-semibold text-surface-900">Script angle</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {BUSINESS_REFERRAL_SCRIPT_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setScriptType(option.value)}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-colors',
                        scriptType === option.value
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-surface-200 bg-white hover:border-surface-300',
                      )}
                    >
                      <p className="text-sm font-semibold text-surface-900">{option.label}</p>
                      <p className="mt-1 text-xs text-surface-500">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">Quality tier</p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {BUSINESS_REFERRAL_TIER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTier(option.value)}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-colors',
                        tier === option.value
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-surface-200 bg-white hover:border-surface-300',
                      )}
                    >
                      <p className="text-sm font-semibold text-surface-900">{option.label}</p>
                      <p className="mt-1 text-xs text-surface-500">{option.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">Channel</p>
                <div className="flex flex-wrap gap-2">
                  {BUSINESS_REFERRAL_CHANNEL_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={channel === option.value ? 'default' : 'outline'}
                      onClick={() => setChannel(option.value)}
                    >
                      {option.value === 'sms' ? <MessageSquare className="h-4 w-4" /> : option.value === 'email' ? <Mail className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                      {option.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-surface-500">
                  {BUSINESS_REFERRAL_CHANNEL_OPTIONS.find((option) => option.value === channel)?.hint}
                </p>
              </div>

              {generatedScript ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-surface-200 bg-white shadow-sm">
                    <div className="border-b border-surface-100 bg-surface-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-surface-900">{generatedScript.title}</p>
                          <p className="mt-1 text-xs text-surface-500">
                            {BUSINESS_REFERRAL_SCRIPT_TYPE_OPTIONS.find((option) => option.value === scriptType)?.fitHint}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      {generatedScript.subject && (
                        <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">Email subject</p>
                          <p className="mt-1 text-sm font-medium text-surface-800">{generatedScript.subject}</p>
                        </div>
                      )}

                      <Textarea
                        value={editorContent}
                        onChange={(event) => setEditorContent(event.target.value)}
                        rows={14}
                        className="min-h-[21rem] text-[15px] leading-7"
                      />

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={handleCopy} disabled={!editorContent.trim() || submitting}>
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copied ? 'Copied' : generatedScript.subject ? 'Copy Email' : 'Copy Message'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditorContent(generatedScript.body)
                            lastAutoMessageRef.current = generatedScript.body
                          }}
                          disabled={!generatedScript.body}
                        >
                          <ArrowRight className="h-4 w-4" />
                          Reset to generated
                        </Button>
                      </div>
                    </div>
                  </div>

                  <InputBlock label="Internal notes for CRM">
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                      placeholder="Anything your team should remember once this intro is in the CRM."
                    />
                  </InputBlock>

                  {submitError && (
                    <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                      {submitError}
                    </div>
                  )}

                  {actionMessage && (
                    <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
                      {actionMessage}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleTrack(false)}
                      disabled={submitting || !targetBusinessName.trim() || !editorContent.trim()}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                      Open CRM lead + Track
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleTrack(true)}
                      disabled={submitting || !targetBusinessName.trim() || !editorContent.trim()}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                      Copy + Open in CRM
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-3 text-xs leading-6 text-surface-500">
                    Tracking this intro creates or links the target business inside the CRM, creates a contact when you provide one, logs the outreach activity, and adds an internal note so your team can follow it up later.
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-10 text-sm text-surface-500">
                  Pick or type a business and the referral script will generate here.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Invite Tracking</CardTitle>
              <CardDescription>Every intro stays connected to the CRM so your team can see which businesses were invited and whether they were opened as leads.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{referrals.length} total invites</Badge>
              <Badge variant="info">{trackedCrmCount} CRM-linked</Badge>
              <Badge variant="warning">{newLeadCount} new leads opened</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {referrals.length === 0 ? (
            <EmptyState
              icon={<SendHorizontal className="h-6 w-6" />}
              title="No business invites tracked yet"
              description="As you introduce other businesses, they will show up here with CRM linkage and the message snapshot that was used."
              className="py-10"
            />
          ) : (
            referrals.map((referral) => {
              const metadata = (referral.metadata as Record<string, unknown> | null) || null
              const createdNewLead = metadata?.created_new_business_lead === true
              const scriptTier = typeof metadata?.script_tier === 'string' ? metadata.script_tier : null
              const scriptTypeLabel = BUSINESS_REFERRAL_SCRIPT_TYPE_OPTIONS.find((option) => option.value === metadata?.script_type)?.label
              const history = Array.isArray(metadata?.history) ? metadata.history as Array<Record<string, unknown>> : []
              const currentStatus = REFERRAL_STATUS_OPTIONS.find((option) => option.value === referral.status)

              return (
                <div key={referral.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-surface-900">{referral.target_business_name}</p>
                        <Badge variant={createdNewLead ? 'warning' : 'info'}>
                          {createdNewLead ? 'New CRM lead' : 'Existing CRM business'}
                        </Badge>
                        <Badge variant={currentStatus?.variant || 'default'}>
                          {currentStatus?.label || referral.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-surface-500">
                        {referral.channel.replace('_', ' ')}
                        {referral.target_contact_name ? ` / ${referral.target_contact_name}` : ''}
                        {referral.target_contact_email ? ` / ${referral.target_contact_email}` : ''}
                        {referral.target_contact_phone ? ` / ${referral.target_contact_phone}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-surface-400">
                        {scriptTypeLabel ? <span>{scriptTypeLabel}</span> : null}
                        {scriptTier ? <span>/ {scriptTier.toUpperCase()}</span> : null}
                        {referral.target_business_id ? <span>/ CRM lead opened</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {referral.target_business_id ? (
                        <Badge variant="success">
                          <Building2 className="h-3.5 w-3.5" />
                          In CRM
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {referral.message_snapshot ? (
                    <div className="mt-4 rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm leading-6 text-surface-700">
                      {referral.message_snapshot}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-xl border border-surface-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">Move status</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {REFERRAL_STATUS_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={referral.status === option.value ? 'default' : 'outline'}
                          size="sm"
                          disabled={statusUpdatingId === referral.id}
                          onClick={() => void handleStatusUpdate(referral.id, option.value)}
                        >
                          {statusUpdatingId === referral.id && referral.status !== option.value ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-surface-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">Timeline</p>
                    <div className="mt-3 space-y-3">
                      {history.length > 0 ? history.slice().reverse().map((entry, index) => (
                        <div key={`${referral.id}-history-${index}`} className="border-l-2 border-surface-200 pl-3">
                          <p className="text-sm font-medium text-surface-900">
                            {typeof entry.status === 'string' ? entry.status.replace(/_/g, ' ') : 'Updated'}
                          </p>
                          {typeof entry.note === 'string' && entry.note ? (
                            <p className="mt-1 text-sm text-surface-600">{entry.note}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-surface-400">
                            {typeof entry.at === 'string' ? formatDateTime(entry.at) : formatDateTime(referral.created_at)}
                          </p>
                        </div>
                      )) : (
                        <p className="text-sm text-surface-500">No timeline updates yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
