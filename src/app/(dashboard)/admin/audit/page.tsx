'use client'

import * as React from 'react'
import { ScrollText, Loader2 } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { AuditLog } from '@/lib/types/database'

interface AuditRow extends AuditLog {
  user_name: string
  entity_display: string
}

function useAuditLogs() {
  const supabase = React.useMemo(() => createClient(), [])
  const [data, setData] = React.useState<AuditRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetch() {
      setLoading(true)
      const { data: rows } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      // Gather unique user_ids to resolve names
      const logs = (rows || []) as AuditLog[]
      const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))] as string[]

      let profileMap: Record<string, string> = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)
        if (profiles) {
          profileMap = Object.fromEntries((profiles as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))
        }
      }

      const enriched: AuditRow[] = logs.map(log => ({
        ...log,
        user_name: log.user_id ? (profileMap[log.user_id] || 'Unknown User') : 'System',
        entity_display: (log.metadata as Record<string, unknown>)?.entity_name as string || log.entity_type.replace('_', ' ') + ' ' + log.entity_id.slice(0, 8),
      }))

      setData(enriched)
      setLoading(false)
    }
    fetch()
  }, [supabase])

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
