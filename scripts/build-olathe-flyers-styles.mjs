/**
 * Olathe flyers - styles D, E and F.
 *
 * A companion to build-olathe-flyers.mjs, which owns styles A/B/C. Those three
 * share one visual system and differ only in the middle band. These three are
 * deliberately DIFFERENT DESIGNS - different structure, colour weighting and
 * use of photography - the way the supplied reference options differ from each
 * other.
 *
 *   D  "Friday night"  - full-bleed dark photo hero, gold headline, dark sheet
 *   E  "Editorial"     - light and airy, photo band, numbered rail, script accent
 *   F  "Statement"     - no photography, large typographic colour blocks
 *
 * Photography works here because the deliverable is a Chrome-rendered PNG.
 * @napi-rs/canvas drops <image> silently, which is why the A/B/C sheets avoid
 * it; Chrome does not, and PNG is what ships.
 *
 * Kept as a separate file on purpose: the A/B/C script drives the three
 * templates already live as materials 45/46/47, and a shared-file refactor to
 * add these would put those at risk for no benefit.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('public/templates/olathe')
const FONT_DIR = path.join(root, 'fonts')
const PHOTOS = path.join(root, 'photos')
const W = 1050
const H = 1500

const NAVY = '#12305c'
const GOLD = '#f7a81b'
const INK = '#12294c'
const BODY = '#2a3c55'

const esc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const b64 = (f) => fs.readFileSync(path.join(FONT_DIR, f)).toString('base64')
const face = (fam, file, wt) =>
  `@font-face{font-family:'${fam}';font-weight:${wt};font-style:normal;` +
  `src:url(data:font/ttf;base64,${b64(file)}) format('truetype');}`
const FONT_CSS = [
  face('MontRegular', 'Montserrat-Regular.ttf', 400),
  face('MontBold', 'Montserrat-Bold.ttf', 700),
  face('MontXBold', 'Montserrat-ExtraBold.ttf', 800),
  face('Script', 'Caveat-SemiBold.ttf', 600),
].join('')

// Photos are embedded as data URIs so a rendered sheet never depends on a
// relative path resolving from whatever directory Chrome happens to run in.
const photo = (file) => {
  const ext = path.extname(file).slice(1)
  const mime = ext === 'webp' ? 'image/webp' : 'image/jpeg'
  return `data:${mime};base64,${fs.readFileSync(path.join(PHOTOS, file)).toString('base64')}`
}
const CROWD = photo('crowd.jpg')
const TEAM = photo('team.webp')
const COMMUNITY = photo('community.jpg')

function inlineMark(file) {
  const src = fs.readFileSync(path.join(root, file), 'utf8')
  const viewBox = src.match(/viewBox="([^"]+)"/)?.[1]
  const body = src.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/s, '')
  return { viewBox, body }
}
const owl = inlineMark('olathe-west-official.svg')
const district = inlineMark('olathe-public-schools-official.svg')
const mark = (m, x, y, size) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${m.viewBox}" preserveAspectRatio="xMidYMid meet">${m.body}</svg>`

const FAM = {
  x: "'MontXBold',Montserrat,Arial,sans-serif",
  b: "'MontBold',Montserrat,Arial,sans-serif",
  r: "'MontRegular',Montserrat,Arial,sans-serif",
  s: "'Script',cursive",
}
function text(str, x, y, o = {}) {
  const { size = 20, weight = 700, fill = INK, anchor = 'start', fam = 'r', ls = 0, fit = 0 } = o
  const lock = fit ? ` textLength="${fit}" lengthAdjust="spacingAndGlyphs"` : ''
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FAM[fam]}" font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${fill}"${lock}>${esc(str)}</text>`
}
const stack = (arr, x, y, o = {}) =>
  arr.map((l, i) => text(l, x, y + i * (o.gap || 30), o)).join('\n')

const G = {
  calendar: '<rect x="11" y="15" width="42" height="38" rx="5"/><path d="M11 28h42M22 11v8M42 11v8"/>',
  megaphone: '<path d="M10 28v10a4 4 0 0 0 4 4h4l5 13h8l-5-13h2l18 11V14L28 26H14a4 4 0 0 0-4 4z"/><path d="M54 24c5 4 5 12 0 16"/>',
  customers: '<g fill="currentColor" stroke="none"><circle cx="32" cy="20" r="9"/><path d="M14 50c0-10 8-17 18-17s18 7 18 17z"/><circle cx="13" cy="26" r="7"/><circle cx="51" cy="26" r="7"/><path d="M2 46c0-7 5-11 11-11 2 0 4 .4 6 1-3 3-5 6-6 10zM62 46c0-7-5-11-11-11-2 0-4 .4-6 1 3 3 5 6 6 10z"/></g>',
  repeat: '<path d="M15 32a17 17 0 1 1 5 12"/><path d="M15 19v13h13"/>',
  infinity: '<path d="M18 32c0-5 4-9 9-9 7 0 10 18 19 18 5 0 9-4 9-9s-4-9-9-9c-9 0-12 18-19 18-5 0-9-4-9-9z"/>',
  heart: '<path d="M32 51S11 38 11 25.5A11 11 0 0 1 32 21a11 11 0 0 1 21 4.5C53 38 32 51 32 51z"/>',
  storefront: '<path d="M13 27h38v26H13z"/><path d="M11 27l5-13h32l5 13"/><path d="M25 53V37h14v16"/>',
  chart: '<g fill="currentColor" stroke="none"><rect x="12" y="38" width="10" height="16"/><rect x="27" y="28" width="10" height="26"/><rect x="42" y="18" width="10" height="36"/></g><path d="M14 30l14-11 9 7 15-14" stroke-width="4"/><path d="M43 12h10v10" stroke-width="4"/>',
  badge: '<circle cx="32" cy="25" r="13"/><path d="M23 35l-5 18 14-7 14 7-5-18"/>',
  play: '<circle cx="32" cy="32" r="19"/><path d="M26 22l18 10-18 10z" fill="currentColor" stroke="none"/>',
  bag: '<path d="M14 23h36l3 32H11z"/><path d="M23 23v-4a9 9 0 0 1 18 0v4"/>',
  network: '<g fill="currentColor" stroke="none"><circle cx="32" cy="14" r="7"/><circle cx="13" cy="48" r="7"/><circle cx="51" cy="48" r="7"/></g><path d="M28 20L18 41M36 20l10 21M20 48h24" stroke-width="4"/>',
}
const glyph = (n, x, y, size = 64, color = INK, sw = 5) =>
  `<g transform="translate(${x} ${y}) scale(${size / 64})" fill="none" stroke="${color}" color="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${G[n]}</g>`

const shell = (inner, bg = '#fbfbfb') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><style>${FONT_CSS}</style>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04102a" stop-opacity=".35"/>
      <stop offset="0.55" stop-color="#04102a" stop-opacity=".82"/>
      <stop offset="1" stop-color="#04102a" stop-opacity=".97"/>
    </linearGradient>
    <clipPath id="heroClip"><rect x="0" y="0" width="${W}" height="640"/></clipPath>
    <clipPath id="bandClip"><rect x="40" y="540" width="${W - 80}" height="196" rx="14"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${inner}
</svg>`

/** Small shared lockup used by all three styles, in light or dark trim. */
const lockup = (m, org, sub, dark) => {
  const fg = dark ? '#fff' : INK
  const dim = dark ? '#c6d3e6' : BODY
  return `${mark(m, 40, 30, 88)}
  ${stack(org, 148, 66, { size: 27, weight: 800, fam: 'x', fill: fg, gap: 32 })}
  ${text(sub, 148, 128, { size: 15, weight: 700, fam: 'b', fill: dim, ls: 1 })}
  <line x1="${W - 300}" y1="40" x2="${W - 300}" y2="120" stroke="${dark ? '#3f5a80' : '#c9d4e2'}" stroke-width="2"/>
  ${text('LOCALVIP', W - 40, 84, { size: 38, weight: 800, fam: 'x', fill: fg, anchor: 'end' })}
  ${text('POWERED BY LOCALVIP', W - 40, 110, { size: 12, weight: 700, fam: 'b', fill: dim, anchor: 'end', ls: 1.4 })}`
}

