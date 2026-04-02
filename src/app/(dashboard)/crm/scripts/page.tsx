'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowUpRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  Filter,
  FileText,
  GraduationCap,
  History,
  Loader2,
  MapPin,
  QrCode as QrCodeIcon,
  Search,
  Send,
  Sparkles,
  Store,
  User,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatCard } from '@/components/ui/stat-card'
import { useAuth } from '@/lib/auth/context'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import {
  useBusinesses,
  useCampaigns,
  useCauses,
  useCities,
  useContacts,
  useMaterials,
  useNotes,
  useOrganizations,
  useOutreachInsert,
  useOutreachScripts,
  useOutreachScriptInsert,
  useOutreachScriptUpdate,
  useProfiles,
  useQrCodeCollections,
  useQrCodes,
  useStakeholderAssignments,
  useTaskInsert,
} from '@/lib/supabase/hooks'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { cn, formatDateTime } from '@/lib/utils'
import {
  OUTREACH_SCRIPT_CHANNEL_OPTIONS,
  OUTREACH_SCRIPT_STATUS_OPTIONS,
  OUTREACH_SCRIPT_TIER_OPTIONS,
  generateOutreachScript,
  getCategoryConfig,
  getScriptTypeOptions,
  normalizeBusinessCategory,
} from '@/lib/outreach-script-engine'
import type {
  Campaign,
  Cause,
  Contact,
  Material,
  OutreachActivity,
  OutreachScript,
  OutreachScriptChannel,
  OutreachScriptStatus,
  OutreachScriptTier,
  QrCodeCollection,
  QrCode,
} from '@/lib/types/database'

/* ─────────────────────────── constants ─────────────────────────── */

const STAGE_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  lead: 'default',
  contacted: 'info',
  interested: 'info',
  in_progress: 'warning',
  onboarded: 'success',
  live: 'success',
  paused: 'warning',
  declined: 'danger',
}

const SCRIPT_STATUS_VARIANT: Record<OutreachScriptStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  not_started: 'default',
  copied: 'info',
  sent: 'info',
  delivered: 'success',
  replied: 'success',
  interested: 'success',
  not_interested: 'danger',
  follow_up_needed: 'warning',
}

/* ─────────────────────────── helpers ─────────────────────────── */

function relativeTime(date: string) {
  const now = Date.now()
  const target = new Date(date).getTime()
  const diffHours = Math.floor((now - target) / (1000 * 60 * 60))
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateTime(date)
}

function getBusinessField(metadata: Record<string, unknown> | null, keys: string[]) {
  if (!metadata) return ''
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function categoryLabel(category: string | null) {
  return category || 'Uncategorized'
}

function humanizeKey(value: string | null | undefined) {
  if (!value) return 'Unknown'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function personLabel(id: string | null, profileMap: Record<string, string>, ownId: string) {
  if (!id) return 'Unassigned'
  if (id === ownId) return 'You'
  return profileMap[id] || 'Assigned internally'
}

function toLocalDateTimeInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function defaultFollowUpDateInput() {
  const next = new Date()
  next.setDate(next.getDate() + 3)
  next.setHours(9, 0, 0, 0)
  return toLocalDateTimeInput(next)
}

function toIsoOrNull(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function InputBlock({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-surface-400">{label}</p>
      {children}
    </div>
  )
}

function SnapshotField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-surface-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-surface-800">{value}</p>
    </div>
  )
}

function SnapshotLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-surface-700 transition-colors hover:border-surface-300 hover:bg-surface-100"
    >
      {icon}
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  )
}

