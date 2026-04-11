'use client'

import * as React from 'react'
import Link from 'next/link'
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
  Sparkles,
  Upload,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { resolveBusinessOffer } from '@/lib/offers'
import { buildStakeholderJoinUrl } from '@/lib/material-engine'
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
  useStakeholders,
  useStakeholderCodes,
} from '@/lib/supabase/hooks'
import { formatDate, formatDateTime } from '@/lib/utils'
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
  Profile,
  StakeholderAssignment,
} from '@/lib/types/database'

interface BusinessExecutionOverviewProps {
  biz: Business
  localBusinessId: string | null
  city: City | null
  owner: Profile | null
  linkedCause: Cause | null
  campaign: Campaign | null
  helperAssignments: Array<{ assignment: StakeholderAssignment; profile: Profile }>
  updateBusiness: (id: string, changes: Partial<Business>) => Promise<Business | null>
  updateLoading: boolean
  refetchBusiness?: () => void
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
  city,
  owner,
  linkedCause,
  campaign,
  helperAssignments,
  updateBusiness,
  updateLoading,
  refetchBusiness,
}: BusinessExecutionOverviewProps) {
  const { profile } = useAuth()
  const localProfileId = asUuid(profile.id)
  const { data: profiles } = useProfiles()
  const { data: stakeholders, refetch: refetchStakeholders } = useStakeholders({ business_id: biz.id })
  const stakeholder = stakeholders[0] || null
  const { data: stakeholderCodes, refetch: refetchCodes } = useStakeholderCodes({ stakeholder_id: stakeholder?.id || EMPTY_UUID })
  const codes = stakeholderCodes[0] || null
  const { data: generatedMaterials, refetch: refetchGenerated } = useGeneratedMaterials({ stakeholder_id: stakeholder?.id || EMPTY_UUID })
  const { data: adminTasks, refetch: refetchAdminTasks } = useAdminTasks({ stakeholder_id: stakeholder?.id || EMPTY_UUID })
  const { data: flows, refetch: refetchFlows } = useOnboardingFlows({ entity_type: 'business', entity_id: biz.id })
  const flow = flows[0] || null
  const { data: steps, refetch: refetchSteps } = useOnboardingSteps({ flow_id: flow?.id || EMPTY_UUID })
  const { data: offers, refetch: refetchOffers } = useOffers({ business_id: biz.id })
  const { data: contacts, refetch: refetchContacts } = useContacts({ business_id: biz.id })
  const { data: qrCodes, refetch: refetchQrCodes } = useQrCodes({ business_id: biz.id })
  const { data: outreach, refetch: refetchOutreach } = useOutreach({ entity_type: 'business', entity_id: biz.id })
  const { insert: insertOutreach, loading: savingOutreach } = useOutreachInsert()
  const { insert: insertOffer } = useOfferInsert()
  const { update: updateOffer } = useOfferUpdate()

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

  const [referralCode, setReferralCode] = React.useState('')
  const [connectionCode, setConnectionCode] = React.useState('')
  const [engineMessage, setEngineMessage] = React.useState<string | null>(null)
  const [engineError, setEngineError] = React.useState<string | null>(null)
  const [engineBusy, setEngineBusy] = React.useState<'codes' | 'generate' | null>(null)
  const [stepBusyId, setStepBusyId] = React.useState<string | null>(null)
  const [captureHeadline, setCaptureHeadline] = React.useState(captureOffer.headline || '')
  const [captureDescription, setCaptureDescription] = React.useState(captureOffer.description || '')
  const [captureValue, setCaptureValue] = React.useState(captureOffer.value_label || '')
  const [cashbackPercent, setCashbackPercent] = React.useState(cashbackOffer.cashback_percent || 10)
  const [offerMessage, setOfferMessage] = React.useState<string | null>(null)
  const [offerError, setOfferError] = React.useState<string | null>(null)
  const [offerSaving, setOfferSaving] = React.useState(false)
  const [outreachSubject, setOutreachSubject] = React.useState('')
  const [outreachBody, setOutreachBody] = React.useState('')
  const [outreachOutcome, setOutreachOutcome] = React.useState('')
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<'materials' | 'offers' | 'outreach' | 'branding'>('materials')
  const [showArchive, setShowArchive] = React.useState(false)
  const [regenBusy, setRegenBusy] = React.useState(false)
  const [regenMessage, setRegenMessage] = React.useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = React.useState<'logo' | 'cover' | null>(null)
  const [uploadMessage, setUploadMessage] = React.useState<string | null>(null)
  const logoInputRef = React.useRef<HTMLInputElement>(null)
  const coverInputRef = React.useRef<HTMLInputElement>(null)
  const writeBusinessId = localBusinessId || asUuid(biz.id)

  React.useEffect(() => {
    setReferralCode(codes?.referral_code || '')
    setConnectionCode(codes?.connection_code || '')
  }, [codes?.connection_code, codes?.referral_code])

  React.useEffect(() => {
    setCaptureHeadline(captureOffer.headline || '')
    setCaptureDescription(captureOffer.description || '')
    setCaptureValue(captureOffer.value_label || '')
    setCashbackPercent(cashbackOffer.cashback_percent || 10)
  }, [captureOffer.description, captureOffer.headline, captureOffer.value_label, cashbackOffer.cashback_percent])

  const joinUrl = React.useMemo(() => {
    if (codes?.join_url) return codes.join_url
    if (!connectionCode.trim()) return ''
    return buildStakeholderJoinUrl('business', connectionCode)
  }, [codes?.join_url, connectionCode])

  async function refetchExecution() {
    refetchBusiness?.()
    refetchStakeholders({ silent: true })
    refetchCodes({ silent: true })
    refetchGenerated({ silent: true })
    refetchAdminTasks({ silent: true })
    refetchFlows({ silent: true })
    refetchSteps({ silent: true })
    refetchOffers({ silent: true })
    refetchContacts({ silent: true })
    refetchQrCodes({ silent: true })
    refetchOutreach({ silent: true })
  }

  async function callExecutionAction(payload: Record<string, unknown>) {
    if (!writeBusinessId) {
      throw new Error('This business is not linked to a local dashboard record yet.')
    }

    const response = await fetch(`/api/crm/businesses/${writeBusinessId}/execution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'The business action could not be completed.')
    return body
  }

  async function handleSaveCodes() {
    setEngineBusy('codes')
    setEngineMessage(null)
    setEngineError(null)
    try {
      const body = await callExecutionAction({
        action: 'save_codes',
        referralCode,
        connectionCode,
      })
      const generationStatus = body?.result?.generationStatus
      const generationError = body?.result?.generationError
      const generatedMaterialsCount = Array.isArray(body?.result?.generatedMaterials) ? body.result.generatedMaterials.length : 0
      const fallbackGenerated = Array.isArray(body?.result?.failures) && body.result.failures.length > 0 && generatedMaterialsCount > 0

      if (generationStatus === 'failed' || generatedMaterialsCount === 0) {
        setEngineError(generationError || 'Codes saved, but materials could not be generated.')
      } else if (fallbackGenerated) {
        setEngineMessage('Codes saved. Materials generated with fallback layouts where needed.')
      } else {
        setEngineMessage('Codes saved and materials generated.')
      }
      await refetchExecution()
    } catch (error) {
      setEngineError(error instanceof Error ? error.message : 'Codes could not be saved.')
    } finally {
      setEngineBusy(null)
    }
  }

  async function handleGenerateMaterials() {
    setEngineBusy('generate')
    setEngineMessage(null)
    setEngineError(null)
    try {
      const body = await callExecutionAction({ action: 'generate_materials' })
      const generatedMaterialsCount = Array.isArray(body?.result?.generatedMaterials) ? body.result.generatedMaterials.length : 0
      const fallbackGenerated = Array.isArray(body?.result?.failures) && body.result.failures.length > 0 && generatedMaterialsCount > 0
      if (generatedMaterialsCount === 0) {
        setEngineError(body?.result?.generationError || 'Materials could not be generated.')
      } else if (fallbackGenerated) {
        setEngineMessage('Materials generated with fallback layouts where needed.')
      } else {
        setEngineMessage('Materials generated.')
      }
      await refetchExecution()
    } catch (error) {
      setEngineError(error instanceof Error ? error.message : 'Materials could not be generated.')
    } finally {
      setEngineBusy(null)
    }
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
      const metadata = {
        ...((biz.metadata as Record<string, unknown> | null) || {}),
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

      await updateBusiness(biz.id, { metadata, launch_phase: biz.launch_phase || 'setup' })

      const capturePayload: Partial<Offer> = {
        business_id: biz.id,
        offer_type: 'capture',
        status: captureHeadline.trim() ? 'active' : 'draft',
        headline: captureHeadline.trim() || 'Join our list and get access to exclusive offers',
        description: captureDescription.trim() || 'This offer is only used to collect your first 100 customers before you go live.',
        value_type: 'label',
        value_label: captureValue.trim() || null,
        cashback_percent: null,
        starts_at: null,
        ends_at: null,
        metadata: { source: 'crm_business_execution' },
      }

      const cashbackPayload: Partial<Offer> = {
        business_id: biz.id,
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
      entity_id: biz.id,
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
      await callExecutionAction({ action: 'regenerate_all' })
      setRegenMessage('All materials regenerated.')
      await refetchExecution()
    } catch (error) {
      setRegenMessage(error instanceof Error ? error.message : 'Regeneration failed.')
    } finally {
      setRegenBusy(false)
    }
  }

  async function handleRestoreVersion(generatedMaterialId: string) {
    try {
      await callExecutionAction({ action: 'restore_version', generatedMaterialId })
      await refetchExecution()
    } catch {
      // silent
    }
  }

  async function handleUploadMedia(mediaType: 'logo' | 'cover_photo', file: File) {
    setUploadBusy(mediaType === 'logo' ? 'logo' : 'cover')
    setUploadMessage(null)
    try {
      if (!writeBusinessId) {
        throw new Error('This business is not linked to a local dashboard record yet.')
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
      setUploadMessage(`${mediaType === 'logo' ? 'Logo' : 'Cover photo'} uploaded${body.regenerated ? ' and materials regenerated' : ''}.`)
      await refetchExecution()
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setUploadBusy(null)
    }
  }

  function openWorkspaceTab(tab: 'materials' | 'offers' | 'outreach' | 'branding') {
    setActiveWorkspaceTab(tab)
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        document.getElementById('business-workspace-tabs')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <StatusCard label="Onboarding" value={`${executionSteps.filter((item) => item.state === 'completed').length}/${executionSteps.length}`} ready={executionSteps.every((item) => item.state === 'completed')} />
        <StatusCard label="QR status" value={qrCodes.length > 0 ? 'Ready' : 'Missing'} ready={qrCodes.length > 0} />
        <StatusCard label="100-list" value={`${joinedCount} / 100`} ready={joinedCount >= 100} />
        <StatusCard label="Cashback" value={`${cashbackPercent}%`} ready={cashbackPercent >= 5 && cashbackPercent <= 25} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Business lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {executionSteps.map((item) => (
              <div key={item.step.id} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
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
                      <button
                        type="button"
                        onClick={() => {
                          const tab = getTabForBusinessStepKey(item.key)
                          if (['materials', 'offers', 'outreach', 'branding'].includes(tab)) {
                            openWorkspaceTab(tab as 'materials' | 'offers' | 'outreach' | 'branding')
                          } else if (tab === 'codes') {
                            openWorkspaceTab('materials')
                          }
                        }}
                        className="text-xs text-warning-700 underline decoration-warning-300 underline-offset-2 hover:text-warning-900 hover:decoration-warning-500 transition-colors cursor-pointer text-left"
                      >
                        {item.blocker} →
                      </button>
                    ) : (
                      <p className="text-xs text-surface-500">Ready for the next action.</p>
                    )}
                  </div>
                  {item.state === 'active' ? (
                    item.readyToComplete ? (
                      <Button size="sm" onClick={() => void handleCompleteStep(item.step.id)} disabled={stepBusyId === item.step.id}>
                        {stepBusyId === item.step.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Complete
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openWorkspaceTab(
                          item.key === 'materials_qr'
                            ? 'materials'
                            : item.key === 'launch_decision'
                              ? 'offers'
                              : 'outreach',
                        )}
                      >
                        Open area
                      </Button>
                    )
                  ) : null}
                </div>
              </div>
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
              <p><span className="font-semibold text-surface-900">Helpers:</span> {helperAssignments.length}</p>
            </div>
            {nextActions.length > 0 ? nextActions.map((action) => (
              <button
                key={action.text}
                type="button"
                onClick={() => {
                  const tabMap: Record<string, 'materials' | 'offers' | 'outreach' | 'branding'> = {
                    codes: 'materials',
                    materials: 'materials',
                    offers: 'offers',
                    outreach: 'outreach',
                    branding: 'branding',
                  }
                  const wsTab = tabMap[action.tab]
                  if (wsTab) openWorkspaceTab(wsTab)
                }}
                className="flex w-full items-start gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer group"
              >
                <Sparkles className="mt-0.5 h-4 w-4 text-brand-500" />
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

      <Card id="business-workspace-tabs">
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
              label="Offers + Cashback"
              meta={`${cashbackPercent}% cashback`}
              onClick={() => setActiveWorkspaceTab('offers')}
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
              meta={biz.logo_url ? 'Logo set' : 'Needs logo'}
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Referral code</label>
                      <Input value={referralCode} onChange={(event) => setReferralCode(event.target.value)} placeholder="main-street-bakery" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Connection code</label>
                      <Input value={connectionCode} onChange={(event) => setConnectionCode(event.target.value)} placeholder="main-street-bakery" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">Join URL</label>
                    <div className="flex gap-2">
                      <Input value={joinUrl} readOnly />
                      {joinUrl ? (
                        <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(joinUrl)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniStatus label="Generation" value={generationState} />
                    <MiniStatus label="Generated files" value={`${generatedCount}`} />
                    <MiniStatus label="QR linked" value={qrCodes.length > 0 ? 'Yes' : 'No'} />
                  </div>
                  {engineError ? <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{engineError}</div> : null}
                  {engineMessage ? <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{engineMessage}</div> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void handleSaveCodes()} disabled={engineBusy !== null || !referralCode.trim() || !connectionCode.trim()}>
                      {engineBusy === 'codes' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Save codes + generate
                    </Button>
                    <Button variant="outline" onClick={() => void handleGenerateMaterials()} disabled={engineBusy !== null || !codes?.connection_code}>
                      {engineBusy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      Generate materials
                    </Button>
                    <Button variant="outline" onClick={() => void handleRegenerateAll()} disabled={regenBusy || engineBusy !== null || !codes?.connection_code}>
                      {regenBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Regenerate all
                    </Button>
                    {joinUrl ? (
                      <Button variant="outline" asChild>
                        <Link href={joinUrl} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                          Open join page
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                  {regenMessage ? (
                    <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">{regenMessage}</div>
                  ) : null}
                  {!biz.logo_url ? (
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
                              <p className="text-xs text-surface-500">{item.library_folder.replace(/_/g, ' ')}</p>
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
            <div id="offers" className="grid gap-6 xl:grid-cols-[1fr,0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>100-list offer</CardTitle>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cashback and launch readiness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">Cashback percent</label>
                    <Input type="number" min={5} max={25} value={cashbackPercent} onChange={(event) => setCashbackPercent(Number(event.target.value || 10))} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniStatus label="Capture ready" value={captureHeadline.trim() ? 'Yes' : 'No'} />
                    <MiniStatus label="Cashback ready" value={cashbackPercent >= 5 && cashbackPercent <= 25 ? 'Yes' : 'No'} />
                    <MiniStatus label="Live phase" value={biz.launch_phase || 'setup'} />
                  </div>
                  {offerError ? <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{offerError}</div> : null}
                  {offerMessage ? <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{offerMessage}</div> : null}
                  <Button onClick={() => void handleSaveOffers()} disabled={offerSaving || updateLoading}>
                    {offerSaving || updateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Save offer settings
                  </Button>
                </CardContent>
              </Card>
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
                    {biz.logo_url ? (
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-2xl border border-surface-200 bg-surface-50">
                          <img src={biz.logo_url} alt="Logo" className="h-full w-full object-contain" />
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
                    {biz.cover_photo_url ? (
                      <div className="space-y-3">
                        <div className="h-40 w-full overflow-hidden rounded-2xl border border-surface-200 bg-surface-50">
                          <img src={biz.cover_photo_url} alt="Cover" className="h-full w-full object-cover" />
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
                    {biz.cover_photo_url ? (
                      <div className="h-36 w-full overflow-hidden bg-surface-100">
                        <img src={biz.cover_photo_url} alt="Cover" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50">
                        <p className="text-sm text-brand-400">No cover photo</p>
                      </div>
                    )}
                    <div className="relative px-4 pb-4">
                      <div className="-mt-8 mb-3 flex items-end gap-3">
                        {biz.logo_url ? (
                          <div className="h-16 w-16 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-sm">
                            <img src={biz.logo_url} alt="Logo" className="h-full w-full object-contain" />
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
                          <p className="text-sm font-semibold text-surface-900">{item.subject || item.type.replace(/_/g, ' ')}</p>
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
