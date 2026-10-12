'use client'

import * as React from 'react'
import { Pipette } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { isHexColor } from '@/lib/brand-colors'

export function BrandColorPicker({ label, value, swatches, disabled, onChange }: {
  label: string; value: string; swatches: string[]; disabled?: boolean; onChange: (value: string) => void
}) {
  const [note, setNote] = React.useState('')
  const valid = isHexColor(value)
  const change = (color: string) => { setNote(''); onChange(color.trim().toUpperCase()) }
  const sample = async () => {
    const EyeDropper = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!EyeDropper) { setNote('Image sampling is unavailable in this browser. Use the picker or swatches.'); return }
    try { change((await new EyeDropper().open()).sRGBHex) }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNote('Could not sample a color. Use the picker instead.')
    }
  }
  return <div className="space-y-2">
    <div className="flex gap-2">
      <input type="color" aria-label={`${label} picker`} value={valid ? value : '#000000'} disabled={disabled}
        onChange={event => change(event.target.value)} className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-surface-300 bg-white" />
      <Input aria-label={`${label} hex code`} aria-invalid={!valid} value={value} disabled={disabled}
        onChange={event => change(event.target.value)} className="h-11 min-w-0 font-mono uppercase" />
      <button type="button" aria-label={`Sample ${label} from image`} title="Sample a color from your logo or another image" disabled={disabled}
        onClick={() => void sample()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-surface-300 bg-white hover:bg-surface-50 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"><Pipette className="h-4 w-4" /></button>
    </div>
    <div className="flex flex-wrap gap-1">{[...new Set(swatches)].filter(isHexColor).map(swatch =>
      <button key={swatch} type="button" aria-label={`Use ${swatch} for ${label}`} aria-pressed={value.toUpperCase() === swatch.toUpperCase()}
        disabled={disabled} onClick={() => change(swatch)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-surface-200 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50">
        <span className="h-6 w-6 rounded-full border border-surface-300" style={{ backgroundColor: swatch }} />
      </button>)}</div>
    {!valid ? <span className="text-xs text-error-700">Enter a six-digit hex color, such as #163B70.</span> : null}
    {note ? <p role="status" className="text-xs text-surface-600">{note}</p> : null}
  </div>
}
