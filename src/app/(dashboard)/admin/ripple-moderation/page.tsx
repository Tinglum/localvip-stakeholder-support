'use client'

import * as React from 'react'
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ModerationCard } from '@/components/ripple-moderation/moderation-card'
import type {
  ModerationAction,
  RippleModerationItem,
  RippleModerationResponse,
} from '@/components/ripple-moderation/types'

const ACTION_LABEL: Record<ModerationAction, string> = {
  clear: 'cleared and published',
  withhold: 'kept withheld',
  revoke: 'removed permanently',
}

function sortNewestFirst(items: RippleModerationItem[]): RippleModerationItem[] {
  return [...items].sort((a, b) => String(b.createdAtUtc || '').localeCompare(String(a.createdAtUtc || '')))
}

export default function RippleModerationPage() {
  const [items, setItems] = React.useState<RippleModerationItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<Record<string, ModerationAction>>({})
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({})

  const load = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/ripple/moderation?status=open&limit=50', { cache: 'no-store' })
      const body = (await res.json().catch(() => null)) as (RippleModerationResponse & { error?: string }) | null
      if (!res.ok) {
        setItems([])
        setLoadError(body?.error || `The moderation queue could not be loaded (HTTP ${res.status}).`)
        return
      }
      setItems(sortNewestFirst(Array.isArray(body?.items) ? body!.items : []))
    } catch {
      setItems([])
      setLoadError('The moderation queue could not be reached. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const resolve = React.useCallback(async (item: RippleModerationItem, action: ModerationAction) => {
    // Removing content is irreversible, so make the admin say it out loud.
    if (action === 'revoke') {
      const ok = window.confirm(
        `Remove this recommendation permanently?\n\n${item.businessName || 'Unknown business'}\n\nThis cannot be undone.`
      )
      if (!ok) return
    }

    const id = item.recommendationId
    setBusy((prev) => ({ ...prev, [id]: action }))
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setNotice(null)

    try {
      const res = await fetch(`/api/admin/ripple/moderation/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = (await res.json().catch(() => null)) as
        | { moderationStatus?: string; status?: string; error?: string }
        | null
      if (!res.ok) {
        setRowErrors((prev) => ({
          ...prev,
          [id]: body?.error || `That decision could not be saved (HTTP ${res.status}).`,
        }))
        return
      }

      if (action === 'withhold') {
        // Still withheld, so it stays in the queue — just refresh its status.
        setItems((prev) =>
          prev.map((row) =>
            row.recommendationId === id
              ? { ...row, moderationStatus: body?.moderationStatus ?? row.moderationStatus }
              : row
          )
        )
      } else {
        setItems((prev) => prev.filter((row) => row.recommendationId !== id))
      }
      setNotice(`Recommendation ${ACTION_LABEL[action]}.`)
    } catch {
      setRowErrors((prev) => ({ ...prev, [id]: 'That decision could not be saved. Please try again.' }))
    } finally {
      setBusy((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ripple Moderation"
        description="Recommendations held back by the abuse screen or by reports from signed-in customers. Only signed-in reports count toward the automatic withhold."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
          </Button>
        }
      />

      {notice && (
        <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {notice}
        </div>
      )}

      {loadError && (
        <Card className="border-danger-200 bg-danger-50 p-5">
          <p className="text-sm font-semibold text-danger-700">Could not load the queue</p>
          <p className="mt-1 text-sm text-danger-700">{loadError}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      ) : !loadError && items.length === 0 ? (
        <Card className="p-12 text-center text-surface-400">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">Nothing waiting for review</p>
        </Card>
      ) : (
        <>
          {!loadError && (
            <p className="text-xs text-surface-400">
              {items.length} item{items.length === 1 ? '' : 's'} in the queue, newest first
            </p>
          )}
          <div className="space-y-4">
            {items.map((item) => (
              <ModerationCard
                key={item.recommendationId}
                item={item}
                busyAction={busy[item.recommendationId] ?? null}
                error={rowErrors[item.recommendationId] ?? null}
                onResolve={resolve}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
