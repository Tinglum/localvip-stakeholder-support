import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { Resvg } from '@resvg/resvg-js'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { readableBrandText } from '@/lib/brand-colors'
import { fitFlyerHeader, fitFlyerLine, flyerHeaderMarkup, flyerLineText, type FlyerFontKind, type FlyerMeasure } from '@/lib/flyer-fit'
import { flyerFonts, givebackFonts } from '@/lib/server/flyer-fonts'
import { buildGivebackFlyerSvg, buildGivebackPdf, givebackSlots, type GivebackCause, type GivebackVersion } from '@/lib/server/giveback-flyer'

const givebackVersion = (design: unknown): GivebackVersion => design === 'giveback-v6' ? 'v6' : design === 'giveback-v5' ? 'v5' : design === 'giveback-v4' ? 'v4' : design === 'giveback-v3' ? 'v3' : 'v2'
import { compactFlyerOverrides, FLYER_IMAGE_SLOT_LABELS, FLYER_ORG_WORD_SLOT, FLYER_ORG_WORDS, type FlyerOverrides, type FlyerSlots, type FlyerTextSlot, type PreparedFlyerImage } from '@/lib/flyer-slots'

import { approvedFlyerTemplateId, isGivebackDesign, type FlyerAudience, type FlyerDesign, type GeneratorDesign, type GivebackDesign } from '@/lib/flyer-designs'

// Exact artwork from the dashboard's Olathe library; ids live in flyer-designs.
export { approvedFlyerTemplateId, FLYER_DESIGNS, type FlyerAudience, type FlyerDesign } from '@/lib/flyer-designs'
export type FlyerKind = 'cause' | 'school' | 'booster'

const templateDir = path.join(process.cwd(), 'src/lib/server/flyer-templates')
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]!)
function color(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value! : fallback
}

export function flyerKind(category?: string | null, name = ''): FlyerKind {
  const identity = `${category || ''} ${name}`
  if (/booster|pta|pto|parent.teacher|athletic club/i.test(identity)) return 'booster'
  if (/school|district|academy|education/i.test(identity)) return 'school'
  return 'cause'
}

function allowedImageUrl(value: string) {
  const url = new URL(value)
  const qa = new URL(QA_AUTH_CONFIG.baseUrl)
  if (url.protocol !== 'https:' || url.origin !== qa.origin || !url.pathname.startsWith('/uploads/')) {
    throw new Error('Flyer images must be uploaded to the LocalVIP asset host.')
  }
  return url.toString()
}

async function imageData(url: string) {
  const response = await fetch(allowedImageUrl(url), { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Could not load flyer image (${response.status}).`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 12 * 1024 * 1024) throw new Error('Flyer image exceeds 12 MB.')
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const image = await loadImage(bytes)
    const canvas = createCanvas(image.width, image.height)
    canvas.getContext('2d').drawImage(image, 0, 0)
    return `data:image/png;base64,${(await canvas.encode('png')).toString('base64')}`
  }
  const mime = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
    : bytes.toString('utf8', 0, 300).includes('<svg') ? 'image/svg+xml' : null
  if (!mime) throw new Error('Flyer image must be PNG, JPEG, SVG, or WebP.')
  return `data:${mime};base64,${bytes.toString('base64')}`
}

// Measure with the same font files resvg renders with (see flyer-fonts).
const measureContext = createCanvas(1, 1).getContext('2d')
let fontsRegistered = false
const measureFlyerText: FlyerMeasure = (text, kind, weight, size) => {
  const fonts = flyerFonts()
  if (!fontsRegistered) { for (const face of fonts.faces) GlobalFonts.registerFromPath(face.file, face.family); fontsRegistered = true }
  measureContext.font = `${weight} ${size}px "${kind === 'display' ? fonts.display : fonts.sans}"`
  return measureContext.measureText(text).width
}
/** resvg options that render with exactly the measured and previewed faces. */
const resvgFonts = () => ({ font: { fontFiles: flyerFonts().faces.map(face => face.file), loadSystemFonts: true, defaultFontFamily: flyerFonts().sans } })
const FLYER_PHOTO_SIZE = { width: 1875, height: 1725 }

/** Lifts dark cover photos so the hero stays legible. Mutates RGBA pixels in place. */
function brightenFlyerPixels(data: Uint8ClampedArray) {
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

/**
 * How a cover photo is prepared: 'square' (library designs) crops to the
 * library photo box, 'keep' keeps its shape for the GiveBack heroes, and
 * 'draft' treats it exactly as the original draft's prep.py did.
 */
export type FlyerPhotoMode = 'square' | 'keep' | 'draft'
export const flyerPhotoMode = (design: unknown): FlyerPhotoMode => design === 'giveback-v6' ? 'draft' : isGivebackDesign(design) ? 'keep' : 'square'

// The draft's hero: cropped to 8.5 x 3.9 in (55% down a tall photo), then
// blended toward ink, darkest at the top left, as prep.py did.
async function draftHeroPhoto(dataUrl: string) {
  const image = await loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'))
  const aspect = 8.5 / 3.9
  let sx = 0, sy = 0, sw = image.width, sh = image.height
  if (sw / sh > aspect) { sw = sh * aspect; sx = (image.width - sw) / 2 } else { sh = sw / aspect; sy = (image.height - sh) * .55 }
  const width = Math.max(1, Math.min(2550, Math.round(sw))), height = Math.max(1, Math.round(width / aspect))
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height)
  const ink = [0x0e, 0x10, 0x13]
  for (let y = 0; y < height; y++) {
    const fy = .86 + .2 * (height > 1 ? y / (height - 1) : 0)
    for (let x = 0; x < width; x++) {
      const vis = (.15 + .32 * (width > 1 ? x / (width - 1) : 0)) * fy
      const i = (y * width + x) * 4
      for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.max(0, Math.min(255, Math.round(ink[c] + (pixels.data[i + c] - ink[c]) * vis)))
    }
  }
  ctx.putImageData(pixels, 0, 0)
  return `data:image/jpeg;base64,${(await canvas.encode('jpeg', 92)).toString('base64')}`
}

const preparePhoto = (dataUrl: string, mode: FlyerPhotoMode) => mode === 'draft' ? draftHeroPhoto(dataUrl) : brightenPhoto(dataUrl, mode === 'keep')

async function brightenPhoto(dataUrl: string, keepAspect = false) {
  let { width, height } = FLYER_PHOTO_SIZE
  let image
  try {
    image = await loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'))
  } catch {
    // Some valid large PNGs are rejected by canvas's decoder. Resvg uses the
    // same renderer as the final template and normalizes them first.
    const normalized = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${dataUrl}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/></svg>`).render().asPng()
    image = await loadImage(normalized)
  }
  // GiveBack Days places the photo in wide heroes: keep the photo's own shape
  // (no wider than 300 dpi across the page) so the hero box makes the only crop.
  if (keepAspect && image.width && image.height) {
    width = Math.min(2550, image.width)
    height = Math.round(width * image.height / image.width)
  }
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const scale = Math.max(width / image.width, height / image.height)
  ctx.drawImage(image, (width - image.width * scale) / 2, (height - image.height * scale) / 2,
    image.width * scale, image.height * scale)
  const pixels = ctx.getImageData(0, 0, width, height)
  if (brightenFlyerPixels(pixels.data)) ctx.putImageData(pixels, 0, 0)
  return `data:image/png;base64,${(await canvas.encode('png')).toString('base64')}`
}

