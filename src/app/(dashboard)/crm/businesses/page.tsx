'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, CreditCard, MapPin, Plus, Store } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { ONBOARDING_STAGES } from '@/lib/constants'
import { useAuth } from '@/lib/auth/context'
import { useCrmBusinesses } from '@/lib/hooks/crm-businesses'
import { useCities } from '@/lib/supabase/hooks'
import { formatDate } from '@/lib/utils'
import type { CrmBusinessListItem } from '@/lib/crm-api'
import type { Business, OnboardingStage } from '@/lib/types/database'

const SOURCE_OPTIONS = [
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Cold Outreach', label: 'Cold Outreach' },
  { value: 'Website Form', label: 'Website Form' },
  { value: 'Campaign', label: 'Campaign' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Other', label: 'Other' },
]

const STAGE_OPTIONS = Object.entries(ONBOARDING_STAGES).map(([value, def]) => ({
  value,
  label: def.label,
}))

const STRIPE_OPTIONS = [
  { value: 'complete', label: 'Stripe onboarded' },
  { value: 'incomplete', label: 'Stripe not onboarded' },
  { value: 'unknown', label: 'Stripe unknown' },
]

const QA_LIVE_OPTIONS = [
  { value: 'live', label: 'Live on QA' },
  { value: 'not_live', label: 'Not live on QA' },
  { value: 'unknown', label: 'QA live unknown' },
]

interface BusinessRow extends CrmBusinessListItem {
  locationLabel: string
  qaLiveState: 'live' | 'not_live' | 'unknown'
  stripeState: 'complete' | 'incomplete' | 'unknown'
}

function relativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export default function BusinessesPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [addOpen, setAddOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<Record<string, string>>({})

  const [formName, setFormName] = React.useState('')
  const [formEmail, setFormEmail] = React.useState('')
  const [formPhone, setFormPhone] = React.useState('')
  const [formWebsite, setFormWebsite] = React.useState('')
  const [formCategory, setFormCategory] = React.useState('')
  const [formSource, setFormSource] = React.useState('')
  const [formCityId, setFormCityId] = React.useState('')
  const [formBrand, setFormBrand] = React.useState<'localvip' | 'hato'>('localvip')
  const [formStage, setFormStage] = React.useState<OnboardingStage>('lead')
  const [inserting, setInserting] = React.useState(false)
  const [insertError, setInsertError] = React.useState<string | null>(null)
  const [dupWarning, setDupWarning] = React.useState<string | null>(null)

  // ── Primary contact search (existing user or contact) ─────────────
  const [contactQuery, setContactQuery] = React.useState('')
  const [contactResults, setContactResults] = React.useState<Array<{
    id: number
    firstName: string | null
    lastName: string | null
    email: string | null
    phoneNumber: string | null
    referralCode?: string | null
  }>>([])
  const [pickedContact, setPickedContact] = React.useState<{
    id: number
    name: string
    email: string | null
    referralCode?: string | null
  } | null>(null)

  React.useEffect(() => {
    if (!addOpen || pickedContact || contactQuery.trim().length < 2) {
      setContactResults([])
      return
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/qa/users/search?q=${encodeURIComponent(contactQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setContactResults(Array.isArray(data) ? data : [])
        }
      } catch {
        setContactResults([])
      }
    }, 300)
    return () => window.clearTimeout(handle)
  }, [contactQuery, addOpen, pickedContact])

  // When a contact is picked, prefill owner email/phone + referral code
  React.useEffect(() => {
    if (!pickedContact) return
    if (pickedContact.email && !formEmail) setFormEmail(pickedContact.email)
  }, [pickedContact, formEmail])

  const { data: businessResponse, loading, error, refetch } = useCrmBusinesses()
  const { data: cities } = useCities()
  const businesses = React.useMemo(() => businessResponse?.items || [], [businessResponse])
  const qaError = businessResponse?.qaError || null

  const rows = React.useMemo<BusinessRow[]>(() =>
    businesses.map(item => ({
      ...item,
      locationLabel: [item.city_name || item.city, item.state].filter(Boolean).join(', ') || 'N/A',
      qaLiveState: item.active === null ? 'unknown' : item.active ? 'live' : 'not_live',
      stripeState:
        item.stripe_onboarding_complete === null || item.stripe_onboarding_complete === undefined
          ? 'unknown'
          : item.stripe_onboarding_complete
            ? 'complete'
            : 'incomplete',
    })),
    [businesses],
  )

  const filtered = React.useMemo(() => {
    let result = rows
    if (filters.stripeState) result = result.filter(item => item.stripeState === filters.stripeState)
    if (filters.qaLiveState) result = result.filter(item => item.qaLiveState === filters.qaLiveState)
    return result
  }, [filters.qaLiveState, filters.stripeState, rows])

  const resetForm = React.useCallback(() => {
    setFormName('')
    setFormEmail('')
    setFormPhone('')
    setFormWebsite('')
    setFormCategory('')
    setFormSource('')
    setFormCityId('')
    setFormBrand('localvip')
    setFormStage('lead')
    setInsertError(null)
    setDupWarning(null)
  }, [])

  const handleNameChange = React.useCallback((value: string) => {
    setFormName(value)
    if (!value.trim()) {
      setDupWarning(null)
      return
    }

    const normalized = normalizeName(value)
    const match = businesses.find(item => normalizeName(item.name) === normalized)
    setDupWarning(match ? `"${match.name}" already exists in your pipeline.` : null)
  }, [businesses])

  const handleSubmit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setInsertError(null)
    setInserting(true)

    const record: Partial<Business> = {
      name: formName,
      email: formEmail || null,
      phone: formPhone || null,
      website: formWebsite || null,
      category: formCategory || null,
      source: formSource || null,
      city_id: formCityId || null,
      brand: formBrand,
      stage: formStage,
      owner_id: profile.id,
      status: 'active',
    }

    try {
      const response = await fetch('/api/crm/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setInsertError(
          (payload && typeof payload.error === 'string' && payload.error)
          || 'Business could not be created.',
        )
        return
      }

      setAddOpen(false)
      resetForm()
      refetch()
      if (payload?.id) router.push(`/crm/businesses/${payload.id}`)
    } catch {
      setInsertError('Business could not be created. Please try again.')
    } finally {
      setInserting(false)
    }
  }, [
    formBrand,
    formCategory,
    formCityId,
    formEmail,
    formName,
    formPhone,
    formSource,
    formStage,
    formWebsite,
    profile.id,
    refetch,
    resetForm,
    router,
  ])

  const columns: Column<BusinessRow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: item => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={item.detailHref}
              onClick={(event) => event.stopPropagation()}
              className="font-medium text-surface-900 transition-colors hover:text-brand-700"
            >
              {item.name}
            </Link>
            {item.duplicateOf && (
              <span title="Potential duplicate detected">
                <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />
              </span>
            )}
          </div>
          {item.headline && (
            <p className="text-xs text-surface-500">{item.headline}</p>
          )}
        </div>
      ),
    },
    {
      key: 'owner_name',
      header: 'Owner',
      sortable: true,
      render: item => (
        <div className="space-y-1">
          <p className="text-sm text-surface-800">{item.owner_name || item.ownerName || 'N/A'}</p>
          {item.owner_email || item.ownerEmail ? (
            <a
              href={`mailto:${item.owner_email || item.ownerEmail}`}
              onClick={(event) => event.stopPropagation()}
              className="text-xs text-brand-700 transition-colors hover:text-brand-800"
            >
              {item.owner_email || item.ownerEmail}
            </a>
          ) : (
            <Link
              href={item.detailHref}
              onClick={(event) => event.stopPropagation()}
              className="text-xs text-amber-700 transition-colors hover:text-amber-800"
            >
              Add owner email
            </Link>
          )}
        </div>
      ),
    },
    {
      key: 'locationLabel',
      header: 'Location',
      sortable: true,
      render: item => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            router.push(item.detailHref)
          }}
          className="flex items-center gap-1 text-left text-surface-600 transition-colors hover:text-brand-700"
        >
          <MapPin className="h-3.5 w-3.5 text-surface-400" />
          {item.locationLabel}
        </button>
      ),
    },
    {
      key: 'stripeState',
      header: 'Stripe Onboarded',
      sortable: true,
      render: item => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setFilters(current => ({ ...current, stripeState: item.stripeState }))
          }}
          className="inline-flex"
          title="Filter businesses by this Stripe state"
        >
          {item.stripe_onboarding_complete === null || item.stripe_onboarding_complete === undefined ? (
            <Badge variant="default">Unknown</Badge>
          ) : (
            <Badge variant={item.stripe_onboarding_complete ? 'success' : 'warning'}>
              {item.stripe_onboarding_complete ? 'Complete' : 'Not complete'}
            </Badge>
          )}
        </button>
      ),
    },
    {
      key: 'qaLiveState',
      header: 'Live on QA',
      sortable: true,
      render: item => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setFilters(current => ({ ...current, qaLiveState: item.qaLiveState }))
          }}
          className="inline-flex"
          title="Filter businesses by this QA live state"
        >
          {item.active === null ? (
            <Badge variant="default">Unknown</Badge>
          ) : (
            <Badge variant={item.active ? 'success' : 'warning'}>
              {item.active ? 'Live' : 'Not live'}
            </Badge>
          )}
        </button>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: item => (
        <span className="text-xs text-surface-500">
          {item.updatedAt ? relativeTime(item.updatedAt) : (item.createdAt ? relativeTime(item.createdAt) : 'N/A')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: item => (
        <div className="flex flex-wrap gap-2">
          <Link href={item.detailHref} onClick={(event) => event.stopPropagation()}>
            <Button variant="outline" size="sm">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          {item.stripe_onboarding_complete === false ? (
            <Link href={`${item.detailHref}#stripe`} onClick={(event) => event.stopPropagation()}>
              <Button variant="outline" size="sm">
                <CreditCard className="h-3.5 w-3.5" /> Stripe
              </Button>
            </Link>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Businesses"
        description="See which QA businesses have finished Stripe onboarding and which ones are actually live for customers in the webapp."
        actions={(
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Business
          </Button>
        )}
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyField="rowId"
        searchable
        searchPlaceholder="Search by business, owner, email, or location..."
        loading={loading}
        onRowClick={item => router.push(item.detailHref)}
        filters={[
          { key: 'stripeState', label: 'All Stripe states', options: STRIPE_OPTIONS },
          { key: 'qaLiveState', label: 'All QA live states', options: QA_LIVE_OPTIONS },
        ]}
        activeFilters={filters}
        onFilterChange={(key, value) => setFilters(current => ({ ...current, [key]: value }))}
        emptyState={(
          <EmptyState
            icon={<Store className="h-8 w-8" />}
            title="No businesses yet"
            description="No QA businesses were found."
            action={{ label: 'Add Business', onClick: () => setAddOpen(true) }}
          />
        )}
      />

      {(error || qaError) && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div>
            <p className="font-medium">QA business sync warning</p>
            <p className="mt-1 text-xs text-warning-700">{error || qaError}</p>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a New Business</DialogTitle>
            <DialogDescription>
              Enter the basics to create a new business lead. You can add more details later.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Business Name *</label>
              <Input
                placeholder="e.g. Sunrise Coffee Shop"
                required
                value={formName}
                onChange={event => handleNameChange(event.target.value)}
              />
              {dupWarning && (
                <p className="flex items-center gap-1 text-xs text-warning-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {dupWarning} You can still save if this is a different location.
                </p>
              )}
            </div>

            {/* Primary contact search — link the business to an existing user/contact */}
            <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
              <div className="mb-2 text-sm font-medium text-blue-900">Primary contact (optional)</div>
              {pickedContact ? (
                <div className="flex items-center justify-between rounded-md border border-blue-300 bg-white p-2">
                  <div>
                    <div className="text-sm font-medium text-surface-900">{pickedContact.name}</div>
                    <div className="text-xs text-surface-600">
                      {pickedContact.email}
                      {pickedContact.referralCode && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-900">
                          referral: {pickedContact.referralCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setPickedContact(null); setContactQuery('') }}
                  >
                    Clear
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Search by name, email, or phone…"
                    value={contactQuery}
                    onChange={(e) => setContactQuery(e.target.value)}
                  />
                  {contactResults.length > 0 && (
                    <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-blue-200 bg-white">
                      {contactResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setPickedContact({
                            id: u.id,
                            name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || '—',
                            email: u.email,
                            referralCode: u.referralCode,
                          })}
                          className="flex w-full items-center justify-between gap-2 border-b border-blue-100 p-2 text-left text-sm hover:bg-blue-50 last:border-b-0"
                        >
                          <div>
                            <div className="font-medium text-surface-900">{u.firstName} {u.lastName}</div>
                            <div className="text-xs text-surface-600">
                              {u.email}{u.phoneNumber ? ` • ${u.phoneNumber}` : ''}
                              {u.referralCode && <span className="ml-2 font-mono text-blue-700">{u.referralCode}</span>}
                            </div>
                          </div>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">Pick</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-blue-800">
                    Linking an existing user pulls their referral code straight from the backend.
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">City</label>
                <select
                  value={formCityId}
                  onChange={event => setFormCityId(event.target.value)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select a city...</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>{city.name}, {city.state}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Category</label>
                <Input
                  placeholder="e.g. Restaurant"
                  value={formCategory}
                  onChange={event => setFormCategory(event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Email</label>
                <Input
                  type="email"
                  placeholder="owner@business.com"
                  value={formEmail}
                  onChange={event => setFormEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Phone</label>
                <Input
                  type="tel"
                  placeholder="(404) 555-0000"
                  value={formPhone}
                  onChange={event => setFormPhone(event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Website</label>
                <Input
                  placeholder="www.example.com"
                  value={formWebsite}
                  onChange={event => setFormWebsite(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Brand</label>
                <select
                  value={formBrand}
                  onChange={event => setFormBrand(event.target.value as 'localvip' | 'hato')}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="localvip">LocalVIP</option>
                  <option value="hato">Help A Teacher Out</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Source</label>
                <select
                  value={formSource}
                  onChange={event => setFormSource(event.target.value)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select a source...</option>
                  {SOURCE_OPTIONS.map(source => (
                    <option key={source.value} value={source.value}>{source.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Stage</label>
                <select
                  value={formStage}
                  onChange={event => setFormStage(event.target.value as OnboardingStage)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {STAGE_OPTIONS.map(stage => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {insertError && (
              <p className="text-sm text-danger-600">{insertError}</p>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setAddOpen(false); resetForm() }}>
                Cancel
              </Button>
              <Button type="submit" disabled={inserting}>
                {inserting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Create Lead
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
