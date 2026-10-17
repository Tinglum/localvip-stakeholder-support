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
import { brightenFlyerPixels, fitFlyerHeader, fitFlyerLine, flyerHeaderMarkup, flyerLineText, FLYER_PHOTO_SIZE, type FlyerFontKind, type FlyerMeasure } from '@/lib/flyer-fit'
import { flyerFonts } from '@/lib/server/flyer-fonts'
import { compactFlyerOverrides, FLYER_IMAGE_SLOT_LABELS, type FlyerOverrides, type FlyerSlots, type FlyerTextSlot } from '@/lib/flyer-slots'

import { approvedFlyerTemplateId, type FlyerAudience, type FlyerDesign } from '@/lib/flyer-designs'

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
async function brightenPhoto(dataUrl: string) {
  const { width, height } = FLYER_PHOTO_SIZE
  let image
  try {
    image = await loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'))
  } catch {
    // Some valid large PNGs are rejected by canvas's decoder. Resvg uses the
    // same renderer as the final template and normalizes them first.
    const normalized = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${dataUrl}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/></svg>`).render().asPng()
    image = await loadImage(normalized)
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

// A twelve-flyer set shares two uploads. Decode them once instead of repeating
// native image allocations for every design; retain only the latest pair.
let preparedAssets: { key: string; expires: number; value: Promise<[string, string]> } | undefined
function prepareAssets(logoUrl: string, coverUrl: string) {
  const key = JSON.stringify([logoUrl, coverUrl])
  if (preparedAssets?.key === key && preparedAssets.expires > Date.now()) return preparedAssets.value
  const value = Promise.all([imageData(logoUrl), imageData(coverUrl).then(brightenPhoto)])
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
      return part.replace(/^(\s*)(<tspan\b[^>]*>)?\s*[\s\S]*?\s*(<\/tspan>)?(\s*)$/, (_, before: string, open: string | undefined, _close, after: string) =>
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
}): Promise<FlyerSlots> {
  const kind = flyerKind(input.category, input.name)
  const template = await readFile(path.join(templateDir, `approved-${approvedFlyerTemplateId(input.audience, input.design)}.svg`), 'utf8')
  const kindLabel = kind === 'booster' ? 'BOOSTER CLUB' : kind === 'school' ? 'SCHOOL COMMUNITY' : 'COMMUNITY CAUSE'
  const parent = input.parentOrganization?.trim().toUpperCase()
  const label = parent && parent.length < 34 ? `${kindLabel} · ${parent}` : kindLabel
  const lines: TextLine[] = []
  walkFlyerText(localizeTemplateCopy(template, input.audience, kind, '#efb719'), ({ lines: found }) => {
    for (const line of found) if (line) lines.push(line)
  })
  lines.sort((a, b) => a.rank - b.rank) // stable: lines keep their order within a block
  const text: FlyerTextSlot[] = [
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

function localizeTemplateCopy(template: string, audience: FlyerAudience, kind: FlyerKind, accent: string) {
  const subject = audience === 'boosters' || kind === 'booster' ? 'club' : kind === 'school' ? 'school' : 'cause'
  // Retain the library's artwork and copy. Generic organization references keep
  // body text within the original line lengths; the header carries the full name.
  return template
    .replace(/More Olathe West families discover/g, 'More local families discover')
    .replace(/OLATHE WEST GIVEBACK DAY/g, 'LOCAL GIVEBACK DAY')
    .replace(/Choose a day\. Olathe West/g, `Choose a day. Our ${subject}`)
    .replace(/Olathe West/g, `our ${subject}`).replace(/OLATHE WEST/g, `OUR ${subject.toUpperCase()}`)
    .replace(/SUPPORT OLATHE/g, 'SUPPORT THIS').replace(/WEST TOGETHER\./g, `${subject.toUpperCase()} TOGETHER.`)
    .replace(/INVITE OLATHE/g, 'INVITE LOCAL').replace(/WEST FAMILIES/g, 'SUPPORTERS')
    .replace(/IN OLATHE\./g, 'LOCALLY.')
    .replace(/school/gi, value => value === value.toUpperCase() ? subject.toUpperCase() : subject)
    .replace(/(<circle\b[^>]*\br="(?:18|22)"[^>]*\bfill=")#(?:0b2349|efb719)(")/g, `$1${accent}$2`)
    .replace(/class="(sans|display) (?:white|navy)"([^>]*font-size="(?:19|23)")/g, 'class="$1 step-number"$2')
}

export async function buildCauseCampaignFlyerSvg(input: {
  name: string; locality: string; logoUrl: string; coverUrl: string; joinUrl: string; audience: FlyerAudience
  design?: FlyerDesign; category?: string | null; mission?: string; parentOrganization?: string; colors?: { navy?: string; gold?: string }
  palette?: { background: string; highlight: string; accent: string }
  /** A cause's own edits to the generated copy and imagery. See getFlyerSlots. */
  overrides?: FlyerOverrides
}) {
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
  const svg = applyFlyerTextOverrides(localizeTemplateCopy(template, input.audience, kind, accent), text)
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

// The library artwork is 7:10 (1050 × 1500); Letter is 8.5:11. Fitting it by
// height left 0.4" white bars on both sides, and cropping to width would cut
// the header and footer. Instead widen the canvas to Letter's aspect and run
// every full-width band (backgrounds, hero photo, clip) out to the new edges,
// so the content keeps its proportions and the page prints edge to edge.
const ART_WIDTH = 1050
const ART_HEIGHT = 1500
const BLEED_WIDTH = ART_HEIGHT * 8.5 / 11
const BLEED_PAD = (BLEED_WIDTH - ART_WIDTH) / 2
export function toLetterBleed(svg: string) {
  const num = (tag: string, name: string) => Number(new RegExp(`\\s${name}="([-\\d.]+)"`).exec(tag)?.[1] ?? 0)
  return svg
    .replace(/<svg\b[^>]*>/, tag => tag.replace(/\swidth="[^"]*"/, ` width="${BLEED_WIDTH}"`)
      .replace(/\sviewBox="[^"]*"/, ` viewBox="${-BLEED_PAD} 0 ${BLEED_WIDTH} ${ART_HEIGHT}"`))
    .replace(/<(?:rect|image)\b[^>]*>/g, tag => {
      const x = num(tag, 'x')
      const width = num(tag, 'width')
      // Only elements that reach the artwork's right edge are bands; a local
      // x="0" inside a translated icon group must stay as drawn.
      if (x + width !== ART_WIDTH) return tag
      const left = x === 0
      const nextX = left ? -BLEED_PAD : x
      const nextWidth = width + BLEED_PAD * (left ? 2 : 1)
      return tag.replace(/\sx="[^"]*"/, '').replace(/\swidth="[^"]*"/, ` x="${nextX}" width="${nextWidth}"`)
    })
}

/**
 * The composed Letter-bleed SVG a PDF is printed from, with every editable
 * line and image tagged by slot id, for the generator's live preview.
 */
export async function renderCauseCampaignFlyerSvg(input: Parameters<typeof buildCauseCampaignFlyerSvg>[0]) {
  return Buffer.from(await renderCauseCampaignFlyer(input, 'svg')).toString('utf8')
}

export async function renderCauseCampaignFlyer(input: Parameters<typeof buildCauseCampaignFlyerSvg>[0], preview: boolean | 'svg' = false) {
  // Keep native decoder failures out of the web server. A fresh process also
  // releases all native image allocations after each print-resolution PDF.
  if (process.env.LOCALVIP_FLYER_WORKER !== '1') {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { stdout } = await promisify(execFile)(process.execPath,
          ['--import', 'tsx', path.join(process.cwd(), 'scripts/cause-flyer-worker.ts'), JSON.stringify(input), preview === 'svg' ? 'svg' : preview ? 'preview' : 'pdf'],
          { cwd: process.cwd(), env: { ...process.env, LOCALVIP_FLYER_WORKER: '1' }, encoding: 'buffer',
            timeout: 120000, maxBuffer: 32 * 1024 * 1024 })
        return new Uint8Array(stdout)
      } catch (error) {
        if (attempt < 2 && (error as { signal?: string }).signal === 'SIGSEGV') continue
        throw error
      }
    }
  }
  const svg = toLetterBleed(await buildCauseCampaignFlyerSvg(input))
  if (preview === 'svg') return Buffer.from(svg)
  // 2550 × 3300 is 300 pixels per printed inch on Letter, which keeps type,
  // icons and QR modules crisp in print.
  const png = new Resvg(svg, { ...resvgFonts(), fitTo: { mode: 'width', value: 2550 } }).render().asPng()
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 612, height: 792 })
  const bytes = await pdf.save()
  return preview ? Buffer.from(JSON.stringify({ pdf: Buffer.from(bytes).toString('base64'), preview: new Resvg(svg, { ...resvgFonts(), fitTo: { mode: 'width', value: 765 } }).render().asPng().toString('base64') })) : bytes
}
