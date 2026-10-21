import path from 'node:path'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CalendarCheck, DoorOpen, HeartHandshake, School, Store, Users, type LucideIcon } from 'lucide-react'
import { fitFlyerLine, type FlyerFontKind, type FlyerMeasure } from '@/lib/flyer-fit'
import type { FlyerSlots, FlyerTextSlot } from '@/lib/flyer-slots'
import type { PDFFont } from 'pdf-lib'
import { givebackFonts } from './flyer-fonts'

/**
 * GiveBack Days: a business flyer authored natively on US Letter (612 × 792
 * pt), from the Father's Club draft and its 15-point design brief. Every
 * printed line is an editable slot filled from the cause's own details, so
 * any cause can use it; the live preview edits the same tagged lines.
 *
 * Layout: identity header, navy hero with the cause photo on the right, three
 * steps, benefits led by the business column, a QR-led call to action, and
 * two partner columns. Copy avoids promising traffic or sales results.
 */

const ASSETS = path.join(process.cwd(), 'src/lib/server/flyer-templates/giveback')
const NAVY = '#12263A', STEEL = '#5E809E', GOLD = '#E9B91D', MIST = '#F4F6F8', INK = '#171B20', SLATE = '#3D5A73'

let registered = false
const context = createCanvas(1, 1).getContext('2d')
/** Measures with the bundled faces, as the browser preview does. */
export const measureGiveback: FlyerMeasure = (text, kind, weight, size) => {
  if (!registered) {
    for (const face of givebackFonts().faces) GlobalFonts.registerFromPath(face.file, face.family)
    registered = true
  }
  context.font = `${weight} ${size}px "${kind === 'display' ? 'Montserrat' : 'Open Sans'}"`
  return context.measureText(text).width
}

export type GivebackCause = {
  name: string
  city: string
  /** School district or parent organization, e.g. "Olathe Public Schools". */
  parentOrganization?: string
  /** Schools, booster clubs and PTOs read as school-supporting causes. */
  schoolFocused: boolean
  owner?: { name?: string | null; email?: string | null; phone?: string | null }
}

/** v2: the ported Codex redesign. v3: full-width hero, one type scale, a single QR-led call to action. */
export type GivebackVersion = 'v2' | 'v3'

type Line = { id: string; group: string; kind: FlyerFontKind; weight: number; size: number; x: number; y: number; width: number; fill: string }

