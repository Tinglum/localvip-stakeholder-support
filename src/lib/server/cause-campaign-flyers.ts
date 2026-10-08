import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { Resvg } from '@resvg/resvg-js'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'

export type FlyerAudience = 'business' | 'families' | 'schools' | 'boosters'
export type FlyerKind = 'cause' | 'school' | 'booster'
export const FLYER_DESIGNS = ['community', 'growth', 'comparison'] as const
export type FlyerDesign = (typeof FLYER_DESIGNS)[number]

const templateDir = path.join(process.cwd(), 'src/lib/server/flyer-templates')
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]!)
function color(value: string | undefined, fallback: string, minBrightness: number, maxBrightness: number) {
  if (!/^#[0-9a-f]{6}$/i.test(value || '')) return fallback
  const rgb = [1, 3, 5].map(index => parseInt(value!.slice(index, index + 2), 16))
  const brightness = rgb[0] * .21 + rgb[1] * .72 + rgb[2] * .07
  return brightness >= minBrightness && brightness <= maxBrightness ? value! : fallback
}

export function flyerKind(category?: string | null, name = ''): FlyerKind {
  const identity = `${category || ''} ${name}`
  if (/booster|pta|pto|parent.teacher|athletic club/i.test(identity)) return 'booster'
  if (/school|district|academy|education/i.test(identity)) return 'school'
  return 'cause'
}

function allowedImageUrl(value: string) {
  const url = new URL(value)
  const qa = new URL(QA_AUTH_CONFIG.baseUrl)
  if (url.protocol !== 'https:' || url.origin !== qa.origin || !url.pathname.startsWith('/uploads/')) {
    throw new Error('Flyer images must be uploaded to the LocalVIP asset host.')
  }
  return url.toString()
}

async function imageData(url: string) {
  const response = await fetch(allowedImageUrl(url), { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Could not load flyer image (${response.status}).`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 12 * 1024 * 1024) throw new Error('Flyer image exceeds 12 MB.')
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const image = await loadImage(bytes)
    const canvas = createCanvas(image.width, image.height)
    canvas.getContext('2d').drawImage(image, 0, 0)
    return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`
  }
  const mime = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
    : bytes.toString('utf8', 0, 300).includes('<svg') ? 'image/svg+xml' : null
  if (!mime) throw new Error('Flyer image must be PNG, JPEG, or SVG.')
  return `data:${mime};base64,${bytes.toString('base64')}`
}

const measure = createCanvas(1, 1).getContext('2d')
function wrap(value: string, width: number, size: number, weight = 400) {
  measure.font = `${weight} ${size}px Arial`
  const lines: string[] = []
  let line = ''
  for (const word of value.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure.measureText(next).width > width) { lines.push(line); line = word }
    else line = next
  }
  if (line) lines.push(line)
  return lines
}
function textLines(value: string, x: number, y: number, width: number, size: number,
  lineHeight: number, css: string, maxLines = 3, anchor = 'start') {
  let fontSize = size
  let lines = wrap(value, width, fontSize, css.includes('display') ? 900 : 400)
  while (lines.length > maxLines && fontSize > 15) {
    fontSize -= 2
    lines = wrap(value, width, fontSize, css.includes('display') ? 900 : 400)
  }
  if (lines.length > maxLines) throw new Error(`Flyer text is too long: ${value.slice(0, 50)}`)
  return lines.map((line, index) => `<text class="${css}" x="${x}" y="${y + index * lineHeight}" font-size="${fontSize}" text-anchor="${anchor}">${esc(line)}</text>`).join('')
}

type Step = { title: string; detail: string; icon: 'calendar' | 'tag' | 'megaphone' | 'heart' | 'compass' | 'bag' | 'story' | 'store' }
function content(audience: FlyerAudience, kind: FlyerKind) {
  const subject = kind === 'school' ? 'school' : kind === 'booster' ? 'club' : 'cause'
  if (audience === 'business') return {
    headline: ['YOUR BUSINESS.', 'OUR COMMUNITY.', "LET'S GROW", 'TOGETHER.'],
    intro: `Host a Giveback Day that brings nearby customers through your door and helps a ${subject} they care about.`,
    steps: [
      { title: 'PICK A DAY', detail: 'Choose a day that fits your business.', icon: 'calendar' },
      { title: 'SET YOUR OFFER', detail: 'Make it easy for customers to take part.', icon: 'tag' },
      { title: 'WE SPREAD THE WORD', detail: 'Invite local supporters to visit.', icon: 'megaphone' },
      { title: 'SEE THE IMPACT', detail: `Qualifying purchases help the ${subject}.`, icon: 'heart' },
    ] as Step[],
    cta: ['PLAN A GIVEBACK DAY', 'WITH YOUR COMMUNITY.'],
    left: ['CUSTOMERS BENEFIT', 'Local offers and rewarding experiences.'],
    right: ['YOUR BUSINESS BENEFITS', 'New connections and lasting loyalty.'],
  }
  if (audience === 'families') return {
    headline: ['SHOP LOCAL.', 'GIVE BACK.', 'MAKE MORE', 'POSSIBLE.'],
    intro: `Find nearby offers, enjoy the places you love, and support this ${subject} through qualifying purchases.`,
    steps: [
      { title: 'FIND LOCAL OFFERS', detail: 'Explore participating businesses nearby.', icon: 'compass' },
      { title: 'CHOOSE WHAT FITS', detail: 'Pick an offer you want to use.', icon: 'tag' },
      { title: 'SHOP NEARBY', detail: 'Enjoy the offer and earn rewards.', icon: 'bag' },
      { title: 'HELP IT GROW', detail: `Qualifying purchases support the ${subject}.`, icon: 'heart' },
    ] as Step[],
    cta: ['DISCOVER LOCAL OFFERS', `SUPPORT THIS ${subject.toUpperCase()}.`],
    left: ['SUPPORTERS BENEFIT', 'Useful offers from local businesses.'],
    right: ['BUSINESSES BENEFIT', 'More neighbors shopping nearby.'],
  }
  if (audience === 'boosters') return {
    headline: ['YOUR CLUB.', 'OUR COMMUNITY.', 'MORE WAYS', 'TO GROW.'],
    intro: `See how another club can bring local businesses and supporters together around a Giveback Day, then keep the connection going.`,
    steps: [
      { title: 'SEE THE MODEL', detail: 'Learn how the campaign works.', icon: 'story' },
      { title: 'MAKE IT YOURS', detail: 'Use your club identity and goals.', icon: 'tag' },
      { title: 'INVITE PARTNERS', detail: 'Bring nearby businesses into the plan.', icon: 'store' },
      { title: 'GROW SUPPORT', detail: 'Give families a simple way to join.', icon: 'heart' },
    ] as Step[],
    cta: ['EXPLORE THE MODEL', 'FOR YOUR BOOSTER CLUB.'],
    left: ['FAMILIES BENEFIT', 'A clear way to support their club.'],
    right: ['PARTNERS BENEFIT', 'More local connection and loyalty.'],
  }
  return {
    headline: ['YOUR MISSION.', 'OUR COMMUNITY.', "LET'S BUILD", 'TOGETHER.'],
    intro: `Share what matters to your ${subject}, invite local businesses, and give supporters a simple way to get involved.`,
    steps: [
      { title: 'TELL YOUR STORY', detail: 'Show the community what you are working toward.', icon: 'story' },
      { title: 'INVITE PARTNERS', detail: 'Welcome businesses that want to help.', icon: 'store' },
      { title: 'RALLY SUPPORTERS', detail: 'Share your campaign with local people.', icon: 'megaphone' },
      { title: 'SEE THE IMPACT', detail: 'Keep your community connected.', icon: 'heart' },
    ] as Step[],
    cta: ['BRING PEOPLE TOGETHER', 'START YOUR CAMPAIGN.'],
    left: ['SUPPORTERS BENEFIT', 'An easy way to get involved locally.'],
    right: ['BUSINESSES BENEFIT', 'Stronger community relationships.'],
  }
}

function stepIcon(kind: Step['icon']) {
  const common = 'fill="none" stroke="{{NAVY}}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"'
  const drawings: Record<Step['icon'], string> = {
    calendar: '<rect x="10" y="16" width="52" height="48" rx="6"/><path d="M10 30h52M23 8v16M49 8v16"/><path d="m35 48 6 6 11-14" stroke="{{GOLD}}"/>',
    tag: '<path d="M9 35 35 9h29v29L38 64z"/><circle cx="49" cy="24" r="4" fill="{{GOLD}}" stroke="none"/>',
    megaphone: '<path d="M8 33 53 13v43L8 42zM17 44l8 22h14l-9-20"/><path d="M61 22l9-7M63 35h10M60 48l10 7" stroke="{{GOLD}}"/>',
    heart: '<path d="M35 59S8 43 8 25c0-17 23-21 27-5 4-16 27-12 27 5 0 18-27 34-27 34z" fill="{{GOLD}}" stroke="{{NAVY}}"/>',
    compass: '<circle cx="36" cy="36" r="29"/><path d="m46 25-9 23-14 5 9-23z" fill="{{GOLD}}"/>',
    bag: '<path d="M11 27h50l-4 39H15zM25 29v-8a11 11 0 0 1 22 0v8"/><path d="m31 45 5 5 10-11" stroke="{{GOLD}}"/>',
    story: '<path d="M8 13h25c9 0 13 4 13 11v40c-4-4-9-6-14-6H8zM46 24c0-7 4-11 13-11h5v45h-5c-5 0-9 2-13 6"/><path d="M17 28h17M17 39h17" stroke="{{GOLD}}"/>',
    store: '<path d="M10 31h54l-5-21H15zM15 36v29h44V36M31 65V45h13v20"/><path d="M10 31c3 12 15 12 18 0 3 12 15 12 18 0 3 12 15 12 18 0" stroke="{{GOLD}}"/>',
  }
  return `<g ${common}>${drawings[kind]}</g>`
}

function renderSteps(steps: Step[]) {
  return steps.map((step, index) => {
    const x = 28 + index * 256
    const center = x + 128
    return `<g>
      ${index ? `<line x1="${x}" y1="716" x2="${x}" y2="960" stroke="#d3dbe3" stroke-width="2"/>` : ''}
      <circle cx="${center}" cy="723" r="19" fill="{{NAVY}}"/>
      <text class="sans white" x="${center}" y="731" font-size="21" font-weight="700" text-anchor="middle">${index + 1}</text>
      <circle cx="${center}" cy="802" r="46" fill="#f1f5f8" stroke="#d4dee8" stroke-width="2"/>
      <g transform="translate(${center - 36} 766)">${stepIcon(step.icon)}</g>
      ${textLines(step.title, center, 878, 226, 19, 23, 'display navy', 2, 'middle')}
      ${textLines(step.detail, center, 931, 219, 16, 21, 'sans navy', 3, 'middle')}
    </g>`
  }).join('')
}

function growthFields(copy: ReturnType<typeof content>, audience: FlyerAudience, kind: FlyerKind) {
  const headlines: Record<FlyerAudience, string[]> = {
    business: ['TURN YOUR NEXT', 'GIVEBACK DAY', 'INTO SOMETHING', 'BIGGER.'],
    families: ['YOUR EVERYDAY', 'SHOPPING CAN', 'DO MORE', 'LOCALLY.'],
    schools: ['TURN LOCAL', 'SUPPORT INTO', 'LASTING', 'MOMENTUM.'],
    boosters: ['YOUR NEXT', 'FUNDRAISER', 'CAN GO', 'FURTHER.'],
  }
  const hero = headlines[audience].map((line, index) => `<text class="display ${index < 2 ? 'white' : 'gold'}" x="59" y="${247 + 72 * index}" font-size="62">${esc(line)}</text>`).join('')
  const cards = copy.steps.map((step, index) => {
    const x = index % 2 ? 542 : 41
    const y = index < 2 ? 746 : 859
    const dark = index === 1 || index === 2
    const fill = dark ? '{{NAVY}}' : '#f1f4f7'
    const textColor = dark ? 'white' : 'navy'
    return `<rect x="${x}" y="${y}" width="466" height="99" rx="12" fill="${fill}"/>
      <circle cx="${x + 36}" cy="${y + 35}" r="23" fill="${dark ? '{{GOLD}}' : '{{NAVY}}'}"/>
      <text class="sans ${dark ? 'navy' : 'white'}" x="${x + 36}" y="${y + 43}" font-size="23" font-weight="700" text-anchor="middle">${index + 1}</text>
      ${textLines(step.title, x + 73, y + 34, 375, 20, 22, `display ${textColor}`, 1)}
      ${textLines(step.detail, x + 73, y + 62, 370, 15, 19, `sans ${textColor}`, 2)}`
  }).join('')
  const beneficiary = kind === 'school' ? 'THE SCHOOL BENEFITS' : kind === 'booster' ? 'THE CLUB BENEFITS' : 'THE CAUSE BENEFITS'
  const benefits = [copy.left, [beneficiary, 'More support for its work.'], copy.right].map(([title, detail], index) => {
    const x = [200, 525, 850][index]
    return `${textLines(title, x, 1162, 292, 18, 22, 'display navy', 1, 'middle')}
      ${textLines(detail, x, 1196, 290, 16, 22, 'sans navy', 2, 'middle')}`
  }).join('')
  return {
    GROWTH_HERO: hero,
    GROWTH_INTRO: textLines(copy.intro, 60, 542, 600, 22, 30, 'sans white', 4),
    GROWTH_SECTION_TITLE: esc(audience === 'boosters' ? 'ONE MODEL. FOUR WAYS TO GET STARTED.' : 'ONE CAMPAIGN. FOUR WAYS TO KEEP GROWING.'),
    GROWTH_CARDS: cards,
    GROWTH_BENEFITS: benefits,
  }
}

function comparisonFields(copy: ReturnType<typeof content>, audience: FlyerAudience, headerLines: string[], headerSize: number, kindLabel: string, name: string) {
  const titles: Record<FlyerAudience, string> = {
    business: 'ONE GIVEBACK DAY CAN BECOME MORE THAN ONE DAY.',
    families: 'ONE LOCAL PURCHASE CAN HELP MORE THAN ONE DAY.',
    schools: 'ONE CAMPAIGN CAN KEEP YOUR COMMUNITY GROWING.',
    boosters: 'ONE FUNDRAISER CAN LEAD TO MORE THAN ONE DAY.',
  }
  const left: Record<FlyerAudience, [string, string][]> = {
    business: [['Pick a day', 'Choose a day that works for your business.'], ['Invite customers', 'Tell neighbors when to visit.'], ['The day ends', 'Celebrate the support you made possible.']],
    families: [['Hear about an event', 'Find a way to show up.'], ['Shop that day', 'Support the organization once.'], ['Wait for the next one', 'Look for another chance to help.']],
    schools: [['Plan a fundraiser', 'Set a date and find volunteers.'], ['Rally supporters', 'Ask families to show up.'], ['Start again later', 'Plan the next event from scratch.']],
    boosters: [['Plan the event', 'Choose a date and a location.'], ['Recruit volunteers', 'Ask families to spread the word.'], ['Start again next time', 'Repeat the work for another event.']],
  }
  const right: Record<FlyerAudience, [string, string][]> = {
    business: [['Promote the day', 'Invite the organization’s supporters.'], ['Reward shoppers', 'Customers can enjoy your offer.'], ['Stay connected', 'Keep building local relationships.']],
    families: [['Find local offers', 'See participating businesses nearby.'], ['Shop on your schedule', 'Choose an offer that suits you.'], ['Keep supporting', 'Qualifying purchases can give back.']],
    schools: [['Tell your story', 'Give supporters a clear place to start.'], ['Invite partners', 'Work with nearby businesses.'], ['Stay connected', 'Share new ways to take part.']],
    boosters: [['Set up your club page', 'Show what your club is working toward.'], ['Invite partners', 'Welcome local businesses.'], ['Keep it going', 'Give families more ways to help.']],
  }
  const card = (x: number, rows: [string, string][]) => rows.map(([title, detail], index) => {
    const y = 555 + index * 148
    return `<circle cx="${x + 48}" cy="${y}" r="20" fill="{{NAVY}}"/>
      <text class="sans white" x="${x + 48}" y="${y + 7}" font-size="20" text-anchor="middle" font-weight="700">${index + 1}</text>
      ${textLines(title, x + 84, y - 5, 340, 22, 26, 'display navy', 1)}
      ${textLines(detail, x + 84, y + 28, 332, 18, 24, 'sans navy', 2)}
      ${index < 2 ? `<path d="M${x + 48} ${y + 45}v42m-9-10 9 11 9-11" fill="none" stroke="#9aa5af" stroke-width="3"/>` : ''}`
  }).join('')
  const identity = headerLines.map((line, index) => `<text class="display navy" x="225" y="${77 + index * 38}" font-size="${headerSize}">${esc(line)}</text>`).join('')
    + `<text class="sans navy" x="226" y="${headerLines.length === 2 ? 151 : 121}" font-size="16" letter-spacing="1.2">${esc(kindLabel)}</text>`
  return {
    COMPARE_HEADER: identity,
    COMPARE_TITLE: textLines(titles[audience], 525, 246, 972, 57, 68, 'display navy', 2, 'middle'),
    COMPARE_SUBTITLE: textLines('The familiar idea. More ways for everyone to benefit.', 525, 390, 770, 22, 25, 'sans navy', 1, 'middle'),
    COMPARE_CARDS: `<text class="display white" x="271" y="473" font-size="26" text-anchor="middle">THE ONE-DAY MODEL</text>
      <text class="display white" x="778" y="473" font-size="26" text-anchor="middle">WHAT LOCALVIP ADDS</text>
      ${card(40, left[audience])}${card(547, right[audience])}`,
    COMPARE_NOTE: `<text class="display navy" x="318" y="1116" font-size="28">THE PURPOSE STAYS THE SAME.</text>
      ${textLines(`Support ${name} and give people more ways to stay connected.`, 318, 1161, 650, 21, 28, 'sans navy', 2)}`,
    COMPARE_CTA: `<text class="display white" x="262" y="1310" font-size="37">${esc(copy.cta[0])}</text>
      <text class="display gold" x="262" y="1361" font-size="36">${esc(copy.cta[1])}</text>`,
  }
}

async function brightenPhoto(dataUrl: string) {
  const width = 1875
  const height = 1725
  let image
  try {
    image = await loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'))
  } catch {
    // Some valid large PNGs are rejected by canvas's decoder. Resvg uses the
    // same renderer as the final template and normalizes them first.
    const normalized = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${dataUrl}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/></svg>`).render().asPng()
    image = await loadImage(normalized)
  }
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const scale = Math.max(width / image.width, height / image.height)
  ctx.drawImage(image, (width - image.width * scale) / 2, (height - image.height * scale) / 2,
    image.width * scale, image.height * scale)
  const pixels = ctx.getImageData(0, 0, width, height)
  let brightness = 0, samples = 0
  for (let i = 0; i < pixels.data.length; i += 64) {
    brightness += (pixels.data[i] * .21 + pixels.data[i + 1] * .72 + pixels.data[i + 2] * .07)
    samples++
  }
  const mean = brightness / samples
  const gamma = mean < 85 ? .56 : mean < 115 ? .72 : mean < 145 ? .88 : 1
  if (gamma < 1) {
    const lut = Array.from({ length: 256 }, (_, value) => Math.round(255 * (value / 255) ** gamma))
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = lut[pixels.data[i]]
      pixels.data[i + 1] = lut[pixels.data[i + 1]]
      pixels.data[i + 2] = lut[pixels.data[i + 2]]
    }
    ctx.putImageData(pixels, 0, 0)
  }
  return `data:image/png;base64,${(await canvas.encode('png')).toString('base64')}`
}

export async function renderCauseCampaignFlyer(input: {
  name: string; locality: string; logoUrl: string; coverUrl: string; joinUrl: string; audience: FlyerAudience
  design?: FlyerDesign; category?: string | null; mission?: string; parentOrganization?: string; colors?: { navy?: string; gold?: string }
}) {
  const name = input.name.trim()
  if (!name) throw new Error('A cause name is required for flyer generation.')
  const kind = flyerKind(input.category, name)
  const copy = content(input.audience, kind)
  const [logo, photo, template, brand] = await Promise.all([
    imageData(input.logoUrl), imageData(input.coverUrl).then(brightenPhoto),
    readFile(path.join(templateDir, `${input.design === 'growth' ? 'growth' : input.design === 'comparison' ? 'comparison' : 'campaign'}.svg`), 'utf8'),
    readFile(path.join(templateDir, 'localvip-mark.png')),
  ])
  const qr = await QRCode.toDataURL(input.joinUrl, { margin: 3, width: 164, errorCorrectionLevel: 'M' })
  const navy = color(input.colors?.navy, '#071d40', 0, 100)
  const gold = color(input.colors?.gold, '#efb719', 110, 235)
  const heading = name.toUpperCase()
  let headerSize = 39
  let headerLines = wrap(heading, 605, headerSize, 900)
  measure.font = `900 ${headerSize}px Arial`
  while ((headerLines.length > 2 || headerLines.some(line => measure.measureText(line).width > 605)) && headerSize > 22) {
    headerSize -= 2
    headerLines = wrap(heading, 605, headerSize, 900)
    measure.font = `900 ${headerSize}px Arial`
  }
  if (headerLines.length > 2 || headerLines.some(line => measure.measureText(line).width > 605)) {
    throw new Error('The cause name is too long for the flyer header.')
  }
  const kindLabel = kind === 'booster' ? 'BOOSTER CLUB' : kind === 'school' ? 'SCHOOL COMMUNITY' : 'COMMUNITY CAUSE'
  const parent = input.parentOrganization?.trim().toUpperCase()
  const identityLabel = parent && parent.length < 34 ? `${kindLabel} · ${parent}` : kindLabel
  const header = headerLines.map((line, index) => `<text class="display white" x="212" y="${75 + index * 37}" font-size="${headerSize}">${esc(line)}</text>`).join('')
    + `<text class="sans white" x="214" y="${headerLines.length === 2 ? 145 : 119}" font-size="15" letter-spacing="1.2">${esc(identityLabel)}</text>`
  const heroHeadline = copy.headline.map((line, index) => `<text class="display ${index < 2 ? 'white' : 'gold'}" x="58" y="${248 + index * 72}" font-size="63">${esc(line)}</text>`).join('')
  const heroIntro = textLines(copy.intro, 60, 542, 590, 22, 31, 'sans white', 4)
  const mission = input.mission?.trim().replace(/\s+/g, ' ')
  const missionLine = mission ? textLines(`THE GOAL · ${mission.length > 98 ? `${mission.slice(0, 95).trimEnd()}…` : mission}`,
    60, 624, 610, 17, 23, 'sans white', 2) : ''
  const middle = textLines(kind === 'booster' ? 'THE CLUB BENEFITS' : kind === 'school' ? 'THE SCHOOL BENEFITS' : 'THE CAUSE BENEFITS',
    525, 1162, 300, 20, 24, 'display navy', 1, 'middle')
  const benefits = [copy.left, [kind === 'booster' ? 'THE CLUB BENEFITS' : kind === 'school' ? 'THE SCHOOL BENEFITS' : 'THE CAUSE BENEFITS', 'More support for its work.'], copy.right]
    .map(([title, detail], index) => {
      const x = [200, 525, 850][index]
      return `${index === 1 ? middle : textLines(title, x, 1162, 290, 19, 23, 'display navy', 1, 'middle')}
        ${textLines(detail, x, 1196, 286, 16, 22, 'sans navy', 2, 'middle')}`
    }).join('')
  const supporterIcon = `<g fill="${navy}"><circle cx="200" cy="1054" r="13"/><circle cx="175" cy="1063" r="10"/><circle cx="225" cy="1063" r="10"/><path d="M159 1110c2-24 16-37 41-37s39 13 41 37z"/></g><path d="M200 1111s-20-12-20-25c0-12 18-15 20-2 2-13 20-10 20 2 0 13-20 25-20 25" fill="${gold}"/>`
  const storeIcon = `<g fill="none" stroke="${navy}" stroke-width="6" stroke-linejoin="round"><path d="M814 1068h72l-8-24h-56zM820 1075v36h60v-36M840 1111v-23h20v23"/></g><path d="M850 1104s-16-10-16-21c0-11 15-13 16-2 1-11 16-9 16 2 0 11-16 21-16 21" fill="${gold}"/>`
  const cta = `<text class="display white" x="228" y="1338" font-size="34">${esc(copy.cta[0])}</text>
    <text class="display gold" x="228" y="1385" font-size="37">${esc(copy.cta[1])}</text>`
  const replacements: Record<string, string> = {
    NAVY: navy, GOLD: gold, PHOTO: photo, LOGO: logo,
    BRAND: `data:image/png;base64,${brand.toString('base64')}`,
    QR: qr, HEADER: header, HERO_HEADLINE: heroHeadline, HERO_INTRO: heroIntro, MISSION: missionLine,
    STEPS: renderSteps(copy.steps), SUPPORTER_ICON: supporterIcon, STORE_ICON: storeIcon,
    BENEFITS: benefits, CTA: cta, CTA_NOTE: 'CAMPAIGN DETAILS INSIDE',
    LOCALITY: esc(input.locality.split(',')[0]?.trim().toUpperCase() || 'YOUR COMMUNITY'),
    ...(input.design === 'growth' ? growthFields(copy, input.audience, kind) : {}),
    ...(input.design === 'comparison' ? comparisonFields(copy, input.audience, headerLines, headerSize, kindLabel, name) : {}),
  }
  const svg = template.replace(/{{([A-Z_]+)}}/g, (_, key: string) => replacements[key] ?? '')
    .replace(/{{(NAVY|GOLD)}}/g, (_, key: string) => replacements[key])
  // A letter-size PDF needs roughly 300 pixels per printed inch. Rendering
  // the editable SVG at 2.5x keeps type, icons and QR modules crisp in print.
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 2625 } }).render().asPng()
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 612, height: 792 })
  return pdf.save()
}
