'use client'

import * as React from 'react'
import { Copy, FileText, Megaphone, QrCode, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { useAuth } from '@/lib/auth/context'
import { getContactDisplayName, getContactPrimaryChannel } from '@/lib/business-portal'
import { useCauses, useContacts, useQrCodes } from '@/lib/supabase/hooks'
import { getCommunitySupportMessage, resolveCommunityCause } from '@/lib/community-support'
import { CommunityMaterialGallery } from '@/components/community/community-material-gallery'

export default function CommunitySupportersPage() {
  const { profile } = useAuth()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()
  const cause = React.useMemo(() => resolveCommunityCause(causes, profile), [causes, profile])
  const supporters = contacts.filter((contact) => contact.cause_id === cause?.id)
  const { data: qrCodes } = useQrCodes({ cause_id: cause?.id || '__none__' }, { enabled: !!cause })
  const [copied, setCopied] = React.useState(false)
  const rallyMessage = cause ? getCommunitySupportMessage(cause) : ''
  const totalScans = qrCodes.reduce((sum, qr) => sum + (qr.scan_count || 0), 0)

  async function copyRallyMessage() {
    if (!rallyMessage) return
    await navigator.clipboard.writeText(rallyMessage)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Supporters" description="Rally your community, share supporter flyers, and track the people who join you." />

      <div id="activity" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Supporters" value={supporters.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="QR scans" value={totalScans} icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Active QR codes" value={qrCodes.length} icon={<QrCode className="h-5 w-5" />} />
      </div>

      <Card id="rally" className="scroll-mt-24 border-brand-200 bg-gradient-to-br from-brand-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-brand-600" /> Rally your supporters</CardTitle>
          <p className="text-sm text-surface-600">Use this message with the supporter flyers below to invite parents, families, alumni, and fans.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-brand-100 bg-white p-4 text-sm leading-6 text-surface-700">{rallyMessage}</div>
          <Button onClick={() => void copyRallyMessage()} disabled={!rallyMessage}><Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy rally message'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-brand-600" /> Supporter list</CardTitle>
          <p className="text-sm text-surface-500">Everyone who has joined to support your school or cause.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {supporters.length === 0 ? (
            <EmptyState icon={<Users className="h-8 w-8" />} title="No supporters yet" description="Supporters will appear here once your public share flow is used." />
          ) : supporters.map((contact) => (
            <div key={contact.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
              <p className="text-sm font-semibold text-surface-900">{getContactDisplayName(contact)}</p>
              <p className="mt-1 text-xs text-surface-500">{getContactPrimaryChannel(contact)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card id="materials" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-brand-600" /> Supporter flyers & materials</CardTitle>
          <p className="text-sm text-surface-500">Approved materials designed to grow family and community support.</p>
        </CardHeader>
        <CardContent><CommunityMaterialGallery audience="supporter" /></CardContent>
      </Card>
    </div>
  )
}
