'use client'

import * as React from 'react'
import { Loader2, Lock, Save, UserCheck, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ClaimedEntityType, WorkflowStageOption } from '@/lib/claimed-stakeholder-workflow'

export interface ClaimWorkflowEditorValues {
  workflowStage: string
  nextAction: string
  nextActionDueDate: string
  blockedReason: string
  waitingOn: string
  claimContext: string
}

interface ClaimWorkflowEditorProps {
  entityType: ClaimedEntityType
  claimed: boolean
  stageOptions: WorkflowStageOption[]
  initialValues: ClaimWorkflowEditorValues
  onClaim: (values: ClaimWorkflowEditorValues) => Promise<void>
  onSave: (values: ClaimWorkflowEditorValues) => Promise<void>
  onRelease: () => Promise<void>
  disabled?: boolean
  statusMessage?: string | null
}

export function ClaimWorkflowEditor({
  entityType,
  claimed,
  stageOptions,
  initialValues,
  onClaim,
  onSave,
  onRelease,
  disabled,
  statusMessage,
}: ClaimWorkflowEditorProps) {
  const [values, setValues] = React.useState(initialValues)
  const [loadingAction, setLoadingAction] = React.useState<'claim' | 'save' | 'release' | null>(null)

  React.useEffect(() => {
    setValues(initialValues)
  }, [initialValues])

  const setField = React.useCallback(
    <K extends keyof ClaimWorkflowEditorValues>(key: K, value: ClaimWorkflowEditorValues[K]) => {
      setValues((current) => ({ ...current, [key]: value }))
    },
    []
  )

  async function runAction(action: 'claim' | 'save' | 'release') {
    setLoadingAction(action)
    try {
      if (action === 'claim') await onClaim(values)
      if (action === 'save') await onSave(values)
      if (action === 'release') await onRelease()
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-surface-400">
            {entityType === 'business' ? 'Business stage' : 'School / cause stage'}
          </label>
          <select
            value={values.workflowStage}
            onChange={(event) => setField('workflowStage', event.target.value)}
            className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
            disabled={disabled}
          >
            {stageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-surface-400">Next action due</label>
          <Input
            type="date"
            value={values.nextActionDueDate}
            onChange={(event) => setField('nextActionDueDate', event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-surface-400">Next required action</label>
        <Textarea
          value={values.nextAction}
          onChange={(event) => setField('nextAction', event.target.value)}
          rows={3}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-surface-400">Blocked reason</label>
          <Input
            value={values.blockedReason}
            onChange={(event) => setField('blockedReason', event.target.value)}
            placeholder="Missing assets, waiting on admin, waiting on owner..."
            disabled={disabled}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-surface-400">Waiting on</label>
          <Input
            value={values.waitingOn}
            onChange={(event) => setField('waitingOn', event.target.value)}
            placeholder="Owner, principal, admin, codes, materials..."
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-surface-400">Context for this claim</label>
        <Input
          value={values.claimContext}
          onChange={(event) => setField('claimContext', event.target.value)}
          placeholder={entityType === 'business' ? 'Met the owner, warm intro, neighborhood connection...' : 'Parent connection, principal intro, PTA lead...'}
          disabled={disabled}
        />
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-surface-200 bg-surface-0 px-3 py-2 text-xs text-surface-600">
          {statusMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!claimed ? (
          <Button onClick={() => runAction('claim')} disabled={disabled || loadingAction !== null}>
            {loadingAction === 'claim' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Claim {entityType === 'business' ? 'business' : 'stakeholder'}
          </Button>
        ) : (
          <>
            <Button onClick={() => runAction('save')} disabled={disabled || loadingAction !== null}>
              {loadingAction === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save workflow
            </Button>
            <Button variant="outline" onClick={() => runAction('release')} disabled={disabled || loadingAction !== null}>
              {loadingAction === 'release' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
              Release claim
            </Button>
          </>
        )}
        <Button variant="ghost" type="button" disabled>
          <Lock className="h-4 w-4" />
          Role controls stay separate
        </Button>
      </div>
    </div>
  )
}
