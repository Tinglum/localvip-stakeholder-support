import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('public/templates/olathe')
const W = 663
const H = 904
const NAVY = '#061a36'
const INK = '#0d2345'
const GOLD = '#f6a900'
const RED = '#c9222b'
const BODY = '#1f2937'

const font = (family, file, weight) => `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(ROOT, 'fonts', file)).toString('base64')}) format('truetype')}`
const CSS = [
  font('Bebas', 'BebasNeue-Regular.ttf', 400),
  font('Mont', 'Montserrat-Regular.ttf', 400),
  font('Mont', 'Montserrat-SemiBold.ttf', 600),
  font('Mont', 'Montserrat-Bold.ttf', 700),
  font('Mont', 'Montserrat-ExtraBold.ttf', 800),
].join('')

function inline(file) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
  return {
    viewBox: source.match(/viewBox="([^"]+)"/)?.[1],
    body: source.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/s, ''),
  }
}
const owl = inline('olathe-west-official.svg')
const district = inline('olathe-public-schools-official.svg')
const esc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const mark = (m, x, y, w, h = w) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${m.viewBox}" preserveAspectRatio="xMidYMid meet">${m.body}</svg>`
const txt = (s, x, y, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.anchor || 'start'}" font-family="${o.face === 'display' ? 'Bebas, sans-serif' : 'Mont, sans-serif'}" font-size="${o.size || 14}" font-weight="${o.weight || 400}" fill="${o.fill || INK}" letter-spacing="${o.spacing || 0}">${esc(s)}</text>`
const lines = (items, x, y, o = {}) => items.map((s, i) => txt(s, x, y + i * (o.gap || 18), o)).join('')

const icons = {
  store: `<path d="M7 24h50v34H7zM4 24l7-16h42l7 16M20 58V39h24v19M5 24c2 7 10 7 13 0 3 7 11 7 14 0 3 7 11 7 14 0 3 7 11 7 14 0"/>`,
  megaphone: `<path d="M8 27v12c0 4 3 7 7 7h8l7 13h9l-7-15 20 11V11L25 27H15c-4 0-7 0-7 0zM58 23c5 5 5 14 0 19"/>`,
  trophy: `<path d="M18 8h28v19c0 10-6 17-14 17s-14-7-14-17zM18 15H7c0 12 6 18 15 18M46 15h11c0 12-6 18-15 18M32 44v10M19 59h26"/><path d="M32 15l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="currentColor" stroke="none"/>`,
  browser: `<rect x="7" y="8" width="50" height="48" rx="3"/><path d="M7 20h50M14 14h1M20 14h1M25 14h1"/><path d="M32 28l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="currentColor" stroke="none"/>`,
  network: `<circle cx="32" cy="10" r="7" fill="currentColor" stroke="none"/><circle cx="11" cy="48" r="7" fill="currentColor" stroke="none"/><circle cx="53" cy="48" r="7" fill="currentColor" stroke="none"/><path d="M29 18L15 41M35 18l14 23M19 48h26"/>`,
  heart: `<path d="M32 57S7 42 7 25c0-10 8-17 17-17 5 0 9 2 12 7 3-5 7-7 12-7 9 0 17 7 17 17 0 17-25 32-33 32z"/>`,
  people: `<circle cx="32" cy="15" r="9" fill="currentColor" stroke="none"/><circle cx="12" cy="23" r="7" fill="currentColor" stroke="none"/><circle cx="52" cy="23" r="7" fill="currentColor" stroke="none"/><path d="M13 55c0-13 8-22 19-22s19 9 19 22z" fill="currentColor" stroke="none"/><path d="M0 52c0-10 5-17 13-17 3 0 6 1 8 3-4 4-6 9-7 14zM64 52c0-10-5-17-13-17-3 0-6 1-8 3 4 4 6 9 7 14z" fill="currentColor" stroke="none"/>`,
  chart: `<path d="M7 57h50M12 57V42h10v15M28 57V31h10v26M44 57V20h10v37"/><path d="M10 34l16-13 10 7 20-19M46 9h10v10"/>`,
  play: `<circle cx="32" cy="32" r="25"/><path d="M26 20l20 12-20 12z" fill="currentColor" stroke="none"/>`,
  calendar: `<rect x="8" y="13" width="48" height="43" rx="5"/><path d="M8 26h48M20 7v12M44 7v12M20 36h8M36 36h8M20 46h8M36 46h8"/>`,
}
const icon = (name, x, y, size, color = INK, sw = 3.5) => `<g transform="translate(${x} ${y}) scale(${size / 64})" fill="none" stroke="${color}" color="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</g>`
const down = (x, y) => `<path d="M${x - 4} ${y}h8v12h6l-10 12-10-12h6z" fill="#b8b8b8"/>`

