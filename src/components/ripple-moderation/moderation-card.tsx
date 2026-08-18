'use client'

import * as React from 'react'
import { AlertTriangle, Check, EyeOff, Flag, Loader2, Star, Trash2, UserX } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'
import type { ModerationAction, RippleModerationItem, RippleModerationReport } from './types'

// The abuse rules only count reports from signed-in people toward the
// auto-withhold threshold (3+). Anonymous reports are visible to an admin but
// carry no weight, so the UI has to say so or the count looks inflated.
const AUTO_WITHHOLD_THRESHOLD = 3

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  clear: 'success',
  pending_review: 'warning',
  auto_withheld: 'danger',
  withheld: 'danger',
  revoked: 'danger',
}

function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Prefer the fullest text the backend gave us; fall back through the parts.
function recommendationText(item: RippleModerationItem): string {
  const parts = [item.preview, item.tagLine, item.otherText].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0
  )
  return parts.length > 0 ? parts.join(' — ') : 'No recommendation text was captured.'
}

export interface ModerationCardProps {
  item: RippleModerationItem
  busyAction: ModerationAction | null
  error?: string | null
  onResolve: (item: RippleModerationItem, action: ModerationAction) => void
}

export function ModerationCard({ item, busyAction, error, onResolve }: ModerationCardProps) {
  const reports: RippleModerationReport[] = Array.isArray(item.reports) ? item.reports : []
  const signedInReports = reports.filter((r) => !r.anonymous)
  const anonymousReports = reports.filter((r) => r.anonymous)
  const countingReports = signedInReports.length
  const busy = busyAction !== null

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-surface-900">{item.businessName || 'Unknown business'}</p>
          <p className="mt-0.5 text-xs text-surface-500">
            {item.displayName?.trim() ? `Signed “${item.displayName.trim()}”` : 'Anonymous recommendation'}
            {' · '}
            {item.createdAtUtc ? formatDateTime(item.createdAtUtc) : 'no date'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {typeof item.rating === 'number' && (
            <Badge variant="default">
              <Star className="h-3 w-3" /> {item.rating}
            </Badge>
          )}
          {item.standoutCode && <Badge variant="outline">{humanize(item.standoutCode)}</Badge>}
          <Badge variant={STATUS_VARIANT[String(item.moderationStatus)] || 'default'}>
            {humanize(item.moderationStatus)}
          </Badge>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-800">
        {recommendationText(item)}
      </p>

      {/* Report tally — separated so an admin is not misled by the raw count. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={countingReports >= AUTO_WITHHOLD_THRESHOLD ? 'danger' : 'warning'}>
          <Flag className="h-3 w-3" /> {countingReports} counting report{countingReports === 1 ? '' : 's'}
        </Badge>
        {anonymousReports.length > 0 && (
          <Badge variant="outline">
            <UserX className="h-3 w-3" /> {anonymousReports.length} anonymous (does not count)
          </Badge>
        )}
        {typeof item.reportCount === 'number' && item.reportCount !== countingReports && (
          <span className="text-xs text-surface-400">backend reportCount: {item.reportCount}</span>
        )}
        {countingReports >= AUTO_WITHHOLD_THRESHOLD && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-600">
            <AlertTriangle className="h-3 w-3" /> At or over the auto-withhold threshold
          </span>
        )}
      </div>

      {reports.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-lg border border-surface-200 px-3 py-2 text-xs text-surface-600"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-surface-800">{humanize(report.reasonCode)}</span>
                <Badge variant={report.anonymous ? 'outline' : 'warning'}>
                  {report.anonymous ? 'Anonymous · not counted' : 'Signed in · counted'}
                </Badge>
                <span className="text-surface-400">
                  {report.createdAtUtc ? formatDateTime(report.createdAtUtc) : '—'}
                </span>
              </div>
              {report.details?.trim() && (
                <p className="mt-1 whitespace-pre-wrap text-surface-600">{report.details.trim()}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-surface-400">
          No reports on file — this was withheld by the automated abuse screen.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-surface-200 pt-4">
        <Button size="sm" variant="success" disabled={busy} onClick={() => onResolve(item, 'clear')}>
          {busyAction === 'clear' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Clear &amp; publish
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onResolve(item, 'withhold')}>
          {busyAction === 'withhold' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
          Keep withheld
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => onResolve(item, 'revoke')}>
          {busyAction === 'revoke' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Remove permanently
        </Button>
        <span className="ml-auto font-mono text-[11px] text-surface-400">{item.recommendationId}</span>
      </div>
    </Card>
  )
}
