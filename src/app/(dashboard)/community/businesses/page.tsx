'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Megaphone,
  Store,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { useAuth } from '@/lib/auth/context'
import { useBusinesses, useCauses } from '@/lib/supabase/hooks'
import { ONBOARDING_STAGES } from '@/lib/constants'

export default function CommunityBusinessesPage() {
  const { profile } = useAuth()
  const { data: causes } = useCauses()
  const { data: businesses } = useBusinesses()

  const scopedCause = React.useMemo(
    () => causes.find(c => c.owner_id === profile.id || c.organization_id === profile.organization_id) || null,
    [causes, profile.id, profile.organization_id],
  )

  const supportingBusinesses = React.useMemo(
    () => businesses.filter(b => b.linked_cause_id === scopedCause?.id),
    [businesses, scopedCause?.id],
  )

  const isSchool = scopedCause?.type === 'school'

  if (!scopedCause) {
    return <EmptyState icon={<Store className="h-8 w-8" />} title="No cause linked" description="A cause or school must be linked to your account to see businesses." />
  }

  const liveCount = supportingBusinesses.filter(b => b.stage === 'live').length
  const inProgressCount = supportingBusinesses.filter(b => ['contacted', 'interested', 'in_progress'].includes(b.stage)).length
  const onboardedCount = supportingBusinesses.filter(b => b.stage === 'onboarded').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Pipeline"
        description={isSchool ? 'Businesses supporting your school fundraising' : 'Businesses supporting your cause'}
        actions={
          <Button asChild size="sm">
            <Link href="/community/materials">
              <Megaphone className="h-4 w-4" /> View outreach materials
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={supportingBusinesses.length} icon={<Store className="h-5 w-5" />} />
        <StatCard label="In Progress" value={inProgressCount} icon={<Store className="h-5 w-5" />} />
        <StatCard label="Onboarded" value={onboardedCount} icon={<Store className="h-5 w-5" />} />
        <StatCard label="Live" value={liveCount} icon={<Store className="h-5 w-5" />} />
      </div>

      {supportingBusinesses.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Store className="mx-auto mb-3 h-10 w-10 text-surface-300" />
              <h3 className="text-base font-semibold text-surface-800">Get your first business</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-surface-500">
                {isSchool
                  ? 'Start reaching out to local businesses your school families already visit. Use your share materials to make the ask easy.'
                  : 'Connect businesses that already care about your cause. Share your outreach materials to start the conversation.'}
              </p>
              <div className="mt-4">
                <Button asChild size="sm">
                  <Link href="/community/materials">
                    <Megaphone className="h-4 w-4" /> Open outreach materials
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {supportingBusinesses.map(biz => (
            <Card key={biz.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-surface-900">{biz.name}</p>
                      <Badge variant={biz.stage === 'live' ? 'success' : biz.stage === 'onboarded' ? 'info' : biz.stage === 'in_progress' ? 'warning' : 'default'}>
                        {ONBOARDING_STAGES[biz.stage]?.label || biz.stage}
                      </Badge>
                    </div>
                    <p className="text-xs text-surface-500">
                      {[biz.category, biz.address].filter(Boolean).join(' \u2022 ') || 'Local business'}
                    </p>
                    {(biz.email || biz.phone) && (
                      <p className="text-xs text-surface-400">{[biz.email, biz.phone].filter(Boolean).join(' / ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {biz.stage === 'live' ? (
                      <Badge variant="success" className="text-xs">Active &amp; Live</Badge>
                    ) : biz.stage === 'onboarded' ? (
                      <span className="text-xs text-surface-500">Ready for launch</span>
                    ) : (
                      <span className="text-xs text-surface-400">Needs movement</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