// Blocks of printed lines: [slot prefix, group label, line count, font, size, weight, x, first baseline, line height, width, colour]
type Block = [string, string, number, FlyerFontKind, number, number, number, number, number, number, string]
function blocks(hasDistrictLogo: boolean): Block[] {
  const districtX = hasDistrictLogo ? 394 : 434
  return [
    ['org', 'Organization', 1, 'display', 14, 800, 94, 37, 0, 280, NAVY],
    ['district', 'Supporting line', 2, 'display', 8, 700, districtX, 25, 10, 142, SLATE],
    ['eyebrow', 'Banner', 1, 'display', 8, 700, 36, 92, 0, 298, '#FFFFFF'],
    ['headline', 'Headline', 2, 'display', 32, 800, 36, 139, 34.5, 298, '#FFFFFF'],
    ['highlight', 'Supporting headline', 2, 'display', 12.5, 700, 36, 211, 15.6, 298, GOLD],
    ['intro', 'Introduction', 3, 'sans', 10.5, 400, 36, 255, 13.1, 290, '#FFFFFF'],
    ['process', 'Steps heading', 1, 'display', 17, 700, 36, 324, 0, 540, NAVY],
    ...[0, 1, 2].flatMap(i => [
      [`step${i + 1}-title`, `Step ${i + 1} title`, 1, 'display', 10.5, 700, 36 + i * 186, 368, 0, 168, NAVY],
      [`step${i + 1}-body`, `Step ${i + 1} description`, 2, 'sans', 10, 400, 36 + i * 186, 386, 12.5, 168, INK],
    ] as Block[]),
    ['benefits', 'Benefits heading', 1, 'display', 17, 700, 36, 428, 0, 540, NAVY],
    ['business-title', 'Business column title', 1, 'display', 12, 700, 62, 454, 0, 214, NAVY],
    ['business', 'Business benefits', 3, 'sans', 10.5, 400, 36, 478, 21, 240, INK],
    ['families-title', 'Families column title', 1, 'display', 10.5, 700, 332, 454, 0, 97, NAVY],
    ['families', 'Family benefits', 3, 'sans', 10, 400, 306, 478, 21, 123, INK],
    ['third-title', 'Third column title', 1, 'display', 10.5, 700, 476, 454, 0, 100, NAVY],
    ['third', 'Third column benefits', 3, 'sans', 10, 400, 450, 478, 21, 126, INK],
    ['organizer', 'Organizer line', 1, 'sans', 9.5, 400, 36, 560, 0, 540, SLATE],
    ['cta', 'Call to action', 2, 'display', 18, 800, 36, 601, 22.5, 414, '#FFFFFF'],
    ['scan', 'Scan invitation', 1, 'display', 12, 700, 36, 643, 0, 414, GOLD],
    ['cta-note', 'Call to action note', 1, 'sans', 10, 400, 36, 659, 0, 414, '#FFFFFF'],
    ['booking-label', 'Booking label', 1, 'display', 8, 700, 36, 677, 0, 170, '#D7E2EB'],
    ['email-label', 'Email label', 1, 'display', 8, 700, 215, 677, 0, 130, '#D7E2EB'],
    ['phone-label', 'Phone label', 1, 'display', 8, 700, 360, 677, 0, 96, '#D7E2EB'],
    ['booking', 'Booking address', 1, 'sans', 10, 700, 36, 691, 0, 170, '#FFFFFF'],
    ['email', 'Email', 1, 'sans', 10, 400, 215, 691, 0, 130, '#FFFFFF'],
    ['phone', 'Phone', 1, 'sans', 10, 400, 360, 691, 0, 96, '#FFFFFF'],
    ['host-label', 'Host label', 1, 'display', 8.5, 700, 36, 716, 0, 270, SLATE],
    ['host-name', 'Host name', 1, 'display', 12, 700, 80, 733, 0, 224, NAVY],
    ['host-title', 'Host title', 1, 'sans', 9, 400, 80, 746, 0, 224, INK],
    ['host-org', 'Host organization', 1, 'sans', 9, 400, 80, 759, 0, 224, INK],
    ['host-contact', 'Host contact', 1, 'sans', 9, 400, 36, 772, 0, 270, SLATE],
    ['presenter-label', 'Presenter label', 1, 'display', 8.5, 700, 324, 716, 0, 252, SLATE],
    ['presenter-name', 'Presenter name', 1, 'display', 11, 700, 470, 733, 0, 106, NAVY],
    ['presenter-title', 'Presenter title', 1, 'sans', 9, 400, 470, 746, 0, 106, INK],
    ['presenter-org', 'Presenter organization', 1, 'sans', 9, 400, 470, 759, 0, 106, INK],
    ['tagline', 'Tagline', 1, 'sans', 9, 400, 324, 772, 0, 252, SLATE],
  ]
}

