'use client'

import { useAuth } from '@/lib/auth/context'
import { getStakeholderAccess } from '@/lib/stakeholder-access'
import CauseOnboardingPage from '@/components/onboarding/cause-onboarding-page'
import { CommunityDashboardPage } from '@/components/community/community-dashboard-page'

export default function CauseOnboardingRoute() {
  const { profile } = useAuth()
  const access = getStakeholderAccess(profile)

  if (access.shell === 'community') {
    return <CommunityDashboardPage initialTab="onboarding" />
  }

  return <CauseOnboardingPage />
}
