'use client'

import * as React from 'react'
import {
  FileText, Download, Eye, Filter, Grid, List, Search,
  Upload, FolderOpen, ArrowRight, File, Image, Mail,
  MessageSquare, Printer, QrCode, Tag,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { BRANDS, MATERIAL_TYPES, MATERIAL_USE_CASES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

// ─── Demo data ───────────────────────────────────────────────

const DEMO_MATERIALS = [
  {
    id: '1', title: 'LocalVIP Business One-Pager', type: 'one_pager', brand: 'localvip' as const,
    description: 'Hand this to any business owner. Explains cashback program, onboarding steps, and benefits.',
    use_case: 'business_onboarding', file_name: 'localvip-business-onepager.pdf',
    thumbnail_url: null, download_count: 142, updated_at: '2024-03-01',
    target_roles: ['business_onboarding', 'volunteer', 'intern'],
  },
  {
    id: '2', title: 'HATO School Flyer', type: 'flyer', brand: 'hato' as const,
    description: 'Colorful flyer for schools explaining how Help A Teacher Out works with LocalVIP.',
    use_case: 'cause_onboarding', file_name: 'hato-school-flyer.pdf',
    thumbnail_url: null, download_count: 89, updated_at: '2024-02-28',
    target_roles: ['school_leader', 'cause_leader', 'volunteer'],
  },
  {
    id: '3', title: 'Business Outreach Script', type: 'script', brand: 'localvip' as const,
    description: 'Step-by-step script for cold-calling or visiting businesses. Handles common objections.',
    use_case: 'business_onboarding', file_name: 'outreach-script.pdf',
    thumbnail_url: null, download_count: 203, updated_at: '2024-03-10',
    target_roles: ['business_onboarding', 'volunteer', 'intern', 'influencer'],
  },
  {
    id: '4', title: 'Volunteer Welcome Email', type: 'email_template', brand: 'localvip' as const,
    description: 'Send this to new volunteers with their login, QR code, and first steps.',
    use_case: 'volunteer_outreach', file_name: 'volunteer-welcome-email.html',
    thumbnail_url: null, download_count: 67, updated_at: '2024-02-20',
    target_roles: ['internal_admin', 'super_admin'],
  },
  {
    id: '5', title: 'Cause Onboarding Checklist', type: 'pdf', brand: 'localvip' as const,
    description: 'Printable checklist for cause leaders walking through the onboarding process.',
    use_case: 'cause_onboarding', file_name: 'cause-onboarding-checklist.pdf',
    thumbnail_url: null, download_count: 54, updated_at: '2024-03-05',
    target_roles: ['cause_leader', 'school_leader'],
  },
  {
    id: '6', title: 'Influencer Media Kit', type: 'print_asset', brand: 'localvip' as const,
    description: 'Branded graphics, talking points, and social media templates for influencer partners.',
    use_case: 'influencer_outreach', file_name: 'influencer-media-kit.zip',
    thumbnail_url: null, download_count: 31, updated_at: '2024-03-12',
    target_roles: ['influencer', 'affiliate'],
  },
  {
    id: '7', title: 'HATO Donation Poster', type: 'print_asset', brand: 'hato' as const,
    description: 'Print-ready poster for businesses participating in HATO. Includes QR code slot.',
    use_case: 'business_onboarding', file_name: 'hato-donation-poster.pdf',
    thumbnail_url: null, download_count: 45, updated_at: '2024-02-25',
    target_roles: ['business_onboarding', 'school_leader', 'volunteer'],
  },
  {
    id: '8', title: 'Business Follow-Up Email', type: 'email_template', brand: 'localvip' as const,
    description: 'Template for following up after an initial business meeting. Personalize and send.',
    use_case: 'business_onboarding', file_name: 'business-followup-email.html',
    thumbnail_url: null, download_count: 118, updated_at: '2024-03-08',
    target_roles: ['business_onboarding', 'volunteer', 'intern'],
  },
]

const TYPE_ICONS: Record<string, React.ReactNode> = {
  one_pager: <File className="h-5 w-5" />,
  flyer: <Image className="h-5 w-5" />,
  pdf: <FileText className="h-5 w-5" />,
  script: <MessageSquare className="h-5 w-5" />,
  email_template: <Mail className="h-5 w-5" />,
  print_asset: <Printer className="h-5 w-5" />,
  qr_asset: <QrCode className="h-5 w-5" />,
  other: <FolderOpen className="h-5 w-5" />,
}

export default function MaterialsLibraryPage() {
  const { profile, isAdmin } = useAuth()
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('')
  const [brandFilter, setBrandFilter] = React.useState('')
  const [useCaseFilter, setUseCaseFilter] = React.useState('')
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')

  const filtered = React.useMemo(() => {
    return DEMO_MATERIALS.filter(m => {
      if (search && !m.title.toLowerCase().includes(search.toLowerCase()) &&
          !m.description.toLowerCase().includes(search.toLowerCase())) return false
      if (typeFilter && m.type !== typeFilter) return false
      if (brandFilter && m.brand !== brandFilter) return false
      if (useCaseFilter && m.use_case !== useCaseFilter) return false
      return true
    })
  }, [search, typeFilter, brandFilter, useCaseFilter])

  return (
    <div>
      <PageHeader
        title="Materials Library"
        description="Download flyers, scripts, templates, and print assets for your outreach."
        actions={
          isAdmin ? (
            <Button>
              <Upload className="h-4 w-4" /> Upload Material
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search materials..."
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
        >
          <option value="">All Types</option>
          {MATERIAL_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
          className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
        >
          <option value="">All Brands</option>
          <option value="localvip">LocalVIP</option>
          <option value="hato">HATO</option>
        </select>
        <select
          value={useCaseFilter}
          onChange={e => setUseCaseFilter(e.target.value)}
          className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
        >
          <option value="">All Use Cases</option>
          {MATERIAL_USE_CASES.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-md p-1.5 ${viewMode === 'grid' ? 'bg-surface-200 text-surface-700' : 'text-surface-400 hover:text-surface-600'}`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md p-1.5 ${viewMode === 'list' ? 'bg-surface-200 text-surface-700' : 'text-surface-400 hover:text-surface-600'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Count */}
      <p className="mb-4 text-xs text-surface-500">{filtered.length} material{filtered.length !== 1 ? 's' : ''}</p>

      {/* Grid view */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No materials found"
          description="Try adjusting your filters, or upload new materials."
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(material => (
            <Card key={material.id} className="group transition-shadow hover:shadow-card-hover">
              {/* Thumbnail */}
              <div className="flex h-36 items-center justify-center border-b border-surface-100 bg-surface-50">
                <div className="text-surface-300">
                  {TYPE_ICONS[material.type] || <FileText className="h-10 w-10" />}
                </div>
              </div>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant={material.brand === 'hato' ? 'hato' : 'info'}>
                    {BRANDS[material.brand].label}
                  </Badge>
                  <Badge variant="default">
                    {MATERIAL_TYPES.find(t => t.value === material.type)?.label}
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold text-surface-800 group-hover:text-brand-700 transition-colors">
                  {material.title}
                </h3>
                <p className="mt-1 text-xs text-surface-500 line-clamp-2">{material.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-surface-400">
                    {material.download_count} downloads
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" title="Preview">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filtered.map(material => (
            <Card key={material.id} className="group transition-shadow hover:shadow-card-hover">
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-surface-400">
                  {TYPE_ICONS[material.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-surface-800 truncate">{material.title}</h3>
                    <Badge variant={material.brand === 'hato' ? 'hato' : 'info'} className="shrink-0">
                      {BRANDS[material.brand].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-500 truncate">{material.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-surface-400">
                  <span>{material.download_count} downloads</span>
                  <span>{formatDate(material.updated_at)}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm"><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
