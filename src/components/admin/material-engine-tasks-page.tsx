'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Clock3, FolderCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { useAdminTasks, useGeneratedMaterials, useStakeholders } from '@/lib/supabase/hooks'
import { formatDateTime } from '@/lib/utils'
import type { AdminTaskStatus } from '@/lib/types/database'

const STATUS_FILTERS: Array<{ value: AdminTaskStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'needs_setup', label: 'Needs setup' },
  { value: 'ready_to_generate', label: 'Ready to generate' },
  { value: 'generated', label: 'Generated' },
  { value: 'failed', label: 'Failed' },
]

function badgeForStatus(status: string) {
  if (status === 'generated') return 'success'
  if (status === 'ready_to_generate') return 'info'
  if (status === 'failed') return 'danger'
  return 'warning'
}

export function MaterialEngineTasksPage() {
  const { data: tasks, loading } = useAdminTasks()
  const { data: stakeholders } = useStakeholders()
  const { data: generatedMaterials } = useGeneratedMaterials()
  const [filter, setFilter] = React.useState<AdminTaskStatus | 'all'>('all')

  const filtered = React.useMemo(() => {
    if (filter === 'all') return tasks
    return tasks.filter((task) => task.status === filter)
  }, [filter, tasks])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Engine Tasks"
        description="Scan setup readiness, generation success, and failures without digging through stakeholder detail screens."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
            className={`rounded-full px-4 py-2 text-sm ${filter === item.value ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="space-y-3 p-5">
                <div className="h-4 w-1/3 rounded bg-surface-100" />
                <div className="h-3 w-full rounded bg-surface-50" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FolderCog className="h-8 w-8" />}
          title="No tasks in this state"
          description="Change the filter or create a new stakeholder to populate the queue."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map((task) => {
            const stakeholder = stakeholders.find((item) => item.id === task.stakeholder_id)
            const generatedCount = generatedMaterials.filter((item) => item.stakeholder_id === task.stakeholder_id && item.generation_status === 'generated').length

            return (
              <Card key={task.id} className="transition-shadow hover:shadow-card-hover">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{task.title}</CardTitle>
                      <p className="mt-1 text-sm text-surface-500">
                        {stakeholder?.name || 'Unknown stakeholder'} · {stakeholder?.type || 'untyped'}
                      </p>
                    </div>
                    <Badge variant={badgeForStatus(task.status) as 'default' | 'info' | 'success' | 'warning' | 'danger'}>
                      {task.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Generated</p>
                      <p className="mt-2 text-sm font-medium text-surface-900">{generatedCount} assets</p>
                    </div>
                    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Updated</p>
                      <p className="mt-2 text-sm font-medium text-surface-900">{formatDateTime(task.updated_at)}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-surface-200 bg-surface-0 px-4 py-4 text-sm text-surface-500">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />
                      Created {formatDateTime(task.created_at)}
                    </div>
                  </div>
                  <Link href={`/admin/stakeholders/${task.stakeholder_id}`}>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-brand-700">
                      Open stakeholder <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
