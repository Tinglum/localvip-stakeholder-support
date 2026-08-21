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
  fontFace('HeadCond', 'ArchivoNarrow-Bold.ttf', 700),
].join('')

const esc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const NAVY = '#031328'
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
  const fam = cls === 'hd' ? "'HeadCond','Archivo Narrow',Arial,sans-serif"
    : cls === 'cond' ? "'MontXBold',Montserrat,Arial,sans-serif"
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
  phone: '<rect x="18" y="6" width="28" height="52" rx="6"/><path d="M27 13h10"/><path d="M28 50h8"/>',
  play: '<circle cx="32" cy="32" r="19"/><path d="M26 22l18 10-18 10z" fill="currentColor" stroke="none"/>',
  badge: '<circle cx="32" cy="25" r="13"/><path d="M23 35l-5 18 14-7 14 7-5-18"/>',
}

function glyph(name, x, y, size = 64, color = INK, sw = 5) {
  const s = size / 64
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" color="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${G[name]}</g>`
}

// Composed mark: heart outline with OW set inside it.
//
// NOT an official Olathe West asset - there is no supplied heart-with-OW file,
// so this is built from the heart glyph plus lettering. Flagged deliberately:
// the owl and the district apple are traced from the real marks, this one is
// not. If an official version turns up, trace it and swap this out.
//
// Used in the reassurance strip on the two Olathe West sheets, where the owl was
// simply repeating the header mark a few inches lower.
const owHeart = {
  viewBox: '0 0 64 64',
  body: `<path d="M32 55S8 40 8 24.5A12.5 12.5 0 0 1 32 19a12.5 12.5 0 0 1 24 5.5C56 40 32 55 32 55z" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`
    + `<text x="32" y="41" text-anchor="middle" font-family="'MontXBold',Montserrat,Arial,sans-serif" font-size="18" font-weight="800" fill="${INK}">OW</text>`,
}

// ── page furniture ───────────────────────────────────────────────────────────
function header({ m, org, sub }) {
  return `
  ${mark(m, 74, 28, 150)}
  ${org.map((l, i) => text(l, 420, 74 + i * 42, { size: 34, weight: 800, cls: 'cond', anchor: 'middle' })).join('\n')}
  ${text(sub, 420, 74 + org.length * 42, { size: 21, weight: 800, cls: 'cond', fill: INK, anchor: 'middle', ls: 0.4 })}
  <line x1="640" y1="44" x2="640" y2="150" stroke="#c9d4e2" stroke-width="3"/>
  <text x="690" y="98" font-size="54" font-weight="800" class="cond" font-family="'MontXBold',Montserrat,Arial,sans-serif" fill="${INK}">LOCAL<tspan font-weight="400">VIP</tspan></text>
  ${text('POWERED BY LOCALVIP', 690, 132, { size: 16, weight: 700, cls: 'sb', fill: BODY, ls: 1 })}`
}

/** Navy-headed panel with a rounded top. */
function panel(x, y, w, h, title) {
  const titleLines = title.split('|')
  return `
  <path d="M${x} ${y + 18}a18 18 0 0 1 18-18h${w - 36}a18 18 0 0 1 18 18v56H${x}z" fill="${NAVY}"/>
  <path d="M${x} ${y + 74}h${w}v${h - 92}a18 18 0 0 1-18 18H${x + 18}a18 18 0 0 1-18-18z" fill="#fff"/>
  <path d="M${x} ${y + 74}h${w}v${h - 92}a18 18 0 0 1-18 18H${x + 18}a18 18 0 0 1-18-18z" fill="none" stroke="#e8c37a" stroke-width="2.5"/>
  ${titleLines.map((t, i) => text(t, x + w / 2, y + (titleLines.length === 1 ? 46 : 32 + i * 28), { size: 23, weight: 800, cls: 'cond', fill: '#fff', anchor: 'middle' })).join('\n')}`
}

/** One icon + wrapped label row, with an optional connector arrow beneath. */
function stepRow(x, y, icon, labelLines, withArrow) {
  return `
  ${glyph(icon, x, y, 66, INK, 4.4)}
  ${stack(labelLines, x + 88, y + (labelLines.length === 1 ? 36 : 22), { size: 20, weight: 400, fill: BODY, gap: 27 })}
  ${withArrow ? `<g transform="translate(${x + 20} ${y + 62}) scale(.72)" fill="#c3ced9"><path d="M6 0h10v18h7L11 32 0 18h6z"/></g>` : ''}`
}

function keepGoingArrow(y, label) {
  return `
  <g transform="translate(445 ${y})">
    <path d="M0 30h64V0l55 75-55 75V120H0z" fill="${GOLD}"/>
    ${label.split('|').map((t, i) => text(t, 34, 66 + i * 28, { size: 20, weight: 800, cls: 'cond', fill: INK, anchor: 'middle' })).join('\n')}
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
  ${mark(m, 60, 1006, 104)}
  <line x1="188" y1="1010" x2="188" y2="1114" stroke="${GOLD}" stroke-width="3"/>
  ${text(title, 214, 1046, { size: 23, weight: 800, cls: 'cond', fit: 764 })}
  ${stack(body, 214, 1078, { size: 18, weight: 400, fill: BODY, gap: 25 })}`
}

/**
 * Dark CTA band. The QR zone is a blank square: its guide is inset so the
 * stamped code covers it completely rather than leaving a ring around the code.
 */
function ctaBand({ headline, rows, footnote }) {
  return `
  <rect x="0" y="1148" width="${W}" height="279" fill="${NAVY}"/>
  <g transform="translate(81 1167)">
    <rect x="0" y="0" width="222" height="241" rx="10" fill="none" stroke="${GOLD}" stroke-width="5"/>
    <rect x="9" y="9" width="204" height="189" fill="#fff"/>
    <rect x="17" y="17" width="188" height="173" rx="6" fill="#fff" stroke="${GOLD}" stroke-width="3" stroke-dasharray="9 7"/>
    ${text('PLACE QR', 111, 96, { size: 14, weight: 900, fill: '#8b6500', anchor: 'middle' })}
    ${text('CODE HERE', 111, 118, { size: 14, weight: 900, fill: '#8b6500', anchor: 'middle' })}
    <rect x="0" y="198" width="222" height="43" rx="8" fill="${GOLD}"/>
    ${text('SCAN ME', 111, 228, { size: 21, weight: 900, fill: INK, anchor: 'middle' })}
  </g>
  <line x1="336" y1="1176" x2="336" y2="1400" stroke="#3a5170" stroke-width="2"/>
  ${headline.map((t, i) => text(t, 372, 1216 + i * 40, { size: 46, weight: 700, cls: 'hd', fill: '#fff', fit: 600 })).join('\n')}
  ${rows.map((r, i) => `
    ${glyph(r.icon, 372, 1268 + i * 50, 38, '#fff', 4)}
    ${text(r.label, 424, 1296 + i * 50, { size: 21, weight: 800, cls: 'cond', fill: '#fff' })}
    <line x1="424" y1="${1310 + i * 50}" x2="${W - 60}" y2="${1310 + i * 50}" stroke="${GOLD}" stroke-width="2" opacity=".85"/>`).join('\n')}
  ${text(footnote, 372, 1400, { size: 17, weight: 800, cls: 'cond', fill: GOLD })}`
}

function footer(items) {
  const slot = W / items.length
  return `
  <rect x="0" y="1427" width="${W}" height="73" fill="#fff"/>
  <line x1="0" y1="1427" x2="${W}" y2="1427" stroke="#dfe6ef" stroke-width="2"/>
  ${items.map((it, i) => `
    ${glyph(it.icon, i * slot + 46, 1440, 46, INK, 4.8)}
    ${text(it.label, i * slot + 104, 1474, { size: 18, weight: 800, cls: 'cond', fill: INK })}
    ${i > 0 ? `<line x1="${i * slot + 10}" y1="1446" x2="${i * slot + 10}" y2="1486" stroke="#dfe6ef" stroke-width="2"/>` : ''}`).join('\n')}`
}

// ── alternate body layouts ───────────────────────────────────────────────────
// Header, headline, reassurance, CTA and footer are shared furniture; only the
// middle band changes. Both are drawn from the supplied reference options.

/** Option B - four numbered steps plus a benefit strip. */
function bodySteps({ steps, strip }) {
  const cw = 226, gap = 22
  return `
  ${steps.map((st, i) => {
    const x = 40 + i * (cw + gap)
    return `<g transform="translate(${x} 442)">
      <rect width="${cw}" height="296" rx="16" fill="#fff" stroke="#dfe6ef" stroke-width="2"/>
      <rect width="${cw}" height="6" rx="3" fill="${GOLD}"/>
      <circle cx="42" cy="52" r="24" fill="${NAVY}"/>
      ${text(String(i + 1).padStart(2, '0'), 42, 60, { size: 20, weight: 800, cls: 'cond', fill: '#fff', anchor: 'middle' })}
      ${glyph(st.icon, 132, 26, 54, INK, 5)}
      ${stack(st.title.split('|'), 22, 118, { size: 17, weight: 800, cls: 'cond', gap: 21 })}
      ${stack(st.lines, 22, 178, { size: 14, weight: 400, fill: BODY, gap: 20 })}
    </g>`
  }).join('\n')}
  <rect x="40" y="762" width="970" height="142" rx="16" fill="#fdf6e6" stroke="${GOLD}" stroke-width="2"/>
  ${strip.map((it, i) => {
    const x = 64 + i * (970 / strip.length)
    return `${glyph(it.icon, x, 800, 44, INK, 4.5)}
    ${stack(it.lines, x + 58, 820, { size: 15, weight: 400, fill: BODY, gap: 21 })}`
  }).join('\n')}`
}

/** Option C - three-way benefit diagram. */
function bodyCircles({ circles, centre, outcome }) {
  const pos = [[236, 600], [525, 540], [814, 600]]
  return `
  <path d="M320 540 Q525 468 730 540" fill="none" stroke="${GOLD}" stroke-width="3" stroke-dasharray="8 8"/>
  ${circles.map((c, i) => `
    <circle cx="${pos[i][0]}" cy="${pos[i][1]}" r="102" fill="#fff" stroke="${c.accent}" stroke-width="5"/>
    ${glyph(c.icon, pos[i][0] - 27, pos[i][1] - 60, 54, c.accent, 5)}
    ${stack(c.lines, pos[i][0], pos[i][1] + 18, { size: 16, weight: 800, cls: 'cond', anchor: 'middle', gap: 21 })}`).join('\n')}
  ${glyph('heart', 497, 686, 56, GOLD, 5)}
  ${stack(centre, 525, 782, { size: 19, weight: 800, cls: 'cond', anchor: 'middle', gap: 25 })}
  ${outcomeBox(220, 826, 610, outcome)}`
}

function page({ head, title, subtitle, layout = 'compare', body, leftTitle, leftSteps, rightTitle, rightSteps, arrowLabel, outcome, reassure, cta, foot }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title.join(' '))}">
  <defs><style>${FONT_CSS}.sans{font-family:'MontRegular',Montserrat,Arial,sans-serif}.cond{font-family:'MontXBold',Montserrat,Arial,sans-serif}.sb{font-family:'MontBold',Montserrat,Arial,sans-serif}</style></defs>
  <rect width="${W}" height="${H}" fill="#fbfbfb"/>
  
  ${header(head)}
  ${title.map((t, i) => text(t.text, W / 2, 256 + i * 72, { size: 88, weight: 700, cls: 'hd', anchor: 'middle', fill: INK, fit: t.fit })).join('\n')}
  <line x1="52" y1="410" x2="96" y2="410" stroke="${GOLD}" stroke-width="3"/>
  <line x1="${W - 96}" y1="410" x2="${W - 52}" y2="410" stroke="${GOLD}" stroke-width="3"/>
  ${text(subtitle, W / 2, 418, { size: 25, weight: 400, fill: BODY, anchor: 'middle', fit: 840 })}
  ${layout === 'steps' ? bodySteps(body) : layout === 'circles' ? bodyCircles(body) : `
  ${panel(39, 466, 406, 520, leftTitle)}
  ${leftSteps.map((s, i) => stepRow(72, 576 + i * 148, s.icon, s.lines, i < leftSteps.length - 1)).join('\n')}
  ${keepGoingArrow(656, arrowLabel)}
  ${panel(550, 466, 462, 520, rightTitle)}
  ${rightSteps.map((st, i) => `
    ${glyph(st.icon, 592 + i * 148, 548, 92, INK, 5.2)}
    ${st.lines.map((l, j) => text(l, 638 + i * 148, 676 + j * 25, { size: 17.5, weight: 400, fill: BODY, anchor: 'middle' })).join('\n')}`).join('\n')}
  <path d="M700 594h30M848 594h30" stroke="${GOLD}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- Gold bracket collecting all three columns, then the arrow down into the
       outcome box. The approved sheet draws this as one connected device; ours
       had only the arrow, so the three columns read as unrelated. -->
  <path d="M612 742v16h330v-16" stroke="${GOLD}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M777 758v20M769 770l8 10 8-10" stroke="${GOLD}" stroke-width="3" fill="none" stroke-linecap="round"/>
  ${outcomeBox(576, 800, 410, outcome)}
`}
  ${reassurance(reassure)}
  ${ctaBand(cta)}
  ${footer(foot)}
  </svg>`
}

