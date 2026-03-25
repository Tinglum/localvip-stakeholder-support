'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Store, Plus, AlertTriangle, Phone, Mail, Globe,
  MapPin, Calendar, MoreHorizontal,
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
import type { OnboardingStage, EntityStatus } from '@/lib/types/database'

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

// ─── Demo data ──────────────────────────────────────────────

interface BusinessRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  city: string
  stage: OnboardingStage
  owner: string
  source: string
  last_activity: string
  status: EntityStatus
  duplicate_of: string | null
  category: string
  address: string
  created_at: string
}

const DEMO_BUSINESSES: BusinessRow[] = [
  {
    id: 'biz-001', name: 'Main Street Bakery', email: 'hello@mainstreetbakery.com',
    phone: '(404) 555-0101', website: 'mainstreetbakery.com', city: 'Atlanta',
    stage: 'interested', owner: 'Alex Rivera', source: 'Walk-in',
    last_activity: '2026-03-22T10:30:00Z', status: 'active', duplicate_of: 'biz-009',
    category: 'Restaurant / Bakery', address: '142 Main St, Atlanta, GA 30301',
    created_at: '2026-02-10T00:00:00Z',
  },
  {
    id: 'biz-002', name: 'Peachtree Auto Repair', email: 'service@peachtreeauto.com',
    phone: '(404) 555-0202', website: 'peachtreeauto.com', city: 'Atlanta',
    stage: 'in_progress', owner: 'Alex Rivera', source: 'Referral',
    last_activity: '2026-03-21T14:00:00Z', status: 'active', duplicate_of: null,
    category: 'Automotive', address: '890 Peachtree Rd, Atlanta, GA 30308',
    created_at: '2026-01-22T00:00:00Z',
  },
  {
    id: 'biz-003', name: 'River Cafe', email: 'info@rivercafe.co',
    phone: '(404) 555-0303', website: 'rivercafe.co', city: 'Atlanta',
    stage: 'onboarded', owner: 'Jordan Taylor', source: 'Campaign - Spring 2026',
    last_activity: '2026-03-20T09:15:00Z', status: 'active', duplicate_of: null,
    category: 'Restaurant / Cafe', address: '55 River Walk Dr, Atlanta, GA 30339',
    created_at: '2026-01-05T00:00:00Z',
  },
  {
    id: 'biz-004', name: 'Sunrise Yoga Studio', email: 'namaste@sunriseyoga.com',
    phone: '(678) 555-0404', website: 'sunriseyoga.com', city: 'Marietta',
    stage: 'live', owner: 'Casey Adams', source: 'Cold Outreach',
    last_activity: '2026-03-18T16:45:00Z', status: 'active', duplicate_of: null,
    category: 'Health & Wellness', address: '210 Church St, Marietta, GA 30060',
    created_at: '2025-11-12T00:00:00Z',
  },
  {
    id: 'biz-005', name: 'Southern Paws Pet Grooming', email: 'bark@southernpaws.com',
    phone: '(770) 555-0505', website: null, city: 'Decatur',
    stage: 'lead', owner: 'Unassigned', source: 'Website Form',
    last_activity: '2026-03-23T08:00:00Z', status: 'active', duplicate_of: null,
    category: 'Pet Services', address: '77 College Ave, Decatur, GA 30030',
    created_at: '2026-03-22T00:00:00Z',
  },
  {
    id: 'biz-006', name: 'Buckhead Dental Arts', email: 'front@buckheaddental.com',
    phone: '(404) 555-0606', website: 'buckheaddental.com', city: 'Atlanta',
    stage: 'contacted', owner: 'Alex Rivera', source: 'Referral',
    last_activity: '2026-03-19T11:30:00Z', status: 'active', duplicate_of: null,
    category: 'Healthcare / Dental', address: '3200 Lenox Rd, Atlanta, GA 30326',
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'biz-007', name: 'Midtown Print Shop', email: 'orders@midtownprint.com',
    phone: '(404) 555-0707', website: 'midtownprint.com', city: 'Atlanta',
    stage: 'declined', owner: 'Jordan Taylor', source: 'Walk-in',
    last_activity: '2026-03-10T15:00:00Z', status: 'inactive', duplicate_of: null,
    category: 'Print & Design', address: '520 10th St NW, Atlanta, GA 30318',
    created_at: '2026-02-14T00:00:00Z',
  },
  {
    id: 'biz-008', name: 'Roswell Family Pharmacy', email: 'rx@roswellfamily.com',
    phone: '(770) 555-0808', website: 'roswellfamilyrx.com', city: 'Roswell',
    stage: 'in_progress', owner: 'Casey Adams', source: 'Cold Outreach',
    last_activity: '2026-03-21T10:00:00Z', status: 'active', duplicate_of: null,
    category: 'Healthcare / Pharmacy', address: '1025 Alpharetta St, Roswell, GA 30075',
    created_at: '2026-02-20T00:00:00Z',
  },
  {
    id: 'biz-009', name: 'Main St. Bakery & Cafe', email: 'contact@mainstreetbakery.com',
    phone: '(404) 555-0101', website: 'mainstreetbakery.com', city: 'Atlanta',
    stage: 'lead', owner: 'Unassigned', source: 'Website Form',
    last_activity: '2026-03-15T12:00:00Z', status: 'active', duplicate_of: 'biz-001',
    category: 'Restaurant / Bakery', address: '142 Main St, Atlanta, GA 30301',
    created_at: '2026-03-14T00:00:00Z',
  },
  {
    id: 'biz-010', name: 'EastSide Barbershop', email: null,
    phone: '(404) 555-1010', website: null, city: 'Atlanta',
    stage: 'contacted', owner: 'Jordan Taylor', source: 'Walk-in',
    last_activity: '2026-03-17T14:30:00Z', status: 'active', duplicate_of: null,
    category: 'Personal Care', address: '308 Flat Shoals Ave, Atlanta, GA 30316',
    created_at: '2026-03-05T00:00:00Z',
  },
]

