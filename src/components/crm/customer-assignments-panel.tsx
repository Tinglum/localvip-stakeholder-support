'use client'

import * as React from 'react'
import { AlertTriangle, Building2, Flag, Heart, MapPin, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { roleUsesAssignments } from '@/lib/assignment-impact'
import type { UserRole } from '@/lib/types/database'
import {
  useBusinesses,
  useCampaigns,
  useCauses,
  useCities,
  useStakeholderAssignmentDelete,
  useStakeholderAssignmentInsert,
  useStakeholderAssignments,
} from '@/lib/supabase/hooks'

/**
 * What a person owns: cities, campaigns, causes and businesses.
 *
 * All four were already modelled - StakeholderAssignment.entity_type has
 * covered 'city' and 'campaign' the whole time, and four dashboards scope what
 * a field rep sees by reading their city assignments. Nothing in the app could
 * create one. City assignments were effectively read-only, campaign
 * assignments never existed, and business/cause assignment lived on the
 * business and cause pages rather than the person's, so there was no single
 * place to answer "what does this person actually own?" or to take it away
 * again.
 *
 * Everything here writes through the same stakeholder_assignments hooks the
 * rest of the CRM uses, so an assignment made here behaves identically to one
 * made from a business page.
 */

type EntityType = 'city' | 'campaign' | 'cause' | 'business'

const TABS: { key: EntityType; label: string; icon: React.ElementType }[] = [
  { key: 'city', label: 'Cities', icon: MapPin },
  { key: 'campaign', label: 'Campaigns', icon: Flag },
  { key: 'cause', label: 'Causes', icon: Heart },
  { key: 'business', label: 'Businesses', icon: Building2 },
]

export function CustomerAssignmentsPanel({
  stakeholderId,
  stakeholderName,
  currentRole,
  currentTrackLabel,
  assignableTracks = [],
  onChangeTrack,
}: {
  stakeholderId: string
  stakeholderName?: string | null
  /** Role this person resolves to today, used to spot inert assignments. */
  currentRole?: UserRole
  currentTrackLabel?: string
  /** Tracks that DO reach the assignment dashboards, offered as the fix. */
  assignableTracks?: { id: number; name: string }[]
  onChangeTrack?: (track: { id: number; name: string }) => Promise<void> | void
}) {
  const [tab, setTab] = React.useState<EntityType>('city')
  const [picking, setPicking] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  const { data: assignments, refetch } = useStakeholderAssignments({
    stakeholder_id: stakeholderId,
  })
  const { insert } = useStakeholderAssignmentInsert()
  const { remove } = useStakeholderAssignmentDelete()

  // Only the list for the open tab is fetched; the others stay disabled so
  // opening this panel does not pull four entity tables at once.
  const { data: cities } = useCities({ enabled: tab === 'city' })
  const { data: campaigns } = useCampaigns(undefined, { enabled: tab === 'campaign' })
  const { data: causes } = useCauses(undefined, { enabled: tab === 'cause' })
  const { data: businesses } = useBusinesses(undefined, { enabled: tab === 'business' })

  const options = React.useMemo(() => {
    const raw =
      tab === 'city' ? cities : tab === 'campaign' ? campaigns : tab === 'cause' ? causes : businesses
    return (raw as Array<{ id: string | number; name: string }> | undefined) || []
  }, [tab, cities, campaigns, causes, businesses])

  const current = React.useMemo(
    () => assignments.filter((a) => a.entity_type === tab),
    [assignments, tab]
  )

  const assignedIds = React.useMemo(
    () => new Set(current.map((a) => String(a.entity_id))),
    [current]
  )

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return options
      .filter((o) => !assignedIds.has(String(o.id)))
      .filter((o) => !q || (o.name || '').toLowerCase().includes(q))
      .slice(0, 40)
  }, [options, assignedIds, search])

  const nameFor = React.useCallback(
    (entityId: string) => {
      const hit = options.find((o) => String(o.id) === String(entityId))
      // Falls back to the raw id: an assignment to something since deleted is
      // still worth showing, because it is still scoping what this person sees.
      return hit?.name || `#${entityId}`
    },
    [options]
  )

  async function assign(entityId: string | number, label: string) {
    // The API layer strips any id in ID_FIELDS_REQUIRING_LONG that will not
    // parse as a positive integer, and EntityId is nullable on the backend - so
    // a non-numeric id would be quietly dropped and the row written pointing at
    // nothing. Refuse loudly instead: a visible error beats an assignment that
    // exists, looks assigned, and scopes nobody.
    if (!/^\d+$/.test(String(entityId))) {
      setMessage(
        `Cannot assign "${label}": its id (${entityId}) is not numeric, and the ` +
          `assignment would be saved without a target. This usually means the ` +
          `${tab} list is still returning Supabase-era ids.`,
      )
      return
    }
    if (!/^\d+$/.test(String(stakeholderId))) {
      setMessage('Cannot assign: this person has no numeric user id.')
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      await insert({
        stakeholder_id: stakeholderId,
        entity_type: tab,
        entity_id: String(entityId),
        status: 'active',
      })
      setMessage(`Assigned ${label}.`)
      setPicking(false)
      setSearch('')
      refetch()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not assign that.')
    } finally {
      setBusy(false)
    }
  }

  async function unassign(id: string, label: string) {
    setBusy(true)
    setMessage(null)
    try {
      await remove(id)
      setMessage(`Removed ${label}.`)
      refetch()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove that.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-surface-200 bg-white p-5">
      {/* The mirror of the demotion warning. Assigning work to someone whose
          track cannot reach the field or launch-partner dashboards creates a
          row that looks like ownership and does nothing - so say it here, at
          the point of assigning, and offer the fix rather than just refusing. */}
      {currentRole && !roleUsesAssignments(currentRole) && (
        <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-warning-900">
                {stakeholderName || 'This person'} is on the{' '}
                {currentTrackLabel || 'current'} track and will not see anything assigned here.
              </p>
              <p className="mt-1 text-xs text-warning-800">
                Assignments are only used by the field and launch-partner dashboards. Anything
                added now stays on the record but does nothing until the track changes.
              </p>
              {assignableTracks.length > 0 && onChangeTrack && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-warning-800">Change track to:</span>
                  {assignableTracks.map((t) => (
                    <button
                      key={t.id}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          await onChangeTrack(t)
                          setMessage(`Track changed to ${t.name}.`)
                        } finally {
                          setBusy(false)
                        }
                      }}
                      className="rounded-full border border-warning-300 bg-white px-2.5 py-1 text-xs font-medium text-warning-900 hover:bg-warning-100 disabled:opacity-50"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-surface-900">Assignments</h2>
          <p className="mt-1 text-xs text-surface-500">
            What {stakeholderName || 'this person'} owns. Cities and campaigns scope which
            businesses and causes they see.
          </p>
        </div>
        <Button
          size="sm"
          variant={picking ? 'outline' : 'default'}
          onClick={() => setPicking((v) => !v)}
        >
          {picking ? 'Cancel' : <><Plus className="h-3.5 w-3.5" /> Assign</>}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = assignments.filter((a) => a.entity_type === t.key).length
          const active = t.key === tab
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPicking(false); setSearch('') }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-surface-200 text-surface-600 hover:bg-surface-50'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {count > 0 && <span className="text-surface-400">({count})</span>}
            </button>
          )
        })}
      </div>

      {message && (
        <p className="mt-3 rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-700">{message}</p>
      )}

      {picking && (
        <div className="mt-4 rounded-xl border border-surface-200 p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab}s…`}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-1 py-2 text-xs text-surface-500">
                {options.length === 0 ? `No ${tab}s available.` : 'Nothing left to assign.'}
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.id)}
                  disabled={busy}
                  onClick={() => void assign(o.id, o.name)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50 disabled:opacity-50"
                >
                  <span className="truncate">{o.name}</span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {current.length === 0 ? (
          <p className="text-xs text-surface-500">
            No {tab} assignments.
            {tab === 'city' && ' Field and launch-partner dashboards use city assignments to decide what this person sees.'}
          </p>
        ) : (
          current.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-surface-200 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-surface-900">
                  {nameFor(String(a.entity_id))}
                </p>
                {a.status && (
                  <Badge variant="outline" className="mt-1 text-[10px]">{a.status}</Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void unassign(a.id, nameFor(String(a.entity_id)))}
                title="Remove this assignment"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