const businessCfg = {
  head: { m: owl, org: ['OLATHE WEST', '12TH MAN'], sub: 'FOOTBALL BOOSTER CLUB' },
  // The original sheet's headline, carried over, was the SCHOOL asking the
  // business for something ("bring in your community"). This leads on the lever
  // the owner actually controls - choosing which day gets busier - and lands the
  // same promise the right panel makes.
  title: [{ text: 'MAKE YOUR SLOWEST DAY', fit: 800 }, { text: 'THE ONE THEY COME BACK FOR.', fit: 940 }],
  subtitle: 'You pick the day you want busier. LocalVIP helps you give local families an additional reason to choose you — and to come back.',
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
    // Business audience. The original sheet's reassurance - "you're still
    // supporting Olathe West and helping our kids" - is the SCHOOL's reason for
    // doing this, and it stayed correct on the parent and district versions.
    // On a flyer arguing business gain it answers a question the owner did not
    // ask, so it argues the owner's reason instead: nothing about their
    // operation changes.
    //
    // Deliberately makes no claim about prices, margins or cost. The business
    // does fund the cashback it advertises, so "keep your margins" would be
    // false; "how you run your day" is both true and the thing an owner is
    // actually wary of changing.
    title: 'NOTHING CHANGES ABOUT HOW YOU RUN YOUR BUSINESS.',
    body: ['You keep the customers and the reputation you have already earned.',
      'LocalVIP does not change how you run your day — it adds another',
      'reason for people to choose you, come back, and tell others.'],
  },
  cta: {
    headline: ['ONGOING CONNECTION. MORE WAYS TO WIN.'],
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
}
const business = page(businessCfg)