function HistoryRow({
  item,
  label,
  compact = false,
  actionLabel,
  onAction,
}: {
  item: OutreachScript
  label: string
  compact?: boolean
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-surface-800">
            {humanizeKey(item.script_type)} / {item.script_tier.toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-surface-500">
            {label} / {humanizeKey(item.channel)} / {relativeTime(item.created_at)}
          </p>
        </div>
        <Badge variant={SCRIPT_STATUS_VARIANT[item.status]}>
          {OUTREACH_SCRIPT_STATUS_OPTIONS.find((option) => option.value === item.status)?.label || item.status}
        </Badge>
      </div>
      {!compact && (
        <p className="mt-3 line-clamp-3 text-sm text-surface-700">{item.final_content}</p>
      )}
      {onAction && actionLabel ? (
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function SelectedBusinessBanner({
  business,
  stage,
  onChangeClick,
}: {
  business: { name: string; category: string | null; cityLabel: string; stage: string }
  stage: string
  onChangeClick: () => void
}) {
  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <Store className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-surface-900">{business.name}</p>
          <p className="text-xs text-surface-500">{categoryLabel(business.category)} &middot; {business.cityLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={STAGE_VARIANT[stage] || 'default'} dot>
          {ONBOARDING_STAGES[stage as keyof typeof ONBOARDING_STAGES]?.label || stage}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onChangeClick}>Change</Button>
      </div>
    </div>
  )
}

/* ─────────────────────────── main page ─────────────────────────── */

export default function OutreachScriptsPage() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useAuth()
  const isFieldUser = getStakeholderShell(profile) === 'field'
  const { data: businesses, loading: businessesLoading, error: businessesError } = useBusinesses()
  const { data: campaigns } = useCampaigns()
  const { data: cities } = useCities()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()
  const { data: materials } = useMaterials()
  const { data: notes } = useNotes({ entity_type: 'business' })
  const { data: organizations } = useOrganizations()
  const { data: qrCodeCollections } = useQrCodeCollections()
  const { data: qrCodes } = useQrCodes()
  const { data: assignments } = useStakeholderAssignments({ entity_type: 'business' })
  const { data: history, loading: historyLoading, refetch: refetchHistory } = useOutreachScripts()
  const { data: profiles } = useProfiles()
  const { insert: insertScript, loading: insertingScript } = useOutreachScriptInsert()
  const { update: updateScript, loading: updatingScript } = useOutreachScriptUpdate()
  const { insert: insertOutreach, loading: insertingOutreach } = useOutreachInsert()
  const { insert: insertTask, loading: insertingTask } = useTaskInsert()

  const [search, setSearch] = React.useState('')
  const deferredSearch = React.useDeferredValue(search)
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [cityFilter, setCityFilter] = React.useState('all')
  const [stageFilter, setStageFilter] = React.useState('all')
  const [causeFilter, setCauseFilter] = React.useState<'all' | 'linked' | 'suggested' | 'none'>('all')
  const [selectedBusinessId, setSelectedBusinessId] = React.useState<string | null>(null)
  const [step, setStep] = React.useState<0 | 1 | 2 | 3>(0)
  const [tier, setTier] = React.useState<OutreachScriptTier>('better')
  const [channel, setChannel] = React.useState<OutreachScriptChannel>('in_person')
  const [scriptType, setScriptType] = React.useState('')
  const [status, setStatus] = React.useState<OutreachScriptStatus>('sent')
  const [logNotes, setLogNotes] = React.useState('')
  const [selectedContactId, setSelectedContactId] = React.useState('')
  const [nextStep, setNextStep] = React.useState('')
  const [nextStepDate, setNextStepDate] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  const [actionMessage, setActionMessage] = React.useState<string | null>(null)
  const [historyHint, setHistoryHint] = React.useState<string | null>(null)
  const [editorContent, setEditorContent] = React.useState('')
  const [draftRecord, setDraftRecord] = React.useState<OutreachScript | null>(null)
  const [personalization, setPersonalization] = React.useState({
    intern_name: '',
    city: '',
    school_name: '',
    local_cause_name: '',
    personal_connection: '',
    owner_name: '',
    specific_product: '',
    avg_ticket: '',
    local_context: '',
  })

  /* ── maps ── */

  const cityLabelMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const city of cities) map[city.id] = `${city.name}, ${city.state}`
    return map
  }, [cities])

  const cityNameMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const city of cities) map[city.id] = city.name
    return map
  }, [cities])

  const profileMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of profiles) map[item.id] = item.full_name
    return map
  }, [profiles])

  const businessNameMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of businesses) map[item.id] = item.name
    return map
  }, [businesses])

  const campaignMap = React.useMemo(() => {
    const map: Record<string, Campaign> = {}
    for (const item of campaigns) map[item.id] = item
    return map
  }, [campaigns])

  const causeMap = React.useMemo(() => {
    const map: Record<string, Cause> = {}
    for (const item of causes) map[item.id] = item
    return map
  }, [causes])

  const materialMap = React.useMemo(() => {
    const map: Record<string, Material> = {}
    for (const item of materials) map[item.id] = item
    return map
  }, [materials])

  const qrCodeMap = React.useMemo(() => {
    const map: Record<string, QrCode> = {}
    for (const item of qrCodes) map[item.id] = item
    return map
  }, [qrCodes])

  const qrCollectionMap = React.useMemo(() => {
    const map: Record<string, QrCodeCollection> = {}
    for (const item of qrCodeCollections) map[item.id] = item
    return map
  }, [qrCodeCollections])

  const businessContacts = React.useMemo(() => {
    const map: Record<string, Contact[]> = {}
    for (const contact of contacts) {
      if (!contact.business_id) continue
      if (!map[contact.business_id]) map[contact.business_id] = []
      map[contact.business_id].push(contact)
    }
    Object.values(map).forEach((items) => {
      items.sort((left, right) => {
        const leftLabel = `${left.first_name} ${left.last_name}`.trim()
        const rightLabel = `${right.first_name} ${right.last_name}`.trim()
        return leftLabel.localeCompare(rightLabel)
      })
    })
    return map
  }, [contacts])

  const businessAssignments = React.useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const assignment of assignments) {
      if (!assignment.entity_id) continue
      if (!map[assignment.entity_id]) map[assignment.entity_id] = []
      map[assignment.entity_id].push(assignment.stakeholder_id)
    }
    return map
  }, [assignments])

  const myBusinessIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const assignment of assignments) {
      if (assignment.stakeholder_id === profile.id) ids.add(assignment.entity_id)
    }
    for (const business of businesses) {
      if (business.owner_id === profile.id) ids.add(business.id)
    }
    for (const item of history) {
      if (item.created_by === profile.id) ids.add(item.business_id)
    }
    return ids
  }, [assignments, businesses, history, profile.id])

  const historyByBusiness = React.useMemo(() => {
    const map: Record<string, OutreachScript[]> = {}
    for (const item of history) {
      if (!map[item.business_id]) map[item.business_id] = []
      map[item.business_id].push(item)
    }
    Object.values(map).forEach(items => items.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)))
    return map
  }, [history])

  const recentMine = React.useMemo(
    () => history
      .filter(item => item.created_by === profile.id)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 5),
    [history, profile.id]
  )

  const organizationName = React.useMemo(() => {
    const organization = organizations.find(item => item.id === profile.organization_id)
    if (organization?.name) return organization.name
    const metadata = profile.metadata as Record<string, unknown> | null
    const schoolName = metadata?.school_name
    return typeof schoolName === 'string' ? schoolName : ''
  }, [organizations, profile.organization_id, profile.metadata])

  /* ── enriched businesses ── */

  const enrichedBusinesses = React.useMemo(() => {
    return businesses.map((business) => {
      const categoryKey = normalizeBusinessCategory(business.category)
      const explicitCause = business.linked_cause_id ? causeMap[business.linked_cause_id] : null
      const suggestedCause = explicitCause || causes.find((cause) => cause.city_id === business.city_id) || null
      const causeMode: 'linked' | 'suggested' | 'none' = explicitCause ? 'linked' : suggestedCause ? 'suggested' : 'none'
      const recentHistory = historyByBusiness[business.id]?.[0] || null
      const product = getBusinessField(business.metadata, ['specific_product', 'offer_title', 'primary_product'])
      const avgTicket = getBusinessField(business.metadata, ['avg_ticket', 'average_ticket', 'avg_spend'])
      const ownerContact = businessContacts[business.id]?.[0] || null

      return {
        ...business,
        categoryKey,
        campaign: business.campaign_id ? campaignMap[business.campaign_id] || null : null,
        cityLabel: business.city_id ? cityLabelMap[business.city_id] || 'Unknown city' : 'No city set',
        cityName: business.city_id ? cityNameMap[business.city_id] || '' : '',
        contacts: businessContacts[business.id] || [],
        explicitCause,
        suggestedCause,
        causeMode,
        isMyBusiness: myBusinessIds.has(business.id),
        linkedMaterial: business.linked_material_id ? materialMap[business.linked_material_id] || null : null,
        linkedQrCode: business.linked_qr_code_id ? qrCodeMap[business.linked_qr_code_id] || null : null,
        linkedQrCollection: business.linked_qr_collection_id ? qrCollectionMap[business.linked_qr_collection_id] || null : null,
        recentHistory,
        product,
        avgTicket,
        ownerContact,
      }
    })
  }, [businesses, businessContacts, campaignMap, causes, causeMap, cityLabelMap, cityNameMap, historyByBusiness, materialMap, myBusinessIds, qrCodeMap, qrCollectionMap])

  const filteredBusinesses = React.useMemo(() => {
    const term = deferredSearch.trim().toLowerCase()
    const filtered = enrichedBusinesses.filter((business) => {
      if (term) {
        const haystack = [
          business.name,
          business.category || '',
          business.address || '',
          business.cityLabel,
          business.product,
        ].join(' ').toLowerCase()
        if (!haystack.includes(term)) return false
      }
      if (categoryFilter !== 'all' && business.categoryKey !== categoryFilter) return false
      if (cityFilter !== 'all' && business.city_id !== cityFilter) return false
      if (stageFilter !== 'all' && business.stage !== stageFilter) return false
      if (causeFilter !== 'all' && business.causeMode !== causeFilter) return false
      return true
    })

    if (!isFieldUser) return filtered

    return [...filtered].sort((left, right) => {
      if (Number(right.isMyBusiness) !== Number(left.isMyBusiness)) {
        return Number(right.isMyBusiness) - Number(left.isMyBusiness)
      }

      const rightRecent = right.recentHistory ? +new Date(right.recentHistory.created_at) : 0
      const leftRecent = left.recentHistory ? +new Date(left.recentHistory.created_at) : 0
      if (rightRecent !== leftRecent) return rightRecent - leftRecent

      return left.name.localeCompare(right.name)
    })
  }, [categoryFilter, cityFilter, causeFilter, deferredSearch, enrichedBusinesses, isFieldUser, stageFilter])

  /* ── url sync ── */

  const updateBusinessQueryParam = React.useCallback(
    (businessId: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (businessId) {
        params.set('business', businessId)
      } else {
        params.delete('business')
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handleSelectBusiness = React.useCallback(
    (businessId: string) => {
      setSelectedBusinessId(businessId)
      updateBusinessQueryParam(businessId)
    },
    [updateBusinessQueryParam]
  )

  /* ── effects ── */

  React.useEffect(() => {
    if (!filteredBusinesses.length) {
      setSelectedBusinessId(null)
      updateBusinessQueryParam(null)
      return
    }
    const stillExists = filteredBusinesses.some((item) => item.id === selectedBusinessId)
    if (!stillExists) {
      const fallbackBusinessId = searchParams.get('business')
      const nextBusinessId =
        fallbackBusinessId && enrichedBusinesses.some((item) => item.id === fallbackBusinessId)
          ? fallbackBusinessId
          : filteredBusinesses[0].id
      setSelectedBusinessId(nextBusinessId)
      updateBusinessQueryParam(nextBusinessId)
    }
  }, [enrichedBusinesses, filteredBusinesses, searchParams, selectedBusinessId, updateBusinessQueryParam])

  React.useEffect(() => {
    const requestedBusiness = searchParams.get('business')
    if (!requestedBusiness) return
    if (!enrichedBusinesses.some((item) => item.id === requestedBusiness)) return
    setSelectedBusinessId(requestedBusiness)
  }, [enrichedBusinesses, searchParams])

  // Guard: bounce to step 0 if business is deselected while on a later step
  React.useEffect(() => {
    if (step > 0 && !selectedBusinessId) setStep(0)
  }, [selectedBusinessId, step])

  const selectedBusiness = React.useMemo(
    () => filteredBusinesses.find((item) => item.id === selectedBusinessId) || enrichedBusinesses.find((item) => item.id === selectedBusinessId) || null,
    [enrichedBusinesses, filteredBusinesses, selectedBusinessId]
  )

  const selectedContact = React.useMemo(
    () => selectedBusiness?.contacts.find((contact) => contact.id === selectedContactId) || selectedBusiness?.ownerContact || selectedBusiness?.contacts[0] || null,
    [selectedBusiness, selectedContactId]
  )

  const categoryConfig = React.useMemo(
    () => (selectedBusiness ? getCategoryConfig(selectedBusiness.categoryKey) : null),
    [selectedBusiness]
  )

  const scriptTypeOptions = React.useMemo(() => {
    if (!selectedBusiness) return []
    return getScriptTypeOptions(selectedBusiness.categoryKey)
  }, [selectedBusiness])

  React.useEffect(() => {
    if (!scriptTypeOptions.length) {
      setScriptType('')
      return
    }
    if (!scriptTypeOptions.some((option) => option.key === scriptType)) {
      setScriptType(scriptTypeOptions[0].key)
    }
  }, [scriptTypeOptions, scriptType])

  React.useEffect(() => {
    if (!selectedBusiness) return
    const suggestedCause = selectedBusiness.explicitCause || selectedBusiness.suggestedCause
    const defaultContact = selectedBusiness.ownerContact || selectedBusiness.contacts[0] || null
    const latestMine = (historyByBusiness[selectedBusiness.id] || []).find((item) => item.created_by === profile.id) || null
    const savedPersonalization = latestMine && latestMine.personalization && typeof latestMine.personalization === 'object'
      ? latestMine.personalization as Record<string, unknown>
      : null
    setPersonalization({
      intern_name: typeof savedPersonalization?.intern_name === 'string' ? savedPersonalization.intern_name : profile.full_name,
      city: typeof savedPersonalization?.city === 'string' ? savedPersonalization.city : selectedBusiness.cityName || '',
      school_name: typeof savedPersonalization?.school_name === 'string' ? savedPersonalization.school_name : organizationName,
      local_cause_name: typeof savedPersonalization?.local_cause_name === 'string' ? savedPersonalization.local_cause_name : suggestedCause?.name || '',
      personal_connection: typeof savedPersonalization?.personal_connection === 'string' ? savedPersonalization.personal_connection : '',
      owner_name: typeof savedPersonalization?.owner_name === 'string'
        ? savedPersonalization.owner_name
        : defaultContact ? `${defaultContact.first_name} ${defaultContact.last_name}`.trim() : getBusinessField(selectedBusiness.metadata, ['owner_name']),
      specific_product: typeof savedPersonalization?.specific_product === 'string'
        ? savedPersonalization.specific_product
        : selectedBusiness.product || getCategoryConfig(selectedBusiness.categoryKey).defaultProduct,
      avg_ticket: typeof savedPersonalization?.avg_ticket === 'string'
        ? savedPersonalization.avg_ticket
        : selectedBusiness.avgTicket || getCategoryConfig(selectedBusiness.categoryKey).defaultAvgTicket,
      local_context: typeof savedPersonalization?.local_context === 'string'
        ? savedPersonalization.local_context
        : getBusinessField(selectedBusiness.metadata, ['local_context']) || selectedBusiness.address || selectedBusiness.cityLabel,
    })
    setSelectedContactId(defaultContact?.id || '')
    setNextStep('')
    setNextStepDate('')
    setLogNotes('')
    setStatus('sent')
    if (latestMine) {
      setTier(latestMine.script_tier)
      setChannel(latestMine.channel)
      setScriptType(latestMine.script_type)
      setHistoryHint(`Loaded your last setup from ${relativeTime(latestMine.created_at)} so you can move faster on ${selectedBusiness.name}.`)
    } else {
      setHistoryHint(null)
    }
    setDraftRecord(null)
    setCopied(false)
    setActionMessage(null)
  }, [historyByBusiness, organizationName, profile.full_name, profile.id, selectedBusiness])

  const generatedScript = React.useMemo(() => {
    if (!selectedBusiness || !scriptType) return null
    return generateOutreachScript({
      categoryKey: selectedBusiness.categoryKey,
      scriptType,
      tier,
      channel,
      intern_name: personalization.intern_name,
      city: personalization.city,
      school_name: personalization.school_name,
      business_name: selectedBusiness.name,
      business_type: selectedBusiness.category,
      owner_name: personalization.owner_name,
      specific_product: personalization.specific_product,
      avg_ticket: personalization.avg_ticket,
      personal_connection: personalization.personal_connection,
      local_cause_name: personalization.local_cause_name,
      local_context: personalization.local_context,
    })
  }, [channel, personalization, scriptType, selectedBusiness, tier])

  React.useEffect(() => {
    if (!generatedScript) {
      setEditorContent('')
      return
    }
    setEditorContent(generatedScript.generatedContent)
    setDraftRecord(null)
    setCopied(false)
  }, [generatedScript])

  React.useEffect(() => {
    if (status !== 'follow_up_needed') return
    if (nextStepDate) return
    setNextStepDate(defaultFollowUpDateInput())
  }, [nextStepDate, status])

  /* ── derived values ── */

  const selectedHistory = selectedBusiness ? historyByBusiness[selectedBusiness.id] || [] : []
  const myHistoryForBusiness = selectedHistory.filter((item) => item.created_by === profile.id)
  const recommendedHistory = myHistoryForBusiness.find((item) => item.status === 'interested' || item.status === 'replied') || myHistoryForBusiness[0] || null
  const recommendedStructures = selectedBusiness
    ? history
      .filter((item) =>
        item.created_by === profile.id
        && item.business_id !== selectedBusiness.id
        && item.business_category === selectedBusiness.category
      )
      .sort((left, right) => {
        const statusDiff = Number(right.status === 'interested' || right.status === 'replied') - Number(left.status === 'interested' || left.status === 'replied')
        if (statusDiff !== 0) return statusDiff
        return +new Date(right.created_at) - +new Date(left.created_at)
      })
      .slice(0, 3)
    : []
  const selectedNotes = selectedBusiness
    ? notes.filter((note) => note.entity_id === selectedBusiness.id).slice(0, 3)
    : []

  const recentRisk = selectedHistory[0] || null
  const recentRiskByOther = recentRisk && recentRisk.created_by !== profile.id
    && (Date.now() - new Date(recentRisk.created_at).getTime()) < 1000 * 60 * 60 * 72

  const stats = React.useMemo(() => {
    const mine = history.filter(item => item.created_by === profile.id)
    return {
      generated: mine.length,
      interested: mine.filter(item => item.status === 'interested').length,
      followUps: mine.filter(item => item.status === 'follow_up_needed').length,
      copied: mine.filter(item => item.copy_count > 0).length,
    }
  }, [history, profile.id])

  const copyPayload = React.useMemo(() => {
    const trimmedBody = editorContent.trim()
    if (!trimmedBody) return ''
    if (generatedScript?.subject) return `Subject: ${generatedScript.subject}\n\n${trimmedBody}`
    return trimmedBody
  }, [editorContent, generatedScript])

  const logBlocked = !!recentRiskByOther
  const pendingAction = insertingScript || updatingScript || insertingOutreach || insertingTask
  const isStepComplete = [
    !!selectedBusiness,
    !!selectedBusiness && !!personalization.city.trim() && !!personalization.school_name.trim() && !!personalization.specific_product.trim() && !!personalization.avg_ticket.trim(),
    !!selectedBusiness && !!generatedScript && !!scriptType,
    !!selectedBusiness && !!generatedScript && !!editorContent.trim(),
  ]

  const stepMeta = [
    { title: 'Choose business', description: 'Pick the business and review what the CRM already knows.' },
    { title: 'Local angle', description: 'Ground the script in school, city, cause, and real connection.' },
    { title: 'Shape approach', description: 'Choose message angle, channel, and strength level.' },
    { title: 'Review & log', description: 'Tighten the draft, copy it, and push it back into the CRM.' },
  ] as const

  const focusHistory = recommendedHistory || recommendedStructures[0] || null

  /* ── step navigation ── */

  function goToNextStep() {
    setStep((current) => {
      if (current === 0) return 1
      if (current === 1) return 2
      if (current === 2) return 3
      return 3
    })
  }

  function goToPreviousStep() {
    setStep((current) => {
      if (current === 3) return 2
      if (current === 2) return 1
      if (current === 1) return 0
      return 0
    })
  }

  /* ── history reuse ── */

  function applyHistoryRecord(
    item: OutreachScript,
    options?: { includePersonalization?: boolean; includeContent?: boolean; strategyOnly?: boolean }
  ) {
    setTier(item.script_tier)
    setChannel(item.channel)
    setScriptType(item.script_type)

    if (!options?.strategyOnly && options?.includePersonalization) {
      const saved = item.personalization && typeof item.personalization === 'object'
        ? item.personalization as Record<string, unknown>
        : null

      if (saved) {
        setPersonalization((current) => ({
          ...current,
          intern_name: typeof saved.intern_name === 'string' ? saved.intern_name : current.intern_name,
          city: typeof saved.city === 'string' ? saved.city : current.city,
          school_name: typeof saved.school_name === 'string' ? saved.school_name : current.school_name,
          local_cause_name: typeof saved.local_cause_name === 'string' ? saved.local_cause_name : current.local_cause_name,
          personal_connection: typeof saved.personal_connection === 'string' ? saved.personal_connection : current.personal_connection,
          owner_name: typeof saved.owner_name === 'string' ? saved.owner_name : current.owner_name,
          specific_product: typeof saved.specific_product === 'string' ? saved.specific_product : current.specific_product,
          avg_ticket: typeof saved.avg_ticket === 'string' ? saved.avg_ticket : current.avg_ticket,
          local_context: typeof saved.local_context === 'string' ? saved.local_context : current.local_context,
        }))
      }
    }

    if (options?.includeContent) {
      setEditorContent(item.final_content)
    }

    setDraftRecord(null)
    setCopied(false)
    setActionMessage(`Loaded ${humanizeKey(item.script_tier)} / ${humanizeKey(item.channel)} from your history.`)
  }

  /* ── persist & log handlers ── */

  async function persistScriptRecord(nextStatus: OutreachScriptStatus, options?: { incrementCopy?: boolean; includeOutreach?: boolean }) {
    if (!selectedBusiness || !generatedScript) return null

    const now = new Date().toISOString()
    const finalContent = editorContent.trim()
    const nextStepDateIso = nextStatus === 'follow_up_needed' ? toIsoOrNull(nextStepDate) : null
    const payload = {
      business_id: selectedBusiness.id,
      cause_id: selectedBusiness.explicitCause?.id || selectedBusiness.suggestedCause?.id || selectedBusiness.linked_cause_id || null,
      campaign_id: selectedBusiness.campaign_id,
      city_id: selectedBusiness.city_id,
      contact_id: selectedContact?.id || null,
      created_by: profile.id,
      script_category: generatedScript.categoryKey,
      script_type: generatedScript.scriptType,
      script_tier: tier,
      channel,
      status: nextStatus,
      business_category: selectedBusiness.category || null,
      generated_content: generatedScript.generatedContent,
      final_content: finalContent,
      was_edited: finalContent !== generatedScript.generatedContent,
      notes: logNotes || null,
      copy_count: (draftRecord?.copy_count || 0) + (options?.incrementCopy ? 1 : 0),
      copied_at: options?.incrementCopy ? now : draftRecord?.copied_at || null,
      sent_at: nextStatus === 'sent' ? now : draftRecord?.sent_at || null,
      delivered_at: nextStatus === 'delivered' ? now : draftRecord?.delivered_at || null,
      replied_at: nextStatus === 'replied' || nextStatus === 'interested' || nextStatus === 'not_interested' ? now : draftRecord?.replied_at || null,
      linked_material_id: selectedBusiness.linked_material_id,
      linked_qr_code_id: selectedBusiness.linked_qr_code_id,
      linked_qr_collection_id: selectedBusiness.linked_qr_collection_id,
      personalization: {
        ...personalization,
        business_name: selectedBusiness.name,
        business_type: selectedBusiness.category,
      },
      metadata: {
        source: 'intern_outreach_script_engine',
        business_stage: selectedBusiness.stage,
        include_outreach: !!options?.includeOutreach,
        next_step: nextStatus === 'follow_up_needed' ? nextStep.trim() || 'Follow up with this business' : null,
        next_step_date: nextStepDateIso,
      },
    }

    const saved = draftRecord
      ? await updateScript(draftRecord.id, payload)
      : await insertScript(payload)

    if (!saved) return null
    setDraftRecord(saved)
    return saved
  }

  async function handleCopy() {
    if (!generatedScript || !copyPayload) return
    await navigator.clipboard.writeText(copyPayload)
    const saved = await persistScriptRecord('copied', { incrementCopy: true, includeOutreach: false })
    if (saved) {
      setCopied(true)
      setActionMessage('Script copied and saved to your outreach history.')
      refetchHistory()
    }
  }

  async function handleLog(copyFirst: boolean) {
    if (!generatedScript || !selectedBusiness) return
    if (logBlocked) {
      setActionMessage('Recent outreach from another stakeholder is already logged here. Review the business timeline before sending another touchpoint.')
      return
    }

    const nextStepValue = status === 'follow_up_needed'
      ? nextStep.trim() || `Follow up with ${selectedBusiness.name}`
      : null
    const nextStepDateIso = status === 'follow_up_needed' ? toIsoOrNull(nextStepDate) : null
    const saved = await persistScriptRecord(status, {
      incrementCopy: copyFirst,
      includeOutreach: true,
    })

    if (!saved) return

    if (copyFirst) {
      await navigator.clipboard.writeText(copyPayload)
      setCopied(true)
    }

    const outcomeLabel = OUTREACH_SCRIPT_STATUS_OPTIONS.find(option => option.value === status)?.label || status
    const outreachPayload: Partial<OutreachActivity> = {
      type: channel === 'email' ? 'email' : channel === 'text_dm' ? 'text' : channel === 'leave_behind' ? 'other' : 'in_person',
      subject: generatedScript.subject || `${generatedScript.scriptTypeLabel} - ${tier.toUpperCase()}`,
      body: editorContent.trim(),
      entity_type: 'business',
      entity_id: selectedBusiness.id,
      business_id: selectedBusiness.id,
      cause_id: selectedBusiness.explicitCause?.id || selectedBusiness.suggestedCause?.id || selectedBusiness.linked_cause_id || null,
      city_id: selectedBusiness.city_id,
      contact_id: selectedContact?.id || null,
      performed_by: profile.id,
      campaign_id: selectedBusiness.campaign_id,
      outreach_script_id: saved.id,
      script_category: generatedScript.categoryKey,
      script_type: generatedScript.scriptType,
      script_tier: tier,
      script_channel: channel,
      outreach_status: status,
      business_category: selectedBusiness.category || null,
      generated_script_content: generatedScript.generatedContent,
      edited_script_content: editorContent.trim(),
      log_notes: logNotes || null,
      linked_material_id: selectedBusiness.linked_material_id,
      linked_qr_code_id: selectedBusiness.linked_qr_code_id,
      linked_qr_collection_id: selectedBusiness.linked_qr_collection_id,
      outcome: logNotes ? `${outcomeLabel}: ${logNotes}` : outcomeLabel,
      next_step: nextStepValue,
      next_step_date: nextStepDateIso,
      metadata: {
        source: 'intern_outreach_script_engine',
        script_tier: tier,
        script_channel: channel,
        script_type: generatedScript.scriptType,
        contact_name: selectedContact ? `${selectedContact.first_name} ${selectedContact.last_name}`.trim() : null,
        duplicate_guard_active: logBlocked,
      },
    }

    const outreachResult = await insertOutreach(outreachPayload)
    if (outreachResult) {
      if (status === 'follow_up_needed') {
        await insertTask({
          title: nextStepValue || `Follow up with ${selectedBusiness.name}`,
          description: logNotes || `Follow up after ${humanizeKey(channel)} outreach to ${selectedBusiness.name}.`,
          priority: 'high',
          status: 'pending',
          assigned_to: profile.id,
          created_by: profile.id,
          entity_type: 'business',
          entity_id: selectedBusiness.id,
          due_date: nextStepDateIso,
          metadata: {
            source: 'intern_outreach_script_engine',
            outreach_script_id: saved.id,
            contact_id: selectedContact?.id || null,
          },
        })
      }

      setActionMessage(
        copyFirst
          ? 'Script copied, logged, and pushed into the CRM timeline.'
          : status === 'follow_up_needed'
          ? 'Outreach logged and a follow-up task was created.'
          : 'Outreach logged to the CRM timeline.'
      )
      refetchHistory()
    }
  }

  /* ──────────────────── RENDER ──────────────────── */

  if (businessesLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading outreach script engine...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── page header ── */}
      <PageHeader
        title={isFieldUser ? 'Intern Outreach Script Wizard' : 'Outreach Script Wizard'}
        description={isFieldUser
          ? 'Work business by business through a guided flow, reuse what already worked, and log every touchpoint cleanly.'
          : 'Generate highly specific local-business scripts through a guided flow and push each touchpoint straight back into the CRM.'}
        breadcrumb={isFieldUser
          ? [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Outreach Scripts' }]
          : [{ label: 'CRM', href: '/crm/businesses' }, { label: 'Outreach Scripts' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {isFieldUser && (
              <Link href="/dashboard">
                <Button variant="outline">My Outreach Workspace <ArrowUpRight className="h-4 w-4" /></Button>
              </Link>
            )}
            <Link href="/crm/outreach">
              <Button variant="outline">View Outreach Timeline <ArrowUpRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        }
      />

      {/* ── stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Scripts Generated" value={stats.generated} icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Interested Replies" value={stats.interested} icon={<Send className="h-4 w-4" />} />
        <StatCard label="Copied for Use" value={stats.copied} icon={<Copy className="h-4 w-4" />} />
        <StatCard label="Follow-Ups Needed" value={stats.followUps} icon={<History className="h-4 w-4" />} />
      </div>

      {/* ── messages ── */}
      {businessesError && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          Failed to load businesses for the script engine: {businessesError}
        </div>
      )}
      {actionMessage && (
        <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {actionMessage}
        </div>
      )}

      {/* ── horizontal step indicator ── */}
      <nav className="rounded-2xl border border-surface-200 bg-surface-0 p-2">
        <div className="flex items-center">
          {stepMeta.map((item, index) => {
            const isActive = step === index
            const isDone = !!isStepComplete[index] && step !== index
            return (
              <React.Fragment key={item.title}>
                <button
                  type="button"
                  onClick={() => setStep(index as 0 | 1 | 2 | 3)}
                  className={cn(
                    'group flex flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left transition-all sm:px-4',
                    isActive
                      ? 'bg-brand-50 shadow-sm ring-1 ring-brand-300'
                      : isDone
                      ? 'hover:bg-success-50/60'
                      : 'hover:bg-surface-50'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all sm:h-9 sm:w-9 sm:text-sm',
                      isActive
                        ? 'bg-brand-600 text-white shadow-md'
                        : isDone
                        ? 'bg-success-500 text-white'
                        : 'bg-surface-200 text-surface-600'
                    )}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </div>
                  <div className="hidden min-w-0 lg:block">
                    <p
                      className={cn(
                        'truncate text-sm font-semibold',
                        isActive ? 'text-brand-700' : isDone ? 'text-success-700' : 'text-surface-700'
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-surface-500">{item.description}</p>
                  </div>
                </button>
                {index < 3 && (
                  <div
                    className={cn(
                      'mx-1 hidden h-px w-6 shrink-0 sm:block',
                      isStepComplete[index] ? 'bg-success-400' : 'bg-surface-200'
                    )}
                  />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </nav>

      {/* ── hints ── */}
      {historyHint && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">{historyHint}</div>
      )}

      {/* ────────── STEP 0 · Choose Business ────────── */}
      {step === 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Choose the Business</CardTitle>
            <CardDescription>Start with the CRM so the rest of the flow is grounded in the right context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* filters */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
              </div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm">
                <option value="all">All categories</option>
                <option value="coffee_shop">Coffee Shop</option>
                <option value="restaurant">Restaurant</option>
                <option value="gym_fitness">Gym / Fitness</option>
                <option value="salon_barbershop">Salon / Barbershop</option>
                <option value="family_entertainment">Family Entertainment</option>
              </select>
              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm">
                <option value="all">All cities</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}, {city.state}</option>
                ))}
              </select>
              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm">
                <option value="all">All stages</option>
                {Object.entries(ONBOARDING_STAGES).map(([value, def]) => (
                  <option key={value} value={value}>{def.label}</option>
                ))}
              </select>
              <select value={causeFilter} onChange={(e) => setCauseFilter(e.target.value as 'all' | 'linked' | 'suggested' | 'none')} className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm">
                <option value="all">All cause states</option>
                <option value="linked">Explicitly linked</option>
                <option value="suggested">Suggested from city</option>
                <option value="none">No relationship</option>
              </select>
            </div>

            <div className="flex items-center justify-between text-xs text-surface-500">
              <span>{filteredBusinesses.length} businesses found</span>
              <span className="flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Filtered from CRM</span>
            </div>

            {/* business grid */}
            {filteredBusinesses.length === 0 ? (
              <EmptyState icon={<Store className="h-8 w-8" />} title="No matching businesses" description="Adjust the filters or add more businesses in the CRM." />
            ) : (
              <div className="grid max-h-[32rem] gap-3 overflow-y-auto rounded-lg pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {filteredBusinesses.map((business) => {
                  const isSelected = business.id === selectedBusinessId
                  const assignedPeople = businessAssignments[business.id] || []
                  return (
                    <button
                      key={business.id}
                      type="button"
                      onClick={() => handleSelectBusiness(business.id)}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-all',
                        isSelected
                          ? 'border-brand-500 bg-brand-50/60 shadow-md ring-2 ring-brand-200'
                          : 'border-surface-200 bg-surface-0 hover:border-surface-300 hover:shadow-sm'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-surface-900">{business.name}</p>
                          <p className="mt-0.5 text-xs text-surface-500">{categoryLabel(business.category)}</p>
                        </div>
                        <Badge variant={STAGE_VARIANT[business.stage] || 'default'} dot>
                          {ONBOARDING_STAGES[business.stage]?.label || business.stage}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-surface-500">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {business.cityLabel}</span>
                        <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {assignedPeople.length ? `${assignedPeople.length} assigned` : 'No assignee'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant={business.causeMode === 'linked' ? 'success' : business.causeMode === 'suggested' ? 'warning' : 'default'}>
                          {business.causeMode === 'linked' ? 'Cause Linked' : business.causeMode === 'suggested' ? 'Cause Suggested' : 'No Cause'}
                        </Badge>
                        {business.recentHistory && (
                          <Badge variant={SCRIPT_STATUS_VARIANT[business.recentHistory.status]}>
                            {OUTREACH_SCRIPT_STATUS_OPTIONS.find(o => o.value === business.recentHistory.status)?.label || business.recentHistory.status}
                          </Badge>
                        )}
                      </div>
                      {business.recentHistory && (
                        <div className="mt-2 rounded-md bg-surface-50 px-2.5 py-1.5 text-xs text-surface-600">
                          Last {relativeTime(business.recentHistory.created_at)} by {personLabel(business.recentHistory.created_by, profileMap, profile.id)}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* selected business snapshot */}
            {selectedBusiness && (
              <div className="space-y-5 rounded-xl border border-brand-200 bg-brand-50/30 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-surface-900">{selectedBusiness.name}</h3>
                      <Link href={`/crm/businesses/${selectedBusiness.id}`}>
                        <Button variant="ghost" size="icon-sm"><ArrowUpRight className="h-4 w-4" /></Button>
                      </Link>
                    </div>
                    <p className="text-sm text-surface-500">{categoryLabel(selectedBusiness.category)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={STAGE_VARIANT[selectedBusiness.stage] || 'default'} dot>
                      {ONBOARDING_STAGES[selectedBusiness.stage]?.label || selectedBusiness.stage}
                    </Badge>
                    {selectedHistory[0] ? (
                      <Badge variant={SCRIPT_STATUS_VARIANT[selectedHistory[0].status]}>
                        {OUTREACH_SCRIPT_STATUS_OPTIONS.find(o => o.value === selectedHistory[0].status)?.label || selectedHistory[0].status}
                      </Badge>
                    ) : (
                      <Badge variant="default">No script history</Badge>
                    )}
                  </div>
                </div>

                {recentRiskByOther && recentRisk && (
                  <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
                    <div className="flex items-start gap-2">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">Recent outreach already logged</p>
                        <p className="mt-1 text-xs">
                          {personLabel(recentRisk.created_by, profileMap, profile.id)} used a {recentRisk.script_tier} script here {relativeTime(recentRisk.created_at)}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SnapshotField icon={<MapPin className="h-4 w-4" />} label="Address / Area" value={selectedBusiness.address || selectedBusiness.cityLabel} />
                  <SnapshotField icon={<User className="h-4 w-4" />} label="Primary Contact" value={selectedContact ? `${selectedContact.first_name} ${selectedContact.last_name}`.trim() : personalization.owner_name || 'No owner name yet'} />
                  <SnapshotField icon={<FileText className="h-4 w-4" />} label="Average Spend" value={personalization.avg_ticket || 'Need an estimate'} />
                  <SnapshotField icon={<Store className="h-4 w-4" />} label="Products / Services" value={personalization.specific_product || 'Need a sharper product angle'} />
                  <SnapshotField icon={<GraduationCap className="h-4 w-4" />} label="Local Cause / School" value={personalization.local_cause_name || 'No linked cause yet'} />
                  <SnapshotField
                    icon={<Building2 className="h-4 w-4" />}
                    label="Assigned Stakeholder"
                    value={(businessAssignments[selectedBusiness.id] || []).map((id) => personLabel(id, profileMap, profile.id)).join(', ') || 'No assignee visible'}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Outreach Status</p>
                    <p className="mt-1 text-sm font-medium text-surface-800">
                      {selectedHistory[0]
                        ? `${OUTREACH_SCRIPT_STATUS_OPTIONS.find(option => option.value === selectedHistory[0].status)?.label || selectedHistory[0].status} by ${personLabel(selectedHistory[0].created_by, profileMap, profile.id)}`
                        : 'No logged script yet'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Cause Relationship</p>
                    <p className="mt-1 text-sm font-medium text-surface-800">
                      {selectedBusiness.explicitCause
                        ? `Linked to ${selectedBusiness.explicitCause.name}`
                        : selectedBusiness.suggestedCause
                        ? `Suggested from city: ${selectedBusiness.suggestedCause.name}`
                        : 'No linked cause yet'}
                    </p>
                  </div>
                </div>

                {selectedContact && (
                  <div className="rounded-lg border border-surface-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Selected Contact</p>
                    <p className="mt-1 text-sm font-medium text-surface-900">
                      {`${selectedContact.first_name} ${selectedContact.last_name}`.trim()}
                      {selectedContact.title ? `, ${selectedContact.title}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-500">
                      {[selectedContact.email, selectedContact.phone].filter(Boolean).join(' / ') || 'No direct email or phone saved yet.'}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Connected Records</p>
                  <div className="flex flex-wrap gap-2">
                    <SnapshotLink href={`/crm/businesses/${selectedBusiness.id}`} icon={<Store className="h-3.5 w-3.5" />} label="Business Record" />
                    {selectedBusiness.explicitCause && (
                      <SnapshotLink href={`/crm/causes/${selectedBusiness.explicitCause.id}`} icon={<GraduationCap className="h-3.5 w-3.5" />} label={selectedBusiness.explicitCause.name} />
                    )}
                    {!selectedBusiness.explicitCause && selectedBusiness.suggestedCause && (
                      <SnapshotLink href={`/crm/causes/${selectedBusiness.suggestedCause.id}`} icon={<GraduationCap className="h-3.5 w-3.5" />} label={`Suggested: ${selectedBusiness.suggestedCause.name}`} />
                    )}
                    {selectedBusiness.campaign && (
                      <SnapshotLink href={`/campaigns/${selectedBusiness.campaign.id}`} icon={<Building2 className="h-3.5 w-3.5" />} label={selectedBusiness.campaign.name} />
                    )}
                    {(businessAssignments[selectedBusiness.id] || []).slice(0, 2).map((stakeholderId) => (
                      <SnapshotLink
                        key={stakeholderId}
                        href={`/admin/users/${stakeholderId}`}
                        icon={<User className="h-3.5 w-3.5" />}
                        label={personLabel(stakeholderId, profileMap, profile.id)}
                      />
                    ))}
                    {selectedBusiness.linkedMaterial && (
                      <SnapshotLink href="/materials/library" icon={<FileText className="h-3.5 w-3.5" />} label={selectedBusiness.linkedMaterial.title} />
                    )}
                    {selectedBusiness.linkedQrCode && (
                      <SnapshotLink href="/qr/mine" icon={<QrCodeIcon className="h-3.5 w-3.5" />} label={selectedBusiness.linkedQrCode.name} />
                    )}
                    {selectedBusiness.linkedQrCollection && (
                      <SnapshotLink href="/qr/collections" icon={<QrCodeIcon className="h-3.5 w-3.5" />} label={selectedBusiness.linkedQrCollection.name} />
                    )}
                  </div>
                </div>

                {selectedNotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Recent Notes</p>
                    {selectedNotes.map((note) => (
                      <div key={note.id} className="rounded-lg border border-surface-200 bg-white px-3 py-2">
                        <p className="text-sm text-surface-700">{note.content}</p>
                        <p className="mt-1 text-xs text-surface-400">{relativeTime(note.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ────────── STEP 1 · Local Angle ────────── */}
      {step === 1 && selectedBusiness && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Your Local Angle</CardTitle>
            <CardDescription>Use real local context. Tighten the fields until the script sounds like something you would actually say out loud.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SelectedBusinessBanner business={selectedBusiness} stage={selectedBusiness.stage} onChangeClick={() => setStep(0)} />

            <div className="grid gap-4 md:grid-cols-2">
              <InputBlock label="Intern Name">
                <Input value={personalization.intern_name} onChange={(e) => setPersonalization((c) => ({ ...c, intern_name: e.target.value }))} />
              </InputBlock>
              <InputBlock label="City">
                <Input value={personalization.city} onChange={(e) => setPersonalization((c) => ({ ...c, city: e.target.value }))} />
              </InputBlock>
              <InputBlock label="School Name">
                <Input value={personalization.school_name} onChange={(e) => setPersonalization((c) => ({ ...c, school_name: e.target.value }))} />
              </InputBlock>
              <InputBlock label="Local Cause">
                <Input value={personalization.local_cause_name} onChange={(e) => setPersonalization((c) => ({ ...c, local_cause_name: e.target.value }))} />
              </InputBlock>
              <InputBlock label="Owner Name Override">
                <Input value={personalization.owner_name} onChange={(e) => setPersonalization((c) => ({ ...c, owner_name: e.target.value }))} />
              </InputBlock>
              <InputBlock label="Specific Product Override">
                <Input value={personalization.specific_product} onChange={(e) => setPersonalization((c) => ({ ...c, specific_product: e.target.value }))} />
              </InputBlock>
              <InputBlock label="Average Spend Override">
                <Input value={personalization.avg_ticket} onChange={(e) => setPersonalization((c) => ({ ...c, avg_ticket: e.target.value }))} />
              </InputBlock>
              <InputBlock label="Local Context">
                <Input value={personalization.local_context} onChange={(e) => setPersonalization((c) => ({ ...c, local_context: e.target.value }))} placeholder="Neighborhood, district, school zone..." />
              </InputBlock>
              <InputBlock label="Personal Connection" className="md:col-span-2">
                <Textarea
                  value={personalization.personal_connection}
                  onChange={(e) => setPersonalization((c) => ({ ...c, personal_connection: e.target.value }))}
                  placeholder="Example: I used to stop by after games, or I know families from my school already come here."
                  rows={4}
                />
              </InputBlock>
            </div>

            {/* history suggestions */}
            {focusHistory && (
              <div className="space-y-3 border-t border-surface-200 pt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Reuse from your history</p>
                <HistoryRow
                  item={focusHistory}
                  label={focusHistory.business_id === selectedBusiness.id ? 'This business' : 'A similar business'}
                  actionLabel="Use this setup"
                  onAction={() => applyHistoryRecord(focusHistory, { includePersonalization: true, strategyOnly: false })}
                />
                {recommendedStructures.filter((item) => item.id !== focusHistory.id).slice(0, 2).map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    label={businessNameMap[item.business_id] || 'Another business'}
                    compact
                    actionLabel="Reuse setup"
                    onAction={() => applyHistoryRecord(item, { includePersonalization: true, strategyOnly: true })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ────────── STEP 2 · Shape Approach ────────── */}
      {step === 2 && selectedBusiness && generatedScript && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shape the Approach</CardTitle>
            <CardDescription>Choose the angle, quality level, and delivery mode that give you the best shot with this business.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SelectedBusinessBanner business={selectedBusiness} stage={selectedBusiness.stage} onChangeClick={() => setStep(0)} />

            <div className="grid gap-4 md:grid-cols-2">
              <InputBlock label="Script Type">
                <select
                  value={scriptType}
                  onChange={(e) => setScriptType(e.target.value)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  {scriptTypeOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-surface-500">
                  {scriptTypeOptions.find((option) => option.key === scriptType)?.description}
                </p>
              </InputBlock>
              <InputBlock label="Communication Mode">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as OutreachScriptChannel)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  {OUTREACH_SCRIPT_CHANNEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-surface-500">
                  {OUTREACH_SCRIPT_CHANNEL_OPTIONS.find((option) => option.value === channel)?.hint}
                </p>
              </InputBlock>
            </div>

            {/* tier cards */}
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-surface-400">Quality Tier</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {OUTREACH_SCRIPT_TIER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTier(option.value)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-all',
                      tier === option.value
                        ? 'border-brand-500 bg-brand-50 shadow-sm ring-1 ring-brand-300'
                        : 'border-surface-200 bg-surface-0 hover:border-surface-300 hover:shadow-sm'
                    )}
                  >
                    <p className="text-sm font-semibold text-surface-900">{option.label}</p>
                    <p className="mt-1 text-xs text-surface-500">{option.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-surface-50 px-4 py-3 text-sm text-surface-700">
              <span className="font-medium text-surface-900">Current frame:</span>{' '}
              {generatedScript.categoryLabel} using the {generatedScript.scriptTypeLabel} angle for a{' '}
              {OUTREACH_SCRIPT_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label.toLowerCase()}.
            </div>

            {/* category insights */}
            {categoryConfig && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Message Framing</p>
                  <p className="mt-2 text-sm text-surface-800">{categoryConfig.messageFraming}</p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Emotional Relevance</p>
                  <p className="mt-2 text-sm text-surface-800">{categoryConfig.emotionalRelevance}</p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Product Examples</p>
                  <p className="mt-2 text-sm text-surface-800">{categoryConfig.productExamples.join(', ')}</p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-400">CTA Style</p>
                  <p className="mt-2 text-sm text-surface-800">{categoryConfig.callToActionStyle}</p>
                </div>
              </div>
            )}

            {/* preview draft */}
            <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-700">Preview Draft</p>
                <Badge variant="info">Preview</Badge>
              </div>
              {generatedScript.subject && (
                <div className="rounded-lg border border-surface-200 bg-white px-4 py-2.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Subject</p>
                  <p className="mt-1 text-sm font-medium text-surface-800">{generatedScript.subject}</p>
                </div>
              )}
              <Textarea value={editorContent} rows={14} className="min-h-[18rem] bg-white text-[15px] leading-7" readOnly />
              <p className="text-xs text-surface-500">
                Preview the structure here first. If it feels right, continue to the final step to edit, copy, and log it.
              </p>
            </div>

            {/* recommended structures */}
            {recommendedStructures.length > 0 && (
              <div className="space-y-3 border-t border-surface-200 pt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Useful Structures From Your History</p>
                {recommendedStructures.map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    label={businessNameMap[item.business_id] || 'Another business'}
                    compact
                    actionLabel="Use this structure"
                    onAction={() => applyHistoryRecord(item, { includePersonalization: true, includeContent: false, strategyOnly: true })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ────────── STEP 3 · Review & Log ────────── */}
      {step === 3 && selectedBusiness && generatedScript && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Review, Edit &amp; Log</CardTitle>
              <CardDescription>Tighten the final draft, copy it, and push the touchpoint back into the CRM.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SelectedBusinessBanner business={selectedBusiness} stage={selectedBusiness.stage} onChangeClick={() => setStep(0)} />

              {recentRiskByOther && recentRisk && (
                <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
                  <div className="flex items-start gap-2">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Recent outreach already logged</p>
                      <p className="mt-1 text-xs">
                        {personLabel(recentRisk.created_by, profileMap, profile.id)} logged outreach {relativeTime(recentRisk.created_at)}. Review that touchpoint before sending another.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                {/* left: script editor */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-surface-900">{generatedScript.title}</p>
                    <Badge variant={SCRIPT_STATUS_VARIANT[status]}>
                      {OUTREACH_SCRIPT_STATUS_OPTIONS.find((o) => o.value === status)?.label || status}
                    </Badge>
                  </div>

                  {generatedScript.subject && (
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-2.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Subject</p>
                      <p className="mt-1 text-sm font-medium text-surface-800">{generatedScript.subject}</p>
                    </div>
                  )}

                  <Textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    rows={18}
                    className="min-h-[24rem] text-[15px] leading-7"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleCopy} disabled={pendingAction || !editorContent.trim()}>
                      {pendingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied' : generatedScript.subject ? 'Copy Email Draft' : 'Copy Script'}
                    </Button>
                    {focusHistory && (
                      <Button
                        variant="outline"
                        onClick={() => applyHistoryRecord(focusHistory, { includePersonalization: true, includeContent: true })}
                        disabled={pendingAction}
                      >
                        Use prior full draft
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-surface-500">
                    Edits are tracked against the generated draft for city, category, tier, stakeholder, and channel reporting.
                  </p>
                </div>

                {/* right: logging form */}
                <div className="space-y-4 rounded-xl border border-surface-200 bg-surface-50/50 p-5">
                  <p className="text-sm font-semibold text-surface-900">Outreach Logging</p>
                  <p className="text-xs text-surface-500">Choose the contact, mark the outcome, and send this touchpoint back into the CRM.</p>

                  {logBlocked && recentRisk && (
                    <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-xs text-warning-700">
                      {personLabel(recentRisk.created_by, profileMap, profile.id)} logged outreach {relativeTime(recentRisk.created_at)}. Review first.
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputBlock label="Contact">
                      <select
                        value={selectedContactId}
                        onChange={(e) => {
                          const nextId = e.target.value
                          setSelectedContactId(nextId)
                          const nextContact = selectedBusiness.contacts.find((c) => c.id === nextId) || null
                          if (nextContact) {
                            setPersonalization((cur) => ({
                              ...cur,
                              owner_name: `${nextContact.first_name} ${nextContact.last_name}`.trim(),
                            }))
                          }
                        }}
                        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                      >
                        <option value="">Use business-level owner context</option>
                        {selectedBusiness.contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {`${contact.first_name} ${contact.last_name}`.trim()}
                            {contact.title ? ` - ${contact.title}` : ''}
                          </option>
                        ))}
                      </select>
                    </InputBlock>
                    <InputBlock label="Outreach Status">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as OutreachScriptStatus)}
                        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                      >
                        {OUTREACH_SCRIPT_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </InputBlock>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputBlock label="Next Step">
                      <Input
                        value={nextStep}
                        onChange={(e) => setNextStep(e.target.value)}
                        placeholder={status === 'follow_up_needed' ? `Follow up with ${selectedBusiness.name}` : 'Optional next action'}
                      />
                    </InputBlock>
                    <InputBlock label="Follow-Up Date">
                      <Input
                        type="datetime-local"
                        value={nextStepDate}
                        onChange={(e) => setNextStepDate(e.target.value)}
                      />
                    </InputBlock>
                  </div>

                  <InputBlock label="Logging Notes">
                    <Textarea
                      value={logNotes}
                      onChange={(e) => setLogNotes(e.target.value)}
                      placeholder="What happened, what mattered, or what should happen next?"
                      rows={4}
                    />
                  </InputBlock>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => handleLog(false)} disabled={pendingAction || !editorContent.trim() || logBlocked}>
                      {pendingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Log Outreach
                    </Button>
                    <Button variant="secondary" onClick={() => handleLog(true)} disabled={pendingAction || !editorContent.trim() || logBlocked}>
                      {pendingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                      Copy + Log Outreach
                    </Button>
                  </div>

                  <p className="text-xs text-surface-500">
                    Logging writes the generated draft, edited draft, contact, script tier, QR/material hooks, and outreach status back into the CRM. Follow-up status also creates a task.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* script history */}
          <Card>
            <CardHeader>
              <CardTitle>Script History</CardTitle>
              <CardDescription>Review what has been used for this business and what you have recently touched yourself.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">This Business</p>
                      <span className="text-xs text-surface-400">{selectedHistory.length} records</span>
                    </div>
                    {selectedHistory.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-surface-200 px-4 py-4 text-sm text-surface-500">
                        No scripts have been used for this business yet.
                      </div>
                    ) : (
                      selectedHistory.slice(0, 4).map((item) => (
                        <HistoryRow
                          key={item.id}
                          item={item}
                          label={personLabel(item.created_by, profileMap, profile.id)}
                          actionLabel="Load draft"
                          onAction={() => applyHistoryRecord(item, { includePersonalization: true, includeContent: true })}
                        />
                      ))
                    )}
                  </div>

                  <div className="space-y-3 border-t border-surface-100 pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">My Recent Use</p>
                      <span className="text-xs text-surface-400">{recentMine.length} recent</span>
                    </div>
                    {recentMine.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-surface-200 px-4 py-4 text-sm text-surface-500">
                        Once you copy or log a script, your activity will appear here.
                      </div>
                    ) : (
                      recentMine.map((item) => (
                        <HistoryRow key={item.id} item={item} label={selectedBusiness.id === item.business_id ? 'This business' : 'Another business'} compact />
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── fallback when no business selected on steps 1-3 ── */}
      {step > 0 && !selectedBusiness && (
        <Card>
          <CardContent className="py-20">
            <EmptyState
              icon={<Sparkles className="h-8 w-8" />}
              title="Choose a business first"
              description="Go back to step one and pick a business before continuing."
            />
          </CardContent>
        </Card>
      )}

      {/* ── navigation footer ── */}
      <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-surface-0 px-6 py-4 shadow-sm">
        <Button variant="outline" onClick={goToPreviousStep} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          {step > 0 && focusHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                applyHistoryRecord(focusHistory, {
                  includePersonalization: true,
                  includeContent: focusHistory.business_id === selectedBusiness?.id,
                })
                setStep(focusHistory.business_id === selectedBusiness?.id ? 3 : 2)
              }}
            >
              Use recent structure
            </Button>
          )}
          {step < 3 && (
            <Button onClick={goToNextStep} disabled={!isStepComplete[step]}>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
