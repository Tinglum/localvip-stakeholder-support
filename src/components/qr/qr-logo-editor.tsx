'use client'
/* eslint-disable @next/next/no-img-element */

import * as React from 'react'
import { ImageIcon, Loader2, Scissors, Sparkles, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_QR_LOGO_EDIT_SETTINGS,
  generateProcessedQrLogoDataUrl,
  type QrLogoEditSettings,
} from '@/lib/qr/logo-processing'

const checkerboardBackground = {
  backgroundImage: `
    linear-gradient(45deg, rgba(148, 163, 184, 0.14) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.14) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.14) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.14) 75%)
  `,
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
  backgroundSize: '16px 16px',
}

export function QrLogoEditor({
  file,
  sourceUrl,
  editedUrl,
  settings,
  onSettingsChange,
  onEditedUrlChange,
  onReplace,
  onRemove,
}: {
  file: File
  sourceUrl: string
  editedUrl: string
  settings: QrLogoEditSettings
  onSettingsChange: (settings: QrLogoEditSettings) => void
  onEditedUrlChange: (url: string) => void
  onReplace: () => void
  onRemove: () => void
}) {
  const [processing, setProcessing] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    setProcessing(true)

    ;(async () => {
      try {
        const url = await generateProcessedQrLogoDataUrl({
          src: sourceUrl,
          settings,
          size: 640,
        })

        if (!cancelled) {
          onEditedUrlChange(url)
        }
      } catch (error) {
        console.error('Failed to process QR logo', error)
        if (!cancelled) {
          onEditedUrlChange(sourceUrl)
        }
      } finally {
        if (!cancelled) setProcessing(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [onEditedUrlChange, settings, sourceUrl])

  function updateSettings(partial: Partial<QrLogoEditSettings>) {
    onSettingsChange({ ...settings, ...partial })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-surface-200 bg-surface-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-700">
            <span className="flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Center Logo
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">No stretch</Badge>
            <Badge variant="outline">Crop controls</Badge>
            <Badge variant="outline">Background cleanup</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onReplace}>
            <ImageIcon className="h-3.5 w-3.5" />
            Replace image
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSettingsChange(DEFAULT_QR_LOGO_EDIT_SETTINGS)}
          >
            <Scissors className="h-3.5 w-3.5" />
            Reset edits
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-danger-500">
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-surface-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-surface-800">{file.name}</p>
                <p className="text-xs text-surface-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateSettings({ fitMode: 'contain', zoom: 1, offsetX: 0, offsetY: 0 })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.fitMode === 'contain'
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                  }`}
                >
                  Keep full image
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ fitMode: 'crop', zoom: Math.max(settings.zoom, 1) })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.fitMode === 'crop'
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                  }`}
                >
                  Crop tighter
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-surface-500">Original</p>
                <div
                  className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-surface-200 bg-surface-50 p-4"
                  style={checkerboardBackground}
                >
                  <img
                    src={sourceUrl}
                    alt="Original center logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-surface-500">Final center fit</p>
                  {processing && <Loader2 className="h-4 w-4 animate-spin text-surface-400" />}
                </div>
                <div
                  className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-brand-200 bg-white p-4 shadow-sm"
                  style={checkerboardBackground}
                >
                  <div className="absolute inset-[11%] rounded-[28px] border border-dashed border-brand-300/80" />
                  <img
                    src={editedUrl || sourceUrl}
                    alt="Edited center logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="text-xs text-surface-500">
                  The QR code now keeps this artwork inside the center safe area without forcing it into a stretched square.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-surface-200 bg-white p-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-surface-700">Zoom / Crop</label>
              <span className="text-xs text-surface-400">{Math.round(settings.zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.01}
              value={settings.zoom}
              onChange={(event) => updateSettings({ zoom: Number(event.target.value) })}
              className="h-1 w-full accent-brand-500"
            />
            <p className="mt-1 text-xs text-surface-400">
              Increase this to crop in tighter on the center artwork.
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-surface-700">Horizontal framing</label>
              <span className="text-xs text-surface-400">{Math.round(settings.offsetX * 100)}%</span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={settings.offsetX}
              onChange={(event) => updateSettings({ offsetX: Number(event.target.value) })}
              className="h-1 w-full accent-brand-500"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-surface-700">Vertical framing</label>
              <span className="text-xs text-surface-400">{Math.round(settings.offsetY * 100)}%</span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={settings.offsetY}
              onChange={(event) => updateSettings({ offsetY: Number(event.target.value) })}
              className="h-1 w-full accent-brand-500"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-3">
            <label className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-surface-700">Remove light background</p>
                <p className="text-xs text-surface-400">Best for white or pale logo backgrounds.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.removeBackground}
                onChange={(event) => updateSettings({ removeBackground: event.target.checked })}
                className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
              />
            </label>

            {settings.removeBackground && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium text-surface-700">Cleanup strength</label>
                  <span className="text-xs text-surface-400">{settings.backgroundTolerance}</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={72}
                  step={1}
                  value={settings.backgroundTolerance}
                  onChange={(event) => updateSettings({ backgroundTolerance: Number(event.target.value) })}
                  className="h-1 w-full accent-brand-500"
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-3 text-xs text-brand-700">
            <p className="flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              Center artwork stays proportional
            </p>
            <p className="mt-1">
              Even if the uploaded image is wide or tall, the QR generator now preserves its real shape and only crops when you choose to zoom in.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