const configs = {
  school: {
    mark: district, markBox: [63, 26, 63, 70], org: ['OLATHE PUBLIC SCHOOLS'], sub: 'COMMUNITY GIVEBACK CONCEPT',
    title: ['TURN COMMUNITY TRUST', 'INTO REPEATABLE LOCAL SUPPORT.'], intro: 'Start with one business and one Giveback Day. Build from there.',
    leftHead: ['THE GIVEBACK MODEL', 'YOU KNOW'], left: [['store', 'Choose a', 'local business'], ['megaphone', 'Invite your', 'community'], ['trophy', 'Create one', 'successful', 'Giveback Day.']], arrow: ['BUILD ON IT'],
    rightHead: ['HOW LOCALVIP', 'HELPS IT GROW'], top: ['browser', 'Launch with your school', 'branding'], mid: ['network', 'Connect supporters', 'and businesses'], benefits: [['heart', 'Your school', 'benefits'], ['people', 'Families can', 'be rewarded'], ['chart', 'Businesses', 'can grow']], outcome: ['One trusted event can become an', 'ongoing local support network.'],
    reassureMark: district, reassureTitle: 'YOU KEEP THE RELATIONSHIPS. WE ADD THE ENGINE.', reassure: ['Your school remains at the center. LocalVIP provides', 'the tools, materials, and connections that make the program', 'easier to launch and repeat.'],
    cta: 'BRING GIVEBACK DAYS TO YOUR SCHOOL', cta1: 'SCAN TO SEE THE 60-SECOND OLATHE WEST PILOT', cta2: 'BOOK YOUR 15-MINUTE LAUNCH CALL', note: '★  ONE CONVERSATION CAN GET THE FIRST DAY MOVING.', foot: ['YOUR SCHOOL.', 'YOUR COMMUNITY.', 'MORE WAYS TO GROW.'], footIcons: ['people', 'heart', 'trophy'],
  },
  business: {
    mark: owl, markBox: [72, 20, 98, 98], org: ['OLATHE WEST', '12TH MAN'], sub: 'FOOTBALL BOOSTER CLUB',
    title: ['MAKE ONE GIVEBACK DAY', 'THE START OF SOMETHING BIGGER.'], intro: 'Bring in your community. Build relationships that can continue after the event.',
    leftHead: ['THE GIVEBACK DAY', 'YOU ALREADY KNOW'], left: [['megaphone', 'Olathe West', 'promotes your business'], ['store', 'Supporters', 'shop with you'], ['trophy', 'A successful', 'Giveback Day.', 'Great impact.']], arrow: ['KEEP IT', 'GOING'],
    rightHead: ['WHAT DOES', 'LOCALVIP ADD'], top: ['people', 'Reward the customers', 'you already have'], mid: ['network', 'Connect to the wider', 'local network'], benefits: [['heart', 'Olathe West', 'benefits'], ['people', 'Customers can', 'be rewarded'], ['chart', 'Your business', 'can grow']], outcome: ['The relationship continues and', 'the business impact can grow.'],
    reassureMark: owl, reassureTitle: 'NOTHING CHANGES ABOUT WHY WE DO THIS.', reassure: ['You are still supporting Olathe West and helping our kids.', 'LocalVIP turns a single day into an ongoing connection.'],
    cta: 'CHOOSE YOUR GIVEBACK DAY', cta1: 'SCAN TO SEE THE 60-SECOND PLAN', cta2: 'BOOK YOUR 15-MINUTE SETUP CALL', note: '★  CHOOSE A DATE. WE’LL HELP WITH THE REST.', foot: ['YOUR BUSINESS.', 'OUR COMMUNITY.', 'MORE WAYS TO WIN.'], footIcons: ['store', 'people', 'trophy'],
  },
  parent: {
    mark: owl, markBox: [72, 20, 98, 98], org: ['OLATHE WEST', '12TH MAN'], sub: 'FOOTBALL BOOSTER CLUB',
    title: ['YOUR EVERYDAY SHOPPING', 'CAN DO SOMETHING BIGGER.'], intro: 'Shop where you already shop. Help Olathe West and earn rewards along the way.',
    leftHead: ['THE SHOPPING', 'YOU ALREADY DO'], left: [['store', 'Choose a', 'local business'], ['people', 'Shop with your', 'family'], ['heart', 'Support', 'Olathe West']], arrow: ['MAKE IT', 'COUNT'],
    rightHead: ['HOW LOCALVIP', 'HELPS IT GROW'], top: ['browser', 'Find participating', 'local businesses'], mid: ['network', 'Stay connected to', 'your community'], benefits: [['heart', 'Olathe West', 'benefits'], ['people', 'Your family can', 'be rewarded'], ['chart', 'Local business', 'can grow']], outcome: ['The same shopping can create', 'support that continues all year.'],
    reassureMark: owl, reassureTitle: 'THE SAME ROUTINE. MORE COMMUNITY IMPACT.', reassure: ['No extra spending and nothing new to remember.', 'Shop as usual and let each purchase do more.'],
    cta: 'JOIN THE OLATHE WEST COMMUNITY', cta1: 'SCAN TO SEE HOW IT WORKS', cta2: 'FIND PARTICIPATING BUSINESSES', note: '★  ONE SCAN SHOWS YOU WHERE TO START.', foot: ['YOUR FAMILY.', 'YOUR COMMUNITY.', 'MORE WAYS TO GIVE.'], footIcons: ['people', 'heart', 'trophy'],
  },
}

