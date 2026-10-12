import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { Resvg } from '@resvg/resvg-js'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { readableBrandText } from '@/lib/brand-colors'

export type FlyerAudience = 'business' | 'families' | 'schools' | 'boosters'
export type FlyerKind = 'cause' | 'school' | 'booster'
export const FLYER_DESIGNS = ['community', 'growth', 'comparison'] as const
export type FlyerDesign = (typeof FLYER_DESIGNS)[number]

// Exact artwork from the dashboard's Olathe library. Booster outreach uses
// the school series, personalized to the club's identity.
export function approvedFlyerTemplateId(audience: FlyerAudience, design: FlyerDesign = 'community') {
  const series = audience === 'business' ? [77, 68, 69] : audience === 'families' ? [70, 71, 72] : [73, 74, 75]
  return series[FLYER_DESIGNS.indexOf(design)]
}

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

const measure = createCanvas(1, 1).getContext('2d')
function wrap(value: string, width: number, size: number, weight = 400) {
  measure.font = `${weight} ${size}px Arial`
  const lines: string[] = []
  let line = ''
  for (const word of value.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure.measureText(next).width > width) { lines.push(line); line = word }
    else line = next
  }
  if (line) lines.push(line)
  return lines
}
async function brightenPhoto(dataUrl: string) {
  const width = 1875
  const height = 1725
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
  let brightness = 0, samples = 0
  for (let i = 0; i < pixels.data.length; i += 64) {
    brightness += (pixels.data[i] * .21 + pixels.data[i + 1] * .72 + pixels.data[i + 2] * .07)
    samples++
  }
  const mean = brightness / samples
  const gamma = mean < 85 ? .56 : mean < 115 ? .72 : mean < 145 ? .88 : 1
  if (gamma < 1) {
    const lut = Array.from({ length: 256 }, (_, value) => Math.round(255 * (value / 255) ** gamma))
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = lut[pixels.data[i]]
      pixels.data[i + 1] = lut[pixels.data[i + 1]]
      pixels.data[i + 2] = lut[pixels.data[i + 2]]
    }
    ctx.putImageData(pixels, 0, 0)
  }
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

export async function buildCauseCampaignFlyerSvg(input: {
  name: string; locality: string; logoUrl: string; coverUrl: string; joinUrl: string; audience: FlyerAudience
  design?: FlyerDesign; category?: string | null; mission?: string; parentOrganization?: string; colors?: { navy?: string; gold?: string }
  palette?: { background: string; highlight: string; accent: string }
}) {
  const name = input.name.trim()
  if (!name) throw new Error('A cause name is required for flyer generation.')
  const kind = flyerKind(input.category, name)
  const [[logo, photo], template] = await Promise.all([
    prepareAssets(input.logoUrl, input.coverUrl),
    readFile(path.join(templateDir, `approved-${approvedFlyerTemplateId(input.audience, input.design)}.svg`), 'utf8'),
  ])
  const qr = await QRCode.toDataURL(input.joinUrl, { margin: 3, width: 164, errorCorrectionLevel: 'M' })
  // Preserve the library's navy/white/gold hierarchy. Cause colors belong
  // only in small secondary details, never the hero or main headline.
  const accent = color(input.palette?.accent, color(input.colors?.gold, color(input.colors?.navy, '#efb719')))
  const heading = name.toUpperCase()
  let headerSize = 39
  let headerLines = wrap(heading, 605, headerSize, 900)
  measure.font = `900 ${headerSize}px Arial`
  while ((headerLines.length > 2 || headerLines.some(line => measure.measureText(line).width > 605)) && headerSize > 22) {
    headerSize -= 2
    headerLines = wrap(heading, 605, headerSize, 900)
    measure.font = `900 ${headerSize}px Arial`
  }
  if (headerLines.length > 2 || headerLines.some(line => measure.measureText(line).width > 605)) {
    throw new Error('The cause name is too long for the flyer header.')
  }
  const kindLabel = kind === 'booster' ? 'BOOSTER CLUB' : kind === 'school' ? 'SCHOOL COMMUNITY' : 'COMMUNITY CAUSE'
  const parent = input.parentOrganization?.trim().toUpperCase()
  const identityLabel = parent && parent.length < 34 ? `${kindLabel} · ${parent}` : kindLabel
  const header = headerLines.map((line, index) => `<text class="display white" x="212" y="${75 + index * 37}" font-size="${headerSize}">${esc(line)}</text>`).join('')
    + `<text class="sans white" x="214" y="${headerLines.length === 2 ? 145 : 119}" font-size="15" letter-spacing="1.2">${esc(identityLabel)}</text>`
  const replacements: Record<string, string> = { HEADER: header, PHOTO: photo, LOGO: logo, QR: qr }
  const subject = input.audience === 'boosters' || kind === 'booster' ? 'club' : kind === 'school' ? 'school' : 'cause'
  // Retain the library's artwork and copy. Generic organization references keep
  // body text within the original line lengths; the header carries the full name.
  const svg = template
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

export async function renderCauseCampaignFlyer(input: Parameters<typeof buildCauseCampaignFlyerSvg>[0], preview = false) {
  // Keep native decoder failures out of the web server. A fresh process also
  // releases all native image allocations after each print-resolution PDF.
  if (process.env.LOCALVIP_FLYER_WORKER !== '1') {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { stdout } = await promisify(execFile)(process.execPath,
          ['--import', 'tsx', path.join(process.cwd(), 'scripts/cause-flyer-worker.ts'), JSON.stringify(input), preview ? 'preview' : 'pdf'],
          { cwd: process.cwd(), env: { ...process.env, LOCALVIP_FLYER_WORKER: '1' }, encoding: 'buffer',
            timeout: 120000, maxBuffer: 32 * 1024 * 1024 })
        return new Uint8Array(stdout)
      } catch (error) {
        if (attempt < 2 && (error as { signal?: string }).signal === 'SIGSEGV') continue
        throw error
      }
    }
  }
  const svg = await buildCauseCampaignFlyerSvg(input)
  // A letter-size PDF needs roughly 300 pixels per printed inch. Rendering
  // the editable SVG at 2.5x keeps type, icons and QR modules crisp in print.
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 2625 } }).render().asPng()
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  // Fit the original 1050 × 1500 artwork onto Letter without stretching it.
  const printWidth = 792 * 1050 / 1500
  page.drawImage(await pdf.embedPng(png), { x: (612 - printWidth) / 2, y: 0, width: printWidth, height: 792 })
  const bytes = await pdf.save()
  return preview ? Buffer.from(JSON.stringify({ pdf: Buffer.from(bytes).toString('base64'), preview: new Resvg(svg, { fitTo: { mode: 'width', value: 735 } }).render().asPng().toString('base64') })) : bytes
}
