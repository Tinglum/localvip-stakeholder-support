'use client'

/**
 * GROW — every way a business adds people, in one tab.
 *
 * Absorbs the three old nav items:
 *   - My 100 List                  → "Customers" section
 *   - Grow with Other Businesses   → "Businesses & causes" section (the invite
 *                                     composer, which still handles all three
 *                                     invitee types: customer, business, cause)
 *   - My Network                   → "Network" section (read-only)
 *
 * The sections are tabs rather than one long scroll because each of the three
 * underlying views is heavy. `?section=` keeps every old deep link alive:
 * `/portal/clients` → `?section=customers`, `/portal/network` → `?section=network`.
 */

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HeartHandshake, Network, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { SurfaceLegend } from '@/components/business/business-surfaces'
import { BusinessMy100ListPage } from '@/components/business/business-my-100-list-page'
import { BusinessGrowPage } from '@/components/business/business-grow-page'
import { BusinessNetworkPage } from '@/components/business/business-network-page'
import { cn } from '@/lib/utils'

type SectionKey = 'customers' | 'partners' | 'network'

const SECTIONS: Array<{
  key: SectionKey
  label: string
  hint: string
  icon: React.ReactNode
  /** Neutral sections are read-only; accented ones add or change something. */
  tone: 'action' | 'info'
}> = [
  {
    key: 'customers',
    label: 'Customers',
    hint: 'Build and work your 100 list',
    icon: <Users className="h-4 w-4" />,
    tone: 'action',
  },
  {
    key: 'partners',
    label: 'Businesses & causes',
    hint: 'Invite partners, schools and causes',
    icon: <HeartHandshake className="h-4 w-4" />,
    tone: 'action',
  },
  {
    key: 'network',
    label: 'Network',
    hint: 'See who is connected to you',
    icon: <Network className="h-4 w-4" />,
    tone: 'info',
  },
]

function isSectionKey(value: string | null): value is SectionKey {
  return value === 'customers' || value === 'partners' || value === 'network'
}

export function BusinessGrowHubPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const requested = searchParams.get('section')
  const section: SectionKey = isSectionKey(requested) ? requested : 'customers'

  const selectSection = React.useCallback(
    (next: SectionKey) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('section', next)
      router.replace(`/portal/grow?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const active = SECTIONS.find((item) => item.key === section) || SECTIONS[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grow"
        description="Add customers, invite other local businesses, and bring in schools and causes. Everything that grows your network is here."
      />

      <SurfaceLegend />

      <div className="overflow-x-auto">
        <div role="tablist" aria-label="Grow sections" className="flex min-w-max gap-2">
          {SECTIONS.map((item) => {
            const selected = item.key === section
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`grow-tab-${item.key}`}
                aria-selected={selected}
                aria-controls="grow-panel"
                onClick={() => selectSection(item.key)}
                className={cn(
                  'flex min-w-[200px] flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                  selected
                    ? item.tone === 'action'
                      ? 'border-brand-300 bg-brand-50 shadow-sm'
                      : 'border-surface-300 bg-surface-100 shadow-sm'
                    : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={selected && item.tone === 'action' ? 'text-brand-600' : 'text-surface-400'}>
                    {item.icon}
                  </span>
                  <span className="text-sm font-semibold text-surface-900">{item.label}</span>
                  <span
                    className={cn(
                      'ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]',
                      item.tone === 'action' ? 'bg-brand-100 text-brand-800' : 'bg-surface-200 text-surface-600',
                    )}
                  >
                    {item.tone === 'action' ? 'Add' : 'View'}
                  </span>
                </span>
                <span className="text-xs leading-5 text-surface-500">{item.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div id="grow-panel" role="tabpanel" aria-labelledby={`grow-tab-${active.key}`}>
        {section === 'customers' ? <BusinessMy100ListPage embedded /> : null}
        {section === 'partners' ? <BusinessGrowPage embedded /> : null}
        {section === 'network' ? <BusinessNetworkPage embedded /> : null}
      </div>
    </div>
  )
}
