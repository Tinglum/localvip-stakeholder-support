'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  Church,
  Heart,
  Loader2,
  MapPin,
  Plus,
  School,
  Users,
} from 'lucide-react'
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
import { BRANDS, ONBOARDING_STAGES } from '@/lib/constants'
import { useCrmCauses } from '@/lib/hooks/crm-businesses'
import { useCities } from '@/lib/supabase/hooks'
import type { Brand, Cause, OnboardingStage } from '@/lib/types/database'
import type { CrmCauseListItem } from '@/lib/crm-api'

const STAGE_VARIANT: Record<OnboardingStage, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  lead: 'default',
  contacted: 'info',
  interested: 'info',
  in_progress: 'warning',
  onboarded: 'success',
  live: 'success',
  paused: 'warning',
  declined: 'danger',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  school: <School className="h-3.5 w-3.5" />,
  church: <Church className="h-3.5 w-3.5" />,
  nonprofit: <Building2 className="h-3.5 w-3.5" />,
  community: <Users className="h-3.5 w-3.5" />,
  other: <Heart className="h-3.5 w-3.5" />,
}

const STAGE_OPTIONS = Object.entries(ONBOARDING_STAGES).map(([value, def]) => ({
  value,
  label: def.label,
}))

const TYPE_OPTIONS = [
  { value: 'school', label: 'School' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'church', label: 'Church' },
  { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' },
]

const BRAND_OPTIONS = Object.entries(BRANDS).map(([value, def]) => ({
  value,
  label: def.label,
}))

const ORIGIN_OPTIONS = [
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'qa', label: 'QA only' },
  { value: 'local', label: 'Local only' },
]

interface CauseForm {
  name: string
  type: Cause['type']
  email: string
  phone: string
  website: string
  city_id: string
  brand: Brand
  source: string
  stage: OnboardingStage
}

const INITIAL_FORM: CauseForm = {
  name: '',
  type: 'school',
  email: '',
  phone: '',
  website: '',
  city_id: '',
  brand: 'localvip',
  source: '',
  stage: 'lead',
}

interface CauseRow extends CrmCauseListItem {
  locationLabel: string
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export default function CausesPage() {
  const router = useRouter()
  const [addOpen, setAddOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [form, setForm] = React.useState<CauseForm>(INITIAL_FORM)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [dupWarning, setDupWarning] = React.useState<string | null>(null)
  const [inserting, setInserting] = React.useState(false)

  const { data: causeResponse, loading, error, refetch } = useCrmCauses()
  const { data: cities } = useCities()
  const causes = React.useMemo(() => causeResponse?.items || [], [causeResponse])
  const qaError = causeResponse?.qaError || null

  const rows = React.useMemo<CauseRow[]>(() =>
    causes.map(item => ({
      ...item,
      locationLabel: [item.city_name || item.city, item.state].filter(Boolean).join(', ') || '—',
    })),
    [causes]
  )

  const filtered = React.useMemo(() => {
    let result = rows
    if (filters.stage) result = result.filter(item => item.stage === filters.stage)
    if (filters.type) result = result.filter(item => item.type === filters.type)
    if (filters.brand) result = result.filter(item => item.brand === filters.brand)
    if (filters.origin) result = result.filter(item => item.origin === filters.origin)
    return result
  }, [filters.brand, filters.origin, filters.stage, filters.type, rows])

  const handleFormChange = React.useCallback((field: keyof CauseForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))

    if (field === 'name') {
      if (!value.trim()) {
        setDupWarning(null)
        return
      }

      const normalized = normalizeName(value)
      const match = causes.find(cause => normalizeName(cause.name) === normalized)
      setDupWarning(match ? `"${match.name}" already exists in your pipeline.` : null)
    }
  }, [causes])

  const handleSubmit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    setInserting(true)

