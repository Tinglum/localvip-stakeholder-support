'use client'

import * as React from 'react'
import { Heart, Sparkles, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

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

interface SocialImpactData {
  totalAmount?: number
  totalTransactions?: number
  [key: string]: unknown
}

export function PortalContributionsPage() {
  const { data: socialImpact, loading: siLoading } = useMobileApi<SocialImpactData>('/api/qa/mobile/social-impact')
  const { data: friendsImpact, loading: fiLoading } = useMobileApi<SocialImpactData>('/api/qa/mobile/social-impact?scope=friends')
  const { data: causes, loading: causesLoading } = useMobileApi<string[]>('/api/qa/mobile/causes')

  const loading = siLoading || fiLoading || causesLoading

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading your contributions...
        </div>
      </div>
    )
  }

  const myImpactAmount = extractAmount(socialImpact)
  const friendsImpactAmount = extractAmount(friendsImpact)
  const causesList = causes ?? []

  return (
    <div className="space-y-8">
      <PageHeader
        title="Charitable Contributions"
        description="Your social impact and the causes you help support through LocalVIP."
        breadcrumb={[
          { label: 'Wallet', href: '/portal/wallet' },
          { label: 'Contributions' },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">My Impact</p>
                <p className="mt-2 text-3xl font-bold text-surface-900">
                  {myImpactAmount !== null ? formatCurrency(myImpactAmount) : renderRawImpact(socialImpact)}
                </p>
              </div>
              <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                <Heart className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Friends&apos; Impact</p>
                <p className="mt-2 text-3xl font-bold text-surface-900">
                  {friendsImpactAmount !== null ? formatCurrency(friendsImpactAmount) : renderRawImpact(friendsImpact)}
                </p>
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
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Causes Supported</p>
                <p className="mt-2 text-3xl font-bold text-surface-900">{causesList.length}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Social Impact</CardTitle>
          </CardHeader>
          <CardContent>
            {!socialImpact ? (
              <EmptyState
                icon={<Heart className="h-8 w-8" />}
                title="No impact data yet"
                description="Shop at LocalVIP businesses to start contributing to local causes."
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-6">
                  <div className="flex items-center gap-2 text-rose-700">
                    <Heart className="h-5 w-5" />
                    <p className="text-sm font-semibold">Your Contributions</p>
                  </div>
                  <p className="mt-3 text-lg text-surface-700">
                    Every purchase you make contributes to local schools and causes in your community.
                  </p>
                  {socialImpact && typeof socialImpact === 'object' && (
                    <div className="mt-4 space-y-2">
                      {Object.entries(socialImpact).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="capitalize text-surface-600">{formatKey(key)}</span>
                          <span className="font-medium text-surface-900">
                            {typeof value === 'number' ? formatCurrency(value) : String(value ?? '—')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {friendsImpact && typeof friendsImpact === 'object' && (
                  <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6">
                    <div className="flex items-center gap-2 text-indigo-700">
                      <Users className="h-5 w-5" />
                      <p className="text-sm font-semibold">Friends&apos; Contributions</p>
                    </div>
                    <div className="mt-4 space-y-2">
                      {Object.entries(friendsImpact).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="capitalize text-surface-600">{formatKey(key)}</span>
                          <span className="font-medium text-surface-900">
                            {typeof value === 'number' ? formatCurrency(value) : String(value ?? '—')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Causes You Support</CardTitle>
          </CardHeader>
          <CardContent>
            {causesList.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="h-8 w-8" />}
                title="No causes yet"
                description="Your supported causes will appear here."
              />
            ) : (
              <div className="space-y-2">
                {causesList.map((cause, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-surface-100 bg-surface-50 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-sm font-semibold text-white">
                      {idx + 1}
                    </div>
                    <p className="text-sm font-medium text-surface-900">{cause}</p>
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

function extractAmount(data: unknown): number | null {
  if (typeof data === 'number') return data
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (typeof record.totalAmount === 'number') return record.totalAmount
    if (typeof record.amount === 'number') return record.amount
  }
  return null
}

function renderRawImpact(data: unknown): string {
  if (data === null || data === undefined) return '—'
  if (typeof data === 'number') return formatCurrency(data)
  if (typeof data === 'string') return data || '—'
  return '—'
}

function formatKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim()
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
