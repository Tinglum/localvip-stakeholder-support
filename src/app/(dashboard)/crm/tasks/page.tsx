'use client'

import * as React from 'react'
import { CheckSquare, Plus, Clock, AlertCircle, Loader2 } from 'lucide-react'
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
import { useTasks, useTaskInsert, useTaskUpdate } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import type { Task, TaskPriority, TaskStatus } from '@/lib/types/database'

const PRIORITY_VARIANT: Record<TaskPriority, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default', medium: 'info', high: 'warning', urgent: 'danger',
}

const STATUS_VARIANT: Record<TaskStatus, 'default' | 'info' | 'success' | 'warning'> = {
  pending: 'default', in_progress: 'info', completed: 'success', cancelled: 'warning',
}

export default function TasksPage() {
  const { profile } = useAuth()
  const [addOpen, setAddOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)

  // Form state
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [priority, setPriority] = React.useState<TaskPriority>('medium')
  const [status, setStatus] = React.useState<TaskStatus>('pending')
  const [dueDate, setDueDate] = React.useState('')

  const { data: tasks, loading, error, refetch } = useTasks(
    Object.keys(filters).length > 0 ? filters : undefined
  )
  const { insert } = useTaskInsert()
  const { update } = useTaskUpdate()

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setStatus('pending')
    setDueDate('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const result = await insert({
      title,
      description: description || null,
      priority,
      status,
      due_date: dueDate || null,
      assigned_to: profile.id,
      created_by: profile.id,
    })

    setSubmitting(false)

    if (result) {
      setAddOpen(false)
      resetForm()
      refetch()
    }
  }

  const handleStatusToggle = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed'
    const result = await update(task.id, {
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    })
    if (result) refetch()
  }

  const columns: Column<Task>[] = [
    {
      key: 'title', header: 'Task', sortable: true,
      render: (t) => (
        <button
          onClick={() => handleStatusToggle(t)}
          className={`text-left font-medium ${t.status === 'completed' ? 'text-surface-400 line-through' : 'text-surface-800'}`}
        >
          {t.title}
        </button>
      ),
    },
    { key: 'priority', header: 'Priority', width: '100px', render: (t) => <Badge variant={PRIORITY_VARIANT[t.priority]} dot>{t.priority}</Badge> },
    { key: 'status', header: 'Status', width: '120px', render: (t) => <Badge variant={STATUS_VARIANT[t.status]}>{t.status.replace('_', ' ')}</Badge> },
    {
      key: 'due_date', header: 'Due', sortable: true, width: '120px',
      render: (t) => {
        if (!t.due_date) return <span className="text-surface-300">&mdash;</span>
        const isOverdue = new Date(t.due_date) < new Date() && t.status !== 'completed'
        return (
          <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-danger-500 font-medium' : 'text-surface-500'}`}>
            {isOverdue && <AlertCircle className="h-3 w-3" />}
            {formatDate(t.due_date)}
          </span>
        )
      },
    },
    {
      key: 'created_at', header: 'Created', sortable: true, width: '120px',
      render: (t) => <span className="text-xs text-surface-500">{formatDate(t.created_at)}</span>,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-surface-500">Loading tasks...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Action items across all stakeholders and onboarding flows. Nothing falls through the cracks."
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Task</Button>}
      />

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          Failed to load tasks: {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={tasks}
        keyField="id"
        searchPlaceholder="Search tasks..."
        filters={[
          { key: 'priority', label: 'All Priorities', options: [{ value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
          { key: 'status', label: 'All Statuses', options: [{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }] },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))}
        emptyState={<EmptyState icon={<CheckSquare className="h-8 w-8" />} title="No tasks yet" description="Create a task to track follow-ups and action items." action={{ label: 'Add Task', onClick: () => setAddOpen(true) }} />}
      />

      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Create an action item. Assign it to someone and set a due date.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Task Title *</label>
              <Input required placeholder="What needs to happen?" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Description</label>
              <Textarea placeholder="Add context or details..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Priority</label>
                <select
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  value={priority}
                  onChange={e => setPriority(e.target.value as TaskPriority)}
                >
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Status</label>
                <select
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  value={status}
                  onChange={e => setStatus(e.target.value as TaskStatus)}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Due Date</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setAddOpen(false); resetForm() }}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {submitting ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