// Logos often arrive with generous transparent or white padding, which made
// them read small in the header and the benefit circle. Crop to the visible
// mark and note its shape, so layoutForLetter can size it to the circle.
type LogoFit = { aspect: number; round: boolean }
const logoFits = new Map<string, LogoFit>()
async function trimLogo(dataUrl: string) {
  let image
  try { image = await loadImage(Buffer.from(dataUrl.split(',')[1], 'base64')) } catch { return dataUrl }
  const scale = Math.min(1, 800 / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale))
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, width, height)
  const { data } = ctx.getImageData(0, 0, width, height)
  const empty = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return data[i + 3] < 24 || (data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244)
  }
  let left = width, right = -1, top = height, bottom = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (empty(x, y)) continue
    if (x < left) left = x
    if (x > right) right = x
    if (y < top) top = y
    if (y > bottom) bottom = y
  }
  if (right < left || bottom < top) return dataUrl
  const w = right - left + 1, h = bottom - top + 1
  // A mark whose corners are background (a seal, a crest, a centred badge)
  // can fill the circle; anything else must fit inside it unclipped.
  const corner = Math.max(2, Math.round(Math.min(w, h) * .12))
  let filled = 0, total = 0
  for (const [cx, cy] of [[left, top], [right - corner, top], [left, bottom - corner], [right - corner, bottom - corner]]) {
    for (let y = cy; y < cy + corner; y++) for (let x = cx; x < cx + corner; x++) { total++; if (!empty(x, y)) filled++ }
  }
  const out = createCanvas(w, h)
  out.getContext('2d').drawImage(canvas, left, top, w, h, 0, 0, w, h)
  const trimmed = `data:image/png;base64,${(await out.encode('png')).toString('base64')}`
  if (logoFits.size > 20) logoFits.clear()
  logoFits.set(trimmed, { aspect: w / h, round: filled / total < .04 })
  return trimmed
}

// A twelve-flyer set shares two uploads. Decode them once instead of repeating
// native image allocations for every design; retain only the latest pair.
let preparedAssets: { key: string; expires: number; value: Promise<[string, string]> } | undefined
function prepareAssets(logoUrl: string, coverUrl: string, mode: FlyerPhotoMode = 'square') {
  const key = JSON.stringify([logoUrl, coverUrl, mode])
  if (preparedAssets?.key === key && preparedAssets.expires > Date.now()) return preparedAssets.value
  const value = Promise.all([imageData(logoUrl).then(trimLogo), imageData(coverUrl).then(photo => preparePhoto(photo, mode))])
  preparedAssets = { key, expires: Date.now() + 10 * 60 * 1000, value }
  void value.catch(() => { if (preparedAssets?.value === value) preparedAssets = undefined })
  return value
}

// ---- Editable slots -------------------------------------------------------
// The nine approved layouts share one structure: hero copy, four steps, three
// benefit captions, a call to action, two action labels and a footer. Each
// printed line is classified by its position into a stable slot id, so an
// edit saved on one cause keeps meaning the same line after a regenerate.

type TextBlock = { key: string; group: string; rank: number }
const TEXT_ELEMENT = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
const TSPAN = /(<tspan\b[^>]*>[\s\S]*?<\/tspan>)/
const attr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1]
const unesc = (value: string) => value.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, entity: string) =>
  ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" } as Record<string, string>)[entity])

