import { Suspense } from 'react'
import { CauseSetupPage } from '@/components/community/cause-setup-page'

export default function Page() {
  return (
    <Suspense fallback={<div role="status" className="animate-pulse p-8 text-sm text-surface-500">Loading your setup...</div>}>
      <CauseSetupPage />
    </Suspense>
  )
}
