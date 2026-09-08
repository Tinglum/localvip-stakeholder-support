'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getStakeholderAccess } from '@/lib/stakeholder-access'
import CauseOnboardingPage from '@/components/onboarding/cause-onboarding-page'
import { CommunityDashboardPage } from '@/components/community/community-dashboard-page'

export default function CauseOnboardingRoute() {
  const { profile } = useAuth()
  const access = getStakeholderAccess(profile)
  const router = useRouter()
  const canOperateCausePipeline = ['admin', 'field', 'launch_partner'].includes(access.shell)

  React.useEffect(() => {
    if (access.shell !== 'community' && !canOperateCausePipeline) router.replace('/dashboard')
  }, [access.shell, canOperateCausePipeline, router])

  if (access.shell === 'community') {
    return <CommunityDashboardPage initialTab="onboarding" />
  }

  return canOperateCausePipeline ? <CauseOnboardingPage /> : null
}
