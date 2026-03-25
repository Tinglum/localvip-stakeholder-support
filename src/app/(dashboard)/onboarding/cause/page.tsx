'use client'

import * as React from 'react'
import {
  Heart, ArrowRight, Clock, User, Calendar, Plus,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProgressSteps } from '@/components/ui/progress-steps'
import { EmptyState } from '@/components/ui/empty-state'
import { ONBOARDING_STAGES, BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

const DEMO_CAUSE_FLOWS = [
  {
    id: '1',
    cause_name: 'MLK Elementary School',
    type: 'school',
    brand: 'hato' as const,
    owner: 'Dr. Sarah Johnson',
    stage: 'in_progress' as const,
    started_at: '2024-02-01',
    steps: [
      { title: 'Register cause', completed: true },
      { title: 'Verify nonprofit status', completed: true },
      { title: 'Assign cause code', completed: true },
      { title: 'Link supporting businesses', completed: false, current: true },
      { title: 'Launch campaign', completed: false },
      { title: 'Active & receiving', completed: false },
    ],
    next_action: 'Connect 3 more businesses to HATO school campaign',
    next_action_date: '2024-03-30',
  },
  {
    id: '2',
    cause_name: 'Community Strong Foundation',
    type: 'nonprofit',
    brand: 'localvip' as const,
    owner: 'Marcus Williams',
    stage: 'onboarded' as const,
    started_at: '2024-01-10',
    steps: [
      { title: 'Register cause', completed: true },
      { title: 'Verify nonprofit status', completed: true },
      { title: 'Assign cause code', completed: true },
      { title: 'Link supporting businesses', completed: true },
      { title: 'Launch campaign', completed: true },
      { title: 'Active & receiving', completed: false, current: true },
    ],
    next_action: 'Review first month donation report',
    next_action_date: '2024-03-25',
  },
  {
    id: '3',
    cause_name: 'Grace Community Church',
    type: 'church',
    brand: 'localvip' as const,
    owner: 'Rick (Admin)',
    stage: 'interested' as const,
    started_at: '2024-03-12',
    steps: [
      { title: 'Register cause', completed: true },
      { title: 'Verify nonprofit status', completed: false, current: true },
      { title: 'Assign cause code', completed: false },
      { title: 'Link supporting businesses', completed: false },
      { title: 'Launch campaign', completed: false },
      { title: 'Active & receiving', completed: false },
    ],
    next_action: 'Request EIN and 501(c)(3) documentation',
    next_action_date: '2024-03-27',
  },
]

function getStageBadgeVariant(stage: string) {
  switch (stage) {
    case 'lead': return 'default' as const
    case 'contacted': case 'interested': return 'info' as const
    case 'in_progress': return 'warning' as const
    case 'onboarded': case 'live': return 'success' as const
    default: return 'default' as const
  }
}

export default function CauseOnboardingPage() {
  return (
    <div>
      <PageHeader
        title="Cause Onboarding"
        description="Onboard schools, nonprofits, and community organizations. Track every step."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Start Onboarding
          </Button>
        }
      />

      {DEMO_CAUSE_FLOWS.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-8 w-8" />}
          title="No cause onboarding flows yet"
          description="Start onboarding your first cause to track it here."
          action={{ label: 'Start Onboarding', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-4">
          {DEMO_CAUSE_FLOWS.map(flow => (
            <Card key={flow.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-semibold text-surface-900">{flow.cause_name}</h3>
                      <Badge variant={getStageBadgeVariant(flow.stage)} dot>
                        {ONBOARDING_STAGES[flow.stage]?.label}
                      </Badge>
                      <Badge variant={flow.brand === 'hato' ? 'hato' : 'info'}>
                        {BRANDS[flow.brand].label}
                      </Badge>
                      <Badge variant="outline">{flow.type}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" /> {flow.owner}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Started {formatDate(flow.started_at)}
                      </span>
                    </div>
                    <div className="mt-4">
                      <ProgressSteps steps={flow.steps.map(s => ({
                        label: s.title,
                        completed: s.completed,
                        current: s.current,
                      }))} />
                    </div>
                  </div>
                  <div className="lg:w-72 lg:pl-4 lg:border-l lg:border-surface-100">
                    <div className="rounded-lg bg-surface-50 p-3">
                      <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Next Action</p>
                      <p className="text-sm text-surface-700 font-medium">{flow.next_action}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-surface-400">
                          <Clock className="h-3 w-3" /> Due {formatDate(flow.next_action_date)}
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
