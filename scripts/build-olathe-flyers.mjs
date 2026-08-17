/**
 * Olathe flyer templates - vector rebuild of the APPROVED design.
 *
 * This reproduces the existing 12th Man flyer layout (header lockup, the
 * two-panel "already know / what LocalVIP adds" comparison joined by a gold
 * arrow, the reassurance line, the dark CTA band with a blank QR zone, and the
 * three-item footer). It is deliberately NOT a new design: an earlier pass
 * replaced this layout with a generic one, which lost the work that had already
 * been approved.
 *
 * What changes from the original raster artwork, per request:
 *   - Right panel is "WHAT DOES LOCALVIP ADD" (was "HOW LOCALVIP HELPS IT
 *     GROW") and argues business gain: repeat visits, rewarding customers the
 *     business already has, reach through the network, and choosing a slower
 *     day to pull traffic into.
 *   - Audience-specific closes: business "Ongoing connection. More ways to
 *     win.", school "Your school. Our community. More ways to grow.", parent
 *     "Your family. Your school. More ways to make an impact."
 *   - Marks are placed as traced vector with NO white plate behind them. The
 *     raster originals were pasted on opaque #FFFFFF boxes that showed as
 *     rectangles against the #FBFBFB page.
 *   - The QR is a blank labelled zone; the campaign code is stamped in by the
 *     dashboard.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('public/templates/olathe')
const W = 1050
const H = 1500

function inlineMark(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const viewBox = source.match(/viewBox="([^"]+)"/)?.[1]
  const body = source.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/s, '')
  if (!viewBox) throw new Error(`${file} is missing a viewBox`)
  return { viewBox, body }
}
const owl = inlineMark('olathe-west-official.svg')
const district = inlineMark('olathe-public-schools-official.svg')

const esc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const NAVY = '#0f2444'
const GOLD = '#f5a623'
const INK = '#12294c'
const BODY = '#33465f'

/** Place a traced mark with no backing plate. */
function mark(m, x, y, size) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${m.viewBox}" preserveAspectRatio="xMidYMid meet">${m.body}</svg>`
}

function text(str, x, y, { size = 20, weight = 700, fill = INK, anchor = 'start', cls = 'sans', ls = 0, fit = 0 } = {}) {
  // fit: force this line to an exact width. Without it the line width depends on
  // whichever font the viewer happens to have, and the headline overflowed.
  const lock = fit ? ` textLength="${fit}" lengthAdjust="spacingAndGlyphs"` : ''
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}" font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${fill}"${lock}>${esc(str)}</text>`
}

function stack(linesArr, x, y, opts = {}) {
  const { gap = 30 } = opts
  return linesArr.map((l, i) => text(l, x, y + i * gap, opts)).join('\n')
}

// ── line-art glyphs, drawn in a 64x64 box ────────────────────────────────────
const G = {
  megaphone: '<path d="M12 30v8a3 3 0 0 0 3 3h5l4 12h7l-4-12h3l16 10V18L26 28h-11a3 3 0 0 0-3 3z"/><path d="M52 26c4 3 4 11 0 14"/>',
  bag: '<path d="M16 24h32l3 30H13z"/><path d="M24 24v-4a8 8 0 0 1 16 0v4"/>',
  trophy: '<path d="M20 14h24v14a12 12 0 0 1-24 0z"/><path d="M20 18h-6a8 8 0 0 0 8 8M44 18h6a8 8 0 0 1-8 8"/><path d="M32 40v8M22 52h20"/><path d="M32 20l2 4 4 .6-3 2.8.7 4.2-3.7-2-3.7 2 .7-4.2-3-2.8 4-.6z" fill="currentColor" stroke="none"/>',
  repeat: '<path d="M16 32a16 16 0 1 1 5 12"/><path d="M16 20v12h12"/>',
  customers: '<circle cx="24" cy="22" r="8"/><path d="M10 48c0-8 6-14 14-14s14 6 14 14"/><path d="M44 16l2.6 5.4L52 22l-4 3.9.9 5.6-4.9-2.7-4.9 2.7.9-5.6-4-3.9 5.4-.6z"/>',
  network: '<circle cx="32" cy="16" r="6"/><circle cx="14" cy="46" r="6"/><circle cx="50" cy="46" r="6"/><path d="M28 21L17 40M36 21l11 19M20 46h24"/>',
  calendar: '<rect x="12" y="16" width="40" height="36" rx="4"/><path d="M12 28h40M22 12v8M42 12v8"/><path d="M24 38h6M34 38h6"/>',
  storefront: '<path d="M14 28h36v24H14z"/><path d="M12 28l4-12h32l4 12"/><path d="M26 52V38h12v14"/>',
  heart: '<path d="M32 50S12 38 12 26a10 10 0 0 1 20-4 10 10 0 0 1 20 4c0 12-20 24-20 24z"/>',
  phone: '<rect x="20" y="10" width="24" height="44" rx="4"/><path d="M28 46h8"/>',
  play: '<circle cx="32" cy="32" r="18"/><path d="M27 23l16 9-16 9z" fill="currentColor" stroke="none"/>',
  badge: '<circle cx="32" cy="26" r="12"/><path d="M24 36l-4 16 12-6 12 6-4-16"/>',
}

function glyph(name, x, y, size = 64, color = INK, sw = 3) {
  const s = size / 64
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" color="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${G[name]}</g>`
}

