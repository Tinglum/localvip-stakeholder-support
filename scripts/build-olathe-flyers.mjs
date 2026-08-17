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


// The approved sheet is set in Bebas Neue (headlines, section headers, CTA) and
// Montserrat (supporting copy, labels, branding). Both are SIL OFL, so the font
// data ships INSIDE the SVG - which is the only way the flyer looks the same on
// a designer's machine, in a browser preview and in the printed output.
//
// Note this covers viewers only: @napi-rs/canvas IGNORES @font-face entirely
// (measured - a base64 face renders pixel-identical to specifying no font at
// all, the same silent drop it does with nested <image>). The render path
// registers the same files through GlobalFonts separately.
const FONT_DIR = path.join(root, 'fonts')
const fontFace = (family, file, weight) =>
  `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;` +
  `src:url(data:font/ttf;base64,${fs.readFileSync(path.join(FONT_DIR, file)).toString('base64')}) format('truetype');}`

const FONT_CSS = [
  fontFace('MontRegular', 'Montserrat-Regular.ttf', 400),
  fontFace('MontBold', 'Montserrat-Bold.ttf', 700),
  fontFace('MontXBold', 'Montserrat-ExtraBold.ttf', 800),
].join('')

const esc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const NAVY = '#12305c'
const GOLD = '#f7a81b'
const INK = '#12294c'
const BODY = '#2a3c55'

/** Place a traced mark with no backing plate. */
function mark(m, x, y, size) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${m.viewBox}" preserveAspectRatio="xMidYMid meet">${m.body}</svg>`
}

function text(str, x, y, { size = 20, weight = 700, fill = INK, anchor = 'start', cls = 'sans', ls = 0, fit = 0, ink = 0 } = {}) {
  // fit: force this line to an exact width. Without it the line width depends on
  // whichever font the viewer happens to have, and the headline overflowed.
  const lock = fit ? ` textLength="${fit}" lengthAdjust="spacingAndGlyphs"` : ''
  // ink: thicken the glyph by stroking it in its own colour. paint-order keeps
  // the stroke behind the fill so counters stay open.
  const heavy = ink ? ` stroke="${fill}" stroke-width="${ink}" stroke-linejoin="round" paint-order="stroke"` : ''
  const fam = cls === 'cond' ? "'MontXBold',Montserrat,Arial,sans-serif"
    : cls === 'sb' ? "'MontBold',Montserrat,Arial,sans-serif"
    : "'MontRegular',Montserrat,Arial,sans-serif"
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}" font-family="${fam}" font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${fill}"${lock}${heavy}>${esc(str)}</text>`
}

function stack(linesArr, x, y, opts = {}) {
  const { gap = 30 } = opts
  return linesArr.map((l, i) => text(l, x, y + i * gap, opts)).join('\n')
}

// ── line-art glyphs, drawn in a 64x64 box ────────────────────────────────────
const G = {
  megaphone: '<path d="M10 28v10a4 4 0 0 0 4 4h4l5 13h8l-5-13h2l18 11V14L28 26H14a4 4 0 0 0-4 4z"/><path d="M54 24c5 4 5 12 0 16"/>',
  bag: '<path d="M14 23h36l3 32H11z"/><path d="M23 23v-4a9 9 0 0 1 18 0v4"/>',
  trophy: '<path d="M19 12h26v15a13 13 0 0 1-26 0z"/><path d="M19 17h-7a9 9 0 0 0 9 9M45 17h7a9 9 0 0 1-9 9"/><path d="M32 40v9M21 53h22"/><path d="M32 18l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" fill="currentColor" stroke="none"/>',
  repeat: '<path d="M15 32a17 17 0 1 1 5 12"/><path d="M15 19v13h13"/>',
  customers: '<g fill="currentColor" stroke="none"><circle cx="32" cy="20" r="9"/><path d="M14 50c0-10 8-17 18-17s18 7 18 17z"/><circle cx="13" cy="26" r="7"/><circle cx="51" cy="26" r="7"/><path d="M2 46c0-7 5-11 11-11 2 0 4 .4 6 1-3 3-5 6-6 10zM62 46c0-7-5-11-11-11-2 0-4 .4-6 1 3 3 5 6 6 10z"/></g>',
  network: '<g fill="currentColor" stroke="none"><circle cx="32" cy="14" r="7"/><circle cx="13" cy="48" r="7"/><circle cx="51" cy="48" r="7"/></g><path d="M28 20L18 41M36 20l10 21M20 48h24" stroke-width="4"/>',
  chart: '<g fill="currentColor" stroke="none"><rect x="12" y="38" width="10" height="16"/><rect x="27" y="28" width="10" height="26"/><rect x="42" y="18" width="10" height="36"/></g><path d="M14 30l14-11 9 7 15-14" stroke-width="4"/><path d="M43 12h10v10" stroke-width="4"/>',
  calendar: '<rect x="11" y="15" width="42" height="38" rx="5"/><path d="M11 28h42M22 11v8M42 11v8"/><path d="M23 38h7M34 38h7"/>',
  storefront: '<path d="M13 27h38v26H13z"/><path d="M11 27l5-13h32l5 13"/><path d="M25 53V37h14v16"/>',
  heart: '<path d="M32 51S11 38 11 25.5A11 11 0 0 1 32 21a11 11 0 0 1 21 4.5C53 38 32 51 32 51z"/>',
  phone: '<rect x="19" y="9" width="26" height="46" rx="5"/><path d="M27 47h10"/>',
  play: '<circle cx="32" cy="32" r="19"/><path d="M26 22l18 10-18 10z" fill="currentColor" stroke="none"/>',
  badge: '<circle cx="32" cy="25" r="13"/><path d="M23 35l-5 18 14-7 14 7-5-18"/>',
}

function glyph(name, x, y, size = 64, color = INK, sw = 5) {
  const s = size / 64
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" color="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${G[name]}</g>`
}

