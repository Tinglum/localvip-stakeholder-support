'use client'

import * as React from 'react'
import { Copy, Megaphone } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { getCommunitySupportMessage } from '@/lib/community-support'
import { useCauses, useContacts } from '@/lib/supabase/hooks'
import { CommunitySupportQrCard } from '@/components/community/community-support-qr-card'

export default function CommunitySharePage() {
  const { profile, roleLabel } = useAuth()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()
  const cause = causes.find((item) => item.owner_id === profile.id || item.organization_id === profile.organization_id) || null
  const supporters = contacts.filter((contact) => contact.cause_id === cause?.id)
  const message = cause ? getCommunitySupportMessage(cause) : ''

  if (!cause) {
    return (
      <EmptyState
        icon={<Megaphone className="h-8 w-8" />}
        title="Community sharing will show up here"
        description="A school or cause record needs to be linked to this account before supporter sharing can begin."
      />
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Grow Your Supporters"
        description={`Use this ${roleLabel.toLowerCase()} page to give parents, families, and local supporters one simple link to rally around.`}
      />

      <CommunitySupportQrCard cause={cause} totalSupporters={supporters.length} />

      <Card>
        <CardHeader>
          <CardTitle>Copy message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4 text-sm leading-6 text-surface-700">{message}</div>
          <Button variant="outline" onClick={() => void navigator.clipboard.writeText(message)}>
            <Copy className="h-4 w-4" />
            Copy message
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