// ── page furniture ───────────────────────────────────────────────────────────
function header({ m, org, sub }) {
  return `
  ${mark(m, 74, 28, 150)}
  ${stack(org, 250, 82, { size: 40, weight: 900, gap: 46 })}
  ${text(sub, 250, 172, { size: 22, weight: 800, fill: INK, ls: 0.4 })}
  <line x1="655" y1="40" x2="655" y2="176" stroke="#c9d4e2" stroke-width="3"/>
  <text x="700" y="104" class="sans" font-size="52" font-weight="900" fill="${INK}">LOCAL<tspan font-weight="400">VIP</tspan></text>
  ${text('POWERED BY LOCALVIP', 700, 142, { size: 19, weight: 700, fill: BODY, ls: 1 })}`
}

/** Navy-headed panel with a rounded top. */
function panel(x, y, w, h, title) {
  const titleLines = title.split('|')
  return `
  <path d="M${x} ${y + 18}a18 18 0 0 1 18-18h${w - 36}a18 18 0 0 1 18 18v72H${x}z" fill="${NAVY}"/>
  <path d="M${x} ${y + 90}h${w}v${h - 108}a18 18 0 0 1-18 18H${x + 18}a18 18 0 0 1-18-18z" fill="#fff"/>
  <path d="M${x} ${y + 90}h${w}v${h - 108}a18 18 0 0 1-18 18H${x + 18}a18 18 0 0 1-18-18z" fill="none" stroke="#dfe6ef" stroke-width="2"/>
  ${titleLines.map((t, i) => text(t, x + w / 2, y + (titleLines.length === 1 ? 56 : 40 + i * 32), { size: 25, weight: 900, fill: '#fff', anchor: 'middle' })).join('\n')}`
}

/** One icon + wrapped label row, with an optional connector arrow beneath. */
function stepRow(x, y, icon, labelLines, withArrow) {
  return `
  ${glyph(icon, x, y, 70, INK, 3.4)}
  ${stack(labelLines, x + 86, y + (labelLines.length === 1 ? 36 : 22), { size: 21, weight: 600, fill: BODY, gap: 28 })}
  ${withArrow ? `<g transform="translate(${x + 22} ${y + 70})" fill="#9fb0c4"><path d="M6 0h10v18h7L11 32 0 18h6z"/></g>` : ''}`
}

function keepGoingArrow(y, label) {
  return `
  <g transform="translate(468 ${y})">
    <path d="M0 18h56V0l40 38-40 38V56H0z" fill="${GOLD}"/>
    ${label.split('|').map((t, i) => text(t, 40, 32 + i * 26, { size: 20, weight: 900, fill: INK, anchor: 'middle' })).join('\n')}
  </g>`
}

