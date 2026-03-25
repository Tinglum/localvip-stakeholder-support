'use client'

import * as React from 'react'
import { CheckSquare, Plus, Clock, AlertCircle, ArrowRight } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'
import { PRIORITY_COLORS } from '@/lib/constants'
import type { TaskPriority, TaskStatus } from '@/lib/types/database'

interface TaskRow {
  id: string
  title: string
  priority: TaskPriority
  status: TaskStatus
  assigned_to: string
  entity: string | null
  due_date: string | null
  created_at: string
}

const PRIORITY_VARIANT: Record<TaskPriority, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default', medium: 'info', high: 'warning', urgent: 'danger',
}

const STATUS_VARIANT: Record<TaskStatus, 'default' | 'info' | 'success' | 'warning'> = {
  pending: 'default', in_progress: 'info', completed: 'success', cancelled: 'warning',
}

const DEMO_TASKS: TaskRow[] = [
  { id: 't-001', title: 'Follow up with Main Street Bakery — send one-pager', priority: 'high', status: 'pending', assigned_to: 'Alex Rivera', entity: 'Main Street Bakery', due_date: '2026-03-25', created_at: '2026-03-22' },
  { id: 't-002', title: 'Schedule POS setup for Sunrise Yoga', priority: 'high', status: 'in_progress', assigned_to: 'Casey Adams', entity: 'Sunrise Yoga Studio', due_date: '2026-03-27', created_at: '2026-03-23' },
  { id: 't-003', title: 'Request 501(c)(3) docs from Grace Community Church', priority: 'medium', status: 'pending', assigned_to: 'Rick (Admin)', entity: 'Grace Community Church', due_date: '2026-03-27', created_at: '2026-03-22' },
  { id: 't-004', title: 'Generate QR codes for Atlanta spring campaign', priority: 'medium', status: 'pending', assigned_to: 'Jordan Taylor', entity: null, due_date: '2026-03-28', created_at: '2026-03-20' },
  { id: 't-005', title: 'Update HATO school flyer with new branding', priority: 'low', status: 'pending', assigned_to: 'Rick (Admin)', entity: null, due_date: '2026-04-01', created_at: '2026-03-15' },
  { id: 't-006', title: 'Call EastSide Barbershop — schedule visit', priority: 'high', status: 'pending', assigned_to: 'Jordan Taylor', entity: 'EastSide Barbershop', due_date: '2026-03-26', created_at: '2026-03-22' },
  { id: 't-007', title: 'Review first-month report for Community Strong', priority: 'medium', status: 'pending', assigned_to: 'Marcus Williams', entity: 'Community Strong Foundation', due_date: '2026-03-25', created_at: '2026-03-18' },
  { id: 't-008', title: 'Onboard 3 new volunteers for Charlotte pilot', priority: 'urgent', status: 'in_progress', assigned_to: 'Kenneth (Super Admin)', entity: null, due_date: '2026-03-26', created_at: '2026-03-20' },
]

export default function TasksPage() {
  const [addOpen, setAddOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<Record<string, string>>({})

  const filtered = React.useMemo(() => {
    let result = DEMO_TASKS
    if (filters.priority) result = result.filter(t => t.priority === filters.priority)
    if (filters.status) result = result.filter(t => t.status === filters.status)
    return result
  }, [filters])

  const columns: Column<TaskRow>[] = [
    { key: 'title', header: 'Task', sortable: true, render: (t) => <span className="font-medium text-surface-800">{t.title}</span> },
    { key: 'priority', header: 'Priority', width: '100px', render: (t) => <Badge variant={PRIORITY_VARIANT[t.priority]} dot>{t.priority}</Badge> },
    { key: 'status', header: 'Status', width: '120px', render: (t) => <Badge variant={STATUS_VARIANT[t.status]}>{t.status.replace('_', ' ')}</Badge> },
    { key: 'assigned_to', header: 'Assigned To', sortable: true, render: (t) => <span className="text-surface-600">{t.assigned_to}</span> },
    { key: 'entity', header: 'Related To', render: (t) => t.entity ? <span className="text-surface-600">{t.entity}</span> : <span className="text-surface-300">—</span> },
    {
      key: 'due_date', header: 'Due', sortable: true, width: '120px',
      render: (t) => {
        if (!t.due_date) return <span className="text-surface-300">—</span>
        const isOverdue = new Date(t.due_date) < new Date() && t.status !== 'completed'
        return (
          <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-danger-500 font-medium' : 'text-surface-500'}`}>
            {isOverdue && <AlertCircle className="h-3 w-3" />}
            {formatDate(t.due_date)}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Action items across all stakeholders and onboarding flows. Nothing falls through the cracks."
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Task</Button>}
      />
      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        searchPlaceholder="Search tasks..."
        filters={[
          { key: 'priority', label: 'All Priorities', options: [{ value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
          { key: 'status', label: 'All Statuses', options: [{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }] },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))}
        emptyState={<EmptyState icon={<CheckSquare className="h-8 w-8" />} title="No tasks yet" description="Create a task to track follow-ups and action items." action={{ label: 'Add Task', onClick: () => setAddOpen(true) }} />}
      />
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Create an action item. Assign it to someone and set a due date.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setAddOpen(false) }} className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium text-surface-700">Task Title *</label><Input required placeholder="What needs to happen?" /></div>
            <div><label className="mb-1 block text-sm font-medium text-surface-700">Description</label><Textarea placeholder="Add context or details..." /></div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Priority</label>
                <select className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm">
                  <option value="medium">Medium</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Assign To</label><Input placeholder="Person name" /></div>
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Due Date</label><Input type="date" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit"><Plus className="h-4 w-4" /> Create Task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
