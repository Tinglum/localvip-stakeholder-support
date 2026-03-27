'use client'

import * as React from 'react'
import { Building2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { useBusinesses, useStakeholderAssignments } from '@/lib/supabase/hooks'

export default function PartnerBusinessesPage() {
  const { profile } = useAuth()
  const { data: assignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'city' })
  const { data: businesses } = useBusinesses()
  const cityIds = assignments.map((assignment) => assignment.entity_id)
  const scopedBusinesses = businesses.filter((business) => cityIds.includes(business.city_id || ''))

  return (
    <div className="space-y-8">
      <PageHeader title="City Businesses" description="The businesses currently inside your assigned city footprint." />
      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scopedBusinesses.length === 0 ? (
            <EmptyState icon={<Building2 className="h-8 w-8" />} title="No businesses in scope yet" description="Once businesses are attached to your city, they will appear here." />
          ) : scopedBusinesses.map((business) => (
            <div key={business.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-surface-900">{business.name}</p>
                  <p className="mt-1 text-xs text-surface-500">{business.category || 'Local business'}</p>
                </div>
                <Badge variant={business.stage === 'live' ? 'success' : business.stage === 'in_progress' ? 'warning' : 'info'}>
                  {ONBOARDING_STAGES[business.stage]?.label || business.stage}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