function outcomeBox(x, y, w, linesArr) {
  const h = 40 + linesArr.length * 34
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#fff" stroke="${GOLD}" stroke-width="2.5"/>
  ${linesArr.map((t, i) => text(t, x + w / 2, y + 40 + i * 34, { size: 23, weight: 900, fill: INK, anchor: 'middle' })).join('\n')}`
}

function reassurance({ m, title, body }) {
  return `
  ${mark(m, 96, 1046, 108)}
  <line x1="236" y1="1050" x2="236" y2="1166" stroke="${GOLD}" stroke-width="3"/>
  ${text(title, 268, 1084, { size: 27, weight: 900 })}
  ${stack(body, 268, 1116, { size: 20, weight: 500, fill: BODY, gap: 28 })}`
}

/**
 * Dark CTA band. The QR zone is a blank square: its guide is inset so the
 * stamped code covers it completely rather than leaving a ring around the code.
 */
function ctaBand({ headline, rows, footnote }) {
  return `
  <rect x="0" y="1182" width="${W}" height="246" fill="${NAVY}"/>
  <g transform="translate(108 1216)">
    <rect x="-10" y="-10" width="174" height="216" rx="12" fill="none" stroke="${GOLD}" stroke-width="4"/>
    <rect width="154" height="154" fill="#fff"/>
    <rect x="6" y="6" width="142" height="142" rx="6" fill="#fff" stroke="${GOLD}" stroke-width="3" stroke-dasharray="9 7"/>
    ${text('PLACE QR', 77, 72, { size: 14, weight: 900, fill: '#8b6500', anchor: 'middle' })}
    ${text('CODE HERE', 77, 90, { size: 14, weight: 900, fill: '#8b6500', anchor: 'middle' })}
    <rect x="-10" y="162" width="174" height="44" rx="8" fill="${GOLD}"/>
    ${text('SCAN ME', 77, 192, { size: 21, weight: 900, fill: INK, anchor: 'middle' })}
  </g>
  <line x1="330" y1="1222" x2="330" y2="1400" stroke="#3a5170" stroke-width="2"/>
  ${headline.map((t, i) => text(t, 366, 1238 + i * 42, { size: 36, weight: 900, fill: '#fff', fit: 592 })).join('\n')}
  ${rows.map((r, i) => `
    ${glyph(r.icon, 366, 1302 + i * 44, 32, '#fff', 3)}
    ${text(r.label, 412, 1326 + i * 44, { size: 23, weight: 900, fill: '#fff' })}`).join('\n')}
  ${text(footnote, 366, 1408, { size: 19, weight: 900, fill: GOLD })}`
}

function footer(items) {
  const slot = W / items.length
  return `
  <rect x="0" y="1428" width="${W}" height="72" fill="#fff"/>
  <line x1="0" y1="1428" x2="${W}" y2="1428" stroke="#dfe6ef" stroke-width="2"/>
  ${items.map((it, i) => `
    ${glyph(it.icon, i * slot + 56, 1446, 38, INK, 3)}
    ${text(it.label, i * slot + 108, 1474, { size: 20, weight: 900, fill: INK })}
    ${i > 0 ? `<line x1="${i * slot + 10}" y1="1446" x2="${i * slot + 10}" y2="1486" stroke="#dfe6ef" stroke-width="2"/>` : ''}`).join('\n')}`
}

function page({ head, title, subtitle, leftTitle, leftSteps, rightTitle, rightSteps, arrowLabel, outcome, reassure, cta, foot }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title.join(' '))}">
  <defs><style>.sans{font-family:Inter,'Helvetica Neue',Arial,sans-serif}.cond{font-family:'Arial Narrow',Impact,Arial,sans-serif}</style></defs>
  <rect width="${W}" height="${H}" fill="#fbfbfb"/>
  ${header(head)}
  ${title.map((t, i) => text(t.text, W / 2, 268 + i * 74, { size: 66, weight: 900, cls: 'cond', anchor: 'middle', fill: INK, fit: t.fit })).join('\n')}
  <line x1="60" y1="408" x2="230" y2="408" stroke="${GOLD}" stroke-width="3"/>
  <line x1="${W - 230}" y1="408" x2="${W - 60}" y2="408" stroke="${GOLD}" stroke-width="3"/>
  ${text(subtitle, W / 2, 416, { size: 22, weight: 700, fill: BODY, anchor: 'middle', fit: 700 })}
  ${panel(40, 446, 430, 540, leftTitle)}
  ${leftSteps.map((s, i) => stepRow(76, 566 + i * 130, s.icon, s.lines, i < leftSteps.length - 1)).join('\n')}
  ${keepGoingArrow(676, arrowLabel)}
  ${panel(580, 446, 430, 540, rightTitle)}
  ${rightSteps.map((st, i) => `
    ${glyph(st.icon, 624 + i * 128, 560, 76, INK, 3.4)}
    ${st.lines.map((l, j) => text(l, 662 + i * 128, 672 + j * 26, { size: 19, weight: 600, fill: BODY, anchor: 'middle' })).join('\n')}`).join('\n')}
  <path d="M648 734h316" stroke="${GOLD}" stroke-width="2.5" fill="none"/>
  <path d="M806 734v16M798 744l8 10 8-10" stroke="${GOLD}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  ${outcomeBox(600, 782, 390, outcome)}
  ${reassurance(reassure)}
  ${ctaBand(cta)}
  ${footer(foot)}
  </svg>`
}

