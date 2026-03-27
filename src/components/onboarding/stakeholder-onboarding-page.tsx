'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Plus,
  QrCode,
  Shield,
  UserPlus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { ProgressSteps } from '@/components/ui/progress-steps'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth/context'
import { BRANDS, ONBOARDING_STAGES } from '@/lib/constants'
import {
  getMaterialAutomationTemplateConfig,
  materialSupportsAutomationTemplate,
} from '@/lib/materials/automation-template'
import { createClient } from '@/lib/supabase/client'
import {
  useAdminTasks,
  useCampaigns,
  useCities,
  useGeneratedMaterials,
  useMaterials,
  useMaterialTemplates,
  useOnboardingFlows,
  useOnboardingSteps,
  useProfiles,
  useStakeholderCodes,
  useStakeholders,
} from '@/lib/supabase/hooks'
import type {
  AdminTask,
  Brand,
  Campaign,
  City,
  GeneratedMaterial,
  Material,
  MaterialTemplate,
  OnboardingFlow,
  OnboardingStage,
  OnboardingStep,
  Profile,
  Stakeholder,
  StakeholderCode,
  StakeholderType,
  UserRole,
} from '@/lib/types/database'
import { formatDate } from '@/lib/utils'

type StepKey = 'contact' | 'agreement' | 'account' | 'codes' | 'campaign'
type SupportedRole = 'volunteer' | 'intern' | 'influencer' | 'launch_partner'

interface StepDefinition {
  key: StepKey
  title: string
  description: string
}

interface FlowRecord extends OnboardingFlow {
  targetRole: SupportedRole
  steps: OnboardingStep[]
  stakeholder: Stakeholder | null
  codes: StakeholderCode | null
  adminTask: AdminTask | null
  generatedMaterials: GeneratedMaterial[]
  linkedProfile: Profile | null
  city: City | null
  campaign: Campaign | null
}

const ROLE_OPTIONS: Array<{ value: SupportedRole; label: string }> = [
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'intern', label: 'Intern' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'launch_partner', label: 'Launch Partner' },
]

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

function normalizeRole(value: unknown): SupportedRole {
  if (value === 'affiliate') return 'influencer'
  if (value === 'business_onboarding') return 'launch_partner'
  if (value === 'volunteer' || value === 'intern' || value === 'influencer' || value === 'launch_partner') {
    return value
  }
  return 'volunteer'
}

function stakeholderTypeForRole(role: SupportedRole): StakeholderType {
  if (role === 'intern' || role === 'volunteer') return 'field'
  if (role === 'launch_partner') return 'launch_partner'
  return 'influencer'
}

function roleLabel(role: SupportedRole) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label || 'Stakeholder'
}

function inviteShape(role: SupportedRole): { role: 'field' | 'influencer' | 'launch_partner'; roleSubtype: 'intern' | 'volunteer' | null } {
  if (role === 'intern') return { role: 'field', roleSubtype: 'intern' }
  if (role === 'volunteer') return { role: 'field', roleSubtype: 'volunteer' }
  if (role === 'launch_partner') return { role: 'launch_partner', roleSubtype: null }
  return { role: 'influencer', roleSubtype: null }
}

function stepDefinitions(role: SupportedRole): StepDefinition[] {
  return [
    {
      key: 'contact',
      title: 'Outreach & contact',
      description: 'Capture the person, context, and city details.',
    },
    {
      key: 'agreement',
      title: 'Agreement & terms',
      description: 'Confirm expectations and readiness to move forward.',
    },
    {
      key: 'account',
      title: 'Create account',
      description: 'Invite and link the stakeholder account.',
    },
    {
      key: 'codes',
      title: 'Set up QR & referral links',
      description: 'Save codes and generate starter materials.',
    },
    {
      key: 'campaign',
      title: role === 'launch_partner' ? 'First city campaign' : 'First campaign',
      description: 'Attach the first live operating focus.',
    },
  ]
}

function stepKeyFor(step: OnboardingStep, index: number, role: SupportedRole): StepKey {
  const metadata = ((step.metadata as Record<string, unknown> | null) || {})
  const key = metadata.step_key
  if (key === 'contact' || key === 'agreement' || key === 'account' || key === 'codes' || key === 'campaign') {
    return key
  }
  return stepDefinitions(role)[index]?.key || 'contact'
}

function mergeMetadata(
  current: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
) {
  return {
    ...(current || {}),
    ...patch,
  }
}

function computeStage(steps: OnboardingStep[]): OnboardingStage {
  const completed = steps.filter((step) => step.is_completed).length
  if (completed === 0) return 'lead'
  if (completed === 1) return 'contacted'
  if (completed === 2) return 'interested'
  if (completed <= 4) return 'in_progress'
  return 'live'
}

function taskBadge(status: string | null | undefined) {
  if (status === 'generated') return 'success'
  if (status === 'ready_to_generate') return 'info'
  if (status === 'failed') return 'danger'
  return 'warning'
}

function resolveStakeholder(flow: OnboardingFlow, role: SupportedRole, stakeholders: Stakeholder[]) {
  const metadata = ((flow.metadata as Record<string, unknown> | null) || {})
  const stakeholderId = typeof metadata.stakeholder_id === 'string' ? metadata.stakeholder_id : null

  return (
    stakeholders.find((item) => item.id === stakeholderId)
    || stakeholders.find((item) => item.id === flow.entity_id)
    || stakeholders.find((item) => item.profile_id === flow.entity_id)
    || stakeholders.find((item) => item.name === flow.name && item.type === stakeholderTypeForRole(role))
    || null
  )
}

