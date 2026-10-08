'use client'

import * as React from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { processLogo, type LogoAction } from '@/lib/logo-image-tools'

export function LogoImageTools({ file, onChange }: { file: File | null; onChange: (file: File) => void }) {
  const [busy, setBusy] = React.useState<LogoAction | null>(null)
  const [message, setMessage] = React.useState('')
  const [preview, setPreview] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function run(action: LogoAction) {
    if (!file || busy) return
    setBusy(action)
    setMessage('')
    try {
      const result = await processLogo(file, action)
      onChange(result)
      setMessage(action === 'upscale' ? 'Logo enlarged 2×. Review it, then save.' : 'Solid background removed. Review the edges, then save.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not edit this logo.')
    } finally { setBusy(null) }
  }

  if (!file) return null
  return <div className="space-y-2 rounded-lg border border-surface-200 bg-white p-3">
    <div className="flex h-24 items-center justify-center rounded bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
      {preview && <img src={preview} alt="Edited logo preview" className="max-h-20 max-w-full object-contain" />}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!!busy} onClick={() => void run('remove-background')} className="inline-flex items-center gap-1 rounded-lg border border-surface-300 px-2 py-1 text-xs font-medium disabled:opacity-50">{busy === 'remove-background' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}Remove solid background</button>
      <button type="button" disabled={!!busy} onClick={() => void run('upscale')} className="inline-flex items-center gap-1 rounded-lg border border-surface-300 px-2 py-1 text-xs font-medium disabled:opacity-50">{busy === 'upscale' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}Upscale 2×</button>
    </div>
    {message && <p role="status" className="text-xs text-surface-600">{message}</p>}
    <p className="text-xs text-surface-500">Works best with a plain background. Upscaling smooths edges but cannot recover missing detail.</p>
  </div>
}
