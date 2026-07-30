'use client'

import * as React from 'react'
import { AlertOctagon, Loader2, RotateCw, ScanSearch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  classificationBadgeVariant,
  classificationLabel,
  readStripeMaintenanceOutcome,
  stripeMaintenanceFailure,
  type StripeMaintenanceOutcome,
  type StripeMaintenanceSuccess,
} from '@/lib/stripe-maintenance'

type Action = 'scan' | 'clear' | 'repair'
type Confirming = Exclude<Action, 'scan'> | null

const ACTION_LABEL: Record<Action, string> = {
  scan: 'Check for dead references',
  clear: 'Clear them',
  repair: 'Repair QA accounts',
}

async function postAdmin(url: string, body?: unknown): Promise<StripeMaintenanceOutcome> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => null)) as unknown
    if (json) return readStripeMaintenanceOutcome(json)
    return stripeMaintenanceFailure(`The server replied with HTTP ${res.status} and no readable body.`, res.status)
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'The request could not be sent.'
    return stripeMaintenanceFailure(message)
  }
}

/**
 * SysAdmin repair controls for the dead-Stripe-id problem, attached beneath the
 * readiness alert. Deliberately plain: the scan is the prominent action, and
 * both mutating actions sit behind an explicit second confirmation.
 */
export function StripeMaintenanceControls({
  onRefreshReadiness,
  refreshing,
}: {
  onRefreshReadiness: () => void
  refreshing: boolean
}) {
  const [busy, setBusy] = React.useState<Action | null>(null)
  const [confirming, setConfirming] = React.useState<Confirming>(null)
  /** The dry run gates "Clear them" — you cannot clear what you have not looked at. */
  const [dryRun, setDryRun] = React.useState<StripeMaintenanceSuccess | null>(null)
  const [outcome, setOutcome] = React.useState<StripeMaintenanceOutcome | null>(null)
  const [lastAction, setLastAction] = React.useState<Action | null>(null)
  const inFlight = React.useRef(false)

  const run = React.useCallback(async (action: Action) => {
    // Belt and braces against a double submit: the buttons are disabled while
    // busy, and this ref rejects anything that slips past a re-render.
    if (inFlight.current) return
    inFlight.current = true
    setBusy(action)
    setConfirming(null)

    const result = action === 'repair'
      ? await postAdmin('/api/admin/stripe-repair-qa-accounts')
      : await postAdmin('/api/admin/stripe-purge-references', { apply: action === 'clear' })

    setOutcome(result)
    setLastAction(action)
    if (action === 'scan') setDryRun(result.ok ? result : null)
    // A completed purge invalidates the dry run it was based on.
    if (action === 'clear' && result.ok) setDryRun(null)

    setBusy(null)
    inFlight.current = false
  }, [])

  const disabled = busy !== null || refreshing
  const staleFound = dryRun ? dryRun.rows.filter((row) => row.classification === 'stale').length : 0

  return (
    <section className="mt-5 border-t border-surface-100 pt-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-sm font-semibold text-surface-900">Stripe reference repair</h4>
        <p className="text-xs text-surface-500">
          The Stripe platform changed, so stored account ids may point at nothing.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void run('scan')} disabled={disabled}>
          {busy === 'scan'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <ScanSearch className="h-3.5 w-3.5" />}
          {busy === 'scan' ? 'Checking…' : ACTION_LABEL.scan}
        </Button>

        <Button
          size="sm"
          variant="danger"
          onClick={() => setConfirming('clear')}
          disabled={disabled || !dryRun || staleFound === 0}
          title={dryRun ? undefined : 'Run the check first'}
        >
          {busy === 'clear' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {busy === 'clear' ? 'Clearing…' : ACTION_LABEL.clear}
        </Button>

        <Button size="sm" variant="outline" onClick={() => setConfirming('repair')} disabled={disabled}>
          {busy === 'repair' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {busy === 'repair' ? 'Repairing…' : ACTION_LABEL.repair}
        </Button>

        <Button size="sm" variant="ghost" onClick={onRefreshReadiness} disabled={disabled}>
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          {refreshing ? 'Refreshing…' : 'Refresh readiness'}
        </Button>
      </div>

      {!dryRun && !outcome ? (
        <p className="mt-2 text-xs text-surface-400">
          Start with the check. It only reads — nothing is changed until you confirm a second time.
        </p>
      ) : null}

      {confirming ? (
        <ConfirmPanel
          kind={confirming}
          staleCount={staleFound}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void run(confirming)}
        />
      ) : null}

      {outcome ? <OutcomePanel action={lastAction} outcome={outcome} /> : null}
    </section>
  )
}

