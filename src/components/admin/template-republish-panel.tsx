'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMaterialTemplates } from '@/lib/supabase/hooks'
import { formatDateTime } from '@/lib/utils'
import type {
  RepublishBatchResult,
  RepublishItemResult,
  RepublishPlan,
  RepublishRunLog,
} from '@/lib/server/template-republish'

/**
 * Cascade republish control.
 *
 * The admin fixes a typo in a template design; every account that already
 * generated a copy is still holding the old render. This panel dry-runs the
 * blast radius, then walks the queue one batch at a time, showing a row per
 * account with the reason for every failure.
 *
 * The browser drives the loop rather than the server so a long run cannot die
 * inside one serverless request, and so the admin can stop it. Stopping is
 * safe: the remaining work is whatever is still behind the template version.
 */
export function TemplateRepublishPanel() {
  const { data: templates, loading: templatesLoading } = useMaterialTemplates()

  const [templateId, setTemplateId] = React.useState<string>('')
  const [plan, setPlan] = React.useState<RepublishPlan | null>(null)
  const [run, setRun] = React.useState<RepublishRunLog | null>(null)
  const [planning, setPlanning] = React.useState(false)
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [endpointMissing, setEndpointMissing] = React.useState(false)

  // Read inside the async loop so a click on Stop takes effect immediately;
  // state would be stale inside the running closure.
  const stopRequested = React.useRef(false)

  const sortedTemplates = React.useMemo(
    () => [...templates].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [templates],
  )

  const selected = sortedTemplates.find((template) => String(template.id) === templateId) || null

  const resetResults = () => {
    setPlan(null)
    setRun(null)
    setError(null)
    setEndpointMissing(false)
  }

  const loadPlan = async (id: string) => {
    if (!id) return
    setPlanning(true)
    setError(null)
    setEndpointMissing(false)
    try {
      const response = await fetch(`/api/admin/material-engine/templates/${id}/republish/plan`)
      const body = await response.json()
      if (!response.ok) {
        setEndpointMissing(Boolean(body?.endpointMissing))
        setError(body?.error || 'Could not build the republish plan.')
        setPlan(null)
        return
      }
      setPlan(body.plan as RepublishPlan)
      if (body.run) setRun(body.run as RepublishRunLog)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not build the republish plan.')
    } finally {
      setPlanning(false)
    }
  }

  const republish = async () => {
    if (!templateId || !plan) return
    stopRequested.current = false
    setRunning(true)
    setError(null)

    let first = true
    try {
      // Loop until the backend reports nothing left. `complete` is computed from
      // a fresh database count after each batch, not from our own arithmetic.
      for (;;) {
        const response = await fetch(`/api/admin/material-engine/templates/${templateId}/republish`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reset: first }),
        })
        const body = await response.json()
        first = false

        if (!response.ok) {
          setEndpointMissing(Boolean(body?.endpointMissing))
          setError(body?.error || 'Republish failed.')
          break
        }

        const batch = body.batch as RepublishBatchResult
        setRun(body.run as RepublishRunLog)

        if (batch.complete || batch.attempted === 0) break
        if (stopRequested.current) break
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Republish failed.')
    } finally {
      setRunning(false)
      // Re-plan so the headline numbers reflect the database, not the run log.
      await loadPlan(templateId)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Republish a template to every account</CardTitle>
        <p className="mt-1 text-sm text-surface-500">
          Fixed a typo or swapped the artwork? This re-renders every copy that is behind the
          current template version, keeping each account&apos;s own QR code, placement, logo and
          details. Dry run first — nothing changes until you press Republish.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[240px] text-sm">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-surface-500">Template</span>
            <select
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value)
                resetResults()
              }}
              disabled={running || templatesLoading}
              className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">{templatesLoading ? 'Loading templates…' : 'Select a template…'}</option>
              {sortedTemplates.map((template) => (
                <option key={template.id} value={String(template.id)}>
                  {template.name} (v{template.version || 1})
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="outline"
            onClick={() => loadPlan(templateId)}
            disabled={!templateId || planning || running}
          >
            {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Dry run
          </Button>

          <Button
            onClick={republish}
            // Never offer the destructive-looking action before the admin has
            // seen the blast radius, and never when there is nothing to do.
            disabled={!plan || plan.outdatedCopies === 0 || running || planning}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Republish{plan ? ` ${plan.outdatedCopies} cop${plan.outdatedCopies === 1 ? 'y' : 'ies'}` : ''}
          </Button>

          {running && (
            <Button variant="secondary" onClick={() => { stopRequested.current = true }}>
              Stop after this batch
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{endpointMissing ? 'Backend support not deployed' : 'Republish problem'}</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {plan && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Template version" value={`v${plan.templateVersion}`} />
            <Stat label="Copies in total" value={String(plan.totalCopies)} />
            <Stat label="Out of date" value={String(plan.outdatedCopies)} />
            <Stat label="Accounts affected" value={String(plan.affectedAccounts)} />
          </div>
        )}

        {plan && plan.outdatedCopies === 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
            <CheckCircle2 className="h-4 w-4" />
            Every copy of {selected?.name || 'this template'} is already on v{plan.templateVersion}.
          </div>
        )}

        {plan && plan.sample.length > 0 && !run && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-surface-500">
              Would be re-rendered (first {plan.sample.length})
            </p>
            <ul className="divide-y divide-surface-200 rounded-2xl border border-surface-200">
              {plan.sample.map((target) => (
                <li key={target.generatedMaterialId} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-surface-700">
                    {target.accountName || `Account ${target.businessAccountId ?? target.causeAccountId ?? '—'}`}
                  </span>
                  <Badge variant="warning">v{target.currentTemplateVersion} → v{plan.templateVersion}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {run && <RunReport run={run} />}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-surface-900">{value}</p>
    </div>
  )
}

function RunReport({ run }: { run: RepublishRunLog }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Re-rendered" value={String(run.succeeded)} />
        <Stat label="Failed" value={String(run.failed)} />
        <Stat label="Skipped" value={String(run.skipped)} />
        <Stat label="Still outstanding" value={run.remaining == null ? 'unknown' : String(run.remaining)} />
      </div>

      <p className="text-xs text-surface-500">
        {run.batches} batch{run.batches === 1 ? '' : 'es'} · last update {formatDateTime(run.updatedAt)}
        {run.complete ? ' · complete' : ' · safe to run again to pick up the rest'}
      </p>

      {run.failures.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-danger-600">
            Failures ({run.failures.length}) — each with its reason
          </p>
          <ul className="divide-y divide-surface-200 rounded-2xl border border-danger-200">
            {run.failures.map((item) => (
              <ResultRow key={`fail-${item.generatedMaterialId}`} item={item} />
            ))}
          </ul>
        </div>
      )}

      {run.recent.length > 0 && (
        <details className="rounded-2xl border border-surface-200">
          <summary className="cursor-pointer px-4 py-3 text-sm text-surface-600">
            Per-account results ({run.recent.length} most recent)
          </summary>
          <ul className="divide-y divide-surface-200 border-t border-surface-200">
            {run.recent.map((item) => (
              <ResultRow key={`recent-${item.generatedMaterialId}-${item.status}`} item={item} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function ResultRow({ item }: { item: RepublishItemResult }) {
  const variant = item.status === 'republished' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate text-surface-700">{item.accountName || `Account ${item.accountId ?? '—'}`}</p>
        {item.message && <p className="mt-0.5 break-words text-xs text-surface-500">{item.message}</p>}
      </div>
      <Badge variant={variant}>{item.status}</Badge>
    </li>
  )
}
