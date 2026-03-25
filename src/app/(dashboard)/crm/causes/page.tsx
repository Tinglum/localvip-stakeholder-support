'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Heart, Plus, AlertTriangle, MapPin, School, Church, Building2, Users,
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
import { formatDate } from '@/lib/utils'
import type { OnboardingStage, EntityStatus, Brand } from '@/lib/types/database'

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

// ─── Demo data ──────────────────────────────────────────────

interface CauseRow {
  id: string
  name: string
  type: string
  city: string
  stage: OnboardingStage
  owner: string
  brand: Brand
  status: EntityStatus
  duplicate_of: string | null
  last_activity: string
}

const DEMO_CAUSES: CauseRow[] = [
  { id: 'cau-001', name: 'MLK Jr. Elementary', type: 'school', city: 'Atlanta', stage: 'live', owner: 'Dr. Sarah Johnson', brand: 'hato', status: 'active', duplicate_of: null, last_activity: '2026-03-20T10:00:00Z' },
  { id: 'cau-002', name: 'CommunityStrong Foundation', type: 'nonprofit', city: 'Atlanta', stage: 'onboarded', owner: 'Marcus Williams', brand: 'localvip', status: 'active', duplicate_of: null, last_activity: '2026-03-19T14:30:00Z' },
  { id: 'cau-003', name: 'Grace Community Church', type: 'church', city: 'Marietta', stage: 'interested', owner: 'Casey Adams', brand: 'localvip', status: 'active', duplicate_of: null, last_activity: '2026-03-18T09:15:00Z' },
  { id: 'cau-004', name: 'Westside Academy', type: 'school', city: 'Atlanta', stage: 'in_progress', owner: 'Dr. Sarah Johnson', brand: 'hato', status: 'active', duplicate_of: null, last_activity: '2026-03-21T11:00:00Z' },
  { id: 'cau-005', name: 'Decatur Youth Alliance', type: 'nonprofit', city: 'Decatur', stage: 'contacted', owner: 'Jordan Taylor', brand: 'localvip', status: 'active', duplicate_of: null, last_activity: '2026-03-17T16:00:00Z' },
  { id: 'cau-006', name: 'Oak Hill Elementary', type: 'school', city: 'Roswell', stage: 'lead', owner: 'Unassigned', brand: 'hato', status: 'active', duplicate_of: 'cau-007', last_activity: '2026-03-15T08:00:00Z' },
  { id: 'cau-007', name: 'Oakhill Elementary School', type: 'school', city: 'Roswell', stage: 'contacted', owner: 'Alex Rivera', brand: 'hato', status: 'active', duplicate_of: 'cau-006', last_activity: '2026-03-16T10:00:00Z' },
  { id: 'cau-008', name: 'Eastside Community Center', type: 'community', city: 'Atlanta', stage: 'interested', owner: 'Marcus Williams', brand: 'localvip', status: 'active', duplicate_of: null, last_activity: '2026-03-22T13:00:00Z' },
]

// ─── Filter options ─────────────────────────────────────────

const STAGE_OPTIONS = Object.entries(ONBOARDING_STAGES).map(([value, def]) => ({ value, label: def.label }))
const TYPE_OPTIONS = [
  { value: 'school', label: 'School' }, { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'church', label: 'Church' }, { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' },
]
const CITY_OPTIONS = [...new Set(DEMO_CAUSES.map(c => c.city))].map(c => ({ value: c, label: c }))
const OWNER_OPTIONS = [...new Set(DEMO_CAUSES.map(c => c.owner))].map(o => ({ value: o, label: o }))

// ─── Component ──────────────────────────────────────────────

export default function CausesPage() {
  const router = useRouter()
  const [addOpen, setAddOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<Record<string, string>>({})

  const filtered = React.useMemo(() => {
    let result = DEMO_CAUSES as CauseRow[]
    if (filters.stage) result = result.filter(c => c.stage === filters.stage)
    if (filters.type) result = result.filter(c => c.type === filters.type)
    if (filters.city) result = result.filter(c => c.city === filters.city)
    if (filters.owner) result = result.filter(c => c.owner === filters.owner)
    return result
  }, [filters])

  const columns: Column<CauseRow>[] = [
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
      key: 'city', header: 'City', sortable: true,
      render: (c) => (
        <span className="flex items-center gap-1 text-surface-600">
          <MapPin className="h-3.5 w-3.5 text-surface-400" /> {c.city}
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
      key: 'owner', header: 'Owner', sortable: true,
      render: (c) => (
        <span className={c.owner === 'Unassigned' ? 'italic text-surface-400' : 'text-surface-700'}>{c.owner}</span>
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
          { key: 'city', label: 'All Cities', options: CITY_OPTIONS },
          { key: 'owner', label: 'All Owners', options: OWNER_OPTIONS },
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
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a New Cause</DialogTitle>
            <DialogDescription>Register a school, nonprofit, church, or community organization.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setAddOpen(false) }}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Organization Name *</label>
              <Input placeholder="e.g. Riverside Elementary" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Type</label>
                <select className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm">
                  <option value="school">School</option>
                  <option value="nonprofit">Nonprofit</option>
                  <option value="church">Church</option>
                  <option value="community">Community</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">City</label>
                <Input placeholder="e.g. Atlanta" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Email</label>
                <Input type="email" placeholder="contact@school.edu" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Phone</label>
                <Input type="tel" placeholder="(404) 555-0000" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit"><Plus className="h-4 w-4" /> Create Cause</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