// ── page furniture ───────────────────────────────────────────────────────────
function header({ m, org, sub }) {
  return `
  ${mark(m, 74, 28, 150)}
  ${stack(org, 250, 82, { size: 34, weight: 800, cls: 'cond', gap: 40 })}
  ${text(sub, 250, 172, { size: 19, weight: 800, cls: 'cond', fill: INK, ls: 0.4 })}
  <line x1="655" y1="40" x2="655" y2="176" stroke="#c9d4e2" stroke-width="3"/>
  <text x="700" y="104" font-size="46" font-weight="800" class="cond" font-family="'MontXBold',Montserrat,Arial,sans-serif" fill="${INK}">LOCAL<tspan font-weight="400">VIP</tspan></text>
  ${text('POWERED BY LOCALVIP', 700, 142, { size: 16, weight: 700, cls: 'sb', fill: BODY, ls: 1 })}`
}

/** Navy-headed panel with a rounded top. */
function panel(x, y, w, h, title) {
  const titleLines = title.split('|')
  return `
  <path d="M${x} ${y + 18}a18 18 0 0 1 18-18h${w - 36}a18 18 0 0 1 18 18v72H${x}z" fill="${NAVY}"/>
  <path d="M${x} ${y + 90}h${w}v${h - 108}a18 18 0 0 1-18 18H${x + 18}a18 18 0 0 1-18-18z" fill="#fff"/>
  <path d="M${x} ${y + 90}h${w}v${h - 108}a18 18 0 0 1-18 18H${x + 18}a18 18 0 0 1-18-18z" fill="none" stroke="#e8c37a" stroke-width="2.5"/>
  ${titleLines.map((t, i) => text(t, x + w / 2, y + (titleLines.length === 1 ? 56 : 40 + i * 32), { size: 23, weight: 800, cls: 'cond', fill: '#fff', anchor: 'middle' })).join('\n')}`
}

/** One icon + wrapped label row, with an optional connector arrow beneath. */
function stepRow(x, y, icon, labelLines, withArrow) {
  return `
  ${glyph(icon, x, y, 78, INK, 5)}
  ${stack(labelLines, x + 86, y + (labelLines.length === 1 ? 36 : 22), { size: 20, weight: 400, fill: BODY, gap: 27 })}
  ${withArrow ? `<g transform="translate(${x + 22} ${y + 70})" fill="#9fb0c4"><path d="M6 0h10v18h7L11 32 0 18h6z"/></g>` : ''}`
}

function keepGoingArrow(y, label) {
  return `
  <g transform="translate(468 ${y})">
    <path d="M0 18h56V0l40 38-40 38V56H0z" fill="${GOLD}"/>
    ${label.split('|').map((t, i) => text(t, 40, 32 + i * 26, { size: 18, weight: 800, cls: 'cond', fill: INK, anchor: 'middle' })).join('\n')}
  </g>`
}

