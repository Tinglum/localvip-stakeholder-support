'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Mail, MapPin, Phone, RefreshCw, Users } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function formatConsumerType(type: string) {
  return type === 'LaunchTeamPartner' ? 'Launch Team Partner' : type
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
    return consumers.filter((consumer) => consumer.consumerType === typeFilter)
  }, [consumers, typeFilter])

  const uniqueTypes = React.useMemo(() => {
    const types = new Set(consumers.map((consumer) => consumer.consumerType))
    return Array.from(types).sort()
  }, [consumers])

  const columns: Column<QaConsumerListItem>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (consumer) => (
        <Link
          href={`/crm/consumers/${consumer.id}`}
          onClick={(event) => event.stopPropagation()}
          className="font-medium text-surface-900 transition-colors hover:text-brand-700"
        >
          {consumer.firstName} {consumer.lastName}
        </Link>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (consumer) => consumer.email ? (
        <a
          href={`mailto:${consumer.email}`}
          onClick={(event) => event.stopPropagation()}
          className="flex items-center gap-1 text-surface-600 transition-colors hover:text-brand-700"
        >
          <Mail className="h-3.5 w-3.5 text-surface-400" />
          {consumer.email}
        </a>
      ) : (
        <Link
          href={`/crm/consumers/${consumer.id}`}
          onClick={(event) => event.stopPropagation()}
          className="text-xs font-semibold text-amber-700 hover:text-amber-800"
        >
          Add email/support
        </Link>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (consumer) => consumer.phoneNumber ? (
        <a
          href={`tel:${consumer.phoneNumber}`}
          onClick={(event) => event.stopPropagation()}
          className="flex items-center gap-1 text-surface-600 transition-colors hover:text-brand-700"
        >
          <Phone className="h-3.5 w-3.5 text-surface-400" />
          {consumer.phoneNumber}
        </a>
      ) : (
        <Link
          href={`/crm/consumers/${consumer.id}`}
          onClick={(event) => event.stopPropagation()}
          className="text-xs font-semibold text-amber-700 hover:text-amber-800"
        >
          Add phone/support
        </Link>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (consumer) => {
        const parts = [consumer.city, consumer.state, consumer.country].filter(Boolean)
        return parts.length ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              router.push(`/crm/consumers/${consumer.id}`)
            }}
            className="flex items-center gap-1 text-left text-surface-600 transition-colors hover:text-brand-700"
          >
            <MapPin className="h-3.5 w-3.5 text-surface-400" />
            {parts.join(', ')}
          </button>
        ) : (
          <Link
            href={`/crm/consumers/${consumer.id}`}
            onClick={(event) => event.stopPropagation()}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800"
          >
            Add location/support
          </Link>
        )
      },
    },
    {
      key: 'consumerType',
      header: 'Type',
      sortable: true,
      render: (consumer) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setTypeFilter(consumer.consumerType)
          }}
          title="Filter consumers by this type"
        >
          <Badge variant={TYPE_VARIANT[consumer.consumerType] || 'default'} dot>
            {consumer.consumerType === 'LaunchTeamPartner' ? 'Launch Team' : consumer.consumerType}
          </Badge>
        </button>
      ),
    },
    {
      key: 'createdDate',
      header: 'Joined',
      sortable: true,
      render: (consumer) => (
        <span className="text-sm text-surface-600">
          {new Date(consumer.createdDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (consumer) => (
        <Link href={`/crm/consumers/${consumer.id}`} onClick={(event) => event.stopPropagation()}>
          <Button variant="outline" size="sm">
            Open <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumers"
        description="All consumer accounts from the QA backend. Every row, badge, and missing field opens a useful action."
        actions={(
          <Button variant="outline" onClick={() => void fetchConsumers()}>
            <RefreshCw className="h-4 w-4" /> Refresh QA
          </Button>
        )}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter || 'all'} onValueChange={(value) => setTypeFilter(value === 'all' ? '' : value)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {uniqueTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {formatConsumerType(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {typeFilter ? (
          <Button variant="ghost" size="sm" onClick={() => setTypeFilter('')}>
            Clear type filter
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

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
          onRowClick={(consumer) => router.push(`/crm/consumers/${consumer.id}`)}
          emptyState={(
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No consumers found"
              description={typeFilter ? 'No consumers match the selected filter.' : 'No consumer accounts exist yet.'}
              action={typeFilter ? { label: 'Clear filter', onClick: () => setTypeFilter('') } : { label: 'Refresh QA', onClick: () => void fetchConsumers() }}
            />
          )}
        />
      )}
    </div>
  )
}
