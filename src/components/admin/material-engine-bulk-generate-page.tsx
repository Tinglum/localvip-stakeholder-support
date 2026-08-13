'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, Play, RefreshCcw, Search, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { useMaterialTemplates } from '@/lib/supabase/hooks'
import { ENGAGEMENT_CODES } from '@/lib/engagement-codes'
import type {
  BulkAudience,
  BulkFacets,
  BulkPreviewedTarget,
  BulkQrPurpose,
  BulkAccountResult,
} from '@/lib/server/bulk-material-generation'

/** Must match BULK_BATCH_LIMIT on the run route. */
const BATCH_SIZE = 25

interface PreviewResponse {
  template: { id: string; name: string; isActive: boolean } | null
  boomerangRun: boolean
  qrPurpose: BulkQrPurpose
  totalConsidered: number
  matched: number
  willGenerate: number
  willSkip: number
  targets: BulkPreviewedTarget[]
  facets: BulkFacets
}

/**
 * Wording comes from `engagement-codes`: "referral" is LocalVIP only, "list" is
 * Boomerang only, and "customer capture" is retired.
 */
const QR_PURPOSE_OPTIONS: Array<{ value: BulkQrPurpose; label: string; hint: string }> = [
  {
    value: 'business_network_referral',
    label: ENGAGEMENT_CODES.business_network_referral.label,
    hint: ENGAGEMENT_CODES.business_network_referral.outcome,
  },
  {
    value: 'business_capture',
    label: ENGAGEMENT_CODES.business_capture.label,
    hint: `${ENGAGEMENT_CODES.business_capture.outcome} Only businesses that opted in are included.`,
  },
  {
    value: 'owner_default',
    label: 'Account default link',
    hint: "Uses the account owner's LocalVIP signup link.",
  },
]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function FilterChips<T extends string | number>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: Array<{ value: T; label: string; count: number }>
  selected: T[]
  onToggle: (value: T) => void
}) {
  if (!options.length) return null
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              selected.includes(option.value)
                ? 'bg-brand-600 text-white'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            {option.label} <span className="opacity-60">{option.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function statusBadge(status: BulkAccountResult['status']) {
  if (status === 'generated') return <Badge variant="success">Generated</Badge>
  if (status === 'skipped') return <Badge variant="warning">Skipped</Badge>
  return <Badge variant="danger">Failed</Badge>
}

export function MaterialEngineBulkGeneratePage() {
  const { data: templates } = useMaterialTemplates()

  const [templateId, setTemplateId] = React.useState('')
  const [qrPurpose, setQrPurpose] = React.useState<BulkQrPurpose>('business_network_referral')
  const [audiences, setAudiences] = React.useState<BulkAudience[]>(['businesses'])
  const [cityKeys, setCityKeys] = React.useState<string[]>([])
  const [campaignIds, setCampaignIds] = React.useState<string[]>([])
  const [categoryIds, setCategoryIds] = React.useState<number[]>([])
  const [stages, setStages] = React.useState<string[]>([])
  const [statuses, setStatuses] = React.useState<string[]>([])
  const [includeInactive, setIncludeInactive] = React.useState(false)
  const [requireLogo, setRequireLogo] = React.useState(false)
  const [regenerateExisting, setRegenerateExisting] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const [preview, setPreview] = React.useState<PreviewResponse | null>(null)
  const [previewing, setPreviewing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [running, setRunning] = React.useState(false)
  const [results, setResults] = React.useState<BulkAccountResult[]>([])
  const [processed, setProcessed] = React.useState(0)
  const cancelRef = React.useRef(false)

  const activeTemplates = React.useMemo(
    () => templates.filter((template) => template.is_active),
    [templates],
  )

  async function loadPreview() {
    setPreviewing(true)
    setError(null)
    // A new audience invalidates the old run report — leaving it on screen next
    // to a different target set is how a stale success gets misread as this one.
    setResults([])
    setProcessed(0)
    try {
      const res = await fetch('/api/admin/material-engine/bulk-generate/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId || null,
          qrPurpose,
          audiences,
          cityKeys,
          campaignIds,
          categoryIds,
          stages,
          statuses,
          includeInactive,
          requireLogo,
          search,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Could not resolve the audience.')
      setPreview(json as PreviewResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve the audience.')
      setPreview(null)
    } finally {
      setPreviewing(false)
    }
  }

  /**
   * Walk the reviewed list a batch at a time.
   *
   * Results accumulate as each batch returns, so a run that is cancelled or
   * interrupted still shows exactly which accounts were done. Re-running is
   * safe: the server skips an account that already has this material unless
   * "regenerate" is on.
   */
  async function runBatches(queue: BulkPreviewedTarget[]) {
    if (!templateId || !queue.length) return
    setRunning(true)
    setError(null)
    cancelRef.current = false

    try {
      for (let index = 0; index < queue.length; index += BATCH_SIZE) {
        if (cancelRef.current) break
        const batch = queue.slice(index, index + BATCH_SIZE)
        const res = await fetch('/api/admin/material-engine/bulk-generate/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            templateId,
            qrPurpose,
            regenerateExisting,
            requireLogo,
            accounts: batch.map((target) => ({
              accountId: target.accountId,
              accountType: target.accountType,
            })),
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'The batch could not be run.')
        setResults((current) => [...current, ...(json.results as BulkAccountResult[])])
        setProcessed((current) => current + batch.length)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The batch could not be run.')
    } finally {
      setRunning(false)
    }
  }

  const targets = preview?.targets || []
  const runnable = React.useMemo(
    () => targets.filter((target) => target.disposition === 'will_generate'),
    [targets],
  )
  const doneKeys = React.useMemo(
    () => new Set(results.map((result) => `${result.accountType}:${result.accountId}`)),
    [results],
  )
  const remaining = React.useMemo(
    () => runnable.filter((target) => !doneKeys.has(`${target.accountType}:${target.accountId}`)),
    [runnable, doneKeys],
  )
  const failedTargets = React.useMemo(() => {
    const failedKeys = new Set(
      results.filter((result) => result.status === 'failed').map((r) => `${r.accountType}:${r.accountId}`),
    )
    return runnable.filter((target) => failedKeys.has(`${target.accountType}:${target.accountId}`))
  }, [runnable, results])

  const counts = {
    generated: results.filter((r) => r.status === 'generated').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk material generation"
        description="Generate one template across a filtered set of businesses and causes. Review the accounts first — nothing is generated until you run it."
      />

      {error && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Template and code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-[0.16em] text-surface-500">Template</span>
              <select
                value={templateId}
                onChange={(event) => { setTemplateId(event.target.value); setPreview(null) }}
                className="flex h-9 w-full items-center rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
              >
                <option value="">Choose a template…</option>
                {activeTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-[0.16em] text-surface-500">Code on the material</span>
              <select
                value={qrPurpose}
                onChange={(event) => { setQrPurpose(event.target.value as BulkQrPurpose); setPreview(null) }}
                className="flex h-9 w-full items-center rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
              >
                {QR_PURPOSE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className="block text-xs text-surface-500">
                {QR_PURPOSE_OPTIONS.find((option) => option.value === qrPurpose)?.hint}
              </span>
            </label>
          </div>

          {preview?.boomerangRun && (
            <div className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This is a {ENGAGEMENT_CODES.business_capture.label} material. Only businesses that opted in
                during onboarding are included — every other business is skipped with the reason shown, and
                causes are skipped because they have no list.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Audience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(['businesses', 'causes'] as BulkAudience[]).map((audience) => (
              <button
                key={audience}
                type="button"
                onClick={() => setAudiences((current) => (
                  current.includes(audience) && current.length === 1 ? current : toggle(current, audience)
                ))}
                className={`rounded-full px-4 py-2 text-sm capitalize ${
                  audiences.includes(audience) ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                {audience}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by name"
              className="pl-9"
            />
          </div>

          {preview?.facets ? (
            <div className="space-y-4">
              <FilterChips title="City" options={preview.facets.cities} selected={cityKeys} onToggle={(v) => setCityKeys((c) => toggle(c, v))} />
              <FilterChips title="Campaign" options={preview.facets.campaigns} selected={campaignIds} onToggle={(v) => setCampaignIds((c) => toggle(c, v))} />
              <FilterChips title="Business type" options={preview.facets.categories} selected={categoryIds} onToggle={(v) => setCategoryIds((c) => toggle(c, v))} />
              <FilterChips
                title="Stage"
                options={preview.facets.stages.map((s) => ({ value: s.value, label: s.value.replace(/_/g, ' '), count: s.count }))}
                selected={stages}
                onToggle={(v) => setStages((c) => toggle(c, v))}
              />
              <FilterChips
                title="Status"
                options={preview.facets.statuses.map((s) => ({ value: s.value, label: s.value.replace(/_/g, ' '), count: s.count }))}
                selected={statuses}
                onToggle={(v) => setStatuses((c) => toggle(c, v))}
              />
            </div>
          ) : (
            <p className="text-sm text-surface-500">
              Resolve the audience to see the cities, campaigns and business types that actually exist in the data.
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-surface-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              Include deactivated accounts
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requireLogo} onChange={(e) => setRequireLogo(e.target.checked)} />
              Skip accounts with no logo
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={regenerateExisting} onChange={(e) => setRegenerateExisting(e.target.checked)} />
              Generate again even if this material already exists
            </label>
          </div>

          <Button onClick={loadPreview} disabled={previewing || !audiences.length}>
            {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Resolve audience
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>3. Review {preview.matched} accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Considered" value={preview.totalConsidered} />
              <Stat label="Matched" value={preview.matched} />
              <Stat label="Will generate" value={preview.willGenerate} />
              <Stat label="Will skip" value={preview.willSkip} />
            </div>

            {targets.length === 0 ? (
              <EmptyState
                icon={<MinusCircle className="h-8 w-8" />}
                title="No accounts match these filters"
                description="Widen the filters, or include deactivated accounts."
              />
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-2xl border border-surface-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-50 text-left text-xs uppercase tracking-[0.16em] text-surface-500">
                    <tr>
                      <th className="px-4 py-2">Account</th>
                      <th className="px-4 py-2">City</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((target) => (
                      <tr key={`${target.accountType}:${target.accountId}`} className="border-t border-surface-100">
                        <td className="px-4 py-2">
                          <span className="font-medium text-surface-900">{target.name}</span>
                          <span className="ml-2 text-xs text-surface-400">{target.accountType}</span>
                        </td>
                        <td className="px-4 py-2 text-surface-600">{target.cityKey || '—'}</td>
                        <td className="px-4 py-2 text-surface-600">{target.categoryLabel || '—'}</td>
                        <td className="px-4 py-2">
                          {target.disposition === 'will_generate' ? (
                            <Badge variant="info">Will generate</Badge>
                          ) : (
                            <span className="flex flex-col gap-1">
                              <Badge variant="warning">Will skip</Badge>
                              <span className="text-xs text-surface-500">{target.message}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => runBatches(remaining)}
                disabled={running || !templateId || !remaining.length}
              >
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                {results.length ? `Continue (${remaining.length} left)` : `Generate for ${runnable.length} accounts`}
              </Button>
              {running && (
                <Button variant="outline" onClick={() => { cancelRef.current = true }}>
                  Stop after this batch
                </Button>
              )}
              {!running && failedTargets.length > 0 && (
                <Button variant="outline" onClick={() => runBatches(failedTargets)}>
                  Retry {failedTargets.length} failed
                </Button>
              )}
              {!templateId && <span className="text-sm text-surface-500">Choose a template first.</span>}
              {running && (
                <span className="text-sm text-surface-500">
                  {processed} of {runnable.length} accounts sent
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>4. Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Generated" value={counts.generated} icon={<CheckCircle2 className="h-4 w-4 text-success-500" />} />
              <Stat label="Skipped" value={counts.skipped} icon={<MinusCircle className="h-4 w-4 text-warning-500" />} />
              <Stat label="Failed" value={counts.failed} icon={<XCircle className="h-4 w-4 text-danger-500" />} />
            </div>
            <div className="max-h-96 overflow-y-auto rounded-2xl border border-surface-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-50 text-left text-xs uppercase tracking-[0.16em] text-surface-500">
                  <tr>
                    <th className="px-4 py-2">Account</th>
                    <th className="px-4 py-2">Outcome</th>
                    <th className="px-4 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={`${result.accountType}:${result.accountId}`} className="border-t border-surface-100">
                      <td className="px-4 py-2">
                        <span className="font-medium text-surface-900">{result.name}</span>
                        <span className="ml-2 text-xs text-surface-400">{result.accountType}</span>
                      </td>
                      <td className="px-4 py-2">{statusBadge(result.status)}</td>
                      <td className="px-4 py-2 text-surface-600">{result.message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-lg font-medium text-surface-900">{value}</p>
    </div>
  )
}
