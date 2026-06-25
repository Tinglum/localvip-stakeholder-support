'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
// Real-time refresh is implemented as polling against the QA backend below;
// no Supabase Realtime client is needed.
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  History,
  Image,
  Loader2,
  MessageSquare,
  QrCode,
  RefreshCw,
  Upload,
  Users,
  Wallet,
} from 'lucide-react'
import {
  InitialConnectionModal,
  OwnerConversationModal,
  MaterialsQrModal,
  LaunchDecisionModal,
} from '@/components/crm/business-lifecycle-modals'
import { useAuth } from '@/lib/auth/context'
import type { CrmBusinessLocalStateResponse } from '@/lib/crm-api'
import { resolveBusinessOffer } from '@/lib/offers'
import { EMPTY_UUID, asUuid } from '@/lib/uuid'
import { computeBusinessExecutionSteps, getBusinessNextActions, getTabForBusinessStepKey, type BusinessExecutionStepSummary } from '@/lib/business-execution'
import {
  useAdminTasks,
  useContacts,
  useGeneratedMaterials,
  useOfferInsert,
  useOffers,
  useOfferUpdate,
  useOnboardingFlows,
  useOnboardingSteps,
  useOutreach,
  useOutreachInsert,
  useProfiles,
  useQrCodes,
  useCities,
} from '@/lib/supabase/hooks'
import { formatDate, formatDateTime, slugify } from '@/lib/utils'
import { getBusinessJoinUrl } from '@/lib/business-join'
import { DealManager } from '@/components/crm/deal-manager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type {
  Business,
  Campaign,
  Cause,
  City,
  GeneratedMaterial,
  Offer,
  OutreachActivity,
  Profile,
  StakeholderCode,
} from '@/lib/types/database'

interface BusinessExecutionOverviewProps {
  biz: Business
  localBusinessId: string | null
  qaBusinessId?: number | null
  localState?: CrmBusinessLocalStateResponse | null
  city: City | null
  owner: Profile | null
  linkedCause: Cause | null
  campaign: Campaign | null
  updateBusiness: (id: string, changes: Partial<Business>) => Promise<Business | null>
  updateLoading: boolean
  refetchBusiness?: () => void
  refetchWorkspace?: () => void
  /** Switch the parent page's tab (activity, tasks, notes, qr, overview). */
  onNavigateTab?: (tab: string) => void
}

interface GenerationTemplateSummary {
  id: string
  name: string
  templateType: string
  outputFormat: string
  libraryFolder: string
}

function stepVariant(step: BusinessExecutionStepSummary) {
  if (step.state === 'completed') return 'success' as const
  if (step.state === 'active' && step.readyToComplete) return 'info' as const
  if (step.state === 'active') return 'warning' as const
  return 'default' as const
}

function statReady(value: boolean) {
  return value ? 'success' as const : 'warning' as const
}

