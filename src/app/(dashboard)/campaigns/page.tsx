'use client'

import * as React from 'react'
import { Megaphone, Plus, BarChart3, Users, QrCode, Store, Calendar } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useCampaigns, useCampaignInsert, useCities } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'

export default function CampaignsPage() {
  const { profile } = useAuth()
  const { data: campaigns, loading, refetch } = useCampaigns()
  const { data: cities } = useCities()
  const { insert, loading: inserting } = useCampaignInsert()
  const [addOpen, setAddOpen] = React.useState(false)

  // Form state
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [brand, setBrand] = React.useState<string>('localvip')
  const [cityId, setCityId] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')

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
      setName(''); setDescription(''); setBrand('localvip'); setCityId(''); setStartDate(''); setEndDate('')
      refetch()
    }
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Organize outreach efforts by campaign. Track progress, assign stakeholders, and measure results."
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> New Campaign</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" />}
          title="No campaigns yet"
          description="Create a campaign to organize your outreach and track results."
          action={{ label: 'New Campaign', onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => {
            const city = cities.find(c => c.id === campaign.city_id)
            return (
              <Card key={campaign.id} className="group transition-shadow hover:shadow-card-hover">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-surface-900 group-hover:text-brand-700 transition-colors">
                          {campaign.name}
                        </h3>
                        <Badge variant={campaign.brand === 'hato' ? 'hato' : 'info'}>
                          {BRANDS[campaign.brand].label}
                        </Badge>
                        <Badge variant={campaign.status === 'active' ? 'success' : 'default'} dot>
                          {campaign.status}
                        </Badge>
                      </div>
                      {campaign.description && (
                        <p className="text-sm text-surface-500">{campaign.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-surface-400">
                        {campaign.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(campaign.start_date)}
                            {campaign.end_date && <> — {formatDate(campaign.end_date)}</>}
                          </span>
                        )}
                        {city && <span>City: {city.name}, {city.state}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Campaign Dialog */}
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
                    {Object.entries(BRANDS).map(([key, b]) => (
                      <SelectItem key={key} value={key}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">City</label>
                <Select value={cityId} onValueChange={setCityId}>
                  <SelectTrigger><SelectValue placeholder="Select city..." /></SelectTrigger>
                  <SelectContent>
                    {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}, {c.state}</SelectItem>)}
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
