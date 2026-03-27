'use client'

import { QrCode } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { useQrCodes } from '@/lib/supabase/hooks'

export default function InfluencerLinksPage() {
  const { profile } = useAuth()
  const { data: qrCodes } = useQrCodes({ created_by: profile.id })
  const personalCodes = qrCodes.filter((code) => !code.business_id && !code.cause_id)

  return (
    <div className="space-y-8">
      <PageHeader title="My Links" description="The QR codes and short links currently attributed to your influencer account." />
      <Card>
        <CardHeader>
          <CardTitle>Share assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {personalCodes.length === 0 ? (
            <EmptyState icon={<QrCode className="h-8 w-8" />} title="No share assets yet" description="Once influencer links are created, they will appear here." />
          ) : personalCodes.map((code) => (
            <div key={code.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
              <p className="text-sm font-semibold text-surface-900">{code.name}</p>
              <p className="mt-1 text-xs text-surface-500">{code.short_code} / {code.scan_count} scans</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
