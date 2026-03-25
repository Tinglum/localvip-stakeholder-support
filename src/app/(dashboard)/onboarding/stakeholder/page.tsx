'use client'

import * as React from 'react'
import { UserPlus, Plus, ArrowRight, Clock, User, Calendar, Shield } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProgressSteps } from '@/components/ui/progress-steps'
import { EmptyState } from '@/components/ui/empty-state'
import { ROLES, BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { UserRole } from '@/lib/types/database'

const DEMO_STAKEHOLDER_FLOWS = [
  {
    id: 'sf-001', name: 'Taylor Reed', role: 'volunteer' as UserRole, brand: 'hato' as const,
    city: 'Birmingham', stage: 'in_progress',
    steps: [
      { title: 'Submit application', completed: true },
      { title: 'Review & approve', completed: true },
      { title: 'Create account', completed: true },
      { title: 'Assign materials & QR codes', completed: false, current: true },
      { title: 'Orientation call', completed: false },
      { title: 'First assignment', completed: false },
    ],
    next_action: 'Assign volunteer kit and schedule orientation',
    next_action_date: '2026-03-27',
    started_at: '2026-03-20',
  },
  {
    id: 'sf-002', name: 'New Intern Cohort (3)', role: 'intern' as UserRole, brand: 'localvip' as const,
    city: 'Charlotte', stage: 'in_progress',
    steps: [
      { title: 'Applications received', completed: true },
      { title: 'Interview & select', completed: true },
      { title: 'Create accounts', completed: false, current: true },
      { title: 'Assign training materials', completed: false },
      { title: 'Training week', completed: false },
      { title: 'Field assignment', completed: false },
    ],
    next_action: 'Create accounts for 3 interns and send welcome emails',
    next_action_date: '2026-03-26',
    started_at: '2026-03-18',
  },
]

export default function StakeholderOnboardingPage() {
  return (
    <div>
      <PageHeader
        title="Stakeholder Onboarding"
        description="Bring new volunteers, interns, influencers, and partners into the system. Every step tracked."
        actions={<Button><Plus className="h-4 w-4" /> Start Onboarding</Button>}
      />

      {DEMO_STAKEHOLDER_FLOWS.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-8 w-8" />}
          title="No stakeholder onboarding flows"
          description="Start onboarding a new team member to see it tracked here."
          action={{ label: 'Start Onboarding', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-4">
          {DEMO_STAKEHOLDER_FLOWS.map(flow => (
            <Card key={flow.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-semibold text-surface-900">{flow.name}</h3>
                      <Badge variant="info"><Shield className="h-3 w-3 mr-0.5" />{ROLES[flow.role].label}</Badge>
                      <Badge variant={flow.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[flow.brand].label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{flow.city}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Started {formatDate(flow.started_at)}</span>
                    </div>
                    <div className="mt-4">
                      <ProgressSteps steps={flow.steps.map(s => ({ label: s.title, completed: s.completed, current: s.current }))} />
                    </div>
                  </div>
                  <div className="lg:w-72 lg:pl-4 lg:border-l lg:border-surface-100">
                    <div className="rounded-lg bg-surface-50 p-3">
                      <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Next Action</p>
                      <p className="text-sm text-surface-700 font-medium">{flow.next_action}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-surface-400"><Clock className="h-3 w-3" />Due {formatDate(flow.next_action_date)}</span>
                        <Button variant="default" size="sm">Take Action <ArrowRight className="h-3 w-3" /></Button>
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
