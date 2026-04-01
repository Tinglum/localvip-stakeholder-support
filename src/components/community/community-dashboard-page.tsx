'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Heart,
  Loader2,
  Megaphone,
  MessageSquare,
  Plus,
  QrCode,
  Rocket,
  Send,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { ProgressSteps } from '@/components/ui/progress-steps'
import { StakeholderActionQueue } from '@/components/dashboard/stakeholder-action-queue'
import { useAuth } from '@/lib/auth/context'
import {
  useBusinesses,
  useCauses,
  useContacts,
  useGeneratedMaterials,
  useMaterials,
  useNoteInsert,
  useNotes,
  useOnboardingFlows,
  useOnboardingSteps,
  useQrCodes,
  useStakeholderCodes,
  useStakeholders,
  useTaskInsert,
  useTaskUpdate,
  useTasks,
} from '@/lib/supabase/hooks'
import {
  computeCauseExecutionSteps,
  computeCauseReadiness,
  getCauseNextActions,
} from '@/lib/cause-execution'
import { buildStakeholderJoinUrl, MATERIAL_LIBRARY_FOLDERS, getMaterialLibraryFolderMeta } from '@/lib/material-engine'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { TaskPriority } from '@/lib/types/database'

type DashboardTab = 'overview' | 'businesses' | 'materials' | 'qr' | 'tasks' | 'activity'

