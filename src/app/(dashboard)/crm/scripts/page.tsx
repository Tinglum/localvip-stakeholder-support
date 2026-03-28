'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowUpRight,
  Building2,
  Check,
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

function StepCard({
  index,
  title,
  description,
  active,
  complete,
  onClick,
}: {
  index: number
  title: string
  description: string
  active: boolean
  complete: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border px-4 py-4 text-left transition-colors',
        active
          ? 'border-brand-500 bg-brand-50'
          : complete
          ? 'border-success-200 bg-success-50'
          : 'border-surface-200 bg-surface-0 hover:border-surface-300'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            active
              ? 'bg-brand-600 text-white'
              : complete
              ? 'bg-success-500 text-white'
              : 'bg-surface-100 text-surface-700'
          )}
        >
          {complete ? <Check className="h-4 w-4" /> : index + 1}
        </div>
        <div>
          <p className="text-sm font-semibold text-surface-900">{title}</p>
          <p className="mt-1 text-xs leading-5 text-surface-500">{description}</p>
        </div>
      </div>
    </button>
  )
}

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

  const stepMeta = [
    {
      title: 'Choose the business',
      description: 'Pick the business and review what the CRM already knows before you write anything.',
    },
    {
      title: 'Add your local angle',
      description: 'Make it sound like you by grounding it in school, city, cause, and real connection.',
    },
    {
      title: 'Shape the approach',
      description: 'Choose the message angle, channel, and strength level that gives you the best shot.',
    },
    {
      title: 'Use or log the script',
      description: 'Tighten the final draft, copy it, and push the touchpoint back into the CRM.',
    },
  ] as const

  const focusHistory = recommendedHistory || recommendedStructures[0] || null

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
      <PageHeader
        title={isFieldUser ? 'Intern Outreach Script Wizard' : 'Outreach Script Wizard'}
        description={isFieldUser
          ? 'Work business by business through a guided flow, reuse what already worked for you, and log every touchpoint cleanly.'
          : 'Generate highly specific local-business scripts through a guided flow and push each touchpoint straight back into the CRM.'}
        breadcrumb={isFieldUser
          ? [
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Outreach Scripts' },
            ]
          : [
              { label: 'CRM', href: '/crm/businesses' },
              { label: 'Outreach Scripts' },
            ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {isFieldUser && (
              <Link href="/dashboard">
                <Button variant="outline">
                  My Outreach Workspace <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="/crm/outreach">
              <Button variant="outline">
                View Outreach Timeline <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      <Card
        className="overflow-hidden border-0 shadow-panel"
        style={{ background: 'linear-gradient(135deg, rgba(255, 244, 214, 1) 0%, rgba(255, 232, 241, 1) 48%, rgba(234, 246, 214, 1) 100%)' }}
      >
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <Badge variant="outline" className="border-white/70 bg-white/60 text-surface-700">Intern Outreach Script Wizard</Badge>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-surface-900">
              A guided outreach flow that helps you sound more local, more credible, and more likely to get a real yes.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-surface-700">
              Pick the business, add your real connection, choose the strongest angle, then tighten the final script without losing your history or CRM logging.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-surface-700">
              <span className="rounded-full bg-white/70 px-3 py-1">Wizard-based</span>
              <span className="rounded-full bg-white/70 px-3 py-1">History-aware</span>
              <span className="rounded-full bg-white/70 px-3 py-1">CRM-connected</span>
              <span className="rounded-full bg-white/70 px-3 py-1">Built for conversion</span>
              {focusHistory && (
                <span className="rounded-full bg-white/70 px-3 py-1">Resume from your strongest recent structure</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Scripts Generated" value={stats.generated} icon={<Sparkles className="h-4 w-4" />} className="bg-white/70" />
            <StatCard label="Interested Replies" value={stats.interested} icon={<Send className="h-4 w-4" />} className="bg-white/70" />
            <StatCard label="Copied for Use" value={stats.copied} icon={<Copy className="h-4 w-4" />} className="bg-white/70" />
            <StatCard label="Follow-Ups Needed" value={stats.followUps} icon={<History className="h-4 w-4" />} className="bg-white/70" />
          </div>
        </CardContent>
      </Card>

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

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Wizard Progress</CardTitle>
              <CardDescription>Move through one decision at a time so the script is easier to build and easier to trust.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stepMeta.map((item, index) => (
                <StepCard
                  key={item.title}
                  index={index}
                  title={item.title}
                  description={item.description}
                  active={step === index}
                  complete={!!isStepComplete[index]}
                  onClick={() => setStep(index as 0 | 1 | 2 | 3)}
                />
              ))}

              {historyHint && (
                <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
                  {historyHint}
                </div>
              )}

              {focusHistory && (
                <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Quick resume</p>
                  <p className="mt-2 text-sm font-medium text-surface-900">
                    {humanizeKey(focusHistory.script_tier)} / {humanizeKey(focusHistory.channel)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-surface-500">
                    Pull in your strongest recent structure instead of starting from a blank page.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
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
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={goToPreviousStep} disabled={step === 0}>
                  Back
                </Button>
                <Button className="flex-1" onClick={goToNextStep} disabled={step === 3 || !isStepComplete[step]}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>

          {step === 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Find the business</CardTitle>
                  <CardDescription>Start with the CRM so the rest of the flow is grounded in the right context.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search business, category, area..."
                      className="pl-9"
                    />
                  </div>
                  <div className="grid gap-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-surface-500">Category</p>
                      <select
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                      >
                        <option value="all">All categories</option>
                        <option value="coffee_shop">Coffee Shop</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="gym_fitness">Gym / Fitness</option>
                        <option value="salon_barbershop">Salon / Barbershop</option>
                        <option value="family_entertainment">Family Entertainment</option>
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-surface-500">City</p>
                      <select
                        value={cityFilter}
                        onChange={(event) => setCityFilter(event.target.value)}
                        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                      >
                        <option value="all">All cities</option>
                        {cities.map((city) => (
                          <option key={city.id} value={city.id}>{city.name}, {city.state}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-surface-500">Onboarding Status</p>
                      <select
                        value={stageFilter}
                        onChange={(event) => setStageFilter(event.target.value)}
                        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                      >
                        <option value="all">All stages</option>
                        {Object.entries(ONBOARDING_STAGES).map(([value, def]) => (
                          <option key={value} value={value}>{def.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-surface-500">Cause / School Relationship</p>
                      <select
                        value={causeFilter}
                        onChange={(event) => setCauseFilter(event.target.value as 'all' | 'linked' | 'suggested' | 'none')}
                        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                      >
                        <option value="all">All relationship states</option>
                        <option value="linked">Explicitly linked</option>
                        <option value="suggested">Suggested from city</option>
                        <option value="none">No relationship yet</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-surface-500">
                    <span>{filteredBusinesses.length} available</span>
                    <span className="flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Filtered from CRM</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {filteredBusinesses.length === 0 ? (
                  <Card>
                    <CardContent className="py-10">
                      <EmptyState
                        icon={<Store className="h-8 w-8" />}
                        title="No matching businesses"
                        description="Adjust the filters or add more businesses in the CRM."
                      />
                    </CardContent>
                  </Card>
                ) : (
                  filteredBusinesses.map((business) => {
                    const isSelected = business.id === selectedBusinessId
                    const assignedPeople = businessAssignments[business.id] || []
                    return (
                      <button
                        key={business.id}
                        type="button"
                        onClick={() => handleSelectBusiness(business.id)}
                        className={cn(
                          'w-full rounded-card border text-left transition-all',
                          isSelected
                            ? 'border-brand-500 bg-brand-50/60 shadow-card-hover'
                            : 'border-surface-200 bg-surface-0 hover:border-surface-300 hover:shadow-card-hover'
                        )}
                      >
                        <div className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-surface-900">{business.name}</p>
                              <p className="mt-0.5 text-xs text-surface-500">{categoryLabel(business.category)}</p>
                            </div>
                            <Badge variant={STAGE_VARIANT[business.stage] || 'default'} dot>
                              {ONBOARDING_STAGES[business.stage]?.label || business.stage}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs text-surface-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {business.cityLabel}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {assignedPeople.length ? `${assignedPeople.length} assigned` : 'No assignee'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge variant={business.causeMode === 'linked' ? 'success' : business.causeMode === 'suggested' ? 'warning' : 'default'}>
                              {business.causeMode === 'linked' ? 'Cause Linked' : business.causeMode === 'suggested' ? 'Cause Suggested' : 'No Cause Link'}
                            </Badge>
                            {business.recentHistory && (
                              <Badge variant={SCRIPT_STATUS_VARIANT[business.recentHistory.status]}>
                                {OUTREACH_SCRIPT_STATUS_OPTIONS.find(option => option.value === business.recentHistory.status)?.label || business.recentHistory.status}
                              </Badge>
                            )}
                          </div>

                          {business.recentHistory && (
                            <div className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600">
                              Last script {relativeTime(business.recentHistory.created_at)} by {personLabel(business.recentHistory.created_by, profileMap, profile.id)}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </>
          ) : (
            <Card className="bg-surface-50">
              <CardContent className="grid gap-3 p-4">
                <div className="flex items-center justify-between text-xs text-surface-500">
                  <span>My outreach snapshot</span>
                  <span>{recentMine.length} recent scripts</span>
                </div>
                <StatCard label="My scripts" value={stats.generated} icon={<Sparkles className="h-4 w-4" />} />
                <StatCard label="Interested" value={stats.interested} icon={<Send className="h-4 w-4" />} />
                <StatCard label="Follow-ups" value={stats.followUps} icon={<History className="h-4 w-4" />} />
              </CardContent>
            </Card>
          )}
        </div>
        {!selectedBusiness || !generatedScript ? (
          <Card>
            <CardContent className="py-20">
              <EmptyState
                icon={<Sparkles className="h-8 w-8" />}
                title="Choose a business to start"
                description="Once you pick a business in step one, the wizard will guide you through local context, script angle, and final CRM logging."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-6">
                {step === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Business Snapshot</CardTitle>
                    <CardDescription>Confirm the business context first so the rest of the script feels true instead of generic.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-semibold text-surface-900">{selectedBusiness.name}</h2>
                          <Link href={`/crm/businesses/${selectedBusiness.id}`}>
                            <Button variant="ghost" size="icon-sm">
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
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
                            {OUTREACH_SCRIPT_STATUS_OPTIONS.find(option => option.value === selectedHistory[0].status)?.label || selectedHistory[0].status}
                          </Badge>
                        ) : (
                          <Badge variant="default">No script history yet</Badge>
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
                              Logging is paused for now so this business does not get double-contacted.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <SnapshotField icon={<MapPin className="h-4 w-4" />} label="Address / Area" value={selectedBusiness.address || selectedBusiness.cityLabel} />
                      <SnapshotField icon={<User className="h-4 w-4" />} label="Primary Contact" value={selectedContact ? `${selectedContact.first_name} ${selectedContact.last_name}`.trim() : personalization.owner_name || 'No owner name yet'} />
                      <SnapshotField icon={<FileText className="h-4 w-4" />} label="Average Spend" value={personalization.avg_ticket || 'Need an estimate'} />
                      <SnapshotField icon={<Store className="h-4 w-4" />} label="Products / Services" value={personalization.specific_product || 'Need a sharper product angle'} />
                      <SnapshotField icon={<GraduationCap className="h-4 w-4" />} label="Local Cause / School" value={personalization.local_cause_name || 'No linked cause yet'} />
                      <SnapshotField
                        icon={<Building2 className="h-4 w-4" />}
                        label="Assigned Stakeholder"
                        value={(businessAssignments[selectedBusiness.id] || [])
                          .map((id) => personLabel(id, profileMap, profile.id))
                          .join(', ') || 'No assignee visible'}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-surface-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Outreach Status</p>
                        <p className="mt-1 text-sm font-medium text-surface-800">
                          {selectedHistory[0]
                            ? `${OUTREACH_SCRIPT_STATUS_OPTIONS.find(option => option.value === selectedHistory[0].status)?.label || selectedHistory[0].status} by ${personLabel(selectedHistory[0].created_by, profileMap, profile.id)}`
                            : 'No logged script yet'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-surface-50 p-3">
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
                      <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Selected Contact Context</p>
                        <p className="mt-2 text-sm font-medium text-surface-900">
                          {`${selectedContact.first_name} ${selectedContact.last_name}`.trim()}
                          {selectedContact.title ? `, ${selectedContact.title}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-surface-500">
                          {[selectedContact.email, selectedContact.phone].filter(Boolean).join(' / ') || 'No direct email or phone saved yet.'}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
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

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Recent Notes</p>
                      {selectedNotes.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-surface-200 px-3 py-4 text-sm text-surface-500">
                          No shared notes are visible for this business yet.
                        </div>
                      ) : (
                        selectedNotes.map((note) => (
                          <div key={note.id} className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-3">
                            <p className="text-sm text-surface-700">{note.content}</p>
                            <p className="mt-2 text-xs text-surface-400">{relativeTime(note.created_at)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
                )}

                {step === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add Your Local Angle</CardTitle>
                    <CardDescription>Use real local context. Tighten the fields until the script sounds like something you would actually say out loud.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <InputBlock label="Intern Name">
                      <Input value={personalization.intern_name} onChange={(event) => setPersonalization((current) => ({ ...current, intern_name: event.target.value }))} />
                    </InputBlock>
                    <InputBlock label="City">
                      <Input value={personalization.city} onChange={(event) => setPersonalization((current) => ({ ...current, city: event.target.value }))} />
                    </InputBlock>
                    <InputBlock label="School Name">
                      <Input value={personalization.school_name} onChange={(event) => setPersonalization((current) => ({ ...current, school_name: event.target.value }))} />
                    </InputBlock>
                    <InputBlock label="Local Cause">
                      <Input value={personalization.local_cause_name} onChange={(event) => setPersonalization((current) => ({ ...current, local_cause_name: event.target.value }))} />
                    </InputBlock>
                    <InputBlock label="Owner Name Override">
                      <Input value={personalization.owner_name} onChange={(event) => setPersonalization((current) => ({ ...current, owner_name: event.target.value }))} />
                    </InputBlock>
                    <InputBlock label="Specific Product Override">
                      <Input value={personalization.specific_product} onChange={(event) => setPersonalization((current) => ({ ...current, specific_product: event.target.value }))} />
                    </InputBlock>
                    <InputBlock label="Average Spend Override">
                      <Input value={personalization.avg_ticket} onChange={(event) => setPersonalization((current) => ({ ...current, avg_ticket: event.target.value }))} />
                    </InputBlock>
                    <InputBlock label="Local Context">
                      <Input value={personalization.local_context} onChange={(event) => setPersonalization((current) => ({ ...current, local_context: event.target.value }))} placeholder="Neighborhood, district, school zone..." />
                    </InputBlock>
                    <InputBlock label="Personal Connection" className="md:col-span-2">
                      <Textarea
                        value={personalization.personal_connection}
                        onChange={(event) => setPersonalization((current) => ({ ...current, personal_connection: event.target.value }))}
                        placeholder="Example: I used to stop by after games, or I know families from my school already come here."
                        rows={4}
                      />
                    </InputBlock>
                  </CardContent>
                </Card>
                )}

                {step === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Choose the Angle</CardTitle>
                    <CardDescription>Choose the angle, quality level, and delivery mode that give you the best shot with this business.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <InputBlock label="Script Type">
                        <select
                          value={scriptType}
                          onChange={(event) => setScriptType(event.target.value)}
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
                          onChange={(event) => setChannel(event.target.value as OutreachScriptChannel)}
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

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-surface-400">Quality Tier</p>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {OUTREACH_SCRIPT_TIER_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setTier(option.value)}
                            className={cn(
                              'rounded-xl border p-4 text-left transition-colors',
                              tier === option.value
                                ? 'border-brand-500 bg-brand-50'
                                : 'border-surface-200 bg-surface-0 hover:border-surface-300'
                            )}
                          >
                            <p className="text-sm font-semibold text-surface-900">{option.label}</p>
                            <p className="mt-1 text-xs text-surface-500">{option.hint}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-surface-50 px-4 py-3 text-sm text-surface-700">
                      <span className="font-medium text-surface-900">Current frame:</span> {generatedScript.categoryLabel} using the {generatedScript.scriptTypeLabel} angle for a {OUTREACH_SCRIPT_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label.toLowerCase()}.
                    </div>

                    {categoryConfig && (
                      <div className="grid gap-3 md:grid-cols-2">
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
                  </CardContent>
                </Card>
                )}
              </div>

              <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
                {step >= 2 && (
                <Card className="overflow-hidden border-brand-100 shadow-panel">
                  <div className="border-b border-brand-100 bg-brand-50/60 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-brand-700">{step === 2 ? 'Preview Draft' : generatedScript.title}</p>
                        <p className="mt-1 text-xs text-surface-600">
                          {tier.charAt(0).toUpperCase() + tier.slice(1)} tier / {OUTREACH_SCRIPT_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label}
                        </p>
                      </div>
                      <Badge variant={step === 2 ? 'info' : SCRIPT_STATUS_VARIANT[status]}>
                        {step === 2 ? 'Preview' : OUTREACH_SCRIPT_STATUS_OPTIONS.find((option) => option.value === status)?.label}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    {generatedScript.subject && (
                      <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Subject</p>
                        <p className="mt-1 text-sm font-medium text-surface-800">{generatedScript.subject}</p>
                      </div>
                    )}

                    <Textarea
                      value={editorContent}
                      onChange={(event) => setEditorContent(event.target.value)}
                      rows={18}
                      className="min-h-[26rem] text-[15px] leading-7"
                      readOnly={step === 2}
                    />

                    {step === 3 ? (
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
                    ) : (
                      <div className="rounded-lg border border-dashed border-surface-200 px-4 py-3 text-xs leading-6 text-surface-500">
                        Preview the structure here first. If it feels right, continue to the final step to edit, copy, and log it.
                      </div>
                    )}

                    <div className="rounded-lg border border-dashed border-surface-200 px-4 py-3 text-xs leading-6 text-surface-500">
                      Edits are tracked against the generated draft so we can later report by city, category, script tier, stakeholder, and outreach channel.
                    </div>
                  </CardContent>
                </Card>
                )}

                {step === 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Outreach Logging</CardTitle>
                    <CardDescription>Choose the contact, mark the outcome, and send this touchpoint back into the CRM.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {logBlocked && recentRisk && (
                      <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
                        {personLabel(recentRisk.created_by, profileMap, profile.id)} logged outreach {relativeTime(recentRisk.created_at)}. Review that touchpoint before sending another.
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <InputBlock label="Contact">
                        <select
                          value={selectedContactId}
                          onChange={(event) => {
                            const nextId = event.target.value
                            setSelectedContactId(nextId)
                            const nextContact = selectedBusiness.contacts.find((contact) => contact.id === nextId) || null
                            if (nextContact) {
                              setPersonalization((current) => ({
                                ...current,
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
                          onChange={(event) => setStatus(event.target.value as OutreachScriptStatus)}
                          className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                        >
                          {OUTREACH_SCRIPT_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </InputBlock>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <InputBlock label="Next Step">
                        <Input
                          value={nextStep}
                          onChange={(event) => setNextStep(event.target.value)}
                          placeholder={status === 'follow_up_needed' ? `Follow up with ${selectedBusiness.name}` : 'Optional next action'}
                        />
                      </InputBlock>
                      <InputBlock label="Follow-Up Date">
                        <Input
                          type="datetime-local"
                          value={nextStepDate}
                          onChange={(event) => setNextStepDate(event.target.value)}
                        />
                      </InputBlock>
                    </div>

                    <InputBlock label="Logging Notes">
                      <Textarea
                        value={logNotes}
                        onChange={(event) => setLogNotes(event.target.value)}
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

                    <div className="rounded-lg border border-dashed border-surface-200 px-4 py-3 text-xs leading-6 text-surface-500">
                      Logging writes the generated draft, edited draft, contact, script tier, QR/material hooks, and outreach status back into the CRM. Follow-up status also creates a task for the current stakeholder.
                    </div>
                  </CardContent>
                </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>{step === 1 ? 'Use Your History' : step === 2 ? 'Useful Structures' : 'Script History'}</CardTitle>
                    <CardDescription>
                      {step === 1
                        ? 'Reuse a setup that already sounded like you, then adapt it for this business.'
                        : step === 2
                        ? 'Pull in a structure that already worked before you move to the final edit step.'
                        : 'Review what has already been used for this business and what you have recently touched yourself.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {step === 1 ? (
                      focusHistory ? (
                        <div className="space-y-3">
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
                      ) : (
                        <div className="rounded-lg border border-dashed border-surface-200 px-4 py-4 text-sm text-surface-500">
                          Once you have used the wizard on a few businesses, your strongest setups will show up here automatically.
                        </div>
                      )
                    ) : step === 2 ? (
                      recommendedStructures.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-surface-200 px-4 py-4 text-sm text-surface-500">
                          No similar-business patterns yet. Once you work a few more businesses, the wizard will recommend stronger structures automatically.
                        </div>
                      ) : (
                        <div className="space-y-3">
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
                      )
                    ) : historyLoading ? (
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
