'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download, Copy, ImagePlus, Loader2, Printer } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { buildInvitationEmail, type InvitationEmailInput } from '@/lib/invitation-email'
import { buildInvitationFlyerHtml } from '@/lib/invitation-flyer'
import type { CrmCauseDetailResponse, CrmCauseListItem, CrmCausesResponse } from '@/lib/crm-api'

const inputClass = 'w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-surface-600 mb-1.5'
const qaAssetBase = (process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL || 'https://qa.localvip.com').replace(/\/+$/, '')
const invitationAssetBase = (process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://dashboard.localvip.com').replace(/\/+$/, '')

function publicAssetUrl(value: string | null | undefined, folder: 'logos' | 'covers') {
  const trimmed = value?.trim() || ''
  if (!trimmed) return ''
  if (/^https:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/') || trimmed.includes('/')) return ''
  return `${qaAssetBase}/uploads/${folder}/${encodeURIComponent(trimmed)}`
}

const initialDetails: InvitationEmailInput = {
  causeName: '', causeLogoUrl: '', heroPhotoUrl: '', audience: 'Leaders, partners and supporters',
  programLabel: 'Community programs', headline: 'THE FUNDRAISER WITH NOTHING TO SELL',
  introduction: '', meetingDate: '', meetingTime: '12:00 PM', timeZone: 'CT', durationMinutes: 30,
  meetingPlatform: 'Zoom', meetingUrl: '', rsvpEmail: 'rick@localvip.com', rsvpPhone: '480-463-4632',
  qrImageUrl: '', qrDestinationUrl: '', separateBookingUrl: '',
  hostName: '', hostTitle: '', presenterName: 'Rick Swanson', presenterTitle: 'Founder & CEO, LocalVIP',
  hostArtworkUrl: '', presenterArtworkUrl: '', brandLogoUrl: '',
  benefitCards: [
    {title: 'Local Businesses', bullets: ['Turns slow days into busy days', 'Easy way to support local schools', 'Zero upfront costs with no risk']},
    {title: 'Families & Supporters', bullets: ['Easiest fundraiser ever', 'Get extra cash back savings', 'Be a hero for our students']},
    {title: 'Your Club & School', bullets: ['Year-round free fundraiser', 'Snowball effect grows monthly', 'Community Cash bonus']},
  ],
}

function Field({label, value, onChange, type = 'text', placeholder}: {label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string}) {
  return <label className="block"><span className={labelClass}>{label}</span><input className={inputClass} type={type} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></label>
}

export function InvitationEmailPage() {
  const [causes, setCauses] = React.useState<CrmCauseListItem[]>([])
  const [selectedId, setSelectedId] = React.useState('')
  const [selectedCause, setSelectedCause] = React.useState<CrmCauseListItem | null>(null)
  const [details, setDetails] = React.useState<InvitationEmailInput>(initialDetails)
  const [loading, setLoading] = React.useState(true)
  const [loadingCause, setLoadingCause] = React.useState(false)
  const [uploading, setUploading] = React.useState<'logo' | 'cover_photo' | null>(null)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [previewKind, setPreviewKind] = React.useState<'email' | 'flyer'>('email')

  const set = <K extends keyof InvitationEmailInput>(key: K, value: InvitationEmailInput[K]) => setDetails(current => ({...current, [key]: value}))
  const generated = React.useMemo(() => buildInvitationEmail(details), [details])
  const flyerHtml = React.useMemo(() => buildInvitationFlyerHtml(details), [details])
  const ready = !!(
    details.causeName.trim() && details.meetingDate && details.meetingTime.trim()
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.rsvpEmail.trim())
    && details.durationMinutes >= 5 && details.durationMinutes <= 240
    && (!details.meetingUrl || /^https:\/\//i.test(details.meetingUrl.trim()))
    && (!details.qrImageUrl && !details.qrDestinationUrl || !!(details.qrImageUrl && details.qrDestinationUrl && /^https:\/\//i.test(details.qrImageUrl.trim()) && /^https:\/\//i.test(details.qrDestinationUrl.trim())))
    && [details.separateBookingUrl, details.hostArtworkUrl, details.presenterArtworkUrl, details.brandLogoUrl].every(value => !value || /^https:\/\//i.test(value.trim()))
  )
  const flyerReady = ready && /^https:\/\//i.test(details.causeLogoUrl?.trim() || '') && /^https:\/\//i.test(details.heroPhotoUrl?.trim() || '')

  React.useEffect(() => {
    let active = true
    fetch('/api/crm/causes', {cache: 'no-store'}).then(async response => {
      const body = await response.json() as CrmCausesResponse & {error?: string}
      if (!response.ok) throw new Error(body.error || 'Could not load causes.')
      if (active) setCauses(body.items || [])
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load causes.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function selectCause(id: string) {
    setSelectedId(id)
    setNotice('')
    setError('')
    const selected = causes.find(cause => cause.rowId === id) || null
    setSelectedCause(selected)
    if (!selected) return
    setLoadingCause(true)
    try {
      const response = await fetch(`/api/crm/causes/${encodeURIComponent(selected.qaCauseId ? `qa-${selected.qaCauseId}` : selected.localCauseId || '')}`, {cache: 'no-store'})
      const body = await response.json() as CrmCauseDetailResponse & {error?: string}
      if (!response.ok) throw new Error(body.error || 'Could not load cause assets.')
      const logo = publicAssetUrl(body.qaCause?.imageUrl, 'logos') || publicAssetUrl(body.cause.logo_url, 'logos')
      const hero = publicAssetUrl(body.qaCause?.coverPhotoUrl, 'covers') || publicAssetUrl(body.cause.cover_photo_url, 'covers')
      const isNorthwest = selected.name.toLowerCase().includes('olathe northwest')
      setDetails(current => ({
        ...current,
        causeName: selected.name,
        causeLogoUrl: logo,
        heroPhotoUrl: hero,
        audience: selected.type === 'school' ? 'Booster club leaders, coaches and sponsors' : 'Cause leaders and community partners',
        programLabel: selected.type === 'school' ? 'Athletics & activities' : 'Community programs',
        introduction: `Parents and supporters spend money every month at local businesses. Now those everyday purchases can help fund ${selected.name}.`,
        hostName: '',
        hostTitle: '',
        hostArtworkUrl: isNorthwest ? `${invitationAssetBase}/invitations/olathe-northwest/host-kayla-barnes.png` : '',
        presenterArtworkUrl: isNorthwest ? `${invitationAssetBase}/invitations/olathe-northwest/localvip-pin.png` : '',
        brandLogoUrl: `${invitationAssetBase}/invitations/olathe-northwest/localvip-wordmark.png`,
        qrImageUrl: '',
        qrDestinationUrl: '',
        benefitCards: isNorthwest ? [
          {title: 'Olathe Businesses', bullets: ['Turns slow days into busy days', 'Easy way to support all schools', 'Zero upfront costs with no risk']},
          {title: 'Olathe Parents', bullets: ['Easiest fundraiser ever', 'Get extra cash back savings', 'Be a hero for our students']},
          {title: 'Your Club & School', bullets: ['Year-round free fundraiser', 'Snowball effect grows monthly', 'Community Cash bonus']},
        ] : initialDetails.benefitCards,
      }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load cause assets.')
    } finally {
      setLoadingCause(false)
    }
  }

  async function uploadAsset(file: File | undefined, mediaType: 'logo' | 'cover_photo') {
    if (!file || !selectedCause) return
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return }
    const id = selectedCause.qaCauseId || selectedCause.localCauseId
    if (!id) { setError('This cause has no linked account for media uploads.'); return }
    setUploading(mediaType)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('mediaType', mediaType)
      const response = await fetch(`/api/crm/causes/${encodeURIComponent(String(id))}/media`, {method: 'POST', body: form})
      const body = await response.json() as {fileUrl?: string; qaImageUrl?: string; error?: string}
      if (!response.ok || !body.fileUrl) throw new Error(body.error || 'Upload did not return an image URL.')
      const publicUrl = publicAssetUrl(body.qaImageUrl || body.fileUrl, mediaType === 'logo' ? 'logos' : 'covers')
      if (!publicUrl) throw new Error('The uploaded image has no public HTTPS URL. Add a public image URL below.')
      set(mediaType === 'logo' ? 'causeLogoUrl' : 'heroPhotoUrl', publicUrl)
      setNotice(`${mediaType === 'logo' ? 'Logo' : 'Photo'} uploaded to the cause.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload image.')
    } finally {
      setUploading(null)
    }
  }

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setNotice(`${label} copied.`) }
    catch { setError(`Could not copy ${label.toLowerCase()}. Download the HTML instead.`) }
  }

  function downloadHtml() {
    const blob = new Blob([generated.html], {type: 'text/html;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${details.causeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'cause'}-meeting-invitation.html`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Email HTML downloaded.')
  }

  function downloadFlyerHtml() {
    const blob = new Blob([flyerHtml], {type: 'text/html;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${details.causeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'cause'}-meeting-flyer.html`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Print-ready flyer downloaded.')
  }

  function printFlyer() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) { setError('Allow pop-ups to print the flyer.'); return }
    printWindow.document.open()
    printWindow.addEventListener('load', () => printWindow.print(), {once: true})
    printWindow.document.write(flyerHtml)
    printWindow.document.close()
  }

  return <div className="space-y-6">
    <PageHeader title="Meeting Invitations" description="Choose an onboarded school or cause, enter meeting details, then preview its email and matching print flyer. No email is sent from this page." />
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section className="space-y-5 rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
        <div><label className={labelClass} htmlFor="invite-cause">Cause</label><select id="invite-cause" className={inputClass} value={selectedId} onChange={event => void selectCause(event.target.value)} disabled={loading}><option value="">{loading ? 'Loading causes...' : 'Choose a cause'}</option>{causes.map(cause => <option key={cause.rowId} value={cause.rowId}>{cause.name} · {cause.stage || 'stage unknown'}</option>)}</select>{selectedCause && <Link className="mt-2 inline-block text-sm text-brand-700 underline" href={selectedCause.detailHref}>Open cause profile</Link>}</div>
        {loadingCause && <div className="flex items-center gap-2 text-sm text-surface-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading cause assets</div>}
        {selectedCause && !['onboarded', 'live'].includes(selectedCause.stage || '') && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">This cause is marked {selectedCause.stage || 'unknown'}, so check its onboarding status before sharing the invitation.</p>}
        <Field label="Cause name" value={details.causeName} onChange={value => set('causeName', value)} />
        <Field label="Audience" value={details.audience} onChange={value => set('audience', value)} />
        <Field label="Program label" value={details.programLabel} onChange={value => set('programLabel', value)} />
        <Field label="Headline" value={details.headline} onChange={value => set('headline', value)} />
        <label className="block"><span className={labelClass}>Introduction</span><textarea className={inputClass} rows={3} value={details.introduction} onChange={event => set('introduction', event.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3"><Field label="Meeting date" type="date" value={details.meetingDate} onChange={value => set('meetingDate', value)} /><Field label="Time" value={details.meetingTime} onChange={value => set('meetingTime', value)} placeholder="12:00 PM" /></div>
        <div className="grid grid-cols-3 gap-3"><Field label="Time zone" value={details.timeZone} onChange={value => set('timeZone', value)} /><label className="block"><span className={labelClass}>Minutes</span><input className={inputClass} type="number" min={5} max={240} value={details.durationMinutes} onChange={event => set('durationMinutes', Number(event.target.value))} /></label><Field label="Platform" value={details.meetingPlatform} onChange={value => set('meetingPlatform', value)} /></div>
        <Field label="Meeting link (optional)" type="url" value={details.meetingUrl || ''} onChange={value => set('meetingUrl', value)} placeholder="https://..." />
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3"><h2 className="mb-1 text-sm font-semibold text-surface-900">Optional QR code</h2><p className="mb-3 text-xs text-surface-600">Leave both fields empty for a QR-free invitation. Add a publicly hosted QR image and the URL it opens to display one.</p><div className="space-y-3"><Field label="QR code image URL" type="url" value={details.qrImageUrl || ''} onChange={value => set('qrImageUrl', value)} placeholder="https://.../rsvp-qr.png" /><Field label="QR destination URL" type="url" value={details.qrDestinationUrl || ''} onChange={value => set('qrDestinationUrl', value)} placeholder="https://.../rsvp" /></div></div>
        <Field label="Separate meeting booking link (optional)" type="url" value={details.separateBookingUrl || ''} onChange={value => set('separateBookingUrl', value)} placeholder="https://..." />
        <div className="grid grid-cols-2 gap-3"><Field label="RSVP email" type="email" value={details.rsvpEmail} onChange={value => set('rsvpEmail', value)} /><Field label="RSVP phone" value={details.rsvpPhone || ''} onChange={value => set('rsvpPhone', value)} /></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Host name" value={details.hostName || ''} onChange={value => set('hostName', value)} /><Field label="Host title" value={details.hostTitle || ''} onChange={value => set('hostTitle', value)} /></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Presenter name" value={details.presenterName || ''} onChange={value => set('presenterName', value)} /><Field label="Presenter title" value={details.presenterTitle || ''} onChange={value => set('presenterTitle', value)} /></div>
        <div className="space-y-3 rounded-lg border border-surface-200 bg-surface-50 p-3"><h2 className="text-sm font-semibold text-surface-900">Footer artwork</h2><p className="text-xs text-surface-600">Use public HTTPS image URLs for the host lockup, presenter mark and LocalVIP wordmark. Leave a field blank to show text instead.</p><Field label="Host artwork URL" type="url" value={details.hostArtworkUrl || ''} onChange={value => set('hostArtworkUrl', value)} /><Field label="Presenter mark URL" type="url" value={details.presenterArtworkUrl || ''} onChange={value => set('presenterArtworkUrl', value)} /><Field label="LocalVIP wordmark URL" type="url" value={details.brandLogoUrl || ''} onChange={value => set('brandLogoUrl', value)} /></div>
        <div className="space-y-3 rounded-lg border border-surface-200 bg-surface-50 p-3"><h2 className="text-sm font-semibold text-surface-900">Everybody wins cards</h2>{(details.benefitCards || []).map((card, index) => <div key={index} className="space-y-2 rounded-lg border border-surface-200 bg-white p-3"><Field label={`Card ${index + 1} title`} value={card.title} onChange={value => set('benefitCards', (details.benefitCards || []).map((item, i) => i === index ? {...item, title: value} : item))} />{card.bullets.map((bullet, bulletIndex) => <Field key={bulletIndex} label={`Benefit ${bulletIndex + 1}`} value={bullet} onChange={value => set('benefitCards', (details.benefitCards || []).map((item, i) => i === index ? {...item, bullets: item.bullets.map((line, j) => j === bulletIndex ? value : line)} : item))} />)}</div>)}</div>
        <div className="border-t border-surface-200 pt-5"><h2 className="mb-3 font-semibold text-surface-900">Cause images</h2><p className="mb-3 text-xs text-surface-600">The selected cause&apos;s uploaded logo and cover photo are used automatically. You can upload replacements here or paste public image URLs.</p><Field label="Logo URL" type="url" value={details.causeLogoUrl || ''} onChange={value => set('causeLogoUrl', value)} /><label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-brand-700"><ImagePlus className="h-4 w-4" />{uploading === 'logo' ? 'Uploading logo...' : 'Upload logo'}<input className="sr-only" type="file" accept="image/*" disabled={!selectedCause || !!uploading} onChange={event => void uploadAsset(event.target.files?.[0], 'logo')} /></label><div className="mt-4"><Field label="Hero photo URL" type="url" value={details.heroPhotoUrl || ''} onChange={value => set('heroPhotoUrl', value)} /></div><label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-brand-700"><ImagePlus className="h-4 w-4" />{uploading === 'cover_photo' ? 'Uploading photo...' : 'Upload cover photo'}<input className="sr-only" type="file" accept="image/*" disabled={!selectedCause || !!uploading} onChange={event => void uploadAsset(event.target.files?.[0], 'cover_photo')} /></label></div>
      </section>
      <section className="space-y-4"><div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-surface-900">{previewKind === 'email' ? 'Email preview' : 'Flyer preview'}</h2><div className="flex gap-2"><button type="button" onClick={() => setPreviewKind('email')} aria-pressed={previewKind === 'email'} className={`rounded-lg px-3 py-1.5 text-sm ${previewKind === 'email' ? 'bg-brand-600 text-white' : 'bg-surface-100'}`}>Email</button><button type="button" onClick={() => setPreviewKind('flyer')} aria-pressed={previewKind === 'flyer'} className={`rounded-lg px-3 py-1.5 text-sm ${previewKind === 'flyer' ? 'bg-brand-600 text-white' : 'bg-surface-100'}`}>Flyer</button></div></div><p className="mt-1 text-xs text-surface-600">Images need public HTTPS URLs for the exported files. The flyer prints on one letter-size page.</p>{(!details.causeLogoUrl || !details.heroPhotoUrl) && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Add a logo and cover photo to complete the branded invitation.</p>}{previewKind === 'email' && <div className="mt-4 rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm"><strong>Subject:</strong> {generated.subject}</div>}<iframe title={`${previewKind === 'email' ? 'Email' : 'Flyer'} invitation preview`} sandbox="" srcDoc={previewKind === 'email' ? generated.html : flyerHtml} className="mt-4 h-[900px] w-full rounded-lg border border-surface-200 bg-white" /></div><div className="flex flex-wrap gap-3 rounded-2xl border border-surface-200 bg-white p-5 shadow-sm"><button type="button" disabled={!ready} onClick={() => void copy(generated.subject, 'Subject')} className="inline-flex items-center gap-2 rounded-lg border border-surface-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"><Copy className="h-4 w-4" />Copy subject</button><button type="button" disabled={!ready} onClick={() => void copy(generated.html, 'Email HTML')} className="inline-flex items-center gap-2 rounded-lg border border-surface-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"><Copy className="h-4 w-4" />Copy email HTML</button><button type="button" disabled={!ready} onClick={downloadHtml} className="inline-flex items-center gap-2 rounded-lg border border-surface-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"><Download className="h-4 w-4" />Download email</button><button type="button" disabled={!flyerReady} onClick={downloadFlyerHtml} className="inline-flex items-center gap-2 rounded-lg border border-surface-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"><Download className="h-4 w-4" />Download flyer</button><button type="button" disabled={!flyerReady} onClick={printFlyer} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Printer className="h-4 w-4" />Print / Save PDF</button></div></section>
    </div>
  </div>
}
