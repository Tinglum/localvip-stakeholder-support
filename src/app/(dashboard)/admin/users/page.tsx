'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CheckCircle2,
  Mail,
  MapPin,
  Plus,
  Shield,
  Users,
  XCircle,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BRANDS } from '@/lib/constants'
import { useAuth } from '@/lib/auth/context'
import {
  useAuditLogInsert,
  useCities,
  useCityAccessRequests,
  useCityAccessRequestUpdate,
  useCityInsert,
  useProfiles,
  useStakeholderAssignmentInsert,
  useStakeholderAssignments,
} from '@/lib/supabase/hooks'
import {
  CANONICAL_STAKEHOLDER_ROLES,
  getStakeholderAccess,
  getSubtypeOptionsForRole,
  normalizeSubtypeForRole,
} from '@/lib/stakeholder-access'
import type { CityAccessRequest, Profile, UserRole, UserRoleSubtype } from '@/lib/types/database'
import { formatDate } from '@/lib/utils'

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  admin: 'danger',
  super_admin: 'danger',
  internal_admin: 'warning',
  business: 'success',
  launch_partner: 'warning',
  business_onboarding: 'warning',
  field: 'info',
  intern: 'info',
  volunteer: 'info',
  community: 'default',
  school_leader: 'default',
  cause_leader: 'default',
  influencer: 'default',
  affiliate: 'default',
}

function parseRequestedCityName(requestedCityName: string) {
  const [namePart, statePart] = requestedCityName
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    name: namePart || requestedCityName.trim(),
    state: statePart || 'TBD',
  }
}

