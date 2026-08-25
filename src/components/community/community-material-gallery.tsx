'use client'

import * as React from 'react'
import { Check, Download, FileText, ImagePlus, Loader2, Pencil, QrCode, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth/context'
import { useMaterialInsert, useMaterials } from '@/lib/supabase/hooks'
import type { Cause, Material } from '@/lib/types/database'

type CommunityMaterialAudience = 'business' | 'supporter'

function materialAudience(material: Material): CommunityMaterialAudience {
  const metadata = (material.metadata as Record<string, unknown> | null) || {}
  const flyerType = typeof metadata.flyer_type === 'string' ? metadata.flyer_type.toLowerCase() : ''
  const useCase = (material.use_case || '').toLowerCase()
  if (flyerType === 'business' || useCase.includes('business')) return 'business'
  return 'supporter'
}

function isIntentionalAudienceTemplate(material: Material, audience: CommunityMaterialAudience) {
  const metadata = (material.metadata as Record<string, unknown> | null) || {}
  const flyerType = typeof metadata.flyer_type === 'string' ? metadata.flyer_type.toLowerCase() : ''
  const useCase = (material.use_case || '').toLowerCase()
  if (audience === 'business') return flyerType === 'business' || useCase.includes('business')
  return ['supporter', 'parent', 'school', 'community'].some(value => flyerType.includes(value) || useCase.includes(value))
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] || character)
}

