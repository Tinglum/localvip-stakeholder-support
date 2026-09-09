'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users,
  Mail,
  Phone,
  MapPin,
  Loader2,
  Search,
  Store,
  Heart,
  UserCircle2,
  LogIn,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { QaNodeListItem, QaNodeType } from '@/lib/auth/qa-api'

const PAGE_SIZE = 25

const TYPE_META: Record<string, { label: string; verb: string; icon: React.ReactNode; variant: 'default' | 'info' | 'success' }> = {
  customer: { label: 'Customer', verb: 'Customer', icon: <UserCircle2 className="h-4 w-4" />, variant: 'default' },
  business: { label: 'Business', verb: 'Business', icon: <Store className="h-4 w-4" />, variant: 'info' },
  cause: { label: 'Cause', verb: 'Cause', icon: <Heart className="h-4 w-4" />, variant: 'success' },
}

function typeMeta(type: string) {
  return TYPE_META[type?.toLowerCase()] || TYPE_META.customer
}

interface NodesResponse {
  items: QaNodeListItem[]
  totalCount: number
  page: number
  pageSize: number
  error?: string
}

export default function CustomersPage() {
  const router = useRouter()
  const [items, setItems] = React.useState<QaNodeListItem[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [type] = React.useState<QaNodeType>('customer')
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phoneNumber, setPhoneNumber] = React.useState('')
  const [referrerSearch, setReferrerSearch] = React.useState('')
  const [referrerResults, setReferrerResults] = React.useState<QaNodeListItem[]>([])
  const [selectedReferrer, setSelectedReferrer] = React.useState<QaNodeListItem | null>(null)
  const [referrerLoading, setReferrerLoading] = React.useState(false)
  const [referrerError, setReferrerError] = React.useState<string | null>(null)
  const [referrerRetry, setReferrerRetry] = React.useState(0)

  const [loginTarget, setLoginTarget] = React.useState<QaNodeListItem | null>(null)
  const [loggingIn, setLoggingIn] = React.useState(false)
  const [loginError, setLoginError] = React.useState<string | null>(null)

  // Debounce the search box → server-side search.
  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  React.useEffect(() => {
    if (!addOpen || selectedReferrer || referrerSearch.trim().length < 2) {
      setReferrerResults([])
      setReferrerLoading(false)
      setReferrerError(null)
      return
    }
    const controller = new AbortController()
    setReferrerLoading(true)
    setReferrerResults([])
    setReferrerError(null)
    const handle = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({ type: 'all', search: referrerSearch.trim(), page: '1', pageSize: '12' })
        const response = await fetch(`/api/dashboard/nodes?${query.toString()}`, { cache: 'no-store', signal: controller.signal })
        const payload = (await response.json().catch(() => null)) as NodesResponse | null
        if (!response.ok || !Array.isArray(payload?.items)) throw new Error('Search failed')
        if (!controller.signal.aborted) setReferrerResults(payload.items)
      } catch {
        if (!controller.signal.aborted) setReferrerError('Could not search referrers. Please try again.')
      } finally {
        if (!controller.signal.aborted) setReferrerLoading(false)
      }
    }, 250)
    return () => { controller.abort(); window.clearTimeout(handle) }
  }, [addOpen, referrerSearch, selectedReferrer, referrerRetry])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        type,
        search,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      const res = await fetch(`/api/dashboard/nodes?${query.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as NodesResponse | null
      if (!res.ok || !json) {
        throw new Error(json?.error || 'Failed to load customers.')
      }
      setItems(Array.isArray(json.items) ? json.items : [])
      setTotalCount(Number(json.totalCount) || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers.')
      setItems([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [type, search, page])

  React.useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const [openingId, setOpeningId] = React.useState<number | string | null>(null)

  // "Open in app": mint a token for the customer and open my.localvip.com already
  // signed in as them (the mobile-app experience).
  const handleOpenInApp = async (node: QaNodeListItem) => {
    setOpeningId(node.userId)
    setLoginError(null)
    // Open the tab synchronously (before the await) so it isn't blocked as a
    // popup; we point it at the handoff URL once the token is minted.
    const win = window.open('', '_blank')
    try {
      const res = await fetch('/api/dashboard/open-in-app', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: node.userId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        throw new Error((json as { error?: string }).error || 'Could not open the app.')
      }
      if (win) win.location.href = json.url as string
      else window.location.href = json.url as string
    } catch (err) {
      if (win) win.close()
      setLoginError(err instanceof Error ? err.message : 'Could not open the app.')
    } finally {
      setOpeningId(null)
    }
  }

  const handleLoginAs = async () => {
    if (!loginTarget) return
    setLoggingIn(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/dashboard/login-as', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: loginTarget.userId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || 'Login-as failed.')
      }
      setLoginTarget(null)
      // The view-as cookie is now set; refresh server components so the whole
      // dashboard re-reads the impersonated identity, then land on its home.
      router.push('/dashboard')
      router.refresh()
      // Full page reload to ensure UI completely re-renders with impersonated state
      setTimeout(() => { window.location.href = '/dashboard' }, 100)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login-as failed.')
    } finally {
      setLoggingIn(false)
    }
  }

  // "Real log in": swap the admin's own dashboard session for a genuine session
  // as the target (vs the read-only view-as overlay). A backup of the admin
  // session is kept so "Return to admin" can restore it.
  const handleRealLogin = async () => {
    if (!loginTarget) return
    setLoggingIn(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/dashboard/real-login-as', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: loginTarget.userId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || 'Real log in failed.')
      }
      setLoginTarget(null)
      router.push('/dashboard')
      router.refresh()
      setTimeout(() => { window.location.href = '/dashboard' }, 100)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Real log in failed.')
    } finally {
      setLoggingIn(false)
    }
  }

  const resetCreateForm = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhoneNumber('')
    setReferrerSearch('')
    setReferrerResults([])
    setSelectedReferrer(null)
    setCreateError(null)
  }

  const handleCreateCustomer = async () => {
    if (!selectedReferrer?.referralCode) {
      setCreateError('Search for and select the customer, business or cause that referred this person.')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const response = await fetch('/api/dashboard/customers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phoneNumber, refCode: selectedReferrer.referralCode }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'The customer could not be created.')
      setAddOpen(false)
      resetCreateForm()
      await load()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'The customer could not be created.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="View all customers, search, and log in as any of them to test their experience."
        actions={<Button onClick={() => { resetCreateForm(); setAddOpen(true) }}><Plus className="h-4 w-4" /> Add Customer</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, email, or phone..."
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
          <span className="ml-2 text-surface-500">Loading customers...</span>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No customers found"
          description={search || type !== 'all' ? 'No nodes match the current filters.' : 'No nodes exist yet.'}
        />
      ) : (
        // overflow-x-auto (not hidden) + a table min-width so narrow screens can
        // scroll horizontally to reach the action buttons (bug #23).
        <div className="overflow-x-auto rounded-xl border border-surface-200">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-surface-50 text-left text-xs uppercase tracking-wider text-surface-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium text-center">Direct</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {items.map((node) => {
                const meta = typeMeta(node.type)
                const location = [node.city, node.state].filter(Boolean).join(', ')
                return (
                  <tr key={`${node.type}-${node.accountId}`} className="bg-white transition-colors hover:bg-surface-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-surface-400">{meta.icon}</span>
                        <div className="min-w-0">
                          <Link
                            href={`/crm/contacts/${node.userId}`}
                            className="truncate font-medium text-surface-900 hover:text-brand-700 hover:underline"
                          >
                            {node.name || `Node ${node.accountId}`}
                          </Link>
                          {node.referralCode && (
                            <p className="truncate font-mono text-[11px] text-surface-400">{node.referralCode}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={meta.variant} dot>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-surface-600">
                        {node.email ? (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3.5 w-3.5 text-surface-400" />{node.email}
                          </span>
                        ) : null}
                        {node.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-surface-400" />{node.phone}
                          </span>
                        ) : null}
                        {!node.email && !node.phone ? <span className="text-surface-300">—</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {location ? (
                        <span className="flex items-center gap-1 text-surface-600">
                          <MapPin className="h-3.5 w-3.5 text-surface-400" />{location}
                        </span>
                      ) : <span className="text-surface-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-surface-600">{node.directReferralCount ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleOpenInApp(node)}
                          disabled={openingId === node.userId}
                          title={`Open my.localvip.com signed in as this ${meta.verb}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {openingId === node.userId ? 'Opening…' : 'Log in to webapp'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setLoginTarget(node); setLoginError(null) }}>
                          <LogIn className="h-3.5 w-3.5" />
                          Log in as {meta.verb}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex items-center justify-between text-sm text-surface-500">
          <span>
            {totalCount.toLocaleString()} total · page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!loginTarget} onOpenChange={(open) => { if (!open) setLoginTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Log in as {loginTarget ? typeMeta(loginTarget.type).verb : ''}
            </DialogTitle>
            <DialogDescription>
              Choose how to sign in as{' '}
              <span className="font-medium text-surface-900">{loginTarget?.name || loginTarget?.email}</span>:
              a read-only <strong>view-as overlay</strong> (a banner lets you return to admin anytime),
              or a <strong>real log in</strong> that swaps your dashboard session for a genuine one.
            </DialogDescription>
          </DialogHeader>
          {loginError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loginError}</div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLoginTarget(null)} disabled={loggingIn}>Cancel</Button>
            <Button variant="outline" onClick={() => void handleLoginAs()} disabled={loggingIn}>
              {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              View-as overlay
            </Button>
            <Button onClick={() => void handleRealLogin()} disabled={loggingIn}>
              {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Real log in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetCreateForm() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>
              Create the customer and place them under the person, business or cause that referred them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-surface-700">First name *<Input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" /></label>
              <label className="space-y-1.5 text-sm font-medium text-surface-700">Last name<Input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" /></label>
              <label className="space-y-1.5 text-sm font-medium text-surface-700">Email *<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
              <label className="space-y-1.5 text-sm font-medium text-surface-700">Phone<Input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} autoComplete="tel" /></label>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold text-surface-900">Who referred this customer? *</p>
                <p className="text-xs text-surface-500">Search customers, businesses and causes by name, email or phone.</p>
              </div>
              {selectedReferrer ? (
                <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-600 text-white"><Check className="h-4 w-4" /></span>
                    <div><p className="text-sm font-semibold text-success-900">{selectedReferrer.name}</p><p className="text-xs text-success-700">{typeMeta(selectedReferrer.type).label} selected as referrer</p></div>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedReferrer(null); setReferrerSearch('') }}>Change</Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-surface-400" />
                  <Input value={referrerSearch} onChange={(event) => setReferrerSearch(event.target.value)} placeholder="Start typing a name, business or cause..." className="pl-9" />
                  {referrerLoading ? <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-surface-400" /> : null}
                  {referrerError ? <div role="alert" className="mt-2 flex items-center gap-2 text-sm text-red-700"><span>{referrerError}</span><button type="button" className="underline" onClick={() => setReferrerRetry((retry) => retry + 1)}>Retry search</button></div> : !referrerLoading && referrerSearch.trim().length >= 2 && referrerResults.length === 0 ? <p role="status" className="mt-2 text-sm text-surface-500">No matching referrers. Try a name, email, phone number or referral code.</p> : null}
                  {referrerResults.length > 0 ? (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-surface-200 bg-white p-1 shadow-xl">
                      {referrerResults.map((node) => (
                        <button key={`${node.type}-${node.accountId}-${node.userId}`} type="button" disabled={!node.referralCode} onClick={() => { setSelectedReferrer(node); setReferrerResults([]) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50">
                          <span className="text-surface-500">{typeMeta(node.type).icon}</span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-surface-900">{node.name}</span><span className="block truncate text-xs text-surface-500">{typeMeta(node.type).label}{node.email ? ` · ${node.email}` : ''}</span></span>
                          {!node.referralCode ? <span className="text-[11px] text-warning-700">No referral code</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            {createError ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={() => void handleCreateCustomer()} disabled={creating || !firstName.trim() || !email.trim() || !selectedReferrer}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
