'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Check,
  Copy,
  HeartHandshake,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Search,
  SendHorizontal,
  Share2,
  Sparkles,
  Store,
  UserPlus,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { isBoomerangEnabledForBusiness, resolveScopedBusiness } from '@/lib/business-portal'
import { BOOMERANG_SURFACE } from '@/lib/engagement-codes'
import { BUSINESS_BOOMERANG_NAV_HREF } from '@/lib/stakeholder-access'
import { resolveBusinessOffer } from '@/lib/offers'
import {
  useBusinesses,
  useBusinessReferrals,
  useCities,
  useContacts,
  useDeals,
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
import {
  NETWORK_INVITEE_TYPE_OPTIONS,
  generateNetworkInviteScript,
  getNetworkInviteeTypeOption,
  type NetworkInviteeType,
} from '@/lib/network-invite-script'
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

/**
 * A customer or cause invite that the backend accepted during this session.
 * Business invites are persisted as CRM referrals and render in Invite Tracking;
 * these come back from the network endpoint with their own referral code, so
 * they are surfaced immediately rather than disappearing after a send.
 */
interface SentNetworkInvite {
  key: string
  inviteeType: NetworkInviteeType
  name: string
  email: string
  referralCode: string | null
  message: string | null
  sentAt: string
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
  href,
}: {
  label: string
  value: string
  hint: string
  /** Where this number is owned. Every stat here has a home tab to open. */
  href: string
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}. ${hint}`}
      className="group block rounded-2xl border border-surface-200 bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-surface-950">{value}</p>
      <p className="mt-2 flex items-start gap-1 text-sm leading-6 text-surface-500">
        {hint}
        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
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

/** `embedded` suppresses the standalone PageHeader when the Grow hub renders
 *  this as a section. The Customer / Business / Cause invite composer below is
 *  untouched. */
export function BusinessGrowPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { profile } = useAuth()
  const { data: cities } = useCities()
  const { data: ownedBusinesses, loading } = useBusinesses(profile.business_id ? { id: profile.business_id } : { owner_id: profile.id })
  const business = React.useMemo(() => resolveScopedBusiness(profile, ownedBusinesses), [ownedBusinesses, profile])
  // Grow is about the LocalVIP referral. It may only point AT the Boomerang list
  // for a business that has one.
  const boomerangEnabled = isBoomerangEnabledForBusiness(business)
  const { data: referrals, refetch } = useBusinessReferrals({ source_business_id: business?.id || '__none__' })
  const { data: sourceOffers } = useOffers({ business_id: business?.id || '__none__' })
  const { data: sourceDeals } = useDeals({ business_account_id: business?.id || '__none__' })
  const { data: sourceContacts } = useContacts({ business_id: business?.id || '__none__' })

  const [inviteeType, setInviteeType] = React.useState<NetworkInviteeType>('business')
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

  // Customer / cause invites — the person or organisation the backend needs to
  // open an account for. Business invites keep using the CRM fields above.
  const [inviteeFirstName, setInviteeFirstName] = React.useState('')
  const [inviteeLastName, setInviteeLastName] = React.useState('')
  const [inviteeEmail, setInviteeEmail] = React.useState('')
  const [inviteePhone, setInviteePhone] = React.useState('')
  const [organizationName, setOrganizationName] = React.useState('')
  const [inviteeAddress1, setInviteeAddress1] = React.useState('')
  const [inviteeCity, setInviteeCity] = React.useState('')
  const [inviteeState, setInviteeState] = React.useState('')
  const [inviteeZip, setInviteeZip] = React.useState('')
  const [personalNote, setPersonalNote] = React.useState('')
  const [sentInvites, setSentInvites] = React.useState<SentNetworkInvite[]>([])

  const lastAutoMessageRef = React.useRef('')

  const cityName = React.useMemo(() => {
    const city = cities.find((item) => item.id === business?.city_id)
    return city?.name || 'your city'
  }, [business?.city_id, cities])

  const captureOffer = React.useMemo(() => (
    business ? resolveBusinessOffer(business, sourceOffers, 'capture') : null
  ), [business, sourceOffers])

  const cashbackPercent = React.useMemo(() => {
    const deal = sourceDeals.find((item) => item.active) || sourceDeals[0]
    const value = Number(deal?.cash_back)
    return Number.isFinite(value) ? value : null
  }, [sourceDeals])

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

  const inviteeOption = getNetworkInviteeTypeOption(inviteeType)
  const isBusinessInvite = inviteeType === 'business'

  /** The name the composer is addressing, whichever type is selected. */
  const inviteeDisplayName = isBusinessInvite
    ? targetBusinessName.trim()
    : inviteeType === 'cause'
      ? organizationName.trim()
      : [inviteeFirstName, inviteeLastName].map((part) => part.trim()).filter(Boolean).join(' ')

  const generatedScript = React.useMemo(() => {
    if (!business) return null

    if (inviteeType !== 'business') {
      const hasSubject = inviteeType === 'cause' ? organizationName.trim() : inviteeFirstName.trim()
      if (!hasSubject) return null

      const script = generateNetworkInviteScript({
        inviteeType,
        sourceBusinessName: business.name,
        sourceCity: cityName,
        sourceCaptureOffer: getOfferReference(captureOffer),
        sourceCashbackPercent: cashbackPercent,
        contactFirstName: inviteeFirstName,
        organizationName,
        personalNote,
        tier,
        channel,
      })

      return {
        ...script,
        generatedContent: script.body,
        tier,
        channel,
        scriptType,
      }
    }

    if (!targetBusinessName.trim()) return null

    return generateBusinessReferralScript({
      sourceBusinessName: business.name,
      sourceBusinessCategory: business.category,
      sourceCity: cityName,
      sourceCaptureOffer: getOfferReference(captureOffer),
      sourceCashbackPercent: cashbackPercent,
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
    cashbackPercent,
    channel,
    cityName,
    crmTarget?.city_label,
    fitReason,
    inviteeFirstName,
    inviteeType,
    joinedCount,
    organizationName,
    personalNote,
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
        description="We couldn't find your business details for this account yet."
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

  function chooseInviteeType(next: NetworkInviteeType) {
    if (next === inviteeType) return
    setInviteeType(next)
    setSubmitError(null)
    setActionMessage(null)
    setEditorContent('')
    lastAutoMessageRef.current = ''
  }

  function resetNetworkInviteForm() {
    setInviteeFirstName('')
    setInviteeLastName('')
    setInviteeEmail('')
    setInviteePhone('')
    setOrganizationName('')
    setInviteeAddress1('')
    setInviteeCity('')
    setInviteeState('')
    setInviteeZip('')
    setPersonalNote('')
    setEditorContent('')
    lastAutoMessageRef.current = ''
  }

  /**
   * Customer and cause invites go to the network endpoint, which opens the
   * invited account and returns its referral code. Nothing is written to the CRM
   * business pipeline — a person is not a lead.
   */
  async function handleSendNetworkInvite(copyFirst: boolean) {
    if (isBusinessInvite || !editorContent.trim()) return

    setSubmitting(true)
    setSubmitError(null)
    setActionMessage(null)

    try {
      if (copyFirst) await handleCopy()

      const response = await fetch('/api/business-portal/network-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteeType,
          firstName: inviteeFirstName.trim(),
          lastName: inviteeLastName.trim(),
          email: inviteeEmail.trim(),
          phone: inviteePhone.trim(),
          address1: inviteeAddress1.trim(),
          city: inviteeCity.trim(),
          state: inviteeState.trim(),
          zipCode: inviteeZip.trim(),
          organizationName: inviteeType === 'cause' ? organizationName.trim() : '',
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        // 400 (missing field) and 409 (already registered) both carry a message
        // written for a human — show it as-is rather than a generic failure.
        setSubmitError(payload.error || 'This invite could not be sent.')
        return
      }

      const label = inviteeDisplayName || inviteeOption.nounSingular
      setSentInvites((current) => [
        {
          key: `${Date.now()}-${label}`,
          inviteeType,
          name: label,
          email: inviteeEmail.trim(),
          referralCode: typeof payload.referralCode === 'string' ? payload.referralCode : null,
          message: typeof payload.message === 'string' ? payload.message : null,
          sentAt: new Date().toISOString(),
        },
        ...current,
      ])
      setActionMessage(
        typeof payload.message === 'string' && payload.message
          ? payload.message
          : `${label} was invited into your network.`,
      )
      resetNetworkInviteForm()
    } catch {
      setSubmitError('This invite could not be sent.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmitInvite = isBusinessInvite
    ? !!targetBusinessName.trim() && !!editorContent.trim()
    : !!editorContent.trim()
      && !!inviteeFirstName.trim()
      && !!inviteeEmail.trim()
      && (inviteeType !== 'cause' || (!!organizationName.trim() && !!inviteeAddress1.trim()))

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
      {embedded ? null : (
        <PageHeader
          title="Grow Your Network"
          description="Invite customers, other businesses, and causes into your network — one composer, one place to track them."
          actions={
            boomerangEnabled ? (
              <Button variant="outline" asChild>
                <Link href={BUSINESS_BOOMERANG_NAV_HREF}>
                  {`Open my ${BOOMERANG_SURFACE.tab.toLowerCase()}`}
                  <Users className="h-4 w-4" />
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="grid gap-6">
        <Card className="overflow-hidden border-surface-200">
          <CardContent className="space-y-4 bg-[linear-gradient(135deg,_rgba(245,158,11,0.12),_rgba(255,255,255,0.98)_42%,_rgba(16,185,129,0.12)_100%)] px-6 py-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">How this page works</p>
              <h2 className="text-2xl font-semibold text-surface-900">Three easy steps</h2>
              <p className="max-w-2xl text-sm leading-6 text-surface-600">
                You do not need to understand the CRM side first. Just work through these in order and the system will
                keep up with you.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SimpleStepCard
                number="1"
                title="Choose who you are inviting"
                description="A customer, another local business, or a cause. The form and the message change to match."
              />
              <SimpleStepCard
                number="2"
                title="Use the message"
                description="Start from the suggested message, then make it sound more like you if you want."
              />
              <SimpleStepCard
                number="3"
                title="Send the invite"
                description="Every invite is recorded so you can follow up later without guessing what happened."
              />
            </div>
          </CardContent>
        </Card>

      </div>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">
          Who are you inviting?
        </legend>
        <div role="radiogroup" aria-label="Invitee type" className="mt-3 grid gap-3 sm:grid-cols-3">
          {NETWORK_INVITEE_TYPE_OPTIONS.map((option) => {
            const active = inviteeType === option.value
            const Icon = option.value === 'consumer' ? UserPlus : option.value === 'cause' ? HeartHandshake : Store

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseInviteeType(option.value)}
                className={cn(
                  'rounded-2xl border px-4 py-4 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                  active
                    ? 'border-brand-400 bg-brand-50 shadow-sm'
                    : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50',
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', active ? 'text-brand-600' : 'text-surface-400')} />
                  <span className="text-sm font-semibold text-surface-900">{option.label}</span>
                </span>
                <span className="mt-1.5 block text-xs leading-5 text-surface-500">{option.description}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className={cn('grid gap-4', boomerangEnabled ? 'md:grid-cols-3' : 'md:grid-cols-1')}>
        {/* Both of these measure the Boomerang list, so neither is shown to a
            business that does not have one. */}
        {boomerangEnabled ? (
          <>
            <GrowthStat
              href="/portal/business"
              label={`${BOOMERANG_SURFACE.tab} offer`}
              value={captureOffer?.value_label || captureOffer?.headline || 'Offer not set'}
              hint="Review or change it on your business profile."
            />
            <GrowthStat
              href={BUSINESS_BOOMERANG_NAV_HREF}
              label="Customers collected"
              value={`${joinedCount}`}
              hint={`Your ${BOOMERANG_SURFACE.tab.toLowerCase()} owns this number — open it to keep it moving.`}
            />
          </>
        ) : null}
        <GrowthStat
          href="/dashboard"
          label="CRM invites tracked"
          value={`${trackedCrmCount}`}
          hint={`${newLeadCount} of these created brand-new business leads for follow-up.`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        {!isBusinessInvite ? (
          <InviteeTypeGuidance inviteeType={inviteeType} businessName={scopedBusiness.name} boomerangEnabled={boomerangEnabled} />
        ) : (
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
        )}

        <div className="space-y-6">
          <Card className="overflow-hidden border-brand-100 shadow-panel">
            <CardHeader className="border-b border-brand-100 bg-brand-50/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Invite Composer</CardTitle>
                  <CardDescription>
                    {isBusinessInvite
                      ? 'Pick an existing CRM prospect or type a new one. If it does not exist yet, tracking this invite will open the business in the CRM automatically.'
                      : inviteeType === 'cause'
                        ? 'Invite a cause into your network. We open the cause account and hand back its referral code so supporters can pick it.'
                        : 'Invite a person to join as a member under your business. We open their account and hand back their referral code.'}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    isBusinessInvite
                      ? crmTarget ? 'info' : targetBusinessName.trim() ? 'warning' : 'default'
                      : inviteeDisplayName ? 'info' : 'default'
                  }
                >
                  {isBusinessInvite
                    ? crmTarget ? 'Existing CRM business' : targetBusinessName.trim() ? 'Will open new CRM lead' : 'Choose a target'
                    : inviteeDisplayName ? `Inviting a ${inviteeOption.nounSingular}` : `Choose a ${inviteeOption.nounSingular}`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4 text-sm leading-6 text-brand-800">
                {isBusinessInvite
                  ? 'Keep this simple: you only need the business name and a basic reason they are a good fit to get started.'
                  : inviteeType === 'cause'
                    ? 'You need the cause name, a contact person, their email, and a street address so the cause can be placed on the map.'
                    : 'You need a first name and an email address. Everything else just makes the message better.'}
              </div>

              {!isBusinessInvite ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {inviteeType === 'cause' ? (
                    <div className="md:col-span-2">
                      <InputBlock label="Cause name">
                        <Input
                          value={organizationName}
                          onChange={(event) => setOrganizationName(event.target.value)}
                          placeholder="School PTA, youth league, food pantry..."
                        />
                      </InputBlock>
                    </div>
                  ) : null}
                  <InputBlock label={inviteeType === 'cause' ? 'Contact first name' : 'First name'}>
                    <Input
                      value={inviteeFirstName}
                      onChange={(event) => setInviteeFirstName(event.target.value)}
                      placeholder={inviteeType === 'cause' ? 'Who runs it day to day' : 'A regular, a friend, a past customer...'}
                    />
                  </InputBlock>
                  <InputBlock label="Last name">
                    <Input
                      value={inviteeLastName}
                      onChange={(event) => setInviteeLastName(event.target.value)}
                      placeholder="Optional"
                    />
                  </InputBlock>
                  <InputBlock label="Email">
                    <Input
                      value={inviteeEmail}
                      onChange={(event) => setInviteeEmail(event.target.value)}
                      placeholder="name@example.com"
                      type="email"
                    />
                  </InputBlock>
                  <InputBlock label="Phone">
                    <Input
                      value={inviteePhone}
                      onChange={(event) => setInviteePhone(event.target.value)}
                      placeholder="(404) 555-0000"
                      type="tel"
                    />
                  </InputBlock>
                  {inviteeType === 'cause' ? (
                    <div className="md:col-span-2">
                      <InputBlock label="Street address">
                        <Input
                          value={inviteeAddress1}
                          onChange={(event) => setInviteeAddress1(event.target.value)}
                          placeholder="1200 Peachtree St NE"
                        />
                      </InputBlock>
                    </div>
                  ) : null}
                  <InputBlock label="City">
                    <Input
                      value={inviteeCity}
                      onChange={(event) => setInviteeCity(event.target.value)}
                      placeholder={cityName}
                    />
                  </InputBlock>
                  <div className="grid grid-cols-2 gap-4">
                    <InputBlock label="State">
                      <Input
                        value={inviteeState}
                        onChange={(event) => setInviteeState(event.target.value)}
                        placeholder="GA"
                      />
                    </InputBlock>
                    <InputBlock label="ZIP">
                      <Input
                        value={inviteeZip}
                        onChange={(event) => setInviteeZip(event.target.value)}
                        placeholder="30309"
                      />
                    </InputBlock>
                  </div>
                  <div className="md:col-span-2">
                    <InputBlock label={inviteeType === 'cause' ? 'Why this cause' : 'Personal note'}>
                      <Textarea
                        value={personalNote}
                        onChange={(event) => setPersonalNote(event.target.value)}
                        rows={3}
                        placeholder={
                          inviteeType === 'cause'
                            ? 'Why your customers would want to support this cause.'
                            : 'Anything you actually know about this person that makes the message sound like you.'
                        }
                      />
                    </InputBlock>
                  </div>
                </div>
              ) : (
              <>
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
              </>
              )}

              {isBusinessInvite ? (
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
              ) : null}

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
                            {isBusinessInvite
                              ? BUSINESS_REFERRAL_SCRIPT_TYPE_OPTIONS.find((option) => option.value === scriptType)?.fitHint
                              : `Written for ${inviteeDisplayName || `this ${inviteeOption.nounSingular}`}. Edit it freely — what you send is what gets saved.`}
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

                  {isBusinessInvite ? (
                    <InputBlock label="Internal notes for CRM">
                      <Textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        placeholder="Anything your team should remember once this intro is in the CRM."
                      />
                    </InputBlock>
                  ) : null}

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
                      onClick={() => void (isBusinessInvite ? handleTrack(false) : handleSendNetworkInvite(false))}
                      disabled={submitting || !canSubmitInvite}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                      {isBusinessInvite ? 'Save intro in CRM' : 'Send invite'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void (isBusinessInvite ? handleTrack(true) : handleSendNetworkInvite(true))}
                      disabled={submitting || !canSubmitInvite}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                      {isBusinessInvite ? 'Copy message + save intro' : 'Copy message + send invite'}
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-3 text-xs leading-6 text-surface-500">
                    {isBusinessInvite
                      ? 'Tracking this intro creates or links the target business inside the CRM, creates a contact when you provide one, logs the outreach activity, and adds an internal note so your team can follow it up later.'
                      : `Sending opens the ${inviteeOption.nounSingular} account under your business and returns its referral code. You still send the message yourself — copy it first so the invite does not arrive cold.`}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-10 text-sm text-surface-500">
                  {isBusinessInvite
                    ? 'Pick or type a business and your message will appear here.'
                    : inviteeType === 'cause'
                      ? 'Add the cause name and your message will appear here.'
                      : 'Add a first name and your message will appear here.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {sentInvites.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Invites sent just now</CardTitle>
                <CardDescription>
                  Customers and causes you invited in this session, with the referral code the platform assigned to each one.
                </CardDescription>
              </div>
              <Badge variant="success">{sentInvites.length} sent</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {sentInvites.map((invite) => (
              <div
                key={invite.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-surface-900">{invite.name}</p>
                    <Badge variant="outline">
                      {invite.inviteeType === 'cause' ? 'Cause' : 'Customer'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-surface-500">
                    {invite.email}
                    {invite.message ? ` / ${invite.message}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {invite.referralCode ? (
                    <code className="rounded border border-surface-200 bg-white px-2 py-1 text-xs font-semibold text-surface-900">
                      {invite.referralCode}
                    </code>
                  ) : null}
                  <span className="text-xs text-surface-400">{formatDateTime(invite.sentAt)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Business Invite Tracking</CardTitle>
              <CardDescription>Every business intro stays connected to the CRM so your team can see which businesses were invited and whether they were opened as leads.</CardDescription>
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

/**
 * Stands in for the CRM candidate picker when the invitee is not a business.
 * There is no local prospect list for people or causes, so this column explains
 * what the invite actually does and where to look for people worth inviting.
 */
function InviteeTypeGuidance({
  inviteeType,
  businessName,
  boomerangEnabled,
}: {
  inviteeType: NetworkInviteeType
  businessName: string
  /** Passed down so the Boomerang prompts stay absent for a business without a list. */
  boomerangEnabled: boolean
}) {
  const isCause = inviteeType === 'cause'

  return (
    <Card className="overflow-hidden border-surface-200">
      <CardHeader className="border-b border-surface-100 bg-surface-50/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{isCause ? 'Inviting a cause' : 'Inviting a customer'}</CardTitle>
            <CardDescription>
              {isCause
                ? `Causes join under ${businessName} and become something your customers can choose to support.`
                : `Customers join under ${businessName} and start earning on what they already spend locally.`}
            </CardDescription>
          </div>
          <Badge variant="info">
            {isCause ? <HeartHandshake className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            {isCause ? 'Cause' : 'Customer'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
          <p className="text-sm font-semibold text-surface-900">What happens when you send</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-surface-600">
            <li>The account is opened under your business straight away.</li>
            <li>You get back a referral code that is theirs to share.</li>
            <li>
              {isCause
                ? 'Once it is live, customers can pick the cause and a share of their local spending goes to it.'
                : 'They appear in your network as soon as they finish signing up.'}
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
          <p className="text-sm font-semibold text-surface-900">
            {isCause ? 'Causes worth asking' : 'People worth asking'}
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-surface-600">
            {isCause ? (
              <>
                <li>The school, team, or league your customers already sponsor.</li>
                <li>A nonprofit you have donated to before, so the ask is not cold.</li>
                <li>A community group that shows up in your neighborhood already.</li>
              </>
            ) : (
              <>
                <li>Your regulars — the people who would say yes without thinking.</li>
                {boomerangEnabled ? (
                  <li>{`Anyone already on your ${BOOMERANG_SURFACE.tab.toLowerCase()} who has not joined yet.`}</li>
                ) : null}
                <li>Friends and family who want to see the business do well.</li>
              </>
            )}
          </ul>
          {!isCause && boomerangEnabled ? (
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={BUSINESS_BOOMERANG_NAV_HREF}>
                {`Open my ${BOOMERANG_SURFACE.tab.toLowerCase()}`}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-3 text-xs leading-6 text-surface-500">
          {isCause
            ? 'A street address is required so the cause can be placed on the map. If the email is already registered, the invite is rejected with a message telling you so.'
            : 'A first name and email are all that is required. If the email is already registered, the invite is rejected with a message telling you so.'}
        </div>
      </CardContent>
    </Card>
  )
}

function SimpleStepCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
        {number}
      </div>
      <p className="mt-3 text-sm font-semibold text-surface-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-surface-500">{description}</p>
    </div>
  )
}

