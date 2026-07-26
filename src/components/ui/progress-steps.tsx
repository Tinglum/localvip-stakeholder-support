'use client'

import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'

interface Step {
  label: string
  description?: string
  completed?: boolean
  current?: boolean
  onClick?: () => void
  actionLabel?: string
  actionVariant?: 'default' | 'danger' | 'success'
  actionPending?: boolean
  disabled?: boolean
}

interface ProgressStepsProps {
  steps: Step[]
  className?: string
  ariaLabel?: string
}

export function ProgressSteps({
  steps,
  className,
  ariaLabel = 'Lifecycle progress',
}: ProgressStepsProps) {
  return (
    <nav className={cn('overflow-x-auto', className)} aria-label={ariaLabel}>
      <ol className="flex min-w-[720px] items-stretch">
        {steps.map((step, idx) => {
          const interactive = Boolean(step.onClick) && !step.disabled
          const content = (
            <>
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  step.completed
                    ? 'border-success-500 bg-success-500 text-white'
                    : step.current
                      ? 'border-brand-600 bg-brand-600 text-white ring-4 ring-brand-100'
                      : 'border-surface-300 bg-surface-50 text-surface-500',
                )}
                aria-hidden="true"
              >
                {step.completed ? <Check className="h-4 w-4" /> : idx + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    'block whitespace-nowrap text-sm font-medium',
                    step.current
                      ? 'text-brand-700'
                      : step.completed
                        ? 'text-surface-800'
                        : 'text-surface-500',
                  )}
                >
                  {step.label}
                </span>
                {step.description ? (
                  <span className="mt-0.5 block whitespace-nowrap text-xs text-surface-500">
                    {step.description}
                  </span>
                ) : null}
                {step.actionLabel ? (
                  <span
                    className={cn(
                      'mt-1.5 inline-flex min-h-6 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
                      step.actionVariant === 'danger'
                        ? 'bg-red-600 text-white'
                        : step.actionVariant === 'success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-brand-100 text-brand-800',
                    )}
                  >
                    {step.actionPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {step.actionLabel}
                  </span>
                ) : null}
              </span>
            </>
          )

          return (
            <li
              key={step.label}
              className={cn(
                'relative flex min-w-0 items-center',
                idx < steps.length - 1 && 'flex-1',
              )}
            >
              {idx < steps.length - 1 ? (
                <span
                  className={cn(
                    'absolute left-8 right-0 top-1/2 h-px -translate-y-1/2',
                    step.completed ? 'bg-success-500' : 'bg-surface-200',
                  )}
                  aria-hidden="true"
                />
              ) : null}
              {interactive ? (
                <button
                  type="button"
                  onClick={step.onClick}
                  aria-current={step.current ? 'step' : undefined}
                  aria-label={`${step.label}${step.actionLabel ? `: ${step.actionLabel}` : ''}`}
                  className={cn(
                    'relative z-10 flex min-h-16 items-center gap-3 rounded-xl bg-surface-0 px-2 py-2 text-left transition-colors',
                    'hover:bg-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                  )}
                >
                  {content}
                </button>
              ) : (
                <div
                  aria-current={step.current ? 'step' : undefined}
                  className="relative z-10 flex min-h-16 items-center gap-3 bg-surface-0 px-2 py-2"
                >
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