function ConfirmPanel({
  kind,
  staleCount,
  onCancel,
  onConfirm,
}: {
  kind: Exclude<Action, 'scan'>
  staleCount: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const isClear = kind === 'clear'

  return (
    <div className="mt-3 rounded-xl border border-danger-500 bg-danger-50 p-4">
      <div className="flex gap-3">
        <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-danger-700" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-danger-700">
            {isClear ? 'This permanently nulls stored Stripe ids' : 'This creates new test-mode Stripe accounts'}
          </p>
          <p className="max-w-2xl text-xs leading-5 text-danger-700">
            {isClear
              ? `${staleCount} stored Stripe id${staleCount === 1 ? '' : 's'} will be erased from LocalVIP records. `
                + 'The ids are not recoverable from here afterwards, and any of them that were in fact still live '
                + 'would need re-linking by hand.'
              : 'New Connect accounts will be created in Stripe test mode and attached to the affected businesses, '
                + 'replacing whatever is on file. Only run this against a test environment — the backend rejects it '
                + 'if the server is not on a Stripe test key.'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={isClear ? 'danger' : 'default'} onClick={onConfirm}>
          {isClear ? `Yes, clear ${staleCount} stored id${staleCount === 1 ? '' : 's'}` : 'Yes, create test-mode accounts'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function OutcomePanel({ action, outcome }: { action: Action | null; outcome: StripeMaintenanceOutcome }) {
  if (!outcome.ok) {
    return (
      <div className="mt-3 rounded-xl border border-danger-500 bg-danger-50 p-4">
        <p className="text-sm font-semibold text-danger-700">
          {action ? ACTION_LABEL[action] : 'The operation'} failed — nothing was changed.
        </p>
        <p className="mt-1 break-words text-xs leading-5 text-danger-700">{outcome.error}</p>
      </div>
    )
  }

  const heading = outcome.applied
    ? action === 'repair'
      ? `Repaired ${outcome.changedCount} of ${outcome.scanned} business${outcome.scanned === 1 ? '' : 'es'}`
      : `Cleared ${outcome.changedCount} of ${outcome.staleCount} dead reference${outcome.staleCount === 1 ? '' : 's'}`
    : `${outcome.staleCount} dead reference${outcome.staleCount === 1 ? '' : 's'} found in ${outcome.scanned} record${outcome.scanned === 1 ? '' : 's'}`

  return (
    <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-surface-900">{heading}</p>
        <Badge variant={outcome.applied ? 'danger' : 'default'}>
          {outcome.applied ? 'Applied' : 'Dry run — nothing changed'}
        </Badge>
      </div>
      {outcome.message ? <p className="mt-1 text-xs leading-5 text-surface-600">{outcome.message}</p> : null}

      {outcome.rows.length === 0 ? (
        <p className="mt-2 text-xs text-surface-500">The backend returned no rows to act on.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 text-surface-500">
                <th className="py-2 pr-4 font-medium">Entity</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Stripe id</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {outcome.rows.map((row, index) => (
                <tr key={`${row.entityType}-${row.entityId ?? index}`} className="align-top">
                  <td className="py-2 pr-4 text-surface-600">
                    {row.entityType}
                    {row.entityId ? <span className="text-surface-400"> #{row.entityId}</span> : null}
                  </td>
                  <td className="py-2 pr-4 font-medium text-surface-900">{row.name}</td>
                  <td className="py-2 pr-4 font-mono text-[11px] text-surface-600">{row.stripeId || '—'}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={classificationBadgeVariant(row.classification)}>
                      {classificationLabel(row.classification)}
                    </Badge>
                  </td>
                  <td className="py-2 text-surface-600">
                    {row.newStripeId ? (
                      <span className="font-mono text-[11px]">{row.newStripeId}</span>
                    ) : row.cleared ? (
                      'Cleared'
                    ) : outcome.applied ? (
                      'Left as is'
                    ) : row.classification === 'stale' ? (
                      'Would be cleared'
                    ) : (
                      'Would be kept'
                    )}
                    {row.detail ? <span className="block text-surface-400">{row.detail}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