function header(c) {
  const [mx, my, mw, mh] = c.markBox
  const orgY = c.org.length === 1 ? 66 : 53
  return `${mark(c.mark, mx, my, mw, mh)}${lines(c.org, 252, orgY, { face: 'display', size: 27, anchor: 'middle', gap: 28 })}${txt(c.sub, 252, c.org.length === 1 ? 89 : 106, { size: 11, weight: 700, anchor: 'middle' })}<line x1="402" y1="38" x2="402" y2="106" stroke="#555"/><text x="437" y="72" font-family="Mont" font-size="32" font-weight="800" fill="${INK}">LOCAL<tspan font-weight="400">VIP</tspan></text>${txt('POWERED BY LOCALVIP', 437, 96, { size: 10, weight: 700 })}`
}

function panel(x, head) {
  return `<rect x="${x}" y="286" width="270" height="374" rx="9" fill="#fff" stroke="#dedede"/><path d="M${x} 295a9 9 0 0 1 9-9h252a9 9 0 0 1 9 9v46H${x}z" fill="${NAVY}"/>${lines(head, x + 135, 309, { face: 'display', size: 20, anchor: 'middle', fill: '#fff', gap: 20 })}`
}

function qr() {
  return `<rect x="56" y="751" width="108" height="108" rx="7" fill="#fff" stroke="${GOLD}" stroke-width="4"/><rect x="66" y="761" width="88" height="88" fill="#fff" stroke="${GOLD}" stroke-width="2" stroke-dasharray="6 5"/>${lines(['PLACE QR', 'CODE HERE'], 110, 799, { size: 10, weight: 700, anchor: 'middle', fill: '#8b6500', gap: 14 })}`
}