function textBlock(attrs: string, step: number): TextBlock | null {
  const x = Number(attr(attrs, 'x')), y = Number(attr(attrs, 'y'))
  const display = /\bdisplay\b/.test(attr(attrs, 'class') || '')
  if (attr(attrs, 'font-size') === '9') return null // "POWERED BY" belongs to the LocalVIP mark
  if (y === 1489) return { key: 'footer', group: 'Footer', rank: 40 }
  if (x === 48 && y === 6) return { key: 'actions', group: 'Action labels', rank: 31 }
  if (x === 228 && y >= 1300) return { key: 'cta', group: 'Call to action', rank: 30 }
  const benefit = [200, 525, 850].indexOf(x) + 1
  if (benefit && y >= 1150 && y <= 1230) {
    return display ? { key: `benefit${benefit}-title`, group: `Benefit ${benefit} title`, rank: 20 + benefit }
      : { key: `benefit${benefit}-body`, group: `Benefit ${benefit} caption`, rank: 20.5 + benefit }
  }
  if (y === 724) return { key: 'section', group: 'Section title', rank: 4 }
  if (step > 0 && y < 300) {
    return display ? { key: `step${step}-title`, group: `Step ${step} title`, rank: 10 + step }
      : { key: `step${step}-body`, group: `Step ${step} description`, rank: 10.5 + step }
  }
  if (step === 0 && y < 690) {
    if (display) return { key: 'headline', group: 'Headline', rank: 1 }
    return attr(attrs, 'font-weight') === '700' ? { key: 'subhead', group: 'Subheadline', rank: 2 }
      : { key: 'intro', group: 'Supporting copy', rank: 3 }
  }
  return { key: 'other', group: 'Other text', rank: 50 }
}

type TextLine = TextBlock & { id: string; line: number; text: string }
type TextElement = { attrs: string; parts: string[]; lines: (TextLine | null)[] }

/** Visits every editable <text> element in document order; `visit` may return a replacement. */
function walkFlyerText(svg: string, visit: (element: TextElement) => string | void) {
  const counts = new Map<string, number>()
  let step = 0
  return svg.replace(TEXT_ELEMENT, (whole, attrs: string, content: string) => {
    if (/\bstep-number\b/.test(attrs)) { step++; return whole }
    const block = textBlock(attrs, step)
    if (!block) return whole
    // A footer carries its gold highlight in a <tspan>; each run is its own line.
    const parts = content.split(TSPAN)
    const lines = parts.map(part => {
      const text = unesc(part.replace(/<[^>]+>/g, '')).trim()
      if (!text) return null
      const line = (counts.get(block.key) || 0) + 1
      counts.set(block.key, line)
      return { ...block, id: `${block.key}.${line}`, line, text }
    })
    return visit({ attrs, parts, lines }) ?? whole
  })
}

function fontFor(attrs: string) {
  const kind: FlyerFontKind = /\bdisplay\b/.test(attr(attrs, 'class') || '') ? 'display' : 'sans'
  const weight = kind === 'display' ? 900 : Number(attr(attrs, 'font-weight') || 400)
  return { kind, weight, size: Number(attr(attrs, 'font-size') || 16) }
}

/**
 * Applies text overrides and tags every editable line for the live preview:
 * each <text> carries its font, design size and allowed width (data-fit), and
 * each run is a <tspan data-slot="…">. The preview refits with the same rule.
 */
function applyFlyerTextOverrides(svg: string, overrides: Record<string, string>) {
  // Each block may grow to slightly wider than its widest default line.
  const blockWidth = new Map<string, number>()
  walkFlyerText(svg, ({ attrs, lines }) => {
    const { kind, weight, size } = fontFor(attrs)
    const key = lines.find(Boolean)?.key
    if (key) blockWidth.set(key, Math.max(blockWidth.get(key) || 0, measureFlyerText(flyerLineText(lines.map(line => line?.text)), kind, weight, size)))
  })
  return walkFlyerText(svg, ({ attrs, parts, lines }) => {
    const texts: (string | undefined)[] = []
    const next = parts.map((part, index) => {
      const line = lines[index]
      if (!line) return part
      const value = line.id in overrides ? overrides[line.id].trim() : line.text
      texts.push(value)
      // Keep the run's surrounding spacing and any <tspan> styling.
      return part.replace(/^(\s*)(<tspan\b[^>]*>)?\s*[\s\S]*?(<\/tspan>)?(\s*)$/, (_, before: string, open: string | undefined, _close, after: string) =>
        `${before}${(open || '<tspan>').replace('<tspan', `<tspan data-slot="${line.id}"`)}${esc(value)}</tspan>${after}`)
    })
    const { kind, weight, size } = fontFor(attrs)
    const allowed = (blockWidth.get(lines.find(Boolean)!.key) || 0) * 1.08
    const fit = fitFlyerLine(flyerLineText(texts), allowed, kind, weight, size, measureFlyerText)
    const fitted = attrs.replace(/\bfont-size="[^"]*"/, `font-size="${fit.size}"`)
      + ` data-kind="${kind}" data-weight="${weight}" data-size="${size}" data-fit="${allowed.toFixed(1)}"`
      + (fit.textLength ? ` textLength="${fit.textLength}" lengthAdjust="spacingAndGlyphs"` : '')
    return `<text${fitted}>${next.join('')}</text>`
  })
}

const lineLimit = (value: string) => Math.min(160, Math.max(16, Math.ceil(value.length * 1.5)))

