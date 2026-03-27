'use client'

import * as React from 'react'
import { Copy, Mail, MessageSquare, Plus, SendHorizontal, Share2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { resolveScopedBusiness } from '@/lib/business-portal'
import { useBusinesses, useBusinessReferralInsert, useBusinessReferrals, useCities } from '@/lib/supabase/hooks'

function buildInviteMessage(targetBusinessName: string, cityName: string) {
  return [
    `Hey ${targetBusinessName || 'there'},`,
    '',
    `We're part of something local that's helping bring in more customers while also supporting schools here in ${cityName || 'our city'}.`,
    '',
    `It's been really simple to set up, and I think it could work really well for you too.`,
    '',
    'Want me to send you a quick overview?',
  ].join('\n')
}

export function BusinessGrowPage() {
  const { profile } = useAuth()
  const { data: cities } = useCities()
  const { data: businesses, loading } = useBusinesses(profile.business_id ? { id: profile.business_id } : { owner_id: profile.id })
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])
  const { data: referrals, refetch } = useBusinessReferrals({ source_business_id: business?.id || '__none__' })
  const { insert, loading: inserting } = useBusinessReferralInsert()

  const cityLabel = React.useMemo(() => {
    const city = cities.find((item) => item.id === business?.city_id)
    return city ? city.name : 'your city'
  }, [business?.city_id, cities])

  const [targetName, setTargetName] = React.useState('')
  const [targetContact, setTargetContact] = React.useState('')
  const [channel, setChannel] = React.useState<'sms' | 'email' | 'link_share'>('sms')
  const [notes, setNotes] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  const message = buildInviteMessage(targetName, cityLabel)

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          Loading growth tools...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Share2 className="h-8 w-8" />}
        title="Growth tools will show up here"
        description="A business needs to be linked to this account before nearby-business invites can be tracked."
      />
    )
  }

  const scopedBusiness = business

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function handleTrack() {
    const saved = await insert({
      source_business_id: scopedBusiness.id,
      created_by: profile.id,
      target_business_name: targetName || 'Unnamed business',
      target_city_id: scopedBusiness.city_id,
      target_category: null,
      target_contact_name: targetContact || null,
      target_contact_email: channel === 'email' ? targetContact || null : null,
      target_contact_phone: channel === 'sms' ? targetContact || null : null,
      channel,
      message_snapshot: message,
      status: 'sent',
      notes: notes || null,
      converted_business_id: null,
      metadata: { source: 'business_growth_portal' },
    })

    if (!saved) return

    setTargetName('')
    setTargetContact('')
    setNotes('')
    refetch()
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Grow with Other Businesses"
        description="Bring other great local businesses in and grow together."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Who to Invite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              'Businesses nearby',
              'Complementary businesses',
              'Places you already go',
              'Businesses your customers also visit',
            ].map((prompt) => (
              <div key={prompt} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
                {prompt}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Share Tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Business to invite</label>
              <Input value={targetName} onChange={(event) => setTargetName(event.target.value)} placeholder="Neighborhood coffee shop, gym, salon..." />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Contact detail</label>
              <Input value={targetContact} onChange={(event) => setTargetContact(event.target.value)} placeholder="Phone number, email, or owner name" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Channel</label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={channel === 'sms' ? 'default' : 'outline'} onClick={() => setChannel('sms')}>
                  <MessageSquare className="h-4 w-4" />
                  SMS
                </Button>
                <Button type="button" variant={channel === 'email' ? 'default' : 'outline'} onClick={() => setChannel('email')}>
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
                <Button type="button" variant={channel === 'link_share' ? 'default' : 'outline'} onClick={() => setChannel('link_share')}>
                  <Share2 className="h-4 w-4" />
                  Link Share
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">Dynamic message</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-surface-700">{message}</p>
            </div>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Anything you want to remember about this intro..." />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handleCopy()}>
                <Copy className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy message'}
              </Button>
              <Button type="button" onClick={() => void handleTrack()} disabled={inserting || !targetName.trim()}>
                <SendHorizontal className="h-4 w-4" />
                Track invite
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {referrals.length === 0 ? (
            <EmptyState
              icon={<Plus className="h-6 w-6" />}
              title="No business invites tracked yet"
              description="As you invite nearby businesses, they will show up here."
              className="py-10"
            />
          ) : (
            referrals.map((referral) => (
              <div key={referral.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-surface-900">{referral.target_business_name}</p>
                    <p className="mt-1 text-xs text-surface-500">
                      {referral.channel.replace('_', ' ')} / {referral.target_contact_name || referral.target_contact_email || referral.target_contact_phone || 'No contact detail'}
                    </p>
                  </div>
                  <Badge variant={referral.status === 'converted' ? 'success' : referral.status === 'responded' ? 'info' : 'warning'}>
                    {referral.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
