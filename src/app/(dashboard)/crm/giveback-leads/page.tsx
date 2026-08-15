'use client'

import * as React from 'react'
import { CheckCircle2, QrCode, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { GivebackLead } from '@/lib/types/giveback-lead'

const BUSINESS_TYPE_LABELS: Record<number, string> = {
  1: 'Food & Beverage',
  2: 'Health & Beauty',
  3: 'Entertainment',
  4: 'Home Services',
  5: 'Retail Store',
  6: 'Other',
}

export default function GivebackLeadsPage() {
  const [leads, setLeads] = React.useState<GivebackLead[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    setLoading(true)
    fetch('/api/qa/giveback-leads?status=pending', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => setLeads(Array.isArray(j) ? j : []))
      .catch(() => setMessage('The lead list could not be loaded.'))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  async function act(lead: GivebackLead, action: 'approve' | 'decline') {
    setBusyId(lead.id)
    setMessage(null)
    try {
      const res = await fetch(`/api/qa/giveback-leads/${lead.id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Could not ${action} the lead.`)
      setMessage(
        action === 'approve'
          ? `${lead.businessName} was created and attached to ${lead.sponsorName || 'its sponsor'}.`
          : `${lead.businessName} was declined.`
      )
      load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not ${action} the lead.`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Giveback Day requests"
        description="Businesses that scanned a school flyer and asked to join. Nothing has been created yet — approving one registers the business and attaches it to whoever shared the flyer."
        breadcrumb={[{ label: 'CRM', href: '/crm/businesses' }, { label: 'Giveback Day requests' }]}
      />

      {message ? (
        <div className="mb-4 rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm">{message}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-surface-500">Loading…</p>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <QrCode className="h-8 w-8 text-surface-400" />
            <p className="text-sm text-surface-500">No requests waiting. Scans from a flyer land here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => (
            <Card key={lead.id}>
              <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{lead.businessName}</h3>
                    {lead.campaign ? <Badge variant="outline">{lead.campaign}</Badge> : null}
                    {lead.businessType ? (
                      <Badge variant="outline">{BUSINESS_TYPE_LABELS[lead.businessType] || 'Other'}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-surface-600">
                    {lead.contactName} · {lead.email}
                    {lead.phone ? ` · ${lead.phone}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-surface-600">
                    {[lead.address1, lead.address2, lead.city, lead.state, lead.zipCode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {lead.preferredDay ? (
                    <p className="mt-1 text-sm text-surface-600">Preferred day: {lead.preferredDay}</p>
                  ) : null}
                  {lead.notes ? <p className="mt-1 text-sm text-surface-500">“{lead.notes}”</p> : null}

                  {/* Attribution is the point of the flyer QR, so an unresolved
                      sponsor is called out rather than quietly defaulting to
                      whoever happens to be approving. */}
                  {lead.sponsorUserId ? (
                    <p className="mt-3 text-sm font-medium text-emerald-700">
                      Shared by {lead.sponsorName || `user #${lead.sponsorUserId}`}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm font-medium text-amber-700">
                      No sponsor matched{lead.refCode ? ` code “${lead.refCode}”` : ' (no code on the scan)'}.
                      Approving is blocked until someone is attributed.
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => act(lead, 'approve')}
                    disabled={busyId === lead.id || !lead.sponsorUserId}
                    title={lead.sponsorUserId ? undefined : 'This lead has no sponsor to attach the business to.'}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => act(lead, 'decline')}
                    disabled={busyId === lead.id}
                  >
                    <XCircle className="h-4 w-4" />
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