// v3 sets every line on one scale: 8 labels, 9.5 captions, 10.5 body,
// 12.5 titles, 18 section headings, 20 call to action, 34 headline. Sections
// keep a 0.5" margin and the footer stays inside a 0.25" safe area.
function blocksV3(hasDistrictLogo: boolean): Block[] {
  const LIGHT = '#C9D6E2'
  return [
    ['org', 'Organization', 1, 'display', 12.5, 800, 92, 35, 0, 280, NAVY],
    ['district', 'Supporting line', 2, 'display', 8, 700, hasDistrictLogo ? 400 : 436, 26, 10, 140, SLATE],
    ['eyebrow', 'Banner', 1, 'display', 8, 700, 36, 98, 0, 300, LIGHT],
    ['headline', 'Headline', 2, 'display', 34, 800, 36, 146, 37, 300, '#FFFFFF'],
    ['highlight', 'Supporting headline', 2, 'display', 12.5, 700, 36, 216, 16, 300, GOLD],
    ['intro', 'Introduction', 3, 'sans', 10.5, 400, 36, 262, 14.5, 290, '#E4EAF0'],
    ['process', 'Steps heading', 1, 'display', 18, 700, 36, 358, 0, 540, NAVY],
    ...[0, 1, 2].flatMap(i => [
      [`step${i + 1}-title`, `Step ${i + 1} title`, 1, 'display', 12.5, 700, 36 + i * 188, 410, 0, 170, NAVY],
      [`step${i + 1}-body`, `Step ${i + 1} description`, 2, 'sans', 10.5, 400, 36 + i * 188, 428, 14, 170, INK],
    ] as Block[]),
    ['benefits', 'Benefits heading', 1, 'display', 18, 700, 36, 486, 0, 540, NAVY],
    ['business-title', 'Business column title', 1, 'display', 12.5, 700, 62, 523, 0, 226, NAVY],
    ['business', 'Business benefits', 3, 'sans', 10.5, 400, 36, 544, 18, 252, INK],
    ['families-title', 'Families column title', 1, 'display', 12.5, 700, 346, 523, 0, 98, NAVY],
    ['families', 'Family benefits', 3, 'sans', 10.5, 400, 320, 544, 18, 124, INK],
    ['third-title', 'Third column title', 1, 'display', 12.5, 700, 482, 523, 0, 94, NAVY],
    ['third', 'Third column benefits', 3, 'sans', 10.5, 400, 456, 544, 18, 120, INK],
    ['cta', 'Call to action', 1, 'display', 20, 800, 136, 637, 0, 440, '#FFFFFF'],
    ['scan', 'Scan invitation', 1, 'display', 12.5, 700, 136, 657, 0, 440, GOLD],
    ['booking', 'Booking address', 1, 'sans', 9.5, 700, 136, 683, 0, 140, LIGHT],
    ['email', 'Email', 1, 'sans', 9.5, 400, 286, 683, 0, 140, LIGHT],
    ['phone', 'Phone', 1, 'sans', 9.5, 400, 436, 683, 0, 140, LIGHT],
    ['host-label', 'Host label', 1, 'display', 8, 700, 36, 720, 0, 260, SLATE],
    ['host-name', 'Host name', 1, 'display', 12.5, 700, 74, 739, 0, 222, NAVY],
    ['host-title', 'Host title', 1, 'sans', 9.5, 400, 74, 752, 0, 222, INK],
    ['host-contact', 'Host contact', 1, 'sans', 9.5, 400, 74, 765, 0, 230, SLATE],
    ['presenter-label', 'Presenter label', 1, 'display', 8, 700, 324, 720, 0, 252, SLATE],
    ['presenter-name', 'Presenter name', 1, 'display', 12.5, 700, 446, 739, 0, 130, NAVY],
    ['presenter-title', 'Presenter title', 1, 'sans', 9.5, 400, 446, 752, 0, 130, INK],
    ['tagline', 'Tagline', 1, 'sans', 9.5, 400, 446, 765, 0, 130, SLATE],
  ]
}

/** Splits `text` into at most `count` lines of `width`; overflow stays on the last line for fitting. */
function wrapInto(text: string, count: number, width: number, kind: FlyerFontKind, weight: number, size: number) {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && measureGiveback(next, kind, weight, size) > width && lines.length < count - 1) { lines.push(line); line = word }
      else line = next
    }
    lines.push(line)
  }
  return [...lines.slice(0, count - 1), lines.slice(count - 1).join(' ')].concat(Array(count).fill('')).slice(0, count)
}

const titleCase = (value: string) => value.trim().replace(/\b\w/g, char => char.toUpperCase())

/** The copy each block starts from, worded for this cause. Blocks with several lines may be one string; it is wrapped. */
function defaultCopy(cause: GivebackCause, version: GivebackVersion): Record<string, string | string[]> {
  const copy = defaultCopyV2(cause)
  // v3 keeps one call to action: the QR books the call; contacts follow quietly.
  return version === 'v3' ? { ...copy, eyebrow: 'FOR LOCAL BUSINESSES', cta: 'Let’s plan your first GiveBack Day', scan: 'Scan the code to book a 15-minute call',
    phone: 'Text 480-463-4632', 'presenter-title': 'Founder & CEO, LocalVIP' } : copy
}

