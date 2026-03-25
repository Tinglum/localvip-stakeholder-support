'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Store, Plus, AlertTriangle, MapPin,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useBusinesses, useBusinessInsert, useCities } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import type { Business, City, OnboardingStage } from '@/lib/types/database'

// ─── Stage badge color map ──────────────────────────────────

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

// ─── Source options ──────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Cold Outreach', label: 'Cold Outreach' },
  { value: 'Website Form', label: 'Website Form' },
  { value: 'Campaign', label: 'Campaign' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Other', label: 'Other' },
]

// ─── Filter options ─────────────────────────────────────────

const STAGE_OPTIONS = Object.entries(ONBOARDING_STAGES).map(([value, def]) => ({
  value, label: def.label,
}))

// ─── Relative time helper ───────────────────────────────────

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

// ─── Business row type with resolved city name ──────────────

interface BusinessRow extends Business {
  city_name: string
}

// ─── Component ──────────────────────────────────────────────

export default function BusinessesPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [addOpen, setAddOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<Record<string, string>>({})

  // Form state
  const [formName, setFormName] = React.useState('')
  const [formEmail, setFormEmail] = React.useState('')
  const [formPhone, setFormPhone] = React.useState('')
  const [formWebsite, setFormWebsite] = React.useState('')
  const [formCategory, setFormCategory] = React.useState('')
  const [formSource, setFormSource] = React.useState('')
  const [formCityId, setFormCityId] = React.useState('')
  const [formBrand, setFormBrand] = React.useState<'localvip' | 'hato'>('localvip')
  const [formStage, setFormStage] = React.useState<OnboardingStage>('lead')

  // Data hooks
  const { data: businesses, loading, refetch } = useBusinesses()
  const { data: cities } = useCities()
  const { insert, loading: inserting, error: insertError } = useBusinessInsert()

  // Build a city lookup map
  const cityMap = React.useMemo(() => {
    const map: Record<string, City> = {}
    for (const city of cities) {
      map[city.id] = city
    }
    return map
  }, [cities])

  // City filter options derived from real cities
  const cityFilterOptions = React.useMemo(() =>
    cities.map(c => ({ value: c.id, label: c.name })),
    [cities]
  )

  // Source filter options derived from actual data
  const sourceFilterOptions = React.useMemo(() => {
    const sources = [...new Set(businesses.map(b => b.source).filter(Boolean))] as string[]
    return sources.map(s => ({ value: s, label: s }))
  }, [businesses])

  // Enrich businesses with city_name
  const enrichedBusinesses: BusinessRow[] = React.useMemo(() =>
    businesses.map(b => ({
      ...b,
      city_name: b.city_id ? (cityMap[b.city_id]?.name ?? '—') : '—',
    })),
    [businesses, cityMap]
  )

  // Apply external filters (DataTable handles search internally)
  const filtered = React.useMemo(() => {
    let result = enrichedBusinesses
    if (filters.stage) result = result.filter(b => b.stage === filters.stage)
    if (filters.city_id) result = result.filter(b => b.city_id === filters.city_id)
    if (filters.source) result = result.filter(b => b.source === filters.source)
    return result
  }, [enrichedBusinesses, filters])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const resetForm = () => {
    setFormName('')
    setFormEmail('')
    setFormPhone('')
    setFormWebsite('')
    setFormCategory('')
    setFormSource('')
    setFormCityId('')
    setFormBrand('localvip')
    setFormStage('lead')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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

    const result = await insert(record)
    if (result) {
      setAddOpen(false)
      resetForm()
      refetch()
    }
  }

  const columns: Column<BusinessRow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (biz) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-surface-900">{biz.name}</span>
          {biz.duplicate_of && (
            <span title="Potential duplicate detected">
              <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'city_name',
      header: 'City',
      sortable: true,
      render: (biz) => (
        <span className="flex items-center gap-1 text-surface-600">
          <MapPin className="h-3.5 w-3.5 text-surface-400" />
          {biz.city_name}
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      sortable: true,
      render: (biz) => (
        <Badge variant={STAGE_BADGE_VARIANT[biz.stage]} dot>
          {ONBOARDING_STAGES[biz.stage].label}
        </Badge>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (biz) => (
        <span className="text-surface-600">{biz.category ?? '—'}</span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      render: (biz) => (
        <span className="text-surface-600">{biz.source ?? '—'}</span>
      ),
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      sortable: true,
      render: (biz) => (
        <span className="text-surface-500 text-xs">
          {relativeTime(biz.updated_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (biz) => (
        <Badge variant={biz.status === 'active' ? 'success' : biz.status === 'pending' ? 'warning' : 'default'}>
          {biz.status.charAt(0).toUpperCase() + biz.status.slice(1)}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Businesses"
        description="Track and onboard local businesses"
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Business
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        searchable
        searchPlaceholder="Search by name, email, or phone..."
        loading={loading}
        onRowClick={(biz) => router.push(`/crm/businesses/${biz.id}`)}
        filters={[
          { key: 'stage', label: 'All Stages', options: STAGE_OPTIONS },
          { key: 'city_id', label: 'All Cities', options: cityFilterOptions },
          { key: 'source', label: 'All Sources', options: sourceFilterOptions },
        ]}
        activeFilters={filters}
        onFilterChange={handleFilterChange}
        emptyState={
          <EmptyState
            icon={<Store className="h-8 w-8" />}
            title="No businesses yet"
            description="Add your first business to start building your pipeline."
            action={{ label: 'Add Business', onClick: () => setAddOpen(true) }}
          />
        }
      />

      {/* Add Business Dialog */}
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
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">City</label>
                <select
                  value={formCityId}
                  onChange={(e) => setFormCityId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select a city...</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>{c.name}, {c.state}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Category</label>
                <Input
                  placeholder="e.g. Restaurant"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
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
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Phone</label>
                <Input
                  type="tel"
                  placeholder="(404) 555-0000"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Website</label>
                <Input
                  placeholder="www.example.com"
                  value={formWebsite}
                  onChange={(e) => setFormWebsite(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Brand</label>
                <select
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value as 'localvip' | 'hato')}
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
                  onChange={(e) => setFormSource(e.target.value)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select a source...</option>
                  {SOURCE_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Stage</label>
                <select
                  value={formStage}
                  onChange={(e) => setFormStage(e.target.value as OnboardingStage)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {STAGE_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
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
