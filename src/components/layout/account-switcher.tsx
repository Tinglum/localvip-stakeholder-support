'use client'

/**
 * "You are signed in as X. You have access to..." — and a way to move.
 *
 * Someone who owns a business AND leads a cause previously landed on whichever
 * account the by-user lookup happened to return first, with nothing on screen
 * saying there was another one or how to reach it. This surfaces the set and
 * makes the choice explicit: a modal on every load stating who you are signed
 * in as and what you can reach, plus a permanent dropdown in the top bar.
 *
 * Renders nothing for the overwhelming majority of users, who have exactly one
 * account — there is no choice to make, so there is no UI to show.
 */

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Heart, Loader2, Store } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PortalAccount {
  type: 'business' | 'cause'
  accountId: number
  name: string
}

interface AccountsResponse {
  user: { name: string | null; email: string | null }
  current: { type: 'business' | 'cause'; accountId: number } | null
  accounts: PortalAccount[]
  incomplete?: boolean
}

export function AccountSwitcher() {
  const [data, setData] = React.useState<AccountsResponse | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [switching, setSwitching] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch('/api/portal/accounts')
        if (!response.ok) return
        const json: AccountsResponse = await response.json()
        if (cancelled) return
        setData(json)
        // Every load, deliberately: the point is to state which account you are
        // in before you act in it, and a once-per-session gate meant the answer
        // was missing exactly when someone came back later and had forgotten.
        if (json.accounts.length > 1) setModalOpen(true)
      } catch { /* the dropdown simply does not appear */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function dismiss() {
    setModalOpen(false)
  }

  async function choose(account: PortalAccount) {
    setSwitching(account.accountId)
    setError(null)
    try {
      const response = await fetch('/api/portal/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: account.type, accountId: account.accountId }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error || 'Could not switch account.')
        setSwitching(null)
        return
      }
      // Hard reload: the shell, nav and data are all resolved server-side from
      // the pin cookie, so a client-side route change would keep the old portal.
      window.location.href = '/dashboard'
    } catch {
      setError('Could not switch account.')
      setSwitching(null)
    }
  }

  if (!data || data.accounts.length <= 1) return null

  const current = data.accounts.find(
    item => data.current && item.type === data.current.type && item.accountId === data.current.accountId,
  ) || null

  const icon = (type: PortalAccount['type']) => (
    type === 'cause'
      ? <Heart className="h-3.5 w-3.5 text-rose-500" />
      : <Store className="h-3.5 w-3.5 text-blue-500" />
  )

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 rounded-xl border border-surface-200 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-100">
            {icon(current?.type || 'business')}
            <span className="hidden max-w-[160px] truncate text-sm text-surface-700 md:block">
              {current?.name || 'Choose account'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[260px] rounded-xl border border-surface-200 bg-surface-0 p-1 shadow-panel animate-fade-in"
            align="end"
            sideOffset={4}
          >
            <p className="px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-surface-400">
              Your accounts
            </p>
            {data.accounts.map(account => {
              const active = current?.type === account.type && current?.accountId === account.accountId
              return (
                <DropdownMenu.Item
                  key={`${account.type}-${account.accountId}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface-100',
                    active ? 'text-surface-900' : 'text-surface-600',
                  )}
                  onSelect={event => {
                    event.preventDefault()
                    if (!active) choose(account)
                  }}
                >
                  {icon(account.type)}
                  <span className="min-w-0 flex-1 truncate">{account.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog open={modalOpen} onOpenChange={open => { if (!open) dismiss() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>You have more than one account</DialogTitle>
            <DialogDescription>
              {data.user.name
                ? <>You are signed in as <span className="font-medium text-surface-800">{data.user.name}</span>. Choose which one to open.</>
                : 'Choose which one to open.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {data.accounts.map(account => {
              const active = current?.type === account.type && current?.accountId === account.accountId
              return (
                <button
                  key={`${account.type}-${account.accountId}`}
                  onClick={() => (active ? dismiss() : choose(account))}
                  disabled={switching !== null}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                    active
                      ? 'border-blue-300 bg-blue-50/60'
                      : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50',
                  )}
                >
                  {icon(account.type)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-900">{account.name}</p>
                    <p className="text-xs text-surface-500">
                      {account.type === 'cause' ? 'Cause or school' : 'Business'}
                      {active ? ' · currently open' : ''}
                    </p>
                  </div>
                  {switching === account.accountId
                    ? <Loader2 className="h-4 w-4 animate-spin text-surface-400" />
                    : active
                      ? <Check className="h-4 w-4 text-emerald-500" />
                      : null}
                </button>
              )
            })}
          </div>

          {data.incomplete && (
            <p className="text-xs text-amber-600">
              Some accounts could not be checked just now, so this list may be incomplete.
            </p>
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={dismiss}>Stay here</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
