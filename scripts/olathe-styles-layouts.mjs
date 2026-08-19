// Layout bodies for styles D, E and F.
//
// Rebuilt to stop reading as "generated". The first pass was too grid-aligned:
// even columns, even gaps, straight section edges, one type size per role. The
// reference designs break the grid constantly - angled cuts, elements
// overlapping section boundaries, a large range of type sizes, hand-drawn
// swashes, and depth. Every technique below exists to add one of those.

export function makeStyles(k) {
  const { W, H, NAVY, GOLD, INK, BODY, shell, lockup, qrBlock, mark, text, stack, glyph, owlMark } = k

  // ── shared devices ─────────────────────────────────────────────────────────

  /** Hand-drawn underline under a script line. Two offset strokes, not one, so
   *  it reads as drawn rather than ruled. */
  const swash = (x, y, w, color = GOLD) =>
    `<path d="M${x} ${y} q${w * 0.3} -9 ${w * 0.55} -2 q${w * 0.25} 7 ${w * 0.45} -4"
       fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" opacity=".95"/>
     <path d="M${x + 8} ${y + 8} q${w * 0.35} -7 ${w * 0.8} -3"
       fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>`

  /** Numbered badge. */
  const badge = (n, x, y, r, fill, fg) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>
     ${text(String(n).padStart(2, '0'), x, y + r * 0.34, { size: r * 0.92, weight: 800, fam: 'x', fill: fg, anchor: 'middle' })}`

  /** Kicker with a leading rule, the way the references set an eyebrow. */
  const kickerRule = (label, x, y, color) =>
    `<line x1="${x}" y1="${y - 6}" x2="${x + 34}" y2="${y - 6}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
     ${text(label, x + 48, y, { size: 15, weight: 800, fam: 'x', fill: color, ls: 3 })}`

  const footRow = (items, y, fg, ruleColor) => `
    <line x1="40" y1="${y - 44}" x2="${W - 40}" y2="${y - 44}" stroke="${ruleColor}" stroke-width="2"/>
    ${items.map((f, i) => `${glyph(f.icon, 46 + i * 336, y - 30, 30, fg, 4)}
      ${text(f.label, 88 + i * 336, y - 8, { size: 14.5, weight: 800, fam: 'x', fill: fg })}`).join('\n')}`

  // ── STYLE D — "Friday night" ───────────────────────────────────────────────
  function styleD({ m, org, sub, hero, kicker, title, blurb, cols, ctaTitle, ctaRows, script, foot }) {
    const HERO = 720
    return shell(`
    <g clip-path="url(#heroClipD)">
      <image href="${hero}" x="0" y="0" width="${W}" height="${HERO}" preserveAspectRatio="xMidYMid slice"/>
      <rect x="0" y="0" width="${W}" height="${HERO}" fill="url(#fade)"/>
      <rect x="0" y="0" width="${W}" height="${HERO}" fill="url(#vig)" opacity=".55"/>
      <g opacity=".14"><rect x="${W - 214}" y="0" width="26" height="${HERO}" fill="${GOLD}"/>
      <rect x="${W - 172}" y="0" width="12" height="${HERO}" fill="#ffffff"/></g>
    </g>
    <rect x="0" y="0" width="${W}" height="168" fill="#04102a" opacity=".58"/>
    ${lockup(m, org, sub, true)}
    <path d="M-40 286 L566 252 L566 322 L-40 356 Z" fill="${GOLD}"/>
    ${text(kicker, 40, 314, { size: 15, weight: 800, fam: 'x', fill: '#20160a', ls: 2.6 })}
    ${title.map((t, i) => text(t.t, 40, 392 + i * 74, {
      size: t.gold ? 76 : 60, weight: 800, fam: 'x', fill: t.gold ? GOLD : '#fff', shadow: true })).join('\n')}
    <line x1="42" y1="600" x2="42" y2="672" stroke="${GOLD}" stroke-width="4"/>
    ${stack(blurb, 66, 626, { size: 20, weight: 400, fill: '#e8f0fb', gap: 29 })}
    <path d="M0 ${HERO} L${W} ${HERO - 46} L${W} ${HERO + 22} L0 ${HERO + 60} Z" fill="#0b1c33"/>
    <rect x="0" y="${HERO + 40}" width="${W}" height="300" fill="#0b1c33"/>
    <path d="M96 812 H930" stroke="#33507a" stroke-width="2" stroke-dasharray="3 9"/>
    <path d="M932 812 l-12 -7 v14 z" fill="#33507a"/>
    ${cols.map((c, i) => {
      const x = 44 + i * 246
      return `${i ? `<line x1="${x - 22}" y1="780" x2="${x - 22}" y2="1004" stroke="#1d3252" stroke-width="2"/>` : ''}
      ${badge(i + 1, x + 22, 812, 23, GOLD, '#20160a')}
      ${glyph(c.icon, x + 112, 784, 52, GOLD, 4.6)}
      ${stack(c.title.split('|'), x, 886, { size: 17, weight: 800, fam: 'x', fill: '#fff', gap: 21 })}
      <line x1="${x}" y1="${886 + (c.title.split('|').length - 1) * 21 + 14}" x2="${x + 54}" y2="${886 + (c.title.split('|').length - 1) * 21 + 14}" stroke="${GOLD}" stroke-width="3"/>
      ${stack(c.lines, x, 956, { size: 14, weight: 400, fill: '#c2d2e8', gap: 20 })}`
    }).join('\n')}
    <path d="M0 1052 L${W} 1080 L${W} 1130 L0 1102 Z" fill="${GOLD}"/>
    <rect x="0" y="1120" width="${W}" height="260" fill="${GOLD}"/>
    <path d="M0 1100 L${W} 1072" stroke="#ffffff" stroke-width="3" opacity=".38"/>
    <g filter="url(#drop)">${qrBlock(52, 1156, false)}</g>
    ${stack(ctaTitle, 268, 1198, { size: 36, weight: 800, fam: 'x', fill: '#20160a', gap: 39 })}
    ${ctaRows.map((r, i) => `${glyph(r.icon, 268, 1256 + i * 50, 28, '#20160a', 3.4)}
      ${text(r.label, 310, 1277 + i * 50, { size: 16.5, weight: 800, fam: 'x', fill: '#20160a' })}`).join('\n')}
    <g transform="rotate(-3 700 1352)">
      ${text(script, 700, 1350, { size: 34, weight: 600, fam: 's', fill: '#6f4700' })}
      ${swash(700, 1364, 250, '#6f4700')}
    </g>
    <rect x="0" y="1380" width="${W}" height="120" fill="#0b1c33"/>
    ${footRow(foot, 1464, '#fff', '#2b4468')}`, '#0b1c33')
  }

  // ── STYLE E — "Editorial" ──────────────────────────────────────────────────
  function styleE({ m, org, sub, band, band2, band3, kicker, title, blurb, steps, script, quote, ctaTitle, ctaRows, foot }) {
    return shell(`
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#dots)"/>
    <line x1="26" y1="180" x2="26" y2="1140" stroke="#e8edf4" stroke-width="2"/>
    ${lockup(m, org, sub, false)}
    <line x1="40" y1="160" x2="${W - 40}" y2="160" stroke="#e3e9f1" stroke-width="2"/>
    ${kickerRule(kicker, 40, 212, GOLD)}
    ${title.map((t, i) => text(t, 40, 280 + i * 66, { size: 60, weight: 800, fam: 'x', fill: INK })).join('\n')}
    <g transform="rotate(-2 40 412)">
      ${text(script, 40, 424, { size: 37, weight: 600, fam: 's', fill: '#1f4fa3' })}
      ${swash(40, 436, 320, '#1f4fa3')}
    </g>
    ${stack(blurb, 40, 486, { size: 18.5, weight: 400, fill: BODY, gap: 26 })}
    <image href="${band}" x="0" y="548" width="${Math.round(W * 0.52)}" height="212" preserveAspectRatio="xMidYMid slice" clip-path="url(#b1)"/>
    <image href="${band2}" x="${Math.round(W * 0.53)}" y="548" width="${Math.round(W * 0.23)}" height="212" preserveAspectRatio="xMidYMid slice" clip-path="url(#b2)"/><rect x="${Math.round(W * 0.52)}" y="548" width="7" height="212" fill="#fbfbfb"/>
    <image href="${band3}" x="${Math.round(W * 0.77)}" y="548" width="${Math.round(W * 0.23)}" height="212" preserveAspectRatio="xMidYMid slice" clip-path="url(#b3)"/><rect x="${Math.round(W * 0.76)}" y="548" width="7" height="212" fill="#fbfbfb"/>
    <rect x="0" y="756" width="${W}" height="4" fill="${GOLD}"/>
    <path d="M40 800 v206" stroke="#dfe6ef" stroke-width="2" stroke-dasharray="2 8"/>
    ${steps.map((st, i) => {
      const y = 800 + i * 104
      return `${i % 2 === 0 ? `<rect x="16" y="${y - 34}" width="${W - 32}" height="86" rx="12" fill="#f4f7fb"/>` : ''}
      ${badge(i + 1, 40, y, 23, GOLD, INK)}
      ${text(st.title, 84, y + 2, { size: 21.5, weight: 800, fam: 'x', fill: INK })}
      <line x1="84" y1="${y + 12}" x2="${84 + st.title.length * 7}" y2="${y + 12}" stroke="${GOLD}" stroke-width="2.5"/>
      ${text(st.line, 84, y + 36, { size: 16, weight: 400, fill: BODY })}`
    }).join('\n')}
    <rect x="40" y="1056" width="${W - 80}" height="84" rx="12" fill="#fdf6e6" stroke="${GOLD}" stroke-width="2"/>
    ${text('“', 62, 1118, { size: 62, weight: 800, fam: 'x', fill: GOLD })}
    ${text(quote, 106, 1106, { size: 19, weight: 700, fam: 'b', fill: INK })}
    <path d="M0 1188 L${W} 1160 L${W} 1500 L0 1500 Z" fill="${NAVY}"/>
    <g filter="url(#drop)">${qrBlock(52, 1210, true)}</g>
    ${stack(ctaTitle, 268, 1250, { size: 33, weight: 800, fam: 'x', fill: '#fff', gap: 38 })}
    ${ctaRows.map((r, i) => `${glyph(r.icon, 268, 1310 + i * 46, 26, GOLD, 3.2)}
      ${text(r.label, 306, 1330 + i * 46, { size: 16, weight: 800, fam: 'x', fill: '#fff' })}`).join('\n')}
    ${footRow(foot, 1478, '#dbe6f5', '#2a4368')}`)
  }

  // ── STYLE F — "Statement" ──────────────────────────────────────────────────
  function styleF({ m, org, sub, big, sub2, blocks, chip, ctaTitle, ctaRows, script, signoff, foot }) {
    return shell(`
    ${lockup(m, org, sub, false)}
    <path d="M0 168 H${W} V520 L0 566 Z" fill="${NAVY}"/>
    <text x="${W - 30}" y="500" text-anchor="end" font-family="'MontXBold',Montserrat,sans-serif"
      font-size="190" font-weight="800" fill="#ffffff" opacity=".07">OW</text>
    ${big.map((t, i) => text(t.t, 40, 268 + i * 78, {
      size: t.gold ? 80 : 64, weight: 800, fam: 'x', fill: t.gold ? GOLD : '#fff' })).join('\n')}
    ${text(sub2, 40, 508, { size: 18.5, weight: 400, fill: '#c9d8ec' })}
    <g transform="translate(${W - 300} 560)">
      <rect width="260" height="46" rx="23" fill="#fdf6e6" stroke="${GOLD}" stroke-width="2"/>
      ${text(chip, 130, 30, { size: 14.5, weight: 800, fam: 'x', fill: '#8a5c00', anchor: 'middle' })}
    </g>
    ${blocks.map((b, i) => {
      const y = 644 + i * 138
      const off = i % 2 ? 74 : 40
      const w = W - off - 40
      return `<g filter="url(#soft)">
        <rect x="${off}" y="${y}" width="${w}" height="118" rx="14" fill="#fff" stroke="#e2e8f1" stroke-width="2"/>
      </g>
      <rect x="${off}" y="${y}" width="9" height="118" rx="4" fill="${i % 2 ? NAVY : GOLD}"/>
      <circle cx="${off + 74}" cy="${y + 59}" r="33" fill="${i % 2 ? '#eef3fa' : '#fdf1d8'}"/>
      ${glyph(b.icon, off + 52, y + 37, 44, i % 2 ? NAVY : '#9a6a00', 4.4)}
      ${badge(i + 1, off + 128, y + 34, 15, i % 2 ? NAVY : GOLD, i % 2 ? '#fff' : '#20160a')}
      ${text(b.title, off + 154, y + 42, { size: 22, weight: 800, fam: 'x', fill: INK })}
      <line x1="${off + 154}" y1="${y + 52}" x2="${off + 154 + b.title.length * 7.4}" y2="${y + 52}" stroke="${GOLD}" stroke-width="2.5"/>
      ${text(b.line, off + 154, y + 80, { size: 16, weight: 400, fill: BODY })}
      ${i < blocks.length - 1 ? `<path d="M${W / 2} ${y + 120} v13 m-9 -3 l9 9 9 -9" stroke="${GOLD}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` : ''}`
    }).join('\n')}
    <g transform="rotate(-2 40 1078)">
      ${text(script, 40, 1078, { size: 33, weight: 600, fam: 's', fill: '#1f4fa3' })}
      ${swash(40, 1090, 290, '#1f4fa3')}
    </g>
    <path d="M0 1148 L${W} 1120 L${W} 1380 L0 1380 Z" fill="${GOLD}"/>
    <g filter="url(#drop)">${qrBlock(52, 1176, false)}</g>
    ${stack(ctaTitle, 268, 1218, { size: 34, weight: 800, fam: 'x', fill: '#20160a', gap: 38 })}
    ${ctaRows.map((r, i) => `${glyph(r.icon, 268, 1278 + i * 48, 28, '#20160a', 3.3)}
      ${text(r.label, 310, 1299 + i * 48, { size: 16.5, weight: 800, fam: 'x', fill: '#20160a' })}`).join('\n')}
    ${text(signoff, W - 40, 1352, { size: 29, weight: 600, fam: 's', fill: '#6f4700', anchor: 'end' })}
    ${footRow(foot, 1462, INK, '#dfe6ef')}
    ${mark(owlMark, W - 102, 1392, 62)}`)
  }

  return { styleD, styleE, styleF }
}
