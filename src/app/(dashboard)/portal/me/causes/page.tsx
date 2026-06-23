'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Heart,
  Search,
  Plus,
  X,
  Check,
  Loader2,
  CloudOff,
  Sparkles,
  PieChart,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

interface CatalogCause {
  causeId: number
  name: string
  city: string | null
  description: string | null
  headline: string | null
}

interface SelectedCause {
  causeId: number
  name: string
  weightBp: number
}

interface CauseImpactPayload {
  yourContributionLifetime?: number
  selectedCausesReceivedLifetime?: number
  usCauseContributionLifetime?: number
  usCauseContributionsLifetime?: number
  totalCauseContributionLifetime?: number
  totalCauseContributionsLifetime?: number
  nationalCauseContributionLifetime?: number
  nationalCauseContributionsLifetime?: number
  allCausesReceivedLifetime?: number
  totalReceivedLifetime?: number
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const MAX_CAUSES = 5

function selectionPayload(selection: SelectedCause[]) {
  return selection
    .map((cause) => ({ causeId: cause.causeId, weightBp: Math.round(cause.weightBp) }))
    .filter((entry) => Number.isFinite(entry.causeId) && entry.causeId > 0)
    .sort((a, b) => a.causeId - b.causeId)
}

function selectionKey(selection: SelectedCause[]) {
  return JSON.stringify(selectionPayload(selection))
}

function pickCauseImpactNumber(payload: CauseImpactPayload | null, keys: Array<keyof CauseImpactPayload>): number | null {
  if (!payload) return null

  for (const key of keys) {
    const raw = payload[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  }

  return null
}

function formatUsd(value: number | null): string {
  if (value === null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function rebalance(selection: SelectedCause[]): SelectedCause[] {
  if (selection.length === 0) return []
  const basePercent = Math.floor(100 / selection.length)
  const remainderPercent = 100 - basePercent * selection.length
  return selection.map((cause, index) => ({
    ...cause,
    weightBp: (basePercent + (index === 0 ? remainderPercent : 0)) * 100,
  }))
}

function normalizeToHundred(selection: SelectedCause[]): SelectedCause[] {
  if (selection.length === 0) return []
  const total = selection.reduce((sum, cause) => sum + Math.max(0, Math.round(cause.weightBp)), 0)
  if (total <= 0) return rebalance(selection)

  const scaled = selection.map((cause) => {
    const exact = (Math.max(0, Math.round(cause.weightBp)) / total) * 100
    return { cause, exact, floor: Math.floor(exact) }
  })
  let remaining = 100 - scaled.reduce((sum, item) => sum + item.floor, 0)
  const byRemainder = [...scaled].sort((a, b) => (b.exact - b.floor) - (a.exact - a.floor))
  const extraById = new Map<number, number>()

  for (const item of byRemainder) {
    if (remaining <= 0) break
    extraById.set(item.cause.causeId, (extraById.get(item.cause.causeId) || 0) + 1)
    remaining -= 1
  }

  return scaled.map(({ cause, floor }) => ({
    ...cause,
    weightBp: (floor + (extraById.get(cause.causeId) || 0)) * 100,
  }))
}

function redistributeAfterDrag(selection: SelectedCause[], causeId: number, nextWeightBp: number): SelectedCause[] {
  if (selection.length <= 1) {
    return selection.map((cause) => ({ ...cause, weightBp: 10000 }))
  }

  const dragged = selection.find((cause) => cause.causeId === causeId)
  if (!dragged) return normalizeToHundred(selection)

  const lockedWeight = Math.max(0, Math.min(10000, Math.round(nextWeightBp)))
  const others = selection.filter((cause) => cause.causeId !== causeId)
  const remaining = 10000 - lockedWeight
  const otherTotal = others.reduce((sum, cause) => sum + Math.max(0, cause.weightBp), 0)
  const reweightedOthers = otherTotal > 0
    ? others.map((cause) => ({
      ...cause,
      weightBp: Math.round((Math.max(0, cause.weightBp) / otherTotal) * remaining),
    }))
    : rebalance(others).map((cause) => ({
      ...cause,
      weightBp: Math.round((cause.weightBp / 10000) * remaining),
    }))

  return normalizeToHundred(
    selection.map((cause) => {
      if (cause.causeId === causeId) return { ...cause, weightBp: lockedWeight }
      return reweightedOthers.find((other) => other.causeId === cause.causeId) || cause
    })
  )
}

export default function MyCausesPage() {
  const [catalog, setCatalog] = React.useState<CatalogCause[]>([])
  const [selection, setSelection] = React.useState<SelectedCause[]>([])
  const [causeImpact, setCauseImpact] = React.useState<CauseImpactPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle')

  const lastSavedKeyRef = React.useRef<string | null>(null)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/portal/me/causes', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(json?.error || 'Your causes could not be loaded.')
        }
        if (!active) return
        const nextCatalog: CatalogCause[] = Array.isArray(json?.catalog) ? json.catalog : []
        const nextSelection: SelectedCause[] = normalizeToHundred(Array.isArray(json?.selection) ? json.selection : [])
        setCatalog(nextCatalog)
        setSelection(nextSelection)
        setCauseImpact(json?.causeImpact && typeof json.causeImpact === 'object' ? json.causeImpact : null)
        lastSavedKeyRef.current = selectionKey(nextSelection)
      } catch (error) {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Your causes could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const persistSelection = React.useCallback(async (next: SelectedCause[]) => {
    const payload = selectionPayload(next)
    const key = JSON.stringify(payload)
    if (key === lastSavedKeyRef.current) return

    setSaveStatus('saving')
    try {
      const res = await fetch('/api/portal/me/causes', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selection: payload }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Save failed.')
      }
      lastSavedKeyRef.current = key
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [])

  React.useEffect(() => {
    if (loading) return
    if (selectionKey(selection) === lastSavedKeyRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const snapshot = selection
    saveTimerRef.current = setTimeout(() => {
      void persistSelection(snapshot)
    }, 700)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey(selection), loading])

  const selectedIds = React.useMemo(
    () => new Set(selection.map((cause) => cause.causeId)),
    [selection]
  )

  const canAddMore = selection.length < MAX_CAUSES

  const addCause = (cause: CatalogCause) => {
    if (selectedIds.has(cause.causeId) || !canAddMore) return
    setSelection((prev) => rebalance([
      ...prev,
      { causeId: cause.causeId, name: cause.name, weightBp: 0 },
    ]))
  }

  const removeCause = (causeId: number) => {
    setSelection((prev) => normalizeToHundred(prev.filter((cause) => cause.causeId !== causeId)))
  }

  const setWeight = (causeId: number, percent: number) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
    setSelection((prev) => redistributeAfterDrag(prev, causeId, clamped * 100))
  }

  const splitEvenly = () => setSelection((prev) => rebalance(prev))

  const totalBp = selection.reduce((sum, cause) => sum + cause.weightBp, 0)
  const totalPercent = Math.round((totalBp / 100) * 100) / 100
  const isHundred = totalBp === 10000
  const communityMomentumTotal = pickCauseImpactNumber(causeImpact, [
    'usCauseContributionLifetime',
    'usCauseContributionsLifetime',
    'totalCauseContributionLifetime',
    'totalCauseContributionsLifetime',
    'nationalCauseContributionLifetime',
    'nationalCauseContributionsLifetime',
    'allCausesReceivedLifetime',
    'totalReceivedLifetime',
  ])
  const selectedCauseLifetimeImpact = pickCauseImpactNumber(causeImpact, ['selectedCausesReceivedLifetime'])

  const searchResults = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []
    return catalog
      .filter((cause) => {
        return (
          cause.name.toLowerCase().includes(query) ||
          (cause.city || '').toLowerCase().includes(query) ||
          (cause.description || '').toLowerCase().includes(query) ||
          (cause.headline || '').toLowerCase().includes(query)
        )
      })
      .slice(0, 25)
  }, [catalog, searchQuery])

  const selectedCount = selection.length

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My Causes"
        description="Choose where your support goes. Pick up to five causes and decide how to split your impact between them."
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'My Causes' }]}
        actions={<SaveIndicator status={saveStatus} />}
      />

      <Card className="mb-6 border-brand-100 bg-brand-50/60">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-surface-900">How this works</p>
            <p className="text-sm text-surface-600">
              Add the causes you care about, then make sure the percentages add up to 100%. Your
              changes save automatically a moment after you stop typing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href="#cause-search">Find a cause</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/me/wallet">View wallet summary</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 overflow-hidden">
        <CardContent className="flex items-center gap-4 p-5">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
              selectedCount > 0 ? 'bg-brand-50 text-brand-600' : 'bg-surface-100 text-surface-400'
            )}
          >
            <Heart className={cn('h-6 w-6', selectedCount > 0 && 'fill-current')} />
          </div>
          <div className="min-w-0 flex-1">
            {selectedCount > 0 ? (
              <>
                <p className="text-subheading text-surface-900">
                  {selectedCount} of {MAX_CAUSES} {selectedCount === 1 ? 'cause' : 'causes'} selected
                </p>
                <p className="text-body text-surface-500">
                  Your support is directed where it matters most to you.
                </p>
              </>
            ) : (
              <>
                <p className="text-subheading text-surface-900">No causes selected yet</p>
                <p className="text-body text-surface-500">
                  Use the search below to choose where your support should go.
                </p>
              </>
            )}
          </div>
          {selectedCount > 0 && (
            <Badge variant={isHundred ? 'success' : 'warning'} className="shrink-0">
              <PieChart className="h-3 w-3" />
              {totalPercent}% allocated
            </Badge>
          )}
        </CardContent>
      </Card>

      {loadError && (
        <Card className="mb-6 border-danger-200 bg-danger-50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-danger-700">
            <CloudOff className="h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="border-warning-100 bg-warning-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-warning-600" />
              Community momentum
            </CardTitle>
            <CardDescription>
              Total aggregated cause contribution across the US since LocalVIP started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-40 animate-pulse rounded-lg bg-white/70" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-surface-900">
                {formatUsd(communityMomentumTotal)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-brand-600" />
              Your lifetime impact
            </CardTitle>
            <CardDescription>
              Aggregate lifetime support received by the causes you selected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-40 animate-pulse rounded-lg bg-surface-100" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-surface-900">
                {formatUsd(selectedCauseLifetimeImpact)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your selections</CardTitle>
          <CardDescription>
            Drag each slider to choose the split. The other causes adjust automatically, so the total always stays at 100%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-surface-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading your causes...</span>
            </div>
          ) : selection.length === 0 ? (
            <EmptyState
              icon={<Heart className="h-6 w-6" />}
              title="No causes selected yet"
              description="Search for a cause below, add it to your list, and then set how much of your support it should receive."
            />
          ) : (
            <ul className="space-y-2.5">
              {selection.map((cause) => {
                const percent = Math.round(cause.weightBp / 100)

                return (
                  <li
                    key={cause.causeId}
                    className="rounded-lg border border-surface-200 bg-surface-0 p-3.5 transition-colors hover:border-surface-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Heart className="h-4 w-4 fill-current" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-surface-900">{cause.name}</p>
                        <p className="text-xs text-surface-500">Drag to change this cause&apos;s share.</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2">
                        <span className="w-9 text-right text-sm font-semibold text-surface-900">{percent}</span>
                        <span className="text-sm text-surface-500">%</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${cause.name}`}
                        onClick={() => removeCause(cause.causeId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={percent}
                      onChange={(event) => setWeight(cause.causeId, Number(event.target.value))}
                      className="mt-3 h-2 w-full cursor-grab appearance-none rounded-full bg-surface-100 accent-brand-600 active:cursor-grabbing"
                      style={{ background: `linear-gradient(to right, rgb(37 99 235) 0%, rgb(37 99 235) ${percent}%, rgb(241 245 249) ${percent}%, rgb(241 245 249) 100%)` }}
                      aria-label={`Drag allocation percent for ${cause.name}`}
                    />
                  </li>
                )
              })}
            </ul>
          )}
          {!loading && selection.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-surface-100 pt-3">
              <span
                className={cn(
                  'text-sm font-medium',
                  isHundred ? 'text-success-700' : 'text-warning-700'
                )}
              >
                Total allocated: {totalPercent}%{isHundred ? '' : ' - this should be 100%'}
              </span>
              <Button variant="outline" size="sm" onClick={splitEvenly}>
                Split evenly
              </Button>
            </div>
          )}
          {!loading && !canAddMore && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-surface-500">
              <Sparkles className="h-3.5 w-3.5" />
              You&apos;ve reached the maximum of {MAX_CAUSES} causes. Remove one to add another.
            </p>
          )}
          {!loading && selection.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 text-sm leading-6 text-surface-600">
              <p className="font-semibold text-surface-900">Easy tip</p>
              <p className="mt-1">
                If you do not want to fine-tune each percentage, click <strong>Split evenly</strong> and keep moving.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Find a cause</CardTitle>
          <CardDescription>
            Search by name, city, or keyword to add an organization to your list.
          </CardDescription>
        </CardHeader>
        <CardContent id="cause-search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search organizations..."
              className="pl-9"
              disabled={loading}
            />
          </div>

          <div className="mt-4">
            {!searchQuery.trim() ? (
              <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-6 text-center">
                <p className="text-sm font-medium text-surface-700">
                  Start typing to find a cause to support.
                </p>
                <p className="mt-1 text-sm text-surface-500">
                  Try a cause name, a city, or a word from its mission.
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-surface-400">
                No causes match &quot;{searchQuery.trim()}&quot;.
              </p>
            ) : (
              <ul className="space-y-2">
                {searchResults.map((cause) => {
                  const isSelected = selectedIds.has(cause.causeId)
                  return (
                    <li
                      key={cause.causeId}
                      className="flex items-start gap-3 rounded-lg border border-surface-200 p-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-surface-900">{cause.name}</p>
                          {isSelected && (
                            <Badge variant="success">
                              <Check className="h-3 w-3" />
                              Selected
                            </Badge>
                          )}
                        </div>
                        {cause.city && <p className="mt-0.5 text-xs text-surface-500">{cause.city}</p>}
                        {(cause.description || cause.headline) && (
                          <p className="mt-1 line-clamp-2 text-xs text-surface-500">
                            {cause.description || cause.headline}
                          </p>
                        )}
                      </div>
                      {isSelected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => removeCause(cause.causeId)}
                        >
                          <X className="h-4 w-4" />
                          Remove
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          disabled={!canAddMore}
                          onClick={() => addCause(cause)}
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-surface-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving...
      </span>
    )
  }

  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-success-700">
        <Check className="h-3.5 w-3.5" />
        Saved
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-danger-700">
      <CloudOff className="h-3.5 w-3.5" />
      Couldn&apos;t save - retrying on next change
    </span>
  )
}