const parentCfg = {
  head: { m: owl, org: ['OLATHE WEST', '12TH MAN'], sub: 'FOOTBALL BOOSTER CLUB' },
  title: [{ text: 'YOUR NEXT LOCAL PURCHASE', fit: 900 }, { text: 'CAN SUPPORT OLATHE WEST.', fit: 880 }],
  subtitle: 'Shop where you already shop. LocalVIP helps those everyday choices do more for Olathe West.',
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
      'LocalVIP simply helps the choices you already make go further',
      '— for the school, and for your family.'],
  },
  cta: {
    headline: ['YOUR FAMILY. MORE WAYS TO MAKE AN IMPACT.'],
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
}
const parent = page(parentCfg)

const schoolCfg = {
  head: { m: district, org: ['OLATHE PUBLIC', 'SCHOOLS'], sub: 'COMMUNITY GIVEBACK' },
  title: [{ text: 'TURN COMMUNITY TRUST', fit: 800 }, { text: 'INTO REPEATABLE LOCAL SUPPORT.', fit: 940 }],
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
    headline: ['YOUR SCHOOL. MORE WAYS TO GROW.'],
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
}
const school = page(schoolCfg)

// ── Options B and C ──────────────────────────────────────────────────────────
// Same three audiences, same furniture and voice rules; different middle band.
// B is the numbered-sequence treatment, C is the three-way benefit diagram.
const variant = (base, layout, body, over = {}) =>
  page({ ...base, layout, body, ...over })

