'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Users, Mail, Phone, MapPin, Loader2 } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { QaConsumerListItem } from '@/lib/auth/qa-api'

const TYPE_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  Normal: 'default',
  Intern: 'info',
  Volunteer: 'warning',
  LaunchTeamPartner: 'success',
  Influencer: 'danger',
}

export default function ConsumersPage() {
  const router = useRouter()
  const [consumers, setConsumers] = React.useState<QaConsumerListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [typeFilter, setTypeFilter] = React.useState<string>('')

  const fetchConsumers = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/qa/consumers')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as Record<string, string>).error || 'Failed to load consumers')
      }
      const data = await res.json() as QaConsumerListItem[]
      setConsumers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consumers')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchConsumers()
  }, [fetchConsumers])

  const filtered = React.useMemo(() => {
    if (!typeFilter) return consumers
    return consumers.filter((c) => c.consumerType === typeFilter)
  }, [consumers, typeFilter])

  const uniqueTypes = React.useMemo(() => {
    const types = new Set(consumers.map((c) => c.consumerType))
    return Array.from(types).sort()
  }, [consumers])

  const columns: Column<QaConsumerListItem>[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      render: (c) => (
        <span className="font-medium text-surface-900">
          {c.firstName} {c.lastName}
        </span>
      ),
    },
    {
      key: 'email', header: 'Email', sortable: true,
      render: (c) => c.email ? (
        <span className="flex items-center gap-1 text-surface-600">
          <Mail className="h-3.5 w-3.5 text-surface-400" />{c.email}
        </span>
      ) : <span className="text-surface-300">—</span>,
    },
    {
      key: 'phone', header: 'Phone',
      render: (c) => c.phoneNumber ? (
        <span className="flex items-center gap-1 text-surface-600">
          <Phone className="h-3.5 w-3.5 text-surface-400" />{c.phoneNumber}
        </span>
      ) : <span className="text-surface-300">—</span>,
    },
    {
      key: 'location', header: 'Location',
      render: (c) => {
        const parts = [c.city, c.state, c.country].filter(Boolean)
        return parts.length ? (
          <span className="flex items-center gap-1 text-surface-600">
            <MapPin className="h-3.5 w-3.5 text-surface-400" />{parts.join(', ')}
          </span>
        ) : <span className="text-surface-300">—</span>
      },
    },
    {
      key: 'consumerType', header: 'Type', sortable: true,
      render: (c) => (
        <Badge variant={TYPE_VARIANT[c.consumerType] || 'default'} dot>
          {c.consumerType === 'LaunchTeamPartner' ? 'Launch Team' : c.consumerType}
        </Badge>
      ),
    },
    {
      key: 'createdDate', header: 'Joined', sortable: true,
      render: (c) => (
        <span className="text-surface-600 text-sm">
          {new Date(c.createdDate).toLocaleDateString()}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumers"
        description="All consumer accounts from the QA backend. Click a row to see details and update their type."
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {uniqueTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t === 'LaunchTeamPartner' ? 'Launch Team Partner' : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
          <span className="ml-2 text-surface-500">Loading consumers...</span>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyField="id"
          loading={false}
          searchPlaceholder="Search by name, email, or location..."
          onRowClick={(c) => router.push(`/crm/consumers/${c.id}`)}
          emptyState={
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No consumers found"
              description={typeFilter ? 'No consumers match the selected filter.' : 'No consumer accounts exist yet.'}
            />
          }
        />
      )}
    </div>
  )
}
