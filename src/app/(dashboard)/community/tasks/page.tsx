'use client'

import * as React from 'react'
import {
  CheckCircle2,
  CheckSquare,
  Heart,
  MessageSquare,
  Plus,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import {
  useCauses,
  useNoteInsert,
  useNotes,
  useTaskInsert,
  useTaskUpdate,
  useTasks,
} from '@/lib/supabase/hooks'
import { formatDate } from '@/lib/utils'
import type { TaskPriority } from '@/lib/types/database'

export default function CommunityTasksPage() {
  const { profile } = useAuth()
  const { data: causes } = useCauses()

  const scopedCause = React.useMemo(
    () => causes.find(c => c.owner_id === profile.id || c.organization_id === profile.organization_id) || null,
    [causes, profile.id, profile.organization_id],
  )

  const { data: tasks, refetch: refetchTasks } = useTasks({ entity_id: scopedCause?.id || '__none__' })
  const { data: notes, refetch: refetchNotes } = useNotes({ entity_id: scopedCause?.id || '__none__' })
  const { insert: insertTask, loading: insertingTask } = useTaskInsert()
  const { update: updateTask } = useTaskUpdate()
  const { insert: insertNote, loading: insertingNote } = useNoteInsert()

  const openTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  const [taskTitle, setTaskTitle] = React.useState('')
  const [taskPriority, setTaskPriority] = React.useState<TaskPriority>('medium')
  const [noteContent, setNoteContent] = React.useState('')
  const [showCompleted, setShowCompleted] = React.useState(false)

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim() || !scopedCause) return
    await insertTask({
      title: taskTitle,
      priority: taskPriority,
      status: 'pending',
      entity_type: 'cause',
      entity_id: scopedCause.id,
      created_by: profile.id,
    })
    setTaskTitle('')
    refetchTasks({ silent: true })
  }

  async function handleToggleTask(id: string, completed: boolean) {
    await updateTask(id, {
      status: completed ? 'completed' : 'pending',
      completed_at: completed ? new Date().toISOString() : null,
    })
    refetchTasks({ silent: true })
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteContent.trim() || !scopedCause) return
    await insertNote({
      content: noteContent,
      entity_type: 'cause',
      entity_id: scopedCause.id,
      created_by: profile.id,
      is_internal: false,
    })
    setNoteContent('')
    refetchNotes({ silent: true })
  }

  if (!scopedCause) {
    return <EmptyState icon={<Heart className="h-8 w-8" />} title="No cause linked" description="Tasks and notes will appear once a cause is linked to your account." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks & Notes"
        description={`Manage your tasks and notes for ${scopedCause.name}`}
      />

      {/* Context chip */}
      <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-2">
        <Heart className="h-4 w-4 text-brand-600" />
        <span className="text-sm font-medium text-brand-800">
          {scopedCause.name}
        </span>
        <Badge variant={openTasks.length > 0 ? 'warning' : 'success'} className="ml-2">
          {openTasks.length} open task{openTasks.length === 1 ? '' : 's'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
              </CardTitle>
              <Badge variant={openTasks.length > 0 ? 'warning' : 'success'}>
                {openTasks.length} open / {completedTasks.length} done
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder="Add a task..."
                className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <select
                value={taskPriority}
                onChange={e => setTaskPriority(e.target.value as TaskPriority)}
                className="rounded-lg border border-surface-200 bg-surface-50 px-2 py-2 text-xs"
              >
                <option value="low">Low</option>
                <option value="medium">Med</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <Button type="submit" size="sm" disabled={insertingTask || !taskTitle.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>

            {/* Open tasks */}
            {openTasks.length === 0 && completedTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-surface-400">No tasks yet. Add one above.</p>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {openTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2">
                    <button
                      onClick={() => handleToggleTask(task.id, true)}
                      className="h-5 w-5 shrink-0 rounded-md border-2 border-surface-300 hover:border-brand-400 transition-colors"
                    />
                    <span className="flex-1 text-sm text-surface-800">{task.title}</span>
                    <Badge variant={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'default'} className="text-[10px]">
                      {task.priority}
                    </Badge>
                  </div>
                ))}

                {completedTasks.length > 0 && (
                  <div className="pt-2">
                    <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="text-xs font-medium text-surface-400 hover:text-surface-600"
                    >
                      {showCompleted ? 'Hide' : 'Show'} {completedTasks.length} completed
                    </button>
                    {showCompleted && completedTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-3 rounded-lg bg-surface-50 px-3 py-2 opacity-60 mt-1">
                        <button
                          onClick={() => handleToggleTask(task.id, false)}
                          className="h-5 w-5 shrink-0 rounded-md border-2 border-success-500 bg-success-500 text-white flex items-center justify-center"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </button>
                        <span className="flex-1 text-sm line-through text-surface-400">{task.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button type="submit" size="sm" disabled={insertingNote || !noteContent.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>

            {notes.length === 0 ? (
              <p className="py-6 text-center text-sm text-surface-400">No notes yet.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {notes.map(note => (
                  <div key={note.id} className="rounded-lg bg-surface-50 px-3 py-2.5">
                    <p className="text-sm text-surface-800">{note.content}</p>
                    <p className="mt-1 text-[10px] text-surface-400">{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
