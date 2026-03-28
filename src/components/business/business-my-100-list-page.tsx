'use client'

import * as React from 'react'
import {
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BusinessJoinQrCard } from '@/components/business/business-join-qr-card'
import { BusinessContactImportDialog } from '@/components/business/business-contact-import-dialog'
import { useAuth } from '@/lib/auth/context'
import {
  BUSINESS_ACCENT_BADGE_CLASS,
  BUSINESS_ACCENT_BUTTON_CLASS,
  BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS,
  BUSINESS_ACCENT_SURFACE_CLASS,
} from '@/lib/business-theme'
import { resolveBusinessOffer } from '@/lib/offers'
import {
  getContactDisplayName,
  getContactListStatus,
  getContactPrimaryChannel,
  getContactTag,
  getNetworkMilestone,
  isCreatedToday,
  resolveScopedBusiness,
  splitFullName,
} from '@/lib/business-portal'
import {
  useBusinesses,
  useContacts,
  useContactDelete,
  useContactInsert,
  useContactUpdate,
  useOffers,
} from '@/lib/supabase/hooks'
import { formatDate } from '@/lib/utils'
import type { BusinessContactStatus, Contact } from '@/lib/types/database'

const SUGGESTED_TAGS = ['Past customer', 'Friend', 'Family', 'Local supporter', 'Regular']

const INITIAL_FORM = {
  name: '',
  phone: '',
  email: '',
  tag: '',
}

