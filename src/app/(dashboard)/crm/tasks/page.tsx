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
import { useTasks, useTaskInsert, useTaskUpdate, useProfiles, useBusinesses, useCauses, useContacts } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import type { Task, TaskPriority, TaskStatus } from '@/lib/types/database'

const PRIORITY_VARIANT: Record<TaskPriority, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default', medium: 'info', high: 'warning', urgent: 'danger',
}

const STATUS_VARIANT: Record<TaskStatus, 'default' | 'info' | 'success' | 'warning'> = {
  pending: 'default', in_progress: 'info', completed: 'success', cancelled: 'warning',
}

function SearchableSelect({ options, value, onChange, placeholder }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [search, setSearch] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? search : (selected?.label || '')}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-surface-200 bg-surface-0 py-1 shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-surface-400">No results</p>
            ) : filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setSearch(''); setOpen(false) }}
                className="flex w-full items-center px-3 py-1.5 text-sm text-left hover:bg-surface-50 text-surface-700"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
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
  const [assignedTo, setAssignedTo] = React.useState('')
  const [entityType, setEntityType] = React.useState<'business' | 'cause' | 'contact' | ''>('')
  const [entityId, setEntityId] = React.useState('')

  const { data: tasks, loading, error, refetch } = useTasks(
    Object.keys(filters).length > 0 ? filters : undefined
  )
  const { insert } = useTaskInsert()
  const { update } = useTaskUpdate()

  // Lookup data
  const { data: profiles } = useProfiles()
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()

  // Build lookup maps
  const profileMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of profiles) map[p.id] = p.full_name
    return map
  }, [profiles])

  const entityMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const b of businesses) map[b.id] = b.name
    for (const c of causes) map[c.id] = c.name
    for (const ct of contacts) map[ct.id] = `${ct.first_name} ${ct.last_name}`
    return map
  }, [businesses, causes, contacts])

  // Dropdown options
  const profileOptions = React.useMemo(
    () => profiles.map(p => ({ value: p.id, label: p.full_name })),
    [profiles]
  )

  const entityOptions = React.useMemo(() => {
    if (entityType === 'business') return businesses.map(b => ({ value: b.id, label: b.name }))
    if (entityType === 'cause') return causes.map(c => ({ value: c.id, label: c.name }))
    if (entityType === 'contact') return contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))
    return []
  }, [entityType, businesses, causes, contacts])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setStatus('pending')
    setDueDate('')
    setAssignedTo('')
    setEntityType('')
    setEntityId('')
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
      assigned_to: assignedTo || profile.id,
      created_by: profile.id,
      entity_type: entityType || null,
      entity_id: entityId || null,
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
    {
      key: 'assigned_to', header: 'Assigned To', width: '140px',
      render: (t) => t.assigned_to
        ? <span className="text-sm text-surface-600">{profileMap[t.assigned_to] || 'Unknown'}</span>
        : <span className="text-surface-300">&mdash;</span>,
    },
    {
      key: 'entity_type', header: 'Linked Entity', width: '160px',
      render: (t) => {
        if (!t.entity_type || !t.entity_id) return <span className="text-surface-300">&mdash;</span>
        return (
          <span className="flex items-center gap-1.5">
            <Badge variant={t.entity_type === 'business' ? 'info' : t.entity_type === 'cause' ? 'warning' : 'default'} className="text-[10px]">
              {t.entity_type}
            </Badge>
            <span className="text-sm text-surface-600 truncate">{entityMap[t.entity_id] || 'Unknown'}</span>
          </span>
        )
      },
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
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Assign To</label>
              <SearchableSelect
                options={profileOptions}
                value={assignedTo}
                onChange={setAssignedTo}
                placeholder="Search team members..."
              />
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
            <div className="space-y-3">
              <label className="block text-sm font-medium text-surface-700">Link to Entity</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <select
                    className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                    value={entityType}
                    onChange={e => { setEntityType(e.target.value as typeof entityType); setEntityId('') }}
                  >
                    <option value="">None</option>
                    <option value="business">Business</option>
                    <option value="cause">Cause</option>
                    <option value="contact">Contact</option>
                  </select>
                </div>
                <div>
                  {entityType && (
                    <SearchableSelect
                      options={entityOptions}
                      value={entityId}
                      onChange={setEntityId}
                      placeholder={`Search ${entityType}s...`}
                    />
                  )}
                </div>
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