export function BusinessExecutionOverview({
  biz,
  localBusinessId,
  qaBusinessId = null,
  localState,
  city,
  owner,
  linkedCause,
  campaign,
  updateBusiness,
  updateLoading,
  refetchBusiness,
  refetchWorkspace,
  onNavigateTab,
}: BusinessExecutionOverviewProps) {
  const { profile } = useAuth()
  const localProfileId = asUuid(profile.id)
  const queryBusinessId = qaBusinessId !== null ? String(qaBusinessId) : (localBusinessId || biz.id)
  const localStateEnabled = !localState
  const { data: hookProfiles } = useProfiles({ enabled: localStateEnabled })
  const { data: hookGeneratedMaterials, refetch: refetchGenerated } = useGeneratedMaterials({ stakeholder_id: EMPTY_UUID }, { enabled: localStateEnabled })
  const generatedMaterials = localState?.generatedMaterials ?? hookGeneratedMaterials
  const { data: hookAdminTasks, refetch: refetchAdminTasks } = useAdminTasks({ stakeholder_id: EMPTY_UUID }, { enabled: localStateEnabled })
  const adminTasks = localState?.adminTasks ?? hookAdminTasks
  // The backend-assigned referral code IS the join code in the stakeholder-free
  // QA model — it drives the join link + material generation. (Previously this was
  // hardcoded to null, which blanked the Materials & QR modal and disabled
  // "Generate materials".)
  const codes = React.useMemo(() => {
    const rc = (biz as { referral_code?: string | null } | null)?.referral_code || ''
    return rc ? ({ referral_code: rc, connection_code: rc } as unknown as StakeholderCode) : null
  }, [biz])
  const { data: hookFlows, refetch: refetchFlows } = useOnboardingFlows({ entity_type: 'business', entity_id: queryBusinessId }, { enabled: localStateEnabled })
  const flows = localState?.flows ?? hookFlows
  const flow = flows[0] || null
  const { data: hookSteps, refetch: refetchSteps } = useOnboardingSteps({ flow_id: flow?.id || EMPTY_UUID }, { enabled: localStateEnabled })
  const steps = localState?.steps ?? hookSteps
  const { data: hookOffers, refetch: refetchOffers } = useOffers({ business_id: queryBusinessId }, { enabled: localStateEnabled })
  const offers = localState?.offers ?? hookOffers
  const { data: hookContacts, refetch: refetchContacts } = useContacts({ business_id: queryBusinessId }, { enabled: localStateEnabled })
  const contacts = localState?.contacts ?? hookContacts
  const { data: hookQrCodes, refetch: refetchQrCodes } = useQrCodes({ business_id: queryBusinessId }, { enabled: localStateEnabled })
  const qrCodes = localState?.qrCodes ?? hookQrCodes
  const { data: hookOutreach, refetch: refetchOutreach } = useOutreach({ entity_type: 'business', entity_id: queryBusinessId }, { enabled: localStateEnabled })
  const outreach = localState?.outreach ?? hookOutreach
  const { insert: insertOutreach, loading: savingOutreach } = useOutreachInsert()
  const { insert: insertOffer } = useOfferInsert()
  const { update: updateOffer } = useOfferUpdate()

  const profiles = localState?.profiles ?? hookProfiles
  const profileMap = React.useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles])
  const task = adminTasks[0] || null
  const captureOffer = resolveBusinessOffer(biz, offers, 'capture')
  const cashbackOffer = resolveBusinessOffer(biz, offers, 'cashback')
  const generatedCount = generatedMaterials.filter((item) => item.generation_status === 'generated' && !!item.generated_file_url).length
  const generationState = generatedCount > 0
    ? 'generated'
    : task?.status || 'idle'
  const joinedCount = contacts.filter((item) => item.list_status === 'joined' || !!item.joined_at).length
  const executionSteps = computeBusinessExecutionSteps({
    business: biz,
    steps,
    codes,
    generatedMaterials,
    qrCodes,
    offers,
    outreachCount: outreach.length,
  })
  const nextActions = getBusinessNextActions({
    business: biz,
    steps: executionSteps,
    codes,
    generatedMaterials,
    qrCodes,
    offers,
    joinedCount,
    openTaskCount: 0,
  })

  const [importPasteValue, setImportPasteValue] = React.useState('')
  const [importError, setImportError] = React.useState<string | null>(null)
  const [engineMessage, setEngineMessage] = React.useState<string | null>(null)
  const [engineError, setEngineError] = React.useState<string | null>(null)
  const [engineBusy, setEngineBusy] = React.useState<'codes' | 'generate' | null>(null)
  const [stepBusyId, setStepBusyId] = React.useState<string | null>(null)
  const [captureHeadline, setCaptureHeadline] = React.useState(captureOffer.headline || '')
  const [captureDescription, setCaptureDescription] = React.useState(captureOffer.description || '')
  const [captureValue, setCaptureValue] = React.useState(captureOffer.value_label || '')
  // Offer timeline (date-only YYYY-MM-DD for the <input type="date">). Maps to the
  // backend StartDate/EndDate via toBackendShape (starts_at/ends_at).
  const [captureStartsAt, setCaptureStartsAt] = React.useState((captureOffer.starts_at || '').slice(0, 10))
  const [captureEndsAt, setCaptureEndsAt] = React.useState((captureOffer.ends_at || '').slice(0, 10))
  const [cashbackPercent, setCashbackPercent] = React.useState(cashbackOffer.cashback_percent || 10)
  const [offerMessage, setOfferMessage] = React.useState<string | null>(null)
  const [offerError, setOfferError] = React.useState<string | null>(null)
  const [offerSaving, setOfferSaving] = React.useState(false)
  const [outreachSubject, setOutreachSubject] = React.useState('')
  const [outreachBody, setOutreachBody] = React.useState('')
  const [outreachOutcome, setOutreachOutcome] = React.useState('')
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<'materials' | 'offers' | 'deal' | 'outreach' | 'branding'>('materials')
  const [lifecycleModal, setLifecycleModal] = React.useState<'initial_connection' | 'owner_conversation' | 'materials_qr' | 'launch_decision' | null>(null)
  const { data: hookCities } = useCities({ enabled: localStateEnabled })
  const allCities = localState?.cities ?? hookCities
  const [showArchive, setShowArchive] = React.useState(false)
  const [regenBusy, setRegenBusy] = React.useState(false)
  const [regenMessage, setRegenMessage] = React.useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = React.useState<'logo' | 'cover' | null>(null)
  const [uploadMessage, setUploadMessage] = React.useState<string | null>(null)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const workspaceBusiness = localState?.business ?? biz
  const [brandingLogoUrl, setBrandingLogoUrl] = React.useState(workspaceBusiness.logo_url || '')
  const [brandingCoverPhotoUrl, setBrandingCoverPhotoUrl] = React.useState(workspaceBusiness.cover_photo_url || '')
  const logoInputRef = React.useRef<HTMLInputElement>(null)
  const coverInputRef = React.useRef<HTMLInputElement>(null)
  const writeBusinessId = localBusinessId || queryBusinessId

  const qaBranchReferralUrl = (workspaceBusiness as { branch_referral_url?: string | null }).branch_referral_url || ''

  React.useEffect(() => {
    setCaptureHeadline(captureOffer.headline || '')
    setCaptureDescription(captureOffer.description || '')
    setCaptureValue(captureOffer.value_label || '')
    setCaptureStartsAt((captureOffer.starts_at || '').slice(0, 10))
    setCaptureEndsAt((captureOffer.ends_at || '').slice(0, 10))
    setCashbackPercent(cashbackOffer.cashback_percent || 10)
  }, [captureOffer.description, captureOffer.headline, captureOffer.value_label, captureOffer.starts_at, captureOffer.ends_at, cashbackOffer.cashback_percent])

  React.useEffect(() => {
    setBrandingLogoUrl(workspaceBusiness.logo_url || '')
    setBrandingCoverPhotoUrl(workspaceBusiness.cover_photo_url || '')
  }, [workspaceBusiness.cover_photo_url, workspaceBusiness.logo_url])

  const referralCode = (workspaceBusiness as { referral_code?: string | null }).referral_code || ''

  // The "Join LocalVIP as a node" referral link. Prefer the backend-stored Branch
  // link; otherwise build the consumer-app signup link from the referral code
  // (the Branch link is often empty / not yet generated for a business).
  const joinLocalVipLink = qaBranchReferralUrl
    || (referralCode
      ? `${(process.env.NEXT_PUBLIC_WEBAPP_URL || 'https://my.localvip.com').replace(/\/$/, '')}/auth/signup?ref=${encodeURIComponent(referralCode)}`
      : '')

  async function copyToClipboard(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(message)
    } catch {
      toast.error('Could not copy to clipboard.')
    }
  }

  const joinUrl = React.useMemo(() => {
    // The shareable join link is our own "100-list" page (shows the offer + join
    // form), keyed by the business id in the slug. Fall back to the Branch link.
    const id = String(workspaceBusiness.external_id || queryBusinessId || '').trim()
    const name = workspaceBusiness.name || 'business'
    if (id) return getBusinessJoinUrl(slugify(`${name}-${id}`))
    return qaBranchReferralUrl || ''
  }, [workspaceBusiness.external_id, workspaceBusiness.name, queryBusinessId, qaBranchReferralUrl])

  /** Stub: no longer imports from stakeholder codes */
  async function handleImportFromLink() {
    // Stakeholder references removed for QA backend compliance
  }

  async function refetchExecution(options?: { includeBusiness?: boolean }) {
    refetchWorkspace?.()
    if (options?.includeBusiness) {
      refetchBusiness?.()
    }
    if (!localState) {
      refetchGenerated({ silent: true })
      refetchAdminTasks({ silent: true })
      refetchFlows({ silent: true })
      refetchSteps({ silent: true })
      refetchOffers({ silent: true })
      refetchContacts({ silent: true })
      refetchQrCodes({ silent: true })
      refetchOutreach({ silent: true })
    }
  }

  async function callExecutionAction(payload: Record<string, unknown>) {
    if (!writeBusinessId) {
      throw new Error('Could not resolve this business record.')
    }

    const response = await fetch(`/api/crm/businesses/${writeBusinessId}/execution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const contentType = response.headers.get('content-type') || ''
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : { error: await response.text().catch(() => 'The business action could not be completed.') }
    if (!response.ok) throw new Error(body.error || 'The business action could not be completed.')
    return body
  }

  async function callMaterialsAction(payload: Record<string, unknown>) {
    if (!writeBusinessId) {
      throw new Error('Could not resolve this business record.')
    }

    const response = await fetch(`/api/crm/businesses/${writeBusinessId}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const contentType = response.headers.get('content-type') || ''
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : { error: await response.text().catch(() => 'The material action could not be completed.') }
    if (!response.ok) throw new Error(body.error || 'The material action could not be completed.')
    return body
  }

  async function listGenerationTemplates() {
    const body = await callMaterialsAction({ action: 'list_generation_templates' })
    if (!Array.isArray(body?.templates)) {
      return [] as GenerationTemplateSummary[]
    }
    return body.templates as GenerationTemplateSummary[]
  }


  /**
   * Fire all materials generation as a single background request.
   * Returns quickly after the request is dispatched — the server processes
   * templates one-by-one and saves each to generated_materials immediately,
   * which triggers the real-time subscription above.
   * keepalive: true keeps the request alive even if the user navigates away.
   */
  async function fireGenerationBackground(
    setStatus: (msg: string | null) => void,
    setError: (msg: string | null) => void,
  ) {
    if (!writeBusinessId) {
      setError('Could not resolve this business record.')
      return
    }

    let count: number | null = null
    try {
      const templates = await listGenerationTemplates()
      count = templates.length
      if (count === 0) {
        setStatus('No active auto-generation templates were found.')
        return
      }
    } catch {
      // Proceed — server will look up templates itself
    }

    const label = count !== null ? `${count} file${count !== 1 ? 's' : ''}` : 'files'
    setStatus(`Generating ${label} in the background…`)

    // Fire and forget — keepalive keeps it alive through navigation
    fetch(`/api/crm/businesses/${writeBusinessId}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_materials' }),
      keepalive: true,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Generation failed.')
        setStatus(null)
      } else {
        setStatus(`${label} generated.`)
      }
      refetchGenerated({ silent: true })
    }).catch(() => {
      // User navigated away — Topbar real-time subscription handles notifications
    })
  }

  async function handleSaveCodes() {
    // Stakeholder codes removed for QA backend compliance
  }

  async function handleGenerateMaterials() {
    setEngineBusy('generate')
    setEngineMessage(null)
    setEngineError(null)
    await fireGenerationBackground(setEngineMessage, setEngineError)
    setEngineBusy(null)
  }

  async function handleCompleteStep(stepId: string) {
    setStepBusyId(stepId)
    setEngineMessage(null)
    setEngineError(null)
    try {
      await callExecutionAction({ action: 'complete_step', stepId })
      setEngineMessage('Step completed.')
      await refetchExecution()
    } catch (error) {
      setEngineError(error instanceof Error ? error.message : 'Step could not be completed.')
    } finally {
      setStepBusyId(null)
    }
  }

  async function handleSaveOffers() {
    setOfferSaving(true)
    setOfferMessage(null)
    setOfferError(null)
    try {
      const capturePayload: Partial<Offer> = {
        business_id: queryBusinessId,
        offer_type: 'capture',
        status: captureHeadline.trim() ? 'active' : 'draft',
        headline: captureHeadline.trim() || 'Join our list and get access to exclusive offers',
        description: captureDescription.trim() || 'This offer is only used to collect your first 100 customers before you go live.',
        value_type: 'label',
        value_label: captureValue.trim() || null,
        cashback_percent: null,
        starts_at: captureStartsAt ? new Date(`${captureStartsAt}T00:00:00Z`).toISOString() : null,
        ends_at: captureEndsAt ? new Date(`${captureEndsAt}T23:59:59Z`).toISOString() : null,
        metadata: { source: 'crm_business_execution' },
      }

      const cashbackPayload: Partial<Offer> = {
        business_id: queryBusinessId,
        offer_type: 'cashback',
        status: 'active',
        headline: 'Standard LocalVIP Cashback',
        description: 'This is the percentage customers receive back when they shop with you through LocalVIP.',
        value_type: 'cashback_percent',
        value_label: `${cashbackPercent}% cashback`,
        cashback_percent: cashbackPercent,
        starts_at: null,
        ends_at: null,
        metadata: { source: 'crm_business_execution' },
      }

      if (captureOffer.id) await updateOffer(captureOffer.id, capturePayload)
      else await insertOffer(capturePayload)
      if (cashbackOffer.id) await updateOffer(cashbackOffer.id, cashbackPayload)
      else await insertOffer(cashbackPayload)

      await refetchExecution()
      setOfferMessage('Offer settings saved.')
    } catch (error) {
      setOfferError(error instanceof Error ? error.message : 'Offer settings could not be saved.')
    } finally {
      setOfferSaving(false)
    }
  }

  async function handleLogOutreach() {
    if (!outreachBody.trim()) return
    await insertOutreach({
      entity_type: 'business',
      entity_id: queryBusinessId,
      type: 'other',
      performed_by: localProfileId || undefined,
      subject: outreachSubject || null,
      body: outreachBody,
      outcome: outreachOutcome || null,
    })
    setOutreachSubject('')
    setOutreachBody('')
    setOutreachOutcome('')
    refetchOutreach({ silent: true })
  }

  async function handleRegenerateAll() {
    setRegenBusy(true)
    setRegenMessage(null)
    try {
      await fireGenerationBackground(setRegenMessage, setEngineError)
    } catch (error) {
      setRegenMessage(error instanceof Error ? error.message : 'Regeneration failed.')
    } finally {
      setRegenBusy(false)
    }
  }

  async function handleRestoreVersion(generatedMaterialId: string) {
    try {
      await callMaterialsAction({ action: 'restore_version', generatedMaterialId })
      await refetchExecution()
    } catch {
      // silent
    }
  }

  async function handleUploadMedia(mediaType: 'logo' | 'cover_photo', file: File) {
    setUploadBusy(mediaType === 'logo' ? 'logo' : 'cover')
    setUploadMessage(null)
    setUploadError(null)
    try {
      if (!writeBusinessId) {
        throw new Error('Could not resolve this business record.')
      }
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mediaType', mediaType)
      const response = await fetch(`/api/crm/businesses/${writeBusinessId}/media`, {
        method: 'POST',
        body: formData,
      })
      const contentType = response.headers.get('content-type') || ''
      const body = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : { error: await response.text().catch(() => 'Upload failed.') }
      if (!response.ok) throw new Error(body.error || `Upload failed with ${response.status}.`)
      const uploadedUrl = typeof body.fileUrl === 'string' ? body.fileUrl : ''
      if (mediaType === 'logo') {
        setBrandingLogoUrl(uploadedUrl)
      } else {
        setBrandingCoverPhotoUrl(uploadedUrl)
      }
      refetchWorkspace?.()
      const label = mediaType === 'logo' ? 'Logo' : 'Cover photo'
      setUploadMessage(`${label} uploaded.`)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setUploadBusy(null)
    }
  }

  /** Map any lifecycle / next-action tab key to the right scroll target. */
  function navigateToArea(tab: string) {
    const workspaceTabs = ['materials', 'offers', 'deal', 'outreach', 'branding']
    const parentTabs = ['activity', 'tasks', 'notes', 'qr']

    // 'codes' maps to the materials workspace tab
    const resolved = tab === 'codes' ? 'materials' : tab

    if (workspaceTabs.includes(resolved)) {
      setActiveWorkspaceTab(resolved as 'materials' | 'offers' | 'deal' | 'outreach' | 'branding')
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          document.getElementById('business-workspace-tabs')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        })
      }
    } else if (parentTabs.includes(resolved)) {
      // Switch the parent page tab and scroll to the tab bar
      onNavigateTab?.(resolved)
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          document.getElementById('business-page-tabs')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        })
      }
    } else if (resolved === 'overview') {
      // Scroll to the business info cards at the top of the page
      onNavigateTab?.('overview')
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          document.getElementById('business-info-cards')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        })
      }
    }
  }

  /** Convenience: open a workspace tab (backwards compat for internal callers). */
  function openWorkspaceTab(tab: 'materials' | 'offers' | 'deal' | 'outreach' | 'branding') {
    navigateToArea(tab)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="order-2 grid gap-4 lg:grid-cols-4">
        <StatusCard label="Onboarding" value={`${executionSteps.filter((item) => item.state === 'completed').length}/${executionSteps.length}`} ready={executionSteps.every((item) => item.state === 'completed')} />
        <StatusCard label="QR status" value={qrCodes.length > 0 ? 'Ready' : 'Missing'} ready={qrCodes.length > 0} />
        <StatusCard label="100-list" value={`${joinedCount} / 100`} ready={joinedCount >= 100} />
        <StatusCard label="Cashback" value={`${cashbackPercent}%`} ready={cashbackPercent >= 5 && cashbackPercent <= 25} />
      </div>

      {/* Main dashboard: the LocalVIP network referral — distinct from the
          100-list customer link (which lives in the Offers / 100-list view). */}
      <Card className="order-2">
        <CardHeader>
          <CardTitle>Grow the LocalVIP network</CardTitle>
          <p className="text-sm text-surface-500">
            Share this to invite friends, causes, and other businesses to join LocalVIP under this
            business as a node. This is <span className="font-medium">not</span> the customer 100-list link —
            that lives in the 100-list offer view.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Referral code</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded border border-surface-200 bg-surface-50 px-2 py-1 text-sm font-semibold text-surface-900">
                {referralCode || '—'}
              </code>
              {referralCode ? (
                <Button size="sm" variant="ghost" onClick={() => void copyToClipboard(referralCode, 'Referral code copied')}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              ) : null}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Join LocalVIP link</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded border border-surface-200 bg-surface-50 px-2 py-1 text-xs text-surface-700">
                {joinLocalVipLink || '—'}
              </code>
              {joinLocalVipLink ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => void copyToClipboard(joinLocalVipLink, 'LocalVIP join link copied')}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={joinLocalVipLink} target="_blank"><ExternalLink className="h-3.5 w-3.5" /></Link>
                  </Button>
                </>
              ) : null}
            </div>
            {!joinLocalVipLink ? (
              <p className="mt-1 text-[11px] text-surface-400">No referral code yet — assigned by the backend.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="order-3 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Business lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {executionSteps.map((item) => (
              <button
                key={item.step.id}
                type="button"
                onClick={() => item.state !== 'locked' && setLifecycleModal(item.key)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  item.state === 'locked'
                    ? 'border-surface-200 bg-surface-50 opacity-60 cursor-default'
                    : 'border-surface-200 bg-surface-50 hover:border-brand-200 hover:bg-brand-50/30 cursor-pointer'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={stepVariant(item)}>{item.state}</Badge>
                      <p className="font-semibold text-surface-900">{item.label}</p>
                    </div>
                    {item.description ? <p className="text-sm text-surface-600">{item.description}</p> : null}
                    {item.step.completed_at ? (
                      <p className="text-xs text-surface-500">
                        Completed {formatDateTime(item.step.completed_at)}
                        {item.step.completed_by ? ` by ${profileMap.get(item.step.completed_by)?.full_name || 'a team member'}` : ''}
                      </p>
                    ) : item.blocker ? (
                      <p className="text-xs text-warning-700">
                        {item.blocker} →
                      </p>
                    ) : (
                      <p className="text-xs text-surface-500">Ready for the next action.</p>
                    )}
                  </div>
                  {item.state === 'active' ? (
                    item.readyToComplete ? (
                      <Badge variant="success">Ready to complete</Badge>
                    ) : (
                      <Badge variant="info">Open →</Badge>
                    )
                  ) : null}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 text-sm text-surface-600">
              <p><span className="font-semibold text-surface-900">Owner:</span> {owner?.full_name || 'Unassigned'}</p>
              <p><span className="font-semibold text-surface-900">City:</span> {city ? `${city.name}, ${city.state}` : 'No city linked'}</p>
              <p><span className="font-semibold text-surface-900">Cause:</span> {linkedCause?.name || 'No cause linked'}</p>
              <p><span className="font-semibold text-surface-900">Campaign:</span> {campaign?.name || 'No campaign linked'}</p>
            </div>
            {nextActions.length > 0 ? nextActions.map((action) => (
              <button
                key={action.text}
                type="button"
                onClick={() => {
                  const modalMap: Record<string, typeof lifecycleModal> = {
                    overview: 'initial_connection',
                    outreach: 'owner_conversation',
                    codes: 'materials_qr',
                    materials: 'materials_qr',
                    offers: 'launch_decision',
                  }
                  const modal = modalMap[action.tab]
                  if (modal) setLifecycleModal(modal)
                  else navigateToArea(action.tab)
                }}
                className="flex w-full items-start gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer group"
              >
                <span className="text-sm text-surface-700 group-hover:text-brand-700 flex-1">{action.text}</span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-surface-300 group-hover:text-brand-500 transition-colors" />
              </button>
            )) : (
              <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
                This business has no immediate blockers.
              </div>
            )}
            {task ? (
              <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Material setup task</p>
                <p className="mt-1 text-sm font-semibold text-surface-900">{task.title}</p>
                <Badge variant={generationState === 'generated' ? 'success' : generationState === 'failed' ? 'danger' : 'warning'} className="mt-2">
                  {generationState}
                </Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card id="business-workspace-tabs" className="order-1">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Business workspace</CardTitle>
            <p className="text-sm text-surface-500">Use these tabs to manage materials, offers, and outreach without crowding the main record.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <WorkspaceTabButton
              active={activeWorkspaceTab === 'materials'}
              label="Codes + Materials"
              meta={`${generatedCount} generated`}
              onClick={() => setActiveWorkspaceTab('materials')}
            />
            <WorkspaceTabButton
              active={activeWorkspaceTab === 'offers'}
              label="Offer"
              meta="100-list capture"
              onClick={() => setActiveWorkspaceTab('offers')}
            />
            <WorkspaceTabButton
              active={activeWorkspaceTab === 'deal'}
              label="Deal"
              meta="LocalVIP cashback"
              onClick={() => setActiveWorkspaceTab('deal')}
            />
            <WorkspaceTabButton
              active={activeWorkspaceTab === 'outreach'}
              label="Outreach Log"
              meta={`${outreach.length} logged`}
              onClick={() => setActiveWorkspaceTab('outreach')}
            />
            <WorkspaceTabButton
              active={activeWorkspaceTab === 'branding'}
              label="Branding"
              meta={brandingLogoUrl ? 'Logo set' : 'Needs logo'}
              onClick={() => setActiveWorkspaceTab('branding')}
            />
          </div>
        </CardHeader>
        <CardContent>
          {activeWorkspaceTab === 'materials' ? (
            <div id="material-engine" className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Codes and material engine</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniStatus label="Generation" value={generationState} />
                    <MiniStatus label="Generated files" value={`${generatedCount}`} />
                    <MiniStatus label="QR linked" value={qrCodes.length > 0 ? 'Yes' : 'No'} />
                  </div>
                  {engineError ? <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{engineError}</div> : null}
                  {engineMessage ? <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{engineMessage}</div> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void handleGenerateMaterials()} disabled={engineBusy !== null}>
                      {engineBusy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      Generate materials
                    </Button>
                    <Button variant="outline" onClick={() => void handleRegenerateAll()} disabled={regenBusy || engineBusy !== null}>
                      {regenBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Regenerate all
                    </Button>
                  </div>
                  {regenMessage ? (
                    <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">{regenMessage}</div>
                  ) : null}
                  {!brandingLogoUrl ? (
                    <div className="flex items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Upload a logo to embed it in QR codes and materials.</span>
                      <Button size="sm" variant="outline" onClick={() => setActiveWorkspaceTab('branding')}>Upload logo</Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle>{showArchive ? 'Archive' : 'Generated materials'}</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setShowArchive(!showArchive)}>
                    {showArchive ? <FileText className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    {showArchive ? 'Active' : 'Archive'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    const filtered = generatedMaterials.filter((item: GeneratedMaterial) =>
                      showArchive ? (item.is_active === false || item.is_outdated) : (item.is_active !== false && !item.is_outdated)
                    )
                    if (filtered.length === 0) {
                      return (
                        <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-surface-500">
                          {showArchive ? 'No archived versions.' : 'Materials will appear here as soon as generation runs.'}
                        </div>
                      )
                    }
                    return filtered.map((item: GeneratedMaterial) => (
                      <div key={item.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-900">{item.generated_file_name || 'Generated asset'}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <p className="text-xs text-surface-500">{(item.library_folder || '').replace(/_/g, ' ')}</p>
                              {item.version_number > 1 ? (
                                <Badge variant="outline">v{item.version_number}</Badge>
                              ) : null}
                            </div>
                          </div>
                          <Badge variant={item.generation_status === 'generated' ? 'success' : 'danger'}>
                            {item.generation_status}
                          </Badge>
                        </div>
                        {item.generation_error ? <p className="mt-2 text-xs text-danger-600">{item.generation_error}</p> : null}
                        <div className="mt-3 flex items-center gap-3">
                          {item.generated_file_url ? (
                            <Link href={item.generated_file_url} target="_blank" className="text-sm font-medium text-brand-700 hover:underline">
                              Open file
                            </Link>
                          ) : null}
                          {showArchive && item.generated_file_url ? (
                            <button
                              type="button"
                              onClick={() => void handleRestoreVersion(item.id)}
                              className="flex items-center gap-1 text-sm font-medium text-surface-600 hover:text-surface-900"
                            >
                              <History className="h-3.5 w-3.5" />
                              Restore
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  })()}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeWorkspaceTab === 'offers' ? (
            <div id="offers">
              <Card>
                <CardHeader>
                  <CardTitle>Offer</CardTitle>
                  <p className="text-sm text-surface-500">
                    The 100-list capture offer — used to get customers registered on this business&apos;s list.
                    This is <span className="font-medium">not</span> the LocalVIP deal (cashback) — that&apos;s on the <span className="font-medium">Deal</span> tab.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">Headline</label>
                    <Input value={captureHeadline} onChange={(event) => setCaptureHeadline(event.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
                    <Textarea value={captureDescription} onChange={(event) => setCaptureDescription(event.target.value)} rows={4} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">Value label</label>
                    <Input value={captureValue} onChange={(event) => setCaptureValue(event.target.value)} />
                  </div>
                  {/* Offer timeline — when the offer runs. Persists to the backend
                      StartDate/EndDate, same as the backend offer editor. */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Starts</label>
                      <Input type="date" value={captureStartsAt} onChange={(event) => setCaptureStartsAt(event.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Ends</label>
                      <Input type="date" value={captureEndsAt} max={undefined} min={captureStartsAt || undefined} onChange={(event) => setCaptureEndsAt(event.target.value)} />
                    </div>
                  </div>
                  <p className="text-[11px] text-surface-400">Optional — leave both blank for an always-on offer.</p>
                  {/* The 100-list customer join link lives here in the 100-list
                      view — separate from the LocalVIP network link on the dashboard. */}
                  <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-surface-500">100-list join link</p>
                    <p className="text-[11px] text-surface-400">Customers scan/visit this to join the list and claim the offer above.</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 truncate rounded border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700">
                        {joinUrl || '—'}
                      </code>
                      {joinUrl ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => void copyToClipboard(joinUrl, '100-list join link copied')}>
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={joinUrl} target="_blank"><ExternalLink className="h-3.5 w-3.5" /></Link>
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {offerError ? <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{offerError}</div> : null}
                  {offerMessage ? <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{offerMessage}</div> : null}
                  <Button onClick={() => void handleSaveOffers()} disabled={offerSaving || updateLoading}>
                    {offerSaving || updateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Save offer
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeWorkspaceTab === 'deal' ? (
            <div id="deal">
              <DealManager businessAccountId={String(queryBusinessId)} />
            </div>
          ) : null}

          {activeWorkspaceTab === 'branding' ? (
            <div id="branding" className="grid gap-6 xl:grid-cols-[1fr,0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Business branding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-surface-700">Logo</label>
                    <p className="mb-3 text-xs text-surface-500">Used in QR codes, generated materials, and listing previews.</p>
                    {brandingLogoUrl ? (
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-2xl border border-surface-200 bg-surface-50">
                          <img src={brandingLogoUrl} alt="Logo" className="h-full w-full object-contain" />
                        </div>
                        <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploadBusy !== null}>
                          {uploadBusy === 'logo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                          Replace
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadBusy !== null}
                        className="flex h-32 w-full items-center justify-center rounded-2xl border-2 border-dashed border-surface-300 bg-surface-50 text-surface-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
                      >
                        {uploadBusy === 'logo' ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-6 w-6" />
                            <span className="text-sm font-medium">Upload logo</span>
                          </div>
                        )}
                      </button>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleUploadMedia('logo', file)
                        e.target.value = ''
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-surface-700">Cover photo</label>
                    <p className="mb-3 text-xs text-surface-500">Used in listing previews and applicable materials.</p>
                    {brandingCoverPhotoUrl ? (
                      <div className="space-y-3">
                        <div className="h-40 w-full overflow-hidden rounded-2xl border border-surface-200 bg-surface-50">
                          <img src={brandingCoverPhotoUrl} alt="Cover" className="h-full w-full object-cover" />
                        </div>
                        <Button size="sm" variant="outline" onClick={() => coverInputRef.current?.click()} disabled={uploadBusy !== null}>
                          {uploadBusy === 'cover' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                          Replace
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadBusy !== null}
                        className="flex h-32 w-full items-center justify-center rounded-2xl border-2 border-dashed border-surface-300 bg-surface-50 text-surface-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
                      >
                        {uploadBusy === 'cover' ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                          <div className="flex flex-col items-center gap-2">
                            <Image className="h-6 w-6" />
                            <span className="text-sm font-medium">Upload cover photo</span>
                          </div>
                        )}
                      </button>
                    )}
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleUploadMedia('cover_photo', file)
                        e.target.value = ''
                      }}
                    />
                  </div>

                  {uploadError ? (
                    <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{uploadError}</div>
                  ) : null}
                  {uploadMessage ? (
                    <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{uploadMessage}</div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Listing preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
                    {brandingCoverPhotoUrl ? (
                      <div className="h-36 w-full overflow-hidden bg-surface-100">
                        <img src={brandingCoverPhotoUrl} alt="Cover" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50">
                        <p className="text-sm text-brand-400">No cover photo</p>
                      </div>
                    )}
                    <div className="relative px-4 pb-4">
                      <div className="-mt-8 mb-3 flex items-end gap-3">
                        {brandingLogoUrl ? (
                          <div className="h-16 w-16 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-sm">
                            <img src={brandingLogoUrl} alt="Logo" className="h-full w-full object-contain" />
                          </div>
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-surface-100 shadow-sm">
                            <span className="text-lg font-bold text-surface-400">{biz.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-lg font-semibold text-surface-900">{biz.name}</p>
                      {biz.category ? <p className="mt-1 text-sm text-surface-500">{biz.category}</p> : null}
                      {city ? <p className="mt-0.5 text-xs text-surface-400">{city.name}, {city.state}</p> : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeWorkspaceTab === 'outreach' ? (
            <Card id="outreach">
              <CardHeader>
                <CardTitle>Outreach log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Input value={outreachSubject} onChange={(event) => setOutreachSubject(event.target.value)} placeholder="Subject" />
                  <Input value={outreachOutcome} onChange={(event) => setOutreachOutcome(event.target.value)} placeholder="Outcome" />
                  <div className="flex gap-2">
                    <Button className="w-full" onClick={() => void handleLogOutreach()} disabled={savingOutreach || !outreachBody.trim()}>
                      {savingOutreach ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                      Log outreach
                    </Button>
                  </div>
                </div>
                <Textarea value={outreachBody} onChange={(event) => setOutreachBody(event.target.value)} rows={3} placeholder="What happened in the last conversation, message, or visit?" />
                <div className="space-y-3">
                  {outreach.length === 0 ? (
                    <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-6 text-sm text-surface-500">
                      No outreach has been logged yet.
                    </div>
                  ) : (
                    outreach.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-surface-900">{item.subject || (item.type || '').replace(/_/g, ' ')}</p>
                          <p className="text-xs text-surface-500">{formatDateTime(item.created_at)}</p>
                        </div>
                        <p className="mt-2 text-sm text-surface-600">{item.body}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.outcome ? <Badge variant="info">{item.outcome}</Badge> : null}
                          <Badge variant="outline">{profileMap.get(item.performed_by)?.full_name || 'Team member'}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Lifecycle Modals ── */}
      <InitialConnectionModal
        open={lifecycleModal === 'initial_connection'}
        onOpenChange={(open) => !open && setLifecycleModal(null)}
        biz={biz}
        city={city}
        linkedCause={linkedCause}
        helperCount={0}
        cities={allCities}
        saving={updateLoading}
        blocker={executionSteps.find((s) => s.key === 'initial_connection')?.blocker ?? null}
        readyToComplete={executionSteps.find((s) => s.key === 'initial_connection')?.readyToComplete ?? false}
        onSave={async (changes) => {
          if (writeBusinessId) {
            await updateBusiness(writeBusinessId, changes)
            refetchExecution({ includeBusiness: true })
          }
        }}
        onCompleteStep={() => {
          const step = executionSteps.find((s) => s.key === 'initial_connection')
          if (step) void handleCompleteStep(step.step.id)
          setLifecycleModal(null)
        }}
      />

      <OwnerConversationModal
        open={lifecycleModal === 'owner_conversation'}
        onOpenChange={(open) => !open && setLifecycleModal(null)}
        outreach={outreach}
        profileMap={profileMap}
        saving={savingOutreach}
        blocker={executionSteps.find((s) => s.key === 'owner_conversation')?.blocker ?? null}
        readyToComplete={executionSteps.find((s) => s.key === 'owner_conversation')?.readyToComplete ?? false}
        onLogOutreach={async ({ type, subject, body, outcome, nextStep, nextStepDate }) => {
          await insertOutreach({
            entity_type: 'business',
            entity_id: queryBusinessId,
            type: type as OutreachActivity['type'],
            performed_by: localProfileId || undefined,
            subject: subject || null,
            body,
            outcome: outcome || null,
            next_step: nextStep || null,
            next_step_date: nextStepDate || null,
          })
          refetchOutreach({ silent: true })
        }}
        onCompleteStep={() => {
          const step = executionSteps.find((s) => s.key === 'owner_conversation')
          if (step) void handleCompleteStep(step.step.id)
          setLifecycleModal(null)
        }}
      />

      <MaterialsQrModal
        open={lifecycleModal === 'materials_qr'}
        onOpenChange={(open) => !open && setLifecycleModal(null)}
        codes={codes}
        generatedMaterials={generatedMaterials}
        qrCodes={qrCodes}
        joinUrl={joinUrl}
        engineBusy={engineBusy}
        regenBusy={regenBusy}
        saving={stepBusyId !== null}
        blocker={executionSteps.find((s) => s.key === 'materials_qr')?.blocker ?? null}
        readyToComplete={executionSteps.find((s) => s.key === 'materials_qr')?.readyToComplete ?? false}
        onSaveCodes={async () => {
          // Stakeholder codes removed for QA backend compliance
        }}
        onGenerateMaterials={handleGenerateMaterials}
        onRegenerateAll={handleRegenerateAll}
        onCompleteStep={() => {
          const step = executionSteps.find((s) => s.key === 'materials_qr')
          if (step) void handleCompleteStep(step.step.id)
          setLifecycleModal(null)
        }}
      />

      <LaunchDecisionModal
        open={lifecycleModal === 'launch_decision'}
        onOpenChange={(open) => !open && setLifecycleModal(null)}
        biz={biz}
        captureOffer={captureOffer}
        cashbackOffer={cashbackOffer}
        joinedCount={joinedCount}
        generatedCount={generatedCount}
        qrCount={qrCodes.length}
        saving={offerSaving || updateLoading}
        blocker={executionSteps.find((s) => s.key === 'launch_decision')?.blocker ?? null}
        readyToComplete={executionSteps.find((s) => s.key === 'launch_decision')?.readyToComplete ?? false}
        onSaveOffers={async ({ headline, description, valueLabel, cashbackPercent: cp }) => {
          setCaptureHeadline(headline)
          setCaptureDescription(description)
          setCaptureValue(valueLabel)
          setCashbackPercent(cp)
          await handleSaveOffers()
        }}
        onCompleteStep={() => {
          const step = executionSteps.find((s) => s.key === 'launch_decision')
          if (step) void handleCompleteStep(step.step.id)
          setLifecycleModal(null)
        }}
      />
    </div>
  )
}

function StatusCard({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-2xl font-semibold text-surface-900">{value}</p>
          <Badge variant={statReady(ready)}>{ready ? 'Ready' : 'Needs work'}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-surface-900">{value}</p>
    </div>
  )
}

function WorkspaceTabButton({
  active,
  label,
  meta,
  onClick,
}: {
  active: boolean
  label: string
  meta: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-2xl border px-4 py-3 text-left transition',
        active
          ? 'border-brand-300 bg-brand-50 shadow-sm'
          : 'border-surface-200 bg-surface-0 hover:border-surface-300 hover:bg-surface-50',
      ].join(' ')}
    >
      <p className="text-sm font-semibold text-surface-900">{label}</p>
      <p className="mt-1 text-xs text-surface-500">{meta}</p>
    </button>
  )
}
