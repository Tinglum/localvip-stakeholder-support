'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Store, ArrowRight, Clock, User, Calendar, Plus, Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useBusinesses, useBusinessUpdate } from '@/lib/supabase/hooks'
import type { Business, OnboardingStage } from '@/lib/types/database'

const STAGE_ORDER: OnboardingStage[] = ['lead', 'contacted', 'interested', 'in_progress', 'onboarded', 'live']

function getStageBadgeVariant(stage: string) {
  switch (stage) {
    case 'lead': return 'default' as const
    case 'contacted': case 'interested': return 'info' as const
    case 'in_progress': return 'warning' as const
    case 'onboarded': case 'live': return 'success' as const
    case 'paused': return 'warning' as const
    case 'declined': return 'danger' as const
    default: return 'default' as const
  }
}

// ─── Stage change menu ────────────────────────────────────────

function StageChanger({
  business,
  onStageChanged,
}: {
  business: Business
  onStageChanged: () => void
}) {
  const { update, loading } = useBusinessUpdate()
  const [open, setOpen] = React.useState(false)

  async function handleStageChange(newStage: OnboardingStage) {
    await update(business.id, { stage: newStage })
    setOpen(false)
    onStageChanged()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-0 px-2.5 py-1 text-xs font-medium text-surface-600 hover:bg-surface-50 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Move Stage
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-surface-200 bg-surface-0 py-1 shadow-lg">
            {STAGE_ORDER.map(stage => (
              <button
                key={stage}
                onClick={() => handleStageChange(stage)}
                disabled={stage === business.stage}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                  stage === business.stage
                    ? 'bg-surface-50 text-surface-400 cursor-default'
                    : 'hover:bg-surface-50 text-surface-700'
                }`}
              >
                <Badge variant={getStageBadgeVariant(stage)} dot className="pointer-events-none">
                  {ONBOARDING_STAGES[stage]?.label}
                </Badge>
                {stage === business.stage && <span className="ml-auto text-surface-400">(current)</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export default function BusinessOnboardingPage() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const { data: businesses, loading, error, refetch } = useBusinesses()
  const [view, setView] = React.useState<'pipeline' | 'list'>('pipeline')

  // Group by stage
  const grouped = React.useMemo(() => {
    const map: Record<string, Business[]> = {}
    for (const stage of STAGE_ORDER) map[stage] = []
    for (const biz of businesses) {
      const key = STAGE_ORDER.includes(biz.stage) ? biz.stage : 'lead'
      map[key] = map[key] || []
      map[key].push(biz)
    }
    return map
  }, [businesses])

  // Pipeline counts
  const stageCounts = React.useMemo(() => {
    return STAGE_ORDER.reduce((acc, stage) => {
      acc[stage] = grouped[stage]?.length || 0
      return acc
    }, {} as Record<string, number>)
  }, [grouped])

  return (
    <div>
      <PageHeader
        title="Business Onboarding"
        description="Track every business from first contact to going live."
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-surface-200 overflow-hidden">
              <button
                onClick={() => setView('pipeline')}
                className={`px-3 py-1.5 text-xs font-medium ${view === 'pipeline' ? 'bg-surface-100 text-surface-700' : 'text-surface-400'}`}
              >
                Pipeline
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-xs font-medium ${view === 'list' ? 'bg-surface-100 text-surface-700' : 'text-surface-400'}`}
              >
                List
              </button>
            </div>
            <Button onClick={() => router.push('/crm/businesses?action=new')}>
              <Plus className="h-4 w-4" /> Add Business
            </Button>
          </div>
        }
      />

      {/* Pipeline stage summary */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STAGE_ORDER.map(stage => (
          <div
            key={stage}
            className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 px-3 py-2"
          >
            <Badge variant={getStageBadgeVariant(stage)} dot>
              {ONBOARDING_STAGES[stage]?.label || stage}
            </Badge>
            <span className="text-sm font-semibold text-surface-700">{stageCounts[stage] || 0}</span>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-4 space-y-3">
                <div className="h-5 w-1/3 rounded bg-surface-100" />
                <div className="h-3 w-1/2 rounded bg-surface-50" />
                <div className="h-3 w-1/4 rounded bg-surface-50" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : businesses.length === 0 ? (
        <EmptyState
          icon={<Store className="h-8 w-8" />}
          title="No businesses yet"
          description="Add your first business to start tracking the onboarding pipeline."
          action={{ label: 'Add Business', onClick: () => router.push('/crm/businesses?action=new') }}
        />
      ) : view === 'pipeline' ? (
        /* Pipeline view: grouped by stage */
        <div className="space-y-8">
          {STAGE_ORDER.map(stage => {
            const items = grouped[stage]
            if (!items || items.length === 0) return null
            return (
              <div key={stage}>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant={getStageBadgeVariant(stage)} dot>
                    {ONBOARDING_STAGES[stage]?.label}
                  </Badge>
                  <span className="text-xs text-surface-400">({items.length})</span>
                </div>
                <div className="space-y-3">
                  {items.map(biz => (
                    <Card key={biz.id} className="transition-shadow hover:shadow-card-hover cursor-pointer" onClick={() => router.push(`/crm/businesses/${biz.id}`)}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-base font-semibold text-surface-900">{biz.name}</h3>
                              <Badge variant={getStageBadgeVariant(biz.stage)} dot>
                                {ONBOARDING_STAGES[biz.stage]?.label}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
                              {biz.category && (
                                <span className="flex items-center gap-1">
                                  <Store className="h-3.5 w-3.5" /> {biz.category}
                                </span>
                              )}
                              {biz.email && (
                                <span>{biz.email}</span>
                              )}
                              {biz.phone && (
                                <span>{biz.phone}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" /> Added {formatDate(biz.created_at)}
                              </span>
                            </div>
                            {biz.address && (
                              <p className="mt-1 text-xs text-surface-400">{biz.address}</p>
                            )}
                          </div>
                          <StageChanger business={biz} onStageChanged={refetch} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List view: flat */
        <div className="space-y-3">
          {businesses.map(biz => (
            <Card key={biz.id} className="transition-shadow hover:shadow-card-hover cursor-pointer" onClick={() => router.push(`/crm/businesses/${biz.id}`)}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-surface-400">
                  <Store className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-surface-800 truncate">{biz.name}</h3>
                    <Badge variant={getStageBadgeVariant(biz.stage)} dot className="shrink-0">
                      {ONBOARDING_STAGES[biz.stage]?.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-500 truncate">
                    {[biz.category, biz.email, biz.phone].filter(Boolean).join(' | ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-surface-400">
                  <span>{formatDate(biz.created_at)}</span>
                </div>
                <StageChanger business={biz} onStageChanged={refetch} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
