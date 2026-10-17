'use client'

import * as React from 'react'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'
import { fitFlyerHeader, fitFlyerLine, flyerHeaderMarkup, flyerLineText, type FlyerMeasure } from '@/lib/flyer-fit'
import type { FlyerImageSlotId, FlyerOverrides, FlyerSlots, PreparedFlyerImage } from '@/lib/flyer-slots'

export type FlyerPreviewFonts = { display: string; sans: string; faces: { url: string; family: string; weight: number }[] }

type Props = {
  /** The composed flyer SVG from the server, tagged with data-slot ids. */
  svg: string
  fonts: FlyerPreviewFonts
  slots: FlyerSlots
  edits: FlyerOverrides
  /** The image overrides the server composed `svg` with. */
  loadedImages: FlyerOverrides['images']
  /** Local files shown while their upload is still in flight. */
  localImages: Partial<Record<FlyerImageSlotId, string>>
  onHeaderError: (message: string) => void
  /** The renderer's treatment of a replacement image (logo trim, photo brightening). */
  prepareImage: (slot: FlyerImageSlotId, url: string) => Promise<PreparedFlyerImage>
}

/**
 * The flyer exactly as it will print, edited in place. Text and image edits
 * change the SVG DOM directly, refitted with the renderer's own rules and
 * fonts, so nothing round-trips to the server until the PDF is generated.
 */
export function FlyerLivePreview({ svg, fonts, slots, edits, loadedImages, localImages, onHeaderError, prepareImage }: Props) {
  const host = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(0)
  const wanted = React.useRef<Partial<Record<FlyerImageSlotId, string>>>({})

  // Mount the SVG in a shadow root so its template classes (.display, .small…)
  // cannot leak into the dashboard, and pin its type to the print faces.
  React.useEffect(() => {
    const element = host.current
    if (!element) return
    const root = element.shadowRoot || element.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>:host{display:block}svg{display:block;width:100%;height:auto}`
      + `.display{font-family:"${fonts.display}"!important}.sans{font-family:"${fonts.sans}"!important}</style>${svg}`
    root.querySelectorAll<SVGImageElement>('image[data-slot]').forEach(image => {
      for (const name of ['href', 'x', 'y', 'width', 'height']) image.dataset[`loaded${name}`] = image.getAttribute(name) || ''
    })
    let cancelled = false
    void loadFonts(fonts).finally(() => { if (!cancelled) setMounted(count => count + 1) })
    return () => { cancelled = true }
  }, [svg, fonts])

  React.useEffect(() => {
    const root = host.current?.shadowRoot
    if (!root || !mounted) return
    const measure = canvasMeasure(fonts)

    for (const slot of slots.text) {
      if (slot.id.startsWith('header.')) continue
      const value = (edits.text?.[slot.id] ?? slot.default).trim()
      root.querySelectorAll(`[data-slot="${slot.id}"]`).forEach(run => { if (run.textContent !== value) run.textContent = value })
    }
    root.querySelectorAll<SVGTextElement>('text[data-fit]').forEach(text => {
      const runs = Array.from(text.querySelectorAll('tspan[data-slot]'), run => run.textContent)
      const { kind, weight, size, fit } = text.dataset
      const result = fitFlyerLine(flyerLineText(runs), Number(fit), kind === 'display' ? 'display' : 'sans', Number(weight), Number(size), measure)
      text.setAttribute('font-size', String(result.size))
      if (result.textLength) { text.setAttribute('textLength', String(result.textLength)); text.setAttribute('lengthAdjust', 'spacingAndGlyphs') }
      else { text.removeAttribute('textLength'); text.removeAttribute('lengthAdjust') }
    })

    const header = root.querySelector('[data-slot-header]')
    const fallback = (id: string) => slots.text.find(slot => slot.id === id)?.default || ''
    if (header) {
      const name = edits.text?.['header.name']?.trim() || fallback('header.name')
      const fitted = fitFlyerHeader(name, measure)
      onHeaderError(fitted ? '' : 'The cause name is too long for the flyer header. Shorten it to fit two lines.')
      if (fitted) {
        const textClass = header.querySelector('text')?.getAttribute('class')?.split(' ')[1] || 'white'
        const markup = flyerHeaderMarkup(fitted, (edits.text?.['header.label'] ?? fallback('header.label')).trim(), measure, textClass)
        if (header.innerHTML !== markup) header.innerHTML = markup
      }
    }

    for (const slot of slots.images) {
      const desired = localImages[slot.id] || edits.images?.[slot.id] || slot.default
      wanted.current[slot.id] = desired
      const images = Array.from(root.querySelectorAll<SVGImageElement>(`image[data-slot="${slot.id}"]`))
      if (desired === (loadedImages?.[slot.id] || slot.default)) {
        for (const image of images) for (const name of ['href', 'x', 'y', 'width', 'height']) {
          const value = image.dataset[`loaded${name}`]
          if (value) image.setAttribute(name, value)
        }
        continue
      }
      // Swap at once, then take the renderer's treatment (logo trim and its
      // box in the benefit circle, photo brightening) so the view matches print.
      images.forEach(image => image.setAttribute('href', desired.startsWith('blob:') ? desired : toProxiedMaterialUrl(desired)))
      if (desired.startsWith('blob:')) continue
      void prepared(slot.id, desired, prepareImage).then(result => {
        if (wanted.current[slot.id] !== desired) return
        for (const image of images) {
          image.setAttribute('href', result.href)
          if (result.flowLogo && image.getAttribute('clip-path')?.includes('flowLogoClip')) {
            const { width, height } = result.flowLogo
            image.setAttribute('x', String(-width / 2)); image.setAttribute('y', String(-height / 2))
            image.setAttribute('width', String(width)); image.setAttribute('height', String(height))
          }
        }
      }, () => undefined)
    }
  }, [mounted, edits, localImages, slots, loadedImages, fonts, onHeaderError, prepareImage])

  return <div ref={host} role="img" aria-label="Live flyer preview" className="mx-auto w-full max-w-[560px] bg-white shadow-lg" />
}

function canvasMeasure(fonts: FlyerPreviewFonts): FlyerMeasure {
  const context = document.createElement('canvas').getContext('2d')!
  return (text, kind, weight, size) => {
    context.font = `${weight} ${size}px "${kind === 'display' ? fonts.display : fonts.sans}"`
    return context.measureText(text).width
  }
}

const loadedFontSets = new Map<string, Promise<unknown>>()
/** Registers the print faces once per page and waits until they can be measured. */
function loadFonts(fonts: FlyerPreviewFonts) {
  const key = JSON.stringify(fonts.faces)
  if (!loadedFontSets.has(key)) {
    const style = document.createElement('style')
    style.textContent = fonts.faces.map(face => `@font-face{font-family:"${face.family}";font-weight:${face.weight};src:url(${face.url}) format("truetype");font-display:block}`).join('')
    document.head.appendChild(style)
    loadedFontSets.set(key, Promise.all(fonts.faces.map(face => document.fonts.load(`${face.weight} 16px "${face.family}"`))))
  }
  return loadedFontSets.get(key)!
}

const preparedImages = new Map<string, Promise<PreparedFlyerImage>>()
function prepared(slot: FlyerImageSlotId, url: string, prepare: Props['prepareImage']) {
  const key = `${slot}:${url}`
  if (!preparedImages.has(key)) {
    const done = prepare(slot, url)
    done.catch(() => preparedImages.delete(key))
    preparedImages.set(key, done)
  }
  return preparedImages.get(key)!
}
