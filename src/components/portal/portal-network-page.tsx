'use client'

import * as React from 'react'
import { DollarSign, TrendingUp, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { BonusCashModel } from '@/lib/server/qa-mobile-api'

function useMobileApi<T>(url: string) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })
      .then((json) => { if (!cancelled) setData(json) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url])

  return { data, loading, error }
}

export function PortalNetworkPage() {
  const { data: friends, loading: friendsLoading } = useMobileApi<string[]>('/api/qa/mobile/friends')
  const { data: bonuscash, loading: bcLoading } = useMobileApi<BonusCashModel[]>('/api/qa/mobile/bonuscash')
  const { data: bonuscashLifetime, loading: bclLoading } = useMobileApi<number>('/api/qa/mobile/bonuscash?scope=lifetime')

  const loading = friendsLoading || bcLoading || bclLoading

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading your network...
        </div>
      </div>
    )
  }

  const friendCount = friends?.length ?? 0
  const lifetimeGains = typeof bonuscashLifetime === 'number' ? bonuscashLifetime : 0
  const totalBonusItems = bonuscash?.length ?? 0

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Network"
        description="Your friends and the bonus cash earned through your network."
        breadcrumb={[
          { label: 'Wallet', href: '/portal/wallet' },
          { label: 'Network' },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Friends</p>
                <p className="mt-2 text-3xl font-bold text-surface-900">{friendCount}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Lifetime Network Gains</p>
                <p className="mt-2 text-3xl font-bold text-surface-900">{formatCurrency(lifetimeGains)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Bonus Payments</p>
                <p className="mt-2 text-3xl font-bold text-surface-900">{totalBonusItems}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>My Friends</CardTitle>
          </CardHeader>
          <CardContent>
            {friendCount === 0 ? (
              <EmptyState
                icon={<UserPlus className="h-8 w-8" />}
                title="No friends yet"
                description="Invite friends to join your LocalVIP network and start earning bonus cash."
              />
            ) : (
              <div className="space-y-2">
                {friends!.map((friend, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-surface-100 bg-surface-50 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white">
                      {getInitials(friend)}
                    </div>
                    <p className="text-sm font-medium text-surface-900">{friend}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network Gains History</CardTitle>
          </CardHeader>
          <CardContent>
            {!bonuscash || bonuscash.length === 0 ? (
              <EmptyState
                icon={<TrendingUp className="h-8 w-8" />}
                title="No network gains yet"
                description="When your friends shop at LocalVIP businesses, you earn bonus cash."
              />
            ) : (
              <div className="space-y-2">
                {bonuscash.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-surface-100 bg-surface-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-900">Network Bonus</p>
                      <p className="text-xs text-surface-500">{formatShortDate(item.date)}</p>
                    </div>
                    <Badge variant="success">+{formatCurrency(item.amount)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}
