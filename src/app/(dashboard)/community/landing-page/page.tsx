'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, Globe2, ImageIcon, Loader2, Save, Send, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth/context'
import { useCauses } from '@/lib/supabase/hooks'
import { resolveCommunityCause } from '@/lib/community-cause'
import { CauseLoadError } from '@/components/community/cause-load-error'
import type { Cause } from '@/lib/types/database'

type ImageAsset = { src: string; alt: string }
type LandingConfig = {
  slug: string
  revision: string
  schoolName: string
  organizationName: string
  causeAccountId: number
  locality: string
  routeBase: string
  colors: { navy: string; navyDeep: string; royal: string; silver: string; silverLight: string; gold: string }
  assets: { mark: ImageAsset; crowd: ImageAsset; team?: ImageAsset; community?: ImageAsset; people?: ImageAsset }
  scheduleCallUrl: string
  disclaimer: string
  assetsArePlaceholder: boolean
}

type LandingRecord = {
  landingPageSlug?: string | null
  status: string
  draft?: LandingConfig | null
  published?: LandingConfig | null
  revision: number
  landingPageUpdatedDate?: string | null
  landingPagePublishedDate?: string | null
}

const palette = {
  navy: '#071A3D', navyDeep: '#031126', royal: '#153E78',
  silver: '#C8CBD1', silverLight: '#EEF0F3', gold: '#D0A323',
}

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

function qaCauseId(cause: Cause) {
  const metadata = cause.metadata || {}
  const candidates = [cause.external_id, metadata.qaAccountId, metadata.qaCauseId]
  for (const value of candidates) if (/^\d+$/.test(String(value || ''))) return Number(value)
  return null
}

function defaultConfig(cause: Cause, id: number): LandingConfig {
  const slug = slugify(cause.name) || `cause-${id}`
  return {
    slug,
    revision: 'draft',
    schoolName: cause.name,
    organizationName: cause.name,
    causeAccountId: id,
    locality: cause.address || 'your community',
    routeBase: `/landing/${slug}`,
    colors: palette,
    assets: {
      mark: { src: cause.logo_url || '', alt: `${cause.name} logo` },
      crowd: { src: cause.cover_photo_url || '', alt: `${cause.name} community` },
    },
    scheduleCallUrl: '',
    disclaimer: '',
    assetsArePlaceholder: false,
  }
}

function blockers(config: LandingConfig) {
  const items: string[] = []
  if (!config.schoolName.trim()) items.push('Add the school or community name.')
  if (!config.organizationName.trim()) items.push('Add the organization name.')
  if (!config.locality.trim()) items.push('Add the city or community.')
  if (!config.assets.mark.src) items.push('Upload a logo.')
  if (!config.assets.crowd.src) items.push('Upload a cover photo.')
  if (!config.disclaimer.trim()) items.push('Add the required relationship disclaimer.')
  return items
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block space-y-1.5"><span className="text-sm font-medium text-surface-800">{label}</span>{children}{hint && <span className="block text-xs text-surface-500">{hint}</span>}</label>
}

