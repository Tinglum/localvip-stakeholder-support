'use client'

import * as React from 'react'
import { getCauseQaAccountId, resolveCommunityCause } from '@/lib/community-cause'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import type { Cause, Profile } from '@/lib/types/database'

export function useSelectedCause(profile: Profile, causes: Cause[], requestedId: string | null) {
  const [authorizedId, setAuthorizedId] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!requestedId || getStakeholderShell(profile) !== 'community') return
    const controller = new AbortController()
    setAuthorizedId(null)
    void fetch(`/api/crm/causes/${requestedId}/flyer`, { signal: controller.signal, cache: 'no-store' })
      .then(response => { if (response.ok) setAuthorizedId(requestedId) }).catch(() => {})
    return () => controller.abort()
  }, [profile, requestedId])
  const own = resolveCommunityCause(profile, causes)
  if (!requestedId) return own
  if (getStakeholderShell(profile) !== 'community' || authorizedId === requestedId || getCauseQaAccountId(own) === requestedId) return causes.find(cause => getCauseQaAccountId(cause) === requestedId) || null
  return null
}
