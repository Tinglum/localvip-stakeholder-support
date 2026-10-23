import path from 'node:path'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { CalendarCheck, CalendarDays, Check, ChevronRight, DoorOpen, HeartHandshake, Mail, MessageSquare, School, Store, Users, type LucideIcon } from 'lucide-react'
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

/**
 * v2: the ported Codex redesign. v3: full-width hero, one type scale, a
 * single QR-led call to action. v4: the original draft's composition (V1)
 * with an angled full-bleed hero, linked steps, icon cards and icon contacts.
 * v5: v4 refined: a bold lead line in the hero, a gold edge on the angled
 * cut, a framed scan target, larger body type and no repeated claims.
 * v6: the original draft PDF, reproduced at its measured positions, fonts,
 * sizes, colours and letter-spacing.
 */
export type GivebackVersion = 'v2' | 'v3' | 'v4' | 'v5' | 'v6'

type Anchor = 'start' | 'middle' | 'end'
type Line = { id: string; group: string; kind: FlyerFontKind; weight: number; size: number; x: number; y: number; width: number; fill: string; anchor: Anchor }

// Blocks of printed lines: [slot prefix, group label, line count, font, size, weight, x, first baseline, line height, width, colour, anchor?]
type Block = [string, string, number, FlyerFontKind, number, number, number, number, number, number, string, Anchor?]
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

// v4 follows the original draft's bands: header, full-bleed hero, a steps
// strip, "Everybody wins" cards, a black call to action and the partners.
const V4 = { ink: '#0E1013', mute: '#59626B', line: '#CBD3DB', blue: '#5E7F9C', gold: '#EFB719', mist: '#EEF1F4', body: '#2E3841' }
function blocksV4(): Block[] {
  return [
    ['org', 'Organization', 1, 'display', 15, 800, 110, 36, 0, 250, V4.ink],
    ['district', 'Supporting line', 2, 'display', 7.5, 700, 534, 27, 10, 150, V4.mute, 'end'],
    ['eyebrow', 'Banner', 1, 'display', 8, 700, 62, 97, 0, 400, V4.gold],
    ['headline', 'Headline', 2, 'display', 42, 800, 36, 150, 41, 540, '#FFFFFF'],
    ['highlight', 'Highlighted headline', 1, 'display', 42, 800, 36, 232, 0, 540, V4.gold],
    ['intro', 'Introduction', 3, 'sans', 11, 400, 36, 266, 16, 470, '#D6DCE3'],
    ...[0, 1, 2].flatMap(i => [
      [`step${i + 1}-title`, `Step ${i + 1} title`, 1, 'display', 11.5, 800, 82 + i * 186, 373, 0, 128, V4.ink],
      [`step${i + 1}-body`, `Step ${i + 1} description`, 1, 'sans', 8.5, 400, 82 + i * 186, 388, 0, 128, V4.mute],
    ] as Block[]),
    ['benefits', 'Benefits heading', 1, 'display', 13.5, 800, 36, 440, 0, 540, V4.ink],
    ['business-title', 'Business card title', 1, 'display', 10.5, 800, 64, 476, 0, 134, '#FFFFFF'],
    ['business', 'Business benefits', 3, 'sans', 9, 400, 58, 503, 20, 142, V4.body],
    ['families-title', 'Families card title', 1, 'display', 10.5, 800, 248, 476, 0, 134, V4.ink],
    ['families', 'Family benefits', 3, 'sans', 9, 400, 242, 503, 20, 142, V4.body],
    ['third-title', 'Third card title', 1, 'display', 10.5, 800, 432, 476, 0, 134, V4.ink],
    ['third', 'Third card benefits', 3, 'sans', 9, 400, 426, 503, 20, 142, V4.body],
    ['scan', 'QR caption', 1, 'display', 7.5, 700, 78, 694, 0, 84, '#94A2AF', 'middle'],
    ['cta', 'Call to action', 2, 'display', 15.5, 800, 142, 614, 18.5, 420, '#FFFFFF'],
    ['email-label', 'Email label', 1, 'display', 7, 700, 157, 655, 0, 120, V4.gold],
    ['phone-label', 'Phone label', 1, 'display', 7, 700, 300, 655, 0, 100, V4.gold],
    ['booking-label', 'Booking label', 1, 'display', 7, 700, 425, 655, 0, 140, V4.gold],
    ['email', 'Email', 1, 'sans', 11.5, 700, 142, 672, 0, 140, '#FFFFFF'],
    ['phone', 'Phone', 1, 'sans', 11.5, 700, 285, 672, 0, 120, '#FFFFFF'],
    ['booking', 'Booking address', 1, 'sans', 11.5, 700, 410, 672, 0, 166, '#FFFFFF'],
    ['cta-note', 'Call to action note', 1, 'sans', 8.5, 400, 142, 692, 0, 434, '#A3B0BC'],
    ['host-label', 'Host label', 1, 'display', 7, 700, 36, 722, 0, 240, V4.mute],
    ['host-name', 'Host name', 1, 'display', 12, 800, 94, 739, 0, 180, '#282828'],
    ['host-title', 'Host title', 1, 'sans', 8.5, 700, 94, 753, 0, 180, '#111111'],
    ['host-org', 'Host organization', 1, 'sans', 8.5, 700, 94, 763, 0, 180, '#3D5A73'],
    ['host-contact', 'Host contact', 1, 'sans', 8.5, 400, 94, 773, 0, 196, V4.mute],
    ['presenter-label', 'Presenter label', 1, 'display', 7, 700, 312, 722, 0, 150, V4.mute],
    ['presenter-name', 'Presenter name', 1, 'display', 12, 800, 312, 739, 0, 150, '#0A3F96'],
    ['presenter-title', 'Presenter title', 1, 'sans', 8.5, 700, 312, 753, 0, 150, '#111111'],
    ['presenter-org', 'Presenter organization', 1, 'sans', 8.5, 700, 312, 763, 0, 150, '#1E4B9B'],
    ['tagline', 'Tagline', 1, 'sans', 8.5, 400, 576, 773, 0, 110, V4.mute, 'end'],
  ]
}