const cfg = { business: businessCfg, parent: parentCfg, school: schoolCfg }

const stepsBody = {
  business: {
    steps: [
      { icon: 'calendar', title: 'PICK|YOUR DAY', lines: ['Choose a day that', 'could use more', 'business.'] },
      { icon: 'megaphone', title: 'WE RALLY|OLATHE WEST', lines: ['We promote you to', 'Olathe West families,', 'fans and supporters.'] },
      { icon: 'customers', title: 'EVERYONE|BENEFITS', lines: ['You get customers.', 'Shoppers earn back.', 'Olathe West benefits.'] },
      { icon: 'repeat', title: 'IT KEEPS|GOING', lines: ['That first day turns', 'into an ongoing', 'connection.'] },
    ],
    strip: [
      { icon: 'storefront', lines: ['More local traffic on', 'the day you choose.'] },
      { icon: 'heart', lines: ['Support for students', 'and our schools.'] },
      { icon: 'chart', lines: ['A measured way to', 'market your business.'] },
    ],
  },
  parent: {
    steps: [
      { icon: 'phone', title: 'JOIN YOUR|SCHOOL', lines: ['Connect through the', 'official Olathe West', 'campaign code.'] },
      { icon: 'bag', title: 'SHOP AS|USUAL', lines: ['Choose participating', 'businesses you', 'already use.'] },
      { icon: 'customers', title: 'EVERYONE|BENEFITS', lines: ['Your family earns.', 'Olathe West benefits.', 'Local shops grow.'] },
      { icon: 'repeat', title: 'IT KEEPS|GOING', lines: ['Everyday choices keep', 'supporting the school', 'all year.'] },
    ],
    strip: [
      { icon: 'heart', lines: ['Support for our kids', 'and their programmes.'] },
      { icon: 'storefront', lines: ['Stronger businesses', 'in our own community.'] },
      { icon: 'trophy', lines: ['Rewards that come', 'back to your family.'] },
    ],
  },
  school: {
    steps: [
      { icon: 'calendar', title: 'START WITH|ONE CAMPUS', lines: ['One school, one', 'Giveback Day, one', 'QR code.'] },
      { icon: 'megaphone', title: 'WE RALLY|THE COMMUNITY', lines: ['We promote taking', 'part to families and', 'local supporters.'] },
      { icon: 'customers', title: 'EVERYONE|BENEFITS', lines: ['Businesses get', 'customers. Families', 'earn. Schools gain.'] },
      { icon: 'network', title: 'THEN|IT SCALES', lines: ['Repeat it, and extend', 'the same framework', 'across the district.'] },
    ],
    strip: [
      { icon: 'badge', lines: ['One consistent tool', 'for every campus.'] },
      { icon: 'storefront', lines: ['Local partners you', 'already know.'] },
      { icon: 'chart', lines: ['Less collateral to', 'build and maintain.'] },
    ],
  },
}

