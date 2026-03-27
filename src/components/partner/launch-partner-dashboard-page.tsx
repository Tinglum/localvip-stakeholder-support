'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, Heart, MapPin, PlusCircle, TrendingUp, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { useAuth } from '@/lib/auth/context'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { useBusinesses, useCauses, useCities, useCityAccessRequests, useContacts, useStakeholderAssignments } from '@/lib/supabase/hooks'

export function LaunchPartnerDashboardPage() {
  const { profile } = useAuth()
  const { data: cityAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'city' })
  const { data: cities } = useCities()
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()
  const { data: requests } = useCityAccessRequests({ requester_id: profile.id })

  const assignedCityIds = React.useMemo(
    () => cityAssignments.filter((assignment) => assignment.status === 'active').map((assignment) => assignment.entity_id),
    [cityAssignments]
  )

  const assignedCities = React.useMemo(
    () => cities.filter((city) => assignedCityIds.includes(city.id)),
    [assignedCityIds, cities]
  )

  const cityBusinesses = React.useMemo(
    () => businesses.filter((business) => assignedCityIds.includes(business.city_id || '')),
    [assignedCityIds, businesses]
  )

  const cityCauses = React.useMemo(
    () => causes.filter((cause) => assignedCityIds.includes(cause.city_id || '')),
    [assignedCityIds, causes]
  )

  const contactsByBusiness = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const contact of contacts) {
      if (!contact.business_id) continue
      map.set(contact.business_id, (map.get(contact.business_id) || 0) + 1)
    }
    return map
  }, [contacts])

  const avgHundredListCompletion = React.useMemo(() => {
    if (cityBusinesses.length === 0) return 0
    const totalPercent = cityBusinesses.reduce((sum, business) => {
      const count = contactsByBusiness.get(business.id) || 0
      return sum + Math.min(100, Math.round((count / 100) * 100))
    }, 0)
    return Math.round(totalPercent / cityBusinesses.length)
  }, [cityBusinesses, contactsByBusiness])

  const activeCount = cityBusinesses.filter((business) => business.stage === 'live').length
  const setupCount = cityBusinesses.filter((business) => ['lead', 'contacted', 'interested', 'in_progress'].includes(business.stage)).length

  if (assignedCities.length === 0) {
    return (
      <EmptyState
        icon={<MapPin className="h-8 w-8" />}
        title="No cities assigned yet"
        description="As soon as a city is assigned to you, this dashboard will turn into your city growth command center."
        action={{ label: 'Request City Access', onClick: () => { window.location.href = '/partner/requests' } }}
      />
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={assignedCities.length === 1 ? `Grow ${assignedCities[0].name}` : 'Grow Your Cities'}
        description="Watch setup, activation, and community progress at the city level without digging through private customer data."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/partner/requests">
                Request access to new city
                <PlusCircle className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/partner/businesses">
                Open business pipeline
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total businesses" value={cityBusinesses.length} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Businesses in setup" value={setupCount} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Businesses active" value={activeCount} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Avg. 100-list completion" value={`${avgHundredListCompletion}%`} icon={<Heart className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>City Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignedCities.map((city) => {
              const businessCount = cityBusinesses.filter((business) => business.city_id === city.id).length
              const causeCount = cityCauses.filter((cause) => cause.city_id === city.id).length

              return (
                <div key={city.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-surface-900">{city.name}, {city.state}</p>
                      <p className="mt-1 text-sm text-surface-500">{businessCount} businesses / {causeCount} schools or causes</p>
                    </div>
                    <Badge variant="info">Assigned</Badge>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>City Access Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-surface-500">No pending or submitted city access requests yet.</p>
            ) : (
              requests.slice(0, 4).map((request) => (
                <div key={request.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{request.requested_city_name}</p>
                      <p className="mt-1 text-xs text-surface-500">{request.reason || 'No reason added'}</p>
                    </div>
                    <Badge variant={request.status === 'approved' ? 'success' : request.status === 'declined' ? 'danger' : 'warning'}>
                      {request.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Grow Your City</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/partner/businesses">
              View pipeline
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {cityBusinesses.slice(0, 8).map((business) => (
            <div key={business.id} className="rounded-2xl border border-surface-200 bg-surface-0 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-surface-900">{business.name}</p>
                  <p className="mt-1 text-xs text-surface-500">{business.category || 'Local business'} / {business.address || 'Address not added yet'}</p>
                </div>
                <Badge variant={business.stage === 'live' ? 'success' : business.stage === 'in_progress' ? 'warning' : 'info'}>
                  {ONBOARDING_STAGES[business.stage]?.label || business.stage}
                </Badge>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-brand-500 to-lime-500"
                  style={{ width: `${Math.min(100, Math.round(((contactsByBusiness.get(business.id) || 0) / 100) * 100))}%` }}
                />
              </div>
            </div>
          ))}
          {cityBusinesses.length === 0 && (
            <p className="text-sm text-surface-500">No businesses assigned to your current cities yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
