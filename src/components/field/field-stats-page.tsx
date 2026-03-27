'use client'

import * as React from 'react'
import { BarChart3, ClipboardCheck, FileText, Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { useAuth } from '@/lib/auth/context'
import { useOutreach, useOutreachScripts, useTasks } from '@/lib/supabase/hooks'

export function FieldStatsPage() {
  const { profile } = useAuth()
  const { data: scripts } = useOutreachScripts({ created_by: profile.id })
  const { data: outreach } = useOutreach({ performed_by: profile.id })
  const { data: tasks } = useTasks({ assigned_to: profile.id })

  const completedTasks = tasks.filter((task) => task.status === 'completed').length
  const followUps = outreach.filter((item) => item.outreach_status === 'follow_up_needed').length
  const positiveSignals = outreach.filter((item) => item.outreach_status === 'interested' || item.outreach_status === 'replied').length

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Stats"
        description="A simple view of your script usage, outreach volume, and follow-up rhythm."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scripts created" value={scripts.length} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Outreach logged" value={outreach.length} icon={<Send className="h-5 w-5" />} />
        <StatCard label="Follow-ups needed" value={followUps} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard label="Positive signals" value={positiveSignals} icon={<BarChart3 className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Completed tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-surface-900">{completedTasks}</p>
          <p className="mt-2 text-sm text-surface-500">This number climbs as your follow-ups and assigned work are marked complete.</p>
        </CardContent>
      </Card>
    </div>
  )
}
