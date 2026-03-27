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
        <Card>
          <CardHeader>
            <CardTitle>What to do next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              'Keep your message simple and local.',
              'Share one clean QR or link instead of too many different paths.',
              'Watch which share assets get scans, then repeat what is already working.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

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
