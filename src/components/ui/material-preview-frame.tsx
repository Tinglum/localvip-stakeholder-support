'use client'

import NextImage from 'next/image'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'

interface MaterialPreviewFrameProps {
  src: string | null
  mimeType?: string | null
  title: string
  className?: string
  fit?: 'cover' | 'contain'
  showPdfBadge?: boolean
  pdfClassName?: string
  imageSizes?: string
  /**
   * When true the PDF iframe accepts pointer events (native scroll / zoom / page
   * nav). Defaults to false so grid thumbnails stay click-through to the card.
   */
  interactive?: boolean
}

function isPdfSource(src: string | null, mimeType?: string | null) {
  if (!src) return false
  return mimeType === 'application/pdf'
    || mimeType?.includes('pdf')
    || src.startsWith('data:application/pdf')
    || src.toLowerCase().includes('.pdf')
}

function isImageSource(src: string | null, mimeType?: string | null) {
  if (!src) return false
  return mimeType?.startsWith('image/') || src.startsWith('data:image/')
}

export function MaterialPreviewFrame({
  src,
  mimeType,
  title,
  className,
  fit = 'cover',
  showPdfBadge = false,
  pdfClassName,
  imageSizes = '100vw',
  interactive = false,
}: MaterialPreviewFrameProps) {
  const pdf = isPdfSource(src, mimeType)
  const image = isImageSource(src, mimeType)

  if (!src) {
    return (
      <div className={cn('flex items-center justify-center bg-surface-50 text-surface-300', className)}>
        <FileText className="h-10 w-10" />
      </div>
    )
  }

  if (pdf) {
    // Cross-origin PDFs (served from qa.localvip.com) won't render inline in an
    // <object> on the dashboard/webapp origin — the preview comes up blank. Route
    // remote PDFs through a same-origin proxy so the bytes are same-origin. Data
    // URLs are already same-origin and pass straight through.
    // Cross-origin PDFs (served from qa.localvip.com) won't render inline in an
    // <object>/<iframe> on the dashboard origin — the preview comes up blank.
    // Route remote PDFs through a same-origin proxy so the bytes are same-origin.
    // Data URLs are already same-origin and pass straight through. An <iframe>
    // is more reliable than <object> for inline PDF rendering across browsers.
    const proxied = toProxiedMaterialUrl(src)
    // Thumbnails hide the toolbar/scrollbar and fit-to-width; the interactive
    // (full preview) view keeps the native toolbar so the user can scroll/zoom.
    const hash = interactive ? '#view=FitH' : '#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH'
    const previewUrl = proxied.includes('#') ? proxied : `${proxied}${hash}`

    return (
      <div className={cn('relative overflow-hidden bg-surface-50', className)}>
        <iframe
          src={previewUrl}
          title={`${title} PDF preview`}
          className={cn('h-full w-full border-0', interactive ? '' : 'pointer-events-none', pdfClassName)}
        />
        <noscript>
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-surface-400">
            <FileText className="h-10 w-10" />
            <span className="text-xs font-medium">PDF Preview</span>
          </div>
        </noscript>
        {showPdfBadge && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-surface-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
            PDF
          </div>
        )}
      </div>
    )
  }

  if (image) {
    return (
      <div className={cn('relative overflow-hidden bg-surface-50', className)}>
        <NextImage
          src={src}
          alt={title}
          fill
          unoptimized
          sizes={imageSizes}
          className={fit === 'contain' ? 'object-contain' : 'object-cover'}
        />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center bg-surface-50 text-surface-300', className)}>
      <FileText className="h-10 w-10" />
    </div>
  )
}