const business = page({
  head: { m: owl, org: ['OLATHE WEST', '12TH MAN'], sub: 'FOOTBALL BOOSTER CLUB' },
  title: [{ text: 'MAKE ONE GIVEBACK DAY', fit: 700 }, { text: 'THE START OF SOMETHING BIGGER.', fit: 900 }],
  subtitle: 'Bring in your community. Build relationships that can continue after the event.',
  leftTitle: 'THE GIVEBACK DAY|YOU ALREADY KNOW',
  leftSteps: [
    { icon: 'megaphone', lines: ['Olathe West', 'promotes your business'] },
    { icon: 'bag', lines: ['Our supporters', 'shop with you'] },
    { icon: 'trophy', lines: ['A successful', 'Giveback Day.'] },
  ],
  rightTitle: 'WHAT DOES|LOCALVIP ADD',
  rightSteps: [
    { icon: 'repeat', lines: ['Customers', 'come back'] },
    { icon: 'customers', lines: ['Reward the ones', 'you already have'] },
    { icon: 'network', lines: ['Reach the wider', 'local network'] },
  ],
  arrowLabel: 'KEEP IT|GOING',
  outcome: ['CHOOSE YOUR SLOWER DAY AND', 'GIVE PEOPLE A REASON TO', 'WALK IN WHEN YOU WANT THEM.'],
  reassure: {
    m: owl,
    title: 'NOTHING CHANGES ABOUT WHY WE DO THIS.',
    body: ['You’re still supporting Olathe West and helping our kids.',
      'LocalVIP simply makes the experience better for everyone',
      'involved and turns a single day into an ongoing connection.'],
  },
  cta: {
    headline: ['ONGOING CONNECTION.', 'MORE WAYS TO WIN.'],
    rows: [
      { icon: 'play', label: 'SCAN TO SEE THE 60-SECOND PLAN' },
      { icon: 'calendar', label: 'BOOK YOUR 15-MINUTE SETUP CALL' },
    ],
    footnote: 'CHOOSE A DATE. WE’LL HELP WITH THE REST.',
  },
  foot: [
    { icon: 'storefront', label: 'YOUR BUSINESS.' },
    { icon: 'customers', label: 'OUR COMMUNITY.' },
    { icon: 'trophy', label: 'MORE WAYS TO WIN.' },
  ],
})

