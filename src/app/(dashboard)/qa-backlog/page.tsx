import { PageHeader } from '@/components/ui/page-header'
import { QaUniversalBacklogTable } from '@/components/crm/qa-linking-panels'
import { QA_DASHBOARD_BACKLOG_ROWS } from '@/lib/qa-dashboard-backlog'

export default function QaBacklogPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add to QA"
        description="This is the universal dashboard-to-QA backlog. Every item here is dashboard functionality that still needs QA fields, tables, or APIs before the dashboard can run fully server-side."
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Add to QA' },
        ]}
      />

      <QaUniversalBacklogTable
        title="Universal Dashboard To QA Backlog"
        description="Use this list to decide what fields, workflow domains, and APIs the QA server needs next."
        rows={QA_DASHBOARD_BACKLOG_ROWS}
      />
    </div>
  )
}