/** Every editable text line and image on one design, with its generated default. */
export async function getFlyerSlots(input: {
  name: string; audience: FlyerAudience; design?: FlyerDesign; category?: string | null
  parentOrganization?: string; logoUrl: string; coverUrl: string
  /** The organization word in effect, so line defaults read as the flyer prints them. */
  orgWord?: string
}): Promise<FlyerSlots> {
  const kind = flyerKind(input.category, input.name)
  const template = await readFile(path.join(templateDir, `approved-${approvedFlyerTemplateId(input.audience, input.design)}.svg`), 'utf8')
  const kindLabel = kind === 'booster' ? 'BOOSTER CLUB' : kind === 'school' ? 'SCHOOL COMMUNITY' : 'COMMUNITY CAUSE'
  const parent = input.parentOrganization?.trim().toUpperCase()
  const label = parent && parent.length < 34 ? `${kindLabel} · ${parent}` : kindLabel
  const lines: TextLine[] = []
  walkFlyerText(localizeTemplateCopy(template, input.audience, kind, '#efb719', input.orgWord), ({ lines: found }) => {
    for (const line of found) if (line) lines.push(line)
  })
  lines.sort((a, b) => a.rank - b.rank) // stable: lines keep their order within a block
  const text: FlyerTextSlot[] = [
    { id: FLYER_ORG_WORD_SLOT, group: 'Call your organization a…', line: 1, default: defaultSubject(input.audience, kind), maxLength: 24, suggestions: FLYER_ORG_WORDS },
    { id: 'header.name', group: 'Cause name', line: 1, default: input.name.trim(), maxLength: 60 },
    { id: 'header.label', group: 'Cause label', line: 1, default: label, maxLength: 48 },
    ...lines.map(line => ({ id: line.id, group: line.group, line: line.line, default: line.text, maxLength: lineLimit(line.text) })),
  ]
  return {
    text,
    images: [
      { id: 'logo', label: FLYER_IMAGE_SLOT_LABELS.logo, default: input.logoUrl },
      { id: 'photo', label: FLYER_IMAGE_SLOT_LABELS.photo, default: input.coverUrl },
    ],
  }
}

/** True for images the renderer may load: uploads on the LocalVIP asset host. */
export function isFlyerImageUrl(value: unknown) {
  try { return typeof value === 'string' && !!allowedImageUrl(value) } catch { return false }
}

/**
 * Keeps only overrides that name a real slot, fit its limit and point at our
 * own asset host. Returns an error message for anything a client should fix.
 */
export function validateFlyerOverrides(value: unknown, slots: FlyerSlots): { overrides: FlyerOverrides } | { error: string } {
  if (value === undefined || value === null) return { overrides: {} }
  if (typeof value !== 'object' || Array.isArray(value)) return { error: 'Flyer edits are not in a valid format.' }
  const { text = {}, images = {} } = value as { text?: unknown; images?: unknown }
  if (!text || typeof text !== 'object' || !images || typeof images !== 'object') return { error: 'Flyer edits are not in a valid format.' }
  const result: Required<FlyerOverrides> = { text: {}, images: {} }
  for (const [id, raw] of Object.entries(text)) {
    const slot = slots.text.find(item => item.id === id)
    if (!slot || typeof raw !== 'string') continue // a slot from another design; ignore it
    const clean = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
    if (clean.length > slot.maxLength) return { error: `${slot.group} line ${slot.line} is too long (max ${slot.maxLength} characters).` }
    if (id === 'header.name' && !clean) continue
    if (clean !== slot.default) result.text[id] = clean
  }
  for (const [id, raw] of Object.entries(images)) {
    const slot = slots.images.find(item => item.id === id)
    if (!slot || !raw) continue
    // The asset upload may answer with a server-relative /uploads/ path.
    const url = typeof raw === 'string' && raw.startsWith('/uploads/') ? `${QA_AUTH_CONFIG.baseUrl}${raw}` : raw
    if (!isFlyerImageUrl(url)) return { error: `${slot.label} must be an image uploaded to LocalVIP.` }
    if (url !== slot.default) result.images[slot.id] = url as string
  }
  return { overrides: compactFlyerOverrides(result) }
}

/** The word the generated copy uses for the organization, before any edit. */
function defaultSubject(audience: FlyerAudience, kind: FlyerKind) {
  return audience === 'boosters' || kind === 'booster' ? 'club' : kind === 'school' ? 'school' : 'cause'
}

// The LocalVIP mark in the hero's top right. It crowds the cause's own header
// and is not needed on a cause's flyer, so it is left out (bug report 278).
const LOCALVIP_MARK = /(?:<!--[^>]*Local VIP logo[^>]*-->\s*)?<g\b[^>]*aria-label="Powered by Local VIP"[^>]*>[\s\S]*?<\/g>\s*/g

