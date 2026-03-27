'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, MapPin } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { useBusinesses, useCities, useStakeholderAssignments } from '@/lib/supabase/hooks'

export function FieldBusinessesPage() {
  const { profile } = useAuth()
  const { data: businesses } = useBusinesses()
  const { data: cities } = useCities()
  const { data: assignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'business' })

  const assignedIds = new Set(assignments.map((assignment) => assignment.entity_id))
  const cityMap = new Map(cities.map((city) => [city.id, `${city.name}, ${city.state}`]))
  const assignedBusinesses = businesses.filter((business) => assignedIds.has(business.id))

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Businesses"
        description="The businesses currently assigned to you for outreach, activation, or follow-up."
        actions={
          <Button asChild>
            <Link href="/crm/scripts">
              Open Script Engine
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Assigned Businesses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignedBusinesses.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-8 w-8" />}
              title="No businesses assigned yet"
              description="Once businesses are assigned to you, they will show up here for faster script generation and follow-up."
            />
          ) : (
            assignedBusinesses.map((business) => (
              <div key={business.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-surface-900">{business.name}</p>
                    <p className="mt-1 text-sm text-surface-500">{business.category || 'Local business'}</p>
                    <p className="mt-2 inline-flex items-center gap-2 text-xs text-surface-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {business.city_id ? cityMap.get(business.city_id) || 'City not set' : 'City not set'}
                    </p>
                  </div>
                  <Badge variant={business.stage === 'live' ? 'success' : business.stage === 'in_progress' ? 'warning' : 'info'}>
                    {ONBOARDING_STAGES[business.stage]?.label || business.stage}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/crm/scripts?business=${encodeURIComponent(business.id)}`}>
                      Generate Script
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/crm/businesses/${business.id}`}>
                      Open record
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