function outcomeBox(x, y, w, linesArr) {
  const h = 40 + linesArr.length * 34
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#fff" stroke="${GOLD}" stroke-width="2.5"/>
  ${linesArr.map((t, i) => text(t, x + w / 2, y + 40 + i * 34, { size: 21, weight: 800, cls: 'cond', fill: INK, anchor: 'middle' })).join('\n')}`
}

function reassurance({ m, title, body }) {
  return `
  ${mark(m, 96, 1000, 112)}
  <line x1="240" y1="1004" x2="240" y2="1124" stroke="${GOLD}" stroke-width="3"/>
  ${text(title, 272, 1040, { size: 25, weight: 800, cls: 'cond' })}
  ${stack(body, 272, 1072, { size: 18, weight: 400, fill: BODY, gap: 25 })}`
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
    ${glyph('phone', 22, 168, 26, INK, 3)}
    ${text('SCAN ME', 88, 192, { size: 21, weight: 900, fill: INK, anchor: 'middle' })}
  </g>
  <line x1="330" y1="1222" x2="330" y2="1400" stroke="#3a5170" stroke-width="2"/>
  ${headline.map((t, i) => text(t, 366, 1238 + i * 42, { size: 38, weight: 800, cls: 'cond', fill: '#fff', fit: 560 })).join('\n')}
  ${rows.map((r, i) => `
    ${glyph(r.icon, 364, 1300 + i * 44, 36, '#fff', 4)}
    ${text(r.label, 412, 1326 + i * 44, { size: 21, weight: 800, cls: 'cond', fill: '#fff' })}`).join('\n')}
  ${text(footnote, 366, 1408, { size: 17, weight: 800, cls: 'cond', fill: GOLD })}`
}

function footer(items) {
  const slot = W / items.length
  return `
  <rect x="0" y="1428" width="${W}" height="72" fill="#fff"/>
  <line x1="0" y1="1428" x2="${W}" y2="1428" stroke="#dfe6ef" stroke-width="2"/>
  ${items.map((it, i) => `
    ${glyph(it.icon, i * slot + 52, 1442, 42, INK, 4.5)}
    ${text(it.label, i * slot + 106, 1474, { size: 18, weight: 800, cls: 'cond', fill: INK })}
    ${i > 0 ? `<line x1="${i * slot + 10}" y1="1446" x2="${i * slot + 10}" y2="1486" stroke="#dfe6ef" stroke-width="2"/>` : ''}`).join('\n')}`
}

function page({ head, title, subtitle, leftTitle, leftSteps, rightTitle, rightSteps, arrowLabel, outcome, reassure, cta, foot }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title.join(' '))}">
  <defs><style>${FONT_CSS}.sans{font-family:'MontRegular',Montserrat,Arial,sans-serif}.cond{font-family:'MontXBold',Montserrat,Arial,sans-serif}.sb{font-family:'MontBold',Montserrat,Arial,sans-serif}</style></defs>
  <rect width="${W}" height="${H}" fill="#fbfbfb"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="18" fill="none" stroke="#0b1c33" stroke-width="3"/>
  ${header(head)}
  ${title.map((t, i) => text(t.text, W / 2, 268 + i * 74, { size: 62, weight: 800, cls: 'cond', anchor: 'middle', fill: INK, fit: t.fit })).join('\n')}
  <line x1="60" y1="408" x2="230" y2="408" stroke="${GOLD}" stroke-width="3"/>
  <line x1="${W - 230}" y1="408" x2="${W - 60}" y2="408" stroke="${GOLD}" stroke-width="3"/>
  ${text(subtitle, W / 2, 416, { size: 22, weight: 700, fill: BODY, anchor: 'middle', fit: 700 })}
  ${panel(40, 446, 430, 472, leftTitle)}
  ${leftSteps.map((s, i) => stepRow(76, 562 + i * 118, s.icon, s.lines, i < leftSteps.length - 1)).join('\n')}
  ${keepGoingArrow(676, arrowLabel)}
  ${panel(580, 446, 430, 472, rightTitle)}
  ${rightSteps.map((st, i) => `
    ${glyph(st.icon, 620 + i * 128, 548, 90, INK, 5)}
    ${st.lines.map((l, j) => text(l, 662 + i * 128, 664 + j * 26, { size: 17, weight: 400, fill: BODY, anchor: 'middle' })).join('\n')}`).join('\n')}
  <path d="M736 668h22M864 668h22" stroke="${GOLD}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M806 720v14M798 728l8 10 8-10" stroke="${GOLD}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  ${outcomeBox(600, 752, 390, outcome)}
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
    { icon: 'trophy', lines: ['A successful', 'Giveback Day.', 'Great impact.'] },
  ],
  rightTitle: 'WHAT DOES|LOCALVIP ADD',
  rightSteps: [
    { icon: 'repeat', lines: ['Customers', 'come back'] },
    { icon: 'customers', lines: ['Reward the ones', 'you already have'] },
    { icon: 'chart', lines: ['Reach the wider', 'local network'] },
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
    footnote: '★  CHOOSE A DATE. WE’LL HELP WITH THE REST.  ★',
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
    footnote: '★  ONE SCAN SHOWS YOU WHERE TO START.  ★',
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
    footnote: '★  ONE CONVERSATION CAN GET THE FIRST DAY MOVING.  ★',
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