const circlesBody = {
  business: {
    circles: [
      { icon: 'heart', accent: '#1f4fa3', lines: ['OLATHE WEST', 'BENEFITS'] },
      { icon: 'customers', accent: '#b3202c', lines: ['CUSTOMERS', 'CAN BENEFIT'] },
      { icon: 'storefront', accent: '#1f7a44', lines: ['YOUR BUSINESS', 'CAN BENEFIT'] },
    ],
    centre: ['GENEROSITY SHOULD NOT', 'BE ONE-WAY.'],
    outcome: ['SAME GENEROSITY.', 'BETTER ECONOMICS.'],
  },
  parent: {
    circles: [
      { icon: 'heart', accent: '#1f4fa3', lines: ['OLATHE WEST', 'BENEFITS'] },
      { icon: 'customers', accent: '#b3202c', lines: ['YOUR FAMILY', 'BENEFITS'] },
      { icon: 'storefront', accent: '#1f7a44', lines: ['LOCAL BUSINESSES', 'BENEFIT'] },
    ],
    centre: ['THE SAME SHOPPING.', 'MORE PLACES IT LANDS.'],
    outcome: ['SAME ROUTINE.', 'MORE IMPACT.'],
  },
  school: {
    circles: [
      { icon: 'badge', accent: '#1f4fa3', lines: ['YOUR SCHOOL', 'BENEFITS'] },
      { icon: 'customers', accent: '#b3202c', lines: ['FAMILIES', 'BENEFIT'] },
      { icon: 'storefront', accent: '#1f7a44', lines: ['LOCAL BUSINESSES', 'BENEFIT'] },
    ],
    centre: ['ONE FRAMEWORK.', 'THREE WAYS IT PAYS OFF.'],
    outcome: ['ONE GIVEBACK DAY.', 'A LASTING LOCAL NETWORK.'],
  },
}


