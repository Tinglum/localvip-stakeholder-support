'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Briefcase,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  Save,
  Send,
  Shield,
  Store,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BRANDS } from '@/lib/constants'
import {
  useAuditLogInsert,
  useBusinesses,
  useCampaigns,
  useCauses,
  useCities,
  useCityAccessRequests,
  useOrganizations,
  useOutreach,
  useProfileUpdate,
  useRecord,
  useStakeholderAssignments,
  useTasks,
} from '@/lib/supabase/hooks'
import {
  CANONICAL_STAKEHOLDER_ROLES,
  getStakeholderAccess,
  getPersistedRoleForShell,
  getSubtypeOptionsForRole,
  normalizeSubtypeForRole,
} from '@/lib/stakeholder-access'
import type {
  Brand,
  EntityStatus,
  Profile,
  UserRole,
  UserRoleSubtype,
} from '@/lib/types/database'
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

function getSubtypeLabel(subtype: UserRoleSubtype) {
  if (subtype === 'intern') return 'Intern'
  if (subtype === 'volunteer') return 'Volunteer'
  if (subtype === 'school') return 'School'
  if (subtype === 'cause') return 'Cause'
  if (subtype === 'super') return 'Super'
  if (subtype === 'internal') return 'Internal'
  return 'None'
}

