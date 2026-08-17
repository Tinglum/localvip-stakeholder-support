import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('public/templates/olathe')
function inlineMark(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const viewBox = source.match(/viewBox="([^"]+)"/)?.[1]
  const body = source.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/s, '')
  if (!viewBox) throw new Error(`${file} is missing a viewBox`)
  return { viewBox, body }
}

const owl = inlineMark('olathe-west-official.svg')
const district = inlineMark('olathe-public-schools-official.svg')

const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const lines = (items, x, y, options = {}) => {
  const { size = 28, weight = 500, color = '#0a2342', gap = size * 1.28, anchor = 'start' } = options
  return items.map((line, index) => `<text x="${x}" y="${y + index * gap}" text-anchor="${anchor}" class="sans" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(line)}</text>`).join('\n')
}

function logoLockup(mark = owl, districtWide = false) {
  const labelX = districtWide ? 192 : 136
  return `<g transform="translate(58 50)">
    <rect width="908" height="112" rx="22" fill="#fff" opacity=".97"/>
    <svg x="24" y="12" width="92" height="88" viewBox="${mark.viewBox}" preserveAspectRatio="xMidYMid meet" overflow="hidden">${mark.body}</svg>
    <text x="${labelX}" y="48" class="sans" font-size="26" font-weight="900" fill="#081b35">${districtWide ? 'OLATHE PUBLIC SCHOOLS' : 'OLATHE WEST HIGH SCHOOL'}</text>
    <text x="${labelX}" y="78" class="sans" font-size="18" font-weight="700" letter-spacing="2.4" fill="#55708e">COMMUNITY GIVEBACK</text>
    <g transform="translate(694 23)">
      <circle cx="30" cy="30" r="30" fill="#2165d6"/>
      <path d="M18 31c9-12 18-15 28-11-8 4-13 9-15 16 7-3 12-2 17 1-10 7-21 8-30-6z" fill="#fff"/>
      <text x="72" y="39" class="sans" font-size="24" font-weight="900" fill="#081b35">LocalVIP</text>
    </g>
  </g>`
}

// Header artwork sits in a band BELOW the headline (y 352-450) rather than
// behind it.
//
// The previous version drew full-height scenes from y~150, so storefront and
// schoolhouse outlines cut straight through the title and subtitle on all three
// flyers, and a gold flourish crossed the headline. Keeping the art as a low
// silhouette strip preserves the sense of place while leaving the words on a
// clean field -- which matters more here than illustration, because these go to
// principals and business owners as outreach.
const HERO_TOP = 352
const HERO_BASE = 450

function vectorHero(kind) {
  if (kind === 'business') {
    return `<g opacity=".30">
      <g fill="#dbe9ff">
        <path d="M96 ${HERO_BASE}v-56h150v56zM118 394h106l16 34H102zM272 ${HERO_BASE}v-74h168v74zM296 ${HERO_TOP}h120l20 24H276zM466 ${HERO_BASE}v-60h140v60zM486 400h100l14 30H472zM632 ${HERO_BASE}v-80h176v80zM656 358h128l18 32H638zM834 ${HERO_BASE}v-52h94v52zM850 396h62l12 32h-86z"/>
      </g>
      <g fill="#0d2c52" opacity=".55">
        <path d="M150 ${HERO_BASE}v-30h44v30zM330 ${HERO_BASE}v-38h52v38zM508 ${HERO_BASE}v-32h46v32zM700 ${HERO_BASE}v-42h56v42zM864 ${HERO_BASE}v-26h36v26z"/>
      </g>
      <rect x="72" y="${HERO_BASE}" width="880" height="6" rx="3" fill="#f4b41a" opacity=".65"/>
    </g>`
  }
  if (kind === 'family') {
    return `<g opacity=".32" fill="#dbe9ff">
      <circle cx="176" cy="384" r="26"/><circle cx="252" cy="372" r="32"/><circle cx="330" cy="388" r="23"/>
      <circle cx="700" cy="380" r="28"/><circle cx="776" cy="374" r="24"/>
      <path d="M132 ${HERO_BASE}c4-46 22-70 44-70s40 24 44 70zM202 ${HERO_BASE}c5-56 26-84 50-84s45 28 50 84zM294 ${HERO_BASE}c4-42 20-63 36-63s34 21 38 63z"/>
      <path d="M654 ${HERO_BASE}c5-50 24-75 46-75s41 25 46 75zM734 ${HERO_BASE}c4-43 20-64 42-64s38 21 42 64z"/>
      <rect x="72" y="${HERO_BASE}" width="880" height="6" rx="3" fill="#f4b41a" opacity=".65"/>
    </g>`
  }
  return `<g opacity=".32">
    <g fill="#dbe9ff">
      <path d="M336 ${HERO_BASE}v-72h352v72zM512 ${HERO_TOP - 18}l196 78H316z"/>
      <path d="M150 ${HERO_BASE}v-56h150v56zM724 ${HERO_BASE}v-56h150v56z"/>
    </g>
    <g fill="#0d2c52" opacity=".55">
      <path d="M486 ${HERO_BASE}v-44h52v44zM200 ${HERO_BASE}v-30h40v30zM784 ${HERO_BASE}v-30h40v30z"/>
    </g>
    <rect x="72" y="${HERO_BASE}" width="880" height="6" rx="3" fill="#f4b41a" opacity=".65"/>
  </g>`
}

