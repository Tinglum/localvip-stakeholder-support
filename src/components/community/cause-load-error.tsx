'use client'

import { Button } from '@/components/ui/button'

export function CauseLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-6">
      <p className="text-sm text-red-800">We could not load your cause information. Please try again.</p>
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  )
}
