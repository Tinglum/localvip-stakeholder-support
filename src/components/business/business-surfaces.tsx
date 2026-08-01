'use client'

/**
 * THE TWO SURFACE TREATMENTS FOR THE BUSINESS PORTAL.
 *
 * Every card in the business portal is one of exactly two things, and the
 * owner should be able to tell which at a glance without reading a word:
 *
 *  - `InfoSection`     — NEUTRAL. Read-only information. White surface, plain
 *                        surface-200 hairline, no accent rail. Nothing inside
 *                        it ever changes data. Links out are fine.
 *  - `ActionSection`   — ACCENTED. Something to edit, choose, or submit. A
 *                        3px brand rail down the left edge, brand-tinted
 *                        header, and a status pill that reads "Editable" or,
 *                        when a requirement is unmet, "Needs your input" in
 *                        amber.
 *
 * Keep using these two. If a new card doesn't fit either, it is probably two
 * cards.
 */

import * as React from 'react'
import { Pencil, Info, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SectionProps {
  title: string
  description?: React.ReactNode
  /** Rendered at the right edge of the section header. */
  actions?: React.ReactNode
  id?: string
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

/** NEUTRAL treatment — information to know. Nothing here writes data. */
export function InfoSection({
  title,
  description,
  actions,
  id,
  className,
  bodyClassName,
  children,
}: SectionProps) {
  return (
    <Card id={id} className={cn('overflow-hidden border-surface-200', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Info aria-hidden="true" className="h-4 w-4 shrink-0 text-surface-400" />
            <h2 className="text-subheading text-surface-900">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-surface-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

interface ActionSectionProps extends SectionProps {
  /**
   * False when this section still has a requirement the owner has not met.
   * Flips the pill to the amber "Needs your input" state.
   */
  complete?: boolean
  /** Overrides the pill text. */
  statusLabel?: string
}

/** ACCENTED treatment — the owner can change something here. */
export function ActionSection({
  title,
  description,
  actions,
  id,
  className,
  bodyClassName,
  complete = true,
  statusLabel,
  children,
}: ActionSectionProps) {
  return (
    <Card
      id={id}
      className={cn(
        'relative overflow-hidden pl-[3px]',
        complete ? 'border-brand-200' : 'border-amber-300',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-[3px]',
          complete ? 'bg-brand-500' : 'bg-amber-500',
        )}
      />
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4',
          complete ? 'border-brand-100 bg-brand-50/60' : 'border-amber-100 bg-amber-50/70',
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {complete ? (
              <Pencil aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-600" />
            ) : (
              <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600" />
            )}
            <h2 className="text-subheading text-surface-900">{title}</h2>
            <SurfacePill complete={complete}>
              {statusLabel || (complete ? 'Editable' : 'Needs your input')}
            </SurfacePill>
          </div>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-surface-600">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

function SurfacePill({ complete, children }: { complete: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]',
        complete ? 'bg-brand-100 text-brand-800' : 'bg-amber-200 text-amber-900',
      )}
    >
      {children}
    </span>
  )
}

/**
 * The one-line key that teaches the two treatments. Rendered once near the top
 * of Home and My Business so the vocabulary is explicit, not just implied.
 */
export function SurfaceLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-xs text-surface-600',
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-surface-300 bg-white" />
        Plain card = information to know
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-brand-200 bg-brand-50 shadow-[inset_3px_0_0_0_theme(colors.brand.500)]" />
        Coloured edge = you can edit or add something
      </span>
    </div>
  )
}

/** A neutral read-only statistic. Optionally a link, never an editor. */
export function InfoStat({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
          <p className="mt-2 truncate text-3xl font-bold text-surface-900">{value}</p>
        </div>
        {icon ? <span className="rounded-2xl bg-surface-100 p-3 text-surface-600">{icon}</span> : null}
      </div>
      {hint ? <p className="mt-3 text-sm text-surface-500">{hint}</p> : null}
    </div>
  )
}