/** QR block, dark or light trim. */
const qrBlock = (x, y, dark) => `<g transform="translate(${x} ${y})">
  <rect x="-8" y="-8" width="182" height="224" rx="12" fill="${dark ? '#fff' : NAVY}"/>
  <rect width="166" height="166" fill="#fff"/>
  <rect x="6" y="6" width="154" height="154" rx="6" fill="#fff" stroke="${GOLD}" stroke-width="3" stroke-dasharray="9 7"/>
  ${text('PLACE QR', 83, 78, { size: 13, weight: 800, fam: 'x', fill: '#8b6500', anchor: 'middle' })}
  ${text('CODE HERE', 83, 96, { size: 13, weight: 800, fam: 'x', fill: '#8b6500', anchor: 'middle' })}
  <rect x="-8" y="170" width="182" height="46" rx="8" fill="${GOLD}"/>
  ${text('SCAN ME', 83, 201, { size: 20, weight: 800, fam: 'x', fill: INK, anchor: 'middle' })}
</g>`

// ── STYLE D — "Friday night" ─────────────────────────────────────────────────
function styleD({ m, org, sub, hero, kicker, title, blurb, cols, ctaTitle, ctaRows, script, foot }) {
  return shell(`
  <g clip-path="url(#heroClip)">
    <image href="${hero}" x="0" y="0" width="${W}" height="640" preserveAspectRatio="xMidYMid slice"/>
    <rect x="0" y="0" width="${W}" height="640" fill="url(#fade)"/>
  </g>
  <rect x="0" y="0" width="${W}" height="170" fill="#04102a" opacity=".55"/>
  ${lockup(m, org, sub, true)}
  ${text(kicker, 40, 300, { size: 16, weight: 800, fam: 'x', fill: GOLD, ls: 3 })}
  ${title.map((t, i) => text(t.t, 40, 356 + i * 62, { size: 56, weight: 800, fam: 'x', fill: t.gold ? GOLD : '#fff' })).join('\n')}
  ${stack(blurb, 40, 522, { size: 19, weight: 400, fill: '#dbe6f5', gap: 27 })}
  <path d="M0 640 L${W} 612 L${W} 660 L0 688 Z" fill="#0b1c33"/>
  <rect x="0" y="660" width="${W}" height="332" fill="#0b1c33"/>
  ${cols.map((c, i) => {
    const x = 44 + i * 246
    return `${glyph(c.icon, x, 700, 50, GOLD, 4.5)}
    ${stack(c.title.split('|'), x, 792, { size: 16, weight: 800, fam: 'x', fill: '#fff', gap: 21 })}
    ${stack(c.lines, x, 848, { size: 13.5, weight: 400, fill: '#b9c8dd', gap: 19 })}`
  }).join('\n')}
  <path d="M0 992 L${W} 1016 L${W} 1060 L0 1036 Z" fill="${GOLD}"/>
  <rect x="0" y="1050" width="${W}" height="330" fill="${GOLD}"/>
  ${qrBlock(52, 1094, false)}
  ${stack(ctaTitle, 268, 1136, { size: 33, weight: 800, fam: 'x', fill: INK, gap: 40 })}
  ${ctaRows.map((r, i) => `${glyph(r.icon, 268, 1206 + i * 52, 30, INK, 3.4)}
    ${text(r.label, 312, 1229 + i * 52, { size: 17, weight: 800, fam: 'x', fill: INK })}`).join('\n')}
  ${text(script, 268, 1350, { size: 30, weight: 600, fam: 's', fill: '#7a4f00' })}
  <rect x="0" y="1380" width="${W}" height="120" fill="#0b1c33"/>
  ${foot.map((f, i) => text(f, 40 + i * 340, 1440, { size: 15, weight: 800, fam: 'x', fill: '#fff' })).join('\n')}`, '#0b1c33')
}

