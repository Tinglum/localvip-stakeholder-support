'use client'

import * as React from 'react'
import { ImageUp, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'
import { compactFlyerOverrides, type FlyerImageSlot, type FlyerOverrides, type FlyerSlots, type FlyerTextSlot } from '@/lib/flyer-slots'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_IMAGE_BYTES = 12 * 1024 * 1024 // the renderer's limit

type Props = {
  slots: FlyerSlots
  /** The cause's existing logo and photos, offered as one-click choices. */
  assets: string[]
  edits: FlyerOverrides
  busy: boolean
  /** Background save of the edits to the cause, shown in the footer. */
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onChange: (edits: FlyerOverrides) => void
  /** Shows a picked file in the preview while it uploads (undefined clears it). */
  onLocalImage: (slot: FlyerImageSlot['id'], objectUrl: string | undefined) => void
  onResetAll: () => void
}

/**
 * Line-by-line copy and image edits for a generated flyer. Lines map to the
 * approved layout's own lines, so the artwork's structure never changes.
 * Every change shows in the live preview at once; the PDF is made on demand.
 */
export function FlyerEditPanel({ slots, assets, edits, busy, saveState, onChange, onLocalImage, onResetAll }: Props) {
  const groups = React.useMemo(() => {
    const byGroup = new Map<string, FlyerTextSlot[]>()
    for (const slot of slots.text) byGroup.set(slot.group, [...(byGroup.get(slot.group) || []), slot])
    return [...byGroup.entries()]
  }, [slots.text])
  const editedCount = Object.keys(edits.text || {}).length + Object.keys(edits.images || {}).length

  function setText(id: string, value: string | undefined) {
    const text = { ...edits.text }
    if (value === undefined) delete text[id]
    else text[id] = value
    onChange(compactFlyerOverrides({ ...edits, text }))
  }
  function setImage(id: FlyerImageSlot['id'], value: string | undefined) {
    onChange(compactFlyerOverrides({ ...edits, images: { ...edits.images, [id]: value } }))
  }

  return <section aria-labelledby="flyer-edit-title" className="rounded-2xl border border-surface-200 bg-white">
    <header className="flex items-start justify-between gap-3 border-b border-surface-100 p-5">
      <div>
        <h2 id="flyer-edit-title" className="font-semibold text-surface-900">Edit text &amp; images</h2>
        <p className="mt-1 text-sm text-surface-600">Changes appear in the preview as you type. They are kept for this design and audience.</p>
      </div>
      {editedCount > 0 && <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">{editedCount} edited</span>}
    </header>

    <div className="grid gap-4 border-b border-surface-100 p-5 sm:grid-cols-2">
      {slots.images.map(slot => <ImageSlotEditor key={slot.id} slot={slot} value={edits.images?.[slot.id]} assets={assets} disabled={busy}
        onChange={value => setImage(slot.id, value)} onLocal={url => onLocalImage(slot.id, url)} />)}
    </div>

    <div className="divide-y divide-surface-100">
      {groups.map(([group, lines], index) => {
        const edited = lines.filter(line => edits.text?.[line.id] !== undefined).length
        return <details key={group} open={index < 3} className="group px-5 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1 text-sm font-medium text-surface-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <span>{group}</span>
            <span className="flex items-center gap-2 text-xs font-normal text-surface-500">
              {edited > 0 && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-label={`${edited} edited`} />}
              {lines.length > 1 ? `${lines.length} lines` : ''}
              <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
            </span>
          </summary>
          <div className="mt-2 space-y-2">
            {lines.map(line => <TextLineEditor key={line.id} slot={line} label={lines.length > 1 ? `${group}, line ${line.line}` : group}
              numbered={lines.length > 1} value={edits.text?.[line.id]} disabled={busy} onChange={value => setText(line.id, value)} />)}
          </div>
        </details>
      })}
    </div>

    <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-surface-200 bg-white/95 p-4 backdrop-blur">
      <Button variant="ghost" size="sm" disabled={busy || editedCount === 0} onClick={onResetAll}><RotateCcw className="h-3.5 w-3.5" />Reset all</Button>
      <p role="status" aria-live="polite" className={`text-xs ${saveState === 'error' ? 'text-error-700' : 'text-surface-500'}`}>
        {saveState === 'saving' ? 'Saving edits…' : saveState === 'saved' ? 'Edits saved' : saveState === 'error' ? 'Edits not saved — they will be saved with your PDF.' : ''}
      </p>
    </footer>
  </section>
}

function TextLineEditor({ slot, label, numbered, value, disabled, onChange }: {
  slot: FlyerTextSlot; label: string; numbered: boolean; value: string | undefined; disabled: boolean; onChange: (value: string | undefined) => void
}) {
  const current = value ?? slot.default
  const nearLimit = current.length > slot.maxLength * .8
  return <div className="flex items-center gap-2">
    {numbered && <span aria-hidden className="w-4 shrink-0 text-right text-xs tabular-nums text-surface-400">{slot.line}</span>}
    <div className="relative min-w-0 flex-1">
      <input aria-label={label} value={current} maxLength={slot.maxLength} disabled={disabled}
        onChange={event => onChange(event.target.value === slot.default ? undefined : event.target.value)}
        className={`h-10 w-full rounded-lg border px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60 ${value !== undefined ? 'border-brand-300 bg-brand-50/40' : 'border-surface-300'} ${nearLimit ? 'pr-14' : ''}`} />
      {nearLimit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-surface-500">{current.length}/{slot.maxLength}</span>}
    </div>
    <Button variant="ghost" size="icon-sm" disabled={disabled || value === undefined} onClick={() => onChange(undefined)}
      aria-label={`Reset ${label} to default`} title={value === undefined ? 'Default text' : `Reset to “${slot.default}”`}
      className={value === undefined ? 'invisible' : ''}><RotateCcw className="h-3.5 w-3.5" /></Button>
  </div>
}

function ImageSlotEditor({ slot, value, assets, disabled, onChange, onLocal }: {
  slot: FlyerImageSlot; value: string | undefined; assets: string[]; disabled: boolean
  onChange: (value: string | undefined) => void; onLocal: (objectUrl: string | undefined) => void
}) {
  const [local, setLocal] = React.useState('')
  const input = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState('')
  const current = local || value || slot.default
  const choices = assets.filter(asset => asset !== current).slice(0, 4)

  async function upload(file: File) {
    setError('')
    if (!IMAGE_TYPES.includes(file.type)) { setError('Choose a PNG, JPEG, or WebP image.'); return }
    if (file.size > MAX_IMAGE_BYTES) { setError('Choose an image under 12 MB.'); return }
    // Show the picked file right away; the upload replaces it with the stored copy.
    const objectUrl = URL.createObjectURL(file)
    setLocal(objectUrl); onLocal(objectUrl)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch('/api/qa/material-asset/upload?folder=flyer-edits', { method: 'POST', body: form })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.fileUrl) throw new Error(body?.error || 'The image could not be uploaded.')
      onChange(body.fileUrl as string)
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'The image could not be uploaded.') }
    finally {
      setUploading(false); setLocal(''); onLocal(undefined)
      if (input.current) input.current.value = ''
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    }
  }

  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium text-surface-800">{slot.label}</p>
      {value && <button type="button" disabled={disabled || uploading} onClick={() => onChange(undefined)}
        className="rounded text-xs text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50">Reset</button>}
    </div>
    <div className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border bg-surface-50 ${value ? 'border-brand-300' : 'border-surface-200'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current.startsWith('blob:') ? current : toProxiedMaterialUrl(current)} alt={`${slot.label} on the flyer`} className={slot.id === 'logo' ? 'max-h-[80%] max-w-[80%] object-contain' : 'h-full w-full object-cover'} />
      {uploading && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-label="Uploading" /></div>}
    </div>
    <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden
      onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
    <Button variant="outline" size="sm" className="w-full" disabled={disabled || uploading} onClick={() => input.current?.click()}>
      <ImageUp className="h-3.5 w-3.5" />Replace image
    </Button>
    {choices.length > 0 && <div className="flex items-center gap-1.5" role="group" aria-label={`Use another of your images as the ${slot.label.toLowerCase()}`}>
      <span className="mr-1 text-xs text-surface-500">Or use</span>
      {choices.map((asset, index) => <button key={asset} type="button" aria-label={`Use image ${index + 1}`} disabled={disabled || uploading} onClick={() => onChange(asset === slot.default ? undefined : asset)}
        className="h-8 w-8 overflow-hidden rounded-md border border-surface-200 transition hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={toProxiedMaterialUrl(asset)} alt="" className="h-full w-full object-cover" />
      </button>)}
    </div>}
    {error && <p role="alert" className="text-xs text-error-700">{error}</p>}
  </div>
}
