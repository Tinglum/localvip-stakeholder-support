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
  face('Bebas', 'BebasNeue-Regular.ttf', 400),
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
  d: "'Bebas',Impact,'Arial Narrow',sans-serif",
  x: "'MontXBold',Montserrat,Arial,sans-serif",
  b: "'MontBold',Montserrat,Arial,sans-serif",
  r: "'MontRegular',Montserrat,Arial,sans-serif",
  s: "'Script',cursive",
}
function text(str, x, y, o = {}) {
  const { size = 20, weight = 700, fill = INK, anchor = 'start', fam = 'r', ls = 0, fit = 0, shadow = false } = o
  const lock = fit ? ` textLength="${fit}" lengthAdjust="spacingAndGlyphs"` : ''
  const sh = shadow ? ' filter="url(#txt)"' : ''
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FAM[fam]}" font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${fill}"${lock}${sh}>${esc(str)}</text>`
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
    <clipPath id="heroClipD"><rect x="0" y="0" width="${W}" height="720"/></clipPath>
    <clipPath id="bandClip"><rect x="40" y="540" width="${W - 80}" height="196" rx="14"/></clipPath>
    <clipPath id="b1"><rect x="0" y="548" width="${Math.round(W * 0.52)}" height="212"/></clipPath>
    <clipPath id="b2"><rect x="${Math.round(W * 0.53)}" y="548" width="${Math.round(W * 0.23)}" height="212"/></clipPath>
    <clipPath id="b3"><rect x="${Math.round(W * 0.77)}" y="548" width="${Math.round(W * 0.23)}" height="212"/></clipPath>
    <radialGradient id="vig" cx="0.5" cy="0.45" r="0.78">
      <stop offset="0.55" stop-color="#04102a" stop-opacity="0"/>
      <stop offset="1" stop-color="#04102a" stop-opacity=".55"/>
    </radialGradient>
    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
      <rect width="22" height="22" fill="#fbfbfb"/>
      <circle cx="1.6" cy="1.6" r="1.3" fill="#dde5ef"/>
    </pattern>
    <filter id="drop" x="-30%" y="-30%" width="180%" height="180%">
      <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#04102a" flood-opacity=".35"/>
    </filter>
    <filter id="txt" x="-15%" y="-30%" width="130%" height="180%">
      <feDropShadow dx="0" dy="3" stdDeviation="9" flood-color="#02091a" flood-opacity=".62"/>
    </filter>
    <filter id="soft" x="-20%" y="-40%" width="150%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0b1c33" flood-opacity=".10"/>
    </filter>
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
  <rect x="-8" y="-8" width="182" height="232" rx="14" fill="${dark ? '#fff' : NAVY}"/>
  <rect width="166" height="166" fill="#fff"/>
  <rect x="6" y="6" width="154" height="154" rx="6" fill="#fff" stroke="${GOLD}" stroke-width="3" stroke-dasharray="9 7"/>
  ${text('PLACE QR', 83, 78, { size: 13, weight: 800, fam: 'x', fill: '#8b6500', anchor: 'middle' })}
  ${text('CODE HERE', 83, 96, { size: 13, weight: 800, fam: 'x', fill: '#8b6500', anchor: 'middle' })}
  <rect x="-8" y="174" width="182" height="46" rx="8" fill="${GOLD}"/>
  ${text('SCAN ME', 83, 205, { size: 20, weight: 800, fam: 'x', fill: INK, anchor: 'middle' })}
</g>`

import { makeStyles } from './olathe-styles-layouts.mjs'

const { styleD, styleE, styleF } = makeStyles({
  W, H, NAVY, GOLD, INK, BODY, shell, lockup, qrBlock, mark, text, stack, glyph, owlMark: owl,
})

export { styleD, styleE, styleF, owl, district, CROWD, TEAM, COMMUNITY, W, H }
