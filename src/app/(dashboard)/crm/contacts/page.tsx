'use client'

import * as React from 'react'
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
  ChevronLeft,
  ChevronRight,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="View all customers, search, and log in as any of them to test their experience."
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
        <div className="overflow-hidden rounded-xl border border-surface-200">
          <table className="w-full text-sm">
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
                          <p className="truncate font-medium text-surface-900">{node.name || `Node ${node.accountId}`}</p>
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
                      <Button size="sm" variant="outline" onClick={() => { setLoginTarget(node); setLoginError(null) }}>
                        <LogIn className="h-3.5 w-3.5" />
                        Log in as {meta.verb}
                      </Button>
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
              You will enter an impersonated session as{' '}
              <span className="font-medium text-surface-900">{loginTarget?.name || loginTarget?.email}</span>.
              A banner at the top lets you return to your admin account at any time.
            </DialogDescription>
          </DialogHeader>
          {loginError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loginError}</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginTarget(null)} disabled={loggingIn}>Cancel</Button>
            <Button onClick={() => void handleLoginAs()} disabled={loggingIn}>
              {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Enter session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
