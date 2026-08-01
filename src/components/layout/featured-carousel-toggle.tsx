'use client'

/**
 * Featured carousel switch — topbar, admins only.
 * ──────────────────────────────────────────────
 * Sits immediately beside the system status pill so every platform-wide switch
 * lives in one obvious place.
 *
 * It writes through the same shared `useSystemStatus` state the maintenance
 * pill uses, which means the same optimistic-update-then-roll-back behaviour:
 * the switch flips instantly, and if the PUT is rejected it snaps back and
 * shows the reason rather than lying about what the consumer app is doing.
 *
 * Non-admins never render this at all — there is no read-only variant, because
 * only the operator has any use for it.
 */

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { GalleryHorizontalEnd, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SystemStatusState } from '@/lib/system-status'

const PILL_BASE =
  'inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-colors'

export function FeaturedCarouselToggle({
  status,
  unavailable,
  loading,
  saving,
  error,
  setFeaturedCarouselEnabled,
}: SystemStatusState) {
  // Same rule as the status pill: say nothing until the first read resolves,
  // and stay out of the way entirely when the flag can't be read.
  if (loading || unavailable) return null

  const on = status.featuredCarouselEnabled

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Featured carousel on the consumer app: ${on ? 'on' : 'off'}. Open the switch.`}
          className={cn(
            PILL_BASE,
            on
              ? 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'
              : 'border-warning-500/40 bg-warning-50 text-warning-700 hover:bg-warning-500/10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
          )}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <GalleryHorizontalEnd className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">Carousel {on ? 'on' : 'off'}</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-80 rounded-xl border border-surface-200 bg-white p-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-surface-800">
                Featured carousel on the consumer app
              </p>
              <p className="mt-1 text-xs leading-relaxed text-surface-500">
                Turning it off hides the featured businesses carousel on
                my.localvip.com immediately; the deals list is unaffected.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label="Featured carousel on the consumer app"
              disabled={saving}
              onClick={event => {
                // Keep the menu open so the operator sees the switch move and
                // any error land, instead of the panel vanishing mid-save.
                event.preventDefault()
                void setFeaturedCarouselEnabled(!on)
              }}
              className={cn(
                'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                on ? 'bg-success-500' : 'bg-surface-300',
                saving && 'cursor-wait opacity-70',
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                  on ? 'translate-x-[22px]' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-2 rounded-lg border border-danger-500/40 bg-danger-50 px-2 py-1 text-[11px] font-medium text-danger-700"
            >
              {error}
            </p>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
