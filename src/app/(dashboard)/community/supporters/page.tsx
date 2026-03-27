'use client'

import * as React from 'react'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { getContactDisplayName, getContactPrimaryChannel } from '@/lib/business-portal'
import { useCauses, useContacts } from '@/lib/supabase/hooks'

export default function CommunitySupportersPage() {
  const { profile } = useAuth()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()
  const cause = causes.find((item) => item.owner_id === profile.id || item.organization_id === profile.organization_id) || null
  const supporters = contacts.filter((contact) => contact.cause_id === cause?.id)

  return (
    <div className="space-y-8">
      <PageHeader title="Supporters" description="The people who have joined to support your school or cause." />
      <Card>
        <CardHeader>
          <CardTitle>Supporter list</CardTitle>
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
    </div>
  )
}
