'use client'

/**
 * View-As picker
 * ──────────────
 * Admin tool. Opens a popover, debounced-searches AspNetUsers, and switches the
 * dashboard's effective session to the picked user. Mounted in the topbar.
 * Pairs with <ViewAsBanner /> (the yellow header band) that reads the cookie.
 *
 * Aesthetic: command-bar minimal. One quiet signal — when impersonating, the
 * trigger button gets a soft amber ring; otherwise it's just an eye icon.
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import * as Popover from '@radix-ui/react-popover'
import { ArrowRight, Eye, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewAsTarget {
  userId: number
  email: string
  name: string
  role?: string
  accountType?: number | string
  consumerType?: string
  since?: string
}

interface UserHit {
  id: number
  email: string | null
  firstName: string | null
  lastName: string | null
  phoneNumber: string | null
  accountType?: number
  consumerType?: string
  referralCode?: string | null
}

// AspNetUsers.AccountType enum → label + accent color used in role chip.
const ROLE_BY_ACCOUNT_TYPE: Record<number, { label: string; dot: string; text: string }> = {
  0: { label: 'Admin',    dot: 'bg-danger-500',  text: 'text-danger-700'  },
  2: { label: 'Business', dot: 'bg-brand-500',   text: 'text-brand-700'   },
  3: { label: 'Cause',    dot: 'bg-success-500', text: 'text-success-700' },
  4: { label: 'Customer', dot: 'bg-surface-400', text: 'text-surface-600' },
  5: { label: 'Field',    dot: 'bg-warning-500', text: 'text-warning-700' },
}

function roleChip(at: number | undefined, consumerType?: string) {
  const meta = ROLE_BY_ACCOUNT_TYPE[at ?? -1] ?? ROLE_BY_ACCOUNT_TYPE[4]
  // Consumers with a non-Normal subtype are stakeholders — show the subtype.
  const label = at === 4 && consumerType && consumerType !== 'Normal'
    ? consumerType.replace('LaunchTeamPartner', 'Launch Partner')
    : meta.label
  return { label, dot: meta.dot, text: meta.text }
}

function readCookieJson<T>(name: string): T | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  if (!m) return null
  try { return JSON.parse(decodeURIComponent(m.split('=')[1])) as T } catch { return null }
}

export function ViewAsPicker() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<UserHit[]>([])
  const [loading, setLoading] = React.useState(false)
  const [activating, setActivating] = React.useState<number | null>(null)
  const [viewingAs, setViewingAs] = React.useState<ViewAsTarget | null>(null)
  const [returning, setReturning] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [focusIdx, setFocusIdx] = React.useState(0)

  // Pick up the current cookie state when mounted + after switches.
  const refreshState = React.useCallback(() => {
    setViewingAs(readCookieJson<ViewAsTarget>('lvip_view_as'))
  }, [])
  React.useEffect(() => { refreshState() }, [refreshState])

  // Auto-focus the search box on open.
  React.useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setFocusIdx(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Debounced server search. Empty/short query → no request.
  React.useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < 2) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/qa/users/search?q=${encodeURIComponent(trimmed)}`, {
          cache: 'no-store',
        })
        if (!res.ok) { if (!cancelled) setResults([]); return }
        const json = (await res.json()) as UserHit[]
        if (!cancelled) {
          setResults(Array.isArray(json) ? json : [])
          setFocusIdx(0)
        }
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => { cancelled = true; window.clearTimeout(handle) }
  }, [query, open])

  const switchTo = React.useCallback(async (userId: number) => {
    if (activating) return
    setActivating(userId)
    try {
      const res = await fetch('/api/admin/view-as', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // Surface the error inline; don't close.
        setResults((prev) => prev.map((u) =>
          u.id === userId ? { ...u, lastName: (u.lastName ?? '') + ' — ' + ((body as { error?: string }).error || 'failed') } : u))
        return
      }
      // Refresh cookie → banner picks up the new identity. router.refresh()
      // re-runs server components so layouts re-read the session.
      refreshState()
      setOpen(false)
      router.push('/dashboard')
      router.refresh()
    } finally {
      setActivating(null)
    }
  }, [activating, refreshState, router])

  const returnToAdmin = async () => {
    setReturning(true)
    try {
      await fetch('/api/admin/view-as', { method: 'DELETE' })
      setViewingAs(null)
      setOpen(false)
      router.refresh()
    } finally {
      setReturning(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault()
      setFocusIdx((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault()
      setFocusIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && results[focusIdx]) {
      e.preventDefault()
      switchTo(results[focusIdx].id)
    }
  }

  const impersonating = !!viewingAs

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={impersonating ? `Viewing as ${viewingAs?.name}` : 'View dashboard as another user'}
          className={cn(
            'relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            impersonating
              ? 'text-amber-700 bg-amber-50 ring-2 ring-amber-300/70 hover:bg-amber-100'
              : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'
          )}
        >
          <Eye className="h-4 w-4" />
          {impersonating && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[380px] origin-top-right overflow-hidden rounded-xl border border-surface-200 bg-surface-0 shadow-panel animate-fade-in"
        >
          {/* Active impersonation banner — sits ABOVE the search like a status row */}
          {impersonating && viewingAs && (
            <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50/70 px-4 py-3">
              <span className="mt-0.5 inline-flex h-2 w-2 flex-none rounded-full bg-amber-500" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  Currently viewing as
                </div>
                <div className="mt-0.5 truncate font-medium text-amber-950">{viewingAs.name}</div>
                <div className="truncate font-mono text-[11px] text-amber-700/80">{viewingAs.email}</div>
              </div>
              <button
                type="button"
                onClick={returnToAdmin}
                disabled={returning}
                className="inline-flex items-center gap-1 rounded-md bg-amber-900 px-2.5 py-1 text-[11px] font-medium text-amber-50 transition hover:bg-amber-800 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                {returning ? 'Returning…' : 'Return'}
              </button>
            </div>
          )}

          {/* Search input */}
          <div className="relative border-b border-surface-100 px-3 py-2.5">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Switch into any user — name, email, phone…"
              className="h-9 w-full rounded-lg bg-surface-50 pl-9 pr-9 text-sm text-surface-800 placeholder:text-surface-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {loading && (
              <Loader2 className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-surface-400" />
            )}
          </div>

          {/* Result rows */}
          <div className="max-h-[360px] overflow-y-auto py-1">
            {query.trim().length < 2 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[11px] uppercase tracking-wider text-surface-400">
                  Admin tool
                </p>
                <p className="mt-2 text-sm text-surface-600">
                  Type at least 2 characters to find any user across the platform.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-surface-50 px-2 py-1 font-mono text-[10px] text-surface-500">
                  <kbd className="rounded border border-surface-200 bg-surface-0 px-1">↑↓</kbd>
                  navigate
                  <span className="text-surface-300">·</span>
                  <kbd className="rounded border border-surface-200 bg-surface-0 px-1">↵</kbd>
                  switch
                  <span className="text-surface-300">·</span>
                  <kbd className="rounded border border-surface-200 bg-surface-0 px-1">esc</kbd>
                  close
                </div>
              </div>
            ) : !loading && results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-surface-500">
                No users matched “{query.trim()}”.
              </p>
            ) : (
              results.map((u, idx) => {
                const chip = roleChip(u.accountType, u.consumerType)
                const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || `User ${u.id}`
                const isFocused = idx === focusIdx
                const isBusy = activating === u.id
                return (
                  <button
                    key={u.id}
                    type="button"
                    onMouseEnter={() => setFocusIdx(idx)}
                    onClick={() => switchTo(u.id)}
                    disabled={isBusy}
                    className={cn(
                      'group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      isFocused ? 'bg-brand-50/60' : 'hover:bg-surface-50',
                      isBusy && 'opacity-60'
                    )}
                  >
                    {/* Dot in the role's accent color */}
                    <span className={cn('h-2 w-2 flex-none rounded-full', chip.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-surface-900">{name}</span>
                        <span className={cn('font-mono text-[10px] uppercase tracking-wider', chip.text)}>
                          {chip.label}
                        </span>
                      </div>
                      <div className="truncate font-mono text-[11px] text-surface-500">
                        {u.email}
                        {u.referralCode && (
                          <span className="ml-2 text-surface-400">· {u.referralCode}</span>
                        )}
                      </div>
                    </div>
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 flex-none animate-spin text-brand-500" />
                    ) : (
                      <ArrowRight
                        className={cn(
                          'h-4 w-4 flex-none text-surface-300 transition-all',
                          isFocused
                            ? 'translate-x-0 text-brand-500 opacity-100'
                            : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                        )}
                      />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
