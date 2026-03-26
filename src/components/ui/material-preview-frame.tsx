'use client'

import NextImage from 'next/image'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MaterialPreviewFrameProps {
  src: string | null
  mimeType?: string | null
  title: string
  className?: string
  fit?: 'cover' | 'contain'
  showPdfBadge?: boolean
  pdfClassName?: string
  imageSizes?: string
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
    const previewUrl = src.includes('#')
      ? src
      : `${src}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`

    return (
      <div className={cn('relative overflow-hidden bg-surface-50', className)}>
        <object
          data={previewUrl}
          type="application/pdf"
          aria-label={`${title} PDF preview`}
          className={cn('h-full w-full pointer-events-none', pdfClassName)}
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-surface-400">
            <FileText className="h-10 w-10" />
            <span className="text-xs font-medium">PDF Preview</span>
          </div>
        </object>
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