function localizeTemplateCopy(template: string, audience: FlyerAudience, kind: FlyerKind, accent: string, orgWord?: string) {
  // Letters, digits, spaces, dots and dashes only: the word goes into markup
  // (and is upper-cased there, so it cannot carry entities) and into
  // replacement strings, where `$` would be a pattern.
  const subject = orgWord?.replace(/[^A-Za-z0-9À-ɏ .’-]+/g, '').trim() || defaultSubject(audience, kind)
  // Retain the library's artwork and copy. Generic organization references keep
  // body text within the original line lengths; the header carries the full name.
  // "OLATHE WEST" is split over two lines in several titles ("SUPPORT OLATHE" /
  // "WEST PROGRAMS"), so each second line needs its own rule.
  return template
    .replace(LOCALVIP_MARK, '')
    .replace(/More Olathe West families discover/g, 'More local families discover')
    .replace(/OLATHE WEST GIVEBACK DAY/g, 'LOCAL GIVEBACK DAY')
    .replace(/Choose a day\. Olathe West/g, `Choose a day. Our ${subject}`)
    // Lines that open a sentence keep a capital (the generic rule below is for mid-sentence).
    .replace(/>Olathe West (families show up|receives benefits|shares it)/g, `>Our ${subject} $1`)
    .replace(/Olathe West/g, `our ${subject}`).replace(/OLATHE WEST/g, `OUR ${subject.toUpperCase()}`)
    .replace(/SUPPORT OLATHE/g, 'SUPPORT THIS').replace(/WEST TOGETHER\./g, `${subject.toUpperCase()} TOGETHER.`)
    .replace(/WEST PROGRAMS/g, `${subject.toUpperCase()}’S PROGRAMS`)
    .replace(/INVITE OLATHE/g, 'INVITE LOCAL').replace(/WEST FAMILIES/g, 'SUPPORTERS')
    .replace(/IN OLATHE\./g, 'LOCALLY.')
    .replace(/school/gi, value => value === value.toUpperCase() ? subject.toUpperCase() : subject)
    .replace(/(<circle\b[^>]*\br="(?:18|22)"[^>]*\bfill=")#(?:0b2349|efb719)(")/g, `$1${accent}$2`)
    .replace(/class="(sans|display) (?:white|navy)"([^>]*font-size="(?:19|23)")/g, 'class="$1 step-number"$2')
}

export type CauseFlyerInput = {
  name: string; locality: string; logoUrl: string; coverUrl: string; joinUrl: string; audience: FlyerAudience
  design?: GeneratorDesign; category?: string | null; mission?: string; parentOrganization?: string; colors?: { navy?: string; gold?: string }
  palette?: { background: string; highlight: string; accent: string }
  /** A cause's own edits to the generated copy and imagery. See getFlyerSlots. */
  overrides?: FlyerOverrides
  /** GiveBack Days only: the cause contact printed under "Brought to you by". */
  owner?: GivebackCause['owner']
  /** GiveBack Days only: print the booking QR. Its panel is left blank by default. */
  qr?: boolean
}

/** The GiveBack Days view of a cause. */
function givebackCause(input: Pick<CauseFlyerInput, 'name' | 'locality' | 'category' | 'parentOrganization' | 'owner'>): GivebackCause {
  return {
    name: input.name, city: input.locality.split(',')[0]?.trim() || '', parentOrganization: input.parentOrganization,
    schoolFocused: flyerKind(input.category, input.name) !== 'cause' || !!input.parentOrganization?.trim(), owner: input.owner,
  }
}

/** Every editable line and image on the GiveBack Days flyer for this cause. */
export function getGivebackFlyerSlots(input: Pick<CauseFlyerInput, 'name' | 'locality' | 'category' | 'parentOrganization' | 'owner' | 'logoUrl' | 'coverUrl'> & { design?: GivebackDesign }) {
  return givebackSlots(givebackCause(input), input.logoUrl, input.coverUrl, givebackVersion(input.design))
}