// Line-art glyphs drawn in a 48x48 box centred on the card's badge. The cards
// previously showed the first letter of the heading ("R", "C", "S"), which read
// as an unfinished placeholder rather than an icon set.
const GLYPHS = {
  repeat: '<path d="M12 24a12 12 0 1 1 4 9" /><path d="M12 15v9h9" />',
  customers: '<circle cx="18" cy="18" r="7"/><path d="M6 38c0-7 5-12 12-12s12 5 12 12"/><path d="M31 12l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>',
  slowday: '<circle cx="24" cy="24" r="14"/><path d="M24 15v9l6 4"/>',
}

function glyph(name) {
  return `<g transform="translate(20 20)" fill="none" stroke="#2165d6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name]}</g>`
}

function iconCard({ x, y, title, body, icon }) {
  return `<g transform="translate(${x} ${y})">
    <rect width="276" height="228" rx="24" fill="#fff" stroke="#cbd8e7" stroke-width="2"/>
    <circle cx="44" cy="44" r="26" fill="#e8f1ff"/>
    ${GLYPHS[icon]
      ? glyph(icon)
      : `<text x="44" y="54" text-anchor="middle" class="sans" font-size="28" font-weight="900" fill="#2165d6">${esc(icon)}</text>`}
    <text x="24" y="98" class="sans" font-size="23" font-weight="900" fill="#081b35">${esc(title)}</text>
    ${lines(body, 24, 132, { size: 17, gap: 24, color: '#405a78' })}
  </g>`
}

function qrPlaceholder() {
  return `<g id="qr-placeholder" transform="translate(776 1286)">
    <!-- The guide is inset 6px inside the 170px QR zone. Drawn on the zone
         boundary it survived the stamp as a dashed ring around the finished QR,
         because the code is rendered at exactly the zone size. -->
    <rect x="6" y="6" width="158" height="158" rx="14" fill="#fff" stroke="#e6a817" stroke-width="4" stroke-dasharray="10 8"/>
    <path d="M38 56V38h18M114 38h18v18M132 114v18h-18M56 132H38v-18" fill="none" stroke="#9b6a00" stroke-width="5" stroke-linecap="round"/>
    <text x="85" y="82" text-anchor="middle" class="sans" font-size="14" font-weight="900" fill="#8b6500">PLACE QR</text>
    <text x="85" y="101" text-anchor="middle" class="sans" font-size="14" font-weight="900" fill="#8b6500">CODE HERE</text>
  </g>`
}

