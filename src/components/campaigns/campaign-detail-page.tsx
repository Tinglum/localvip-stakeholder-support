'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  BarChart3,
  Heart,
  Loader2,
  MapPin,
  Megaphone,
  Send,
  Store,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import {
  useBusinesses,
  useCampaigns,
  useCampaignUpdate,
  useCauses,
  useCities,
  useOutreach,
  useProfiles,
} from '@/lib/supabase/hooks'
import type { EntityStatus } from '@/lib/types/database'

export default function CampaignDetailPage() {
  const params = useParams()
  const campaignId = params.id as string
  const { data: campaigns, loading, refetch: refetchCampaigns } = useCampaigns()
  const { data: cities } = useCities()
  const { data: profiles } = useProfiles()
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { data: outreach } = useOutreach()
  const { update: updateCampaign } = useCampaignUpdate()

  const campaign = campaigns.find(item => item.id === campaignId)

  const [editOpen, setEditOpen] = React.useState(false)
  const [draft, setDraft] = React.useState({ name: '', description: '', status: 'active' as EntityStatus, start_date: '', end_date: '' })
  const [savingEdit, setSavingEdit] = React.useState(false)
  const [editError, setEditError] = React.useState('')

  const openEdit = React.useCallback(() => {
    if (!campaign) return
    setEditError('')
    setDraft({
      name: campaign.name,
      description: campaign.description || '',
      status: campaign.status,
      start_date: campaign.start_date ? campaign.start_date.slice(0, 10) : '',
      end_date: campaign.end_date ? campaign.end_date.slice(0, 10) : '',
    })
    setEditOpen(true)
  }, [campaign])

  const handleSaveEdit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    if (!campaign) return
    if (!draft.name.trim()) { setEditError('Add a campaign name.'); return }
    setSavingEdit(true); setEditError('')
    const result = await updateCampaign(campaign.id, {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      status: draft.status,
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
    })
    setSavingEdit(false)
    if (result) { setEditOpen(false); refetchCampaigns() }
    else setEditError('Could not save changes. Try again.')
  }, [campaign, draft, updateCampaign, refetchCampaigns])
  const city = cities.find(item => item.id === campaign?.city_id)
  const owner = profiles.find(item => item.id === campaign?.owner_id)
  const campaignBusinesses = businesses.filter(item => item.campaign_id === campaignId)
  const campaignCauses = causes.filter(item => item.campaign_id === campaignId)
  const campaignOutreach = outreach.filter(item => item.campaign_id === campaignId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading campaign...</span>
      </div>
    )
  }

  if (!campaign) {
    return (
      <EmptyState
        icon={<Megaphone className="h-8 w-8" />}
        title="Campaign not found"
        description="This campaign record could not be loaded."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description={campaign.description || 'Campaign record and connected CRM activity.'}
        breadcrumb={[
          { label: 'Campaigns', href: '/campaigns' },
          { label: campaign.name },
        ]}
        actions={<Button variant="outline" onClick={openEdit}>Edit campaign</Button>}
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-surface-50 via-white to-surface-100 px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={campaign.brand === 'hato' ? 'hato' : 'info'}>
                  {BRANDS[campaign.brand].label}
                </Badge>
                <Badge variant={campaign.status === 'active' ? 'success' : 'default'} dot>
                  {campaign.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
                {city && (
                  <Link href={`/crm/cities/${city.id}`} className="inline-flex items-center gap-1 hover:text-surface-900">
                    <MapPin className="h-4 w-4" /> {city.name}, {city.state}
                  </Link>
                )}
                {owner && (
                  <Link href={`/admin/users/${owner.id}`} className="inline-flex items-center gap-1 hover:text-surface-900">
                    <Users className="h-4 w-4" /> {owner.full_name}
                  </Link>
                )}
                <span>{campaign.start_date ? formatDate(campaign.start_date) : 'No start date'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Businesses</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{campaignBusinesses.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Causes</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{campaignCauses.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Outreach</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{campaignOutreach.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Status</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900 capitalize">{campaign.status}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Businesses</p>
            </div>
            {campaignBusinesses.length > 0 ? (
              <div className="space-y-3">
                {campaignBusinesses.map(business => (
                  <Link key={business.id} href={`/crm/businesses/${business.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                    <p className="font-medium text-surface-900">{business.name}</p>
                    <p className="text-sm text-surface-500">{business.category || 'Business record'}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No businesses attached to this campaign yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Causes</p>
            </div>
            {campaignCauses.length > 0 ? (
              <div className="space-y-3">
                {campaignCauses.map(cause => (
                  <Link key={cause.id} href={`/crm/causes/${cause.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                    <p className="font-medium text-surface-900">{cause.name}</p>
                    <p className="text-sm text-surface-500">{cause.type}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No causes attached to this campaign yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-surface-500" />
            <p className="text-sm font-semibold text-surface-900">Recent Outreach</p>
          </div>
          {campaignOutreach.length > 0 ? (
            <div className="space-y-3">
              {campaignOutreach.map(activity => (
                <div key={activity.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-surface-900">{activity.subject || activity.type.replace('_', ' ')}</p>
                    <Badge variant="default">{activity.type.replace('_', ' ')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-surface-500">{activity.body || activity.outcome || 'No detail captured.'}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-surface-400">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {formatDate(activity.created_at)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-surface-400">No outreach logged for this campaign yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>Edit campaign</DialogTitle>
              <DialogDescription>Update the campaign name, status, dates, and description.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-surface-800" htmlFor="camp-name">Name</label>
                <Input id="camp-name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-surface-800" htmlFor="camp-desc">Description</label>
                <Textarea id="camp-desc" rows={3} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-surface-800" htmlFor="camp-status">Status</label>
                  <select
                    id="camp-status"
                    value={draft.status}
                    onChange={e => setDraft(d => ({ ...d, status: e.target.value as EntityStatus }))}
                    className="h-10 w-full rounded-md border border-surface-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-surface-800" htmlFor="camp-start">Start</label>
                  <Input id="camp-start" type="date" value={draft.start_date} onChange={e => setDraft(d => ({ ...d, start_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-surface-800" htmlFor="camp-end">End</label>
                  <Input id="camp-end" type="date" value={draft.end_date} onChange={e => setDraft(d => ({ ...d, end_date: e.target.value }))} />
                </div>
              </div>
              {editError && <p className="text-sm text-danger-600">{editError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
