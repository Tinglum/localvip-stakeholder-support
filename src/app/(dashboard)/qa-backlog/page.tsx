'use client'

import * as React from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { QaUniversalBacklogTable } from '@/components/crm/qa-linking-panels'
import { QA_DASHBOARD_BACKLOG_ROWS, type QaBacklogRow } from '@/lib/qa-dashboard-backlog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { exportQaBacklogToExcel } from '@/lib/export-qa-backlog'

const STORAGE_KEY = 'qa-backlog-manual-rows'

function loadManualRows(): QaBacklogRow[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveManualRows(rows: QaBacklogRow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

const STATUS_OPTIONS = [
  'Needs QA fields + APIs',
  'Needs QA workflow domain',
  'Needs QA relationship model',
  'Needs QA file workflow',
  'Needs QA offer domain',
  'Needs QA analytics domain',
  'Needs QA admin domain',
  'In progress',
  'Planned',
]

export default function QaBacklogPage() {
  const [manualRows, setManualRows] = React.useState<QaBacklogRow[]>([])
  const [addOpen, setAddOpen] = React.useState(false)

  const [formArea, setFormArea] = React.useState('')
  const [formFeature, setFormFeature] = React.useState('')
  const [formQaNeed, setFormQaNeed] = React.useState('')
  const [formApis, setFormApis] = React.useState('')
  const [formStatus, setFormStatus] = React.useState(STATUS_OPTIONS[0])

  React.useEffect(() => {
    setManualRows(loadManualRows())
  }, [])

  const allRows = React.useMemo(
    () => [...QA_DASHBOARD_BACKLOG_ROWS, ...manualRows],
    [manualRows],
  )

  const resetForm = React.useCallback(() => {
    setFormArea('')
    setFormFeature('')
    setFormQaNeed('')
    setFormApis('')
    setFormStatus(STATUS_OPTIONS[0])
  }, [])

  const handleAdd = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const newRow: QaBacklogRow = {
        area: formArea.trim(),
        feature: formFeature.trim(),
        qaNeed: formQaNeed.trim(),
        neededApis: formApis.trim(),
        status: formStatus,
      }
      const updated = [...manualRows, newRow]
      setManualRows(updated)
      saveManualRows(updated)
      setAddOpen(false)
      resetForm()
    },
    [formArea, formFeature, formQaNeed, formApis, formStatus, manualRows, resetForm],
  )

  const handleRemove = React.useCallback(
    (index: number) => {
      const updated = manualRows.filter((_, i) => i !== index)
      setManualRows(updated)
      saveManualRows(updated)
    },
    [manualRows],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add to QA"
        description="This is the universal dashboard-to-QA backlog. Every item here is dashboard functionality that still needs QA fields, tables, or APIs before the dashboard can run fully server-side."
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Add to QA' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => exportQaBacklogToExcel(allRows)}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>
        }
      />

      <QaUniversalBacklogTable
        title="Universal Dashboard To QA Backlog"
        description="Use this list to decide what fields, workflow domains, and APIs the QA server needs next."
        rows={allRows}
      />

      {manualRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Manually Added Items</CardTitle>
                <p className="mt-1 text-sm text-surface-500">
                  Items you added manually. These are saved in your browser.
                </p>
              </div>
              <Badge variant="outline">
                {manualRows.length} manual
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-surface-200">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[0.9fr,1.3fr,1.2fr,1.2fr,0.8fr,auto] gap-4 border-b border-surface-200 bg-surface-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">
                  <span>Area</span>
                  <span>Dashboard functionality</span>
                  <span>Needs in QA</span>
                  <span>Needed APIs</span>
                  <span>Status</span>
                  <span />
                </div>
                {manualRows.map((row, idx) => (
                  <div
                    key={`manual-${idx}-${row.area}-${row.feature}`}
                    className="grid grid-cols-[0.9fr,1.3fr,1.2fr,1.2fr,0.8fr,auto] gap-4 border-b border-surface-100 px-4 py-3 text-sm last:border-b-0"
                  >
                    <div className="font-medium text-surface-900">{row.area}</div>
                    <div className="text-surface-700">{row.feature}</div>
                    <div className="text-surface-600">{row.qaNeed}</div>
                    <div className="text-surface-600">{row.neededApis}</div>
                    <div>
                      <Badge variant="outline" className="justify-center">
                        {row.status}
                      </Badge>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => handleRemove(idx)}
                        className="rounded p-1 text-surface-400 hover:bg-danger-50 hover:text-danger-600"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Backlog Item</DialogTitle>
            <DialogDescription>
              Add a new item to the QA backlog. This will be saved locally in your browser.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAdd}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Area *</label>
              <Input
                placeholder="e.g. CRM workflow, Materials, Analytics"
                required
                value={formArea}
                onChange={(e) => setFormArea(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Dashboard Functionality *</label>
              <textarea
                className="min-h-[72px] w-full rounded-lg border border-surface-300 bg-surface-0 px-3 py-2 text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Describe the dashboard feature that needs QA support..."
                required
                value={formFeature}
                onChange={(e) => setFormFeature(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Needs in QA *</label>
              <textarea
                className="min-h-[72px] w-full rounded-lg border border-surface-300 bg-surface-0 px-3 py-2 text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="What fields, tables, or domains are needed in QA..."
                required
                value={formQaNeed}
                onChange={(e) => setFormQaNeed(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Needed APIs</label>
              <Input
                placeholder="e.g. LIST items, CREATE item, UPDATE item"
                value={formApis}
                onChange={(e) => setFormApis(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Status</label>
              <select
                className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setAddOpen(false); resetForm() }}>
                Cancel
              </Button>
              <Button type="submit">
                <Plus className="h-4 w-4" /> Add to Backlog
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
