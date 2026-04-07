'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Megaphone,
  Rocket,
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
import { COMMUNITY_BUSINESS_STATUS } from '@/lib/constants'

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
  const settingUpCount = supportingBusinesses.filter(b => ['contacted', 'interested', 'in_progress', 'onboarded'].includes(b.stage)).length
  const newCount = supportingBusinesses.filter(b => b.stage === 'lead').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supporting Businesses"
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
        <StatCard label="New" value={newCount} icon={<Rocket className="h-5 w-5" />} />
        <StatCard label="Setting Up" value={settingUpCount} icon={<ArrowRight className="h-5 w-5" />} />
        <StatCard label="Active" value={liveCount} icon={<CheckCircle2 className="h-5 w-5" />} />
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
          {supportingBusinesses.map(biz => {
            const status = COMMUNITY_BUSINESS_STATUS[biz.stage] || COMMUNITY_BUSINESS_STATUS.lead
            return (
              <Card key={biz.id} className="transition-shadow hover:shadow-card-hover">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-surface-900">{biz.name}</p>
                        <Badge variant={status.variant}>{status.label}</Badge>
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
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Live & earning
                        </span>
                      ) : biz.stage === 'onboarded' ? (
                        <span className="text-xs text-surface-500">Almost there</span>
                      ) : (
                        <span className="text-xs text-surface-400">In progress</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