function blocksV5(): Block[] {
  const changes: Record<string, Partial<Record<'size' | 'y' | 'fill' | 'width', number | string>>> = {
    district: { size: 8, fill: '#3D5A73' },
    'step1-body': { size: 9.5, y: 389 }, 'step2-body': { size: 9.5, y: 389 }, 'step3-body': { size: 9.5, y: 389 },
    business: { size: 9.5 }, families: { size: 9.5 }, third: { size: 9.5 },
    scan: { y: 700 },
  }
  return blocksV4().flatMap(block => {
    const [key] = block
    // The hero paragraph becomes a bold lead line and two lighter lines.
    if (key === 'intro') return [
      ['lead', 'Lead line', 1, 'display', 12, 700, 36, 266, 0, 520, '#FFFFFF'],
      ['intro', 'Introduction', 2, 'sans', 10.5, 400, 36, 285, 15, 500, '#D6DCE3'],
    ] as Block[]
    const change = changes[key]
    if (!change) return [block]
    const next = [...block] as Block
    if (change.size !== undefined) next[4] = change.size as number
    if (change.y !== undefined) next[7] = change.y as number
    if (change.fill !== undefined) next[10] = change.fill as string
    return [next]
  })
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
  if (version === 'v4') return defaultCopyV4(cause)
  if (version === 'v5') return defaultCopyV5(cause)
  const copy = defaultCopyV2(cause)
  // v3 keeps one call to action: the QR books the call; contacts follow quietly.
  return version === 'v3' ? { ...copy, eyebrow: 'FOR LOCAL BUSINESSES', cta: 'Let’s plan your first GiveBack Day', scan: 'Scan the code to book a 15-minute call',
    phone: 'Text 480-463-4632', 'presenter-title': 'Founder & CEO, LocalVIP' } : copy
}

// The original draft's words, generalized for any cause; outcome claims are
// softened ("helps fill", "qualifying sales") rather than promised.
function defaultCopyV4(cause: GivebackCause): Record<string, string | string[]> {
  const v2 = defaultCopyV2(cause)
  const city = titleCase(cause.city)
  const area = cause.city.trim() ? city : 'local'
  const CITY = (cause.city.trim() ? city : 'Local').toUpperCase()
  const parent = cause.parentOrganization?.trim()
  const senders = parent ? `every school, booster club and PTO in ${parent}` : cause.schoolFocused ? 'local schools, booster clubs and PTOs' : cause.name.trim()
  return {
    ...v2,
    org: cause.name.trim().toUpperCase(),
    district: parent ? ['SUPPORTING EVERY SCHOOL IN', parent.toUpperCase()] : [`${CITY} GIVEBACK DAYS`, cause.schoolFocused ? 'SUPPORTING LOCAL SCHOOLS' : 'SUPPORTING OUR COMMUNITY'],
    eyebrow: `${CITY} GIVEBACK DAYS · FOR LOCAL BUSINESSES`,
    headline: ['YOUR BUSINESS.', 'OUR COMMUNITY.'],
    highlight: 'LET’S WIN TOGETHER.',
    intro: `When ${area} families win, local businesses win. Pick the days you want busier, and ${senders} can invite families to you. You give back like a spirit night, with no receipts to collect.`,
    'step1-title': 'PICK YOUR DAY', 'step1-body': 'Weekly, monthly, your call',
    'step2-title': 'WE INVITE FAMILIES', 'step2-body': `${city ? `${city} families` : 'Local families'} hear about it`,
    'step3-title': 'IT ALL ADDS UP', 'step3-body': 'Tracked on qualifying sales',
    benefits: 'EVERYBODY WINS.',
    'business-title': 'Your Business', business: ['Helps fill your slower days', 'Local families, not coupon hunters', 'Zero upfront or monthly fees'],
    'families-title': `${city || 'Local'} Families`, families: [cause.schoolFocused ? 'Support schools as they shop' : 'Support a cause as they shop', 'Cash back on Giveback Days', 'At places they already love'],
    'third-title': cause.schoolFocused ? `${city || 'Local'} Schools` : 'Our Cause',
    third: cause.schoolFocused ? [parent ? 'Every school, club and PTO' : 'Schools, clubs and PTOs', 'Giveback on qualifying sales', 'Year-round, not one night'] : ['Giveback on qualifying sales', 'Year-round, not one night', 'Real local impact'],
    scan: 'SCAN TO BOOK 15 MIN',
    cta: ['LET’S PLAN YOUR FIRST', `${CITY} GIVEBACK DAY`],
    'email-label': 'EMAIL', 'phone-label': 'OR TEXT', 'booking-label': 'OR BOOK A CALL',
    'cta-note': '15 minutes to see what it looks like for your business. Zero upfront costs. Zero monthly fees.',
    'host-label': 'BROUGHT TO YOU BY', 'host-name': String(v2['host-name']).toUpperCase(),
    'presenter-label': 'POWERED BY', 'presenter-name': 'RICK SWANSON',
  }
}