export function BusinessMy100ListPage() {
  const { profile } = useAuth()
  const businessFilters = React.useMemo<Record<string, string>>(
    () => {
      const filters: Record<string, string> = {}
      if (profile.business_id) {
        filters.id = profile.business_id
      } else {
        filters.owner_id = profile.id
      }
      return filters
    },
    [profile.business_id, profile.id]
  )
  const { data: businesses, loading: businessesLoading } = useBusinesses(businessFilters)
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])
  const contactFilters = React.useMemo<Record<string, string>>(
    () => {
      const filters: Record<string, string> = {}
      filters.business_id = business?.id || '__none__'
      return filters
    },
    [business?.id]
  )
  const { data: contacts, loading: contactsLoading, refetch } = useContacts(contactFilters)
  const { data: offers } = useOffers({ business_id: business?.id || '__none__' })
  const { insert, loading: inserting } = useContactInsert()
  const { update, loading: updating } = useContactUpdate()
  const { remove } = useContactDelete()

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false)
  const [editingContact, setEditingContact] = React.useState<Contact | null>(null)
  const [form, setForm] = React.useState(INITIAL_FORM)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [bulkMessage, setBulkMessage] = React.useState<string | null>(null)
  const [rowActionId, setRowActionId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!business) return

    const interval = window.setInterval(() => {
      refetch({ silent: true })
    }, 5000)

    return () => window.clearInterval(interval)
  }, [business, refetch])

  if (businessesLoading || (business && contactsLoading)) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading your 100 list...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="Your 100 list will show up here"
        description="A business needs to be linked to this account before we can attach contacts to it."
      />
    )
  }

  const totalAdded = contacts.length
  const captureOffer = resolveBusinessOffer(business, offers, 'capture')
  const invitedCount = contacts.filter((contact) => getContactListStatus(contact) !== 'added').length
  const joinedCount = contacts.filter((contact) => getContactListStatus(contact) === 'joined').length
  const todayAdds = contacts.filter((contact) => isCreatedToday(contact.created_at)).length
  const milestone = getNetworkMilestone(totalAdded)
  const progressPercent = Math.min(100, Math.round((totalAdded / 100) * 100))

  const handleOpenCreate = (tag = '') => {
    setEditingContact(null)
    setForm({ ...INITIAL_FORM, tag })
    setFormError(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact)
    setForm({
      name: getContactDisplayName(contact),
      phone: contact.phone || '',
      email: contact.email || '',
      tag: getContactTag(contact) || '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const name = form.name.trim()
    const phone = form.phone.trim()
    const email = form.email.trim()
    const tag = form.tag.trim()

    if (!name) {
      setFormError('Add a name so this person is easy to recognize.')
      return
    }

    if (!phone && !email) {
      setFormError('Add at least a phone number or an email.')
      return
    }

    const splitName = splitFullName(name)
    const metadata = tag ? { tag } : null

    const payload = {
      first_name: splitName.first_name,
      last_name: splitName.last_name || '',
      phone: phone || null,
      email: email || null,
      business_id: business.id,
      owner_id: profile.id,
      created_by_user_id: profile.id,
      source: editingContact?.source || 'manual',
      tag: tag || null,
      list_status: editingContact?.list_status || 'added',
      invited_at: editingContact?.invited_at || null,
      joined_at: editingContact?.joined_at || null,
      status: 'active' as const,
      metadata,
    }

    const result = editingContact
      ? await update(editingContact.id, payload)
      : await insert(payload)

    if (!result) {
      setFormError(`We couldn't ${editingContact ? 'update' : 'add'} this contact right now.`)
      return
    }

    setDialogOpen(false)
    setEditingContact(null)
    setForm(INITIAL_FORM)
    refetch()
  }

  const handleStatusUpdate = async (contact: Contact, nextStatus: BusinessContactStatus) => {
    setRowActionId(contact.id)

    const now = new Date().toISOString()
    const metadata = {
      ...((contact.metadata as Record<string, unknown> | null) || {}),
      list_status: nextStatus,
      tag: getContactTag(contact),
    }

    const result = await update(contact.id, {
      list_status: nextStatus,
      invited_at: nextStatus === 'added' ? null : (contact.invited_at || now),
      joined_at: nextStatus === 'joined' ? (contact.joined_at || now) : null,
      metadata,
    })

    setRowActionId(null)

    if (result) {
      refetch()
    }
  }

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Delete ${getContactDisplayName(contact)} from your list?`)) return

    setRowActionId(contact.id)
    const deleted = await remove(contact.id)
    setRowActionId(null)
    if (deleted) refetch()
  }

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (contact) => (
        <div>
          <p className="font-medium text-surface-900">{getContactDisplayName(contact)}</p>
          <p className="text-xs text-surface-400">{getContactTag(contact) || 'No tag yet'}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Phone / Email',
      render: (contact) => <span className="text-sm text-surface-600">{getContactPrimaryChannel(contact)}</span>,
    },
    {
      key: 'source',
      header: 'Source',
      render: (contact) => <Badge variant="default">{contact.source || 'manual'}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (contact) => {
        const status = getContactListStatus(contact)
        return (
          <Badge variant={status === 'joined' ? 'success' : status === 'invited' ? 'info' : 'warning'}>
            {status === 'joined' ? 'Joined' : status === 'invited' ? 'Invited' : 'Added'}
          </Badge>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Date added',
      sortable: true,
      render: (contact) => <span className="text-sm text-surface-600">{formatDate(contact.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'min-w-[250px]',
      render: (contact) => {
        const status = getContactListStatus(contact)
        const rowBusy = rowActionId === contact.id

        return (
          <div className="flex flex-wrap gap-1.5">
            {status !== 'invited' && (
              <Button
                size="sm"
                variant="outline"
                className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS}
                disabled={rowBusy}
                onClick={() => void handleStatusUpdate(contact, 'invited')}
              >
                Invite
              </Button>
            )}
            {status !== 'joined' && (
              <Button
                size="sm"
                variant="outline"
                className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS}
                disabled={rowBusy}
                onClick={() => void handleStatusUpdate(contact, 'joined')}
              >
                Join
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" disabled={rowBusy} onClick={() => handleOpenEdit(contact)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={rowBusy}
              className="text-danger-500 hover:text-danger-700"
              onClick={() => void handleDelete(contact)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Build Your 100 List"
        description="These are people who already know, trust, and support your business."
        actions={
          <Button className={BUSINESS_ACCENT_BUTTON_CLASS} onClick={() => handleOpenCreate()}>
            <Plus className="h-4 w-4" /> Add Contact
          </Button>
        }
      />

      <Card className={BUSINESS_ACCENT_SURFACE_CLASS}>
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#728000]">Customer Capture Offer (Pre-launch)</p>
            <p className="mt-2 text-2xl font-bold text-surface-900">{captureOffer.headline}</p>
            <p className="mt-2 text-sm text-surface-600">{captureOffer.description}</p>
          </div>
          {captureOffer.value_label && (
            <Badge className={`w-fit ${BUSINESS_ACCENT_BADGE_CLASS}`}>
              {captureOffer.value_label}
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <Card className="overflow-hidden border-surface-200">
          <div className="bg-gradient-to-r from-[#fbfdd9] via-white to-[#f6fac1] px-6 py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Progress</p>
                <p className="mt-3 text-4xl font-bold text-surface-900">{totalAdded} / 100 added</p>
                <p className="mt-2 max-w-xl text-sm text-surface-600">{milestone.description}</p>
              </div>
              <Badge className={BUSINESS_ACCENT_BADGE_CLASS}>{milestone.label}</Badge>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#e5f000] via-[#d7e200] to-[#b8c500] transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <MetricTile label="Added" value={totalAdded} />
              <MetricTile label="Invited" value={invitedCount} />
              <MetricTile label="Joined" value={joinedCount} />
            </div>
          </div>
        </Card>

        <BusinessJoinQrCard
          business={business}
          totalClients={totalAdded}
          todayAdds={todayAdds}
          progressPercent={progressPercent}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manual entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-surface-600">
              Add people one by one when you already know who you want to invite next.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TAGS.map((tag) => (
                <Button key={tag} variant="outline" className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS} onClick={() => handleOpenCreate(tag)}>
                  <Plus className="h-3.5 w-3.5" /> {tag}
                </Button>
              ))}
            </div>
            <Button className={`w-full sm:w-auto ${BUSINESS_ACCENT_BUTTON_CLASS}`} onClick={() => handleOpenCreate()}>
              <Plus className="h-4 w-4" /> Add contact
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk add</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-surface-600">
              Import a sheet instead of typing contacts one by one. Paste directly from Excel or Google Sheets, or upload a CSV file, then preview and map the columns before importing.
            </p>
            {bulkMessage && <p className="text-sm text-success-600">{bulkMessage}</p>}
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
              <p className="text-sm font-semibold text-surface-900">Expected headers</p>
              <p className="mt-2 text-sm leading-6 text-surface-600">
                Name, Phone, Email, and Tag work best. If your sheet has First Name and Last Name instead of one Name column, the importer can combine them automatically.
              </p>
            </div>
            <Button className={BUSINESS_ACCENT_BUTTON_CLASS} onClick={() => setBulkDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              Open import tool
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Who to add first</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-surface-600">
            Start with people who already like you, know your team, or come in often. That is the fastest path to momentum.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleOpenCreate(tag)}
                className="rounded-full border border-[#d7e200] bg-[#fbfdd9] px-3 py-1.5 text-sm text-[#556100] transition-colors hover:border-[#c7d400] hover:bg-[#f6fac1]"
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
            <p className="text-sm font-semibold text-surface-900">Simple rule</p>
            <p className="mt-1 text-sm text-surface-600">
              If you would feel comfortable texting them today, they belong on your list.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Our Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={contacts}
            keyField="id"
            searchPlaceholder="Search your 100 list..."
            loading={contactsLoading}
            emptyState={
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="Start your 100 list"
                description="Add the first people who already know your business so you have a real launch list to work from."
                action={{ label: 'Add Contact', onClick: () => handleOpenCreate() }}
              />
            }
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit contact' : 'Add contact'}</DialogTitle>
            <DialogDescription>
              Keep this lightweight. You only need a name plus a phone number or email to get someone onto the list.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Name *</label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Phone</label>
                <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Email</label>
                <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Tag</label>
              <Input value={form.tag} onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value }))} placeholder="Friend, regular, family..." />
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, tag }))}
                    className="rounded-full border border-[#d7e200] bg-[#fbfdd9] px-2.5 py-1 text-xs text-[#556100] transition-colors hover:border-[#c7d400] hover:bg-[#f6fac1]"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            {formError && <p className="text-sm text-danger-600">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS} onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className={BUSINESS_ACCENT_BUTTON_CLASS} disabled={inserting || updating}>
                <CheckCircle2 className="h-4 w-4" />
                {editingContact ? 'Save changes' : 'Add contact'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BusinessContactImportDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        businessId={business.id}
        profileId={profile.id}
        onImported={(count) => {
          setBulkMessage(`${count} contacts added to your 100 list.`)
          refetch()
        }}
      />
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/90 bg-white/85 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-surface-900">{value}</p>
    </div>
  )
}
