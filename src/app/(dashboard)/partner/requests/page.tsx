'use client'

import * as React from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth/context'
import { useCityAccessRequestInsert, useCityAccessRequests } from '@/lib/supabase/hooks'

export default function PartnerRequestsPage() {
  const { profile } = useAuth()
  const { data: requests, refetch } = useCityAccessRequests({ requester_id: profile.id })
  const { insert, loading } = useCityAccessRequestInsert()
  const [cityName, setCityName] = React.useState('')
  const [reason, setReason] = React.useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    await insert({
      requester_id: profile.id,
      requested_city_name: cityName,
      requested_city_id: null,
      reason: reason || null,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      metadata: null,
    })
    setCityName('')
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
                <label className="mb-1.5 block text-sm font-medium text-surface-700">City name</label>
                <Input value={cityName} onChange={(event) => setCityName(event.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Reason</label>
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} />
              </div>
              <Button type="submit" disabled={loading || !cityName.trim()}>Submit request</Button>
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