function defaultCopyV2(cause: GivebackCause): Record<string, string | string[]> {
  const city = titleCase(cause.city) || 'Local'
  const area = cause.city.trim() ? city : 'local'
  const parent = cause.parentOrganization?.trim()
  const owner = cause.owner || {}
  return {
    org: cause.name.trim().toUpperCase(),
    district: [`${city.toUpperCase()} GIVEBACK DAYS`, parent ? `SUPPORTING ${parent.toUpperCase()}` : cause.schoolFocused ? 'SUPPORTING LOCAL SCHOOLS' : 'SUPPORTING OUR COMMUNITY'],
    eyebrow: `${city.toUpperCase()} GIVEBACK DAYS · LOCAL BUSINESSES`,
    headline: ['Put your quieter', 'days to work.'],
    highlight: ['More local connections.', cause.schoolFocused ? `Stronger ${area} schools.` : `A stronger ${area} community.`],
    intro: `Choose the days you want to promote. Invite ${area} families to support ${cause.schoolFocused ? 'schools' : `${cause.name.trim()}`} through everyday purchases.`,
    process: 'How GiveBack Days work',
    'step1-title': 'Choose your days', 'step1-body': 'Select the days you want to promote.',
    'step2-title': 'Welcome local families', 'step2-body': `Invite ${area} families to visit and shop.`,
    'step3-title': cause.schoolFocused ? 'Support local schools' : 'Support a local cause', 'step3-body': 'Qualifying purchases generate giveback.',
    benefits: `Good for business. Good for ${area}.`,
    'business-title': 'Your business', business: ['Promote the days you choose', 'No upfront or monthly fees', 'No receipts to collect'],
    'families-title': `${city} families`, families: [cause.schoolFocused ? 'Support local schools' : 'Support a local cause', 'Earn cash back', 'Shop local favorites'],
    'third-title': cause.schoolFocused ? `${city} schools` : 'Our cause', third: cause.schoolFocused ? ['Ongoing giveback', 'Year-round support', 'School and PTO funding'] : ['Ongoing giveback', 'Year-round support', 'Local impact'],
    organizer: `An initiative from ${cause.name.trim()}, powered by LocalVIP.`,
    cta: ['Let’s plan your first', 'GiveBack Day'],
    scan: 'Scan to book 15 minutes',
    'cta-note': 'See how the program could work for your business in a 15-minute conversation.',
    'booking-label': 'Book online', 'email-label': 'Email', 'phone-label': 'Text',
    booking: 'calendly.com/30vip', email: 'rick@localvip.com', phone: '480-463-4632',
    'host-label': 'Brought to you by', 'host-name': owner.name?.trim() || cause.name.trim(), 'host-title': owner.name?.trim() ? 'Organizer' : '',
    'host-org': owner.name?.trim() ? cause.name.trim() : '',
    'host-contact': [owner.email?.trim(), owner.phone?.trim()].filter(Boolean).join(' · '),
    'presenter-label': 'Powered by', 'presenter-name': 'Rick Swanson', 'presenter-title': 'Founder & CEO', 'presenter-org': 'LocalVIP',
    tagline: 'Generosity pays.',
  }
}

/** True when the district logo bundled with the template applies to this cause. */
export const givebackDistrictLogo = (cause: GivebackCause) => /\bolathe public schools\b/i.test(cause.parentOrganization || '')

function lines(cause: GivebackCause, version: GivebackVersion) {
  const copy = defaultCopy(cause, version)
  return (version === 'v3' ? blocksV3 : blocks)(givebackDistrictLogo(cause)).flatMap(([key, group, count, kind, size, weight, x, y, step, width, fill]) => {
    const value = copy[key]
    const texts = Array.isArray(value) ? value : count > 1 ? wrapInto(value, count, width, kind, weight, size) : [value]
    return texts.map((text, index) => ({ line: { id: `${key}.${index + 1}`, group, kind, weight, size, x, y: +(y + index * step).toFixed(2), width, fill } as Line, text, index }))
  })
}

const lineLimit = (value: string) => Math.min(160, Math.max(24, Math.ceil(value.length * 1.5)))

/** Every editable line with its default for this cause, plus the two image slots. */
export function givebackSlots(cause: GivebackCause, logoUrl: string, coverUrl: string, version: GivebackVersion = 'v2'): FlyerSlots {
  const text: FlyerTextSlot[] = lines(cause, version).map(({ line, text, index }) => ({ id: line.id, group: line.group, line: index + 1, default: text, maxLength: lineLimit(text) }))
  return { text, images: [{ id: 'logo', label: 'Cause logo', default: logoUrl }, { id: 'photo', label: 'Hero photo', default: coverUrl }] }
}

const unesc = (value: string) => value.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]!)

/**
 * A print PDF whose type stays vector: the artwork (photo, logos, icons,
 * panels) is a 300 dpi Letter background, and every <text> is redrawn on it as
 * real, selectable text in the embedded faces. This reads only the SVG this
 * module writes: one absolutely positioned line per <text>, hex fills, the
 * display/sans classes and the bundled weights.
 */
