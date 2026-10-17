'use client'

import * as React from 'react'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'
import { brightenFlyerPixels, fitFlyerHeader, fitFlyerLine, flyerHeaderMarkup, flyerLineText, FLYER_PHOTO_SIZE, type FlyerMeasure } from '@/lib/flyer-fit'
import type { FlyerImageSlotId, FlyerOverrides, FlyerSlots } from '@/lib/flyer-slots'

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
}

/**
 * The flyer exactly as it will print, edited in place. Text and image edits
 * change the SVG DOM directly, refitted with the renderer's own rules and
 * fonts, so nothing round-trips to the server until the PDF is generated.
 */
export function FlyerLivePreview({ svg, fonts, slots, edits, loadedImages, localImages, onHeaderError }: Props) {
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
    root.querySelectorAll<SVGImageElement>('image[data-slot]').forEach(image => { image.dataset.loadedHref = image.getAttribute('href') || '' })
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
      const images = root.querySelectorAll<SVGImageElement>(`image[data-slot="${slot.id}"]`)
      const show = (href: string) => { if (wanted.current[slot.id] === desired) images.forEach(image => image.setAttribute('href', href)) }
      if (desired === (loadedImages?.[slot.id] || slot.default)) { images.forEach(image => image.setAttribute('href', image.dataset.loadedHref || '')); continue }
      const source = desired.startsWith('blob:') ? desired : toProxiedMaterialUrl(desired)
      // Swap at once; a photo then takes its print treatment when that is ready.
      show(source)
      if (slot.id === 'photo') void treatedPhoto(source).then(show, () => undefined)
    }
  }, [mounted, edits, localImages, slots, loadedImages, fonts, onHeaderError])

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

const treatedPhotos = new Map<string, Promise<string>>()
/** The cover photo as the renderer prints it: cover-cropped and brightened when dark. */
function treatedPhoto(source: string) {
  if (!treatedPhotos.has(source)) {
    const done = (async () => {
      const image = new Image()
      image.src = source
      await image.decode()
      const { width, height } = FLYER_PHOTO_SIZE
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const context = canvas.getContext('2d')!
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
      context.drawImage(image, (width - image.naturalWidth * scale) / 2, (height - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale)
      const pixels = context.getImageData(0, 0, width, height)
      if (brightenFlyerPixels(pixels.data)) context.putImageData(pixels, 0, 0)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .95))
      if (!blob) throw new Error('Could not prepare the photo.')
      return URL.createObjectURL(blob)
    })()
    done.catch(() => treatedPhotos.delete(source))
    treatedPhotos.set(source, done)
  }
  return treatedPhotos.get(source)!
}
