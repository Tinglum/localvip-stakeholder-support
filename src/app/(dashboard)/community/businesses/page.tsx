'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Megaphone,
  Rocket,
  Store,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { useAuth } from '@/lib/auth/context'
import { useBusinesses, useCauses } from '@/lib/supabase/hooks'
import { COMMUNITY_BUSINESS_STATUS } from '@/lib/constants'
import { resolveCommunityCause } from '@/lib/community-cause'
import { CauseLoadError } from '@/components/community/cause-load-error'
import { getCauseQaAccountId } from '@/lib/community-cause'

type BusinessLead = { id: string; businessName: string; city?: string; contactName?: string; contactEmail?: string; contactPhone?: string; status: string }

export default function CommunityBusinessesPage() {
  const { profile } = useAuth()
  const { data: causes, loading: causesLoading, error: causesError, refetch: reloadCauses } = useCauses()
  const { data: businesses, loading: businessesLoading, error: businessesError, refetch: reloadBusinesses } = useBusinesses()

  const scopedCause = React.useMemo(
    () => resolveCommunityCause(profile, causes),
    [causes, profile],
  )

  const supportingBusinesses = React.useMemo(
    () => businesses.filter(b => b.linked_cause_id === scopedCause?.id),
    [businesses, scopedCause?.id],
  )

  const isSchool = scopedCause?.type === 'school'
  const causeQaId = getCauseQaAccountId(scopedCause)
  const [leads, setLeads] = React.useState<BusinessLead[]>([])
  const [leadError, setLeadError] = React.useState('')
  const [savingLead, setSavingLead] = React.useState(false)
  const [businessName, setBusinessName] = React.useState('')
  const [city, setCity] = React.useState('')
  const [contactName, setContactName] = React.useState('')
  const [contactEmail, setContactEmail] = React.useState('')
  const [contactPhone, setContactPhone] = React.useState('')

  const reloadLeads = React.useCallback(async () => {
    if (!causeQaId) return
    try {
      const response = await fetch(`/api/community/business-nominations?causeId=${encodeURIComponent(causeQaId)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load business leads.')
      setLeads(data.items || [])
      setLeadError('')
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : 'Could not load business leads.')
    }
  }, [causeQaId])

  React.useEffect(() => { void reloadLeads() }, [reloadLeads])

  async function addLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!causeQaId || savingLead) return
    setSavingLead(true)
    setLeadError('')
    try {
      const response = await fetch(`/api/community/business-nominations?causeId=${encodeURIComponent(causeQaId)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessName, city, contactName, contactEmail, contactPhone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not add business lead.')
      setBusinessName(''); setCity(''); setContactName(''); setContactEmail(''); setContactPhone('')
      await reloadLeads()
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : 'Could not add business lead.')
    } finally {
      setSavingLead(false)
    }
  }

  if (causesLoading) return <div role="status" className="animate-pulse p-8 text-sm text-surface-500">Loading your cause...</div>
  if (causesError) return <CauseLoadError onRetry={() => reloadCauses()} />

  if (!scopedCause) {
    return <EmptyState icon={<Store className="h-8 w-8" />} title="No cause linked" description="A cause or school must be linked to your account to see businesses." />
  }
  if (businessesLoading) return <div role="status" className="animate-pulse p-8 text-sm text-surface-500">Loading supporting businesses...</div>
  if (businessesError) return <CauseLoadError onRetry={() => reloadBusinesses()} />

  const liveCount = supportingBusinesses.filter(b => b.stage === 'live').length
  const settingUpCount = supportingBusinesses.filter(b => ['contacted', 'interested', 'in_progress', 'onboarded'].includes(b.stage)).length
  const newCount = supportingBusinesses.filter(b => b.stage === 'lead').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supporting Businesses"
        description={isSchool ? 'Businesses supporting your school fundraising' : 'Businesses supporting your cause'}
        actions={
          <Button asChild size="sm">
            <Link href="/community/materials">
              <Megaphone className="h-4 w-4" /> View outreach materials
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={supportingBusinesses.length} icon={<Store className="h-5 w-5" />} />
        <StatCard label="New" value={newCount} icon={<Rocket className="h-5 w-5" />} />
        <StatCard label="Setting Up" value={settingUpCount} icon={<ArrowRight className="h-5 w-5" />} />
        <StatCard label="Active" value={liveCount} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {causeQaId && (
        <Card>
          <CardHeader><CardTitle>Invite a local business</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-surface-600">Add a business you would like on your support team. The LocalVIP team can follow up with the contact you provide.</p>
            <form onSubmit={addLead} className="grid gap-3 sm:grid-cols-2">
              <input className="rounded-lg border border-surface-200 px-3 py-2 text-sm" aria-label="Business name" placeholder="Business name *" required minLength={2} maxLength={120} value={businessName} onChange={e => setBusinessName(e.target.value)} />
              <input className="rounded-lg border border-surface-200 px-3 py-2 text-sm" aria-label="City" placeholder="City" maxLength={80} value={city} onChange={e => setCity(e.target.value)} />
              <input className="rounded-lg border border-surface-200 px-3 py-2 text-sm" aria-label="Contact name" placeholder="Contact name" maxLength={80} value={contactName} onChange={e => setContactName(e.target.value)} />
              <input className="rounded-lg border border-surface-200 px-3 py-2 text-sm" aria-label="Contact email" placeholder="Contact email" type="email" maxLength={160} value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
              <input className="rounded-lg border border-surface-200 px-3 py-2 text-sm" aria-label="Contact phone" placeholder="Contact phone" type="tel" maxLength={40} value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
              <div><Button type="submit" size="sm" disabled={savingLead}>{savingLead ? 'Adding...' : 'Add business lead'}</Button></div>
            </form>
            {leadError && <p role="alert" className="text-sm text-red-600">{leadError}</p>}
            {leads.length > 0 && <div className="space-y-2"><h3 className="text-sm font-semibold">Businesses you suggested</h3>{leads.map(lead => <div key={lead.id} className="flex justify-between rounded-lg border border-surface-200 p-3 text-sm"><span>{lead.businessName}{lead.city ? ` · ${lead.city}` : ''}</span><Badge variant="outline">{lead.status}</Badge></div>)}</div>}
          </CardContent>
        </Card>
      )}

      {supportingBusinesses.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Store className="mx-auto mb-3 h-10 w-10 text-surface-300" />
              <h3 className="text-base font-semibold text-surface-800">Get your first business</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-surface-500">
                {isSchool
                  ? 'Start reaching out to local businesses your school families already visit. Use your share materials to make the ask easy.'
                  : 'Connect businesses that already care about your cause. Share your outreach materials to start the conversation.'}
              </p>
              <div className="mt-4">
                <Button asChild size="sm">
                  <Link href="/community/materials">
                    <Megaphone className="h-4 w-4" /> Open outreach materials
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {supportingBusinesses.map(biz => {
            const status = COMMUNITY_BUSINESS_STATUS[biz.stage] || COMMUNITY_BUSINESS_STATUS.lead
            return (
              <Card key={biz.id} className="transition-shadow hover:shadow-card-hover">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-surface-900">{biz.name}</p>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="text-xs text-surface-500">
                        {[biz.category, biz.address].filter(Boolean).join(' \u2022 ') || 'Local business'}
                      </p>
                      {(biz.email || biz.phone) && (
                        <p className="text-xs text-surface-400">{[biz.email, biz.phone].filter(Boolean).join(' / ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {biz.stage === 'live' ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Live & earning
                        </span>
                      ) : biz.stage === 'onboarded' ? (
                        <span className="text-xs text-surface-500">Almost there</span>
                      ) : (
                        <span className="text-xs text-surface-400">In progress</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