export default function UserDetailPage() {
  const params = useParams()
  const userId = params.id as string
  const { data: user, loading } = useRecord<Profile>('profiles', userId)
  const { data: cities } = useCities()
  const { data: organizations } = useOrganizations()
  const { data: assignments } = useStakeholderAssignments({ stakeholder_id: userId })
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { data: campaigns } = useCampaigns()
  const { data: tasks } = useTasks()
  const { data: outreach } = useOutreach()
  const { data: cityRequests } = useCityAccessRequests({ requester_id: userId })
  const { update, loading: saving, error: saveError } = useProfileUpdate()
  const { insert: insertAudit } = useAuditLogInsert()

  const [role, setRole] = React.useState<UserRole>('field')
  const [subtype, setSubtype] = React.useState<UserRoleSubtype>('intern')
  const [brand, setBrand] = React.useState<Brand>('localvip')
  const [status, setStatus] = React.useState<EntityStatus>('active')
  const [cityId, setCityId] = React.useState<string>('none')
  const [organizationId, setOrganizationId] = React.useState<string>('none')
  const [businessId, setBusinessId] = React.useState<string>('none')
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null)
  const [viewUser, setViewUser] = React.useState<Profile | null>(null)

  React.useEffect(() => {
    setViewUser(user || null)
  }, [user])

  React.useEffect(() => {
    if (!viewUser) return
    const normalizedRole = getStakeholderAccess(viewUser).themeRole
    setRole(
      ['admin', 'business', 'field', 'launch_partner', 'community', 'influencer'].includes(normalizedRole)
        ? (normalizedRole as UserRole)
        : 'field'
    )
    setSubtype(normalizeSubtypeForRole(normalizedRole, viewUser.role_subtype || null))
    setBrand(viewUser.brand_context)
    setStatus(viewUser.status)
    setCityId(viewUser.city_id || 'none')
    setOrganizationId(viewUser.organization_id || 'none')
    setBusinessId(viewUser.business_id || 'none')
  }, [viewUser])

  const currentUser = viewUser
  const access = React.useMemo(
    () => (currentUser ? getStakeholderAccess(currentUser) : null),
    [currentUser]
  )
  const city = React.useMemo(
    () => cities.find((item) => item.id === currentUser?.city_id),
    [cities, currentUser?.city_id]
  )
  const organization = React.useMemo(
    () => organizations.find((item) => item.id === currentUser?.organization_id),
    [organizations, currentUser?.organization_id]
  )

  const ownedBusinesses = React.useMemo(
    () => businesses.filter((item) => item.owner_id === userId || item.owner_user_id === userId),
    [businesses, userId]
  )
  const ownedCauses = React.useMemo(
    () => causes.filter((item) => item.owner_id === userId),
    [causes, userId]
  )
  const ownedCampaigns = React.useMemo(
    () => campaigns.filter((item) => item.owner_id === userId),
    [campaigns, userId]
  )
  const scopedBusiness = React.useMemo(
    () => businesses.find((item) => item.id === currentUser?.business_id),
    [businesses, currentUser?.business_id]
  )
  const selectedCity = React.useMemo(
    () => cities.find((item) => item.id === cityId),
    [cities, cityId]
  )
  const selectedOrganization = React.useMemo(
    () => organizations.find((item) => item.id === organizationId),
    [organizations, organizationId]
  )
  const selectedBusiness = React.useMemo(
    () => businesses.find((item) => item.id === businessId),
    [businesses, businessId]
  )
  const userTasks = React.useMemo(
    () => tasks.filter((item) => item.assigned_to === userId || item.created_by === userId).slice(0, 8),
    [tasks, userId]
  )
  const userOutreach = React.useMemo(
    () => outreach.filter((item) => item.performed_by === userId).slice(0, 8),
    [outreach, userId]
  )
  const assignmentLabels = React.useMemo(() => {
    const cityMap = new Map(cities.map((item) => [item.id, `${item.name}, ${item.state}`]))
    const businessMap = new Map(businesses.map((item) => [item.id, item.name]))
    const causeMap = new Map(causes.map((item) => [item.id, item.name]))
    const campaignMap = new Map(campaigns.map((item) => [item.id, item.name]))

    return assignments.map((assignment) => {
      const label =
        assignment.entity_type === 'city'
          ? cityMap.get(assignment.entity_id)
          : assignment.entity_type === 'business'
            ? businessMap.get(assignment.entity_id)
            : assignment.entity_type === 'cause'
              ? causeMap.get(assignment.entity_id)
              : campaignMap.get(assignment.entity_id)

      return {
        assignment,
        label: label || assignment.entity_id,
      }
    })
  }, [assignments, businesses, campaigns, causes, cities])

  async function handleSaveAccess() {
    if (!currentUser) return

    const nextSubtype = normalizeSubtypeForRole(role, subtype)
    const persistedRole = getPersistedRoleForShell(getStakeholderAccess({ ...currentUser, role } as Profile).shell, nextSubtype)
    const nextMetadata = { ...(currentUser.metadata || {}) } as Record<string, unknown>
    if (role === 'business') {
      nextMetadata.portal_role = 'business'
    } else if ('portal_role' in nextMetadata) {
      delete nextMetadata.portal_role
    }
    const updates = {
      role: persistedRole,
      role_subtype: nextSubtype,
      brand_context: brand,
      status,
      city_id: cityId === 'none' ? null : cityId,
      organization_id: organizationId === 'none' ? null : organizationId,
      business_id: businessId === 'none' ? null : businessId,
      metadata: nextMetadata,
    }

    const updated = await update(userId, updates)
    if (!updated) {
      setSaveMessage(saveError || 'Could not save access changes. Please try again.')
      return
    }

    setViewUser(updated)

    await insertAudit({
      user_id: userId,
      action: 'updated_user_access',
      entity_type: 'profile',
      entity_id: userId,
      old_values: {
        role: currentUser.role,
        role_subtype: currentUser.role_subtype || null,
        brand_context: currentUser.brand_context,
        status: currentUser.status,
        city_id: currentUser.city_id,
        organization_id: currentUser.organization_id,
        business_id: currentUser.business_id || null,
      },
      new_values: {
        role: persistedRole,
        shell: role,
        role_subtype: nextSubtype,
        brand_context: brand,
        status,
        city_id: cityId === 'none' ? null : cityId,
        organization_id: organizationId === 'none' ? null : organizationId,
        business_id: businessId === 'none' ? null : businessId,
      },
      ip_address: null,
      metadata: {
        updated_via: 'admin_user_detail',
      },
    })

    setSaveMessage('Access updated successfully.')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading user...</span>
      </div>
    )
  }

  if (!currentUser || !access) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="User not found"
        description="This profile could not be loaded."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={currentUser.full_name}
        description="Role, scope, assignments, and recent activity for this stakeholder."
        breadcrumb={[
          { label: 'Admin', href: '/admin/users' },
          { label: 'Users', href: '/admin/users' },
          { label: currentUser.full_name },
        ]}
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-surface-50 via-white to-surface-100 px-6 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar name={currentUser.full_name} src={currentUser.avatar_url} size="lg" />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ROLE_BADGE_VARIANT[currentUser.role] || 'default'}>
                    <Shield className="h-3 w-3" /> {access.label}
                  </Badge>
                  <Badge variant={currentUser.brand_context === 'hato' ? 'hato' : 'info'}>
                    {BRANDS[currentUser.brand_context]?.label || currentUser.brand_context}
                  </Badge>
                  <Badge variant={currentUser.status === 'active' ? 'success' : 'default'} dot>
                    {currentUser.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
                  <a href={`mailto:${currentUser.email}`} className="inline-flex items-center gap-1 hover:text-surface-900">
                    <Mail className="h-4 w-4" /> {currentUser.email}
                  </a>
                  {city && (
                    <Link href={`/crm/cities/${city.id}`} className="inline-flex items-center gap-1 hover:text-surface-900">
                      <MapPin className="h-4 w-4" /> {city.name}, {city.state}
                    </Link>
                  )}
                  {organization && (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-4 w-4" /> {organization.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Shell</p>
                <p className="mt-1 text-lg font-semibold text-surface-900">{access.label}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Subtype</p>
                <p className="mt-1 text-lg font-semibold text-surface-900">{getSubtypeLabel(currentUser.role_subtype || null)}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Assignments</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{assignments.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">City requests</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{cityRequests.length}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Access & Scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {saveMessage && (
              <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
                {saveMessage}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Stakeholder shell</label>
                <Select value={role} onValueChange={(value) => {
                  const nextRole = value as UserRole
                  setRole(nextRole)
                  setSubtype(normalizeSubtypeForRole(nextRole, subtype))
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANONICAL_STAKEHOLDER_ROLES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Subtype</label>
                <Select value={subtype || 'none'} onValueChange={(value) => setSubtype(value === 'none' ? null : (value as UserRoleSubtype))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No subtype</SelectItem>
                    {getSubtypeOptionsForRole(role).map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Brand</label>
                <Select value={brand} onValueChange={(value) => setBrand(value as Brand)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BRANDS).map(([key, option]) => (
                      <SelectItem key={key} value={key}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Status</label>
                <Select value={status} onValueChange={(value) => setStatus(value as EntityStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Home city</label>
                <Select value={cityId} onValueChange={setCityId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No city</SelectItem>
                    {cities.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.name}, {option.state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Organization</label>
                <Select value={organizationId} onValueChange={setOrganizationId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No organization</SelectItem>
                    {organizations.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Scoped business</label>
                <Select value={businessId} onValueChange={setBusinessId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No business scope</SelectItem>
                    {businesses.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 text-sm text-surface-600">
              <p className="font-medium text-surface-900">Current scope</p>
              <ul className="mt-2 space-y-1.5">
                <li>Business: {selectedBusiness ? selectedBusiness.name : 'None assigned'}</li>
                <li>Organization: {selectedOrganization?.name || 'None assigned'}</li>
                <li>City: {selectedCity ? `${selectedCity.name}, ${selectedCity.state}` : 'None assigned'}</li>
              </ul>
            </div>

            <Button onClick={handleSaveAccess} disabled={saving}>
              <Save className="h-4 w-4" />
              Save Access Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignments & Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {assignmentLabels.length > 0 ? assignmentLabels.map(({ assignment, label }) => (
                <div key={assignment.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{label}</p>
                      <p className="mt-1 text-xs text-surface-500 capitalize">
                        {assignment.entity_type}
                        {assignment.role ? ` • ${assignment.role}` : ''}
                      </p>
                    </div>
                    <Badge variant={assignment.status === 'active' ? 'success' : 'default'} dot>
                      {assignment.status}
                    </Badge>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-surface-500">No direct assignments found for this user.</p>
              )}
            </div>

            <div className="border-t border-surface-200 pt-4">
              <p className="text-sm font-semibold text-surface-900">City access requests</p>
              <div className="mt-3 space-y-3">
                {cityRequests.length > 0 ? cityRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-surface-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{request.requested_city_name}</p>
                        <p className="mt-1 text-xs text-surface-500">{request.reason || 'No reason added'}</p>
                      </div>
                      <Badge variant={request.status === 'approved' ? 'success' : request.status === 'declined' ? 'danger' : 'warning'}>
                        {request.status}
                      </Badge>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-surface-500">No city access requests yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Owned Records</p>
            </div>
            <div className="space-y-3">
              {ownedBusinesses.slice(0, 4).map((business) => (
                <Link key={business.id} href={`/crm/businesses/${business.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                  <p className="font-medium text-surface-900">{business.name}</p>
                  <p className="text-sm text-surface-500">{business.category || 'Business'}</p>
                </Link>
              ))}
              {ownedCauses.slice(0, 4).map((cause) => (
                <Link key={cause.id} href={`/crm/causes/${cause.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                  <p className="font-medium text-surface-900">{cause.name}</p>
                  <p className="text-sm text-surface-500">{cause.type}</p>
                </Link>
              ))}
              {ownedCampaigns.slice(0, 4).map((campaign) => (
                <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                  <p className="font-medium text-surface-900">{campaign.name}</p>
                  <p className="text-sm text-surface-500">{campaign.description || 'Campaign record'}</p>
                </Link>
              ))}
              {ownedBusinesses.length === 0 && ownedCauses.length === 0 && ownedCampaigns.length === 0 && (
                <p className="text-sm text-surface-400">This user does not currently own businesses, causes, or campaigns.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Recent Tasks</p>
            </div>
            {userTasks.length > 0 ? (
              <div className="space-y-3">
                {userTasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <p className="font-medium text-surface-900">{task.title}</p>
                    <p className="mt-1 text-sm text-surface-500">{task.description || 'No description provided.'}</p>
                    <p className="mt-2 text-xs text-surface-400">
                      {task.due_date ? `Due ${formatDate(task.due_date)}` : `Created ${formatDate(task.created_at)}`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No tasks found for this user.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Recent Outreach</p>
            </div>
            {userOutreach.length > 0 ? (
              <div className="space-y-3">
                {userOutreach.map((activity) => (
                  <div key={activity.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-surface-900">{activity.subject || activity.type.replace('_', ' ')}</p>
                      <Badge variant="default">{activity.type.replace('_', ' ')}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-surface-500">{activity.body || activity.outcome || 'No details captured.'}</p>
                    <p className="mt-2 text-xs text-surface-400">{formatDate(activity.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No outreach logged by this user yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Quick Links</p>
            </div>
            <div className="space-y-3">
              {city && (
                <Link href={`/crm/cities/${city.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                  <p className="font-medium text-surface-900">Open home city</p>
                  <p className="text-sm text-surface-500">{city.name}, {city.state}</p>
                </Link>
              )}
              {organization && (
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="font-medium text-surface-900">Organization</p>
                  <p className="text-sm text-surface-500">{organization.name}</p>
                </div>
              )}
              {scopedBusiness && (
                <Link href={`/crm/businesses/${scopedBusiness.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                  <p className="font-medium text-surface-900">Scoped business</p>
                  <p className="text-sm text-surface-500">{scopedBusiness.name}</p>
                </Link>
              )}
              {!city && !organization && !scopedBusiness && (
                <p className="text-sm text-surface-400">No direct scope links are set on this stakeholder yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
