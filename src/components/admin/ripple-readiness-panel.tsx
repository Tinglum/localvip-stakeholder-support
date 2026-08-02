'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Power, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RippleReadiness, RippleReconciliation } from '@/lib/ripple'

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'Not reported'
}

async function readPayload<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null) as T | { error?: string } | null
  if (!response.ok) {
    throw new Error(payload && typeof payload === 'object' && 'error' in payload && payload.error ? payload.error : fallback)
  }
  return payload as T
}

export function RippleReadinessPanel() {
  const [readiness, setReadiness] = React.useState<RippleReadiness | null>(null)
  const [reconciliation, setReconciliation] = React.useState<RippleReconciliation | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [savingPhase1, setSavingPhase1] = React.useState(false)
  const [readinessError, setReadinessError] = React.useState<string | null>(null)
  const [reconciliationError, setReconciliationError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [readinessResult, reconciliationResult] = await Promise.allSettled([
        fetch('/api/admin/ripple/readiness', { cache: 'no-store' }).then((response) => readPayload<RippleReadiness>(response, 'Ripple readiness could not be loaded.')),
        fetch('/api/admin/ripple/reconciliation?limit=100', { cache: 'no-store' }).then((response) => readPayload<RippleReconciliation>(response, 'Ripple reconciliation could not be loaded.')),
      ])
      if (readinessResult.status === 'fulfilled') {
        setReadiness(readinessResult.value)
        setReadinessError(null)
      } else {
        setReadinessError(readinessResult.reason instanceof Error ? readinessResult.reason.message : 'Ripple readiness could not be loaded.')
      }
      if (reconciliationResult.status === 'fulfilled') {
        setReconciliation(reconciliationResult.value)
        setReconciliationError(null)
      } else {
        setReconciliationError(reconciliationResult.reason instanceof Error ? reconciliationResult.reason.message : 'Ripple reconciliation could not be loaded.')
      }
    } catch {
      setReadinessError('Ripple readiness could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  async function setEnabled(enabled: boolean) {
    const verb = enabled ? 'enable' : 'pause'
    if (!window.confirm(`Are you sure you want to ${verb} LocalVIP Ripple?`)) return
    setSaving(true)
    try {
      const response = await fetch('/api/admin/ripple/enabled', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      await readPayload(response, `Ripple could not be ${enabled ? 'enabled' : 'paused'}.`)
      toast.success(`Ripple ${enabled ? 'enabled' : 'paused'}.`)
      await load()
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : 'Ripple could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  async function setPhase1Enabled(enabled: boolean) {
    const verb = enabled ? 'enable' : 'pause'
    if (!window.confirm(`Are you sure you want to ${verb} customer recommendations globally?`)) return
    setSavingPhase1(true)
    try {
      const response = await fetch('/api/admin/ripple/phase1-enabled', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      await readPayload(response, `Customer recommendations could not be ${enabled ? 'enabled' : 'paused'}.`)
      toast.success(`Customer recommendations ${enabled ? 'enabled globally' : 'paused'}.`)
      await load()
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : 'Customer recommendations could not be updated.')
    } finally {
      setSavingPhase1(false)
    }
  }

  const summary = reconciliation?.summary
  const statusLabel = !readiness ? 'Unavailable' : !readiness.enabled ? 'Paused' : readiness.ready ? 'Ready' : 'Blocked'
  const statusVariant = readiness?.enabled && readiness.ready ? 'success' : readiness?.enabled ? 'danger' : 'warning'

  return (
    <Card className="overflow-hidden border-2 border-surface-200">
      <div className="h-1.5 bg-gradient-to-r from-blue-900 via-brand-600 to-amber-400" />
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>LocalVIP Ripple controls</CardTitle>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>
          <CardDescription className="mt-2">Backend-reported readiness, reconciliation, and the global consumer kill switch.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {readiness ? (
            <Button variant={readiness.enabled ? 'danger' : 'default'} size="sm" onClick={() => void setEnabled(!readiness.enabled)} disabled={loading || saving || (!readiness.enabled && !readiness.ready)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              {readiness.enabled ? 'Pause Ripple' : 'Enable Ripple'}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && !readiness ? <p className="flex items-center gap-2 py-6 text-sm text-surface-500"><Loader2 className="h-4 w-4 animate-spin" />Loading backend diagnostics</p> : null}
        {readinessError ? <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800"><p className="font-semibold">Ripple readiness unavailable</p><p className="mt-1">{readinessError}</p></div> : null}
        {readiness && !readiness.enabled && !readiness.ready ? <p className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm font-medium text-warning-800">Ripple cannot be enabled until the backend readiness blockers are cleared. Pausing remains available whenever Ripple is running.</p> : null}

        {readiness ? (
          <>
            {readiness.phase1 ? (
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-surface-900">Phase 1 · Customer recommendations</p>
                      <Badge variant={readiness.phase1.enabled ? 'success' : readiness.phase1.ready ? 'warning' : 'danger'}>
                        {readiness.phase1.enabled ? 'Global' : readiness.phase1.ready ? 'Ready to enable' : 'Blocked'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-surface-500">
                      All active businesses become eligible together. No historical purchases are backfilled.
                    </p>
                    {readiness.phase1.cutoverAtUtc ? <p className="mt-1 text-xs text-surface-500">Cutover {formatTimestamp(readiness.phase1.cutoverAtUtc)}</p> : null}
                  </div>
                  <Button
                    variant={readiness.phase1.enabled ? 'danger' : 'default'}
                    size="sm"
                    onClick={() => void setPhase1Enabled(!readiness.phase1!.enabled)}
                    disabled={loading || saving || savingPhase1 || (!readiness.phase1.enabled && !readiness.phase1.ready)}
                  >
                    {savingPhase1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    {readiness.phase1.enabled ? 'Pause recommendations' : 'Enable for all businesses'}
                  </Button>
                </div>
                {readiness.phase1.blockers.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {readiness.phase1.blockers.map((blocker) => <li key={blocker} className="flex gap-2 text-sm text-danger-700"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{blocker}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Outbox pending" value={readiness.outbox.pending} />
              <Metric label="Outbox retrying" value={readiness.outbox.retrying} />
              <Metric label="Dead letter" value={readiness.outbox.deadLetter} alert={readiness.outbox.deadLetter > 0} />
              <Metric label="Unreconciled" value={readiness.ledger.unreconciledTransactions} alert={readiness.ledger.unreconciledTransactions > 0} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-surface-200 p-4">
                <p className="text-sm font-semibold text-surface-900">Required schema</p>
                <div className="mt-3 space-y-2">
                  <SchemaCheck label="Payment snapshots" ok={readiness.schema.snapshotsAvailable} />
                  <SchemaCheck label="Cause allocations" ok={readiness.schema.causeAllocationsAvailable} />
                  <SchemaCheck label="Transactional outbox" ok={readiness.schema.outboxAvailable} />
                  <SchemaCheck label="Ripple feature column" ok={readiness.schema.rippleColumnAvailable} />
                </div>
              </div>
              <div className="rounded-2xl border border-surface-200 p-4">
                <p className="text-sm font-semibold text-surface-900">Backend blockers</p>
                {readiness.blockers.length > 0 ? (
                  <ul className="mt-3 space-y-2">{readiness.blockers.map((blocker) => <li key={blocker} className="flex gap-2 text-sm text-danger-700"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{blocker}</li>)}</ul>
                ) : <p className="mt-3 flex items-center gap-2 text-sm text-success-700"><CheckCircle2 className="h-4 w-4" />No backend blockers reported.</p>}
              </div>
            </div>

            <p className="text-xs text-surface-500">Checked {formatTimestamp(readiness.checkedAtUtc)} · Oldest pending event {formatTimestamp(readiness.outbox.oldestPendingAtUtc)}</p>
            {readiness.warnings.length > 0 ? <ul className="space-y-1 rounded-xl border border-warning-200 bg-warning-50 p-3">{readiness.warnings.map((warning) => <li key={warning} className="flex gap-2 text-sm text-warning-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{warning}</li>)}</ul> : null}
          </>
        ) : null}

        {reconciliationError ? <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800"><p className="font-semibold">Reconciliation unavailable</p><p className="mt-1">{reconciliationError}</p><p className="mt-1">The kill switch remains available from the readiness state above.</p></div> : null}
        {summary ? (
          <div className="space-y-3 border-t border-surface-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-surface-900">Latest reconciliation</p><p className="text-xs text-surface-500">Checked {formatTimestamp(reconciliation?.checkedAtUtc)}</p></div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <Metric label="Transactions" value={summary.transactions} />
              <Metric label="Missing snapshots" value={summary.missingSnapshots} alert={summary.missingSnapshots > 0} />
              <Metric label="Fee mismatches" value={summary.feeMismatches} alert={summary.feeMismatches > 0} />
              <Metric label="Cause mismatches" value={summary.causeMismatches} alert={summary.causeMismatches > 0} />
              <Metric label="Duplicate intents" value={summary.duplicatePaymentIntents} alert={summary.duplicatePaymentIntents > 0} />
              <Metric label="Orphaned ledger" value={summary.orphanedLedgerRows} alert={summary.orphanedLedgerRows > 0} />
            </div>
            {reconciliation && reconciliation.issues.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-surface-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-50 text-xs uppercase tracking-wide text-surface-500"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Transaction</th><th className="px-3 py-2">Payment intent</th><th className="px-3 py-2">Detail</th></tr></thead>
                  <tbody>{reconciliation.issues.map((issue, index) => <tr key={`${issue.code}-${issue.transactionId ?? index}`} className="border-t border-surface-100"><td className="px-3 py-2 font-medium text-danger-700">{issue.code}</td><td className="px-3 py-2">{issue.transactionId ?? '—'}</td><td className="px-3 py-2 font-mono text-xs">{issue.paymentIntentId ?? '—'}</td><td className="px-3 py-2 text-surface-600">{issue.detail}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="text-sm text-success-700">The backend reported no reconciliation issues.</p>}
            {reconciliation?.truncated ? <p className="flex items-center gap-2 text-xs text-warning-700"><AlertTriangle className="h-4 w-4" />Only the first 100 issues are shown.</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <div className={`rounded-xl border p-3 ${alert ? 'border-danger-200 bg-danger-50' : 'border-surface-200 bg-surface-50'}`}><p className="text-xs font-semibold uppercase tracking-wide text-surface-500">{label}</p><p className={`mt-1 text-xl font-bold tabular-nums ${alert ? 'text-danger-800' : 'text-surface-900'}`}>{value}</p></div>
}

function SchemaCheck({ label, ok }: { label: string; ok: boolean }) {
  return <p className={`flex items-center gap-2 text-sm ${ok ? 'text-success-700' : 'text-danger-700'}`}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{label}</p>
}
