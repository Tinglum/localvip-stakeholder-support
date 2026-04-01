'use client'

import * as React from 'react'
import {
  Heart,
  QrCode,
  Store,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { useAuth } from '@/lib/auth/context'
import { useBusinesses, useCauses, useContacts, useQrCodes, useStakeholders } from '@/lib/supabase/hooks'
import { formatDate } from '@/lib/utils'

export default function CommunityActivityPage() {
  const { profile } = useAuth()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()
  const { data: businesses } = useBusinesses()

  const scopedCause = React.useMemo(
    () => causes.find(c => c.owner_id === profile.id || c.organization_id === profile.organization_id) || null,
    [causes, profile.id, profile.organization_id],
  )

  const supporterContacts = React.useMemo(
    () => contacts.filter(c => c.cause_id && c.cause_id === scopedCause?.id),
    [contacts, scopedCause?.id],
  )

  const supportingBusinesses = React.useMemo(
    () => businesses.filter(b => b.linked_cause_id === scopedCause?.id),
    [businesses, scopedCause?.id],
  )

  const { data: qrCodes } = useQrCodes({ cause_id: scopedCause?.id || '__none__' })

  if (!scopedCause) {
    return <EmptyState icon={<Heart className="h-8 w-8" />} title="No cause linked" description="Activity will appear once a cause is linked." />
  }

  const isSchool = scopedCause.type === 'school'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity & Engagement"
        description={`Track supporter growth and engagement for ${scopedCause.name}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total supporters" value={supporterContacts.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Supporting businesses" value={supportingBusinesses.length} icon={<Store className="h-5 w-5" />} />
        <StatCard label="QR scans" value={qrCodes.reduce((sum, qr) => sum + (qr.scan_count || 0), 0)} icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Active QR codes" value={qrCodes.length} icon={<QrCode className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Supporters</CardTitle>
        </CardHeader>
        <CardContent>
          {supporterContacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-surface-400">
              No supporters yet. Share your QR code to start growing.
            </p>
          ) : (
            <div className="space-y-2">
              {supporterContacts.slice(0, 20).map(contact => (
                <div key={contact.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-50">
                  <div>
                    <p className="text-sm font-medium text-surface-800">{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Supporter'}</p>
                    <p className="text-xs text-surface-400">{contact.email || contact.phone || 'No contact info'}</p>
                  </div>
                  <p className="text-xs text-surface-400">{formatDate(contact.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {supportingBusinesses.length === 0 ? (
            <p className="py-4 text-center text-sm text-surface-400">No business activity yet.</p>
          ) : (
            <div className="space-y-2">
              {supportingBusinesses.map(biz => (
                <div key={biz.id} className="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-surface-900">{biz.name}</p>
                    <p className="text-xs text-surface-500">{biz.category || 'Local business'}</p>
                  </div>
                  <span className="text-xs text-surface-400">{biz.stage}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
