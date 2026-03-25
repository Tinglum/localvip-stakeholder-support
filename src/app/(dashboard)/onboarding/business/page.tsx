'use client'

import * as React from 'react'
import {
  Store, ArrowRight, Clock, CheckCircle2, AlertCircle,
  User, Calendar, Plus, ChevronRight, Eye,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProgressSteps } from '@/components/ui/progress-steps'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

// ─── Demo pipeline data ─────────────────────────────────────

const DEMO_FLOWS = [
  {
    id: '1',
    business_name: 'Main Street Bakery',
    owner: 'Alex Rivera',
    stage: 'in_progress' as const,
    started_at: '2024-02-15',
    steps: [
      { title: 'Initial contact', completed: true },
      { title: 'Send one-pager', completed: true },
      { title: 'Follow-up meeting', completed: true },
      { title: 'Sign agreement', completed: false, current: true },
      { title: 'Set up POS', completed: false },
      { title: 'Go live', completed: false },
    ],
    next_action: 'Schedule agreement signing with owner',
    next_action_date: '2024-03-28',
  },
  {
    id: '2',
    business_name: 'River Cafe',
    owner: 'Jordan Taylor',
    stage: 'onboarded' as const,
    started_at: '2024-01-20',
    steps: [
      { title: 'Initial contact', completed: true },
      { title: 'Send one-pager', completed: true },
      { title: 'Follow-up meeting', completed: true },
      { title: 'Sign agreement', completed: true },
      { title: 'Set up POS', completed: true },
      { title: 'Go live', completed: false, current: true },
    ],
    next_action: 'Verify POS integration is working',
    next_action_date: '2024-03-25',
  },
  {
    id: '3',
    business_name: 'Sunset Yoga Studio',
    owner: 'Casey Adams',
    stage: 'interested' as const,
    started_at: '2024-03-10',
    steps: [
      { title: 'Initial contact', completed: true },
      { title: 'Send one-pager', completed: true },
      { title: 'Follow-up meeting', completed: false, current: true },
      { title: 'Sign agreement', completed: false },
      { title: 'Set up POS', completed: false },
      { title: 'Go live', completed: false },
    ],
    next_action: 'Call owner to schedule follow-up meeting',
    next_action_date: '2024-03-26',
  },
  {
    id: '4',
    business_name: 'Green Leaf Market',
    owner: 'Alex Rivera',
    stage: 'contacted' as const,
    started_at: '2024-03-15',
    steps: [
      { title: 'Initial contact', completed: true },
      { title: 'Send one-pager', completed: false, current: true },
      { title: 'Follow-up meeting', completed: false },
      { title: 'Sign agreement', completed: false },
      { title: 'Set up POS', completed: false },
      { title: 'Go live', completed: false },
    ],
    next_action: 'Email one-pager and schedule a call',
    next_action_date: '2024-03-24',
  },
  {
    id: '5',
    business_name: 'Tech Hub Coworking',
    owner: 'Casey Adams',
    stage: 'lead' as const,
    started_at: '2024-03-18',
    steps: [
      { title: 'Initial contact', completed: false, current: true },
      { title: 'Send one-pager', completed: false },
      { title: 'Follow-up meeting', completed: false },
      { title: 'Sign agreement', completed: false },
      { title: 'Set up POS', completed: false },
      { title: 'Go live', completed: false },
    ],
    next_action: 'Make first contact — visit or call',
    next_action_date: '2024-03-24',
  },
]

const STAGE_ORDER = ['lead', 'contacted', 'interested', 'in_progress', 'onboarded', 'live']

function getStageBadgeVariant(stage: string) {
  switch (stage) {
    case 'lead': return 'default' as const
    case 'contacted': case 'interested': return 'info' as const
    case 'in_progress': return 'warning' as const
    case 'onboarded': case 'live': return 'success' as const
    case 'paused': return 'warning' as const
    case 'declined': return 'danger' as const
    default: return 'default' as const
  }
}

export default function BusinessOnboardingPage() {
  const { isAdmin } = useAuth()
  const [view, setView] = React.useState<'pipeline' | 'list'>('pipeline')

  // Pipeline counts
  const stageCounts = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = DEMO_FLOWS.filter(f => f.stage === stage).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div>
      <PageHeader
        title="Business Onboarding"
        description="Track every business from first contact to going live. Each step has a clear next action."
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-surface-200 overflow-hidden">
              <button
                onClick={() => setView('pipeline')}
                className={`px-3 py-1.5 text-xs font-medium ${view === 'pipeline' ? 'bg-surface-100 text-surface-700' : 'text-surface-400'}`}
              >
                Pipeline
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-xs font-medium ${view === 'list' ? 'bg-surface-100 text-surface-700' : 'text-surface-400'}`}
              >
                List
              </button>
            </div>
            <Button>
              <Plus className="h-4 w-4" /> Start Onboarding
            </Button>
          </div>
        }
      />

      {/* Pipeline stage summary */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STAGE_ORDER.map(stage => (
          <div
            key={stage}
            className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 px-3 py-2"
          >
            <Badge variant={getStageBadgeVariant(stage)} dot>
              {ONBOARDING_STAGES[stage as keyof typeof ONBOARDING_STAGES]?.label || stage}
            </Badge>
            <span className="text-sm font-semibold text-surface-700">{stageCounts[stage] || 0}</span>
          </div>
        ))}
      </div>

      {/* Onboarding cards */}
      {DEMO_FLOWS.length === 0 ? (
        <EmptyState
          icon={<Store className="h-8 w-8" />}
          title="No onboarding flows yet"
          description="Start onboarding your first business to see it tracked here."
          action={{ label: 'Start Onboarding', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-4">
          {DEMO_FLOWS.sort((a, b) => {
            // Sort by urgency: earliest next_action_date first
            return new Date(a.next_action_date).getTime() - new Date(b.next_action_date).getTime()
          }).map(flow => (
            <Card key={flow.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left: info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-semibold text-surface-900">{flow.business_name}</h3>
                      <Badge variant={getStageBadgeVariant(flow.stage)} dot>
                        {ONBOARDING_STAGES[flow.stage]?.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" /> {flow.owner}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Started {formatDate(flow.started_at)}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                      <ProgressSteps
                        steps={flow.steps.map(s => ({
                          label: s.title,
                          completed: s.completed,
                          current: s.current,
                        }))}
                      />
                    </div>
                  </div>

                  {/* Right: next action */}
                  <div className="lg:w-72 lg:pl-4 lg:border-l lg:border-surface-100">
                    <div className="rounded-lg bg-surface-50 p-3">
                      <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Next Action</p>
                      <p className="text-sm text-surface-700 font-medium">{flow.next_action}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-surface-400">
                          <Clock className="h-3 w-3" />
                          Due {formatDate(flow.next_action_date)}
                        </span>
                        <Button variant="default" size="sm">
                          Take Action <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
