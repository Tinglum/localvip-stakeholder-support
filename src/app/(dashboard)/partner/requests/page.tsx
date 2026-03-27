'use client'

import * as React from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth/context'
import { useCities, useCityAccessRequestInsert, useCityAccessRequests } from '@/lib/supabase/hooks'

export default function PartnerRequestsPage() {
  const { profile } = useAuth()
  const { data: cities } = useCities()
  const { data: requests, refetch } = useCityAccessRequests({ requester_id: profile.id })
  const { insert, loading } = useCityAccessRequestInsert()
  const [requestMode, setRequestMode] = React.useState<'existing' | 'new'>('existing')
  const [selectedCityId, setSelectedCityId] = React.useState('')
  const [newCityName, setNewCityName] = React.useState('')
  const [newCityState, setNewCityState] = React.useState('')
  const [reason, setReason] = React.useState('')

  const existingCities = React.useMemo(
    () =>
      [...cities]
        .sort((left, right) => `${left.name}, ${left.state}`.localeCompare(`${right.name}, ${right.state}`)),
    [cities]
  )

  const selectedCity = React.useMemo(
    () => existingCities.find((city) => city.id === selectedCityId) || null,
    [existingCities, selectedCityId]
  )

  const canSubmit =
    requestMode === 'existing'
      ? !!selectedCityId
      : !!newCityName.trim() && !!newCityState.trim()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const requestedCityName = requestMode === 'existing'
      ? selectedCity
        ? `${selectedCity.name}, ${selectedCity.state}`
        : ''
      : `${newCityName.trim()}${newCityState.trim() ? `, ${newCityState.trim().toUpperCase()}` : ''}`

    if (!requestedCityName) return

    await insert({
      requester_id: profile.id,
      requested_city_name: requestedCityName,
      requested_city_id: requestMode === 'existing' ? selectedCityId || null : null,
      reason: reason || null,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      metadata: requestMode === 'existing'
        ? {
            request_mode: 'existing_city',
            selected_city_status: selectedCity?.status || null,
          }
        : {
            request_mode: 'new_city',
            requested_state: newCityState.trim().toUpperCase(),
          },
    })
    setSelectedCityId('')
    setNewCityName('')
    setNewCityState('')
    setRequestMode('existing')
    setReason('')
    refetch()
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Request Access to New City" description="Ask for additional city coverage when you are ready to grow beyond your current footprint." />
      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>New request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Cities already in LocalVIP</label>
                <select
                  value={requestMode === 'existing' ? selectedCityId : ''}
                  onChange={(event) => {
                    setRequestMode('existing')
                    setSelectedCityId(event.target.value)
                  }}
                  className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  <option value="">Select an existing city</option>
                  {existingCities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}, {city.state}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-surface-500">
                  Pick from cities we already have first. Only add a new city if it is not listed here.
                </p>
              </div>

              <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-surface-900">City not listed?</p>
                    <p className="mt-1 text-xs text-surface-500">Add a new market request only when the city does not already exist in the system.</p>
                  </div>
                  <Button
                    type="button"
                    variant={requestMode === 'new' ? 'secondary' : 'outline'}
                    onClick={() => setRequestMode((current) => (current === 'new' ? 'existing' : 'new'))}
                  >
                    {requestMode === 'new' ? 'Use Existing City Instead' : 'Add New City'}
                  </Button>
                </div>
              </div>

              {requestMode === 'new' && (
                <div className="grid gap-4 md:grid-cols-[1fr_9rem]">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">New city name</label>
                    <Input value={newCityName} onChange={(event) => setNewCityName(event.target.value)} placeholder="Example: Austin" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">State</label>
                    <Input value={newCityState} onChange={(event) => setNewCityState(event.target.value)} placeholder="TX" maxLength={3} />
                  </div>
                </div>
              )}

              {selectedCity && requestMode === 'existing' && (
                <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3">
                  <p className="text-sm font-medium text-success-700">Requesting access to {selectedCity.name}, {selectedCity.state}</p>
                  <p className="mt-1 text-xs text-success-700/80">
                    Current system status: {selectedCity.status}
                  </p>
                </div>
              )}

              {existingCities.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-surface-400">Current LocalVIP cities</p>
                  <div className="flex flex-wrap gap-2">
                    {existingCities.slice(0, 16).map((city) => (
                      <Badge key={city.id} variant="outline">
                        {city.name}, {city.state}
                      </Badge>
                    ))}
                    {existingCities.length > 16 && (
                      <Badge variant="outline">+{existingCities.length - 16} more</Badge>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Reason</label>
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} />
              </div>
              <Button type="submit" disabled={loading || !canSubmit}>Submit request</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submitted requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.map((request) => (
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
            ))}
            {requests.length === 0 && <p className="text-sm text-surface-500">No requests yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
