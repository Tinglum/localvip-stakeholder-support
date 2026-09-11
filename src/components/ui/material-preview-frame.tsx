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

// Extensions matter as much as the mime type: a template whose design was moved
// out of an inline data: URL onto disk arrives as "/uploads/.../template-77.svg"
// with no mimeType at all. Matching only data:image/ sent those to the generic
// file-icon placeholder, so the whole template library rendered as broken cards.
const IMAGE_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']

function isImageSource(src: string | null, mimeType?: string | null) {
  if (!src) return false
  if (mimeType?.startsWith('image/')) return true
  if (src.startsWith('data:image/')) return true
  const path = src.split('?')[0].split('#')[0].toLowerCase()
  return IMAGE_EXTENSIONS.some(ext => path.endsWith(ext))
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
    // Always hide the browser's PDF chrome (toolbar, thumbnail rail, print/
    // download buttons) so the preview is a clean page render, not the raw
    // viewer. Interactive keeps pointer events (scroll/zoom for multi-page) but
    // still hides the toolbar; thumbnails additionally pin to page 1.
    const hash = interactive
      ? '#toolbar=0&navpanes=0&view=FitH'
      : '#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH'
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
        {/* Proxied for the same reason PDFs are: the file is served by
            qa.localvip.com, so a bare /uploads/... path resolves against the
            dashboard origin and 404s. */}
        <NextImage
          src={toProxiedMaterialUrl(src)}
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
