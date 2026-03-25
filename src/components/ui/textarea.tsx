import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <div className="w-full">
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border bg-surface-0 px-3 py-2 text-sm transition-colors',
          'placeholder:text-surface-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-danger-500' : 'border-surface-300 hover:border-surface-400',
          className
        )}
        ref={ref}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

export { Textarea }
