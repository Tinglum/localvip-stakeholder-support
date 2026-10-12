'use client'

import * as React from 'react'
import Link from 'next/link'
import { Loader2, UserPlus, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { ROLES } from '@/lib/constants'
import { useStakeholderAssignmentInsert, useStakeholderAssignments } from '@/lib/supabase/hooks'
import type { Business, Cause, Profile } from '@/lib/types/database'

type CoveredEntity = { type: 'business' | 'cause'; id: string; name: string; relation: 'owner' | 'helper' }

export interface CityCoverageMember {
  profile: Profile
  entities: CoveredEntity[]
}

/**
 * Team coverage for a city is derived from real assignments on the city's
 * businesses/causes: record owners (owner_id / owner_user_id) plus active
 * stakeholder assignments — the same sources the cause detail page uses for
 * "Owner" and "Helpers". Profiles have no reliable city link of their own.
 */
export function useCityTeamCoverage(businesses: Business[], causes: Cause[], profiles: Profile[]) {
  const { data: assignments, loading, error, refetch } = useStakeholderAssignments({ status: 'active' })

  const members = React.useMemo<CityCoverageMember[]>(() => {
    const profileMap = new Map(profiles.map(profile => [String(profile.id), profile]))
    const byProfile = new Map<string, CityCoverageMember>()
    const add = (profileId: string | null | undefined, entity: CoveredEntity) => {
      if (!profileId) return
      const profile = profileMap.get(String(profileId))
      if (!profile) return
      const member = byProfile.get(profile.id) || { profile, entities: [] }
      const existing = member.entities.find(item => item.type === entity.type && item.id === entity.id)
      if (!existing) member.entities.push(entity)
      else if (entity.relation === 'owner') existing.relation = 'owner'
      byProfile.set(profile.id, member)
    }

    const entityIndex = new Map<string, Omit<CoveredEntity, 'relation'>>()
    businesses.forEach(business => {
      entityIndex.set(`business:${business.id}`, { type: 'business', id: business.id, name: business.name })
      add(business.owner_id || business.owner_user_id, { type: 'business', id: business.id, name: business.name, relation: 'owner' })
    })
    causes.forEach(cause => {
      entityIndex.set(`cause:${cause.id}`, { type: 'cause', id: cause.id, name: cause.name })
      add(cause.owner_id, { type: 'cause', id: cause.id, name: cause.name, relation: 'owner' })
    })
    assignments.forEach(assignment => {
      if (assignment.status !== 'active' || assignment.ownership_status === 'released') return
      const entity = entityIndex.get(`${assignment.entity_type}:${assignment.entity_id}`)
      if (!entity) return
      add(assignment.stakeholder_id, {
        ...entity,
        relation: assignment.ownership_status === 'active_owner' ? 'owner' : 'helper',
      })
    })

    return Array.from(byProfile.values())
      .sort((left, right) => right.entities.length - left.entities.length || left.profile.full_name.localeCompare(right.profile.full_name))
  }, [assignments, businesses, causes, profiles])

  return { members, loading, error, refetch }
}

export function CityTeamCoverageCard({
  cityName,
  businesses,
  causes,
  profiles,
  coverage,
}: {
  cityName: string
  businesses: Business[]
  causes: Cause[]
  profiles: Profile[]
  coverage: ReturnType<typeof useCityTeamCoverage>
}) {
  const [assignOpen, setAssignOpen] = React.useState(false)
  const { members, loading, error, refetch } = coverage
  const hasEntities = businesses.length + causes.length > 0

  const roleCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    members.forEach(({ profile }) => counts.set(profile.role, (counts.get(profile.role) || 0) + 1))
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])
  }, [members])

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-surface-500" />
            <p id="city-team" className="text-sm font-semibold text-surface-900">Team Coverage</p>
          </div>
          <Button variant="outline" size="sm" type="button" onClick={() => setAssignOpen(true)} disabled={!hasEntities}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Assign person
          </Button>
        </div>

        {error && (
          <p className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
            Helper assignments could not be loaded ({error}). Showing record owners only.
          </p>
        )}

        {loading && members.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading team coverage...
          </div>
        ) : members.length > 0 ? (
          <div className="space-y-3">
            {roleCounts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {roleCounts.map(([role, count]) => (
                  <span key={role} className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs font-medium text-surface-600">
                    {ROLES[role as keyof typeof ROLES]?.label || role}: {count}
                  </span>
                ))}
              </div>
            )}
            {members.map(({ profile, entities }) => (
              <div key={profile.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Link href={`/admin/users/${profile.id}`} className="font-medium text-surface-900 hover:underline">
                      {profile.full_name}
                    </Link>
                    <p className="text-sm text-surface-500">{ROLES[profile.role]?.label || profile.role}</p>
                  </div>
                  <Badge variant={profile.status === 'active' ? 'success' : 'default'} dot>
                    {profile.status}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entities.map(entity => (
                    <Link
                      key={`${entity.type}:${entity.id}`}
                      href={`/crm/${entity.type === 'business' ? 'businesses' : 'causes'}/${entity.id}`}
                      className="rounded-full border border-surface-200 bg-white px-2 py-0.5 text-xs text-surface-600 transition-colors hover:border-surface-300 hover:text-surface-900"
                    >
                      {entity.name}
                      <span className="ml-1 text-surface-400">{entity.relation === 'owner' ? 'owner' : 'helper'}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-surface-400">
            {hasEntities
              ? 'Nobody is assigned to this city’s businesses or causes yet.'
              : 'Link a business or cause to this city before assigning people.'}
          </p>
        )}
      </CardContent>

      <AssignPersonDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        cityName={cityName}
        businesses={businesses}
        causes={causes}
        profiles={profiles}
        onAssigned={refetch}
      />
    </Card>
  )
}

function AssignPersonDialog({
  open,
  onOpenChange,
  cityName,
  businesses,
  causes,
  profiles,
  onAssigned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cityName: string
  businesses: Business[]
  causes: Cause[]
  profiles: Profile[]
  onAssigned: () => void
}) {
  const { insert } = useStakeholderAssignmentInsert()
  const [personId, setPersonId] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (open) { setPersonId(''); setSelected(new Set()); setError('') }
  }, [open])

  const people = React.useMemo(
    () => profiles.filter(profile => profile.status !== 'inactive').slice().sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [profiles],
  )
  const entities = React.useMemo(() => [
    ...businesses.map(business => ({ key: `business:${business.id}`, type: 'business' as const, id: business.id, name: business.name })),
    ...causes.map(cause => ({ key: `cause:${cause.id}`, type: 'cause' as const, id: cause.id, name: cause.name })),
  ], [businesses, causes])

  function toggle(key: string) {
    setSelected(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!personId || selected.size === 0) return
    setSaving(true); setError('')
    const failures: string[] = []
    const person = profiles.find(profile => profile.id === personId)
    for (const entity of entities.filter(item => selected.has(item.key))) {
      const result = await insert({
        stakeholder_id: personId,
        entity_type: entity.type,
        entity_id: entity.id,
        role: person?.role || null,
        ownership_status: 'supporting',
        status: 'active',
      })
      if (!result) failures.push(entity.name)
    }
    setSaving(false)
    onAssigned()
    if (failures.length > 0) {
      setError(`Could not assign to: ${failures.join(', ')}. They may already be assigned, or you may lack CRM permission.`)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Assign a person in {cityName}</DialogTitle>
            <DialogDescription>They are added as a helper on each selected business or cause.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="city-assign-person" className="text-sm font-medium text-surface-700">Team member</label>
            <select
              id="city-assign-person"
              value={personId}
              onChange={event => setPersonId(event.target.value)}
              className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="" disabled>{people.length ? 'Select a person' : 'No team members available'}</option>
              {people.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name} - {ROLES[profile.role]?.label || profile.role}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-surface-700">Cover these records</legend>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-surface-200 p-2">
              {entities.map(entity => (
                <label key={entity.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-surface-700 hover:bg-surface-50">
                  <input type="checkbox" checked={selected.has(entity.key)} onChange={() => toggle(entity.key)} />
                  <span className="flex-1">{entity.name}</span>
                  <span className="text-xs text-surface-400">{entity.type === 'business' ? 'Business' : 'Cause'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="text-sm text-danger-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !personId || selected.size === 0}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Assign{selected.size > 0 ? ` to ${selected.size}` : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