// ── STYLE E — "Editorial" ────────────────────────────────────────────────────
function styleE({ m, org, sub, band, kicker, title, blurb, steps, script, ctaTitle, ctaRows, foot }) {
  return shell(`
  ${lockup(m, org, sub, false)}
  <line x1="40" y1="158" x2="${W - 40}" y2="158" stroke="#e3e9f1" stroke-width="2"/>
  ${text(kicker, 40, 208, { size: 15, weight: 800, fam: 'x', fill: GOLD, ls: 3 })}
  ${title.map((t, i) => text(t, 40, 268 + i * 58, { size: 52, weight: 800, fam: 'x', fill: INK })).join('\n')}
  ${text(script, 40, 400, { size: 34, weight: 600, fam: 's', fill: '#1f4fa3' })}
  ${stack(blurb, 40, 452, { size: 18, weight: 400, fill: BODY, gap: 26 })}
  <image href="${band}" x="40" y="540" width="${W - 80}" height="196" preserveAspectRatio="xMidYMid slice" clip-path="url(#bandClip)"/>
  <rect x="40" y="540" width="${W - 80}" height="196" rx="14" fill="none" stroke="#e3e9f1" stroke-width="2"/>
  <line x1="70" y1="812" x2="70" y2="1000" stroke="#e3e9f1" stroke-width="3"/>
  ${steps.map((st, i) => {
    const y = 790 + i * 104
    return `<circle cx="70" cy="${y}" r="21" fill="${NAVY}"/>
    ${text(String(i + 1), 70, y + 7, { size: 18, weight: 800, fam: 'x', fill: '#fff', anchor: 'middle' })}
    ${text(st.title, 118, y + 2, { size: 20, weight: 800, fam: 'x', fill: INK })}
    ${text(st.line, 118, y + 30, { size: 16, weight: 400, fill: BODY })}`
  }).join('\n')}
  <rect x="0" y="1088" width="${W}" height="292" fill="${NAVY}"/>
  ${qrBlock(52, 1140, true)}
  ${stack(ctaTitle, 268, 1182, { size: 30, weight: 800, fam: 'x', fill: '#fff', gap: 38 })}
  ${ctaRows.map((r, i) => `${glyph(r.icon, 268, 1246 + i * 48, 26, GOLD, 3.2)}
    ${text(r.label, 306, 1267 + i * 48, { size: 16, weight: 800, fam: 'x', fill: '#fff' })}`).join('\n')}
  ${foot.map((f, i) => text(f, 40 + i * 340, 1444, { size: 15, weight: 800, fam: 'x', fill: INK })).join('\n')}`)
}