export async function buildGivebackPdf(svg: string) {
  const [{ readFile }, { PDFDocument, rgb }, { default: fontkit }, { Resvg }] = await Promise.all([
    import('node:fs/promises'), import('pdf-lib'), import('@pdf-lib/fontkit'), import('@resvg/resvg-js')])
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setCreator('LocalVIP flyer generator')
  const page = pdf.addPage([612, 792])
  const { faces, sans } = givebackFonts()
  const fonts = new Map<string, PDFFont>(await Promise.all(faces.map(async face =>
    [`${face.family}:${face.weight}`, await pdf.embedFont(await readFile(face.file), { subset: true })] as const)))
  const artwork = svg.replace(/<text\b[\s\S]*?<\/text>/g, '')
  const png = new Resvg(artwork, { font: { fontFiles: faces.map(face => face.file), loadSystemFonts: false, defaultFontFamily: sans }, fitTo: { mode: 'width', value: 2550 } }).render().asPng()
  page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 612, height: 792 })
  for (const [, attrs, content] of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attr = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1]
    const family = attr('class') === 'display' ? 'Montserrat' : 'Open Sans'
    const font = fonts.get(`${family}:${attr('font-weight') || 400}`)
    const fill = attr('fill') || INK
    const value = unesc(content.replace(/<[^>]+>/g, ''))
    if (!font || !/^#[\da-f]{6}$/i.test(fill)) throw new Error('Unsupported GiveBack flyer text style.')
    if (!value) continue
    let size = Number(attr('font-size'))
    // A condensed line (textLength) prints at the size that fits its width.
    const length = Number(attr('textLength'))
    if (length) size = Math.min(size, size * length / font.widthOfTextAtSize(value, size))
    page.drawText(value, { x: Number(attr('x')), y: 792 - Number(attr('y')), size, font,
      color: rgb(parseInt(fill.slice(1, 3), 16) / 255, parseInt(fill.slice(3, 5), 16) / 255, parseInt(fill.slice(5, 7), 16) / 255) })
  }
  return pdf.save()
}

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)
const icon = (component: LucideIcon, x: number, y: number, size = 18) =>
  renderToStaticMarkup(createElement(component, { x, y, width: size, height: size, color: STEEL, strokeWidth: 1.5 }))

type Art = { logo: string; photo: string; qr?: string; district?: string; localvip: string; schoolFocused: boolean }

function artworkV2({ logo, photo, qr, district, localvip, schoolFocused }: Art) {
  return `<defs>
  <style>.display{font-family:Montserrat}.sans{font-family:'Open Sans'}</style>
  <linearGradient id="heroShade"><stop stop-color="${NAVY}" stop-opacity=".85"/><stop offset="1" stop-color="${NAVY}" stop-opacity=".2"/></linearGradient>
  <clipPath id="heroWindow"><rect x="346" y="64" width="266" height="232"/></clipPath>
</defs>
<rect width="612" height="792" fill="#FFFFFF"/>
<image data-slot="logo" href="${logo}" x="36" y="12" width="48" height="42" preserveAspectRatio="xMidYMid meet"/>
${district ? `<image href="${district}" x="550" y="17" width="26" height="29" preserveAspectRatio="xMidYMid meet"/>` : ''}
<rect y="64" width="612" height="232" fill="${NAVY}"/>
<g clip-path="url(#heroWindow)">
  <image data-slot="photo" href="${photo}" x="346" y="64" width="266" height="232" preserveAspectRatio="xMidYMid slice"/>
  <rect x="346" y="64" width="90" height="232" fill="url(#heroShade)"/>
</g>
<path d="M74 345h126M260 345h126" stroke="#D4DFE8" stroke-width=".8"/>
${[0, 1, 2].map(i => `<text class="display" x="${36 + i * 186}" y="350" font-size="17" font-weight="700" fill="${STEEL}">0${i + 1}</text>`).join('')}
<rect x="24" y="437" width="264" height="106" rx="4" fill="${MIST}"/>
${icon(Store, 36, 441)}${icon(Users, 306, 441)}${icon(schoolFocused ? School : HeartHandshake, 450, 441)}
<rect y="576" width="612" height="124" fill="${NAVY}"/>
<rect x="470" y="586" width="106" height="106" rx="4" fill="#FFFFFF"/>
${qr ? `<image href="${qr}" x="478" y="594" width="90" height="90"/>` : ''}
<image data-slot="logo" href="${logo}" x="36" y="723" width="36" height="28" preserveAspectRatio="xMidYMid meet"/>
<image href="${localvip}" x="324" y="724" width="130" height="26" preserveAspectRatio="xMinYMid meet"/>`
}