function flyer(c) {
  const leftY = [356, 455, 550]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"><defs><style>${CSS}</style></defs><rect width="${W}" height="${H}" fill="#fff"/><rect x="20" y="16" width="623" height="879" rx="11" fill="none" stroke="#1a1a1a"/>
  ${header(c)}
  ${lines(c.title, 331.5, 166, { face: 'display', size: 50, anchor: 'middle', gap: 58 })}
  <line x1="48" y1="266" x2="106" y2="266" stroke="${GOLD}"/>${txt(c.intro, 331.5, 271, { size: 12.5, weight: 600, anchor: 'middle' })}<line x1="557" y1="266" x2="615" y2="266" stroke="${GOLD}"/>
  ${panel(47, c.leftHead)}${panel(344, c.rightHead)}
  ${c.left.map((r, i) => `${icon(r[0], 88, leftY[i], 50)}${lines(r.slice(1), 160, leftY[i] + 18, { face: 'display', size: 17, gap: 18 })}${i < 2 ? down(183, leftY[i] + 67) : ''}`).join('')}
  <path d="M251 445h84v-20l31 41-31 41v-20h-84z" fill="${GOLD}"/>${lines(c.arrow, 292, c.arrow.length === 1 ? 473 : 464, { face: 'display', size: 19, anchor: 'middle', gap: 18 })}
  ${icon(c.top[0], 394, 356, 44)}${lines(c.top.slice(1), 454, 375, { face: 'display', size: 16, gap: 18 })}${down(476, 414)}
  ${icon(c.mid[0], 394, 425, 44)}${lines(c.mid.slice(1), 454, 444, { face: 'display', size: 16, gap: 18 })}${down(476, 483)}
  ${c.benefits.map((b, i) => `${icon(b[0], 372 + i * 78, 497, 42)}${lines(b.slice(1), 393 + i * 78, 552, { face: 'display', size: 14, anchor: 'middle', gap: 16 })}`).join('')}
  <path d="M380 587v8h194v-8M477 595v15l-6-7m6 7l6-7" fill="none" stroke="${GOLD}" stroke-width="2"/>
  ${lines(c.outcome, 479, 624, { face: 'display', size: 17, anchor: 'middle', weight: 400, gap: 19 })}
  ${mark(c.reassureMark, 112, 670, 70, 64)}<line x1="196" y1="669" x2="196" y2="730" stroke="${GOLD}" stroke-width="2"/>${txt(c.reassureTitle, 218, 691, { face: 'display', size: 18 })}${lines(c.reassure, 218, 709, { size: 10.5, gap: 14 })}
  <rect x="20" y="740" width="623" height="122" fill="${NAVY}"/>${qr()}<path d="M172 780q18-21 25 8" fill="none" stroke="${GOLD}" stroke-width="2"/><path d="M170 781l8-2-2 8" fill="none" stroke="${GOLD}" stroke-width="2"/>${lines(['SCAN', 'ME'], 183, 808, { face: 'display', size: 18, fill: GOLD, gap: 18 })}<line x1="231" y1="748" x2="231" y2="854" stroke="${GOLD}"/>
  ${txt(c.cta, 249, 775, { face: 'display', size: 24, fill: '#fff' })}${icon('play', 249, 783, 29, '#fff', 3)}${txt(c.cta1, 288, 805, { face: 'display', size: 17, fill: GOLD })}<line x1="288" y1="811" x2="604" y2="811" stroke="${GOLD}"/>${icon('calendar', 249, 819, 29, '#fff', 3)}${txt(c.cta2, 288, 841, { face: 'display', size: 17, fill: GOLD })}<line x1="288" y1="847" x2="604" y2="847" stroke="${GOLD}"/>${txt(c.note, 278, 859, { face: 'display', size: 11, fill: GOLD })}
  ${c.foot.map((f, i) => `${i ? `<line x1="${232 + (i - 1) * 195}" y1="869" x2="${232 + (i - 1) * 195}" y2="894" stroke="#333"/>` : ''}${icon(c.footIcons[i], 72 + i * 195, 866, 28)}${txt(f, 105 + i * 195, 886, { face: 'display', size: 12 })}`).join('')}
  </svg>`
}

for (const [audience, config] of Object.entries(configs)) {
  const svg = flyer(config)
  for (const name of [`${audience}-reference-layout.svg`, `${audience}-approved-layout.svg`]) {
    const target = path.join(ROOT, name)
    fs.writeFileSync(target, svg)
    console.log(`Wrote ${target}`)
  }
}