async function buildGivebackFlyer(input: CauseFlyerInput) {
  const [logo, photo] = await prepareAssets(input.overrides?.images?.logo || input.logoUrl, input.overrides?.images?.photo || input.coverUrl, flyerPhotoMode(input.design))
  const text = input.overrides?.text || {}
  // The QR books the call the copy invites; it follows an edited booking address.
  const booking = (text['booking.1'] ?? 'calendly.com/30vip').trim()
  const qr = input.qr && booking ? await QRCode.toDataURL(/^https?:\/\//i.test(booking) ? booking : `https://${booking}`, { margin: 1, width: 360, errorCorrectionLevel: 'M' }) : undefined
  return buildGivebackFlyerSvg({ cause: givebackCause(input), logo, photo, qr, text, version: givebackVersion(input.design) })
}

export async function buildCauseCampaignFlyerSvg(input: CauseFlyerInput) {
  if (isGivebackDesign(input.design)) return buildGivebackFlyer(input)
  const text = input.overrides?.text || {}
  const name = (text['header.name']?.trim() || input.name).trim()
  if (!name) throw new Error('A cause name is required for flyer generation.')
  const kind = flyerKind(input.category, input.name)
  const [[logo, photo], template] = await Promise.all([
    prepareAssets(input.overrides?.images?.logo || input.logoUrl, input.overrides?.images?.photo || input.coverUrl),
    readFile(path.join(templateDir, `approved-${approvedFlyerTemplateId(input.audience, input.design)}.svg`), 'utf8'),
  ])
  const qr = await QRCode.toDataURL(input.joinUrl, { margin: 3, width: 164, errorCorrectionLevel: 'M' })
  // Preserve the library's navy/white/gold hierarchy. Cause colors belong
  // only in small secondary details, never the hero or main headline.
  const accent = color(input.palette?.accent, color(input.colors?.gold, color(input.colors?.navy, '#efb719')))
  const headerFit = fitFlyerHeader(name, measureFlyerText)
  if (!headerFit) throw new Error('The cause name is too long for the flyer header.')
  const kindLabel = kind === 'booster' ? 'BOOSTER CLUB' : kind === 'school' ? 'SCHOOL COMMUNITY' : 'COMMUNITY CAUSE'
  const parent = input.parentOrganization?.trim().toUpperCase()
  const identityLabel = text['header.label'] ?? (parent && parent.length < 34 ? `${kindLabel} · ${parent}` : kindLabel)
  // The preview rebuilds this group with the same markup as the name is edited.
  const header = `<g data-slot-header="">${flyerHeaderMarkup(headerFit, identityLabel, measureFlyerText)}</g>`
  const replacements: Record<string, string> = { HEADER: header, PHOTO: photo, LOGO: logo, QR: qr }
  const svg = applyFlyerTextOverrides(localizeTemplateCopy(template, input.audience, kind, accent, text[FLYER_ORG_WORD_SLOT]), text)
    .replace(/href="{{(LOGO|PHOTO)}}"/g, (tag, key: string) => `data-slot="${key.toLowerCase()}" ${tag}`)
    .replace(/{{([A-Z_]+)}}/g, (_, key: string) => replacements[key] ?? '')
    .replace('</defs>', `<style>.step-number{fill:${readableBrandText(accent)}}</style></defs>`)
  if (!input.palette) return svg
  const background = color(input.palette.background, '#0b2349')
  const highlight = color(input.palette.highlight, '#efb719')
  return svg.replace(/#(?:0b2349|041735)/gi, background).replace(/#efb719/gi, highlight)
    .replace(/(<circle\b[^>]*\br="(?:18|22)"[^>]*\bfill=")#[0-9a-f]{6}(")/gi, `$1${accent}$2`)
    .replace(/<text\b[^>]*>/g, tag => {
      const y = Number(/\by="([\d.]+)"/.exec(tag)?.[1])
      return y < 690 ? tag.replace(/\bwhite\b/, 'manual-hero-text') : tag
    })
    .replace('</defs>', `<style>.manual-hero-text{fill:${readableBrandText(background)}}.navy{fill:${readableBrandText(background) === '#FFFFFF' ? background : '#0b2349'}}</style></defs>`)
}

// ---- Letter layout ---------------------------------------------------------
// The library artwork is 7:10 (1050 × 1500); Letter is 8.5:11, i.e. the same
// height and ~10% wider. Rather than pad the sides, every element is placed
// on the wider page: horizontal positions scale by LETTER_K (so margins,
// columns, cards, the benefit flow and the footer spread across the full
// width with proportional gutters), while type and icons keep their size.
// Full-width bands and cards stretch; the cause logo gets a larger header
// slot and fills its circle in the benefit flow.
//
// This runs on the composed SVG, after slots and overrides are applied, so
// template coordinates (which identify editable slots) are never changed.
// <text> elements are only ever wrapped in a translating <g>, never edited.
const ART_WIDTH = 1050
const ART_HEIGHT = 1500
const LETTER_WIDTH = ART_HEIGHT * 8.5 / 11
const LETTER_K = LETTER_WIDTH / ART_WIDTH
const X = (x: number) => +(x * LETTER_K).toFixed(2)
const shift = (x: number) => +(x * (LETTER_K - 1)).toFixed(2)
// Header: the cause logo is ~45% larger than the library's 120 × 104 slot,
// with the gold rule and the name/label block following it.
const HEADER_LOGO = { x: X(56), y: 30, width: 168, height: 144 }
const HEADER_RULE_X = HEADER_LOGO.x + HEADER_LOGO.width + 16
const HEADER_TEXT_X = HEADER_RULE_X + 22
const HEADER_CENTER_Y = HEADER_LOGO.y + HEADER_LOGO.height / 2
// Benefit flow: the circle is r=55 with a 5px stroke (inner edge 52.5).
const FLOW_LOGO_RADIUS = 50
/**
 * The largest box for the logo in the flow circle. A round mark fills the
 * clip circle; any other shape gets the largest rectangle of its proportions
 * whose corners stay inside it, so no part of the mark is cut off.
 */
function flowLogoBox(href: string) {
  const fit = logoFits.get(href)
  const diameter = FLOW_LOGO_RADIUS * 2
  if (fit?.round) return { width: diameter, height: diameter }
  const aspect = fit?.aspect || 1
  const height = diameter / Math.sqrt(1 + aspect * aspect)
  return { width: +(height * aspect).toFixed(2), height: +height.toFixed(2) }
}

const numAttr = (tag: string, name: string) => {
  const value = new RegExp(`\\s${name}="([-\\d.]+)"`).exec(tag)?.[1]
  return value === undefined ? undefined : Number(value)
}
const setAttr = (tag: string, name: string, value: number | string) =>
  new RegExp(`\\s${name}="[^"]*"`).test(tag)
    ? tag.replace(new RegExp(`\\s${name}="[^"]*"`), ` ${name}="${value}"`)
    : tag.replace(/^<([a-zA-Z]+)/, `<$1 ${name}="${value}"`)

/** Full-width bands span the page; the right-anchored hero photo keeps its edge. */
function stretchBands(fragment: string) {
  return fragment.replace(/<(?:rect|image)\b[^>]*>/g, tag => {
    const x = numAttr(tag, 'x') ?? 0
    const width = numAttr(tag, 'width') ?? 0
    // Only elements reaching the artwork's right edge are bands; a local
    // x="0" inside a translated icon group must stay as drawn.
    if (!width || x + width !== ART_WIDTH) return tag
    return setAttr(setAttr(tag, 'x', X(x)), 'width', +(LETTER_WIDTH - X(x)).toFixed(2))
  })
}

/** Splits an SVG fragment into its top-level elements (and the text between them). */
function topLevelElements(body: string) {
  const parts: string[] = []
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z]+)\b[^>]*?(\/?)>/g
  let depth = 0, start = 0, last = 0, match: RegExpExecArray | null
  while ((match = token.exec(body))) {
    if (match[0].startsWith('<!--')) continue
    const [, closing, , selfClosing] = match
    if (!closing && depth === 0) { if (match.index > last) parts.push(body.slice(last, match.index)); start = match.index }
    if (closing) depth--
    else if (!selfClosing) depth++
    if (depth === 0) { parts.push(body.slice(start, token.lastIndex)); last = token.lastIndex }
  }
  parts.push(body.slice(last))
  return parts
}

