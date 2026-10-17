'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { useCauses } from '@/lib/supabase/hooks'
import { resolveCommunityCause, getCauseQaAccountId } from '@/lib/community-cause'
import { extractBrandColorsFromImage, isHexColor } from '@/lib/brand-colors'
import { BrandColorPicker } from '@/components/ui/brand-color-picker'
import { Button } from '@/components/ui/button'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'
import type { LandingRecord } from '@/lib/cause-landing-config'
import { compactFlyerOverrides, flyerEditKey, type FlyerOverrides, type FlyerSlots } from '@/lib/flyer-slots'
import { FlyerEditPanel } from '@/components/materials/flyer-edit-panel'

const DEFAULT = { background: '#0B2349', highlight: '#EFB719', accent: '#EFB719' }
const modes = [{ value: 'default', label: 'Default', hint: 'Dark blue, white, and gold.' }, { value: 'logo', label: 'Use colors of my logo', hint: 'Logo accents with the dark blue and gold theme.' }, { value: 'manual', label: 'Manual', hint: 'Choose each color yourself.' }] as const

export default function FlyerGeneratorPage() {
  const { profile } = useAuth()
  const { data: causes, loading, error: causesError } = useCauses()
  const search = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [readiness, setReadiness] = React.useState<Record<string, { ready: boolean; missing: string[]; error?: string }>>({})
  const ownCause = resolveCommunityCause(profile, causes)
  const [selected, setSelected] = React.useState(search.get('causeId') || '')
  const causeId = selected || getCauseQaAccountId(ownCause) || ''
  const matches = causes.filter(cause => getCauseQaAccountId(cause) && cause.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
  const visibleCauses = matches.slice(0, 10)
  const checkIds = [...new Set([...visibleCauses.map(cause => getCauseQaAccountId(cause)!), ...(causeId ? [causeId] : [])])].join(',')
  React.useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void Promise.all(checkIds.split(',').filter(Boolean).map(async id => {
        try {
          const response = await fetch(`/api/crm/causes/${id}/flyer`, { signal: controller.signal, cache: 'no-store' })
          const body = await response.json()
          if (!response.ok) throw new Error(body.error || 'Could not check readiness.')
          setReadiness(current => ({ ...current, [id]: body }))
        } catch (error) { if (!controller.signal.aborted) setReadiness(current => ({ ...current, [id]: { ready: false, missing: [], error: error instanceof Error ? error.message : 'Could not check readiness.' } })) }
      }))
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [checkIds])
  const selectedStatus = readiness[causeId]
  function setupUrl(id: string, missing: string[]) {
    const step = missing.some(item => item === 'logo' || item === 'community photo') ? 'images' : missing.includes('referral code') ? 'profile' : 'landing'
    return `/community/setup?causeId=${id}&step=${step}&from=flyer-generator`
  }
  const [audience, setAudience] = React.useState('business')
  const [design, setDesign] = React.useState('community')
  const [mode, setMode] = React.useState('default')
  const [palette, setPalette] = React.useState(DEFAULT)
  const [logoColors, setLogoColors] = React.useState<string[]>([])
  const [logo, setLogo] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [extracting, setExtracting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [result, setResult] = React.useState<{ pdf: string; preview: string; settings: string; overrides: FlyerOverrides; saveError?: string } | null>(null)
  const settings = JSON.stringify({ causeId, audience, design, mode, palette })
  const dirty = !!result && result.settings !== settings
  // Text and image edits for the generated design. `editor.key` ties the slots to
  // the cause, design and audience they were loaded for.
  const [editor, setEditor] = React.useState<{ key: string; slots: FlyerSlots; assets: string[] } | null>(null)
  const [editorError, setEditorError] = React.useState('')
  const [edits, setEdits] = React.useState<FlyerOverrides>({})
  const target = `${causeId}:${flyerEditKey(design, audience)}`
  const pendingEdits = !!result && JSON.stringify(compactFlyerOverrides(edits)) !== JSON.stringify(compactFlyerOverrides(result.overrides))
  React.useEffect(() => {
    setResult(null); setEditor(null); setEdits({}); setLogo(''); setLogoColors([]); setMode('default'); setPalette(DEFAULT); setError('')
    if (!causeId) return
    const controller = new AbortController()
    void fetch(`/api/crm/causes/${causeId}/landing-page`, { signal: controller.signal }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not load cause branding.')
      setLogo((body as LandingRecord).draft?.assets?.mark?.src || causes.find(cause => getCauseQaAccountId(cause) === causeId)?.logo_url || '')
    }).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
    return () => controller.abort()
  }, [causeId, causes])
  async function chooseMode(next: string) {
    setMode(next); setError('')
    if (next === 'default') { setPalette(DEFAULT); return }
    if (next !== 'logo') return
    if (!logo) { setError('Upload a logo in cause setup to use its colors.'); setMode('default'); return }
    setExtracting(true)
    try {
      const colors = await extractBrandColorsFromImage(toProxiedMaterialUrl(logo))
      if (!colors) throw new Error('No usable logo colors found. Choose Manual instead.')
      setLogoColors(Object.values(colors)); setPalette({ ...DEFAULT, accent: colors.accent === '#F59E0B' ? colors.primary : colors.accent })
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not read logo colors.'); setMode('default'); setPalette(DEFAULT) }
    finally { setExtracting(false) }
  }
  async function loadEditor() {
    setEditorError('')
    try {
      const response = await fetch(`/api/crm/causes/${causeId}/flyer?design=${design}&audience=${audience}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not load the editable text.')
      setEditor({ key: target, slots: body.slots, assets: body.assets || [] })
    } catch (error) { setEditorError(error instanceof Error ? error.message : 'Could not load the editable text.') }
  }
  // Without `overrides` the server applies the cause's saved edits for this
  // design and audience; with them, it renders and saves those instead.
  async function generate(overrides?: FlyerOverrides) {
    if (!selectedStatus?.ready) return
    setBusy(true); setError('')
    const sameDesign = editor?.key === target
    if (!sameDesign) { setEditor(null); void loadEditor() }
    try {
      const response = await fetch(`/api/crm/causes/${causeId}/flyer`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audience, design, mode, palette, overrides: overrides ?? (sameDesign ? edits : undefined) }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not generate flyer.')
      setResult({ ...body, settings }); setEdits(body.overrides || {})
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not generate flyer.') }
    finally { setBusy(false) }
  }
  function resetAllEdits() {
    if (!window.confirm('Reset every text and image edit on this flyer to the generated defaults?')) return
    setEdits({}); void generate({})
  }
  function download() {
    if (!result) return
    const bytes = Uint8Array.from(atob(result.pdf), char => char.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const link = document.createElement('a'); link.href = url; link.download = `localvip-${causeId}-${audience}-${design}.pdf`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const locked = busy || extracting
  return <div className="space-y-6">
    <Link href="/community/materials" className="text-sm text-brand-700">← Campaign materials</Link>
    <div><h1 className="text-2xl font-bold text-surface-900">Flyer generator</h1><p className="mt-2 text-surface-600">Create one flyer from the approved designs. Preview your colors, then download a print-ready PDF.</p></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
      <div className="space-y-5 rounded-2xl border border-surface-200 bg-white p-5">
        <div className="space-y-3">
          <label className="block space-y-2"><span className="font-medium">Search causes</span><input type="search" value={query} disabled={locked} onChange={event => setQuery(event.target.value)} placeholder="Search by cause name" className="h-11 w-full rounded-lg border border-surface-300 px-3" /></label>
          {causeId && <p className="text-sm"><strong>Selected:</strong> {causes.find(cause => getCauseQaAccountId(cause) === causeId)?.name || causeId}</p>}
          <div className="max-h-72 space-y-2 overflow-y-auto" aria-label="Cause search results">{visibleCauses.map(cause => {
            const id = getCauseQaAccountId(cause)!
            const status = readiness[id]
            return <button key={id} type="button" disabled={locked || !status || !!status.error} onClick={() => status.ready ? setSelected(id) : router.push(setupUrl(id, status.missing))}
              className={`w-full rounded-xl border p-3 text-left disabled:opacity-60 ${id === causeId ? 'border-brand-500 bg-brand-50' : 'border-surface-200'}`}>
              <span className="block text-sm font-medium">{cause.name}</span>
              <span className={`mt-1 block text-xs ${status?.ready ? 'text-green-700' : 'text-surface-600'}`}>{!status ? 'Checking readiness…' : status.error || (status.ready ? 'Ready — select to create a flyer' : `Complete setup: ${status.missing.join(', ')} →`)}</span>
            </button>
          })}</div>
          {!loading && !matches.length && <p role="status" className="text-sm text-surface-600">No causes match your search.</p>}
          {matches.length > 10 && <p className="text-xs text-surface-500">Showing 10 of {matches.length}. Search to narrow the list.</p>}
          {causeId && selectedStatus && !selectedStatus.ready && !selectedStatus.error && <Link className="block text-sm text-brand-700 underline" href={setupUrl(causeId, selectedStatus.missing)}>Complete {selectedStatus.missing.join(', ')} before generating →</Link>}
        </div>
        <label className="block space-y-2"><span className="font-medium">Audience</span><select value={audience} disabled={locked} onChange={event => setAudience(event.target.value)} className="h-11 w-full rounded-lg border border-surface-300 px-3">{['business', 'families', 'schools', 'boosters'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
        <label className="block space-y-2"><span className="font-medium">Design</span><select value={design} disabled={locked} onChange={event => setDesign(event.target.value)} className="h-11 w-full rounded-lg border border-surface-300 px-3"><option value="community">Community Win</option><option value="growth">Growth</option><option value="comparison">Comparison</option></select></label>
        <fieldset disabled={locked} className="space-y-2"><legend className="mb-2 font-medium">Colors</legend>{modes.map(item => <label key={item.value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === item.value ? 'border-brand-500 bg-brand-50' : 'border-surface-200'}`}><input type="radio" name="color-mode" value={item.value} checked={mode === item.value} onChange={() => void chooseMode(item.value)} className="mt-1" /><span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-surface-600">{item.hint}</span></span></label>)}</fieldset>
        {extracting && <p role="status">Reading logo colors…</p>}
        {mode === 'manual' ? (Object.keys(DEFAULT) as Array<keyof typeof DEFAULT>).map(key => <div key={key} className="space-y-2"><p className="text-sm font-medium capitalize">{key}</p><BrandColorPicker label={key} value={palette[key]} swatches={[...Object.values(DEFAULT), ...logoColors]} disabled={locked} onChange={value => setPalette(current => ({ ...current, [key]: value }))} /></div>) : <div className="flex gap-2" aria-label="Selected palette">{Object.entries(palette).map(([key, value]) => <span key={key} title={`${key}: ${value}`} className="h-8 w-8 rounded-full border border-surface-300" style={{ backgroundColor: value }} />)}</div>}
        {(error || causesError) && <p role="alert" className="text-sm text-error-700">{error || String(causesError)}</p>}
        {!loading && !causeId && <p className="text-sm text-surface-600">Select a cause to begin. <Link href="/community/setup" className="text-brand-700 underline">Open cause setup</Link></p>}
        <Button onClick={() => void generate()} disabled={locked || !selectedStatus?.ready || !Object.values(palette).every(isHexColor)} className="h-11 w-full">{busy ? 'Generating flyer…' : result ? 'Regenerate flyer' : 'Generate flyer'}</Button>
      </div>
      {result && !dirty && (editor?.key === target
        ? <FlyerEditPanel slots={editor.slots} assets={editor.assets} edits={edits} pending={pendingEdits} busy={locked}
            onChange={setEdits} onUpdate={() => void generate(edits)} onResetAll={resetAllEdits} />
        : <div className="rounded-2xl border border-surface-200 bg-white p-5 text-sm text-surface-600">
            {editorError ? <><p role="alert" className="text-error-700">{editorError}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void loadEditor()}>Retry</Button></> : <p role="status">Loading editable text and images…</p>}
          </div>)}
      </div>
      <div className="min-w-0 space-y-4 self-start rounded-2xl border border-surface-200 bg-surface-50 p-5 lg:sticky lg:top-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Preview</h2><Button variant="outline" disabled={!result || dirty || pendingEdits || locked} onClick={download}>Download PDF</Button></div>
        {dirty && <p role="status" className="text-sm text-surface-600">Colors or options changed. Regenerate to update the preview and download.</p>}
        {!dirty && pendingEdits && <p role="status" className="text-sm text-surface-600">You have unapplied edits. Update the preview to include them in the download.</p>}
        {result?.saveError && <p role="alert" className="text-sm text-error-700">{result.saveError}</p>}
        {result ? <img src={`data:image/png;base64,${result.preview}`} alt="Generated cause flyer preview" className="mx-auto h-auto w-full max-w-[525px] shadow-lg" /> : <div className="flex min-h-96 items-center justify-center rounded-xl border border-dashed border-surface-300 p-8 text-center text-surface-500">Your flyer will appear here after generation.</div>}
      </div>
    </div>
  </div>
}