function shell({ title, titleSize = 52, subtitle, heroKind, content, cta, mark = owl, districtWide = false, accent = '#f4b41a' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536" role="img" aria-label="${esc(title)}">
  <defs>
    <style>.sans{font-family:Inter,Arial,Helvetica,sans-serif}.cond{font-family:Impact,'Arial Narrow',Arial,sans-serif}</style>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#163a68"/><stop offset="1" stop-color="#06162a"/></linearGradient>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7fbff"/><stop offset="1" stop-color="#edf3f9"/></linearGradient>
  </defs>
  <rect width="1024" height="1536" fill="url(#page)"/>
  <rect width="1024" height="480" fill="url(#shade)"/>
  ${vectorHero(heroKind)}
  ${logoLockup(mark, districtWide)}
  <text x="512" y="252" text-anchor="middle" class="cond" font-size="${titleSize}" letter-spacing="1.2" fill="#fff">${esc(title)}</text>
  ${lines(subtitle, 512, 298, { size: 22, weight: 650, color: '#fff', gap: 29, anchor: 'middle' })}
  <rect x="0" y="470" width="1024" height="12" fill="${accent}"/>
  ${content}
  <rect x="48" y="1254" width="928" height="234" rx="30" fill="#081b35"/>
  <rect x="48" y="1254" width="928" height="10" rx="5" fill="${accent}"/>
  ${lines(cta, 86, 1320, { size: 30, weight: 900, color: '#fff', gap: 40 })}
  <text x="86" y="1434" class="sans" font-size="18" font-weight="600" fill="#b8c8dc">Scan to connect this flyer to the right campaign.</text>
  ${qrPlaceholder()}
  </svg>`
}

const business = shell({
  title: 'TURN LOCAL SUPPORT INTO REPEAT BUSINESS',
  subtitle: ['Add a community-powered reason for customers to choose you,', 'come back, and introduce your business to more local families.'],
  heroKind: 'business',
  content: `<text x="58" y="548" class="sans" font-size="19" font-weight="800" letter-spacing="3" fill="#2165d6">WHAT DOES LOCALVIP ADD</text>
  <text x="58" y="600" class="sans" font-size="42" font-weight="900" fill="#081b35">More value from every relationship.</text>
  ${iconCard({ x: 58, y: 642, icon: 'repeat', title: 'Repeat visits', body: ['Give customers another', 'reason to return and', 'choose you again.'] })}
  ${iconCard({ x: 374, y: 642, icon: 'customers', title: 'Your customers', body: ['Reward the people', 'already supporting your', 'business today.'] })}
  ${iconCard({ x: 690, y: 642, icon: 'slowday', title: 'Your slow day', body: ['Choose when you want', 'more traffic and create', 'a reason to come in.'] })}
  <rect x="58" y="910" width="908" height="278" rx="26" fill="#fff" stroke="#cbd8e7" stroke-width="2"/>
  <text x="86" y="966" class="sans" font-size="27" font-weight="900" fill="#081b35">A stronger reason to stay local</text>
  ${lines(['LocalVIP adds a measurable community benefit to the customer', 'relationship—plus access to school families and the wider LocalVIP', 'network. Choose a slower day or time and invite more business in.', '', 'You keep the customers and reputation you have already earned.', 'LocalVIP adds another reason to return, connect, and refer.'], 86, 1009, { size: 19, gap: 29, color: '#405a78' })}`,
  cta: ['ONGOING CONNECTION.', 'MORE WAYS TO WIN.'],
})

const parent = shell({
  title: 'EVERYDAY SPENDING CAN SUPPORT YOUR SCHOOL',
  titleSize: 48,
  subtitle: ['Connect with participating local businesses and turn ordinary', 'purchases into savings and added support for Olathe West.'],
  heroKind: 'family',
  content: `<text x="58" y="548" class="sans" font-size="19" font-weight="800" letter-spacing="3" fill="#2165d6">FOR PARENTS, FAMILIES &amp; SUPPORTERS</text>
  <text x="58" y="600" class="sans" font-size="42" font-weight="900" fill="#081b35">Support that fits everyday life.</text>
  ${iconCard({ x: 58, y: 642, icon: '1', title: 'Connect', body: ['Join through your', 'school’s official', 'campaign code.'] })}
  ${iconCard({ x: 374, y: 642, icon: '2', title: 'Shop local', body: ['Choose participating', 'businesses you already', 'know and trust.'] })}
  ${iconCard({ x: 690, y: 642, icon: '3', title: 'Grow impact', body: ['Build savings while', 'supporting your school', 'and community.'] })}
  <rect x="58" y="910" width="908" height="278" rx="26" fill="#fff" stroke="#cbd8e7" stroke-width="2"/>
  <text x="86" y="966" class="sans" font-size="27" font-weight="900" fill="#081b35">One connection. Ongoing local impact.</text>
  ${lines(['LocalVIP creates another way for families, schools, and local', 'businesses to win together. Your normal choices can strengthen the', 'places that serve your family and the school community you care about.', '', 'Use the campaign QR code below to join the correct Olathe West', 'experience and see participating opportunities.'], 86, 1009, { size: 19, gap: 29, color: '#405a78' })}`,
  cta: ['YOUR FAMILY. YOUR SCHOOL.', 'MORE WAYS TO MAKE AN IMPACT.'],
})

const school = shell({
  title: 'GROW SCHOOL SUPPORT THROUGH LOCAL CONNECTIONS',
  titleSize: 44,
  subtitle: ['Give every school a repeatable way to connect families, businesses,', 'and community support—without creating a new flyer for every campus.'],
  heroKind: 'school',
  mark: district,
  districtWide: true,
  content: `<text x="58" y="548" class="sans" font-size="19" font-weight="800" letter-spacing="3" fill="#2165d6">A DISTRICT-READY COMMUNITY MODEL</text>
  <text x="58" y="600" class="sans" font-size="42" font-weight="900" fill="#081b35">One framework. School-specific campaigns.</text>
  ${iconCard({ x: 58, y: 642, icon: '1', title: 'Easy activation', body: ['Add the right school QR', 'without redesigning the', 'entire flyer.'] })}
  ${iconCard({ x: 374, y: 642, icon: '2', title: 'Local alignment', body: ['Connect each campus', 'with families and nearby', 'business partners.'] })}
  ${iconCard({ x: 690, y: 642, icon: '3', title: 'Room to grow', body: ['Start with one school', 'and expand through a', 'consistent district tool.'] })}
  <rect x="58" y="910" width="908" height="278" rx="26" fill="#fff" stroke="#cbd8e7" stroke-width="2"/>
  <text x="86" y="966" class="sans" font-size="27" font-weight="900" fill="#081b35">Built for principals, teams, and district leaders</text>
  ${lines(['The core message stays consistent across Olathe Public Schools.', 'Each authorized admin adds the QR code for the correct school or', 'campaign, so families always land in the right experience.', '', 'That means less collateral to maintain, clearer outreach, and a', 'recognizable community-giveback program that can scale.'], 86, 1009, { size: 19, gap: 29, color: '#405a78' })}`,
  cta: ['YOUR SCHOOL. OUR COMMUNITY.', 'MORE WAYS TO GROW.'],
})

for (const [name, svg] of Object.entries({
  'business-giveback-template.svg': business,
  'parent-supporter-template.svg': parent,
  'school-outreach-template.svg': school,
})) {
  fs.writeFileSync(path.join(root, name), svg)
  console.log(`Wrote ${name}`)
}
