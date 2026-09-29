'use client'

import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Heart,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ORGANIZATION_TYPE_LABELS,
  SUPPORTER_COUNT_LABELS,
  formatLeadLocation,
  type CauseLead,
} from '@/lib/types/cause-lead'

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'all', label: 'All' },
]

const STATUS_VARIANT: Record<CauseLead['status'], 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  declined: 'danger',
}

/** Pending first, then newest first — a review queue is ordered by what still needs a decision. */
const STATUS_ORDER: Record<string, number> = { pending: 0, approved: 1, declined: 2 }

interface CauseLeadRow extends CauseLead {
  organizationLabel: string
  typeLabel: string
  contactLabel: string
  locationLabel: string
  supporterLabel: string
  sponsorLabel: string
  submittedLabel: string
}

interface AddressForm {
  address1: string
  address2: string
  city: string
  state: string
  zipCode: string
  country: string
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function toRow(lead: CauseLead): CauseLeadRow {
  const location = formatLeadLocation(lead)
  return {
    ...lead,
    organizationLabel: lead.organizationName || 'Unnamed organization',
    typeLabel: lead.organizationType
      ? ORGANIZATION_TYPE_LABELS[lead.organizationType] || lead.organizationType
      : '',
    contactLabel: [lead.contactName, lead.email].filter(Boolean).join(' · '),
    locationLabel: location || '—',
    supporterLabel: lead.supporterCount
      ? SUPPORTER_COUNT_LABELS[lead.supporterCount] || lead.supporterCount
      : '—',
    sponsorLabel: lead.sponsorName || (lead.sponsorUserId ? `User #${lead.sponsorUserId}` : ''),
    submittedLabel: formatDate(lead.createdDate),
  }
}

function addressFormFor(lead: CauseLead): AddressForm {
  return {
    address1: lead.address1 ?? '',
    address2: lead.address2 ?? '',
    city: lead.city ?? '',
    state: lead.state ?? '',
    zipCode: lead.zipCode ?? '',
    country: lead.country ?? 'US',
  }
}

/** One labelled read-only fact in the detail dialog. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-surface-800">{value || '—'}</dd>
    </div>
  )
}

export default function CauseLeadsPage() {
  const [status, setStatus] = React.useState('pending')
  const [leads, setLeads] = React.useState<CauseLead[]>([])
  const [loading, setLoading] = React.useState(true)
  // Three distinct failure shapes, because they mean different things to a
  // reviewer: the endpoint is not deployed, the request failed, or the queue is
  // genuinely empty. Never collapse the first into the third.
  const [unavailable, setUnavailable] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [selected, setSelected] = React.useState<CauseLead | null>(null)
  const [address, setAddress] = React.useState<AddressForm>({
    address1: '', address2: '', city: '', state: '', zipCode: '', country: 'US',
  })
  const [declineReason, setDeclineReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState<'approve' | 'decline' | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<string | null>(null)

  const load = React.useCallback(async (nextStatus: string) => {
    setLoading(true)
    setUnavailable(false)
    setLoadError(null)
    try {
      const res = await fetch(`/api/qa/cause-leads?status=${encodeURIComponent(nextStatus)}`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null) as unknown
      if (!res.ok) {
        const record = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
        if (record.unavailable === true) {
          setUnavailable(true)
          setLeads([])
          return
        }
        throw new Error(
          typeof record.error === 'string' && record.error
            ? record.error
            : 'The cause sign-up queue could not be loaded.',
        )
      }
      setLeads(Array.isArray(json) ? (json as CauseLead[]) : [])
    } catch (error) {
      // A failed load leaves no rows AND says why — an empty table on its own
      // would read as "nobody signed up".
      setLeads([])
      setLoadError(error instanceof Error ? error.message : 'The cause sign-up queue could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void load(status) }, [load, status])

  const rows = React.useMemo(() => {
    return leads
      .map(toRow)
      .sort((a, b) => {
        const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
        if (byStatus !== 0) return byStatus
        return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
      })
  }, [leads])

  const pendingCount = React.useMemo(
    () => leads.filter(lead => lead.status === 'pending').length,
    [leads],
  )

  function openLead(lead: CauseLead) {
    setSelected(lead)
    setAddress(addressFormFor(lead))
    setDeclineReason('')
    setActionError(null)
    setResult(null)
  }

  function closeLead() {
    setSelected(null)
    setSubmitting(null)
    setActionError(null)
  }

  // Already-reviewed leads open read-only. The backend answers 409 for a second
  // decision, so offering the buttons would only produce an error.
  const isPending = selected?.status === 'pending'
  const missingAddress1 = selected !== null && !address.address1.trim()

  async function approve() {
    if (!selected || missingAddress1) return
    setSubmitting('approve')
    setActionError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/qa/cause-leads/${selected.id}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address1: address.address1.trim(),
          address2: address.address2.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          zipCode: address.zipCode.trim(),
          country: address.country.trim() || 'US',
        }),
      })
      const json = await res.json().catch(() => null) as Record<string, unknown> | null
      // The write is only a success if the backend said so. A non-OK response,
      // or an OK response that does not carry success, is reported as a failure
      // rather than closing the dialog on a lead that never changed.
      if (!res.ok || !json || json.success !== true) {
        throw new Error(
          (json && typeof json.error === 'string' && json.error)
            ? json.error
            : 'The cause could not be approved.',
        )
      }
      const accountId = typeof json.accountId === 'number' ? json.accountId : null
      setResult(
        `${selected.organizationName || 'The cause'} was approved and registered as a nonprofit`
        + (accountId ? ` (account #${accountId}).` : '.'),
      )
      setSelected(null)
      await load(status)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The cause could not be approved.')
    } finally {
      setSubmitting(null)
    }
  }

  async function decline() {
    if (!selected) return
    setSubmitting('decline')
    setActionError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/qa/cause-leads/${selected.id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: declineReason.trim() }),
      })
      const json = await res.json().catch(() => null) as Record<string, unknown> | null
      if (!res.ok || !json || json.success !== true) {
        throw new Error(
          (json && typeof json.error === 'string' && json.error)
            ? json.error
            : 'The cause could not be declined.',
        )
      }
      setResult(`${selected.organizationName || 'The cause'} was declined. Nothing was created.`)
      setSelected(null)
      await load(status)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The cause could not be declined.')
    } finally {
      setSubmitting(null)
    }
  }

  const columns: Column<CauseLeadRow>[] = [
    {
      key: 'organizationLabel',
      header: 'Organization',
      sortable: true,
      render: row => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-surface-900">{row.organizationLabel}</span>
            {row.typeLabel ? <Badge variant="outline">{row.typeLabel}</Badge> : null}
          </div>
          {row.campaign ? (
            <p className="mt-0.5 text-xs text-surface-400">{row.campaign}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'contactLabel',
      header: 'Contact',
      sortable: true,
      render: row => (
        <div className="min-w-0">
          <p className="text-surface-800">{row.contactName || '—'}</p>
          <p className="truncate text-xs text-surface-500">{row.email || '—'}</p>
        </div>
      ),
    },
    { key: 'locationLabel', header: 'Location', sortable: true },
    { key: 'supporterLabel', header: 'Supporters', sortable: true },
    {
      key: 'sponsorLabel',
      header: 'Referral',
      render: row => (
        row.sponsorUserId ? (
          <Badge variant="success">{row.sponsorLabel}</Badge>
        ) : row.refCode ? (
          <Badge variant="warning">Code “{row.refCode}” unmatched</Badge>
        ) : (
          <span className="text-surface-400">No referral</span>
        )
      ),
    },
    { key: 'submittedLabel', header: 'Submitted', sortable: true },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: row => (
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[row.status] ?? 'default'} dot>{row.status}</Badge>
          {row.status === 'pending' ? (
            <Button variant="outline" size="sm" onClick={() => openLead(row)}>Review</Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Cause sign-ups"
        description="Organizations that submitted the sign-up form on the public site. Nothing has been created yet — approving one registers the cause as a nonprofit account."
        breadcrumb={[{ label: 'CRM', href: '/crm/causes' }, { label: 'Cause sign-ups' }]}
        actions={(
          <Button variant="outline" onClick={() => void load(status)} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      {result ? (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{result}</span>
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter sign-ups by status" className="flex flex-wrap gap-2">
          {STATUS_TABS.map(tab => (
            <Button
              key={tab.value}
              size="sm"
              variant={status === tab.value ? 'default' : 'outline'}
              aria-pressed={status === tab.value}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        {!loading && !unavailable && pendingCount > 0 ? (
          <span className="text-sm text-surface-500">
            {pendingCount} waiting for a decision
          </span>
        ) : null}
      </div>

      {unavailable ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<CloudOff className="h-8 w-8" />}
              title="Not available yet"
              description="The cause sign-up endpoint has not been deployed to this backend. This is not an empty queue — sign-ups cannot be read until the backend ships."
              action={{ label: 'Try again', onClick: () => void load(status) }}
            />
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          searchable
          searchPlaceholder="Search by organization, contact, or location..."
          loading={loading}
          onRowClick={row => openLead(row)}
          emptyState={(
            <EmptyState
              icon={<Heart className="h-8 w-8" />}
              title={loadError ? 'Nothing could be loaded' : 'No sign-ups here'}
              description={
                loadError
                  ? 'The error above explains why. This is not a count of zero.'
                  : 'Submissions from the public cause sign-up form land here for review.'
              }
            />
          )}
        />
      )}

      <Dialog open={selected !== null} onOpenChange={open => { if (!open) closeLead() }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.organizationName || 'Unnamed organization'}</DialogTitle>
                <DialogDescription>
                  Submitted {formatDate(selected.createdDate)}
                  {selected.campaign ? ` from the ${selected.campaign} page` : ''}. Approving registers
                  this organization as a nonprofit account.
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-2 gap-4 rounded-xl border border-surface-200 bg-surface-50 p-4">
                <Fact
                  label="Type"
                  value={selected.organizationType
                    ? ORGANIZATION_TYPE_LABELS[selected.organizationType] || selected.organizationType
                    : null}
                />
                <Fact
                  label="Supporters"
                  value={selected.supporterCount
                    ? SUPPORTER_COUNT_LABELS[selected.supporterCount] || selected.supporterCount
                    : null}
                />
                <Fact label="Contact" value={[selected.contactName, selected.contactTitle].filter(Boolean).join(', ')} />
                <Fact label="Website" value={selected.website} />
                <Fact label="Email" value={selected.email} />
                <Fact label="Phone" value={selected.phone} />
                <Fact
                  label="Referral"
                  value={selected.sponsorUserId
                    ? `${selected.sponsorName || `User #${selected.sponsorUserId}`}${selected.refCode ? ` (code ${selected.refCode})` : ''}`
                    : selected.refCode
                      ? `Code “${selected.refCode}” did not match a user`
                      : 'No referral code'}
                />
                <Fact label="Status" value={selected.status} />
                <div className="col-span-2">
                  <Fact
                    label="What they are raising for"
                    value={selected.notes
                      ? <span className="whitespace-pre-wrap">{selected.notes}</span>
                      : <span className="text-surface-400">Nothing written</span>}
                  />
                </div>
              </dl>

              {!isPending ? (
                <p className="mt-5 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
                  This sign-up was already {selected.status}
                  {selected.approvedAccountId ? ` (account #${selected.approvedAccountId})` : ''}. It is
                  shown here as history and cannot be decided again.
                </p>
              ) : (
              <>
              <section className="mt-5">
                <h3 className="text-sm font-semibold text-surface-800">Registered address</h3>
                <p className="mt-1 text-sm text-surface-500">
                  {selected.address1
                    ? 'Submitted with the form. Correct it here if it is wrong.'
                    : 'The public form does not ask for a street address, and registration requires one. Add it before approving.'}
                </p>

                <div className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="cause-lead-address1" className="text-sm font-medium text-surface-700">
                      Street address *
                    </label>
                    <Input
                      id="cause-lead-address1"
                      required
                      autoComplete="off"
                      aria-describedby="cause-lead-address1-hint"
                      placeholder="1234 Main St"
                      value={address.address1}
                      onChange={event => setAddress(current => ({ ...current, address1: event.target.value }))}
                    />
                    <p
                      id="cause-lead-address1-hint"
                      className={missingAddress1 ? 'text-xs text-warning-600' : 'text-xs text-surface-400'}
                    >
                      {missingAddress1
                        ? 'Required — approval is refused without a street address.'
                        : 'Used to register the nonprofit account.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="cause-lead-address2" className="text-sm font-medium text-surface-700">
                      Suite, unit, building
                    </label>
                    <Input
                      id="cause-lead-address2"
                      autoComplete="off"
                      value={address.address2}
                      onChange={event => setAddress(current => ({ ...current, address2: event.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <label htmlFor="cause-lead-city" className="text-sm font-medium text-surface-700">City</label>
                      <Input
                        id="cause-lead-city"
                        autoComplete="off"
                        value={address.city}
                        onChange={event => setAddress(current => ({ ...current, city: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="cause-lead-state" className="text-sm font-medium text-surface-700">State</label>
                      <Input
                        id="cause-lead-state"
                        autoComplete="off"
                        value={address.state}
                        onChange={event => setAddress(current => ({ ...current, state: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="cause-lead-zip" className="text-sm font-medium text-surface-700">ZIP</label>
                      <Input
                        id="cause-lead-zip"
                        autoComplete="off"
                        inputMode="numeric"
                        value={address.zipCode}
                        onChange={event => setAddress(current => ({ ...current, zipCode: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-5">
                <label htmlFor="cause-lead-decline-reason" className="text-sm font-medium text-surface-700">
                  Reason for declining
                </label>
                <Textarea
                  id="cause-lead-decline-reason"
                  className="mt-2"
                  rows={2}
                  placeholder="Kept with the record. Optional."
                  value={declineReason}
                  onChange={event => setDeclineReason(event.target.value)}
                />
              </section>
              </>
              )}

              {actionError ? (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{actionError}</span>
                </div>
              ) : null}

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={closeLead} disabled={submitting !== null}>
                  {isPending ? 'Cancel' : 'Close'}
                </Button>
                {isPending ? (
                  <>
                    <Button
                      variant="danger"
                      onClick={() => void decline()}
                      disabled={submitting !== null}
                    >
                      {submitting === 'decline'
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <XCircle className="h-4 w-4" aria-hidden="true" />}
                      Decline
                    </Button>
                    <Button
                      onClick={() => void approve()}
                      disabled={submitting !== null || missingAddress1}
                      title={missingAddress1 ? 'Add a street address before approving.' : undefined}
                    >
                      {submitting === 'approve'
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                      Approve &amp; register
                    </Button>
                  </>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