// ─── Filter options ─────────────────────────────────────────

const STAGE_OPTIONS = Object.entries(ONBOARDING_STAGES).map(([value, def]) => ({
  value, label: def.label,
}))

const CITY_OPTIONS = [...new Set(DEMO_BUSINESSES.map(b => b.city))].map(c => ({
  value: c, label: c,
}))

const SOURCE_OPTIONS = [...new Set(DEMO_BUSINESSES.map(b => b.source))].map(s => ({
  value: s, label: s,
}))

const OWNER_OPTIONS = [...new Set(DEMO_BUSINESSES.map(b => b.owner))].map(o => ({
  value: o, label: o,
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

// ─── Component ──────────────────────────────────────────────

export default function BusinessesPage() {
  const router = useRouter()
  const [addOpen, setAddOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [businesses] = React.useState<BusinessRow[]>(DEMO_BUSINESSES)

  // Apply external filters (DataTable handles search internally)
  const filtered = React.useMemo(() => {
    let result = businesses
    if (filters.stage) result = result.filter(b => b.stage === filters.stage)
    if (filters.city) result = result.filter(b => b.city === filters.city)
    if (filters.source) result = result.filter(b => b.source === filters.source)
    if (filters.owner) result = result.filter(b => b.owner === filters.owner)
    return result
  }, [businesses, filters])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
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
      key: 'city',
      header: 'City',
      sortable: true,
      render: (biz) => (
        <span className="flex items-center gap-1 text-surface-600">
          <MapPin className="h-3.5 w-3.5 text-surface-400" />
          {biz.city}
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
      key: 'owner',
      header: 'Owner',
      sortable: true,
      render: (biz) => (
        <span className={biz.owner === 'Unassigned' ? 'text-surface-400 italic' : 'text-surface-700'}>
          {biz.owner}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
    },
    {
      key: 'last_activity',
      header: 'Last Activity',
      sortable: true,
      render: (biz) => (
        <span className="text-surface-500 text-xs">
          {relativeTime(biz.last_activity)}
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
        onRowClick={(biz) => router.push(`/crm/businesses/${biz.id}`)}
        filters={[
          { key: 'stage', label: 'All Stages', options: STAGE_OPTIONS },
          { key: 'city', label: 'All Cities', options: CITY_OPTIONS },
          { key: 'source', label: 'All Sources', options: SOURCE_OPTIONS },
          { key: 'owner', label: 'All Owners', options: OWNER_OPTIONS },
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
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              setAddOpen(false)
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Business Name *</label>
              <Input placeholder="e.g. Sunrise Coffee Shop" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">City</label>
                <Input placeholder="e.g. Atlanta" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Category</label>
                <Input placeholder="e.g. Restaurant" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Email</label>
                <Input type="email" placeholder="owner@business.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Phone</label>
                <Input type="tel" placeholder="(404) 555-0000" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Source</label>
              <Input placeholder="e.g. Walk-in, Referral, Website" />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Plus className="h-4 w-4" /> Create Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
