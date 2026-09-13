'use client'

import * as React from 'react'
import { AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MATERIAL_AUDIENCES, MATERIAL_AVAILABILITY, MATERIAL_DELIVERIES, MATERIAL_PURPOSES,
  type MaterialAudience, type MaterialClassification, type MaterialDelivery,
} from '@/lib/materials/material-classification'
import { materialReachApi, type ReachEntity, type ReachPage, type ReachState } from '@/lib/materials/material-reach-api'

function Choice({ active, title, help, onClick }: { active: boolean; title: string; help?: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-xl border p-3 text-left transition ${active ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-surface-200 bg-white hover:border-brand-300'}`}>
    <span className="flex items-center gap-2 text-sm font-semibold text-surface-900">{active && <Check className="h-4 w-4 text-brand-600" />}{title}</span>
    {help && <span className="mt-1 block text-xs leading-5 text-surface-500">{help}</span>}
  </button>
}

const stateStyle: Record<ReachState, string> = {
  eligible: 'bg-success-50 text-success-700', blocked: 'bg-warning-50 text-warning-700',
  ineligible: 'bg-red-50 text-red-700', generated: 'bg-blue-50 text-blue-700',
}

export function MaterialReachReview({ materialId, targeting, onReviewed }: { materialId?: string; targeting: MaterialClassification; onReviewed?: (reviewed: boolean) => void }) {
  const [data, setData] = React.useState<ReachPage | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [filter, setFilter] = React.useState('ready')
  const [search, setSearch] = React.useState('')
  const [checkQuery, setCheckQuery] = React.useState('')
  const [checkResult, setCheckResult] = React.useState<ReachEntity | null>(null)
  const [checking, setChecking] = React.useState(false)
  const [preview, setPreview] = React.useState<{ entity: ReachEntity; previewUrl?: string } | null>(null)
  const [generationMode, setGenerationMode] = React.useState<'all' | 'missing' | 'outdated'>('missing')
  const [confirmation, setConfirmation] = React.useState('')
  const [activating, setActivating] = React.useState(false)
  const [activationMessage, setActivationMessage] = React.useState<string | null>(null)
  const runCount = !data ? 0 : generationMode === 'missing'
    ? data.counts.wouldGenerate
    : generationMode === 'outdated'
      ? data.counts.outdated
      : data.counts.eligible

  React.useEffect(() => {
    let active = true
    setLoading(true); setError(null); onReviewed?.(false)
    const timer = window.setTimeout(() => materialReachApi.preview({ materialId, targeting, page, pageSize: 20, filter, search })
      .then((result) => { if (active) { setData(result); onReviewed?.(true) } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Reach could not be calculated.') })
      .finally(() => { if (active) setLoading(false) }), 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [filter, materialId, onReviewed, page, search, targeting])

  async function checkAccess() {
    if (!checkQuery.trim()) return
    setChecking(true); setError(null)
    try { setCheckResult((await materialReachApi.check({ materialId, targeting, query: checkQuery.trim() })).entity) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Access could not be checked.') }
    finally { setChecking(false) }
  }

  async function previewEntity(entity: ReachEntity) {
    try { setPreview(await materialReachApi.previewEntity({ materialId, targeting, entityId: entity.id })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Preview could not be created.') }
  }

  async function activate() {
    if (!materialId || !data) return
    setActivating(true); setError(null); setActivationMessage(null)
    try {
      const result = await materialReachApi.activate({ materialId, targeting, mode: generationMode, confirmationCount: Number(confirmation) || undefined })
      setActivationMessage(result.message || `${result.ready} accounts are ready for generation.`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Generation could not be started.') }
    finally { setActivating(false) }
  }

  return <div className="space-y-5 rounded-2xl border border-brand-200 bg-brand-50/30 p-5">
    <div><h3 className="font-semibold text-surface-900">Review who will receive this</h3><p className="mt-1 text-sm text-surface-600">Confirm the audience before automatic files are created.</p></div>
    {data && <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {([['Will receive', data.counts.eligible], ['Needs information', data.counts.blocked], ['Will not receive', data.counts.ineligible], ['Already made', data.counts.generated], ['Needs an update', data.counts.outdated], ['Would create now', data.counts.wouldGenerate]] as const).map(([label, count]) =>
        <div key={label} className="rounded-lg border border-surface-200 bg-white p-3"><p className="text-xl font-semibold text-surface-900">{count}</p><p className="text-xs text-surface-500">{label}</p></div>)}
    </div>}
    <div className="rounded-xl border border-surface-200 bg-white p-4">
      <label className="text-sm font-semibold text-surface-900">Check account access</label>
      <div className="mt-2 flex gap-2"><Input value={checkQuery} onChange={(e) => setCheckQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); checkAccess() } }} placeholder="Search name, email, referral code, or account ID" /><Button type="button" onClick={checkAccess} disabled={checking}>{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Check</Button></div>
      {checkResult && <ReachResult entity={checkResult} onPreview={() => previewEntity(checkResult)} />}
      {checkQuery && !checking && checkResult === null && <p className="mt-3 text-sm text-surface-500">No matching account selected yet.</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search matching accounts" className="min-w-64 flex-1" />
      <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1) }} className="h-10 rounded-lg border border-surface-300 bg-white px-3 text-sm"><option value="ready">Eligible and blocked</option><option value="eligible">Eligible</option><option value="blocked">Needs information</option><option value="generated">Already made</option><option value="outdated">Needs an update</option><option value="ineligible">Not eligible</option><option value="all">All accounts</option></select>
    </div>
    {loading ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-surface-500"><Loader2 className="h-4 w-4 animate-spin" /> Calculating reach</div> : error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div> :
      <div className="overflow-hidden rounded-xl border border-surface-200 bg-white">
        {data?.entities.length ? data.entities.map((entity) => <ReachResult key={`${entity.type}-${entity.id}`} entity={entity} onPreview={() => previewEntity(entity)} compact />) : <p className="p-6 text-center text-sm text-surface-500">No accounts match this view.</p>}
      </div>}
    {data && data.total > data.pageSize && <div className="flex items-center justify-between text-sm text-surface-500"><span>Page {data.page} of {Math.ceil(data.total / data.pageSize)}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}><ChevronLeft className="h-4 w-4" /> Previous</Button><Button type="button" variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.pageSize)} onClick={() => setPage((v) => v + 1)}>Next <ChevronRight className="h-4 w-4" /></Button></div></div>}
    {preview && <div className="rounded-xl border border-brand-200 bg-white p-4"><div className="flex items-center justify-between"><div><p className="font-semibold text-surface-900">Preview for {preview.entity.name}</p><p className="text-xs text-surface-500">Check branding and personalized content before creating files.</p></div><button type="button" onClick={() => setPreview(null)} className="text-sm text-surface-500">Close</button></div>{preview.previewUrl ? <iframe title={`Preview for ${preview.entity.name}`} src={preview.previewUrl} className="mt-3 h-80 w-full rounded-lg border" /> : <p className="mt-3 rounded-lg bg-surface-50 p-4 text-sm text-surface-600">A visual preview will be available after the file and required customization fields are saved.</p>}</div>}
    {data && <div className="rounded-xl border border-surface-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-surface-900">Activate automatic creation</h4>
      <p className="mt-1 text-xs text-surface-500">Choose what to create. The job runs safely in the background.</p>
      <select value={generationMode} onChange={(e) => setGenerationMode(e.target.value as typeof generationMode)} className="mt-3 h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm"><option value="missing">Create only missing files</option><option value="outdated">Replace outdated files</option><option value="all">Create for every eligible account</option></select>
      {!materialId ? <p className="mt-3 rounded-lg bg-surface-50 p-3 text-sm text-surface-600">Save this material first. You can activate automatic creation from Edit Material after the material has an ID.</p> : <>
        {runCount >= 250 && <div className="mt-3"><label className="text-xs font-medium text-surface-700">Type {runCount} to confirm this large run</label><Input className="mt-1" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} inputMode="numeric" /></div>}
        <Button type="button" className="mt-3" onClick={activate} disabled={activating || (runCount >= 250 && Number(confirmation) !== runCount)}>{activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Activate and create</Button>
      </>}
      {activationMessage && <p className="mt-3 text-sm text-success-700">{activationMessage}</p>}
    </div>}
  </div>
}

function ReachResult({ entity, onPreview, compact = false }: { entity: ReachEntity; onPreview: () => void; compact?: boolean }) {
  return <div className={`${compact ? 'border-b border-surface-100 px-4 py-3 last:border-0' : 'mt-3 rounded-lg border border-surface-200 p-3'} flex items-start gap-3`}>
    <span className={`mt-0.5 rounded-full px-2 py-1 text-xs font-semibold ${stateStyle[entity.state]}`}>{entity.state === 'eligible' ? 'Can access' : entity.state === 'blocked' ? 'Needs information' : entity.state === 'generated' ? 'Already made' : 'No access'}</span>
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-surface-900">{entity.name}</p><p className="text-xs text-surface-500">{entity.type}{entity.context ? ` · ${entity.context}` : ''}</p>{(entity.reasons.length > 0 || entity.blockers.length > 0) && <details className="mt-1 text-xs text-surface-600"><summary className="cursor-pointer">Why?</summary>{entity.reasons.map((reason) => <p key={reason} className="mt-1 text-success-700">Matches: {reason}</p>)}{entity.blockers.map((blocker) => <p key={blocker} className="mt-1 text-warning-700">Needs: {blocker}</p>)}</details>}</div>
    {entity.state !== 'ineligible' && <Button type="button" variant="ghost" size="sm" onClick={onPreview}><Eye className="h-4 w-4" /> Preview</Button>}
  </div>
}

export function MaterialTargetingEditor({ value, onChange, materialId, showReach = true, onReachReviewed }: { value: MaterialClassification; onChange: (value: MaterialClassification) => void; materialId?: string; showReach?: boolean; onReachReviewed?: (reviewed: boolean) => void }) {
  const [customizationOpen, setCustomizationOpen] = React.useState(false)
  const toggleAudience = (audience: MaterialAudience) => {
    if (audience === 'everyone') return onChange({ ...value, audiences: ['everyone'] })
    const withoutEveryone = value.audiences.filter((item) => item !== 'everyone')
    const audiences = withoutEveryone.includes(audience) ? withoutEveryone.filter((item) => item !== audience) : [...withoutEveryone, audience]
    onChange({ ...value, audiences: audiences.length ? audiences : ['everyone'] })
  }
  return <div className="space-y-6">
    <section><h3 className="text-sm font-semibold text-surface-900">2. Who is this for?</h3><p className="mt-1 text-xs text-surface-500">Choose every group that should be able to find it.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{MATERIAL_AUDIENCES.map((item) => <Choice key={item.value} active={value.audiences.includes(item.value)} title={item.label} help={item.help} onClick={() => toggleAudience(item.value)} />)}</div></section>
    <section><h3 className="text-sm font-semibold text-surface-900">3. What does it help them do?</h3><select value={value.purpose} onChange={(e) => onChange({ ...value, purpose: e.target.value as MaterialClassification['purpose'] })} className="mt-3 h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm"><option value="">Choose a purpose</option>{MATERIAL_PURPOSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></section>
    <section><h3 className="text-sm font-semibold text-surface-900">4. Where should it appear?</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{MATERIAL_AVAILABILITY.map((item) => <Choice key={item.value} active={value.availability.mode === item.value} title={item.label} onClick={() => onChange({ ...value, availability: { mode: item.value, entityIds: [] } })} />)}</div>{!['everywhere', 'internal'].includes(value.availability.mode) && <Input className="mt-3" value={value.availability.entityIds.join(', ')} onChange={(e) => onChange({ ...value, availability: { ...value.availability, entityIds: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) } })} placeholder="Search and select names or paste IDs" />}</section>
    <section><h3 className="text-sm font-semibold text-surface-900">How should people receive it?</h3><div className="mt-3 grid gap-2 md:grid-cols-3">{MATERIAL_DELIVERIES.map((item) => <Choice key={item.value} active={value.delivery === item.value} title={item.label} help={item.help} onClick={() => onChange({ ...value, delivery: item.value as MaterialDelivery })} />)}</div></section>
    {value.delivery !== 'ready' && <section className="rounded-xl border border-surface-200 bg-surface-50 p-4"><button type="button" onClick={() => setCustomizationOpen((v) => !v)} className="flex w-full items-center justify-between text-left"><span><span className="block text-sm font-semibold text-surface-900">Customization settings</span><span className="mt-1 block text-xs text-surface-500">Choose editable content, branding, QR placement, and output format only when needed.</span></span><ChevronDown className={`h-4 w-4 transition ${customizationOpen ? 'rotate-180' : ''}`} /></button>{customizationOpen && <div className="mt-4 rounded-lg border border-surface-200 bg-white p-4 text-sm text-surface-600">Save the material first, then configure QR zones and personalized fields from its Customization tab.</div>}</section>}
    {showReach && value.delivery === 'automatic' && <MaterialReachReview materialId={materialId} targeting={value} onReviewed={onReachReviewed} />}
  </div>
}