function layoutGroup(element: string, open: string, tx: number, ty: number) {
  const inner = element.slice(open.length)
  // Cards: anchor the left edge and stretch the panel to the scaled width.
  const card = /^\s*<rect\b(?![^>]*\sx=)[^>]*\swidth="(\d+(?:\.\d+)?)"/.exec(inner)
  if (card && Number(card[1]) >= 200) {
    const width = Number(card[1])
    const nextTx = X(tx)
    const nextWidth = +(X(tx + width) - nextTx).toFixed(2)
    // Edited lines may use the card's extra width (data-fit is the editor's line budget).
    const resized = inner.replace(card[0], card[0].replace(/\swidth="[^"]*"/, ` width="${nextWidth}"`))
      .replace(/\sdata-fit="([\d.]+)"/g, (_, fit: string) => ` data-fit="${(Number(fit) + nextWidth - width).toFixed(1)}"`)
    return open.replace(/translate\([^)]*\)/, `translate(${nextTx} ${ty})`) + resized
  }
  // Anything else keeps its size and moves with its visual centre: the shared
  // x of its centred text (step columns, the LocalVIP mark), else its first
  // image, else its origin (benefit circles, footer actions).
  const centred = /<text\b[^>]*\sx="([-\d.]+)"[^>]*text-anchor="middle"/.exec(inner)
  const image = /<image\b[^>]*>/.exec(inner)?.[0]
  const centre = centred ? Number(centred[1])
    : image && (numAttr(image, 'x') ?? 0) >= 0 ? (numAttr(image, 'x') ?? 0) + (numAttr(image, 'width') ?? 0) / 2 : 0
  const nextTx = +(X(tx + centre) - centre).toFixed(2)
  // Column rules sit on the boundary between columns, which scales with them.
  const ruled = inner.replace(/<line\b(?=[^>]*\sx1="0")(?=[^>]*\sx2="0")[^>]*>/g, line =>
    setAttr(setAttr(line, 'x1', +(X(tx) - nextTx).toFixed(2)), 'x2', +(X(tx) - nextTx).toFixed(2)))
  const flowLogo = ruled.replace(/<image\b(?=[^>]*\sx="-)(?=[^>]*\sy="-)[^>]*>/g, tag => {
    const { width, height } = flowLogoBox(/\shref="([^"]*)"/.exec(tag)?.[1] || '')
    let next = setAttr(setAttr(setAttr(setAttr(tag, 'x', -width / 2), 'y', -height / 2), 'width', width), 'height', height)
    next = setAttr(next, 'preserveAspectRatio', 'xMidYMid meet')
    return next.replace(/\s*\/?>$/, ' clip-path="url(#flowLogoClip)"/>')
  })
  return open.replace(/translate\([^)]*\)/, `translate(${nextTx} ${ty})`) + flowLogo
}

function layoutElement(element: string, header: { dx: number; dy: number }) {
  const open = /^<([a-zA-Z]+)\b[^>]*>/.exec(element)
  if (!open) return element
  const [tag, name] = open
  const x = numAttr(tag, 'x') ?? 0
  const width = numAttr(tag, 'width') ?? 0
  const y = numAttr(tag, 'y') ?? 0
  if ((name === 'rect' || name === 'image') && width && x + width === ART_WIDTH) return stretchBands(element)
  if (name === 'g' && /\sclip-path=/.test(tag)) return stretchBands(element)
  // The header may arrive as loose <text>s or wrapped in one group
  // (data-slot-header); either way it moves with the enlarged logo.
  if (name === 'g' && (/\sdata-slot-header\b/.test(tag) || /<text\b[^>]*\sx="21[24]"/.test(element) && !/transform=/.test(tag))) {
    return `<g transform="translate(${header.dx} ${header.dy})">${element}</g>`
  }
  if (name === 'g') {
    const translate = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(tag)
    return translate ? layoutGroup(element, tag, Number(translate[1]), Number(translate[2])) : element
  }
  if (name === 'text') {
    // The cause name and label move with the enlarged header logo.
    if ((x === 212 || x === 214) && y < 170) return `<g transform="translate(${header.dx} ${header.dy})">${element}</g>`
    return `<g transform="translate(${shift(x)} 0)">${element}</g>`
  }
  if (name === 'image' && y < 60 && x < 70) {
    return element.replace(tag, setAttr(setAttr(setAttr(setAttr(tag, 'x', HEADER_LOGO.x), 'y', HEADER_LOGO.y), 'width', HEADER_LOGO.width), 'height', HEADER_LOGO.height))
  }
  if (name === 'rect' && x === 190 && y < 60) {
    return element.replace(tag, setAttr(setAttr(setAttr(tag, 'x', HEADER_RULE_X), 'y', HEADER_LOGO.y + 12), 'height', HEADER_LOGO.height - 24))
  }
  if (name === 'rect' || name === 'image') return element.replace(tag, setAttr(tag, 'x', +(x + shift(x + width / 2)).toFixed(2)))
  if (name === 'line') return element.replace(tag, setAttr(setAttr(tag, 'x1', X(numAttr(tag, 'x1') ?? 0)), 'x2', X(numAttr(tag, 'x2') ?? 0)))
  if (name === 'circle') return element.replace(tag, setAttr(tag, 'cx', X(numAttr(tag, 'cx') ?? 0)))
  if (name === 'path') {
    const d = /\sd="([^"]*)"/.exec(tag)?.[1] || ''
    // Flow arrows are absolute M/C/L curves; scale their x coordinates.
    if (!/^[MCL\d\s.,-]+$/.test(d)) return element
    let index = 0
    const next = d.replace(/-?\d+(?:\.\d+)?/g, value => (index++ % 2 === 0 ? String(X(Number(value))) : value))
    return element.replace(tag, tag.replace(/\sd="[^"]*"/, ` d="${next}"`))
  }
  return element
}

