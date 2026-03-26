'use client'

import * as React from 'react'
import { UserPlus, Plus, ArrowRight, Clock, User, Calendar, Shield, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ProgressSteps } from '@/components/ui/progress-steps'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ROLES, BRANDS, ONBOARDING_STAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/client'
import type { OnboardingFlow, OnboardingStep, UserRole } from '@/lib/types/database'

interface FlowWithSteps extends OnboardingFlow {
  steps: OnboardingStep[]
  profile_name: string | null
}

function useStakeholderFlows() {
  const supabase = React.useMemo(() => createClient(), [])
  const [data, setData] = React.useState<FlowWithSteps[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refetchKey, setRefetchKey] = React.useState(0)

  React.useEffect(() => {
    async function fetch() {
      setLoading(true)
      const { data: flows } = await supabase
        .from('onboarding_flows')
        .select('*')
        .eq('entity_type', 'stakeholder')
        .order('created_at', { ascending: false })

      const flowList = (flows || []) as OnboardingFlow[]

      if (flowList.length === 0) {
        setData([])
        setLoading(false)
        return
      }

      // Fetch steps for all flows
      const flowIds = flowList.map(f => f.id)
      const { data: steps } = await supabase
        .from('onboarding_steps')
        .select('*')
        .in('flow_id', flowIds)
        .order('sort_order', { ascending: true })

      const stepList = (steps || []) as OnboardingStep[]
      const stepsByFlow: Record<string, OnboardingStep[]> = {}
      for (const s of stepList) {
        if (!stepsByFlow[s.flow_id]) stepsByFlow[s.flow_id] = []
        stepsByFlow[s.flow_id].push(s)
      }

      // Fetch profile names for entity_ids
      const entityIds = flowList.map(f => f.entity_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', entityIds)

      const nameMap: Record<string, string> = {}
      if (profiles) {
        for (const p of profiles as { id: string; full_name: string }[]) nameMap[p.id] = p.full_name
      }

      const enriched: FlowWithSteps[] = flowList.map(f => ({
        ...f,
        steps: stepsByFlow[f.id] || [],
        profile_name: nameMap[f.entity_id] || null,
      }))

      setData(enriched)
      setLoading(false)
    }
    fetch()
  }, [supabase, refetchKey])

  return { data, loading, refetch: () => setRefetchKey(k => k + 1) }
}

const STAKEHOLDER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'intern', label: 'Intern' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'affiliate', label: 'Affiliate' },
  { value: 'business_onboarding', label: 'Onboarding Partner' },
]

const DEFAULT_STEPS: Record<string, string[]> = {
  volunteer: ['Submit application', 'Review & approve', 'Create account', 'Assign materials & QR codes', 'Orientation call', 'First assignment'],
  intern: ['Applications received', 'Interview & select', 'Create accounts', 'Assign training materials', 'Training week', 'Field assignment'],
  influencer: ['Outreach & contact', 'Agreement & terms', 'Create account', 'Set up QR & referral links', 'First campaign'],
  affiliate: ['Outreach & contact', 'Agreement & terms', 'Create account', 'Set up referral links', 'Activate'],
  business_onboarding: ['Identify partner', 'Initial meeting', 'Create account', 'Training materials', 'First assignment'],
}

