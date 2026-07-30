'use client'

/**
 * System status pill — topbar.
 * ────────────────────────────
 * Tells everyone looking at the dashboard whether the operator is currently
 * changing things under them. Red "Work in progress" vs green "All clear",
 * with an icon and a word so colour is never the only signal.
 *
 * Admins get a real toggle; everyone else gets the same pill as a read-only
 * status. When the upstream flag can't be read the pill goes quiet and grey —
 * an unreachable endpoint must never look like an incident.
 */

import * as React from 'react'
import { CircleDot, Loader2, ShieldCheck, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SystemStatusState } from '@/lib/system-status'

interface SystemStatusIndicatorProps extends SystemStatusState {
  /** Admin / SysAdmin only — everyone else sees the read-only pill. */
  canToggle: boolean
}

const PILL_BASE = 'inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-colors'

export function SystemStatusIndicator({
  status,
  unavailable,
  loading,
  saving,
  error,
  setWorkInProgress,
  canToggle,
}: SystemStatusIndicatorProps) {
  // Nothing to say until the first read resolves — a flash of green that turns
  // red is worse than a beat of silence.
  if (loading) return null

  if (unavailable) {
    return (
      <span
        role="status"
        className={cn(PILL_BASE, 'border-surface-200 bg-surface-50 text-surface-400')}
        title="The system status service is not reachable right now."
      >
        <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Status unavailable</span>
        <span className="sr-only sm:hidden">System status unavailable</span>
      </span>
    )
  }

  const wip = status.workInProgress
  const label = wip ? 'Work in progress' : 'All clear'
  const Icon = wip ? Wrench : ShieldCheck
  const tone = wip
    ? 'border-danger-500/40 bg-danger-50 text-danger-700'
    : 'border-success-500/40 bg-success-50 text-success-700'

  const body = (
    <>
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <span className="relative inline-flex h-2 w-2" aria-hidden="true">
          {wip ? <span className="absolute inset-0 animate-ping rounded-full bg-danger-500/60" /> : null}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', wip ? 'bg-danger-500' : 'bg-success-500')} />
        </span>
      )}
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </>
  )

  if (!canToggle) {
    return (
      <span role="status" className={cn(PILL_BASE, tone)} title={status.message || undefined}>
        <span className="sr-only">System status: </span>
        {body}
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={wip}
        aria-label={
          wip
            ? 'System status: work in progress. Activate to mark the system all clear.'
            : 'System status: all clear. Activate to flag work in progress.'
        }
        disabled={saving}
        onClick={() => { void setWorkInProgress(!wip) }}
        className={cn(
          PILL_BASE,
          tone,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
          wip ? 'hover:bg-danger-500 hover:text-white' : 'hover:bg-success-500 hover:text-white',
          saving && 'cursor-wait opacity-70',
        )}
      >
        {body}
      </button>

      {error ? (
        <span
          role="alert"
          className="absolute right-0 top-full z-40 mt-1 whitespace-nowrap rounded-lg border border-danger-500/40 bg-danger-50 px-2 py-1 text-[11px] font-medium text-danger-700 shadow-sm"
        >
          {error}
        </span>
      ) : null}
    </div>
  )
}
