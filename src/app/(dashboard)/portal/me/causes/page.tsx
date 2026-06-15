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

function rebalance(selection: SelectedCause[]): SelectedCause[] {
  if (selection.length === 0) return []
  const base = Math.floor(10000 / selection.length)
  const remainder = 10000 - base * selection.length
  return selection.map((cause, index) => ({
    ...cause,
    weightBp: base + (index === 0 ? remainder : 0),
  }))
}

export default function MyCausesPage() {
  const [catalog, setCatalog] = React.useState<CatalogCause[]>([])
  const [selection, setSelection] = React.useState<SelectedCause[]>([])
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
        const nextSelection: SelectedCause[] = Array.isArray(json?.selection) ? json.selection : []
        setCatalog(nextCatalog)
        setSelection(nextSelection)
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
    setSelection((prev) => [
      ...prev,
      { causeId: cause.causeId, name: cause.name, weightBp: prev.length === 0 ? 10000 : 0 },
    ])
  }

  const removeCause = (causeId: number) => {
    setSelection((prev) => prev.filter((cause) => cause.causeId !== causeId))
  }

  const setWeight = (causeId: number, percent: number) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
    setSelection((prev) =>
      prev.map((cause) =>
        cause.causeId === causeId ? { ...cause, weightBp: Math.round(clamped * 100) } : cause
      )
    )
  }

  const splitEvenly = () => setSelection((prev) => rebalance(prev))

  const totalBp = selection.reduce((sum, cause) => sum + cause.weightBp, 0)
  const totalPercent = Math.round((totalBp / 100) * 100) / 100
  const isHundred = totalBp === 10000

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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your selections</CardTitle>
          <CardDescription>
            Set how much of your support each cause receives. The total should add up to 100%.
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
              {selection.map((cause) => (
                <li
                  key={cause.causeId}
                  className="flex items-center gap-3 rounded-lg border border-surface-200 bg-surface-0 p-3.5 transition-colors hover:border-surface-300"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Heart className="h-4 w-4 fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-900">{cause.name}</p>
                    <div className="mt-1.5 hidden h-1.5 overflow-hidden rounded-full bg-surface-100 sm:block">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${Math.min(100, cause.weightBp / 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(cause.weightBp / 100)}
                      onChange={(event) => setWeight(cause.causeId, Number(event.target.value))}
                      className="w-16 text-right"
                      aria-label={`Allocation percent for ${cause.name}`}
                    />
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
                </li>
              ))}
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
