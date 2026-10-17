/**
 * Text fitting and photo treatment for cause flyers, shared by the server
 * renderer and the generator's live preview. Both sides measure with the same
 * font files, so a line fitted in the browser matches the printed PDF.
 * Client-safe: no server imports.
 */

export type FlyerFontKind = 'display' | 'sans'
/** Width of `text` in px when set in the flyer's display or sans face. */
export type FlyerMeasure = (text: string, kind: FlyerFontKind, weight: number, size: number) => number

const HEADER_WIDTH = 605
const LABEL_WIDTH = 560

function wrap(value: string, size: number, measure: FlyerMeasure) {
  const lines: string[] = []
  let line = ''
  for (const word of value.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next, 'display', 900, size) > HEADER_WIDTH) { lines.push(line); line = word }
    else line = next
  }
  if (line) lines.push(line)
  return lines
}

/** The cause name in at most two lines, shrinking from 39px; null when it cannot fit. */
export function fitFlyerHeader(name: string, measure: FlyerMeasure) {
  const heading = name.trim().toUpperCase()
  const fits = (lines: string[], size: number) => lines.length <= 2 && lines.every(line => measure(line, 'display', 900, size) <= HEADER_WIDTH)
  let size = 39
  let lines = wrap(heading, size, measure)
  while (!fits(lines, size) && size > 22) {
    size -= 2
    lines = wrap(heading, size, measure)
  }
  return fits(lines, size) ? { size, lines } : null
}

/** The header markup: the cause name and its identity label beside the logo. */
export function flyerHeaderMarkup(header: { size: number; lines: string[] }, label: string, measure: FlyerMeasure, textClass = 'white') {
  const labelSize = Math.max(9, Math.min(15, Math.floor(15 * LABEL_WIDTH / (measure(label, 'sans', 400, 15) || 1))))
  return header.lines.map((line, index) => `<text class="display ${textClass}" x="212" y="${75 + index * 37}" font-size="${header.size}">${escapeXml(line)}</text>`).join('')
    + `<text class="sans ${textClass}" x="214" y="${header.lines.length === 2 ? 145 : 119}" font-size="${labelSize}" letter-spacing="1.2">${escapeXml(label)}</text>`
}

/**
 * A line may run to `allowed` px (its block's widest default line plus 8%).
 * Longer lines shrink; past 60% of the design size they are condensed instead,
 * so a line can never spill out of the layout.
 */
export function fitFlyerLine(text: string, allowed: number, kind: FlyerFontKind, weight: number, size: number, measure: FlyerMeasure) {
  const width = measure(text, kind, weight, size)
  if (!allowed || width <= allowed) return { size, textLength: undefined }
  const scaled = Math.max(size * allowed / width, size * .6)
  return { size: Number(scaled.toFixed(1)), textLength: scaled === size * .6 ? Math.round(allowed) : undefined }
}

/** A line's text as measured: its runs joined by single spaces. */
export const flyerLineText = (runs: (string | undefined | null)[]) => runs.filter(Boolean).join(' ')

export const FLYER_PHOTO_SIZE = { width: 1875, height: 1725 }

/** Lifts dark cover photos so the hero stays legible. Mutates RGBA pixels in place. */
export function brightenFlyerPixels(data: Uint8ClampedArray) {
  let brightness = 0, samples = 0
  for (let i = 0; i < data.length; i += 64) {
    brightness += data[i] * .21 + data[i + 1] * .72 + data[i + 2] * .07
    samples++
  }
  const mean = brightness / samples
  const gamma = mean < 85 ? .56 : mean < 115 ? .72 : mean < 145 ? .88 : 1
  if (gamma === 1) return false
  const lut = Array.from({ length: 256 }, (_, value) => Math.round(255 * (value / 255) ** gamma))
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]]
    data[i + 1] = lut[data[i + 1]]
    data[i + 2] = lut[data[i + 2]]
  }
  return true
}

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' } as Record<string, string>)[char])
}
