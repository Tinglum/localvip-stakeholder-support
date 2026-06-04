'use client'

import * as React from 'react'
import { ScrollText, Loader2 } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import type { AuditLog } from '@/lib/types/database'

interface AuditRow extends AuditLog {
  user_name: string
  entity_display: string
}

function useAuditLogs() {
  const [data, setData] = React.useState<AuditRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Fetch audit logs and the profiles list (for user name resolution) in
        // parallel from the QA backend. Both routes already exist.
        const [logsRes, profilesRes] = await Promise.all([
          fetch('/api/qa/dashboard/audit_logs?pageSize=200', { cache: 'no-store' }),
          fetch('/api/qa/dashboard/profiles', { cache: 'no-store' }),
        ])
        const logsRaw = logsRes.ok ? await logsRes.json() : []
        const profilesRaw = profilesRes.ok ? await profilesRes.json() : []
        const logs: AuditLog[] = Array.isArray(logsRaw) ? logsRaw : logsRaw?.items ?? []
        const profiles: { id: string | number; full_name?: string; email?: string }[] =
          Array.isArray(profilesRaw) ? profilesRaw : profilesRaw?.items ?? []

        const profileMap: Record<string, string> = {}
        for (const p of profiles) profileMap[String(p.id)] = p.full_name || p.email || `User ${p.id}`

        const enriched: AuditRow[] = logs.map((log) => {
          const meta = (log.metadata as Record<string, unknown>) || {}
          const entityIdStr = String(log.entity_id ?? '')
          const entityName = typeof meta.entity_name === 'string' ? meta.entity_name : null
          return {
            ...log,
            user_name: log.user_id ? (profileMap[String(log.user_id)] || 'Unknown User') : 'System',
            entity_display: entityName
              ?? `${(log.entity_type || '').replace('_', ' ')} ${entityIdStr.slice(0, 8) || ''}`.trim(),
          }
        })

        if (!cancelled) setData(enriched)
      } catch {
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}

const ACTION_VARIANT: Record<string, 'success' | 'info' | 'danger' | 'default'> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
}

export default function AuditLogPage() {
  const { data: auditLogs, loading } = useAuditLogs()

  const columns: Column<AuditRow>[] = [
    { key: 'created_at', header: 'Date', sortable: true, width: '180px', render: (a) => <span className="text-xs text-surface-500">{formatDateTime(a.created_at)}</span> },
    { key: 'action', header: 'Action', width: '100px', render: (a) => <Badge variant={ACTION_VARIANT[a.action] || 'default'}>{a.action}</Badge> },
    { key: 'entity_type', header: 'Type', width: '120px', render: (a) => <span className="text-xs text-surface-500 capitalize">{a.entity_type.replace('_', ' ')}</span> },
    { key: 'entity_display' as keyof AuditRow, header: 'Entity', render: (a) => <span className="font-medium text-surface-800">{a.entity_display}</span> },
    { key: 'user_name' as keyof AuditRow, header: 'By', render: (a) => <span className="text-surface-600">{a.user_name}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="Complete history of every create, update, and delete in the system." />
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={auditLogs}
          keyField="id"
          searchPlaceholder="Search audit log..."
          emptyState={<div className="py-12 text-center text-surface-400"><ScrollText className="mx-auto h-8 w-8 mb-2" /><p>No audit entries yet</p></div>}
        />
      )}
    </div>
  )
}