function buildBusinessFlyerSvg(input: { schoolName: string; teamName: string; logoUrl: string; heroUrl: string; qrUrl: string }) {
  const school = escapeXml(input.schoolName.toUpperCase())
  const image = (url: string, x: number, y: number, width: number, height: number, fit = 'xMidYMid slice') => url
    ? `<image href="${escapeXml(url)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${fit}"/>`
    : ''
  const steps = [
    ['01', 'YOU PICK THE DAY', 'Choose a day that works.'], ['02', 'WE PROMOTE YOU', 'We rally local families.'],
    ['03', 'THEY SHOP', 'Everyone benefits.'], ['04', 'IMPACT CONTINUES', 'The relationship grows.'],
  ].map((step, index) => { const x = 30 + index * 198; return `<g><circle cx="${x + 24}" cy="530" r="20" fill="#08244d"/><text x="${x + 24}" y="536" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="700">${step[0]}</text><text x="${x}" y="580" fill="#08244d" font-family="Arial" font-size="16" font-weight="800">${step[1]}</text><text x="${x}" y="612" fill="#27364b" font-family="Arial" font-size="13">${step[2]}</text></g>` }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="816" height="1056" viewBox="0 0 816 1056"><defs><linearGradient id="heroShade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#031632"/><stop offset=".58" stop-color="#031632" stop-opacity=".68"/><stop offset="1" stop-color="#031632" stop-opacity=".12"/></linearGradient></defs><rect width="816" height="1056" fill="#f4f6f8"/><rect width="816" height="490" fill="#061a39"/>${image(input.heroUrl, 0, 0, 816, 490)}<rect width="816" height="490" fill="url(#heroShade)"/><rect x="40" y="32" width="736" height="100" rx="10" fill="#061a39" fill-opacity=".72"/>${image(input.logoUrl, 58, 48, 72, 72, 'xMidYMid meet')}<rect x="144" y="50" width="3" height="65" fill="#f5b719"/><text x="164" y="72" fill="white" font-family="Arial" font-size="28" font-weight="800">${school}</text><text x="164" y="102" fill="#c8d0da" font-family="Arial" font-size="21" font-weight="700">${escapeXml(input.teamName.toUpperCase())}</text><text x="48" y="202" fill="white" font-family="Arial Black,Arial" font-size="47" font-weight="900">YOUR BUSINESS.</text><text x="48" y="254" fill="white" font-family="Arial Black,Arial" font-size="47" font-weight="900">OUR COMMUNITY.</text><text x="48" y="306" fill="#f5b719" font-family="Arial Black,Arial" font-size="47" font-weight="900">LET'S WIN</text><text x="48" y="358" fill="#f5b719" font-family="Arial Black,Arial" font-size="47" font-weight="900">TOGETHER.</text><text x="50" y="404" fill="white" font-family="Arial" font-size="17" font-weight="700">Connect with ${escapeXml(input.schoolName)} families</text><text x="50" y="430" fill="white" font-family="Arial" font-size="17">while supporting students, teams and community.</text><rect y="490" width="816" height="245" fill="white"/>${steps}<rect y="735" width="816" height="135" fill="#e9edf2"/><text x="408" y="782" text-anchor="middle" fill="#08244d" font-family="Arial Black,Arial" font-size="25" font-weight="900">GENEROSITY SHOULDN'T BE ONE-WAY.</text><text x="408" y="820" text-anchor="middle" fill="#39485c" font-family="Arial" font-size="17">Customers benefit. ${school} benefits. Your business benefits.</text><rect y="870" width="816" height="170" fill="#061a39"/><rect y="870" width="816" height="5" fill="#f5b719"/><rect x="38" y="896" width="120" height="120" rx="8" fill="white"/>${image(input.qrUrl, 46, 904, 104, 104, 'xMidYMid meet')}${input.qrUrl ? '' : '<text x="98" y="960" text-anchor="middle" fill="#7b8796" font-family="Arial" font-size="13">ADD QR</text>'}<text x="188" y="920" fill="white" font-family="Arial Black,Arial" font-size="20" font-weight="900">CLAIM YOUR FIRST</text><text x="188" y="950" fill="white" font-family="Arial Black,Arial" font-size="24" font-weight="900">${school} GIVEBACK DAY</text><text x="188" y="981" fill="#f5b719" font-family="Arial Black,Arial" font-size="22" font-weight="900">AT YOUR BUSINESS.</text><text x="188" y="1010" fill="#cbd3dd" font-family="Arial" font-size="13">Scan to watch the video and get started.</text><rect y="1040" width="816" height="16" fill="#d7dde5"/></svg>`
}

function TemplateCustomizer({ material, cause, onClose, onSaved }: { material: Material; cause: Cause; onClose: () => void; onSaved: () => void }) {
  const { localProfileId } = useAuth()
  const { insert } = useMaterialInsert()
  const metadata = (cause.metadata || {}) as Record<string, unknown>
  const [schoolName, setSchoolName] = React.useState(cause.name)
  const [teamName, setTeamName] = React.useState(typeof metadata.team_name === 'string' ? metadata.team_name : 'ATHLETICS & ACTIVITIES')
  const [logoUrl, setLogoUrl] = React.useState(cause.logo_url || '')
  const [heroUrl, setHeroUrl] = React.useState(cause.cover_photo_url || '')
  const [qrUrl, setQrUrl] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const svg = React.useMemo(() => buildBusinessFlyerSvg({ schoolName, teamName, logoUrl, heroUrl, qrUrl }), [heroUrl, logoUrl, qrUrl, schoolName, teamName])
  const preview = React.useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg])

  async function selectImage(file: File | undefined, setter: (value: string) => void) { if (file) setter(await fileToDataUrl(file)) }
  async function save() {
    setSaving(true); setError('')
    try {
      const fileName = `${schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-business-giveback-flyer.svg`
      const file = new File([svg], fileName, { type: 'image/svg+xml' })
      const form = new FormData(); form.append('file', file)
      const upload = await fetch('/api/qa/material-asset/upload?folder=finished-materials', { method: 'POST', body: form })
      const uploaded = await upload.json().catch(() => null)
      if (!upload.ok || !uploaded?.fileUrl) throw new Error(uploaded?.error || 'The finished flyer could not be uploaded.')
      const result = await insert({ title: `${schoolName} — Business Giveback Day Flyer`, description: `Customized business flyer for ${schoolName}.`, type: 'flyer', brand: 'localvip', file_url: uploaded.fileUrl, file_name: fileName, file_size: file.size, mime_type: 'image/svg+xml', thumbnail_url: uploaded.fileUrl, category: 'finished_materials', use_case: 'business', target_roles: ['community'], target_subtypes: ['school'], campaign_id: null, city_id: cause.city_id, is_template: false, version: 1, status: 'active', created_by: localProfileId || undefined, metadata: { cause_id: cause.id, audience: 'business', source_template_id: material.id, school_name: schoolName, team_name: teamName, customized: true } })
      if (!result) throw new Error('The finished flyer could not be saved.')
      onSaved(); onClose()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The finished flyer could not be saved.') } finally { setSaving(false) }
  }

  const uploads: Array<[string, string, (file?: File) => void, typeof ImagePlus]> = [
    ['School logo', logoUrl, file => selectImage(file, setLogoUrl), ImagePlus], ['Top hero photo', heroUrl, file => selectImage(file, setHeroUrl), ImagePlus], ['QR code image', qrUrl, file => selectImage(file, setQrUrl), QrCode],
  ]
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-950/60 p-4 backdrop-blur-sm"><div className="mx-auto my-4 grid max-w-6xl gap-5 rounded-2xl bg-white p-5 shadow-2xl lg:grid-cols-[380px_1fr]"><div className="space-y-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-surface-950">Customize business flyer</h2><p className="mt-1 text-sm text-surface-500">Your changes create a school-specific copy. The master template stays unchanged.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button></div><label className="block space-y-1.5 text-sm font-medium">School or cause name<Input value={schoolName} onChange={event => setSchoolName(event.target.value)} /></label><label className="block space-y-1.5 text-sm font-medium">Team or program name<Input value={teamName} onChange={event => setTeamName(event.target.value)} /></label>{uploads.map(([label, value, handler, Icon]) => <label key={label} className="block rounded-xl border border-surface-200 p-3"><span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-brand-600" />{label}</span><span className="mt-1 block text-xs text-surface-500">{value ? 'Image selected — choose another to replace it.' : 'Choose a transparent PNG, SVG, JPG, or QR image.'}</span><Input className="mt-3" type="file" accept="image/*" onChange={event => handler(event.target.files?.[0])} /></label>)}{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button className="w-full" onClick={save} disabled={saving || !schoolName.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save to Finished Materials</Button></div><div className="rounded-xl bg-surface-100 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500">Live preview</p><img src={preview} alt="Customized flyer preview" className="mx-auto max-h-[78vh] w-auto rounded shadow-lg" /></div></div></div>
}

export function CommunityMaterialGallery({ audience, cause }: { audience: CommunityMaterialAudience; cause: Cause }) {
  const { data: materials, loading, refetch } = useMaterials()
  const [customizing, setCustomizing] = React.useState<Material | null>(null)
  const templates = materials.filter(material => material.is_template && material.status === 'active' && materialAudience(material) === audience && isIntentionalAudienceTemplate(material, audience))
  const finished = materials.filter(material => { const metadata = (material.metadata || {}) as Record<string, unknown>; return !material.is_template && material.status === 'active' && String(metadata.cause_id || '') === cause.id && metadata.audience === audience })
  if (loading) return <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
  const cards = (rows: Material[], finishedRows = false) => <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map(material => <div key={material.id} className="overflow-hidden rounded-2xl border border-surface-200 bg-white"><div className="aspect-[7/9] bg-surface-100">{material.thumbnail_url || material.file_url ? <img src={material.thumbnail_url || material.file_url || ''} alt={material.title} className="h-full w-full object-cover object-top" /> : <div className="flex h-full items-center justify-center"><FileText className="h-10 w-10 text-surface-300" /></div>}</div><div className="space-y-3 p-4"><div><p className="line-clamp-2 text-sm font-semibold text-surface-900">{material.title}</p><div className="mt-2 flex gap-1.5"><Badge variant="default">Flyer</Badge><Badge variant="outline">{finishedRows ? 'Finished' : 'Template'}</Badge></div></div>{finishedRows || audience === 'supporter' ? <Button asChild variant="outline" size="sm" className="w-full"><a href={material.file_url || ''} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /> {finishedRows ? 'Download' : 'Open flyer'}</a></Button> : <Button size="sm" className="w-full" onClick={() => setCustomizing(material)}><Pencil className="h-3.5 w-3.5" /> Customize</Button>}</div></div>)}</div>
  return <div className="space-y-8"><section><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-surface-900">My finished materials</h3><p className="text-sm text-surface-500">Customized files ready for {cause.name} to download and share.</p></div><Badge variant={finished.length ? 'success' : 'default'}>{finished.length} ready</Badge></div>{finished.length ? cards(finished, true) : <EmptyState icon={<FileText className="h-8 w-8" />} title="No finished business flyers yet" description="Choose a template below, add your school branding and QR code, then save it here." />}</section><section><div className="mb-4"><h3 className="font-semibold text-surface-900">Template library</h3><p className="text-sm text-surface-500">Start with an approved LocalVIP layout. Your edits create a separate copy for your school.</p></div>{templates.length ? cards(templates) : <EmptyState icon={<FileText className="h-8 w-8" />} title="No business flyer templates yet" description="Approved templates will appear here when they are published." />}</section>{customizing && <TemplateCustomizer material={customizing} cause={cause} onClose={() => setCustomizing(null)} onSaved={() => refetch({ silent: true })} />}</div>
}
