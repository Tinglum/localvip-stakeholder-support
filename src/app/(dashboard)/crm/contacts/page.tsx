'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Mail, Phone, Building2, Heart } from 'lucide-react'
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

    const record: Partial<Contact> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      title: form.title.trim() || null,
      source: form.source || null,
      owner_id: profile.id,
      status: 'active',
    }

    const result = await insert(record)
    if (result) {
      setAddOpen(false)
      setForm(INITIAL_FORM)
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
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setForm(INITIAL_FORM); setFormError(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Create a new contact record.</DialogDescription>
          </DialogHeader>
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
