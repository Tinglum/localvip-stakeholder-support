'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  BarChart3,
  Loader2,
  Megaphone,
  Plus,
  Search,
  Store,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import {
  useBusinesses,
  useCampaignInsert,
  useCampaigns,
  useCauses,
  useCities,
  useOutreach,
} from '@/lib/supabase/hooks'

export default function CampaignsPage() {
  const { profile } = useAuth()
  const { data: campaigns, loading, refetch } = useCampaigns()
  const { data: cities } = useCities()
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { data: outreach } = useOutreach()
  const { insert, loading: inserting } = useCampaignInsert()

  const [addOpen, setAddOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [brand, setBrand] = React.useState<string>('localvip')
  const [cityId, setCityId] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')

  const filteredCampaigns = React.useMemo(() => {
    if (!search) return campaigns
    const query = search.toLowerCase()
    return campaigns.filter(campaign =>
      campaign.name.toLowerCase().includes(query)
      || (campaign.description || '').toLowerCase().includes(query)
    )
  }, [campaigns, search])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    const result = await insert({
      name: name.trim(),
      description: description.trim() || null,
      brand: brand as 'localvip' | 'hato',
      city_id: cityId || null,
      start_date: startDate || null,
      end_date: endDate || null,
      status: 'active',
      owner_id: profile.id,
    })

    if (result) {
      setAddOpen(false)
      setName('')
      setDescription('')
      setBrand('localvip')
      setCityId('')
      setStartDate('')
      setEndDate('')
      refetch()
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Organize outreach efforts by campaign and click into the full campaign record."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> New Campaign
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search campaigns..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" />}
          title="No campaigns yet"
          description="Create a campaign to organize outreach and track results."
          action={{ label: 'New Campaign', onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredCampaigns.map(campaign => {
            const city = cities.find(item => item.id === campaign.city_id)
            const campaignBusinesses = businesses.filter(item => item.campaign_id === campaign.id)
            const campaignCauses = causes.filter(item => item.campaign_id === campaign.id)
            const campaignOutreach = outreach.filter(item => item.campaign_id === campaign.id)

            return (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block">
                <Card className="group h-full overflow-hidden border-surface-200 transition-shadow hover:shadow-card-hover">
                  <div className="bg-gradient-to-r from-surface-50 via-white to-surface-100 px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-surface-900 transition-colors group-hover:text-brand-700">
                            {campaign.name}
                          </h3>
                          <Badge variant={campaign.brand === 'hato' ? 'hato' : 'info'}>
                            {BRANDS[campaign.brand].label}
                          </Badge>
                          <Badge variant={campaign.status === 'active' ? 'success' : 'default'} dot>
                            {campaign.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-surface-500">{campaign.description || 'No description yet.'}</p>
                      </div>
                    </div>
                  </div>

                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
                      <span>{city ? `${city.name}, ${city.state}` : 'No city linked'}</span>
                      <span>{campaign.start_date ? formatDate(campaign.start_date) : 'No start date'}</span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
                          <Store className="h-3.5 w-3.5" />
                          Businesses
                        </div>
                        <p className="mt-2 text-xl font-semibold text-surface-900">{campaignBusinesses.length}</p>
                      </div>
                      <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
                          <Users className="h-3.5 w-3.5" />
                          Causes
                        </div>
                        <p className="mt-2 text-xl font-semibold text-surface-900">{campaignCauses.length}</p>
                      </div>
                      <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
                          <BarChart3 className="h-3.5 w-3.5" />
                          Outreach
                        </div>
                        <p className="mt-2 text-xl font-semibold text-surface-900">{campaignOutreach.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>Create a campaign to organize outreach and track results.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Campaign Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spring 2026 Launch" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this campaign about?" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Brand</label>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BRANDS).map(([key, item]) => (
                      <SelectItem key={key} value={key}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">City</label>
                <Select value={cityId} onValueChange={setCityId}>
                  <SelectTrigger><SelectValue placeholder="Select city..." /></SelectTrigger>
                  <SelectContent>
                    {cities.map(city => (
                      <SelectItem key={city.id} value={city.id}>{city.name}, {city.state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Start Date</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">End Date</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={inserting || !name.trim()}>
                {inserting ? 'Creating...' : 'Create Campaign'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
