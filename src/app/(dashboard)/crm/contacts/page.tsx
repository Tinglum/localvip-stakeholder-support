'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Mail, Phone, Building2, Heart, AlertTriangle, UserCheck, Search } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useContacts, useContactInsert, useBusinesses, useCauses } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import type { Contact } from '@/lib/types/database'

const SOURCE_OPTIONS = [
  'referral',
  'walk-in',
  'website',
  'social_media',
  'event',
  'cold_outreach',
  'other',
] as const

const INITIAL_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  title: '',
  source: '',
  org_type: '' as 'business' | 'cause' | '',
  org_id: '',
}

interface UserSearchResult {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  phoneNumber: string | null
  accountType?: number
  consumerType?: string
  referralCode?: string | null
}

interface DuplicateMatch {
  source: 'contact' | 'user'
  id: number
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  title?: string | null
  accountType?: number
  status?: string
}

export default function ContactsPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [statusFilter, setStatusFilter] = React.useState<string>('')

  // Build filters object — only include non-empty values
  const filters = React.useMemo(() => {
    const f: Record<string, string> = {}
    if (statusFilter) f.status = statusFilter
    return f
  }, [statusFilter])

  const { data: contacts, loading, error, refetch } = useContacts(filters)
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { insert, loading: inserting } = useContactInsert()

  const [addOpen, setAddOpen] = React.useState(false)
  const [form, setForm] = React.useState(INITIAL_FORM)
  const [formError, setFormError] = React.useState<string | null>(null)

  // ── User search + duplicate detection ─────────────────────────────
  const [userQuery, setUserQuery] = React.useState('')
  const [userResults, setUserResults] = React.useState<UserSearchResult[]>([])
  const [pickedUser, setPickedUser] = React.useState<UserSearchResult | null>(null)
  const [duplicateMatches, setDuplicateMatches] = React.useState<DuplicateMatch[]>([])

  // Debounced user search
  React.useEffect(() => {
    if (!addOpen || pickedUser || userQuery.trim().length < 2) {
      setUserResults([])
      return
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/qa/users/search?q=${encodeURIComponent(userQuery)}`)
        if (res.ok) {
          const data = (await res.json()) as UserSearchResult[]
          setUserResults(Array.isArray(data) ? data : [])
        }
      } catch {
        setUserResults([])
      }
    }, 300)
    return () => window.clearTimeout(handle)
  }, [userQuery, addOpen, pickedUser])

  // Debounced duplicate check based on name/email/phone of form
  React.useEffect(() => {
    if (!addOpen || pickedUser) {
      setDuplicateMatches([])
      return
    }
    const params = new URLSearchParams()
    if (form.email.trim()) params.append('email', form.email.trim())
    if (form.phone.trim()) params.append('phone', form.phone.trim())
    if (form.first_name.trim()) params.append('firstName', form.first_name.trim())
    if (form.last_name.trim()) params.append('lastName', form.last_name.trim())
    if (![...params.keys()].length) {
      setDuplicateMatches([])
      return
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/qa/contacts/check-duplicate?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json() as {
          hasDuplicates: boolean
          contactMatches: DuplicateMatch[]
          userMatches: DuplicateMatch[]
        }
        const combined = [
          ...(data.contactMatches || []),
          ...(data.userMatches || []),
        ]
        setDuplicateMatches(combined)
      } catch {
        setDuplicateMatches([])
      }
    }, 400)
    return () => window.clearTimeout(handle)
  }, [form.email, form.phone, form.first_name, form.last_name, addOpen, pickedUser])

  // When a user is picked, prefill the contact form from them
  React.useEffect(() => {
    if (!pickedUser) return
    setForm((prev) => ({
      ...prev,
      first_name: pickedUser.firstName || '',
      last_name: pickedUser.lastName || '',
      email: pickedUser.email || '',
      phone: pickedUser.phoneNumber || '',
    }))
  }, [pickedUser])

  // Look up organization name for a contact
  const orgLookup = React.useCallback(
    (c: Contact): { name: string; type: 'business' | 'cause' } | null => {
      if (c.business_id) {
        const biz = businesses.find((b) => b.id === c.business_id)
        if (biz) return { name: biz.name, type: 'business' }
      }
      if (c.cause_id) {
        const cause = causes.find((ca) => ca.id === c.cause_id)
        if (cause) return { name: cause.name, type: 'cause' }
      }
      return null
    },
    [businesses, causes],
  )

  const handleFieldChange = (field: keyof typeof INITIAL_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Enforce: every contact must be linked to a business OR a cause
    if (!form.org_type || !form.org_id) {
      setFormError('Each contact must be linked to a business or a cause. Pick one above.')
      return
    }

    // Path A: An existing user was picked — call the dedicated link-user endpoint
    // so the contact is tied to that AspNetUser.Id via OwnerUserId in the backend.
    if (pickedUser) {
      try {
        const res = await fetch('/api/qa/contacts/link-user', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            userId: pickedUser.id,
            businessAccountId: form.org_type === 'business' ? Number(form.org_id) : null,
            causeAccountId: form.org_type === 'cause' ? Number(form.org_id) : null,
            title: form.title.trim() || null,
            source: form.source || null,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setFormError((body as { error?: string }).error || 'Failed to link user as contact.')
          return
        }
      } catch {
        setFormError('Failed to link user as contact.')
        return
      }
      setAddOpen(false)
      setForm(INITIAL_FORM)
      setPickedUser(null)
      setUserQuery('')
      refetch()
      return
    }

    // Path B: Brand-new contact — go through the standard hook
    const record: Partial<Contact> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      title: form.title.trim() || null,
      source: form.source || null,
      owner_id: profile.id,
      status: 'active',
      business_id: form.org_type === 'business' ? form.org_id : null,
      cause_id: form.org_type === 'cause' ? form.org_id : null,
    }

    const result = await insert(record)
    if (result) {
      setAddOpen(false)
      setForm(INITIAL_FORM)
      setPickedUser(null)
      setUserQuery('')
      refetch()
    } else {
      setFormError('Failed to create contact. Please try again.')
    }
  }

  const columns: Column<Contact>[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      render: (c) => (
        <span className="font-medium text-surface-900">{c.first_name} {c.last_name}</span>
      ),
    },
    {
      key: 'email', header: 'Email', sortable: true,
      render: (c) => c.email ? (
        <span className="flex items-center gap-1 text-surface-600">
          <Mail className="h-3.5 w-3.5 text-surface-400" />{c.email}
        </span>
      ) : <span className="text-surface-300">—</span>,
    },
    {
      key: 'phone', header: 'Phone',
      render: (c) => c.phone ? (
        <span className="flex items-center gap-1 text-surface-600">
          <Phone className="h-3.5 w-3.5 text-surface-400" />{c.phone}
        </span>
      ) : <span className="text-surface-300">—</span>,
    },
    { key: 'title', header: 'Title', render: (c) => <span className="text-surface-600">{c.title || '—'}</span> },
    {
      key: 'organization', header: 'Organization', sortable: true,
      render: (c) => {
        const org = orgLookup(c)
        return org ? (
          <span className="flex items-center gap-1.5 text-surface-700">
            {org.type === 'business'
              ? <Building2 className="h-3.5 w-3.5 text-surface-400" />
              : <Heart className="h-3.5 w-3.5 text-hato-500" />}
            {org.name}
          </span>
        ) : <span className="text-surface-300">—</span>
      },
    },
    {
      key: 'source', header: 'Source',
      render: (c) => c.source
        ? <Badge variant="default">{c.source}</Badge>
        : <span className="text-surface-300">—</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (c) => <Badge variant={c.status === 'active' ? 'success' : 'default'} dot>{c.status}</Badge>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="People connected to businesses and causes. The humans behind the relationships."
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Contact</Button>}
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={contacts}
        keyField="id"
        loading={loading}
        searchPlaceholder="Search by name, email, or organization..."
        emptyState={
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No contacts yet"
            description="Add contacts to track your relationships."
            action={{ label: 'Add Contact', onClick: () => setAddOpen(true) }}
          />
        }
      />

      {/* Add Contact Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => {
        setAddOpen(open)
        if (!open) {
          setForm(INITIAL_FORM)
          setFormError(null)
          setPickedUser(null)
          setUserQuery('')
          setUserResults([])
          setDuplicateMatches([])
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Contacts are the humans behind a business or cause. Search for an existing user first — if they
              already have an account, link them directly. Otherwise fill in the details below.
            </DialogDescription>
          </DialogHeader>

          {/* User search / pick existing */}
          <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-900">
              <Search className="h-4 w-4" /> Search for an existing user
            </div>
            {pickedUser ? (
              <div className="flex items-center justify-between rounded-md border border-blue-300 bg-white p-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium text-surface-900">
                      {pickedUser.firstName} {pickedUser.lastName}
                    </div>
                    <div className="text-xs text-surface-600">
                      {pickedUser.email}
                      {pickedUser.referralCode && <span className="ml-2 text-blue-600">code: {pickedUser.referralCode}</span>}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setPickedUser(null); setUserQuery('') }}
                >
                  Clear
                </Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Type at least 2 characters of name, email, or phone…"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
                {userResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-blue-200 bg-white">
                    {userResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setPickedUser(u)}
                        className="flex w-full items-center justify-between gap-2 border-b border-blue-100 p-2 text-left text-sm hover:bg-blue-50 last:border-b-0"
                      >
                        <div>
                          <div className="font-medium text-surface-900">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-surface-600">{u.email}{u.phoneNumber ? ` • ${u.phoneNumber}` : ''}</div>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">Pick</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Duplicate warning panel */}
          {duplicateMatches.length > 0 && !pickedUser && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" /> {duplicateMatches.length} possible duplicate{duplicateMatches.length === 1 ? '' : 's'} found
              </div>
              <div className="space-y-1 text-xs">
                {duplicateMatches.slice(0, 4).map((m) => (
                  <div key={`${m.source}-${m.id}`} className="flex items-center justify-between rounded bg-white/60 px-2 py-1">
                    <div>
                      <span className="font-medium text-amber-900">{m.firstName} {m.lastName}</span>
                      <span className="ml-2 text-amber-700">{m.email || m.phone || '—'}</span>
                      <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                        {m.source === 'user' ? 'EXISTING USER' : 'EXISTING CONTACT'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-amber-800">
                Consider picking from the user search above instead of creating a duplicate.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">First Name *</label>
                <Input required placeholder="First name" value={form.first_name} onChange={(e) => handleFieldChange('first_name', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Last Name *</label>
                <Input required placeholder="Last name" value={form.last_name} onChange={(e) => handleFieldChange('last_name', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Email</label>
                <Input type="email" placeholder="email@example.com" value={form.email} onChange={(e) => handleFieldChange('email', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Phone</label>
                <Input type="tel" placeholder="(404) 555-0000" value={form.phone} onChange={(e) => handleFieldChange('phone', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Title</label>
              <Input placeholder="e.g. Owner, Manager" value={form.title} onChange={(e) => handleFieldChange('title', e.target.value)} />
            </div>

            {/* Required: link this contact to a business or cause */}
            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
              <div className="mb-2 text-sm font-medium text-amber-900">
                Link to organization <span className="text-red-600">*</span>
              </div>
              <p className="mb-3 text-xs text-amber-800">
                Contacts represent the humans behind a business or cause. Pick one — free-standing contacts aren't allowed.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-surface-700">Type</label>
                  <Select
                    value={form.org_type}
                    onValueChange={(v) => {
                      handleFieldChange('org_type', v as 'business' | 'cause')
                      handleFieldChange('org_id', '')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Business or Cause" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="cause">Cause</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-surface-700">Which one</label>
                  <Select
                    value={form.org_id}
                    onValueChange={(v) => handleFieldChange('org_id', v)}
                  >
                    <SelectTrigger disabled={!form.org_type}>
                      <SelectValue placeholder={form.org_type ? `Select a ${form.org_type}...` : 'Pick a type first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {form.org_type === 'business' && businesses.map((b) => (
                        <SelectItem key={String(b.id)} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                      {form.org_type === 'cause' && causes.map((cz) => (
                        <SelectItem key={String(cz.id)} value={String(cz.id)}>{cz.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Source</label>
              <Select value={form.source} onValueChange={(v) => handleFieldChange('source', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a source..." />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setAddOpen(false); setForm(INITIAL_FORM); setFormError(null) }}>Cancel</Button>
              <Button type="submit" disabled={inserting}>
                {inserting ? 'Creating...' : <><Plus className="h-4 w-4" /> Create Contact</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
