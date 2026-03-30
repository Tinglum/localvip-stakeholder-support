'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Heart, Plus, AlertTriangle, MapPin, School, Church, Building2, Users,
  Loader2,
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
import { ONBOARDING_STAGES, BRANDS } from '@/lib/constants'
import { useCauses, useCities } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import type { Cause, OnboardingStage, Brand } from '@/lib/types/database'

// ─── Stage badge variant ────────────────────────────────────

const STAGE_VARIANT: Record<OnboardingStage, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  lead: 'default', contacted: 'info', interested: 'info', in_progress: 'warning',
  onboarded: 'success', live: 'success', paused: 'warning', declined: 'danger',
}

// ─── Cause type icons ───────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  school: <School className="h-3.5 w-3.5" />,
  church: <Church className="h-3.5 w-3.5" />,
  nonprofit: <Building2 className="h-3.5 w-3.5" />,
  community: <Users className="h-3.5 w-3.5" />,
  other: <Heart className="h-3.5 w-3.5" />,
}

// ─── Filter options ─────────────────────────────────────────

const STAGE_OPTIONS = Object.entries(ONBOARDING_STAGES).map(([value, def]) => ({ value, label: def.label }))
const TYPE_OPTIONS = [
  { value: 'school', label: 'School' }, { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'church', label: 'Church' }, { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' },
]
const BRAND_OPTIONS = Object.entries(BRANDS).map(([value, def]) => ({ value, label: def.label }))

// ─── Initial form state ─────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────

export default function CausesPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [addOpen, setAddOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [form, setForm] = React.useState<CauseForm>(INITIAL_FORM)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [dupWarning, setDupWarning] = React.useState<string | null>(null)

  // Build Supabase-compatible filters (only non-empty values)
  const supabaseFilters = React.useMemo(() => {
    const sf: Record<string, string> = {}
    if (filters.stage) sf.stage = filters.stage
    if (filters.type) sf.type = filters.type
    if (filters.brand) sf.brand = filters.brand
    return sf
  }, [filters])

  const { data: causes, loading, error, refetch } = useCauses(supabaseFilters)
  const { data: cities } = useCities()
  const [inserting, setInserting] = React.useState(false)

  // Build city lookup for display
  const cityMap = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const c of cities) m.set(c.id, c.name)
    return m
  }, [cities])

  // City filter options derived from real data
  const cityFilterOptions = React.useMemo(
    () => cities.map(c => ({ value: c.id, label: c.name })),
    [cities],
  )

  // Client-side city filter (city_id isn't a simple eq filter in the hook)
  const filtered = React.useMemo(() => {
    if (!filters.city) return causes
    return causes.filter(c => c.city_id === filters.city)
  }, [causes, filters.city])

  const normalizeName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()

  const handleFormChange = (field: keyof CauseForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'name') {
      if (!value.trim()) { setDupWarning(null); return }
      const normalized = normalizeName(value)
      const match = causes.find(c => normalizeName(c.name) === normalized)
      setDupWarning(match ? `"${match.name}" already exists in your pipeline.` : null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      refetch()
      if (payload?.id) {
        router.push(`/crm/causes/${payload.id}`)
      }
    } finally {
      setInserting(false)
    }
  }

  const columns: Column<Cause>[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-surface-900">{c.name}</span>
          {c.duplicate_of && <span title="Potential duplicate"><AlertTriangle className="h-3.5 w-3.5 text-warning-500" /></span>}
        </div>
      ),
    },
    {
      key: 'type', header: 'Type', sortable: true,
      render: (c) => (
        <span className="flex items-center gap-1.5 text-surface-600">
          {TYPE_ICONS[c.type]}
          {c.type.charAt(0).toUpperCase() + c.type.slice(1)}
        </span>
      ),
    },
    {
      key: 'city_id' as keyof Cause, header: 'City', sortable: true,
      render: (c) => (
        <span className="flex items-center gap-1 text-surface-600">
          <MapPin className="h-3.5 w-3.5 text-surface-400" /> {c.city_id ? cityMap.get(c.city_id) || '—' : '—'}
        </span>
      ),
    },
    {
      key: 'stage', header: 'Stage', sortable: true,
      render: (c) => (
        <Badge variant={STAGE_VARIANT[c.stage]} dot>{ONBOARDING_STAGES[c.stage].label}</Badge>
      ),
    },
    {
      key: 'brand', header: 'Brand', sortable: true,
      render: (c) => (
        <Badge variant={c.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[c.brand].label}</Badge>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (c) => (
        <Badge variant={c.status === 'active' ? 'success' : 'default'}>
          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
        </Badge>
      ),
    },
  ]

  // ─── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading causes...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <AlertTriangle className="h-5 w-5 text-danger-500" />
        <span className="ml-2 text-sm text-danger-600">Error loading causes: {error}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Causes"
        description="Manage schools, nonprofits, churches, and community organizations"
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Cause
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        searchable
        searchPlaceholder="Search causes by name..."
        onRowClick={(c) => router.push(`/crm/causes/${c.id}`)}
        filters={[
          { key: 'stage', label: 'All Stages', options: STAGE_OPTIONS },
          { key: 'type', label: 'All Types', options: TYPE_OPTIONS },
          { key: 'brand', label: 'All Brands', options: BRAND_OPTIONS },
          { key: 'city', label: 'All Cities', options: cityFilterOptions },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        emptyState={
          <EmptyState
            icon={<Heart className="h-8 w-8" />}
            title="No causes yet"
            description="Register your first school, nonprofit, or community organization."
            action={{ label: 'Add Cause', onClick: () => setAddOpen(true) }}
          />
        }
      />

      {/* Add Cause Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setForm(INITIAL_FORM); setSubmitError(null); setDupWarning(null) } }}>
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
                onChange={(e) => handleFormChange('name', e.target.value)}
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
                  onChange={(e) => handleFormChange('type', e.target.value)}
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
                  onChange={(e) => handleFormChange('city_id', e.target.value)}
                >
                  <option value="">Select a city...</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
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
                  onChange={(e) => handleFormChange('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Phone</label>
                <Input
                  type="tel"
                  placeholder="(404) 555-0000"
                  value={form.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
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
                  onChange={(e) => handleFormChange('website', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Source</label>
                <Input
                  placeholder="e.g. Referral, Website, Event"
                  value={form.source}
                  onChange={(e) => handleFormChange('source', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Brand</label>
                <select
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  value={form.brand}
                  onChange={(e) => handleFormChange('brand', e.target.value)}
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
                  onChange={(e) => handleFormChange('stage', e.target.value)}
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
