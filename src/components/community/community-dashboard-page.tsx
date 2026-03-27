'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Heart, Megaphone, QrCode, Store, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { useAuth } from '@/lib/auth/context'
import { useBusinesses, useCauses, useContacts } from '@/lib/supabase/hooks'

export function CommunityDashboardPage() {
  const { profile, roleLabel } = useAuth()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()
  const { data: businesses } = useBusinesses()

  const scopedCause = React.useMemo(
    () => causes.find((cause) => cause.owner_id === profile.id || cause.organization_id === profile.organization_id) || null,
    [causes, profile.id, profile.organization_id]
  )

  const supporterContacts = React.useMemo(
    () => contacts.filter((contact) => contact.cause_id && contact.cause_id === scopedCause?.id),
    [contacts, scopedCause?.id]
  )

  const supportingBusinesses = React.useMemo(
    () => businesses.filter((business) => business.linked_cause_id === scopedCause?.id),
    [businesses, scopedCause?.id]
  )

  if (!scopedCause) {
    return (
      <EmptyState
        icon={<Heart className="h-8 w-8" />}
        title="Community dashboard coming online"
        description="Once a school or cause record is linked to this account, supporter growth and local business activity will show up here."
      />
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Support ${scopedCause.name}`}
        description={`Use this ${roleLabel.toLowerCase()} dashboard to grow supporters, share your QR, and keep the local story simple.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/community/share">
                Grow Your Supporters
                <Megaphone className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/community/supporters">
                Open supporters
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total supporters" value={supporterContacts.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Businesses supporting you" value={supportingBusinesses.length} icon={<Store className="h-5 w-5" />} />
        <StatCard label="QR ready" value="Yes" icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Funds generated" value="$0.00" icon={<Heart className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Grow Your Supporters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              'Share with parents and families who already care about your community.',
              'Use your QR at school events, church gatherings, or local meetings.',
              'Copy a short message into text groups and newsletters.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supporting Businesses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {supportingBusinesses.length === 0 ? (
              <p className="text-sm text-surface-500">No businesses are linked yet.</p>
            ) : (
              supportingBusinesses.slice(0, 6).map((business) => (
                <div key={business.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{business.name}</p>
                      <p className="mt-1 text-xs text-surface-500">{business.category || 'Local business'}</p>
                    </div>
                    <Badge variant={business.stage === 'live' ? 'success' : 'info'}>
                      {business.stage}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