// v3: the photo fills the hero's right side under a navy gradient that stays
// dark (85%+) behind the copy and lifts to about 30% over the people.
function artworkV3({ logo, photo, qr, district, localvip, schoolFocused }: Art) {
  return `<defs>
  <style>.display{font-family:Montserrat}.sans{font-family:'Open Sans'}</style>
  <linearGradient id="heroShade"><stop stop-color="${NAVY}"/><stop offset=".27" stop-color="${NAVY}" stop-opacity=".88"/><stop offset=".55" stop-color="${NAVY}" stop-opacity=".45"/><stop offset="1" stop-color="${NAVY}" stop-opacity=".28"/></linearGradient>
  <clipPath id="heroWindow"><rect x="232" y="60" width="380" height="260"/></clipPath>
</defs>
<rect width="612" height="792" fill="#FFFFFF"/>
<image data-slot="logo" href="${logo}" x="36" y="12" width="44" height="36" preserveAspectRatio="xMidYMid meet"/>
${district ? `<image href="${district}" x="550" y="15" width="26" height="29" preserveAspectRatio="xMidYMid meet"/>` : ''}
<rect y="60" width="612" height="260" fill="${NAVY}"/>
<g clip-path="url(#heroWindow)">
  <image data-slot="photo" href="${photo}" x="232" y="60" width="380" height="260" preserveAspectRatio="xMidYMid slice"/>
  <rect x="232" y="60" width="380" height="260" fill="url(#heroShade)"/>
</g>
${[CalendarCheck, DoorOpen, HeartHandshake].map((symbol, i) => {
    const x = 36 + i * 188
    return `${icon(symbol, x, 371, 20)}<text class="display" x="${x + 28}" y="386" font-size="9.5" font-weight="700" fill="${STEEL}">0${i + 1}</text>`
      + (i < 2 ? `<path d="M${x + 50} 382h120" stroke="#D4DFE8" stroke-width=".8"/>` : '')
  }).join('')}
<rect x="24" y="498" width="276" height="92" rx="4" fill="${MIST}"/><rect x="24" y="498" width="276" height="3" fill="${GOLD}"/>
${icon(Store, 36, 510)}${icon(Users, 320, 510)}${icon(schoolFocused ? School : HeartHandshake, 456, 510)}
<rect y="600" width="612" height="100" fill="${NAVY}"/>
<rect x="36" y="611" width="82" height="82" rx="4" fill="#FFFFFF"/>
${qr ? `<image href="${qr}" x="41" y="616" width="72" height="72"/>` : ''}
<image data-slot="logo" href="${logo}" x="36" y="728" width="30" height="26" preserveAspectRatio="xMidYMid meet"/>
<image href="${localvip}" x="324" y="728" width="110" height="22" preserveAspectRatio="xMinYMid meet"/>`
}

/**
 * The composed flyer. `logo` and `photo` are prepared data URLs (trimmed logo,
 * brightened photo); `qr` is optional, and the QR panel prints empty without it.
 */
export async function buildGivebackFlyerSvg(input: { cause: GivebackCause; logo: string; photo: string; qr?: string; text?: Record<string, string>; version?: GivebackVersion }) {
  const { readFile } = await import('node:fs/promises')
  const asset = async (name: string) => `data:image/png;base64,${(await readFile(path.join(ASSETS, name))).toString('base64')}`
  const [district, localvip] = await Promise.all([asset('ops-logo.png'), asset('localvip-logo.png')])
  const version = input.version || 'v2'
  const edits = input.text || {}
  const printed = lines(input.cause, version).map(({ line, text }) => {
    const value = (edits[line.id] ?? text).trim()
    const fit = fitFlyerLine(value, line.width, line.kind, line.weight, line.size, measureGiveback)
    return `<text class="${line.kind}" x="${line.x}" y="${line.y}" font-size="${+fit.size.toFixed(2)}" font-weight="${line.weight}" fill="${line.fill}"`
      + `${fit.textLength ? ` textLength="${fit.textLength}" lengthAdjust="spacingAndGlyphs"` : ''}`
      + ` data-kind="${line.kind}" data-weight="${line.weight}" data-size="${line.size}" data-fit="${line.width}"><tspan data-slot="${line.id}">${esc(value)}</tspan></text>`
  }).join('\n')
  const art = { logo: input.logo, photo: input.photo, qr: input.qr, localvip, schoolFocused: input.cause.schoolFocused, district: givebackDistrictLogo(input.cause) ? district : undefined }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="612" height="792" viewBox="0 0 612 792">
${version === 'v3' ? artworkV3(art) : artworkV2(art)}
${printed}
</svg>`
}
