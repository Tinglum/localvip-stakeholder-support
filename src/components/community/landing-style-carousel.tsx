'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LandingConfig, LandingDesign } from '@/lib/cause-landing-config'

const STYLES: { id: LandingDesign; name: string; description: string }[] = [
  { id: 'stadium', name: 'Current school', description: 'Bold photo and high contrast type' },
  { id: 'editorial', name: 'Editorial', description: 'Clean story and generous spacing' },
  { id: 'flyer', name: 'Flyer', description: 'Colorful campaign poster' },
  { id: 'v4', name: 'Modern', description: 'Structured, contemporary layout' },
  { id: 'cc3', name: 'Heritage', description: 'Photo led navy and gold' },
  { id: 'classic', name: 'Community', description: 'Warm, welcoming split hero' },
]

// Each card is 240×144. The page is rendered at a desktop width and scaled
// down, so the thumbnail shows the real layout rather than a squeezed one.
const PAGE_WIDTH = 1280
const PAGE_HEIGHT = 768
const SCALE = 240 / PAGE_WIDTH

/**
 * Once the cause's page is published, each card shows that page — its own
 * name, colors and photos — in that style, via the webapp's `?design=` view.
 * Before that there is nothing of theirs to show, so the cards fall back to
 * screenshots of an example school and say so.
 */
function StyleThumbnail({ design, live, baseUrl, version }: { design: LandingDesign; live: boolean; baseUrl: string; version: string }) {
  const [loaded, setLoaded] = React.useState(false)
  if (!live) {
    return <img src={`/landing-styles/${design}.webp`} alt="" loading="lazy" decoding="async" width="480" height="288" className="h-full w-full object-cover" />
  }
  const src = `${baseUrl}?design=${encodeURIComponent(design)}${version ? `&v=${encodeURIComponent(version)}` : ''}`
  return (
    <div className="relative h-full w-full">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-surface-200" aria-hidden="true" />}
      <iframe
        src={src}
        title=""
        aria-hidden="true"
        tabIndex={-1}
        loading="lazy"
        // A thumbnail, not an app: no scripts beyond the page's own, no clicks.
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => setLoaded(true)}
        className="pointer-events-none origin-top-left border-0"
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${SCALE})` }}
      />
    </div>
  )
}

export function LandingStyleCarousel({ config, live, baseUrl, version = '', onSelect }: {
  config: LandingConfig
  live: boolean
  baseUrl: string
  /** Changes on each publish so the thumbnails reload the new version. */
  version?: string
  onSelect: (design: LandingDesign) => void
}) {
  const rail = React.useRef<HTMLDivElement>(null)
  const selected = config.design || 'stadium'
  const selectedName = STYLES.find((style) => style.id === selected)?.name || 'Current school'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-surface-950">Choose your page style</h3>
          <p className="mt-1 text-sm text-surface-600">
            {live
              ? 'These previews show your published page in each style. Your choice stays a draft until you publish.'
              : 'These previews use an example school. Publish your page to see each style with your own name, colors and photos.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" aria-label="Previous styles" onClick={() => rail.current?.scrollBy({ left: -290, behavior: 'smooth' })}><ChevronLeft className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" aria-label="Next styles" onClick={() => rail.current?.scrollBy({ left: 290, behavior: 'smooth' })}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div ref={rail} aria-label="Landing page styles" className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
        {STYLES.map((style) => {
          const active = selected === style.id
          return (
            <div key={style.id} className={`relative w-60 shrink-0 snap-start overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition ${active ? 'border-brand-600 ring-2 ring-brand-100' : 'border-surface-200 hover:border-brand-300'}`}>
              <div className="h-36 overflow-hidden bg-surface-100">
                <StyleThumbnail design={style.id} live={live} baseUrl={baseUrl} version={version} />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-surface-950">{style.name}</span>{active && <span className="text-xs font-semibold text-brand-700">Selected</span>}</div>
                <p className="mt-1 text-xs text-surface-600">{style.description}</p>
              </div>
              <button type="button" aria-label={`Choose ${style.name} style`} aria-pressed={active} onClick={() => onSelect(style.id)} className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" />
            </div>
          )
        })}
      </div>
      <p className="text-sm text-surface-600">Selected: <strong>{selectedName}</strong>. Save your choice, then publish to update all audience pages.</p>
      {live && <div className="space-y-1"><a href={`${baseUrl}?design=${encodeURIComponent(selected)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">Open full page preview <ExternalLink className="h-4 w-4" /></a><p className="text-xs text-surface-500">The full preview uses your currently published content. Your draft changes appear there after you publish.</p></div>}
    </div>
  )
}