export function StakeholderOnboardingPage() {
  const { profile } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])
  const { data: flowsData, loading: flowsLoading, refetch: refetchFlows } = useOnboardingFlows({ entity_type: 'stakeholder' })
  const { data: stepsData, loading: stepsLoading, refetch: refetchSteps } = useOnboardingSteps()
  const { data: stakeholders, loading: stakeholdersLoading, refetch: refetchStakeholders } = useStakeholders()
  const { data: codesData, refetch: refetchCodes } = useStakeholderCodes()
  const { data: tasksData, refetch: refetchTasks } = useAdminTasks()
  const { data: generatedData, refetch: refetchGenerated } = useGeneratedMaterials()
  const { data: materials, refetch: refetchMaterials } = useMaterials()
  const { data: templates, refetch: refetchTemplates } = useMaterialTemplates()
  const { data: campaigns, loading: campaignsLoading, refetch: refetchCampaigns } = useCampaigns()
  const { data: cities, loading: citiesLoading } = useCities()
  const { data: profiles, loading: profilesLoading, refetch: refetchProfiles } = useProfiles()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState({
    name: '',
    role: 'volunteer' as SupportedRole,
    brand: 'localvip' as Brand,
    email: '',
    phone: '',
    cityId: '',
    notes: '',
  })

  const loading = flowsLoading || stepsLoading || stakeholdersLoading || campaignsLoading || citiesLoading || profilesLoading

  const stepsByFlow = React.useMemo(() => {
    const map = new Map<string, OnboardingStep[]>()
    stepsData.forEach((step) => {
      const current = map.get(step.flow_id) || []
      current.push(step)
      map.set(step.flow_id, current)
    })
    for (const [flowId, steps] of map.entries()) {
      map.set(flowId, [...steps].sort((a, b) => a.sort_order - b.sort_order))
    }
    return map
  }, [stepsData])

  const codesByStakeholder = React.useMemo(() => new Map(codesData.map((item) => [item.stakeholder_id, item])), [codesData])
  const tasksByStakeholder = React.useMemo(() => new Map(tasksData.map((item) => [item.stakeholder_id, item])), [tasksData])
  const profileMap = React.useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles])
  const cityMap = React.useMemo(() => new Map(cities.map((item) => [item.id, item])), [cities])
  const campaignMap = React.useMemo(() => new Map(campaigns.map((item) => [item.id, item])), [campaigns])
  const materialMap = React.useMemo(() => new Map(materials.map((item) => [item.id, item])), [materials])
  const generatedByStakeholder = React.useMemo(() => {
    const map = new Map<string, GeneratedMaterial[]>()
    generatedData.forEach((item) => {
      const current = map.get(item.stakeholder_id) || []
      current.push(item)
      map.set(item.stakeholder_id, current)
    })
    return map
  }, [generatedData])

  const flows = React.useMemo<FlowRecord[]>(() => {
    return flowsData
      .filter((flow) => flow.entity_type === 'stakeholder')
      .map((flow) => {
        const metadata = ((flow.metadata as Record<string, unknown> | null) || {})
        const targetRole = normalizeRole(metadata.target_role)
        const stakeholder = resolveStakeholder(flow, targetRole, stakeholders)
        const profileId =
          (typeof metadata.invited_profile_id === 'string' ? metadata.invited_profile_id : null)
          || stakeholder?.profile_id
          || stakeholder?.owner_user_id
          || null

        return {
          ...flow,
          targetRole,
          steps: stepsByFlow.get(flow.id) || [],
          stakeholder,
          codes: stakeholder ? codesByStakeholder.get(stakeholder.id) || null : null,
          adminTask: stakeholder ? tasksByStakeholder.get(stakeholder.id) || null : null,
          generatedMaterials: stakeholder ? generatedByStakeholder.get(stakeholder.id) || [] : [],
          linkedProfile: profileId ? profileMap.get(profileId) || null : null,
          city: cityMap.get(stakeholder?.city_id || ((metadata.city_id as string) || '')) || null,
          campaign: flow.campaign_id ? campaignMap.get(flow.campaign_id) || null : null,
        }
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [campaignMap, cityMap, codesByStakeholder, flowsData, generatedByStakeholder, profileMap, stakeholders, stepsByFlow, tasksByStakeholder])

  const totals = React.useMemo(() => ({
    flows: flows.length,
    accounts: flows.filter((flow) => flow.linkedProfile).length,
    codes: flows.filter((flow) => flow.codes).length,
    campaigns: flows.filter((flow) => flow.campaign).length,
  }), [flows])

  const refetchAll = React.useCallback(() => {
    refetchFlows({ silent: true })
    refetchSteps({ silent: true })
    refetchStakeholders({ silent: true })
    refetchCodes({ silent: true })
    refetchTasks({ silent: true })
    refetchGenerated({ silent: true })
    refetchMaterials({ silent: true })
    refetchTemplates({ silent: true })
    refetchCampaigns({ silent: true })
    refetchProfiles({ silent: true })
  }, [refetchCodes, refetchFlows, refetchGenerated, refetchMaterials, refetchCampaigns, refetchProfiles, refetchStakeholders, refetchSteps, refetchTasks, refetchTemplates])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!profile?.id || !form.name.trim()) return

    setSaving(true)
    setCreateError(null)

    const stakeholderResponse = await fetch('/api/admin/material-engine/stakeholders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: stakeholderTypeForRole(form.role),
        name: form.name.trim(),
        cityId: form.cityId || null,
        ownerUserId: null,
        profileId: null,
        status: 'pending',
      }),
    })

    const stakeholderPayload = await stakeholderResponse.json().catch(() => ({ error: 'Could not create stakeholder.' }))
    if (!stakeholderResponse.ok) {
      setSaving(false)
      setCreateError(stakeholderPayload.error || 'Could not create stakeholder.')
      return
    }

    const stakeholder = stakeholderPayload.stakeholder as Stakeholder
    const definitions = stepDefinitions(form.role)
    const now = new Date().toISOString()
    const flowResult = await (supabase.from('onboarding_flows') as any)
      .insert({
        name: form.name.trim(),
        entity_type: 'stakeholder',
        entity_id: stakeholder.id,
        brand: form.brand,
        stage: 'lead',
        owner_id: profile.id,
        campaign_id: null,
        started_at: now,
        metadata: {
          target_role: form.role,
          stakeholder_id: stakeholder.id,
          contact_name: form.name.trim(),
          contact_email: form.email.trim() || null,
          contact_phone: form.phone.trim() || null,
          city_id: form.cityId || null,
          contact_notes: form.notes.trim() || null,
          contact_status: 'lead',
          invite_email: form.email.trim() || null,
          invited_profile_id: null,
          agreement_shared: false,
          agreement_confirmed: false,
          agreement_notes: null,
          campaign_id: null,
          campaign_notes: null,
        },
      })
      .select()
      .single()

    const createdFlow = (flowResult.data || null) as OnboardingFlow | null
    if (!createdFlow) {
      setSaving(false)
      setCreateError(flowResult.error?.message || 'Could not create onboarding flow.')
      return
    }

    await (supabase.from('onboarding_steps') as any).insert(
      definitions.map((definition, index) => ({
        flow_id: createdFlow.id,
        title: definition.title,
        description: definition.description,
        sort_order: index,
        is_required: true,
        is_completed: false,
        metadata: { step_key: definition.key },
      })),
    )

    setSaving(false)
    setCreateOpen(false)
    setForm({
      name: '',
      role: 'volunteer',
      brand: 'localvip',
      email: '',
      phone: '',
      cityId: '',
      notes: '',
    })
    refetchAll()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stakeholder Onboarding"
        description="Bring new volunteers, interns, influencers, and partners into the system. Complete contact, agreement, account, QR/material setup, and first campaign here."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Start Onboarding</Button>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-surface-500">Flows</p><p className="mt-2 text-3xl font-semibold text-surface-900">{totals.flows}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-surface-500">Accounts linked</p><p className="mt-2 text-3xl font-semibold text-surface-900">{totals.accounts}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-surface-500">Codes ready</p><p className="mt-2 text-3xl font-semibold text-surface-900">{totals.codes}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-surface-500">Campaign ready</p><p className="mt-2 text-3xl font-semibold text-surface-900">{totals.campaigns}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      ) : flows.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-8 w-8" />}
          title="No stakeholder onboarding flows"
          description="Start a new onboarding flow to manage every step from this page."
          action={{ label: 'Start Onboarding', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="space-y-5">
          {flows.map((flow) => (
            <FlowWorkspaceCard
              key={flow.id}
              flow={flow}
              adminProfile={profile}
              campaigns={campaigns}
              cities={cities}
              materials={materials}
              materialMap={materialMap}
              templates={templates}
              supabase={supabase}
              refetchAll={refetchAll}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start Stakeholder Onboarding</DialogTitle>
            <DialogDescription>
              Create the stakeholder record first, then work every onboarding step directly from this page.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Name *</label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Role</label>
                <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as SupportedRole }))} className={SELECT_CLASS}>
                  {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Email</label>
                <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Phone</label>
                <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Brand</label>
                <select value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value as Brand }))} className={SELECT_CLASS}>
                  {Object.entries(BRANDS).map(([key, brand]) => <option key={key} value={key}>{brand.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Home city</label>
                <select value={form.cityId} onChange={(event) => setForm((current) => ({ ...current, cityId: event.target.value }))} className={SELECT_CLASS}>
                  <option value="">No city yet</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{city.name}, {city.state}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Notes</label>
              <Textarea rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="What should the operator remember while bringing this stakeholder live?" />
            </div>
            {createError && <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{createError}</div>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.name.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Creating...' : 'Start Onboarding'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FlowWorkspaceCard({
  flow,
  adminProfile,
  campaigns,
  cities,
  materials,
  materialMap,
  templates,
  supabase,
  refetchAll,
}: {
  flow: FlowRecord
  adminProfile: Profile | null
  campaigns: Campaign[]
  cities: City[]
  materials: Material[]
  materialMap: Map<string, Material>
  templates: MaterialTemplate[]
  supabase: ReturnType<typeof createClient>
  refetchAll: () => void
}) {
  const metadata = React.useMemo(() => ((flow.metadata as Record<string, unknown> | null) || {}), [flow.metadata])
  const definitions = React.useMemo(() => stepDefinitions(flow.targetRole), [flow.targetRole])
  const stepsByKey = React.useMemo(() => {
    const map = new Map<StepKey, OnboardingStep>()
    flow.steps.forEach((step, index) => {
      map.set(stepKeyFor(step, index, flow.targetRole), step)
    })
    return map
  }, [flow.steps, flow.targetRole])

  const nextStep = React.useMemo(() => {
    return definitions.find((definition) => !stepsByKey.get(definition.key)?.is_completed)?.key || definitions[definitions.length - 1]?.key || 'contact'
  }, [definitions, stepsByKey])

  const [activeStep, setActiveStep] = React.useState<StepKey>(nextStep)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null)

  const [contactName, setContactName] = React.useState(flow.name)
  const [contactEmail, setContactEmail] = React.useState((metadata.contact_email as string) || '')
  const [contactPhone, setContactPhone] = React.useState((metadata.contact_phone as string) || '')
  const [contactCityId, setContactCityId] = React.useState(flow.city?.id || ((metadata.city_id as string) || ''))
  const [contactStatus, setContactStatus] = React.useState((metadata.contact_status as string) || 'lead')
  const [contactNotes, setContactNotes] = React.useState((metadata.contact_notes as string) || '')
  const [agreementShared, setAgreementShared] = React.useState(Boolean(metadata.agreement_shared))
  const [agreementConfirmed, setAgreementConfirmed] = React.useState(Boolean(metadata.agreement_confirmed))
  const [agreementNotes, setAgreementNotes] = React.useState((metadata.agreement_notes as string) || '')
  const [inviteEmail, setInviteEmail] = React.useState((metadata.invite_email as string) || (metadata.contact_email as string) || '')
  const [referralCode, setReferralCode] = React.useState(flow.codes?.referral_code || '')
  const [connectionCode, setConnectionCode] = React.useState(flow.codes?.connection_code || '')
  const [selectedCampaignId, setSelectedCampaignId] = React.useState(flow.campaign?.id || ((metadata.campaign_id as string) || ''))
  const [newCampaignName, setNewCampaignName] = React.useState('')
  const [campaignNotes, setCampaignNotes] = React.useState((metadata.campaign_notes as string) || '')

  React.useEffect(() => {
    setActiveStep(nextStep)
  }, [flow.id, nextStep])

  React.useEffect(() => {
    setContactName(flow.name)
    setContactEmail((metadata.contact_email as string) || '')
    setContactPhone((metadata.contact_phone as string) || '')
    setContactCityId(flow.city?.id || ((metadata.city_id as string) || ''))
    setContactStatus((metadata.contact_status as string) || 'lead')
    setContactNotes((metadata.contact_notes as string) || '')
    setAgreementShared(Boolean(metadata.agreement_shared))
    setAgreementConfirmed(Boolean(metadata.agreement_confirmed))
    setAgreementNotes((metadata.agreement_notes as string) || '')
    setInviteEmail((metadata.invite_email as string) || (metadata.contact_email as string) || '')
    setReferralCode(flow.codes?.referral_code || '')
    setConnectionCode(flow.codes?.connection_code || '')
    setSelectedCampaignId(flow.campaign?.id || ((metadata.campaign_id as string) || ''))
    setCampaignNotes((metadata.campaign_notes as string) || '')
  }, [flow, metadata])

  const linkedGenerated = React.useMemo(() => {
    return flow.generatedMaterials.map((generated) => ({
      generated,
      material: generated.material_id ? materialMap.get(generated.material_id) || null : null,
    }))
  }, [flow.generatedMaterials, materialMap])

  const matchingTemplateCount = React.useMemo(() => {
    const stakeholderType = flow.stakeholder?.type || stakeholderTypeForRole(flow.targetRole)
    const classic = templates.filter((template) =>
      template.template_type !== 'material_asset'
      && (
        template.stakeholder_types.length === 0
        || template.stakeholder_types.includes(stakeholderType)
        || (stakeholderType === 'school' && template.stakeholder_types.includes('community'))
        || (stakeholderType === 'cause' && template.stakeholder_types.includes('community'))
      )
    ).length

    const uploaded = materials.filter((material) => {
      const config = getMaterialAutomationTemplateConfig(material)
      if (!config.enabled || !config.isActive) return false
      if (!materialSupportsAutomationTemplate(material)) return false
      return (
        config.stakeholderTypes.includes(stakeholderType)
        || (stakeholderType === 'school' && config.stakeholderTypes.includes('community'))
        || (stakeholderType === 'cause' && config.stakeholderTypes.includes('community'))
      )
    }).length

    return classic + uploaded
  }, [flow.stakeholder?.type, flow.targetRole, materials, templates])

  const progress = definitions.map((definition) => ({
    label: definition.title,
    description: definition.description,
    completed: stepsByKey.get(definition.key)?.is_completed || false,
    current: activeStep === definition.key,
  }))

  const generatedCount = linkedGenerated.filter((item) => item.generated.generation_status === 'generated').length
  const joinUrl = flow.codes?.join_url || ((metadata.join_url as string) || '')
  const blockers = [
    !flow.linkedProfile ? 'Account invite still needs to be completed.' : null,
    !flow.codes ? 'Referral and connection codes are not saved yet.' : null,
    flow.codes && generatedCount === 0 ? 'Codes are ready, but materials are not generated yet.' : null,
    !flow.campaign ? 'No first campaign is linked yet.' : null,
  ].filter(Boolean) as string[]

  async function persistStep(options: {
    metadataPatch?: Record<string, unknown>
    flowPatch?: Record<string, unknown>
    stepKey?: StepKey
    stepMetadataPatch?: Record<string, unknown>
    markComplete?: boolean
  }) {
    const updatedSteps = flow.steps.map((step, index) => {
      if (options.stepKey && stepKeyFor(step, index, flow.targetRole) === options.stepKey) {
        return { ...step, is_completed: options.markComplete ?? step.is_completed }
      }
      return step
    })

    const flowUpdate = await (supabase.from('onboarding_flows') as any)
      .update({
        metadata: mergeMetadata(flow.metadata as Record<string, unknown> | null, options.metadataPatch || {}),
        stage: computeStage(updatedSteps),
        completed_at: computeStage(updatedSteps) === 'live' ? new Date().toISOString() : null,
        ...options.flowPatch,
      })
      .eq('id', flow.id)

    if (flowUpdate.error) throw new Error(flowUpdate.error.message)

    if (options.stepKey) {
      const step = stepsByKey.get(options.stepKey)
      if (step) {
        const stepUpdate = await (supabase.from('onboarding_steps') as any)
          .update({
            is_completed: options.markComplete ?? step.is_completed,
            completed_by: options.markComplete ? adminProfile?.id || null : step.completed_by,
            completed_at: options.markComplete ? new Date().toISOString() : step.completed_at,
            metadata: mergeMetadata(step.metadata as Record<string, unknown> | null, options.stepMetadataPatch || {}),
          })
          .eq('id', step.id)

        if (stepUpdate.error) throw new Error(stepUpdate.error.message)
      }
    }
  }

  async function ensureStakeholder() {
    if (flow.stakeholder) return flow.stakeholder

    const response = await fetch('/api/admin/material-engine/stakeholders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: stakeholderTypeForRole(flow.targetRole),
        name: contactName.trim() || flow.name,
        cityId: contactCityId || null,
        ownerUserId: null,
        profileId: null,
        status: 'pending',
      }),
    })
    const payload = await response.json().catch(() => ({ error: 'Could not create stakeholder record.' }))
    if (!response.ok) throw new Error(payload.error || 'Could not create stakeholder record.')

    const stakeholder = payload.stakeholder as Stakeholder
    await persistStep({
      metadataPatch: { stakeholder_id: stakeholder.id },
      flowPatch: { entity_id: stakeholder.id, name: contactName.trim() || flow.name },
    })
    refetchAll()
    return stakeholder
  }

  async function saveContact() {
    if (!contactName.trim()) {
      setError('Add the stakeholder name before saving this step.')
      return
    }

    setLoadingKey('contact')
    setFeedback(null)
    setError(null)
    try {
      const stakeholder = await ensureStakeholder()
      const stakeholderUpdate = await (supabase.from('stakeholders') as any)
        .update({
          name: contactName.trim(),
          city_id: contactCityId || null,
          metadata: mergeMetadata(stakeholder.metadata as Record<string, unknown> | null, {
            onboarding_contact_email: contactEmail.trim() || null,
            onboarding_contact_phone: contactPhone.trim() || null,
            onboarding_contact_notes: contactNotes.trim() || null,
            onboarding_contact_status: contactStatus,
          }),
        })
        .eq('id', stakeholder.id)
      if (stakeholderUpdate.error) throw new Error(stakeholderUpdate.error.message)

      await persistStep({
        metadataPatch: {
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          city_id: contactCityId || null,
          contact_status: contactStatus,
          contact_notes: contactNotes.trim() || null,
          invite_email: inviteEmail.trim() || contactEmail.trim() || null,
        },
        flowPatch: {
          name: contactName.trim(),
          started_at: flow.started_at || new Date().toISOString(),
        },
        stepKey: 'contact',
        stepMetadataPatch: {
          contact_status: contactStatus,
          contact_notes: contactNotes.trim() || null,
        },
        markComplete: true,
      })

      setFeedback('Contact step completed.')
      refetchAll()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the contact step.')
    } finally {
      setLoadingKey(null)
    }
  }

  async function saveAgreement() {
    if (!agreementShared || !agreementConfirmed) {
      setError('Share the agreement and confirm readiness before completing this step.')
      return
    }

    setLoadingKey('agreement')
    setFeedback(null)
    setError(null)
    try {
      await persistStep({
        metadataPatch: {
          agreement_shared: agreementShared,
          agreement_confirmed: agreementConfirmed,
          agreement_notes: agreementNotes.trim() || null,
        },
        stepKey: 'agreement',
        stepMetadataPatch: {
          agreement_shared: agreementShared,
          agreement_confirmed: agreementConfirmed,
          agreement_notes: agreementNotes.trim() || null,
        },
        markComplete: true,
      })

      setFeedback('Agreement step completed.')
      refetchAll()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the agreement step.')
    } finally {
      setLoadingKey(null)
    }
  }

  async function createAccount() {
    const normalizedEmail = inviteEmail.trim() || contactEmail.trim()
    if (!normalizedEmail) {
      setError('Add an email address before creating the account.')
      return
    }

    setLoadingKey('account')
    setFeedback(null)
    setError(null)
    try {
      const stakeholder = await ensureStakeholder()
      const existingProfile = await (supabase.from('profiles') as any)
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle()

      let linkedProfile = (existingProfile.data || null) as Profile | null
      if (!linkedProfile) {
        const invite = inviteShape(flow.targetRole)
        const inviteResponse = await fetch('/api/admin/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            fullName: contactName.trim() || flow.name,
            role: invite.role,
            roleSubtype: invite.roleSubtype,
            brand: flow.brand,
            notes: `Created from stakeholder onboarding for ${flow.name}.`,
          }),
        })
        const invitePayload = await inviteResponse.json().catch(() => ({ error: 'Could not send invite.' }))
        if (!inviteResponse.ok) throw new Error(invitePayload.error || 'Could not send invite.')

        const reloaded = await (supabase.from('profiles') as any)
          .select('*')
          .ilike('email', normalizedEmail)
          .maybeSingle()
        linkedProfile = (reloaded.data || null) as Profile | null
      }

      if (!linkedProfile) throw new Error('The invite was sent, but the linked profile could not be loaded yet.')

      await (supabase.from('profiles') as any)
        .update({
          full_name: contactName.trim() || flow.name,
          city_id: contactCityId || null,
          phone: contactPhone.trim() || null,
          brand_context: flow.brand,
          metadata: mergeMetadata(linkedProfile.metadata as Record<string, unknown> | null, {
            onboarding_flow_id: flow.id,
            stakeholder_id: stakeholder.id,
          }),
        })
        .eq('id', linkedProfile.id)

      const stakeholderUpdate = await (supabase.from('stakeholders') as any)
        .update({
          profile_id: linkedProfile.id,
          owner_user_id: linkedProfile.id,
          city_id: contactCityId || stakeholder.city_id || null,
        })
        .eq('id', stakeholder.id)
      if (stakeholderUpdate.error) throw new Error(stakeholderUpdate.error.message)

      await persistStep({
        metadataPatch: {
          invite_email: normalizedEmail,
          invited_profile_id: linkedProfile.id,
          invite_sent_at: new Date().toISOString(),
        },
        stepKey: 'account',
        stepMetadataPatch: {
          invite_email: normalizedEmail,
          invited_profile_id: linkedProfile.id,
        },
        markComplete: true,
      })

      setFeedback(`Account linked for ${contactName.trim() || flow.name}.`)
      refetchAll()
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Could not create the account.')
    } finally {
      setLoadingKey(null)
    }
  }

  async function saveCodes() {
    if (!referralCode.trim() || !connectionCode.trim()) {
      setError('Add both a referral code and a connection code before saving.')
      return
    }

    setLoadingKey('codes')
    setFeedback(null)
    setError(null)
    try {
      const stakeholder = await ensureStakeholder()
      const response = await fetch(`/api/admin/material-engine/stakeholders/${stakeholder.id}/codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode,
          connectionCode,
        }),
      })
      const payload = await response.json().catch(() => ({ error: 'Could not save codes.' }))
      if (!response.ok) throw new Error(payload.error || 'Could not save codes.')

      await persistStep({
        metadataPatch: {
          referral_code: referralCode.trim(),
          connection_code: connectionCode.trim(),
          join_url: payload?.result?.codes?.join_url || null,
        },
        stepKey: 'codes',
        stepMetadataPatch: {
          referral_code: referralCode.trim(),
          connection_code: connectionCode.trim(),
          generation_status: payload?.result?.generationStatus || null,
        },
        markComplete: true,
      })

      if (payload?.result?.generationStatus === 'failed') {
        setFeedback('Codes saved.')
        setError(payload?.result?.generationError || 'Codes were saved, but generation is still blocked.')
      } else {
        setFeedback('Codes saved and materials generated.')
      }
      refetchAll()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the stakeholder codes.')
    } finally {
      setLoadingKey(null)
    }
  }

  async function saveCampaign() {
    if (!selectedCampaignId && !newCampaignName.trim()) {
      setError('Link an existing campaign or create one here first.')
      return
    }

    setLoadingKey('campaign')
    setFeedback(null)
    setError(null)
    try {
      const stakeholder = await ensureStakeholder()
      let campaignId = selectedCampaignId || null

      if (!campaignId) {
        const campaignResult = await (supabase.from('campaigns') as any)
          .insert({
            name: newCampaignName.trim(),
            description: campaignNotes.trim() || null,
            brand: flow.brand,
            city_id: contactCityId || flow.city?.id || stakeholder.city_id || null,
            start_date: new Date().toISOString().slice(0, 10),
            end_date: null,
            status: 'active',
            owner_id: flow.linkedProfile?.id || adminProfile?.id || null,
            metadata: {
              created_via: 'stakeholder_onboarding',
              onboarding_flow_id: flow.id,
              stakeholder_id: stakeholder.id,
            },
          })
          .select()
          .single()

        if (campaignResult.error) throw new Error(campaignResult.error.message)
        campaignId = (campaignResult.data as Campaign).id
      }

      await persistStep({
        metadataPatch: {
          campaign_id: campaignId,
          campaign_notes: campaignNotes.trim() || null,
        },
        flowPatch: {
          campaign_id: campaignId,
        },
        stepKey: 'campaign',
        stepMetadataPatch: {
          campaign_id: campaignId,
          campaign_notes: campaignNotes.trim() || null,
        },
        markComplete: true,
      })

      setFeedback('First campaign linked.')
      refetchAll()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the campaign step.')
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-surface-100 bg-gradient-to-r from-brand-50 via-white to-amber-50 px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-surface-900">{contactName || flow.name}</h2>
              <Badge variant="info"><Shield className="mr-1 h-3 w-3" />{roleLabel(flow.targetRole)}</Badge>
              <Badge variant={flow.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[flow.brand]?.label || flow.brand}</Badge>
              <Badge variant={flow.stage === 'live' ? 'success' : flow.stage === 'declined' ? 'danger' : 'default'}>
                {ONBOARDING_STAGES[flow.stage]?.label || flow.stage}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-surface-500">
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Started {formatDate(flow.started_at || flow.created_at)}</span>
              {contactCityId && cities.find((city) => city.id === contactCityId) && (
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{cities.find((city) => city.id === contactCityId)?.name}, {cities.find((city) => city.id === contactCityId)?.state}</span>
              )}
              {contactEmail && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{contactEmail}</span>}
              {contactPhone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{contactPhone}</span>}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:w-[360px]">
            <MiniMetric label="Account" value={flow.linkedProfile ? 'Linked' : 'Pending'} tone={flow.linkedProfile ? 'success' : 'warning'} />
            <MiniMetric label="Codes" value={flow.codes ? 'Ready' : 'Missing'} tone={flow.codes ? 'success' : 'warning'} />
            <MiniMetric label="Materials" value={`${generatedCount}`} tone={generatedCount > 0 ? 'success' : 'warning'} />
          </div>
        </div>
        <div className="mt-5">
          <ProgressSteps steps={progress.map((item) => ({ ...item, current: activeStep === definitions.find((definition) => definition.title === item.label)?.key }))} />
        </div>
      </div>

      <CardContent className="space-y-5 p-5">
        {feedback && <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{feedback}</div>}
        {error && <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>}

        <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {definitions.map((definition) => (
                <button
                  key={definition.key}
                  type="button"
                  onClick={() => setActiveStep(definition.key)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${activeStep === definition.key ? 'border-brand-300 bg-brand-50 shadow-sm' : 'border-surface-200 bg-surface-50 hover:border-surface-300 hover:bg-surface-0'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${activeStep === definition.key ? 'text-brand-700' : 'text-surface-900'}`}>{definition.title}</p>
                    {stepsByKey.get(definition.key)?.is_completed ? <CheckCircle2 className="h-4 w-4 text-success-600" /> : <AlertCircle className="h-4 w-4 text-surface-400" />}
                  </div>
                  <p className="mt-2 text-xs text-surface-500">{definition.description}</p>
                </button>
              ))}
            </div>

            {activeStep === 'contact' && (
              <StepCard
                title="Initial contact workspace"
                description="Save the stakeholder details, local context, and outreach summary right here."
                actionLabel={loadingKey === 'contact' ? 'Saving...' : 'Save contact step'}
                actionLoading={loadingKey === 'contact'}
                onAction={() => void saveContact()}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Stakeholder name"><Input value={contactName} onChange={(event) => setContactName(event.target.value)} /></Field>
                  <Field label="Contact status">
                    <select value={contactStatus} onChange={(event) => setContactStatus(event.target.value)} className={SELECT_CLASS}>
                      <option value="lead">Lead</option>
                      <option value="contacted">Contacted</option>
                      <option value="interested">Interested</option>
                      <option value="ready">Ready</option>
                    </select>
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Email"><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></Field>
                  <Field label="Phone"><Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></Field>
                </div>
                <Field label="Home city">
                  <select value={contactCityId} onChange={(event) => setContactCityId(event.target.value)} className={SELECT_CLASS}>
                    <option value="">No city yet</option>
                    {cities.map((city) => <option key={city.id} value={city.id}>{city.name}, {city.state}</option>)}
                  </select>
                </Field>
                <Field label="Operator notes">
                  <Textarea rows={4} value={contactNotes} onChange={(event) => setContactNotes(event.target.value)} placeholder="What was said, why they fit, and what matters next?" />
                </Field>
              </StepCard>
            )}

            {activeStep === 'agreement' && (
              <StepCard
                title="Agreement and terms"
                description="Confirm the stakeholder is aligned before you create the account."
                actionLabel={loadingKey === 'agreement' ? 'Saving...' : 'Save agreement step'}
                actionLoading={loadingKey === 'agreement'}
                onAction={() => void saveAgreement()}
              >
                <label className="flex items-start gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm">
                  <input type="checkbox" checked={agreementShared} onChange={(event) => setAgreementShared(event.target.checked)} className="mt-1 h-4 w-4 rounded border-surface-300" />
                  <span><span className="block font-medium text-surface-900">Terms shared</span><span className="mt-1 block text-surface-500">The role scope, expectations, and brand context have been explained.</span></span>
                </label>
                <label className="flex items-start gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm">
                  <input type="checkbox" checked={agreementConfirmed} onChange={(event) => setAgreementConfirmed(event.target.checked)} className="mt-1 h-4 w-4 rounded border-surface-300" />
                  <span><span className="block font-medium text-surface-900">Ready to continue</span><span className="mt-1 block text-surface-500">They agreed to move into account creation and activation setup.</span></span>
                </label>
                <Field label="Agreement notes">
                  <Textarea rows={4} value={agreementNotes} onChange={(event) => setAgreementNotes(event.target.value)} placeholder="Capture timing, constraints, compensation notes, or follow-up context." />
                </Field>
              </StepCard>
            )}

            {activeStep === 'account' && (
              <StepCard
                title="Create and link account"
                description="Invite the stakeholder into the correct shell and link the profile right here."
                actionLabel={loadingKey === 'account' ? 'Sending...' : flow.linkedProfile ? 'Refresh linked account' : 'Invite and link account'}
                actionLoading={loadingKey === 'account'}
                onAction={() => void createAccount()}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Invite email"><Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></Field>
                  <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Workspace</p>
                    <p className="mt-2 font-medium text-surface-900">{roleLabel(flow.targetRole)}</p>
                    <p className="mt-1 text-sm text-surface-500">{flow.targetRole === 'launch_partner' ? 'City growth and launch ownership' : flow.targetRole === 'influencer' ? 'Referral and sharing' : 'Field outreach and execution'}</p>
                  </div>
                </div>
                {flow.linkedProfile ? (
                  <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
                    <span className="font-medium text-success-800">{flow.linkedProfile.full_name}</span> is linked to this flow.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
                    The account is not linked yet. Invite it here and the page will connect the profile automatically.
                  </div>
                )}
              </StepCard>
            )}

            {activeStep === 'codes' && (
              <StepCard
                title="QR and referral setup"
                description="Save the stakeholder codes here and let the material engine generate the personalized assets automatically."
                actionLabel={loadingKey === 'codes' ? 'Saving...' : 'Save codes and generate'}
                actionLoading={loadingKey === 'codes'}
                onAction={() => void saveCodes()}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Referral code"><Input value={referralCode} onChange={(event) => setReferralCode(event.target.value)} placeholder="sunrise-yoga" /></Field>
                  <Field label="Connection code"><Input value={connectionCode} onChange={(event) => setConnectionCode(event.target.value)} placeholder="sunrise-yoga-studio" /></Field>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <MiniMetric label="Task" value={(flow.adminTask?.status || 'needs_setup').replace(/_/g, ' ')} tone={taskBadge(flow.adminTask?.status) === 'success' ? 'success' : 'warning'} />
                  <MiniMetric label="Templates" value={`${matchingTemplateCount}`} tone={matchingTemplateCount > 0 ? 'success' : 'warning'} />
                  <MiniMetric label="Generated" value={`${generatedCount}`} tone={generatedCount > 0 ? 'success' : 'warning'} />
                </div>
                {joinUrl && <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">Join URL: <span className="font-medium text-surface-900">{joinUrl.replace(/^https?:\/\//, '')}</span></div>}
                {linkedGenerated.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-surface-900">Generated materials</p>
                    {linkedGenerated.map(({ generated, material }) => (
                      <div key={generated.id} className="flex items-center justify-between gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-surface-900">{material?.title || generated.generated_file_name || 'Generated asset'}</p>
                          {material?.metadata && (
                            <p className="text-surface-500">{String(((material.metadata as Record<string, unknown>).automation_template_folder as string) || '')}</p>
                          )}
                        </div>
                        {material?.file_url ? (
                          <a href={material.file_url} download className="font-medium text-brand-700 hover:underline">Download</a>
                        ) : (
                          <Badge variant="default">{generated.generation_status}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </StepCard>
            )}

            {activeStep === 'campaign' && (
              <StepCard
                title="First campaign"
                description="Attach the first campaign or create one here so this stakeholder can actually start operating."
                actionLabel={loadingKey === 'campaign' ? 'Saving...' : 'Save first campaign'}
                actionLoading={loadingKey === 'campaign'}
                onAction={() => void saveCampaign()}
              >
                <Field label="Link an existing campaign">
                  <select value={selectedCampaignId} onChange={(event) => setSelectedCampaignId(event.target.value)} className={SELECT_CLASS}>
                    <option value="">Create a new campaign instead</option>
                    {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                  </select>
                </Field>
                {!selectedCampaignId && (
                  <Field label="New campaign name">
                    <Input value={newCampaignName} onChange={(event) => setNewCampaignName(event.target.value)} placeholder={flow.targetRole === 'launch_partner' ? `${contactName || flow.name} City Launch` : `${contactName || flow.name} First Campaign`} />
                  </Field>
                )}
                <Field label="Campaign notes">
                  <Textarea rows={4} value={campaignNotes} onChange={(event) => setCampaignNotes(event.target.value)} placeholder="What should this stakeholder own first?" />
                </Field>
                {flow.campaign && (
                  <Link href={`/campaigns/${flow.campaign.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
                    Open linked campaign
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </StepCard>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Readiness snapshot</CardTitle>
                <CardDescription>What is ready, what is blocked, and what still needs operator attention.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <MiniMetric label="Contact" value={contactEmail || contactPhone ? 'Ready' : 'Missing'} tone={contactEmail || contactPhone ? 'success' : 'warning'} />
                <MiniMetric label="Agreement" value={agreementConfirmed ? 'Confirmed' : 'Waiting'} tone={agreementConfirmed ? 'success' : 'warning'} />
                <MiniMetric label="Account" value={flow.linkedProfile ? 'Linked' : 'Pending'} tone={flow.linkedProfile ? 'success' : 'warning'} />
                <MiniMetric label="Codes" value={flow.codes ? 'Saved' : 'Missing'} tone={flow.codes ? 'success' : 'warning'} />
                <MiniMetric label="Materials" value={generatedCount > 0 ? `${generatedCount} ready` : 'Waiting'} tone={generatedCount > 0 ? 'success' : 'warning'} />
                <MiniMetric label="Campaign" value={flow.campaign ? 'Linked' : 'Missing'} tone={flow.campaign ? 'success' : 'warning'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blocked / waiting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {blockers.length === 0 ? (
                  <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
                    Everything needed for this stakeholder is connected and ready.
                  </div>
                ) : (
                  blockers.map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connected records</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ConnectedLink label="Stakeholder record" value={flow.stakeholder?.name || 'Pending creation'} href={flow.stakeholder ? `/admin/stakeholders/${flow.stakeholder.id}` : undefined} />
                <ConnectedLink label="Join URL" value={joinUrl ? joinUrl.replace(/^https?:\/\//, '') : 'Not ready yet'} href={joinUrl || undefined} external />
                <ConnectedLink label="Campaign" value={flow.campaign?.name || 'Not linked'} href={flow.campaign ? `/campaigns/${flow.campaign.id}` : undefined} />
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StepCard({
  title,
  description,
  actionLabel,
  actionLoading,
  onAction,
  children,
}: {
  title: string
  description: string
  actionLabel: string
  actionLoading: boolean
  onAction: () => void
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <Button onClick={onAction} disabled={actionLoading}>
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-surface-700">{label}</label>
      {children}
    </div>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className={`mt-2 text-sm font-medium ${tone === 'success' ? 'text-success-700' : 'text-warning-700'}`}>{value}</p>
    </div>
  )
}

function ConnectedLink({
  label,
  value,
  href,
  external = false,
}: {
  label: string
  value: string
  href?: string
  external?: boolean
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      {href ? (
        external ? (
          <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
            {value}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <Link href={href} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
            {value}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )
      ) : (
        <p className="mt-2 text-sm text-surface-700">{value}</p>
      )}
    </div>
  )
}