function getSubtypeLabel(subtype: UserRoleSubtype) {
  if (subtype === 'intern') return 'Intern'
  if (subtype === 'volunteer') return 'Volunteer'
  if (subtype === 'school') return 'School'
  if (subtype === 'cause') return 'Cause'
  if (subtype === 'super') return 'Super'
  if (subtype === 'internal') return 'Internal'
  return 'None'
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { isAdmin, profile } = useAuth()
  const { data: users, loading } = useProfiles()
  const { data: cities, refetch: refetchCities } = useCities()
  const { data: requests, refetch: refetchRequests } = useCityAccessRequests()
  const { data: assignments, refetch: refetchAssignments } = useStakeholderAssignments()
  const { update: updateRequest } = useCityAccessRequestUpdate()
  const { insert: insertAssignment } = useStakeholderAssignmentInsert()
  const { insert: insertCity } = useCityInsert()
  const { insert: insertAudit } = useAuditLogInsert()
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteFullName, setInviteFullName] = React.useState('')
  const [inviteNotes, setInviteNotes] = React.useState('')
  const [inviteBrand, setInviteBrand] = React.useState<'localvip' | 'hato'>('localvip')
  const [inviteRole, setInviteRole] = React.useState<UserRole>('field')
  const [inviteSubtype, setInviteSubtype] = React.useState<UserRoleSubtype>('intern')
  const [inviteLoading, setInviteLoading] = React.useState(false)
  const [inviteFeedback, setInviteFeedback] = React.useState<string | null>(null)
  const [processingRequestId, setProcessingRequestId] = React.useState<string | null>(null)
  const [requestFeedback, setRequestFeedback] = React.useState<string | null>(null)

  const profileById = React.useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )

  const roleCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const user of users) {
      const shell = getStakeholderAccess(user).shell
      counts[shell] = (counts[shell] || 0) + 1
    }
    return counts
  }, [users])

  const pendingRequests = React.useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests]
  )

  async function handleRequestReview(request: CityAccessRequest, nextStatus: 'approved' | 'declined') {
    setProcessingRequestId(request.id)
    setRequestFeedback(null)

    const requester = profileById.get(request.requester_id)
    let resolvedCityId = request.requested_city_id

    if (nextStatus === 'approved' && !resolvedCityId) {
      const matchedCity = cities.find(
        (city) => city.name.trim().toLowerCase() === request.requested_city_name.trim().toLowerCase()
      )

      if (matchedCity) {
        resolvedCityId = matchedCity.id
      } else {
        const parsedCity = parseRequestedCityName(request.requested_city_name)
        const createdCity = await insertCity({
          name: parsedCity.name,
          state: parsedCity.state,
          country: 'US',
          status: 'pending',
          metadata: {
            created_from_city_request: true,
            requester_id: request.requester_id,
          },
        })

        resolvedCityId = createdCity?.id || null
      }
    }

    const reviewedRequest = await updateRequest(request.id, {
      status: nextStatus,
      requested_city_id: resolvedCityId,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      metadata: {
        ...(request.metadata || {}),
        review_action: nextStatus,
      },
    })

    if (reviewedRequest && nextStatus === 'approved' && resolvedCityId) {
      const hasAssignment = assignments.some((assignment) =>
        assignment.stakeholder_id === request.requester_id
        && assignment.entity_type === 'city'
        && assignment.entity_id === resolvedCityId
        && assignment.status === 'active'
      )

      if (!hasAssignment) {
        await insertAssignment({
          stakeholder_id: request.requester_id,
          entity_type: 'city',
          entity_id: resolvedCityId,
          role: 'launch_partner',
          assigned_by: profile.id,
          status: 'active',
        })
      }
    }

    if (reviewedRequest) {
      await insertAudit({
        user_id: profile.id,
        action: nextStatus === 'approved' ? 'approved_city_access_request' : 'declined_city_access_request',
        entity_type: 'city_access_request',
        entity_id: request.id,
        old_values: { status: request.status },
        new_values: { status: nextStatus, requested_city_id: resolvedCityId },
        ip_address: null,
        metadata: {
          requester_id: request.requester_id,
          requester_email: requester?.email || null,
          requested_city_name: request.requested_city_name,
        },
      })
      setRequestFeedback(
        nextStatus === 'approved'
          ? `Approved ${request.requested_city_name} and updated access.`
          : `Declined the request for ${request.requested_city_name}.`
      )
      refetchRequests({ silent: true })
      refetchAssignments({ silent: true })
      refetchCities({ silent: true })
    } else {
      setRequestFeedback(`Could not update ${request.requested_city_name}. Please try again.`)
    }

    setProcessingRequestId(null)
  }

  async function handleInviteSubmit(event: React.FormEvent) {
    event.preventDefault()
    setInviteLoading(true)
    setInviteFeedback(null)

    const response = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail,
        fullName: inviteFullName,
        notes: inviteNotes,
        brand: inviteBrand,
        role: inviteRole,
        roleSubtype: inviteSubtype,
      }),
    })

    const payload = await response.json().catch(() => ({ error: 'Invite failed.' }))

    if (!response.ok) {
      setInviteFeedback(payload.error || 'Invite failed.')
      setInviteLoading(false)
      return
    }

    setInviteFeedback(`Invite sent to ${payload.invitedEmail}.`)
    setInviteEmail('')
    setInviteFullName('')
    setInviteNotes('')
    setInviteBrand('localvip')
    setInviteRole('field')
    setInviteSubtype('intern')
    setInviteLoading(false)
  }

  const columns: Column<Profile>[] = [
    {
      key: 'full_name',
      header: 'User',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.full_name} src={row.avatar_url} size="sm" />
          <div>
            <p className="font-medium text-surface-800">{row.full_name}</p>
            <p className="text-xs text-surface-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Shell',
      sortable: true,
      render: (row) => {
        const access = getStakeholderAccess(row)
        return (
          <div className="space-y-1">
            <Badge variant={ROLE_BADGE_VARIANT[row.role] || 'default'}>
              <Shield className="h-3 w-3" /> {access.label}
            </Badge>
            <p className="text-xs text-surface-500">{access.shell.replace('_', ' ')}</p>
          </div>
        )
      },
    },
    {
      key: 'role_subtype',
      header: 'Subtype',
      render: (row) => (
        <span className="text-sm text-surface-600">{getSubtypeLabel(row.role_subtype || null)}</span>
      ),
    },
    {
      key: 'brand_context',
      header: 'Brand',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BRANDS[row.brand_context]?.color }} />
          <span className="text-sm text-surface-600">{BRANDS[row.brand_context]?.label || row.brand_context}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'default'} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-1 text-sm text-surface-500">
          <Calendar className="h-3.5 w-3.5" /> {formatDate(row.created_at)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Access"
        description="Manage stakeholder shells, review city access requests, and keep LocalVIP permissions clean."
        actions={
          isAdmin ? (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4" /> Invite User
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {CANONICAL_STAKEHOLDER_ROLES.map((role) => (
          <Card key={role.value}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{role.label}</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{roleCounts[role.value] || 0}</p>
              <p className="mt-2 text-xs leading-5 text-surface-500">{role.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-surface-200">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Pending City Access Requests</CardTitle>
            <p className="mt-1 text-sm text-surface-500">
              Launch partner expansion requests stay here until an admin approves or declines them.
            </p>
          </div>
          <Badge variant={pendingRequests.length > 0 ? 'warning' : 'success'} dot>
            {pendingRequests.length} pending
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {requestFeedback && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
              {requestFeedback}
            </div>
          )}

          {pendingRequests.length === 0 ? (
            <p className="text-sm text-surface-500">No city access requests need review right now.</p>
          ) : (
            pendingRequests.map((request) => {
              const requester = profileById.get(request.requester_id)
              const matchedCity = cities.find((city) => city.id === request.requested_city_id)
                || cities.find((city) => city.name.trim().toLowerCase() === request.requested_city_name.trim().toLowerCase())
              const isProcessing = processingRequestId === request.id

              return (
                <div key={request.id} className="rounded-3xl border border-surface-200 bg-surface-50 px-5 py-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning">Pending</Badge>
                        <Badge variant={matchedCity ? 'info' : 'default'}>
                          {matchedCity ? 'Existing city found' : 'Will create pending city'}
                        </Badge>
                      </div>
                      <p className="text-base font-semibold text-surface-900">{request.requested_city_name}</p>
                      <p className="text-sm text-surface-600">
                        Requested by {requester?.full_name || 'Unknown user'}
                        {requester?.email ? ` (${requester.email})` : ''}
                      </p>
                      <p className="text-sm leading-6 text-surface-500">
                        {request.reason || 'No reason provided.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {matchedCity ? `${matchedCity.name}, ${matchedCity.state}` : 'No city record yet'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(request.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => handleRequestReview(request, 'declined')}
                      >
                        <XCircle className="h-4 w-4" />
                        Decline
                      </Button>
                      <Button
                        disabled={isProcessing}
                        onClick={() => handleRequestReview(request, 'approved')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <DataTable<Profile>
        data={users}
        columns={columns}
        keyField="id"
        searchable
        searchPlaceholder="Search users, shells, or stakeholder access..."
        loading={loading}
        onRowClick={(user) => router.push(`/admin/users/${user.id}`)}
        emptyState={
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No users found"
            description="Invite team members to get started."
            action={isAdmin ? { label: 'Invite User', onClick: () => setInviteOpen(true) } : undefined}
          />
        }
      />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Invite a stakeholder into one of the new access shells. The server-side invite flow still needs a secure API route, but this keeps the admin workflow aligned to the updated role model.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleInviteSubmit}
            className="space-y-4"
          >
            {inviteFeedback && (
              <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
                {inviteFeedback}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Email *</label>
              <Input type="email" placeholder="user@example.com" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Full Name *</label>
              <Input placeholder="Full name" required value={inviteFullName} onChange={(event) => setInviteFullName(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Notes</label>
              <Textarea placeholder="Optional context for this stakeholder..." rows={3} value={inviteNotes} onChange={(event) => setInviteNotes(event.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Stakeholder shell</label>
                <Select
                  value={inviteRole}
                  onValueChange={(value) => {
                    const nextRole = value as UserRole
                    setInviteRole(nextRole)
                    setInviteSubtype(normalizeSubtypeForRole(nextRole, null))
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANONICAL_STAKEHOLDER_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Subtype</label>
                <Select
                  value={inviteSubtype || 'none'}
                  onValueChange={(value) => setInviteSubtype(value === 'none' ? null : (value as UserRoleSubtype))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No subtype</SelectItem>
                    {getSubtypeOptionsForRole(inviteRole).map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Brand</label>
              <Select value={inviteBrand} onValueChange={(value) => setInviteBrand(value as 'localvip' | 'hato')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BRANDS).map(([key, brand]) => (
                    <SelectItem key={key} value={key}>{brand.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={inviteLoading}>
                <Mail className="h-4 w-4" /> Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
