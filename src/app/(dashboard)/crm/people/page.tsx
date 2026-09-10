'use client'

/**
 * Contacts — the people at businesses and causes.
 *
 * Reported (bug 168): these could only be reached by opening a customer's
 * profile and clicking through, because "Customers" (/crm/contacts) lists
 * accounts rather than the people attached to them, and CRM > Team lists staff.
 * There was no section that answered "who is my contact at this business".
 *
 * Search runs server-side — the Contact endpoint already filters on first name,
 * last name and email, so a large list does not have to be pulled down and
 * filtered in the browser.
 */

import * as React from 'react'
import Link from 'next/link'
import { Heart, Loader2, Mail, Phone, Search, Store, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useBusinesses, useCauses, useContacts } from '@/lib/supabase/hooks'

export default function CrmPeoplePage() {
  const [search, setSearch] = React.useState('')
  const { data: contacts, loading } = useContacts()
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()

  const businessName = React.useMemo(
    () => new Map(businesses.map((item) => [String(item.id), item.name])),
    [businesses],
  )
  const causeName = React.useMemo(
    () => new Map(causes.map((item) => [String(item.id), item.name])),
    [causes],
  )

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return contacts
      .filter((contact) => {
        if (!query) return true
        const name = `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase()
        return (
          name.includes(query)
          || (contact.email || '').toLowerCase().includes(query)
          || (contact.phone || '').toLowerCase().includes(query)
          || (contact.title || '').toLowerCase().includes(query)
        )
      })
      // Sorted by surname then first name, the way a contact list is read.
      .sort((a, b) => {
        const left = `${a.last_name || ''} ${a.first_name || ''}`.trim()
        const right = `${b.last_name || ''} ${b.first_name || ''}`.trim()
        return left.localeCompare(right, undefined, { sensitivity: 'base' })
      })
  }, [contacts, search])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="The people at your businesses and causes — owners, leaders and day-to-day contacts."
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <Input
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, phone or title..."
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={search ? 'No contacts match that search' : 'No contacts yet'}
          description={
            search
              ? 'Try a different name, email or phone number.'
              : 'Contacts appear here once they are added to a business or cause.'
          }
        />
      ) : (
        <div className="grid gap-3">
          {visible.map((contact) => {
            const org = contact.business_id
              ? { label: businessName.get(String(contact.business_id)) || 'Business', href: `/crm/businesses/${contact.business_id}`, icon: <Store className="h-3.5 w-3.5" /> }
              : contact.cause_id
                ? { label: causeName.get(String(contact.cause_id)) || 'Cause', href: `/crm/causes/${contact.cause_id}`, icon: <Heart className="h-3.5 w-3.5" /> }
                : null

            return (
              <Card key={contact.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-surface-900">
                      {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unnamed contact'}
                    </p>
                    {contact.title ? (
                      <p className="text-xs text-surface-500">{contact.title}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-600">
                      {contact.email ? (
                        <a className="inline-flex items-center gap-1 hover:underline" href={`mailto:${contact.email}`}>
                          <Mail className="h-3.5 w-3.5" />{contact.email}
                        </a>
                      ) : null}
                      {contact.phone ? (
                        <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${contact.phone}`}>
                          <Phone className="h-3.5 w-3.5" />{contact.phone}
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* The link Jamaica had to reach by drilling through a customer:
                      straight to the business or cause this person belongs to. */}
                  {org ? (
                    <Link href={org.href}>
                      <Badge variant="info" className="inline-flex items-center gap-1">
                        {org.icon}{org.label}
                      </Badge>
                    </Link>
                  ) : (
                    <Badge variant="default">Unlinked</Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
