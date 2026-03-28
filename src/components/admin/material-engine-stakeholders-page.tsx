'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  FolderKanban,
  Plus,
  Sparkles,
  TicketCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  useAdminTasks,
  useBusinesses,
  useCauses,
  useCities,
  useGeneratedMaterials,
  useProfiles,
  useStakeholderCodes,
  useStakeholders,
} from '@/lib/supabase/hooks'
import type { StakeholderType } from '@/lib/types/database'

const TYPE_OPTIONS: Array<{ value: StakeholderType; label: string }> = [
  { value: 'business', label: 'Business' },
  { value: 'school', label: 'School' },
  { value: 'cause', label: 'Cause' },
  { value: 'community', label: 'Community' },
  { value: 'launch_partner', label: 'Launch Partner' },
  { value: 'field', label: 'Field' },
  { value: 'influencer', label: 'Influencer' },
]

function badgeForStatus(status: string) {
  if (status === 'generated') return 'success'
  if (status === 'ready_to_generate') return 'info'
  if (status === 'failed') return 'danger'
  return 'warning'
}

export function MaterialEngineStakeholdersPage() {
  const { data: stakeholders, loading, refetch } = useStakeholders()
  const { data: tasks, refetch: refetchTasks } = useAdminTasks()
  const { data: codes } = useStakeholderCodes()
  const { data: generatedMaterials } = useGeneratedMaterials()
  const { data: cities } = useCities()
  const { data: profiles } = useProfiles()
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [form, setForm] = React.useState({
    type: 'business' as StakeholderType,
    name: '',
    cityId: '',
    ownerUserId: '',
    profileId: '',
    businessId: '',
    causeId: '',
    organizationId: '',
  })

  const totalGenerated = generatedMaterials.filter((item) => item.generation_status === 'generated').length
  const totalReady = tasks.filter((task) => task.status === 'ready_to_generate').length
  const totalNeedsSetup = tasks.filter((task) => task.status === 'needs_setup').length

  async function handleCreateStakeholder(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    setError(null)

    const response = await fetch('/api/admin/material-engine/stakeholders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: form.type,
        name: form.name,
        cityId: form.cityId || null,
        ownerUserId: form.ownerUserId || null,
        profileId: form.profileId || null,
        businessId: form.businessId || null,
        causeId: form.causeId || null,
        organizationId: form.organizationId || null,
      }),
    })

    const payload = await response.json().catch(() => ({ error: 'Could not create stakeholder.' }))
    setSubmitting(false)

    if (!response.ok) {
      setError(payload.error || 'Could not create stakeholder.')
      return
    }

    setFeedback(`${payload.stakeholder.name} is ready for code setup.`)
    setCreateOpen(false)
    setForm({
      type: 'business',
      name: '',
      cityId: '',
      ownerUserId: '',
      profileId: '',
      businessId: '',
      causeId: '',
      organizationId: '',
    })
    refetch({ silent: true })
    refetchTasks({ silent: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stakeholder Material Engine"
        description="Create stakeholder records, connect setup codes, and auto-generate personalized QR materials into the right library."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Stakeholder
          </Button>
        }
      />

      {feedback && (
        <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {feedback}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Needs Setup</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">{totalNeedsSetup}</p>
            <p className="mt-2 text-sm text-surface-500">Stakeholders still waiting on referral and connection codes.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Ready to Generate</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">{totalReady}</p>
            <p className="mt-2 text-sm text-surface-500">Codes are in place and materials can be generated immediately.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Generated Assets</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">{totalGenerated}</p>
            <p className="mt-2 text-sm text-surface-500">Personalized materials already pushed into stakeholder libraries.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-brand-50 via-white to-amber-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/85 p-3 text-brand-600 shadow-sm ring-1 ring-surface-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-900">Operational flow</p>
              <p className="mt-1 max-w-3xl text-sm text-surface-600">
                Create the stakeholder, complete the setup task with a referral code and a connection code, and the system will generate QR-powered materials automatically.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="space-y-3 p-5">
                <div className="h-4 w-1/3 rounded bg-surface-100" />
                <div className="h-3 w-full rounded bg-surface-50" />
                <div className="h-3 w-2/3 rounded bg-surface-50" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stakeholders.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="No stakeholders in the engine yet"
          description="Create the first stakeholder to kick off code setup and material automation."
          action={{ label: 'New Stakeholder', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {stakeholders.map((stakeholder) => {
            const task = tasks.find((item) => item.stakeholder_id === stakeholder.id)
            const code = codes.find((item) => item.stakeholder_id === stakeholder.id)
            const count = generatedMaterials.filter((item) => item.stakeholder_id === stakeholder.id && item.generation_status === 'generated').length
            const city = cities.find((item) => item.id === stakeholder.city_id)
            const owner = profiles.find((item) => item.id === stakeholder.owner_user_id || item.id === stakeholder.profile_id)
            const linkedBusiness = businesses.find((item) => item.id === stakeholder.business_id)
            const linkedCause = causes.find((item) => item.id === stakeholder.cause_id)

            return (
              <Card key={stakeholder.id} className="transition-shadow hover:shadow-card-hover">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{stakeholder.name}</CardTitle>
                      <p className="mt-1 text-sm text-surface-500">
                        {city?.name || 'No city'} · {TYPE_OPTIONS.find((item) => item.value === stakeholder.type)?.label || stakeholder.type}
                      </p>
                    </div>
                    <Badge variant={badgeForStatus(task?.status || 'needs_setup') as 'default' | 'info' | 'success' | 'warning' | 'danger'}>
                      {task?.status?.replace(/_/g, ' ') || 'needs setup'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Codes</p>
                      <p className="mt-2 text-sm font-medium text-surface-900">{code ? 'Ready' : 'Missing'}</p>
                    </div>
                    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Generated</p>
                      <p className="mt-2 text-sm font-medium text-surface-900">{count} assets</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-surface-500">
                    {owner && <p>Owner: <span className="text-surface-700">{owner.full_name}</span></p>}
                    {linkedBusiness && <p>Business: <span className="text-surface-700">{linkedBusiness.name}</span></p>}
                    {linkedCause && <p>Cause: <span className="text-surface-700">{linkedCause.name}</span></p>}
                    {code?.join_url && <p>Join URL: <span className="text-surface-700">{code.join_url.replace(/^https?:\/\//, '')}</span></p>}
                  </div>

                  <Link href={`/admin/stakeholders/${stakeholder.id}`}>
                    <Button className="w-full justify-between">
                      Open setup and materials <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Stakeholder</DialogTitle>
            <DialogDescription>
              This creates the automation record and the setup task. Codes and generated materials come next.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateStakeholder} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Stakeholder type</label>
                <select
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as StakeholderType }))}
                  className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Name</label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">City</label>
                <select
                  value={form.cityId}
                  onChange={(event) => setForm((current) => ({ ...current, cityId: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  <option value="">No city yet</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}, {city.state}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Owner user</label>
                <select
                  value={form.ownerUserId}
                  onChange={(event) => setForm((current) => ({ ...current, ownerUserId: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  <option value="">No owner yet</option>
                  {profiles.map((user) => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Linked profile</label>
                <select
                  value={form.profileId}
                  onChange={(event) => setForm((current) => ({ ...current, profileId: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  <option value="">No linked profile</option>
                  {profiles.map((user) => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Linked business</label>
                <select
                  value={form.businessId}
                  onChange={(event) => setForm((current) => ({ ...current, businessId: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  <option value="">No linked business</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>{business.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Linked cause or school</label>
              <select
                value={form.causeId}
                onChange={(event) => setForm((current) => ({ ...current, causeId: event.target.value }))}
                className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
              >
                <option value="">No linked cause</option>
                {causes.map((cause) => (
                  <option key={cause.id} value={cause.id}>{cause.name}</option>
                ))}
              </select>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                <TicketCheck className="h-4 w-4" /> Create Stakeholder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