export default function StakeholderOnboardingPage() {
  const { profile } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])
  const { data: flows, loading, refetch } = useStakeholderFlows()
  const [addOpen, setAddOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [role, setRole] = React.useState<UserRole>('volunteer')
  const [brand, setBrand] = React.useState<string>('localvip')
  const [saving, setSaving] = React.useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    // Create the flow
    const result = await (supabase
      .from('onboarding_flows') as any)
      .insert({
        name: name.trim(),
        entity_type: 'stakeholder',
        entity_id: profile.id,
        brand: brand,
        stage: 'lead',
        owner_id: profile.id,
        campaign_id: null,
        metadata: { target_role: role },
      })
      .select('id')
      .single()
    const flow = result?.data as { id: string } | null

    if (flow) {
      // Create default steps for the selected role
      const stepTitles = DEFAULT_STEPS[role] || DEFAULT_STEPS.volunteer
      const stepsToInsert = stepTitles.map((title: string, i: number) => ({
        flow_id: flow.id,
        title,
        description: null,
        sort_order: i,
        is_required: true,
        is_completed: false,
        completed_by: null,
        completed_at: null,
        metadata: null,
      }))
      await (supabase.from('onboarding_steps') as any).insert(stepsToInsert)
    }

    setSaving(false)
    setAddOpen(false)
    setName('')
    setRole('volunteer')
    setBrand('localvip')
    refetch()
  }

  const handleToggleStep = async (flowId: string, stepId: string, completed: boolean) => {
    await (supabase
      .from('onboarding_steps') as any)
      .update({
        is_completed: !completed,
        completed_by: !completed ? profile.id : null,
        completed_at: !completed ? new Date().toISOString() : null,
      })
      .eq('id', stepId)
    refetch()
  }

  return (
    <div>
      <PageHeader
        title="Stakeholder Onboarding"
        description="Bring new volunteers, interns, influencers, and partners into the system. Every step tracked."
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Start Onboarding</Button>}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      ) : flows.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-8 w-8" />}
          title="No stakeholder onboarding flows"
          description="Start onboarding a new team member to see it tracked here."
          action={{ label: 'Start Onboarding', onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="space-y-4">
          {flows.map(flow => {
            const targetRole = (flow.metadata as Record<string, unknown>)?.target_role as UserRole | undefined
            const currentStepIdx = flow.steps.findIndex(s => !s.is_completed)
            const nextStep = currentStepIdx >= 0 ? flow.steps[currentStepIdx] : null
            return (
              <Card key={flow.id} className="transition-shadow hover:shadow-card-hover">
                <CardContent className="py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold text-surface-900">
                          {flow.profile_name || flow.name}
                        </h3>
                        {targetRole && (
                          <Badge variant="info"><Shield className="h-3 w-3 mr-0.5" />{ROLES[targetRole]?.label || targetRole}</Badge>
                        )}
                        <Badge variant={flow.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[flow.brand]?.label || flow.brand}</Badge>
                        <Badge variant={flow.stage === 'live' || flow.stage === 'onboarded' ? 'success' : flow.stage === 'declined' ? 'danger' : 'default'}>
                          {ONBOARDING_STAGES[flow.stage]?.label || flow.stage}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Started {formatDate(flow.started_at || flow.created_at)}</span>
                      </div>
                      <div className="mt-4">
                        <ProgressSteps
                          steps={flow.steps.map((s, i) => ({
                            label: s.title,
                            completed: s.is_completed,
                            current: i === currentStepIdx,
                          }))}
                        />
                      </div>
                    </div>
                    <div className="lg:w-72 lg:pl-4 lg:border-l lg:border-surface-100">
                      <div className="rounded-lg bg-surface-50 p-3">
                        <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Next Step</p>
                        {nextStep ? (
                          <>
                            <p className="text-sm text-surface-700 font-medium">{nextStep.title}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="flex items-center gap-1 text-xs text-surface-400">
                                <Clock className="h-3 w-3" />Step {currentStepIdx + 1} of {flow.steps.length}
                              </span>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleToggleStep(flow.id, nextStep.id, nextStep.is_completed)}
                              >
                                Complete <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-green-600 font-medium">All steps completed ✓</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Stakeholder Onboarding</DialogTitle>
            <DialogDescription>Create a new onboarding flow for a volunteer, intern, influencer, or partner.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Taylor Reed" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Role</label>
              <Select value={role} onValueChange={v => setRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAKEHOLDER_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Brand</label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BRANDS).map(([key, b]) => (
                    <SelectItem key={key} value={key}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>
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
