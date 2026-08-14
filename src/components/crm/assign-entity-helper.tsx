'use client'

/**
 * Who is assigned to help run this business or cause — field reps, launch
 * partners, influencers, or anyone else an operator wants on it — with a way
 * to add or remove them.
 *
 * This is the piece the "Enablers" material chip pointed at but that never
 * existed: a person could not be connected to a business or cause at all
 * outside the self-serve "claim" flow on the operational businesses/causes
 * pages, so material generation had nobody but the business's own login and
 * operators to authorize against. `DashboardStakeholderAssignments` already
 * has full, validated backend CRUD (create/update/delete) - it just had zero
 * rows, because nothing on the dashboard ever called it from a business or
 * cause's own page.
 *
 * `entityId` MUST be the QA numeric account id, not a local Supabase-era id.
 * The backend's EntityId column is a `long` and material-generation
 * authorization will be checked against the same id - passing the local id
 * here would write assignments nothing else can ever match.
 */

import * as React from 'react'
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ROLES } from '@/lib/constants'
import {
  useStakeholderAssignmentDelete,
  useStakeholderAssignmentInsert,
  useStakeholderAssignments,
} from '@/lib/supabase/hooks'
import type { Profile } from '@/lib/types/database'

// Roles nobody would ever "assign" to help run a business/cause: the account
// itself, and the people who already have full access regardless.
const NOT_ASSIGNABLE = new Set(['business', 'community', 'admin', 'super_admin', 'internal_admin'])

// Field, Launch Partner and Influencer (plus their legacy variants) are the
// roles this was actually built for — surfaced first in the picker.
const ENABLER_ROLES = new Set(['field', 'intern', 'volunteer', 'launch_partner', 'business_onboarding', 'influencer', 'affiliate'])

export function AssignEntityHelperCard({
  entityType,
  entityId,
  profiles,
  currentProfileId,
}: {
  entityType: 'business' | 'cause'
  /** QA numeric account id — see the file header. */
  entityId: number | string | null
  profiles: Profile[]
  currentProfileId: string | null
}) {
  const entityIdStr = entityId != null ? String(entityId) : ''
  const { data: assignments, loading, refetch } = useStakeholderAssignments(
    { entity_type: entityType, entity_id: entityIdStr },
    { enabled: !!entityIdStr },
  )
  const { insert, loading: inserting, error: insertError } = useStakeholderAssignmentInsert()
  const { remove } = useStakeholderAssignmentDelete()
  const [picking, setPicking] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [removingId, setRemovingId] = React.useState<string | null>(null)

  const active = React.useMemo(
    () => assignments.filter((a) => a.status === 'active'),
    [assignments],
  )
  const assignedIds = React.useMemo(() => new Set(active.map((a) => a.stakeholder_id)), [active])
  const profileMap = React.useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])

  const candidates = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return profiles
      .filter((p) => !NOT_ASSIGNABLE.has(p.role) && !assignedIds.has(p.id))
      .filter((p) => !query || p.full_name?.toLowerCase().includes(query) || p.email?.toLowerCase().includes(query))
      .sort((a, b) => {
        const aEnabler = ENABLER_ROLES.has(a.role) ? 0 : 1
        const bEnabler = ENABLER_ROLES.has(b.role) ? 0 : 1
        if (aEnabler !== bEnabler) return aEnabler - bEnabler
        return (a.full_name || '').localeCompare(b.full_name || '')
      })
      .slice(0, 20)
  }, [profiles, assignedIds, search])

  async function assign(profile: Profile) {
    setLocalError(null)
    if (!entityIdStr) return
    const result = await insert({
      stakeholder_id: profile.id,
      entity_type: entityType,
      entity_id: entityIdStr,
      assigned_by: currentProfileId || undefined,
      role: profile.role,
      status: 'active',
      ownership_status: 'supporting',
    })
    if (!result) {
      // The backend rejects a duplicate active assignment with 409 — this is
      // the one case worth naming specifically rather than a generic failure.
      setLocalError(insertError || 'Could not assign this person. They may already be assigned.')
      return
    }
    setSearch('')
    setPicking(false)
    refetch()
  }

  async function unassign(assignmentId: string) {
    setLocalError(null)
    setRemovingId(assignmentId)
    const ok = await remove(assignmentId)
    setRemovingId(null)
    if (ok) refetch()
    else setLocalError('Could not remove this assignment.')
  }

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-surface-900">Assigned team</p>
          <p className="mt-0.5 text-xs text-surface-500">
            Field, launch partner and influencer users assigned here can generate materials for this {entityType} even though it cannot generate its own.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setPicking((v) => !v)} disabled={!entityIdStr}>
          <UserPlus className="h-3.5 w-3.5" /> Assign
        </Button>
      </div>

      {!entityIdStr ? (
        <p className="mt-3 text-xs text-surface-400">
          This {entityType} has no QA account yet, so nobody can be assigned.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {loading ? (
              <span className="flex items-center gap-1.5 text-xs text-surface-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </span>
            ) : active.length === 0 ? (
              <span className="text-xs text-surface-400">Nobody is assigned yet.</span>
            ) : (
              active.map((assignment) => {
                const profile = profileMap.get(assignment.stakeholder_id)
                return (
                  <span
                    key={assignment.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 py-1 pl-3 pr-1.5 text-xs text-surface-700"
                  >
                    {profile?.full_name || 'Unknown user'}
                    <Badge variant="info" className="text-[10px]">
                      {ROLES[assignment.role as keyof typeof ROLES]?.label || profile?.role || assignment.role}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => unassign(assignment.id)}
                      disabled={removingId === assignment.id}
                      aria-label={`Remove ${profile?.full_name || 'this person'}`}
                      className="rounded-full p-0.5 text-surface-400 hover:bg-surface-200 hover:text-surface-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })
            )}
          </div>

          {picking ? (
            <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-400" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="pl-8"
                />
              </div>
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {candidates.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-surface-400">No one matches.</p>
                ) : (
                  candidates.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      disabled={inserting}
                      onClick={() => assign(profile)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white disabled:opacity-50"
                    >
                      <span className="truncate text-surface-800">{profile.full_name || profile.email}</span>
                      <Badge variant={ENABLER_ROLES.has(profile.role) ? 'success' : 'default'} className="shrink-0 text-[10px]">
                        {ROLES[profile.role]?.label || profile.role}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {localError ? <p className="mt-2 text-xs text-danger-600">{localError}</p> : null}
        </>
      )}
    </div>
  )
}
