'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, BarChart3, Megaphone, QrCode, ScanLine, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { StakeholderActionQueue } from '@/components/dashboard/stakeholder-action-queue'
import { useAuth } from '@/lib/auth/context'
import { useQrCodes } from '@/lib/supabase/hooks'

export function InfluencerDashboardPage() {
  const { profile } = useAuth()
  const { data: qrCodes } = useQrCodes({ created_by: profile.id })

  const personalCodes = React.useMemo(
    () => qrCodes.filter((code) => !code.business_id && !code.cause_id),
    [qrCodes]
  )

  const scanCount = personalCodes.reduce((sum, code) => sum + code.scan_count, 0)
  const topCode = [...personalCodes].sort((left, right) => right.scan_count - left.scan_count).at(0) || null
  const immediateItems = React.useMemo(() => {
    const items = []

    if (personalCodes.length === 0) {
      items.push({
        id: 'influencer-link',
        title: 'Create your first share link',
        detail: 'You need at least one clean referral asset before you can start driving signups or scans.',
        href: '/influencer/share',
        ctaLabel: 'Create share asset',
        priority: 'high' as const,
        badge: 'Referral setup',
      })
    }

    if (personalCodes.length > 0 && scanCount === 0) {
      items.push({
        id: 'influencer-scans',
        title: 'Get your first scans',
        detail: 'Put your best link in front of real people and watch for the first signal that the message is working.',
        href: '/influencer/links',
        ctaLabel: 'Open my links',
        priority: 'high' as const,
        badge: `${personalCodes.length} live links`,
      })
    }

    if (personalCodes.length > 0 && scanCount > 0 && personalCodes.length < 3) {
      items.push({
        id: 'influencer-variants',
        title: 'Create another share angle',
        detail: 'One good link is not enough. Build another asset for a different audience or context.',
        href: '/influencer/share',
        ctaLabel: 'Add another link',
        priority: 'medium' as const,
        badge: 'Scale what works',
      })
    }

    return items
  }, [personalCodes.length, scanCount])
  const suggestedItems = React.useMemo(
    () => [
      {
        id: 'influencer-suggestion-repeat',
        title: topCode ? `Repeat what works for ${topCode.name}` : 'Repeat what is already working',
        detail: topCode
          ? 'Your highest-scan asset is the best clue for what message and format to use again.'
          : 'Keep the message simple, local, and consistent across the places you already show up.',
        href: '/influencer/links',
        ctaLabel: 'Review links',
      },
      {
        id: 'influencer-suggestion-share',
        title: 'Share in one new place',
        detail: 'Post or send one clean referral path somewhere you have not tried yet.',
        href: '/influencer/share',
        ctaLabel: 'Open share tools',
      },
      {
        id: 'influencer-suggestion-materials',
        title: 'Use a stronger material',
        detail: 'Sometimes the next lift comes from a better flyer, poster, or visual instead of another text message.',
        href: '/materials/mine',
        ctaLabel: 'Open materials',
      },
    ],
    [topCode]
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="Referral Dashboard"
        description="Share LocalVIP in a simple way, track what gets scanned, and keep your personal referral activity visible."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/influencer/share">
                Share LocalVIP
                <Megaphone className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/influencer/links">
                Open my links
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Share links" value={personalCodes.length} icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Total scans" value={scanCount} icon={<ScanLine className="h-5 w-5" />} />
        <StatCard label="Attributed signups" value={0} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Conversion rate" value="0%" icon={<BarChart3 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <StakeholderActionQueue
          title="Immediate next steps"
          description="When there is something urgent to set up or prove, it lives here. Once it is clear, the dashboard shifts to the next three strongest growth moves."
          items={immediateItems}
          suggestions={suggestedItems}
        />

        <Card>
          <CardHeader>
            <CardTitle>Recent Share Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {personalCodes.length === 0 ? (
              <EmptyState
                icon={<QrCode className="h-6 w-6" />}
                title="No referral assets yet"
                description="Once influencer share links are created, they will appear here."
                className="py-10"
              />
            ) : (
              personalCodes.slice(0, 6).map((code) => (
                <div key={code.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{code.name}</p>
                      <p className="mt-1 text-xs text-surface-500">{code.short_code}</p>
                    </div>
                    <Badge variant="info">{code.scan_count} scans</Badge>
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