// ── STYLE F — "Statement" ────────────────────────────────────────────────────
function styleF({ m, org, sub, big, sub2, blocks, ctaTitle, ctaRows, script, foot }) {
  return shell(`
  ${lockup(m, org, sub, false)}
  <rect x="0" y="166" width="${W}" height="368" fill="${NAVY}"/>
  ${big.map((t, i) => text(t.t, 40, 258 + i * 74, { size: 66, weight: 800, fam: 'x', fill: t.gold ? GOLD : '#fff' })).join('\n')}
  ${text(sub2, 40, 486, { size: 19, weight: 400, fill: '#c9d8ec' })}
  ${blocks.map((b, i) => {
    const y = 566 + i * 132
    return `<rect x="40" y="${y}" width="${W - 80}" height="116" rx="14" fill="${i % 2 ? '#f2f6fb' : '#fdf6e6'}" stroke="${i % 2 ? '#dbe4ef' : GOLD}" stroke-width="2"/>
    ${glyph(b.icon, 76, y + 30, 52, i % 2 ? NAVY : '#9a6a00', 4.6)}
    ${text(b.title, 156, y + 48, { size: 21, weight: 800, fam: 'x', fill: INK })}
    ${text(b.line, 156, y + 80, { size: 16, weight: 400, fill: BODY })}`
  }).join('\n')}
  ${text(script, 40, 1064, { size: 32, weight: 600, fam: 's', fill: '#1f4fa3' })}
  <rect x="0" y="1100" width="${W}" height="280" fill="${GOLD}"/>
  ${qrBlock(52, 1136, false)}
  ${stack(ctaTitle, 268, 1180, { size: 31, weight: 800, fam: 'x', fill: INK, gap: 38 })}
  ${ctaRows.map((r, i) => `${glyph(r.icon, 268, 1240 + i * 48, 28, INK, 3.3)}
    ${text(r.label, 310, 1261 + i * 48, { size: 16.5, weight: 800, fam: 'x', fill: INK })}`).join('\n')}
  ${foot.map((f, i) => text(f, 40 + i * 340, 1444, { size: 15, weight: 800, fam: 'x', fill: INK })).join('\n')}`)
}

export { styleD, styleE, styleF, owl, district, CROWD, TEAM, COMMUNITY, W, H }
