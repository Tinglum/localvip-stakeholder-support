'use client'

/**
 * MATERIALS — QR and printable assets in one tab.
 *
 * Absorbs the old "Materials" and "Template Library" nav items.
 *
 * NOTE: this is a business-only wrapper mounted at `/portal/materials`. It
 * composes the shared `MyMaterialsPage` (also used by admin, field and
 * influencer at `/materials/mine`) without modifying it, so no other role is
 * affected by this restructure.
 */

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, FileDown, LayoutTemplate } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { MyMaterialsView } from '@/components/materials/my-materials-page'
import { TemplateLibraryPage } from '@/components/portal/template-library-page'
import { cn } from '@/lib/utils'

type TabKey = 'mine' | 'templates'

const TABS: Array<{ key: TabKey; label: string; hint: string; icon: React.ReactNode }> = [
  { key: 'mine', label: 'My materials', hint: 'Your QR code and saved files', icon: <FileDown className="h-4 w-4" /> },
  {
    key: 'templates',
    label: 'Template library',
    hint: 'Generate printable assets',
    icon: <LayoutTemplate className="h-4 w-4" />,
  },
]

function isTabKey(value: string | null): value is TabKey {
  return value === 'mine' || value === 'templates'
}

export function BusinessMaterialsHubPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const requested = searchParams.get('tab')
  const tab: TabKey = isTabKey(requested) ? requested : 'mine'
  // Set by the generate dialog. Arriving in a list of files with no idea which
  // one you just made is why generating felt like it had done nothing.
  const justGenerated = searchParams.get('generated') === '1'

  const selectTab = React.useCallback(
    (next: TabKey) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next)
      router.replace(`/portal/materials?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Your QR code, printable assets, and the templates you can generate them from."
      />

      <div className="overflow-x-auto">
        <div role="tablist" aria-label="Materials sections" className="flex min-w-max gap-2">
          {TABS.map((item) => {
            const selected = item.key === tab
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`materials-tab-${item.key}`}
                aria-selected={selected}
                aria-controls="materials-panel"
                onClick={() => selectTab(item.key)}
                className={cn(
                  'flex min-w-[200px] flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                  selected
                    ? 'border-brand-300 bg-brand-50 shadow-sm'
                    : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={selected ? 'text-brand-600' : 'text-surface-400'}>{item.icon}</span>
                  <span className="text-sm font-semibold text-surface-900">{item.label}</span>
                </span>
                <span className="text-xs leading-5 text-surface-500">{item.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      {justGenerated ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success-200 bg-success-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" />
          <div className="text-sm">
            <p className="font-semibold text-success-700">Your material is ready</p>
            <p className="mt-0.5 text-success-700">
              It is at the top of the list below, newest first. Use Download to save it, or
              Preview to check it before you print.
            </p>
          </div>
        </div>
      ) : null}

      <div id="materials-panel" role="tabpanel" aria-labelledby={`materials-tab-${tab}`}>
        {tab === 'mine' ? <MyMaterialsView embedded /> : <TemplateLibraryPage embedded />}
      </div>
    </div>
  )
}