    try {
      const response = await fetch('/api/crm/causes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          brand: form.brand,
          stage: form.stage,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
          city_id: form.city_id || null,
          source: form.source.trim() || null,
          source_detail: 'Added from CRM causes page',
        }),
      })

      const payload = await response.json().catch(() => ({ error: 'Failed to create cause. Please try again.' }))
      if (!response.ok) {
        setSubmitError(payload.error || 'Failed to create cause. Please try again.')
        return
      }

      setAddOpen(false)
      setForm(INITIAL_FORM)
      setDupWarning(null)
      refetch()
      if (payload?.id) router.push(`/crm/causes/${payload.id}`)
    } finally {
      setInserting(false)
    }
  }, [form, refetch, router])

  const columns: Column<CauseRow>[] = [
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
      key: 'type',
      header: 'Type',
      sortable: true,
      render: item => (
        <span className="flex items-center gap-1.5 text-surface-600">
          {TYPE_ICONS[item.type || 'other']}
          {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Nonprofit'}
        </span>
      ),
    },
    {
      key: 'owner_name',
      header: 'Primary Contact',
      sortable: true,
      render: item => (
        <div className="space-y-1">
          <p className="text-sm text-surface-800">{item.owner_name || item.ownerName || '—'}</p>
          <p className="text-xs text-surface-500">{item.owner_email || item.ownerEmail || 'No owner email from QA'}</p>
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
          <Badge variant={STAGE_VARIANT[item.stage]} dot>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading causes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Causes"
        description="Render live QA nonprofit records on demand while keeping dashboard-only CRM workflow local."
        actions={(
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Cause
          </Button>
        )}
      />

      {(error || qaError) && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div>
            <p className="font-medium">QA nonprofit sync warning</p>
            <p className="mt-1 text-xs text-warning-700">{error || qaError}</p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        keyField="rowId"
        searchable
        searchPlaceholder="Search by cause, contact, or location..."
        onRowClick={item => router.push(item.detailHref)}
        filters={[
          { key: 'stage', label: 'All Dashboard Stages', options: STAGE_OPTIONS },
          { key: 'type', label: 'All Types', options: TYPE_OPTIONS },
          { key: 'brand', label: 'All Brands', options: BRAND_OPTIONS },
          { key: 'origin', label: 'All Record Sources', options: ORIGIN_OPTIONS },
        ]}
        activeFilters={filters}
        onFilterChange={(key, value) => setFilters(current => ({ ...current, [key]: value }))}
        emptyState={(
          <EmptyState
            icon={<Heart className="h-8 w-8" />}
            title="No causes yet"
            description="No live QA nonprofits or local dashboard causes were found."
            action={{ label: 'Add Cause', onClick: () => setAddOpen(true) }}
          />
        )}
      />

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) {
            setForm(INITIAL_FORM)
            setSubmitError(null)
            setDupWarning(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a New Cause</DialogTitle>
            <DialogDescription>Register a school, nonprofit, church, or community organization.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Organization Name *</label>
              <Input
                placeholder="e.g. Riverside Elementary"
                required
                value={form.name}
                onChange={event => handleFormChange('name', event.target.value)}
              />
              {dupWarning && (
                <p className="flex items-center gap-1 text-xs text-warning-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {dupWarning} You can still save if this is a separate record.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Type</label>
                <select
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  value={form.type}
                  onChange={event => handleFormChange('type', event.target.value)}
                >
                  <option value="school">School</option>
                  <option value="nonprofit">Nonprofit</option>
                  <option value="church">Church</option>
                  <option value="community">Community</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">City</label>
                <select
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  value={form.city_id}
                  onChange={event => handleFormChange('city_id', event.target.value)}
                >
                  <option value="">Select a city...</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Email</label>
                <Input
                  type="email"
                  placeholder="contact@school.edu"
                  value={form.email}
                  onChange={event => handleFormChange('email', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Phone</label>
                <Input
                  type="tel"
                  placeholder="(404) 555-0000"
                  value={form.phone}
                  onChange={event => handleFormChange('phone', event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Website</label>
                <Input
                  type="url"
                  placeholder="https://example.org"
                  value={form.website}
                  onChange={event => handleFormChange('website', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Source</label>
                <Input
                  placeholder="e.g. Referral, Website, Event"
                  value={form.source}
                  onChange={event => handleFormChange('source', event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Brand</label>
                <select
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  value={form.brand}
                  onChange={event => handleFormChange('brand', event.target.value)}
                >
                  {Object.entries(BRANDS).map(([value, def]) => (
                    <option key={value} value={value}>{def.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Stage</label>
                <select
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  value={form.stage}
                  onChange={event => handleFormChange('stage', event.target.value)}
                >
                  {Object.entries(ONBOARDING_STAGES).map(([value, def]) => (
                    <option key={value} value={value}>{def.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {submitError && (
              <p className="text-sm text-danger-600">{submitError}</p>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={inserting}>
                {inserting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {inserting ? 'Creating...' : 'Create Cause'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