function defaultCopyV5(cause: GivebackCause): Record<string, string | string[]> {
  const v4 = defaultCopyV4(cause)
  const area = cause.city.trim() ? titleCase(cause.city) : 'local'
  const parent = cause.parentOrganization?.trim()
  const senders = parent ? `every school, booster club and PTO in ${parent}` : cause.schoolFocused ? 'local schools, booster clubs and PTOs' : cause.name.trim()
  return {
    ...v4,
    lead: `When ${area} families win, local businesses win.`,
    intro: `Pick the days you want busier, and ${senders} can invite families to you. You give back like a spirit night, with no receipts to collect.`,
    // "Zero upfront or monthly fees" lives on the business card; say it once.
    'cta-note': '15 minutes to see what GiveBack Days could look like for your business.',
  }
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

function lines(cause: GivebackCause, version: Exclude<GivebackVersion, 'v6'>) {
  const copy = defaultCopy(cause, version)
  const table = version === 'v5' ? blocksV5() : version === 'v4' ? blocksV4() : (version === 'v3' ? blocksV3 : blocks)(givebackDistrictLogo(cause))
  return table.flatMap(([key, group, count, kind, size, weight, x, y, step, width, fill, anchor = 'start']) => {
    const value = copy[key]
    const texts = Array.isArray(value) ? value : count > 1 ? wrapInto(value, count, width, kind, weight, size) : [value]
    return texts.map((text, index) => ({ line: { id: `${key}.${index + 1}`, group, kind, weight, size, x, y: +(y + index * step).toFixed(2), width, fill, anchor } as Line, text, index }))
  })
}

const lineLimit = (value: string) => Math.min(160, Math.max(24, Math.ceil(value.length * 1.5)))

/** Every editable line with its default for this cause, plus the two image slots. */
export function givebackSlots(cause: GivebackCause, logoUrl: string, coverUrl: string, version: GivebackVersion = 'v2'): FlyerSlots {
  if (version === 'v6') return { text: draftSlots(cause), images: [{ id: 'logo', label: 'Cause logo', default: logoUrl }, { id: 'photo', label: 'Hero photo', default: coverUrl }] }
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
  const colour = (fill: string) => rgb(parseInt(fill.slice(1, 3), 16) / 255, parseInt(fill.slice(3, 5), 16) / 255, parseInt(fill.slice(5, 7), 16) / 255)
  for (const [, attrs, content] of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const read = (source: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(source)?.[1]
    const family = read(attrs, 'class') === 'display' ? 'Montserrat' : 'Open Sans'
    // A line is one or more runs (a <tspan> may set its own weight or colour)
    // with any text between them, such as the space that separates two runs.
    const runs = [...content.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>|([^<]+)/g)].map(([, runAttrs = '', inner, between]) => {
      const font = fonts.get(`${family}:${read(runAttrs, 'font-weight') || read(attrs, 'font-weight') || 400}`)
      const fill = read(runAttrs, 'fill') || read(attrs, 'fill') || INK
      if (!font || !/^#[\da-f]{6}$/i.test(fill)) throw new Error('Unsupported GiveBack flyer text style.')
      return { text: unesc(inner ?? between ?? ''), font, fill }
    }).filter(run => run.text)
    if (!runs.some(run => run.text.trim())) continue
    const spacing = Number(read(attrs, 'letter-spacing') || 0)
    let size = Number(read(attrs, 'font-size'))
    // Shape each run with the font's own layout (kerning included), as the
    // browser and resvg do, then place glyph by glyph with any letter-spacing.
    const shaped = runs.map(run => {
      const face = (run.font as unknown as { embedder: { font: { unitsPerEm: number; layout: (text: string) => { glyphs: { codePoints: number[] }[]; positions: { xAdvance: number }[] } } } }).embedder.font
      const layout = face.layout(run.text)
      return { ...run, glyphs: layout.glyphs.map((glyph, index) => ({ text: String.fromCodePoint(...glyph.codePoints), advance: layout.positions[index].xAdvance / face.unitsPerEm })) }
    })
    const widthAt = (at: number) => shaped.reduce((sum, run) => sum + run.glyphs.reduce((total, glyph) => total + glyph.advance * at + spacing * [...glyph.text].length, 0), 0)
    // A condensed line (textLength) prints at the size that fits its width.
    const length = Number(read(attrs, 'textLength'))
    if (length) size = Math.min(size, size * length / widthAt(size))
    const anchor = read(attrs, 'text-anchor')
    let x = Number(read(attrs, 'x')) - (anchor === 'end' ? widthAt(size) : anchor === 'middle' ? widthAt(size) / 2 : 0)
    const y = 792 - Number(read(attrs, 'y'))
    for (const run of shaped) {
      for (const glyph of run.glyphs) {
        if (glyph.text.trim()) page.drawText(glyph.text, { x, y, size, font: run.font, color: colour(run.fill) })
        x += glyph.advance * size + spacing * [...glyph.text].length
      }
    }
  }
  return pdf.save()
}

// ---- v6: the original draft, exactly --------------------------------------
// Positions, sizes, colours and letter-spacing are measured from "Fathers
// Club Business Flyer DRAFT.pdf" (flyer.py at 8.5 x 11 in). Lines may hold
// runs of different weight and colour, as the draft's introduction does.

type Run = { id: string; group: string; text: string; weight?: number; fill?: string }
type RichLine = { x: number; y: number; width: number; kind: FlyerFontKind; weight: number; size: number; fill: string; spacing: number; anchor: Anchor; runs: Run[] }
const DRAFT = { ink: '#0E1013', mute: '#59626B', line: '#CBD3DB', blue: '#5E7F9C', gold: '#EFB719', mist: '#EEF1F4', body: '#2E3841', white: '#FFFFFF' }
const DRAFT_CARD_TITLE_X = [46.1, 236, 417.53]
const DRAFT_BULLET_X = [58.34, 248.24, 429.76]

const runWidth = (text: string, kind: FlyerFontKind, weight: number, size: number, spacing: number) =>
  measureGiveback(text, kind, weight, size) + spacing * [...text].length

function draftCopy(cause: GivebackCause) {
  const city = titleCase(cause.city)
  const area = cause.city.trim() ? city : 'local'
  const CITY = (cause.city.trim() ? city : 'Local').toUpperCase()
  const parent = cause.parentOrganization?.trim()
  const owner = cause.owner || {}
  const senders = parent ? `every school, booster club and PTO in ${parent}` : cause.schoolFocused ? 'every local school, booster club and PTO' : cause.name.trim()
  return {
    org: cause.name.trim().toUpperCase(),
    district: parent ? ['SUPPORTING EVERY SCHOOL IN', parent.toUpperCase()] : cause.schoolFocused ? ['SUPPORTING LOCAL SCHOOLS', `ACROSS ${CITY}`] : ['SUPPORTING OUR', 'LOCAL COMMUNITY'],
    eyebrow: `${CITY} GIVEBACK DAYS · FOR LOCAL BUSINESSES`,
    headline: ['YOUR BUSINESS.', 'OUR COMMUNITY.'], highlight: "LET'S WIN TOGETHER.",
    intro: [
      { text: `When ${area} families win, local businesses win.`, bold: false },
      { text: `Pick the days you want busier, and ${senders} can send its families to you.`, bold: true },
      { text: 'You give back like a spirit night, with no receipts to collect.', bold: false },
    ],
    steps: [['PICK YOUR DAY', 'Weekly, monthly, your call'], ['WE BRING FAMILIES', `${city || 'Local'} families show up`], ['IT ALL ADDS UP', 'Tracked on qualifying sales']],
    benefits: 'EVERYBODY WINS...',
    cards: [
      ['Your Business', ['Built for your slower days', 'Local families, not coupon hunters', 'Zero upfront or monthly fees']],
      [`${city || 'Local'} Families`, [cause.schoolFocused ? 'Support schools as they shop' : 'Support a cause as they shop', 'Cash back on Giveback Days', 'At places they already love']],
      cause.schoolFocused
        ? [`${city || 'Local'} Schools`, [parent ? 'Every school, club and PTO' : 'Schools, clubs and PTOs', 'Giveback sent automatically', 'Year-round, not one night']]
        : ['Our Cause', ['Giveback sent automatically', 'Year-round, not one night', 'Real local impact']],
    ] as [string, string[]][],
    scan: 'SCAN TO BOOK 15 MIN',
    cta: ["LET'S PLAN YOUR FIRST", `${CITY} GIVEBACK DAY`],
    contact: [['EMAIL', 'rick@localvip.com'], ['OR TEXT', '480-463-4632'], ['OR BOOK A CALL', 'calendly.com/30vip']],
    note: '15 minutes to see what it looks like for your business. Zero upfront costs. Zero monthly fees.',
    host: ['BROUGHT TO YOU BY', (owner.name?.trim() || cause.name.trim()).toUpperCase(), owner.name?.trim() ? 'Organizer' : '', owner.name?.trim() ? cause.name.trim() : '',
      [owner.email?.trim(), owner.phone?.trim()].filter(Boolean).join(' · ')],
    presenter: ['POWERED BY', 'RICK SWANSON', 'Founder & CEO', 'LocalVIP'],
    tagline: 'Generosity pays.',
  }
}

/** The draft's introduction: bold and regular passages wrapped together into lines of runs. */
function draftIntroLines(segments: { text: string; bold: boolean }[]) {
  const width = 464.4, size = 10.99
  const words = segments.flatMap(segment => segment.text.split(/\s+/).filter(Boolean).map(word => ({ word, bold: segment.bold })))
  const lines: { word: string; bold: boolean }[][] = [[]]
  const lineWidth = (line: { word: string; bold: boolean }[]) => line.reduce((sum, item, index) =>
    sum + measureGiveback((index ? ' ' : '') + item.word, 'sans', item.bold ? 700 : 400, size), 0)
  for (const item of words) {
    const current = lines[lines.length - 1]
    if (current.length && lineWidth([...current, item]) > width) lines.push([item])
    else current.push(item)
  }
  // Consecutive words of one weight form a run.
  return lines.map(line => line.reduce<{ text: string; bold: boolean }[]>((runs, item) => {
    const last = runs[runs.length - 1]
    if (last && last.bold === item.bold) last.text += ` ${item.word}`
    else runs.push({ text: item.word, bold: item.bold })
    return runs
  }, []))
}

function draftLines(cause: GivebackCause): RichLine[] {
  const copy = draftCopy(cause)
  const one = (id: string, group: string, text: string, x: number, y: number, width: number, kind: FlyerFontKind, weight: number, size: number, fill: string, em = 0, anchor: Anchor = 'start'): RichLine =>
    ({ x, y, width, kind, weight, size, fill, spacing: +(em * size).toFixed(3), anchor, runs: [{ id, group, text }] })
  const introBaselines = [273, 289.5, 305.25]
  let introRun = 0
  const intro = draftIntroLines(copy.intro).map((runs, index): RichLine => ({
    x: 36, y: introBaselines[index] ?? 305.25 + (index - 2) * 15.95, width: 470, kind: 'sans', weight: 400, size: 10.99, fill: '#D6DCE3', spacing: 0, anchor: 'start',
    runs: runs.map(run => ({ id: `intro.${++introRun}`, group: 'Introduction', text: run.text, ...(run.bold ? { weight: 700, fill: DRAFT.white } : {}) })),
  }))
  return [
    one('org.1', 'Organization', copy.org, 102.27, 33, 250, 'display', 800, 15, DRAFT.ink, -0.01),
    one('district.1', 'Supporting line', copy.district[0], 541.02, 25.5, 160, 'sans', 700, 7.5, DRAFT.mute, 0.1, 'end'),
    one('district.2', 'Supporting line', copy.district[1], 541.02, 36.75, 160, 'sans', 700, 7.5, DRAFT.mute, 0.1, 'end'),
    one('eyebrow.1', 'Banner', copy.eyebrow, 44.64, 102.75, 263, 'display', 700, 7.99, DRAFT.ink, 0.14),
    one('headline.1', 'Headline', copy.headline[0], 36, 156, 540, 'display', 800, 43.99, DRAFT.white, -0.024),
    one('headline.2', 'Headline', copy.headline[1], 36, 198.75, 540, 'display', 800, 43.99, DRAFT.white, -0.024),
    one('highlight.1', 'Highlighted headline', copy.highlight, 36, 242.25, 540, 'display', 800, 43.99, DRAFT.gold, -0.024),
    ...intro,
    ...copy.steps.flatMap(([title, body], i) => [
      one(`step${i + 1}-title.1`, `Step ${i + 1} title`, title, [70.34, 263.19, 452.19][i], 372.75, 140, 'display', 800, 11.5, DRAFT.ink, -0.01),
      one(`step${i + 1}-body.1`, `Step ${i + 1} description`, body, [70.34, 263.19, 452.19][i], 385.5, 140, 'sans', 400, 7.99, DRAFT.mute),
    ]),
    one('benefits.1', 'Benefits heading', copy.benefits, 36, 440.25, 540, 'display', 800, 13.5, DRAFT.ink, -0.012),
    ...copy.cards.flatMap(([title, rows], i) => {
      const key = ['business', 'families', 'third'][i]
      const label = ['Business', 'Families', 'Third'][i]
      return [
        one(`${key}-title.1`, `${label} card title`, title, DRAFT_CARD_TITLE_X[i], 479.25, 120, 'display', 800, 10.5, DRAFT.ink, -0.01),
        ...rows.map((row, r) => one(`${key}.${r + 1}`, `${label} benefits`, row, DRAFT_BULLET_X[i], [508.5, 528, 547.5][r], 148, 'sans', 400, 9, DRAFT.body)),
      ]
    }),
    one('scan.1', 'QR caption', copy.scan, 76.5, 688.5, 90, 'display', 700, 6.2, '#94A2AF', 0.08, 'middle'),
    one('cta.1', 'Call to action', copy.cta[0], 137.02, 612.75, 430, 'display', 800, 15.49, DRAFT.white, -0.015),
    one('cta.2', 'Call to action', copy.cta[1], 137.02, 630.75, 430, 'display', 800, 15.49, DRAFT.white, -0.015),
    ...copy.contact.flatMap(([label, value], i) => {
      const key = ['email', 'phone', 'booking'][i]
      const x = [137.02, 265.48, 363.08][i], width = [122, 92, 213][i]
      return [
        one(`${key}-label.1`, `${['Email', 'Phone', 'Booking'][i]} label`, label, x, 649.5, width, 'display', 700, 7, DRAFT.gold, 0.1),
        one(`${key}.1`, ['Email', 'Phone', 'Booking address'][i], value, x, 665.25, width, 'sans', 700, 11.5, DRAFT.white),
      ]
    }),
    one('cta-note.1', 'Call to action note', copy.note, 137.02, 687, 439, 'sans', 400, 8.5, '#A3B0BC'),
    one('host-label.1', 'Host label', copy.host[0], 36, 722.25, 240, 'display', 700, 6.49, DRAFT.mute, 0.12),
    one('host-name.1', 'Host name', copy.host[1], 101, 740.25, 155, 'display', 800, 12, '#282828', -0.005),
    one('host-title.1', 'Host title', copy.host[2], 101, 756, 180, 'sans', 700, 7.5, '#111111'),
    one('host-org.1', 'Host organization', copy.host[3], 101, 765.75, 180, 'sans', 700, 7.5, '#3D5A73'),
    one('host-contact.1', 'Host contact', copy.host[4], 101, 777, 190, 'sans', 400, 7.5, DRAFT.mute),
    one('presenter-label.1', 'Presenter label', copy.presenter[0], 298.45, 722.25, 150, 'display', 700, 6.49, DRAFT.mute, 0.12),
    one('presenter-name.1', 'Presenter name', copy.presenter[1], 341.99, 742.5, 140, 'display', 800, 12, '#0A3F96', -0.005),
    one('presenter-title.1', 'Presenter title', copy.presenter[2], 341.99, 758.25, 140, 'sans', 700, 7.5, '#111111'),
    one('presenter-org.1', 'Presenter organization', copy.presenter[3], 341.99, 768, 140, 'sans', 700, 7.5, '#1E4B9B'),
    one('tagline.1', 'Tagline', copy.tagline, 576, 767.25, 90, 'sans', 400, 7, DRAFT.mute, 0, 'end'),
  ]
}

function draftSlots(cause: GivebackCause): FlyerTextSlot[] {
  const counts = new Map<string, number>()
  return draftLines(cause).flatMap(line => line.runs.map(run => {
    const index = (counts.get(run.group) || 0) + 1
    counts.set(run.group, index)
    return { id: run.id, group: run.group, line: index, default: run.text, maxLength: lineLimit(run.text) }
  }))
}

/** One draft line, its runs fitted together; returns the markup and its printed width. */
function draftText(line: RichLine, edits: Record<string, string>) {
  const runs = line.runs.map(run => ({ ...run, text: (edits[run.id] ?? run.text).trim() }))
  const widthAt = (size: number) => runs.reduce((sum, run, index) =>
    sum + runWidth(run.text, line.kind, run.weight || line.weight, size, line.spacing) + (index ? runWidth(' ', line.kind, line.weight, size, line.spacing) : 0), 0)
  const natural = widthAt(line.size)
  const size = natural > line.width ? Math.max(line.size * line.width / natural, line.size * .6) : line.size
  const condensed = natural * size / line.size > line.width + .5
  const markup = `<text class="${line.kind}" x="${line.x}" y="${line.y}" font-size="${+size.toFixed(2)}" font-weight="${line.weight}" fill="${line.fill}"`
    + (line.spacing ? ` letter-spacing="${line.spacing}"` : '') + (line.anchor === 'start' ? '' : ` text-anchor="${line.anchor}"`)
    + (condensed ? ` textLength="${line.width}" lengthAdjust="spacingAndGlyphs"` : '')
    + ` data-kind="${line.kind}" data-weight="${line.weight}" data-size="${line.size}" data-fit="${line.width}">`
    + runs.map(run => `<tspan data-slot="${run.id}"${run.weight ? ` font-weight="${run.weight}"` : ''}${run.fill ? ` fill="${run.fill}"` : ''}>${esc(run.text)}</tspan>`).join(' ')
    + '</text>'
  return { markup, width: widthAt(size) }
}

async function buildDraftSvg(input: { cause: GivebackCause; logo: string; photo: string; qr?: string; text?: Record<string, string> }) {
  const { readFile } = await import('node:fs/promises')
  const asset = async (name: string) => `data:image/png;base64,${(await readFile(path.join(ASSETS, name))).toString('base64')}`
  const [district, localvip, heart, pin] = await Promise.all(['ops-logo.png', 'localvip-logo.png', 'heart.png', 'pin.png'].map(asset))
  const edits = input.text || {}
  const lines = draftLines(input.cause)
  const printed = lines.map(line => draftText(line, edits))
  // Each card's heart follows its title, 0.06 in after the last letter.
  const hearts = [0, 1, 2].map(i => {
    const index = lines.findIndex(line => line.runs[0].id === `${['business', 'families', 'third'][i]}-title.1`)
    return `<image href="${heart}" x="${+(DRAFT_CARD_TITLE_X[i] + printed[index].width + 4.32).toFixed(2)}" y="471" width="8.28" height="8.28"/>`
  }).join('')
  const card = (x: number, width: number) => `<rect x="${x}" y="456.38" width="${width}" height="106.5" rx="5.25" fill="#FFFFFF" stroke="${DRAFT.line}" stroke-width=".75"/>`
    + `<rect x="${x + 9.37}" y="489" width="${width - 19.5}" height="1.5" fill="${DRAFT.line}"/>`
  const bullets = DRAFT_BULLET_X.flatMap(x => [505.875, 525, 544.5].map(y => `<circle cx="${x - 9.6}" cy="${y}" r="2.88" fill="${DRAFT.blue}"/>`)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="612" height="792" viewBox="0 0 612 792">
<defs><style>.display{font-family:Montserrat}.sans{font-family:'Open Sans'}</style></defs>
<rect width="612" height="792" fill="#FFFFFF"/>
<rect y="57" width="612" height="2.25" fill="${DRAFT.blue}"/><rect x="90" y="14.25" width="1.5" height="28.5" fill="${DRAFT.line}"/>
<image data-slot="logo" href="${input.logo}" x="36" y="9.8" width="43.5" height="37.5" preserveAspectRatio="xMidYMid meet"/>
${givebackDistrictLogo(input.cause) ? `<image href="${district}" x="547.5" y="12.8" width="28.5" height="31.4" preserveAspectRatio="xMidYMid meet"/>` : ''}
<rect y="59.25" width="612" height="280.5" fill="${DRAFT.ink}"/>
<image data-slot="photo" href="${input.photo}" x="0" y="59.25" width="612" height="280.5" preserveAspectRatio="xMidYMid slice"/>
<rect x="36" y="91.5" width="280.5" height="16.5" rx="1.5" fill="${DRAFT.gold}"/>
<rect y="339.75" width="612" height="72" fill="#FFFFFF"/><rect y="411" width="612" height=".75" fill="${DRAFT.line}"/>
<rect y="339.75" width="11.25" height="72" fill="${DRAFT.blue}"/>
<rect x="213.75" y="354.75" width=".75" height="41.25" fill="${DRAFT.line}"/><rect x="402.75" y="354.75" width=".75" height="41.25" fill="${DRAFT.line}"/>
${[41.48, 230.46, 419.44].map((x, i) => `<text class="display" x="${x}" y="381.75" font-size="19.99" font-weight="800" fill="${DRAFT.blue}">0${i + 1}</text>`).join('')}
<rect y="411.75" width="612" height="168" fill="${DRAFT.mist}"/>
${card(36.38, 176.24)}${card(226.12, 168)}${card(407.62, 168)}
${bullets}${hearts}
<rect y="579.75" width="612" height="126" fill="${DRAFT.ink}"/><rect y="579.75" width="612" height="3" fill="${DRAFT.gold}"/>
<rect x="36" y="597.75" width="81" height="81" rx="3.75" fill="#FFFFFF"/>
${input.qr ? `<image href="${input.qr}" x="39.75" y="601.5" width="73.5" height="73.5"/>` : ''}
<rect y="705.75" width="612" height=".75" fill="${DRAFT.line}"/>
<image data-slot="logo" href="${input.logo}" x="36" y="732.8" width="49.5" height="43.4" preserveAspectRatio="xMidYMid meet"/>
<rect x="91.5" y="732.75" width="1.5" height="43.5" fill="${DRAFT.ink}"/><rect x="101.25" y="744.75" width="154.5" height=".75" fill="${DRAFT.blue}"/>
<image href="${pin}" x="298.5" y="729" width="28.5" height="43.5" preserveAspectRatio="xMidYMid meet"/>
<rect x="332.25" y="729" width="1.5" height="43.5" fill="${DRAFT.ink}"/><rect x="342" y="747" width="102" height=".75" fill="#1A3E7E"/>
<image href="${localvip}" x="486" y="738" width="90" height="18" preserveAspectRatio="xMidYMid meet"/>
${printed.map(item => item.markup).join('\n')}
</svg>`
}

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)
// Lucide icons as SVG markup. Written by hand rather than with
// react-dom/server's renderToStaticMarkup: Next.js refuses to build any route
// that pulls react-dom/server into its server graph, and this module is reached
// from the flyer API route. The output is byte-for-byte what
// renderToStaticMarkup produced (scripts/giveback-flyer.test.ts checks it).
type IconNode = Array<[string, Record<string, string | number>]>
const iconNode = (component: LucideIcon): { node: IconNode; className: string } => {
  // lucide-react icons are forwardRef components whose render returns the
  // shared <Icon> element carrying the icon's path data as `iconNode`.
  const element = (component as unknown as { render: (props: object, ref: null) => { props: { iconNode: IconNode; className: string } } }).render({}, null)
  return { node: element.props.iconNode, className: element.props.className }
}
const icon = (component: LucideIcon, x: number, y: number, size = 18, color = STEEL, strokeWidth = 1.5) => {
  const { node, className } = iconNode(component)
  const children = node.map(([tag, attrs]) =>
    `<${tag}${Object.entries(attrs).filter(([key]) => key !== 'key').map(([key, value]) => ` ${key}="${esc(String(value))}"`).join('')}></${tag}>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${esc(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="lucide ${className}" x="${x}" y="${y}">${children}</svg>`
}
/** Exported for the byte-for-byte check against renderToStaticMarkup. */
export { icon as givebackIconSvg }

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

// v4: the draft's bands, sharpened. The photo runs full bleed under a
// directional fade (ink behind the copy, the people left visible) and the
// hero's lower edge is cut at an angle into the steps strip.
function artworkV4({ logo, photo, qr, district, localvip, schoolFocused }: Art, refined = false) {
  const card = (i: number, symbol: LucideIcon, lead: boolean) => {
    const x = 36 + i * 184
    return `<rect x="${x}" y="458" width="172" height="108" rx="6" fill="#FFFFFF" stroke="${V4.line}" stroke-width=".75"/>`
      + `<path d="M${x} 486V464a6 6 0 0 1 6-6h160a6 6 0 0 1 6 6v22z" fill="${lead ? V4.blue : '#E3E9EF'}"/>`
      + icon(symbol, x + 10, 465, 14, lead ? '#FFFFFF' : V4.blue, 2)
      + [0, 1, 2].map(row => icon(Check, x + 9, 495 + row * 20, 11, V4.blue, 2.5)).join('')
  }
  const step = (i: number) => {
    const x = 46 + i * 186
    return `<circle cx="${x + 14}" cy="377" r="14" fill="${V4.blue}"/><text class="display" x="${x + 14}" y="381.5" font-size="12" font-weight="800" fill="#FFFFFF" text-anchor="middle">0${i + 1}</text>`
      + (i < 2 ? icon(ChevronRight, x + 170, 370, 14, V4.line, 2) : '')
  }
  return `<defs>
  <style>.display{font-family:Montserrat}.sans{font-family:'Open Sans'}</style>
  <linearGradient id="heroFade"><stop stop-color="${V4.ink}" stop-opacity=".94"/><stop offset=".45" stop-color="${V4.ink}" stop-opacity=".82"/><stop offset=".78" stop-color="${V4.ink}" stop-opacity=".38"/><stop offset="1" stop-color="${V4.ink}" stop-opacity=".22"/></linearGradient>
  <linearGradient id="heroFloor" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="${V4.ink}" stop-opacity="0"/><stop offset="1" stop-color="${V4.ink}" stop-opacity=".55"/></linearGradient>
  <clipPath id="heroCut"><path d="M0 59H612V322L0 340z"/></clipPath>
</defs>
<rect width="612" height="792" fill="#FFFFFF"/>
<image data-slot="logo" href="${logo}" x="36" y="11" width="52" height="37" preserveAspectRatio="xMidYMid meet"/>
<path d="M99 16v27" stroke="${V4.line}" stroke-width="1.5"/>
${district ? `<image href="${district}" x="544" y="12" width="32" height="35" preserveAspectRatio="xMidYMid meet"/>` : ''}
<rect y="56.5" width="612" height="2.5" fill="${V4.blue}"/>
<g clip-path="url(#heroCut)">
  <rect y="59" width="612" height="281" fill="${V4.ink}"/>
  <image data-slot="photo" href="${photo}" x="0" y="59" width="612" height="281" preserveAspectRatio="xMidYMid slice"/>
  <rect y="59" width="612" height="281" fill="url(#heroFade)"/><rect y="59" width="612" height="281" fill="url(#heroFloor)"/>
</g>
<rect x="36" y="93.5" width="18" height="2.5" fill="${V4.gold}"/>
<rect y="340" width="11.5" height="72" fill="${V4.blue}"/><path d="M0 412.5h612" stroke="${V4.line}" stroke-width=".75"/>
${[0, 1, 2].map(step).join('')}
<rect y="413" width="612" height="167" fill="${V4.mist}"/><rect x="36" y="447" width="28" height="2.5" fill="${V4.gold}"/>
${card(0, Store, true)}${card(1, Users, false)}${card(2, schoolFocused ? School : HeartHandshake, false)}
<rect y="580" width="612" height="126" fill="${V4.ink}"/><rect y="580" width="612" height="3.5" fill="${V4.gold}"/>
<rect x="36" y="598" width="84" height="84" rx="5" fill="#FFFFFF"/>
${qr ? `<image href="${qr}" x="40" y="602" width="76" height="76"/>` : ''}
${icon(Mail, 142, 646, 11, V4.gold, 2)}${icon(MessageSquare, 285, 646, 11, V4.gold, 2)}${icon(CalendarDays, 410, 646, 11, V4.gold, 2)}
${refined ? `<path d="M0 340L612 322" stroke="${V4.gold}" stroke-width="3"/>
<path d="M30 605v-12h12M126 605v-12h-12M30 675v12h12M126 675v12h-12" fill="none" stroke="${V4.gold}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M276 648v28M400 648v28" stroke="#2A3038" stroke-width="1"/>` : ''}
<image data-slot="logo" href="${logo}" x="36" y="729" width="46" height="42" preserveAspectRatio="xMidYMid meet"/>
<path d="M87 730v42" stroke="${V4.ink}" stroke-width="1.5"/>
<path d="M94 743.5h180" stroke="${V4.blue}" stroke-width=".75"/><path d="M312 743.5h150" stroke="#1A3E7E" stroke-width=".75"/>
<image href="${localvip}" x="470" y="732" width="106" height="24" preserveAspectRatio="xMaxYMid meet"/>`
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
  if (version === 'v6') return buildDraftSvg(input)
  const edits = input.text || {}
  const printed = lines(input.cause, version).map(({ line, text }) => {
    const value = (edits[line.id] ?? text).trim()
    const fit = fitFlyerLine(value, line.width, line.kind, line.weight, line.size, measureGiveback)
    return `<text class="${line.kind}" x="${line.x}" y="${line.y}" font-size="${+fit.size.toFixed(2)}" font-weight="${line.weight}" fill="${line.fill}"${line.anchor === 'start' ? '' : ` text-anchor="${line.anchor}"`}`
      + `${fit.textLength ? ` textLength="${fit.textLength}" lengthAdjust="spacingAndGlyphs"` : ''}`
      + ` data-kind="${line.kind}" data-weight="${line.weight}" data-size="${line.size}" data-fit="${line.width}"><tspan data-slot="${line.id}">${esc(value)}</tspan></text>`
  }).join('\n')
  const art = { logo: input.logo, photo: input.photo, qr: input.qr, localvip, schoolFocused: input.cause.schoolFocused, district: givebackDistrictLogo(input.cause) ? district : undefined }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="612" height="792" viewBox="0 0 612 792">
${version === 'v5' ? artworkV4(art, true) : version === 'v4' ? artworkV4(art) : version === 'v3' ? artworkV3(art) : artworkV2(art)}
${printed}
</svg>`
}
