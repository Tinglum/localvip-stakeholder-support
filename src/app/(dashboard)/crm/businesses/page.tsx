'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, MapPin, Plus, Store } from 'lucide-react'
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
import type { CrmBusinessListItem } from '@/lib/business-api'
import type { Business, OnboardingStage } from '@/lib/types/database'

const STAGE_BADGE_VARIANT: Record<OnboardingStage, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  lead: 'default',
  contacted: 'info',
  interested: 'info',
  in_progress: 'warning',
  onboarded: 'success',
  live: 'success',
  paused: 'warning',
  declined: 'danger',
}

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

const ORIGIN_OPTIONS = [
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'qa', label: 'QA only' },
  { value: 'local', label: 'Local only' },
]

interface BusinessRow extends CrmBusinessListItem {
  locationLabel: string
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

  const { data: businessResponse, loading, error, refetch } = useCrmBusinesses()
  const { data: cities } = useCities()
  const businesses = React.useMemo(() => businessResponse?.items || [], [businessResponse])
  const qaError = businessResponse?.qaError || null

  const rows = React.useMemo<BusinessRow[]>(() =>
    businesses.map(item => ({
      ...item,
      locationLabel: [item.city, item.state].filter(Boolean).join(', ') || '—',
    })),
    [businesses]
  )

  const filtered = React.useMemo(() => {
    let result = rows
    if (filters.stage) result = result.filter(item => item.stage === filters.stage)
    if (filters.origin) result = result.filter(item => item.origin === filters.origin)
    return result
  }, [filters.origin, filters.stage, rows])

  const handleFilterChange = React.useCallback((key: string, value: string) => {
    setFilters(current => ({ ...current, [key]: value }))
  }, [])

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
            <span className="font-medium text-surface-900">{item.name}</span>
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
      key: 'ownerName',
      header: 'Owner',
      sortable: true,
      render: item => (
        <div className="space-y-1">
          <p className="text-sm text-surface-800">{item.ownerName || '—'}</p>
          <p className="text-xs text-surface-500">{item.ownerEmail || 'No owner email from QA'}</p>
        </div>
      ),
    },
    {
      key: 'locationLabel',
      header: 'Location',
      sortable: true,
      render: item => (
        <span className="flex items-center gap-1 text-surface-600">
          <MapPin className="h-3.5 w-3.5 text-surface-400" />
          {item.locationLabel}
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Dashboard Stage',
      sortable: true,
      render: item => (
        item.stage ? (
          <Badge variant={STAGE_BADGE_VARIANT[item.stage]} dot>
            {ONBOARDING_STAGES[item.stage].label}
          </Badge>
        ) : (
          <Badge variant="default">Not imported</Badge>
        )
      ),
    },
    {
      key: 'origin',
      header: 'Source of Record',
      sortable: true,
      render: item => (
        <Badge variant={item.origin === 'hybrid' ? 'success' : item.origin === 'qa' ? 'info' : 'warning'}>
          {item.origin === 'hybrid' ? 'Hybrid' : item.origin === 'qa' ? 'QA only' : 'Local only'}
        </Badge>
      ),
    },
    {
      key: 'active',
      header: 'API Status',
      sortable: true,
      render: item => (
        item.active === null ? (
          <Badge variant="default">No QA record</Badge>
        ) : (
          <Badge variant={item.active ? 'success' : 'warning'}>
            {item.active ? 'Active' : 'Inactive'}
          </Badge>
        )
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: item => (
        <span className="text-xs text-surface-500">
          {item.updatedAt ? relativeTime(item.updatedAt) : (item.createdAt ? relativeTime(item.createdAt) : '—')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Dashboard Status',
      render: item => (
        item.status ? (
          <Badge variant={item.status === 'active' ? 'success' : item.status === 'pending' ? 'warning' : 'default'}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Badge>
        ) : (
          <Badge variant="default">Read only</Badge>
        )
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Businesses"
        description="Render live QA business records on demand while keeping dashboard-only records local."
        actions={(
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Business
          </Button>
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

      <DataTable
        columns={columns}
        data={filtered}
        keyField="rowId"
        searchable
        searchPlaceholder="Search by business, owner, email, or location..."
        loading={loading}
        onRowClick={item => router.push(item.detailHref)}
        filters={[
          { key: 'stage', label: 'All Dashboard Stages', options: STAGE_OPTIONS },
          { key: 'origin', label: 'All Record Sources', options: ORIGIN_OPTIONS },
        ]}
        activeFilters={filters}
        onFilterChange={handleFilterChange}
        emptyState={(
          <EmptyState
            icon={<Store className="h-8 w-8" />}
            title="No businesses yet"
            description="No live QA businesses or local dashboard businesses were found."
            action={{ label: 'Add Business', onClick: () => setAddOpen(true) }}
          />
        )}
      />

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