export function CommunityDashboardPage() {
  const { profile, roleLabel } = useAuth()
  const [activeTab, setActiveTab] = React.useState<DashboardTab>('overview')
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()
  const { data: businesses } = useBusinesses()

  const scopedCause = React.useMemo(
    () => causes.find((cause) => cause.owner_id === profile.id || cause.organization_id === profile.organization_id) || null,
    [causes, profile.id, profile.organization_id]
  )

  const supporterContacts = React.useMemo(
    () => contacts.filter((contact) => contact.cause_id && contact.cause_id === scopedCause?.id),
    [contacts, scopedCause?.id]
  )

  const { data: stakeholderRecords } = useStakeholders({ cause_id: scopedCause?.id || '__none__' })
  const scopedStakeholder = React.useMemo(
    () => stakeholderRecords.find((s) => s.cause_id === scopedCause?.id) || null,
    [scopedCause?.id, stakeholderRecords]
  )

  const { data: stakeholderCodes } = useStakeholderCodes({ stakeholder_id: scopedStakeholder?.id || '__none__' })
  const codes = stakeholderCodes[0] || null

  const { data: qrCodes } = useQrCodes({ cause_id: scopedCause?.id || '__none__' })
  const { data: generatedMaterials } = useGeneratedMaterials({ stakeholder_id: scopedStakeholder?.id || '__none__' })
  const { data: allMaterials } = useMaterials()
  const { data: flows } = useOnboardingFlows({ entity_type: 'cause', entity_id: scopedCause?.id || '__none__' })
  const flow = flows[0] || null
  const { data: steps } = useOnboardingSteps({ flow_id: flow?.id || '__none__' })
  const { data: tasks, refetch: refetchTasks } = useTasks({ entity_id: scopedCause?.id || '__none__' })
  const { data: notes, refetch: refetchNotes } = useNotes({ entity_id: scopedCause?.id || '__none__' })

  const { insert: insertTask, loading: insertingTask } = useTaskInsert()
  const { update: updateTask } = useTaskUpdate()
  const { insert: insertNote, loading: insertingNote } = useNoteInsert()

  const supportingBusinesses = React.useMemo(
    () => businesses.filter((business) => business.linked_cause_id === scopedCause?.id),
    [businesses, scopedCause?.id]
  )

  const isSchool = scopedCause?.type === 'school'
  const entityLabel = isSchool ? 'School' : 'Cause'

  // Execution engine
  const executionSteps = React.useMemo(() => {
    if (!scopedCause) return []
    return computeCauseExecutionSteps({
      cause: scopedCause,
      steps,
      codes,
      generatedMaterials,
      qrCodes,
      outreachCount: 0,
      linkedBusinessCount: supportingBusinesses.length,
    })
  }, [scopedCause, steps, codes, generatedMaterials, qrCodes, supportingBusinesses.length])

  const readiness = React.useMemo(() => {
    if (!scopedCause) return { score: 0, total: 8, percent: 0, checks: [] }
    return computeCauseReadiness({
      cause: scopedCause,
      steps,
      codes,
      generatedMaterials,
      qrCodes,
      outreachCount: 0,
      linkedBusinessCount: supportingBusinesses.length,
    })
  }, [scopedCause, steps, codes, generatedMaterials, qrCodes, supportingBusinesses.length])

  const nextActions = React.useMemo(() => {
    if (!scopedCause) return []
    return getCauseNextActions({
      cause: scopedCause,
      steps: executionSteps,
      codes,
      generatedMaterials,
      qrCodes,
      outreachCount: 0,
      linkedBusinessCount: supportingBusinesses.length,
      openTaskCount: tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
    })
  }, [scopedCause, executionSteps, codes, generatedMaterials, qrCodes, supportingBusinesses.length, tasks])

  const joinUrl = React.useMemo(() => {
    if (codes?.join_url) return codes.join_url
    if (!codes?.connection_code) return ''
    return buildStakeholderJoinUrl(isSchool ? 'school' : 'cause', codes.connection_code)
  }, [codes?.join_url, codes?.connection_code, isSchool])

  const generatedCount = generatedMaterials.filter(m => m.generation_status === 'generated' && !!m.generated_file_url).length
  const materialMap = React.useMemo(() => new Map(allMaterials.map(m => [m.id, m])), [allMaterials])
  const activeMaterialPairs = React.useMemo(() =>
    generatedMaterials
      .filter(m => m.generation_status === 'generated' && m.is_active !== false)
      .map(gm => ({ generated: gm, material: gm.material_id ? materialMap.get(gm.material_id) || null : null })),
    [generatedMaterials, materialMap],
  )
  const openTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')

  // Action queue items
  const immediateItems = React.useMemo(() => {
    const items = []

    if (qrCodes.length === 0) {
      items.push({
        id: 'community-qr',
        title: 'Set up your supporter QR',
        detail: 'Your community needs one clean QR path so parents, supporters, and local families can actually join.',
        href: '/community/share',
        ctaLabel: 'Open share tools',
        priority: 'high' as const,
        badge: 'Supporter flow',
      })
    }

    if (generatedCount === 0) {
      items.push({
        id: 'community-materials',
        title: 'Get your materials ready',
        detail: isSchool
          ? 'Your school flyers, parent cards, and PTA materials need to be ready before outreach.'
          : 'Your cause flyers, supporter cards, and outreach materials need to be ready.',
        href: '#materials',
        ctaLabel: 'View materials',
        priority: 'high' as const,
        badge: 'Materials',
      })
    }

    if (supporterContacts.length < 10) {
      items.push({
        id: 'community-supporters',
        title: 'Get your first 10 supporters',
        detail: 'Start with the people who already care most about your school or cause.',
        href: '/community/supporters',
        ctaLabel: 'Open supporters',
        priority: 'medium' as const,
        badge: `${supporterContacts.length} supporters`,
      })
    }

    if (supportingBusinesses.length === 0) {
      items.push({
        id: 'community-businesses',
        title: 'Connect your first business',
        detail: isSchool
          ? 'Your school needs at least one supporting business to turn the fundraising story into reality.'
          : 'Your cause needs at least one business supporter to show real local momentum.',
        href: '#businesses',
        ctaLabel: 'View business pipeline',
        priority: 'medium' as const,
        badge: 'Business support',
      })
    }

    if (openTasks.length > 0) {
      items.push({
        id: 'community-tasks',
        title: `${openTasks.length} task${openTasks.length === 1 ? '' : 's'} need attention`,
        detail: 'Review and complete your pending tasks to keep moving forward.',
        href: '#tasks',
        ctaLabel: 'View tasks',
        priority: 'medium' as const,
        badge: 'Tasks',
      })
    }

    return items
  }, [generatedCount, qrCodes.length, supporterContacts.length, supportingBusinesses.length, openTasks.length, isSchool])

  const suggestedItems = React.useMemo(() => [
    {
      id: 'community-suggestion-event',
      title: 'Share at your next event',
      detail: 'Use your QR at the next school, church, or community gathering.',
      href: '/community/share',
      ctaLabel: 'Open share tools',
    },
    {
      id: 'community-suggestion-business',
      title: 'Follow up with the next business',
      detail: 'Keep building the business side so the supporter story has real local momentum.',
      href: '#businesses',
      ctaLabel: 'View businesses',
    },
    {
      id: 'community-suggestion-message',
      title: isSchool ? 'Send the parent message again' : 'Share with your community',
      detail: 'A short reminder in a parent group or newsletter often creates the next wave of supporters.',
      href: '/community/share',
      ctaLabel: 'Open share tools',
    },
  ], [isSchool])

  // ─── Task form ───
  const [taskTitle, setTaskTitle] = React.useState('')
  const [taskPriority, setTaskPriority] = React.useState<TaskPriority>('medium')

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim() || !scopedCause) return
    await insertTask({
      title: taskTitle,
      priority: taskPriority,
      status: 'pending',
      entity_type: 'cause',
      entity_id: scopedCause.id,
      created_by: profile.id,
    })
    setTaskTitle('')
    refetchTasks({ silent: true })
  }

  async function handleToggleTask(id: string, completed: boolean) {
    await updateTask(id, {
      status: completed ? 'completed' : 'pending',
      completed_at: completed ? new Date().toISOString() : null,
    })
    refetchTasks({ silent: true })
  }

  // ─── Note form ───
  const [noteContent, setNoteContent] = React.useState('')

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteContent.trim() || !scopedCause) return
    await insertNote({
      content: noteContent,
      entity_type: 'cause',
      entity_id: scopedCause.id,
      created_by: profile.id,
      is_internal: false,
    })
    setNoteContent('')
    refetchNotes({ silent: true })
  }

  // ─── No cause linked ───
  if (!scopedCause) {
    return (
      <EmptyState
        icon={<Heart className="h-8 w-8" />}
        title={`${roleLabel} dashboard coming online`}
        description="Once a school or cause record is linked to this account, your full operating dashboard will appear here."
      />
    )
  }

  const completedStepCount = executionSteps.filter(s => s.state === 'completed').length
  const stageIdx = ['lead', 'contacted', 'interested', 'in_progress', 'onboarded', 'live'].indexOf(scopedCause.stage)

  // ─── Tab config ───
  const tabs: Array<{ key: DashboardTab; label: string; icon: React.ReactNode; count?: number }> = [
    { key: 'overview', label: 'Overview', icon: <Rocket className="h-4 w-4" /> },
    { key: 'businesses', label: 'Businesses', icon: <Store className="h-4 w-4" />, count: supportingBusinesses.length },
    { key: 'materials', label: 'Materials', icon: <FileText className="h-4 w-4" />, count: generatedCount },
    { key: 'qr', label: 'QR & Codes', icon: <QrCode className="h-4 w-4" /> },
    { key: 'tasks', label: 'Tasks & Notes', icon: <ClipboardList className="h-4 w-4" />, count: openTasks.length },
    { key: 'activity', label: 'Activity', icon: <BarChart3 className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* ── Hero / Header ── */}
      <div className="rounded-2xl border border-surface-200 bg-gradient-to-r from-brand-50 to-surface-50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-surface-900">{scopedCause.name}</h1>
              <Badge variant={scopedCause.stage === 'live' ? 'success' : 'info'}>
                {ONBOARDING_STAGES[scopedCause.stage]?.label || scopedCause.stage}
              </Badge>
              <Badge variant="outline">{entityLabel}</Badge>
            </div>
            <p className="mt-1 text-sm text-surface-600">
              {scopedCause.city_id ? `City linked` : 'No city linked'} &middot;{' '}
              {supportingBusinesses.length} business{supportingBusinesses.length === 1 ? '' : 'es'} &middot;{' '}
              {supporterContacts.length} supporter{supporterContacts.length === 1 ? '' : 's'} &middot;{' '}
              {generatedCount} material{generatedCount === 1 ? '' : 's'} ready
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 w-32 rounded-full bg-surface-200">
                <div
                  className="h-2 rounded-full bg-brand-500 transition-all"
                  style={{ width: `${readiness.percent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-surface-600">{readiness.percent}% ready</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/community/share">
                <Megaphone className="h-4 w-4" /> Share & Grow
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/community/supporters">
                <Users className="h-4 w-4" /> Supporters
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Progress stepper ── */}
      <ProgressSteps
        steps={['Lead', 'Contacted', 'Interested', 'In Progress', 'Onboarded', 'Live'].map((label, idx) => ({
          label,
          completed: stageIdx > idx || scopedCause.stage === 'live',
          current: stageIdx === idx,
        }))}
      />

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-surface-200 bg-surface-50 p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total supporters" value={supporterContacts.length} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Supporting businesses" value={supportingBusinesses.length} icon={<Store className="h-5 w-5" />} />
            <StatCard label="Materials ready" value={generatedCount} icon={<FileText className="h-5 w-5" />} />
            <StatCard label="QR codes" value={qrCodes.length > 0 ? 'Active' : 'Not set up'} icon={<QrCode className="h-5 w-5" />} />
          </div>

          {/* Action queue + next steps */}
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <StakeholderActionQueue
              title="What to do next"
              description={`These are the actions that will move your ${entityLabel.toLowerCase()} forward right now.`}
              items={immediateItems}
              suggestions={suggestedItems}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Readiness Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {readiness.checks.map((check, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-1">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center ${check.met ? 'bg-success-100 text-success-600' : 'bg-surface-100 text-surface-400'}`}>
                      {check.met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                    </div>
                    <span className={`text-sm ${check.met ? 'text-surface-700' : 'text-surface-500'}`}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Next actions from engine */}
          {nextActions.length > 0 && (
            <Card className="border-l-4 border-l-brand-500">
              <CardContent className="py-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  <h3 className="text-sm font-semibold text-surface-800">Recommended actions</h3>
                </div>
                <ul className="space-y-1.5">
                  {nextActions.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-surface-600">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
                      {action}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Quick business summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Supporting Businesses
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('businesses')}>
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {supportingBusinesses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-6 py-8 text-center">
                  <Store className="mx-auto mb-3 h-8 w-8 text-surface-300" />
                  <p className="text-sm font-medium text-surface-700">No businesses connected yet</p>
                  <p className="mt-1 text-xs text-surface-500">
                    {isSchool ? 'Start reaching out to local businesses to support your school.' : 'Connect businesses to support your cause.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supportingBusinesses.slice(0, 4).map(biz => (
                    <div key={biz.id} className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{biz.name}</p>
                        <p className="text-xs text-surface-500">{biz.category || 'Local business'}</p>
                      </div>
                      <Badge variant={biz.stage === 'live' ? 'success' : biz.stage === 'onboarded' ? 'info' : 'default'}>
                        {ONBOARDING_STAGES[biz.stage]?.label || biz.stage}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── BUSINESSES TAB ── */}
      {activeTab === 'businesses' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-surface-900">Business Pipeline</h2>
              <p className="text-sm text-surface-500">
                {isSchool ? 'Businesses supporting your school' : 'Businesses supporting your cause'}
              </p>
            </div>
          </div>

          {/* Pipeline stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['lead', 'in_progress', 'onboarded', 'live'] as const).map(stage => {
              const count = supportingBusinesses.filter(b => b.stage === stage).length
              return (
                <Card key={stage}>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-surface-900">{count}</p>
                    <p className="text-xs text-surface-500">{ONBOARDING_STAGES[stage]?.label || stage}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Business list */}
          {supportingBusinesses.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Store className="mx-auto mb-3 h-10 w-10 text-surface-300" />
                  <h3 className="text-base font-semibold text-surface-800">Get your first business</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-surface-500">
                    {isSchool
                      ? 'Reach out to local businesses that your school families already visit. Start with the ones that will say yes first.'
                      : 'Start with businesses already connected to your cause community. They are most likely to support you.'}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <Button asChild size="sm">
                      <Link href="/community/share">
                        <Megaphone className="h-4 w-4" /> Share outreach materials
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {supportingBusinesses.map(biz => (
                <Card key={biz.id} className="transition-shadow hover:shadow-card-hover">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-surface-900">{biz.name}</p>
                          <Badge variant={biz.stage === 'live' ? 'success' : biz.stage === 'onboarded' ? 'info' : biz.stage === 'in_progress' ? 'warning' : 'default'}>
                            {ONBOARDING_STAGES[biz.stage]?.label || biz.stage}
                          </Badge>
                        </div>
                        <p className="text-xs text-surface-500">
                          {[biz.category, biz.address].filter(Boolean).join(' \u2022 ') || 'Local business'}
                        </p>
                        {biz.email || biz.phone ? (
                          <p className="text-xs text-surface-400">{[biz.email, biz.phone].filter(Boolean).join(' / ')}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {biz.stage === 'live' && (
                          <Badge variant="success" className="text-xs">Active</Badge>
                        )}
                        {biz.stage !== 'live' && biz.stage !== 'onboarded' && (
                          <span className="text-xs text-surface-400">Needs movement</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MATERIALS TAB ── */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-surface-900">Your Materials</h2>
              <p className="text-sm text-surface-500">
                Template-approved materials for your {entityLabel.toLowerCase()} — flyers, cards, and outreach assets
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/community/materials">
                <ExternalLink className="h-3.5 w-3.5" /> Full library
              </Link>
            </Button>
          </div>

          {activeMaterialPairs.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-surface-300" />
                  <h3 className="text-base font-semibold text-surface-800">No materials ready yet</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-surface-500">
                    Materials are generated by the system once your codes and QR setup are complete. Check your readiness checklist.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            MATERIAL_LIBRARY_FOLDERS.map(folder => {
              const folderItems = activeMaterialPairs.filter(({ generated }) => generated.library_folder === folder.value)
              if (folderItems.length === 0) return null
              const folderMeta = getMaterialLibraryFolderMeta(folder.value)
              return (
                <Card key={folder.value}>
                  <CardHeader>
                    <CardTitle>{folderMeta.label}</CardTitle>
                    <p className="text-sm text-surface-500">{folderMeta.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {folderItems.map(({ generated, material }) => (
                      <div key={generated.id} className="flex items-center justify-between gap-4 rounded-xl border border-surface-200 bg-white px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-surface-900 truncate">
                            {material?.title || generated.generated_file_name || 'Generated Material'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-surface-500">
                              {(material?.type || 'pdf').toUpperCase()} · v{generated.version_number || 1}
                            </span>
                            {generated.tags?.map(tag => <Badge key={tag} variant="default">{tag}</Badge>)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="success">Ready</Badge>
                          {(generated.generated_file_url || material?.file_url) && (
                            <a href={generated.generated_file_url || material?.file_url || ''} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open</Button>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* ── QR TAB ── */}
      {activeTab === 'qr' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-surface-900">QR Codes & Links</h2>
            <p className="text-sm text-surface-500">
              QR assets linked to your {entityLabel.toLowerCase()} for supporter signup and outreach
            </p>
          </div>

          {/* Codes section */}
          {codes && (
            <Card>
              <CardHeader>
                <CardTitle>Your Codes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-surface-50 px-4 py-3">
                  <div>
                    <p className="text-xs text-surface-500">Referral Code</p>
                    <p className="text-sm font-mono font-semibold text-surface-900">{codes.referral_code || '—'}</p>
                  </div>
                  {codes.referral_code && (
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(codes.referral_code!)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-surface-50 px-4 py-3">
                  <div>
                    <p className="text-xs text-surface-500">Connection Code</p>
                    <p className="text-sm font-mono font-semibold text-surface-900">{codes.connection_code || '—'}</p>
                  </div>
                  {codes.connection_code && (
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(codes.connection_code!)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {joinUrl && (
                  <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
                    <div>
                      <p className="text-xs text-brand-600">Supporter Join URL</p>
                      <p className="text-sm font-mono font-medium text-brand-800 break-all">{joinUrl}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(joinUrl)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* QR Codes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>QR Codes</CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link href="/community/share">
                    <QrCode className="h-3.5 w-3.5" /> Share tools
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {qrCodes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-6 py-8 text-center">
                  <QrCode className="mx-auto mb-3 h-8 w-8 text-surface-300" />
                  <p className="text-sm font-medium text-surface-700">No QR codes yet</p>
                  <p className="mt-1 text-xs text-surface-500">QR codes will appear once your codes and materials are set up.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {qrCodes.map(qr => (
                    <div key={qr.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-surface-900">{qr.name}</p>
                          <p className="text-xs text-surface-500">{qr.scan_count} scan{qr.scan_count === 1 ? '' : 's'}</p>
                        </div>
                        <Badge variant={qr.status === 'active' ? 'success' : 'default'}>{qr.status}</Badge>
                      </div>
                      <div className="mt-2">
                        <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(qr.redirect_url)}>
                          <Copy className="h-3.5 w-3.5" /> Copy link
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {!codes && (
            <Card className="border-l-4 border-l-warning-500">
              <CardContent className="py-4">
                <p className="text-sm text-surface-600">
                  Your referral and connection codes have not been set up yet. An admin will configure these as part of your onboarding.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── TASKS & NOTES TAB ── */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tasks */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Tasks
                  </CardTitle>
                  <Badge variant={openTasks.length > 0 ? 'warning' : 'success'}>
                    {openTasks.length} open
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <form onSubmit={handleAddTask} className="flex gap-2">
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    placeholder="Add a task..."
                    className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as TaskPriority)}
                    className="rounded-lg border border-surface-200 bg-surface-50 px-2 py-2 text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <Button type="submit" size="sm" disabled={insertingTask || !taskTitle.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </form>

                {tasks.length === 0 ? (
                  <p className="py-4 text-center text-sm text-surface-400">No tasks yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                    {tasks.map(task => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                          task.status === 'completed' ? 'bg-surface-50 opacity-60' : 'bg-white'
                        }`}
                      >
                        <button
                          onClick={() => handleToggleTask(task.id, task.status !== 'completed')}
                          className={`h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                            task.status === 'completed'
                              ? 'border-success-500 bg-success-500 text-white'
                              : 'border-surface-300 hover:border-brand-400'
                          }`}
                        >
                          {task.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                        </button>
                        <span className={`flex-1 text-sm ${task.status === 'completed' ? 'line-through text-surface-400' : 'text-surface-800'}`}>
                          {task.title}
                        </span>
                        <Badge variant={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'default'} className="text-[10px]">
                          {task.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <Button type="submit" size="sm" disabled={insertingNote || !noteContent.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </form>

                {notes.length === 0 ? (
                  <p className="py-4 text-center text-sm text-surface-400">No notes yet</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {notes.map(note => (
                      <div key={note.id} className="rounded-lg bg-surface-50 px-3 py-2.5">
                        <p className="text-sm text-surface-800">{note.content}</p>
                        <p className="mt-1 text-[10px] text-surface-400">{formatDate(note.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-surface-900">Activity & Engagement</h2>
            <p className="text-sm text-surface-500">Track supporter growth and engagement metrics</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total supporters" value={supporterContacts.length} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Supporting businesses" value={supportingBusinesses.length} icon={<Store className="h-5 w-5" />} />
            <StatCard label="QR scans" value={qrCodes.reduce((sum, qr) => sum + (qr.scan_count || 0), 0)} icon={<QrCode className="h-5 w-5" />} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Supporters</CardTitle>
            </CardHeader>
            <CardContent>
              {supporterContacts.length === 0 ? (
                <p className="py-4 text-center text-sm text-surface-400">No supporters yet. Share your QR code to start growing.</p>
              ) : (
                <div className="space-y-2">
                  {supporterContacts.slice(0, 10).map(contact => (
                    <div key={contact.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-50">
                      <div>
                        <p className="text-sm font-medium text-surface-800">{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Supporter'}</p>
                        <p className="text-xs text-surface-400">{contact.email || contact.phone || 'No contact info'}</p>
                      </div>
                      <p className="text-xs text-surface-400">{formatDate(contact.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