/** Lays a composed 1050 × 1500 flyer out on a Letter-proportioned page. See above. */
export function layoutForLetter(svg: string) {
  const defsEnd = svg.indexOf('</defs>')
  const bodyStart = defsEnd >= 0 ? defsEnd + '</defs>'.length : svg.indexOf('>', svg.indexOf('<svg')) + 1
  const bodyEnd = svg.lastIndexOf('</svg>')
  const head = stretchBands(svg.slice(0, bodyStart))
    .replace(/<svg\b[^>]*>/, root => setAttr(setAttr(root, 'width', LETTER_WIDTH), 'viewBox', `0 0 ${LETTER_WIDTH} ${ART_HEIGHT}`))
    .replace('</defs>', `<clipPath id="flowLogoClip"><circle r="${FLOW_LOGO_RADIUS}"/></clipPath></defs>`)
  const body = svg.slice(bodyStart, bodyEnd)
  // Centre the name/label block on the larger logo. The block spans y≈47 to
  // the label at 119 (one-line name) or 145 (two lines); the live editor
  // rebuilds it on every name edit, so centre on the midpoint of both cases
  // rather than on whichever line count the server rendered.
  const header = { dx: +(HEADER_TEXT_X - 212).toFixed(2), dy: Math.round(HEADER_CENTER_Y - (47 + (119 + 145) / 2) / 2) }
  return head + topLevelElements(body).map(part => part.startsWith('<') && !part.startsWith('<!--') ? layoutElement(part, header) : part).join('') + svg.slice(bodyEnd)
}

/**
 * The composed Letter SVG a PDF is printed from, with every editable
 * line and image tagged by slot id, for the generator's live preview.
 */
export async function renderCauseCampaignFlyerSvg(input: Parameters<typeof buildCauseCampaignFlyerSvg>[0]) {
  return Buffer.from(await renderCauseCampaignFlyer(input, 'svg')).toString('utf8')
}

// Keep native decoder failures out of the web server. A fresh process also
// releases all native image allocations after each print-resolution PDF.
async function runFlyerWorker(payload: unknown, mode: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await promisify(execFile)(process.execPath,
        ['--import', 'tsx', path.join(process.cwd(), 'scripts/cause-flyer-worker.ts'), JSON.stringify(payload), mode],
        { cwd: process.cwd(), env: { ...process.env, LOCALVIP_FLYER_WORKER: '1' }, encoding: 'buffer',
          timeout: 120000, maxBuffer: 32 * 1024 * 1024 })
      return new Uint8Array(stdout)
    } catch (error) {
      if (attempt < 2 && (error as { signal?: string }).signal === 'SIGSEGV') continue
      throw error
    }
  }
}

/**
 * One replacement image treated exactly as the renderer treats it: a logo is
 * trimmed to its mark (with its box in the benefit circle), a photo is
 * cropped and brightened. The live preview swaps it in without a full render.
 */
export async function prepareFlyerImage(slot: 'logo' | 'photo', url: string, mode: FlyerPhotoMode = 'square'): Promise<PreparedFlyerImage> {
  if (process.env.LOCALVIP_FLYER_WORKER !== '1') return JSON.parse(Buffer.from(await runFlyerWorker({ slot, url, mode }, 'image')).toString('utf8'))
  const data = await imageData(url)
  if (slot === 'photo') return { href: await preparePhoto(data, mode) }
  const href = await trimLogo(data)
  return { href, flowLogo: flowLogoBox(href) }
}

export async function renderCauseCampaignFlyer(input: CauseFlyerInput, preview: boolean | 'svg' = false) {
  if (process.env.LOCALVIP_FLYER_WORKER !== '1') return runFlyerWorker(input, preview === 'svg' ? 'svg' : preview ? 'preview' : 'pdf')
  // GiveBack Days is authored on Letter; the library artwork is laid out for it.
  const giveback = isGivebackDesign(input.design)
  const composed = await buildCauseCampaignFlyerSvg(input)
  const svg = giveback ? composed : layoutForLetter(composed)
  if (preview === 'svg') return Buffer.from(svg)
  const fonts = giveback ? { font: { fontFiles: givebackFonts().faces.map(face => face.file), loadSystemFonts: false, defaultFontFamily: givebackFonts().sans } } : resvgFonts()
  // 2550 × 3300 is 300 pixels per printed inch on Letter, which keeps type,
  // icons and QR modules crisp in print.
  let bytes: Uint8Array
  if (giveback) bytes = await buildGivebackPdf(svg) // vector type over a 300 dpi artwork layer
  else {
    const png = new Resvg(svg, { ...fonts, fitTo: { mode: 'width', value: 2550 } }).render().asPng()
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([612, 792])
    page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 612, height: 792 })
    bytes = await pdf.save()
  }
  return preview ? Buffer.from(JSON.stringify({ pdf: Buffer.from(bytes).toString('base64'), preview: new Resvg(svg, { ...fonts, fitTo: { mode: 'width', value: 765 } }).render().asPng().toString('base64') })) : bytes
}