const parent = page({
  head: { m: owl, org: ['OLATHE WEST', '12TH MAN'], sub: 'FOOTBALL BOOSTER CLUB' },
  title: [{ text: 'YOUR NEXT LOCAL PURCHASE', fit: 830 }, { text: 'CAN SUPPORT OLATHE WEST.', fit: 830 }],
  subtitle: 'Shop where you already shop. Help our community keep winning.',
  leftTitle: 'THE SUPPORT|YOU ALREADY GIVE',
  leftSteps: [
    { icon: 'storefront', lines: ['Choose a participating', 'local business'] },
    { icon: 'bag', lines: ['Shop, visit,', 'or book as usual'] },
    { icon: 'heart', lines: ['Support', 'Olathe West'] },
  ],
  rightTitle: 'WHAT DOES|LOCALVIP ADD',
  rightSteps: [
    { icon: 'phone', lines: ['Find local', 'businesses'] },
    { icon: 'customers', lines: ['Your family is', 'rewarded too'] },
    { icon: 'network', lines: ['Local businesses', 'grow too'] },
  ],
  arrowLabel: 'MAKE IT|COUNT',
  outcome: ['EVERYDAY CHOICES CAN CREATE', 'SUPPORT THAT CONTINUES', 'BEYOND ONE EVENT.'],
  reassure: {
    m: owl,
    title: 'NOTHING CHANGES ABOUT WHY WE SHOW UP.',
    body: ['You are still supporting Olathe West and helping our kids.',
      'LocalVIP simply makes it easier for everyday local choices',
      'to create more value for everyone.'],
  },
  cta: {
    headline: ['YOUR FAMILY. YOUR SCHOOL.', 'MORE WAYS TO MAKE AN IMPACT.'],
    rows: [
      { icon: 'storefront', label: 'FIND PARTICIPATING BUSINESSES' },
      { icon: 'customers', label: 'JOIN THE OLATHE WEST COMMUNITY' },
    ],
    footnote: 'ONE SCAN SHOWS YOU WHERE TO START.',
  },
  foot: [
    { icon: 'heart', label: 'YOUR FAMILY.' },
    { icon: 'customers', label: 'OUR COMMUNITY.' },
    { icon: 'trophy', label: 'MORE WAYS TO WIN.' },
  ],
})

const school = page({
  head: { m: district, org: ['OLATHE PUBLIC', 'SCHOOLS'], sub: 'COMMUNITY GIVEBACK' },
  title: [{ text: 'TURN COMMUNITY TRUST', fit: 720 }, { text: 'INTO REPEATABLE LOCAL SUPPORT.', fit: 900 }],
  subtitle: 'Start with one business and one Giveback Day. Build from there.',
  leftTitle: 'THE GIVEBACK MODEL|YOU KNOW',
  leftSteps: [
    { icon: 'storefront', lines: ['Choose a', 'local business'] },
    { icon: 'megaphone', lines: ['Invite your', 'community'] },
    { icon: 'trophy', lines: ['Create one successful', 'Giveback Day.'] },
  ],
  rightTitle: 'WHAT DOES|LOCALVIP ADD',
  rightSteps: [
    { icon: 'badge', lines: ['Your school', 'branding'] },
    { icon: 'network', lines: ['Supporters and', 'businesses'] },
    { icon: 'repeat', lines: ['Repeat without', 'rebuilding'] },
  ],
  arrowLabel: 'BUILD|ON IT',
  outcome: ['ONE TRUSTED EVENT CAN BECOME', 'AN ONGOING LOCAL', 'SUPPORT NETWORK.'],
  reassure: {
    m: district,
    title: 'YOU KEEP THE RELATIONSHIPS. WE ADD THE ENGINE.',
    body: ['Your school remains at the center. LocalVIP provides',
      'the tools, materials, and connections that make the program',
      'easier to launch and repeat.'],
  },
  cta: {
    headline: ['YOUR SCHOOL. OUR COMMUNITY.', 'MORE WAYS TO GROW.'],
    rows: [
      { icon: 'play', label: 'SCAN TO SEE THE 60-SECOND OLATHE WEST PILOT' },
      { icon: 'calendar', label: 'BOOK YOUR 15-MINUTE LAUNCH CALL' },
    ],
    footnote: 'ONE CONVERSATION CAN GET THE FIRST DAY MOVING.',
  },
  foot: [
    { icon: 'badge', label: 'YOUR SCHOOL.' },
    { icon: 'customers', label: 'OUR COMMUNITY.' },
    { icon: 'trophy', label: 'MORE WAYS TO GROW.' },
  ],
})

for (const [name, svg] of Object.entries({
  'business-giveback-template.svg': business,
  'parent-supporter-template.svg': parent,
  'school-outreach-template.svg': school,
})) {
  fs.writeFileSync(path.join(root, name), svg)
  console.log('Wrote', name)
}
