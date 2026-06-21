'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Copy,
  Heart,
  QrCode,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { CommunitySupportQrCard } from '@/components/community/community-support-qr-card'
import { useAuth } from '@/lib/auth/context'
import { useCauses, useContacts, useQrCodes } from '@/lib/supabase/hooks'

export default function CommunityQrPage() {
  const { profile } = useAuth()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()

  const scopedCause = React.useMemo(
    () => causes.find(c => c.owner_id === profile.id || c.organization_id === profile.organization_id) || null,
    [causes, profile.id, profile.organization_id],
  )

  const supporterContacts = React.useMemo(
    () => contacts.filter(c => c.cause_id && c.cause_id === scopedCause?.id),
    [contacts, scopedCause?.id],
  )

  const { data: qrCodes } = useQrCodes({ cause_id: scopedCause?.id || '__none__' })
  const isSchool = scopedCause?.type === 'school'

  if (!scopedCause) {
    return <EmptyState icon={<QrCode className="h-8 w-8" />} title="No cause linked" description="QR codes will appear once a cause or school is linked to your account." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Codes & Links"
        description={`QR assets for ${scopedCause.name} — share with supporters, parents, and community`}
      />

      {/* Active context chip */}
      <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-2">
        <Heart className="h-4 w-4 text-brand-600" />
        <span className="text-sm font-medium text-brand-800">
          Showing QR for: {scopedCause.name}
        </span>
        <Badge variant="outline" className="ml-2">{isSchool ? 'School' : 'Cause'}</Badge>
      </div>

      {/* QR Card */}
      <CommunitySupportQrCard cause={scopedCause} totalSupporters={supporterContacts.length} />


      {/* Additional QR codes */}
      {qrCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {qrCodes.map(qr => (
                <div key={qr.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{qr.name}</p>
                      <p className="text-xs text-surface-500">{qr.scan_count} scan{qr.scan_count === 1 ? '' : 's'}</p>
                    </div>
                    <Badge variant={qr.status === 'active' ? 'success' : 'default'}>{qr.status}</Badge>
                  </div>
                  <div className="mt-2">
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(qr.redirect_url)}>
                      <Copy className="h-3.5 w-3.5" /> Copy link
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