// ── Faithful reproduction of the approved 12th Man sheet ─────────────────────
// Every copy line, panel heading, icon and footer label matches the approved
// artwork. The revised business/parent/district sheets deliberately depart from
// it (see OLATHE-FLYER-DESIGN-HANDOVER.md section 1); this one deliberately does
// not, so the two can be compared side by side and so there is a like-for-like
// vector version of the sheet everyone already signed off.
//
// The only intentional differences from the raster original, both structural
// rather than editorial:
//   - the QR is a blank labelled zone, because the dashboard stamps the correct
//     campaign code per school; and
//   - the owl carries no white plate behind it, which the raster had and which
//     showed as a rectangle against the page.
const originalCfg = {
  ...businessCfg,
  title: [{ text: 'MAKE ONE GIVEBACK DAY', fit: 830 }, { text: 'THE START OF SOMETHING BIGGER.', fit: 960 }],
  subtitle: 'Bring in your community. Build relationships that can continue after the event.',
  rightTitle: 'HOW LOCALVIP|HELPS IT GROW',
  rightSteps: [
    { icon: 'heart', lines: ['Olathe West', 'benefits'] },
    { icon: 'customers', lines: ['Customers can', 'be rewarded'] },
    { icon: 'chart', lines: ['Your business', 'can benefit'] },
  ],
  outcome: ['THE RELATIONSHIP CONTINUES', 'AND THE IMPACT CAN GROW', 'BEYOND THE DAY.'],
  reassure: {
    m: owl,
    title: 'NOTHING CHANGES ABOUT WHY WE DO THIS.',
    body: ['You\u2019re still supporting Olathe West and helping our kids.',
      'LocalVIP simply makes the experience better for everyone',
      'involved and turns a single day into an ongoing connection.'],
  },
  cta: {
    headline: ['CHOOSE YOUR GIVEBACK DAY'],
    rows: [
      { icon: 'play', label: 'SCAN TO SEE THE 60-SECOND PLAN' },
      { icon: 'calendar', label: 'BOOK YOUR 15-MINUTE SETUP CALL' },
    ],
    footnote: '\u2605  CHOOSE A DATE. WE\u2019LL HELP WITH THE REST.  \u2605',
  },
  foot: [
    { icon: 'customers', label: 'SAME COMMUNITY.' },
    { icon: 'heart', label: 'SAME GENEROSITY.' },
    { icon: 'trophy', label: 'MORE WAYS TO WIN.' },
  ],
}
const originalSheet = page(originalCfg)

const out = {
  'olathe-west-original.svg': originalSheet,
  'business-giveback-template.svg': business,
  'parent-supporter-template.svg': parent,
  'school-outreach-template.svg': school,
  'business-approved-layout.svg': business,
  'parent-approved-layout.svg': parent,
  'school-approved-layout.svg': school,
}
for (const key of ['business', 'parent', 'school']) {
  out[`${key}-option-b.svg`] = variant(cfg[key], 'steps', stepsBody[key])
  out[`${key}-option-c.svg`] = variant(cfg[key], 'circles', circlesBody[key])
}

for (const [name, svg] of Object.entries(out)) {
  fs.writeFileSync(path.join(root, name), svg.replace(/[ \t]+$/gm, ''))
  console.log('Wrote', name)
}
