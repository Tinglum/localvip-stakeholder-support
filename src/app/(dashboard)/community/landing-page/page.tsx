'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, Globe2, ImageIcon, Loader2, Save, Send, Upload, Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { LandingStyleCarousel } from '@/components/community/landing-style-carousel'
import { expandBrandPalette, extractBrandColorsFromImage } from '@/lib/brand-colors'
import { useAuth } from '@/lib/auth/context'
import { useCauses } from '@/lib/supabase/hooks'
import { resolveCommunityCause } from '@/lib/community-cause'
import { CauseLoadError } from '@/components/community/cause-load-error'
import { CAUSE_PHOTO_PROMPTS } from '@/lib/cause-setup'
import {
  defaultLandingConfig as defaultConfig,
  isLandingOutOfDate,
  landingPublishBlockers,
  qaCauseId,
  slugify,
  type ImageAsset,
  type LandingConfig,
  type LandingRecord,
} from '@/lib/cause-landing-config'

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
  const [extractingColors, setExtractingColors] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [dirty, setDirty] = React.useState(false)
  const loadedId = React.useRef<number | null>(null)
  const uploadRef = React.useRef<HTMLInputElement | null>(null)
  const uploadKind = React.useRef<'logo' | 'cover_photo' | 'team' | 'community' | 'people'>('logo')

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
      const isPrimary = uploadKind.current === 'logo' || uploadKind.current === 'cover_photo'
      if (isPrimary) data.append('mediaType', uploadKind.current)
      else data.append('slot', uploadKind.current)
      const response = await fetch(
        isPrimary ? `/api/crm/causes/${causeId}/media` : `/api/crm/causes/${causeId}/landing-page/assets`,
        { method: 'POST', body: data },
      )
      const body = await response.json()
      if (!response.ok || !body.fileUrl) throw new Error(body.error || 'Upload failed.')
      const asset = uploadKind.current === 'logo' ? 'mark' : uploadKind.current === 'cover_photo' ? 'crowd' : uploadKind.current
      if (asset === 'mark') {
        update({
          assets: { ...config!.assets, mark: { src: body.fileUrl, alt: config?.assets.mark.alt || `${cause.name} logo` } },
          brandColorsConfirmed: false,
        })
        setMessage('Logo uploaded. Pull colors from it below, review the preview, then publish the updated page.')
      } else {
        updateAsset(asset, { src: body.fileUrl, alt: config?.assets[asset]?.alt || `${cause.name} ${asset}` })
        setMessage('Image uploaded. Review the preview, then publish the updated page.')
      }
    } catch (uploadError) {
      setMessage(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
    } finally { setSaving(false) }
  }

  async function pullLogoColors() {
    if (!config?.assets.mark.src) return
    setExtractingColors(true)
    setMessage('Reading colors from your logo...')
    try {
      const found = await extractBrandColorsFromImage(config.assets.mark.src)
      if (!found) throw new Error('We could not read colors from this logo. Choose them below.')
      update({ colors: expandBrandPalette(found, config.colors), brandColorsConfirmed: true })
      setMessage('Colors updated in your draft. Review the preview, then publish to update the live landing page.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not read colors from this logo.')
    } finally { setExtractingColors(false) }
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

  const missing = landingPublishBlockers(config)
  const baseUrl = `${process.env.NEXT_PUBLIC_WEBAPP_URL || 'https://my.localvip.com'}/landing/${config.slug}`
  const live = record?.status === 'published' || record?.status === 'published_with_changes'
  const outOfDate = isLandingOutOfDate(record)

  return <div className="space-y-6 pb-20">
    <PageHeader title="Your Landing Pages" description="Add your identity once, preview the result, then publish pages for families, businesses and your organization." />

    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-200 bg-white p-3">
      <Badge variant={live ? 'success' : 'default'}>{record?.status === 'published_with_changes' ? 'Live · draft changes' : live ? 'Live' : 'Draft'}</Badge>
      <span className="text-sm text-surface-500">{saving ? 'Saving...' : dirty ? 'Waiting to save' : 'All changes saved'}</span>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" onClick={() => void save()} disabled={saving}><Save className="h-4 w-4" />Save now</Button>
        {live && <Button variant="outline" onClick={() => void publish('unpublish')} disabled={publishing}>Unpublish</Button>}
        <Button onClick={() => void publish('publish')} disabled={publishing || missing.length > 0}>{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publish</Button>
      </div>
    </div>

    {outOfDate && <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-warning-300 bg-warning-50 px-4 py-4 text-sm text-warning-800">
      <AlertTriangle className="h-5 w-5 shrink-0 text-warning-600" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Your live page is out of date</span>
        <span className="block">
          Newer photos{config.video?.src ? ' and your cause video' : ''} are saved in your draft, but visitors still see
          the version you published last. Press Republish to update it.
        </span>
      </span>
      <Button className="ml-auto" onClick={() => void publish('publish')} disabled={publishing || missing.length > 0}>
        {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Republish
      </Button>
    </div>}

    {message && <div role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">{message}</div>}

    <Card><CardContent className="p-5 sm:p-6">
      <LandingStyleCarousel config={config} live={live} baseUrl={baseUrl} onSelect={(design) => update({ design })} />
    </CardContent></Card>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle>Names and page address</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="School or community name"><Input value={config.schoolName} onChange={(e) => update({ schoolName: e.target.value })} /></Field>
          <Field label="Organization name"><Input value={config.organizationName} onChange={(e) => update({ organizationName: e.target.value })} /></Field>
          <div className="md:col-span-2"><Field label="What this campaign supports" hint="Shown on the landing page and flyers."><Input value={config.mission || ''} onChange={(e) => update({ mission: e.target.value })} placeholder="Field trips, classroom supplies, and student programs" /></Field></div>
          <div className="md:col-span-2"><Field label="School district or parent organization" hint="Optional. Identify the organization accurately on school materials."><Input value={config.parentOrganization || ''} onChange={(e) => update({ parentOrganization: e.target.value })} placeholder="Olathe Public Schools" /></Field></div>
          <Field label="City or community"><Input value={config.locality} onChange={(e) => update({ locality: e.target.value })} /></Field>
          <Field label="Page address" hint={`my.localvip.com/landing/${config.slug}`}><Input value={config.slug} onChange={(e) => update({ slug: slugify(e.target.value), routeBase: `/landing/${slugify(e.target.value)}` })} /></Field>
          <Field label="Setup call link" hint="Optional"><Input type="url" value={config.scheduleCallUrl} onChange={(e) => update({ scheduleCallUrl: e.target.value })} placeholder="https://..." /></Field>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Logo and photography</CardTitle></CardHeader><CardContent className="space-y-5">
          <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = '' }} />
          <div className="grid gap-3 rounded-xl border border-surface-200 p-4 sm:grid-cols-[120px_1fr_auto] sm:items-center">
            <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-surface-100">{config.assets.mark.src ? <img src={config.assets.mark.src} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-surface-400" />}</div>
            <Field label="Logo description" hint="This helps people using screen readers."><Input value={config.assets.mark.alt} onChange={(e) => updateAsset('mark', { alt: e.target.value })} /></Field>
            <Button variant="outline" onClick={() => { uploadKind.current = 'logo'; uploadRef.current?.click() }}><Upload className="h-4 w-4" />{config.assets.mark.src ? 'Replace' : 'Upload'}</Button>
          </div>
          <p className="text-sm text-surface-500">Use a transparent logo, and high resolution photos of your real community.</p>
          <div className="border-t border-surface-200 pt-5">
            <h3 className="text-sm font-semibold text-surface-900">Your four photos</h3>
            <p className="mt-1 text-sm text-surface-500">All four appear on your pages and in your cause video, and all four are needed before you can publish.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CAUSE_PHOTO_PROMPTS.map(({ slot, label, description }) => <div key={slot} className="overflow-hidden rounded-xl border border-surface-200 bg-surface-50">
                <div className="flex h-28 items-center justify-center overflow-hidden bg-surface-100">{config.assets[slot]?.src ? <img src={config.assets[slot]?.src} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-surface-400" />}</div>
                <div className="space-y-2 p-3">
                  <p className="text-sm font-medium text-surface-800">{label}</p>
                  <p className="text-xs leading-5 text-surface-500">{description}</p>
                  <Input aria-label={`${label} image description`} value={config.assets[slot]?.alt || ''} onChange={(e) => updateAsset(slot, { alt: e.target.value })} placeholder="Image description" />
                  <Button className="w-full" variant="outline" onClick={() => { uploadKind.current = slot === 'crowd' ? 'cover_photo' : slot; uploadRef.current?.click() }}><Upload className="h-4 w-4" />{config.assets[slot]?.src ? 'Replace' : 'Upload'}</Button>
                </div>
              </div>)}
            </div>
          </div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Brand colors</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void pullLogoColors()} disabled={!config.assets.mark.src || extractingColors}>
              {extractingColors ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}Use colors from my logo
            </Button>
            {!config.brandColorsConfirmed && config.assets.mark.src && <span className="text-sm text-surface-600">Review colors after changing your logo.</span>}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {(Object.keys(config.colors) as Array<keyof LandingConfig['colors']>).map((key) => <Field key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())}><div className="flex gap-2"><input aria-label={`${key} color picker`} type="color" value={config.colors[key]} onChange={(e) => update({ colors: { ...config.colors, [key]: e.target.value } })} className="h-9 w-12 rounded border border-surface-300" /><Input value={config.colors[key]} onChange={(e) => update({ colors: { ...config.colors, [key]: e.target.value } })} /></div></Field>)}
          </div>
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
          {[['Everyone', ''], ['Families and supporters', '/families'], ['Local businesses', '/business'], ['School leaders', '/schools'], ['Your organization', '/causes']].map(([label, path]) => <Link key={label} href={`${baseUrl}${path}`} target="_blank" className={`flex items-center justify-between rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium ${live ? 'hover:border-brand-300 hover:bg-brand-50' : 'pointer-events-none opacity-50'}`}><span>{label}</span><ExternalLink className="h-4 w-4" /></Link>)}
          {!live && <p className="pt-1 text-xs text-surface-500">Publish once to activate all five links.</p>}
        </CardContent></Card>
      </div>
    </div>
  </div>
}
