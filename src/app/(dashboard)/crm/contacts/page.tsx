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

interface ContactRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  title: string | null
  organization: string | null
  org_type: 'business' | 'cause' | null
  owner: string
  status: string
}

const DEMO_CONTACTS: ContactRow[] = [
  { id: 'c-001', first_name: 'Maria', last_name: 'Rodriguez', email: 'maria@mainstreetbakery.com', phone: '(404) 555-0101', title: 'Owner', organization: 'Main Street Bakery', org_type: 'business', owner: 'Alex Rivera', status: 'active' },
  { id: 'c-002', first_name: 'James', last_name: 'Chen', email: 'james@rivercafe.co', phone: '(404) 555-0303', title: 'General Manager', organization: 'River Cafe', org_type: 'business', owner: 'Jordan Taylor', status: 'active' },
  { id: 'c-003', first_name: 'Principal', last_name: 'Davis', email: 'pdavis@mlkelementary.edu', phone: '(404) 555-1001', title: 'Principal', organization: 'MLK Elementary School', org_type: 'cause', owner: 'Dr. Sarah Johnson', status: 'active' },
  { id: 'c-004', first_name: 'Tom', last_name: 'Nguyen', email: 'tom@peachtreeauto.com', phone: '(404) 555-0202', title: 'Owner', organization: 'Peachtree Auto Repair', org_type: 'business', owner: 'Alex Rivera', status: 'active' },
  { id: 'c-005', first_name: 'Lisa', last_name: 'Park', email: 'lisa@sunriseyoga.com', phone: '(678) 555-0404', title: 'Studio Owner', organization: 'Sunrise Yoga Studio', org_type: 'business', owner: 'Casey Adams', status: 'active' },
  { id: 'c-006', first_name: 'Rev.', last_name: 'Thompson', email: 'pastor@gracecommunity.org', phone: '(404) 555-2001', title: 'Lead Pastor', organization: 'Grace Community Church', org_type: 'cause', owner: 'Rick (Admin)', status: 'active' },
  { id: 'c-007', first_name: 'Sandra', last_name: 'Williams', email: 'sandra@communitystrong.org', phone: '(404) 555-3001', title: 'Executive Director', organization: 'Community Strong Foundation', org_type: 'cause', owner: 'Marcus Williams', status: 'active' },
  { id: 'c-008', first_name: 'Derek', last_name: 'Brown', email: null, phone: '(404) 555-1010', title: 'Owner', organization: 'EastSide Barbershop', org_type: 'business', owner: 'Jordan Taylor', status: 'active' },
  { id: 'c-009', first_name: 'Karen', last_name: 'Mitchell', email: 'karen@buckheaddental.com', phone: '(404) 555-0606', title: 'Office Manager', organization: 'Buckhead Dental Arts', org_type: 'business', owner: 'Alex Rivera', status: 'active' },
]

export default function ContactsPage() {
  const router = useRouter()
  const [addOpen, setAddOpen] = React.useState(false)

  const columns: Column<ContactRow>[] = [
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
      render: (c) => c.organization ? (
        <span className="flex items-center gap-1.5 text-surface-700">
          {c.org_type === 'business' ? <Building2 className="h-3.5 w-3.5 text-surface-400" /> : <Heart className="h-3.5 w-3.5 text-hato-500" />}
          {c.organization}
        </span>
      ) : <span className="text-surface-300">—</span>,
    },
    { key: 'owner', header: 'Owner', sortable: true },
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
      <DataTable
        columns={columns}
        data={DEMO_CONTACTS}
        keyField="id"
        searchPlaceholder="Search by name, email, or organization..."
        emptyState={
          <EmptyState icon={<Users className="h-8 w-8" />} title="No contacts yet" description="Add contacts to track your relationships." action={{ label: 'Add Contact', onClick: () => setAddOpen(true) }} />
        }
      />
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Create a new contact record.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setAddOpen(false) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-sm font-medium text-surface-700">First Name *</label><Input required placeholder="First name" /></div>
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Last Name *</label><Input required placeholder="Last name" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Email</label><Input type="email" placeholder="email@example.com" /></div>
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Phone</label><Input type="tel" placeholder="(404) 555-0000" /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-surface-700">Title</label><Input placeholder="e.g. Owner, Manager" /></div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit"><Plus className="h-4 w-4" /> Create Contact</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
