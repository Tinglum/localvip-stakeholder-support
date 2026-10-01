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

export function LandingStyleCarousel({ config, live, baseUrl, onSelect }: {
  config: LandingConfig
  live: boolean
  baseUrl: string
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
          <p className="mt-1 text-sm text-surface-600">Your logo, photos, colors, and wording carry across all six styles.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" aria-label="Previous styles" onClick={() => rail.current?.scrollBy({ left: -290, behavior: 'smooth' })}><ChevronLeft className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" aria-label="Next styles" onClick={() => rail.current?.scrollBy({ left: 290, behavior: 'smooth' })}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div ref={rail} aria-label="Landing page styles" className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
        {STYLES.map((style) => {
          const active = selected === style.id
          const light = style.id === 'editorial' || style.id === 'v4' || style.id === 'classic'
          const photoPosition = style.id === 'classic' || style.id === 'editorial' || style.id === 'v4'
            ? 'inset-y-3 right-3 w-[45%] rounded-lg'
            : style.id === 'flyer' ? 'inset-y-3 right-3 w-[42%] -rotate-3 rounded-sm' : 'inset-0'
          return (
            <button key={style.id} type="button" aria-pressed={active} onClick={() => onSelect(style.id)}
              className={`w-60 shrink-0 snap-start overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'border-brand-600 ring-2 ring-brand-100' : 'border-surface-200 hover:border-brand-300'}`}>
              <div className="relative h-36 overflow-hidden" style={{ backgroundColor: light ? style.id === 'v4' ? '#EEF2F8' : '#F7F7F2' : style.id === 'flyer' ? config.colors.navy : config.colors.navyDeep }}>
                {config.assets.crowd.src && <div className={`absolute bg-cover bg-center ${photoPosition}`} style={{ backgroundImage: `url(${config.assets.crowd.src})`, opacity: style.id === 'stadium' ? .5 : .9 }} />}
                {!light && <div className="absolute inset-0" style={{ background: style.id === 'flyer' ? `linear-gradient(90deg, ${config.colors.navyDeep} 0%, ${config.colors.navyDeep} 48%, transparent 85%)` : `linear-gradient(90deg, ${config.colors.navyDeep} 2%, transparent 100%)` }} />}
                {style.id === 'cc3' && <div className="absolute bottom-4 right-4 z-10 h-12 w-16 rounded-lg bg-white p-2 shadow-lg"><div className="h-1 w-10 rounded bg-surface-300" /><div className="mt-2 h-2 w-12 rounded bg-surface-100" /><div className="mt-1 h-2 w-12 rounded bg-surface-100" /></div>}
                {style.id === 'v4' && <div className="absolute inset-x-0 top-0 h-3" style={{ backgroundColor: config.colors.navyDeep }} />}
                {style.id === 'flyer' && <div className="absolute inset-x-0 bottom-0 h-2" style={{ backgroundColor: config.colors.gold }} />}
                <div className={`relative z-10 flex h-full flex-col justify-center p-4 ${light || style.id === 'flyer' ? 'max-w-[58%]' : 'max-w-[80%]'}`}>
                  {config.assets.mark.src && <img src={config.assets.mark.src} alt="" className="mb-2 h-6 w-12 rounded bg-white/90 object-contain p-0.5" />}
                  <span className={`text-[8px] font-bold uppercase tracking-[0.12em] ${light ? 'text-surface-600' : 'text-white/80'}`}>Your community</span>
                  <span className={`mt-1 text-sm font-extrabold leading-tight ${light ? 'text-surface-950' : 'text-white'} ${style.id === 'flyer' || style.id === 'stadium' ? 'uppercase' : ''}`}>Support {config.schoolName || 'your school'}</span>
                  <span className="mt-2 h-2.5 w-16 rounded-full" style={{ backgroundColor: config.colors.gold }} />
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-surface-950">{style.name}</span>{active && <span className="text-xs font-semibold text-brand-700">Selected</span>}</div>
                <p className="mt-1 text-xs text-surface-600">{style.description}</p>
              </div>
            </button>
          )
        })}
      </div>
      <p className="text-sm text-surface-600">Selected: <strong>{selectedName}</strong>. Save your choice, then publish to update all audience pages.</p>
      {live && <div className="space-y-1"><a href={`${baseUrl}?design=${encodeURIComponent(selected)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">Open full page preview <ExternalLink className="h-4 w-4" /></a><p className="text-xs text-surface-500">The full preview uses your currently published content. Your draft changes appear there after you publish.</p></div>}
    </div>
  )
}
