'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface Step {
  label: string
  description?: string
  completed?: boolean
  current?: boolean
}

interface ProgressStepsProps {
  steps: Step[]
  className?: string
}

export function ProgressSteps({ steps, className }: ProgressStepsProps) {
  return (
    <nav className={cn('flex', className)}>
      <ol className="flex w-full items-center">
        {steps.map((step, idx) => (
          <li key={idx} className={cn('flex items-center', idx < steps.length - 1 && 'flex-1')}>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  step.completed
                    ? 'bg-success-500 text-white'
                    : step.current
                    ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                    : 'bg-surface-200 text-surface-500'
                )}
              >
                {step.completed ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <div className="hidden sm:block">
                <p className={cn(
                  'text-sm font-medium',
                  step.current ? 'text-brand-700' : step.completed ? 'text-surface-700' : 'text-surface-400'
                )}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-surface-400">{step.description}</p>
                )}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn(
                'mx-4 h-px flex-1',
                step.completed ? 'bg-success-500' : 'bg-surface-200'
              )} />
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