export default function CauseLandingPageEditor() {
  const { profile } = useAuth()
  const { data: causes, loading, error, refetch } = useCauses()
  const cause = React.useMemo(() => resolveCommunityCause(profile, causes), [profile, causes])
  const causeId = cause ? qaCauseId(cause) : null
  const [config, setConfig] = React.useState<LandingConfig | null>(null)
  const [record, setRecord] = React.useState<LandingRecord | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [dirty, setDirty] = React.useState(false)
  const loadedId = React.useRef<number | null>(null)
  const uploadRef = React.useRef<HTMLInputElement | null>(null)
  const uploadKind = React.useRef<'logo' | 'cover_photo'>('logo')

  React.useEffect(() => {
    if (!cause || !causeId || loadedId.current === causeId) return
    loadedId.current = causeId
    void fetch(`/api/crm/causes/${causeId}/landing-page`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load the landing page.')
        const next = body as LandingRecord
        let deviceDraft: LandingConfig | null = null
        try {
          deviceDraft = JSON.parse(localStorage.getItem(`localvip-cause-landing:${causeId}`) || 'null') as LandingConfig | null
        } catch {
          deviceDraft = null
        }
        setRecord(next)
        setConfig(next.draft || deviceDraft || defaultConfig(cause, causeId))
      })
      .catch((loadError) => {
        setMessage(loadError instanceof Error ? loadError.message : 'Could not load the landing page.')
        try {
          setConfig(JSON.parse(localStorage.getItem(`localvip-cause-landing:${causeId}`) || 'null') as LandingConfig || defaultConfig(cause, causeId))
        } catch {
          setConfig(defaultConfig(cause, causeId))
        }
      })
  }, [cause, causeId])

  const save = React.useCallback(async (quiet = false) => {
    if (!config || !causeId) return false
    setSaving(true)
    if (!quiet) setMessage('')
    try {
      localStorage.setItem(`localvip-cause-landing:${causeId}`, JSON.stringify(config))
      const response = await fetch(`/api/crm/causes/${causeId}/landing-page`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: config.slug, config }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not save the landing page.')
      setRecord((current) => ({ ...(current || { revision: 0 }), status: body.status, landingPageSlug: body.slug } as LandingRecord))
      setDirty(false)
      if (!quiet) setMessage('Saved.')
      return true
    } catch (saveError) {
      setMessage(`${saveError instanceof Error ? saveError.message : 'Save failed.'} Your draft is still saved on this device.`)
      return false
    } finally { setSaving(false) }
  }, [causeId, config])

  React.useEffect(() => {
    if (!dirty || !config) return
    const timer = window.setTimeout(() => void save(true), 900)
    return () => window.clearTimeout(timer)
  }, [config, dirty, save])

  function update(patch: Partial<LandingConfig>) {
    setConfig((current) => current ? { ...current, ...patch } : current)
    setDirty(true)
  }

  function updateAsset(name: keyof LandingConfig['assets'], patch: Partial<ImageAsset>) {
    setConfig((current) => current ? { ...current, assets: { ...current.assets, [name]: { ...(current.assets[name] || { src: '', alt: '' }), ...patch } } } : current)
    setDirty(true)
  }

  async function upload(file: File) {
    if (!cause || !causeId) return
    setSaving(true)
    setMessage('Uploading image...')
    try {
      const data = new FormData()
      data.append('file', file)
      data.append('mediaType', uploadKind.current)
      const response = await fetch(`/api/crm/causes/${causeId}/media`, { method: 'POST', body: data })
      const body = await response.json()
      if (!response.ok || !body.fileUrl) throw new Error(body.error || 'Upload failed.')
      updateAsset(uploadKind.current === 'logo' ? 'mark' : 'crowd', { src: body.fileUrl })
      setMessage('Image uploaded. The page draft will save automatically.')
    } catch (uploadError) {
      setMessage(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
    } finally { setSaving(false) }
  }

  async function publish(action: 'publish' | 'unpublish') {
    if (!causeId || !config) return
    setPublishing(true); setMessage('')
    try {
      if (dirty && !await save(true)) return
      const response = await fetch(`/api/crm/causes/${causeId}/landing-page`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error([body.error, ...(body.blockers || [])].filter(Boolean).join(' '))
      setRecord((current) => ({ ...(current || { revision: 0 }), status: body.status, revision: body.revision ?? current?.revision ?? 0 } as LandingRecord))
      setMessage(action === 'publish' ? 'Your landing pages are live.' : 'Your landing pages are no longer public.')
    } catch (publishError) { setMessage(publishError instanceof Error ? publishError.message : 'Publish failed.') }
    finally { setPublishing(false) }
  }

  if (loading) return <div role="status" className="animate-pulse p-8 text-sm text-surface-500">Loading your landing page...</div>
  if (error) return <CauseLoadError onRetry={() => refetch()} />
  if (!cause) return <EmptyState icon={<Globe2 className="h-8 w-8" />} title="Link your cause first" description="Your landing page workspace will appear as soon as this account is linked to a school or cause." />
  if (!causeId) return <EmptyState icon={<Globe2 className="h-8 w-8" />} title="Finish linking this cause" description="This cause needs its LocalVIP account link before its landing page can be published." />
  if (!config) return <div role="status" className="animate-pulse p-8 text-sm text-surface-500">Building your landing page workspace...</div>

  const missing = blockers(config)
  const baseUrl = `${process.env.NEXT_PUBLIC_WEBAPP_URL || 'https://my.localvip.com'}/landing/${config.slug}`
  const live = record?.status === 'published' || record?.status === 'published_with_changes'

  return <div className="space-y-6 pb-20">
    <PageHeader title="Your Landing Pages" description="Add your identity once, preview the result, then publish pages for families, businesses and your organization." />

    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-200 bg-white p-3">
      <Badge variant={live ? 'success' : 'default'}>{live ? 'Live' : 'Draft'}</Badge>
      <span className="text-sm text-surface-500">{saving ? 'Saving...' : dirty ? 'Waiting to save' : 'All changes saved'}</span>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" onClick={() => void save()} disabled={saving}><Save className="h-4 w-4" />Save now</Button>
        {live && <Button variant="outline" onClick={() => void publish('unpublish')} disabled={publishing}>Unpublish</Button>}
        <Button onClick={() => void publish('publish')} disabled={publishing || missing.length > 0}>{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publish</Button>
      </div>
    </div>

    {message && <div role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">{message}</div>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle>Names and page address</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="School or community name"><Input value={config.schoolName} onChange={(e) => update({ schoolName: e.target.value })} /></Field>
          <Field label="Organization name"><Input value={config.organizationName} onChange={(e) => update({ organizationName: e.target.value })} /></Field>
          <Field label="City or community"><Input value={config.locality} onChange={(e) => update({ locality: e.target.value })} /></Field>
          <Field label="Page address" hint={`my.localvip.com/landing/${config.slug}`}><Input value={config.slug} onChange={(e) => update({ slug: slugify(e.target.value), routeBase: `/landing/${slugify(e.target.value)}` })} /></Field>
          <Field label="Setup call link" hint="Optional"><Input type="url" value={config.scheduleCallUrl} onChange={(e) => update({ scheduleCallUrl: e.target.value })} placeholder="https://..." /></Field>
          <div className="md:col-span-2"><Field label="Relationship disclaimer" hint="Use the exact wording approved by your school, district or organization."><Textarea value={config.disclaimer} onChange={(e) => update({ disclaimer: e.target.value })} rows={3} /></Field></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Logo and photography</CardTitle></CardHeader><CardContent className="space-y-5">
          <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = '' }} />
          {([['mark', 'Logo', 'logo'], ['crowd', 'Cover photo', 'cover_photo']] as const).map(([asset, label, mediaType]) => <div key={asset} className="grid gap-3 rounded-xl border border-surface-200 p-4 sm:grid-cols-[120px_1fr_auto] sm:items-center">
            <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-surface-100">{config.assets[asset].src ? <img src={config.assets[asset].src} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-surface-400" />}</div>
            <Field label={`${label} description`} hint="This helps people using screen readers."><Input value={config.assets[asset].alt} onChange={(e) => updateAsset(asset, { alt: e.target.value })} /></Field>
            <Button variant="outline" onClick={() => { uploadKind.current = mediaType; uploadRef.current?.click() }}><Upload className="h-4 w-4" />Upload</Button>
          </div>)}
          <p className="text-sm text-surface-500">Use a transparent logo and a wide, high resolution cover photo featuring your real community.</p>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Brand colors</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {(Object.keys(config.colors) as Array<keyof LandingConfig['colors']>).map((key) => <Field key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())}><div className="flex gap-2"><input aria-label={`${key} color picker`} type="color" value={config.colors[key]} onChange={(e) => update({ colors: { ...config.colors, [key]: e.target.value } })} className="h-9 w-12 rounded border border-surface-300" /><Input value={config.colors[key]} onChange={(e) => update({ colors: { ...config.colors, [key]: e.target.value } })} /></div></Field>)}
        </CardContent></Card>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card className="overflow-hidden"><div className="relative min-h-[380px] bg-cover bg-center" style={{ backgroundColor: config.colors.navy, backgroundImage: config.assets.crowd.src ? `linear-gradient(90deg, ${config.colors.navy} 20%, ${config.colors.navy}dd 56%, transparent), url(${config.assets.crowd.src})` : undefined }}><div className="relative z-10 flex min-h-[380px] max-w-[75%] flex-col justify-center p-8 text-white">
          {config.assets.mark.src && <img src={config.assets.mark.src} alt="" className="mb-8 h-16 w-40 object-contain object-left" />}
          <span className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: config.colors.gold }}>Support that keeps growing</span>
          <h2 className="text-4xl font-bold leading-tight">Your community.<br />More ways to win.</h2>
          <p className="mt-5 text-sm leading-6 text-white/85">Connect families, local businesses and {config.organizationName} through everyday shopping.</p>
          <div className="mt-7 h-10 w-36 rounded-full" style={{ backgroundColor: config.colors.gold }} />
        </div></div></Card>

        <Card><CardHeader><CardTitle>Ready to publish</CardTitle></CardHeader><CardContent className="space-y-3">
          {missing.length === 0 ? <div className="flex items-center gap-2 text-sm text-success-700"><CheckCircle2 className="h-4 w-4" />Everything required is ready.</div> : missing.map((item) => <div key={item} className="text-sm text-surface-600">• {item}</div>)}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Audience pages</CardTitle></CardHeader><CardContent className="space-y-2">
          {[['Everyone', ''], ['Families and supporters', '/families'], ['Local businesses', '/business'], ['Your organization', '/causes']].map(([label, path]) => <Link key={label} href={`${baseUrl}${path}`} target="_blank" className={`flex items-center justify-between rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium ${live ? 'hover:border-brand-300 hover:bg-brand-50' : 'pointer-events-none opacity-50'}`}><span>{label}</span><ExternalLink className="h-4 w-4" /></Link>)}
          {!live && <p className="pt-1 text-xs text-surface-500">Publish once to activate all four links.</p>}
        </CardContent></Card>
      </div>
    </div>
  </div>
}
