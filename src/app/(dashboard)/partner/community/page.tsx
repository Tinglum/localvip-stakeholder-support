'use client'

import * as React from 'react'
import { Heart } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { useCauses, useStakeholderAssignments } from '@/lib/supabase/hooks'

export default function PartnerCommunityPage() {
  const { profile } = useAuth()
  const { data: assignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'city' })
  const { data: causes } = useCauses()
  const cityIds = assignments.map((assignment) => assignment.entity_id)
  const scopedCauses = causes.filter((cause) => cityIds.includes(cause.city_id || ''))

  return (
    <div className="space-y-8">
      <PageHeader title="City Community" description="The schools and causes currently active in your city scope." />
      <Card>
        <CardHeader>
          <CardTitle>Schools and Causes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scopedCauses.length === 0 ? (
            <EmptyState icon={<Heart className="h-8 w-8" />} title="No community organizations in scope yet" description="As schools and causes are onboarded into your city, they will appear here." />
          ) : scopedCauses.map((cause) => (
            <div key={cause.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
              <p className="text-sm font-semibold text-surface-900">{cause.name}</p>
              <p className="mt-1 text-xs text-surface-500">{cause.type} / {cause.stage}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
