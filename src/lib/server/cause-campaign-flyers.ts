import { createCanvas, loadImage } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'

export type FlyerAudience = 'business' | 'families' | 'schools'

// Reusable layout based on the Olathe West flyer. School imagery is always the
// cause's uploaded logo and cover photo.
const flyers: Record<FlyerAudience, {
  kicker: string; hero: string[]; gold: string[]; intro: string;
  steps: Array<[string, string]>; cta: string
}> = {
  business: {
    kicker: 'FOR LOCAL BUSINESSES', hero: ['YOUR BUSINESS.', 'OUR COMMUNITY.'], gold: ["LET'S WIN", 'TOGETHER.'],
    intro: 'When local families win, local businesses win. Host a Giveback Day and connect with the people who already support this school.',
    steps: [['YOU PICK THE DAY', 'Choose a day that works for your business.'], ['WE PROMOTE YOU', 'Invite school families and local supporters.'], ['THEY SHOP', 'Customers enjoy your offer and give back.'], ['IMPACT CONTINUES', 'Build a relationship beyond one event.']],
    cta: 'PLAN YOUR FIRST GIVEBACK DAY',
  },
  families: {
    kicker: 'FOR FAMILIES & SUPPORTERS', hero: ['YOUR EVERYDAY.', 'THEIR FUTURE.'], gold: ["LET'S WIN", 'TOGETHER.'],
    intro: 'Support your school through the local places you already love. Discover offers, shop nearby, and help your community grow stronger.',
    steps: [['FIND LOCAL', 'Explore businesses in your community.'], ['CHOOSE AN OFFER', 'Pick an experience that works for you.'], ['SHOP & SAVE', 'Enjoy the offer while giving back.'], ['SCHOOL BENEFITS', 'Your everyday choices add up.']],
    cta: 'FIND YOUR LOCAL OFFER',
  },
  schools: {
    kicker: 'FOR SCHOOL & BOOSTER LEADERS', hero: ['YOUR SCHOOL.', 'OUR COMMUNITY.'], gold: ["LET'S WIN", 'TOGETHER.'],
    intro: 'Bring families and nearby businesses together around your school. One campaign can create lasting local support.',
    steps: [['SHARE YOUR GOAL', 'Tell your community what matters.'], ['INVITE PARTNERS', 'Welcome businesses that want to help.'], ['RALLY FAMILIES', 'Give supporters a simple way to join.'], ['GROW IMPACT', 'Keep the momentum going together.']],
    cta: 'BUILD YOUR SCHOOL CAMPAIGN',
  },
}

function allowedImageUrl(value: string) {
  const url = new URL(value)
  const qa = new URL(QA_AUTH_CONFIG.baseUrl)
  if (url.protocol !== 'https:' || url.origin !== qa.origin || !url.pathname.startsWith('/uploads/')) {
    throw new Error('Flyer images must be uploaded to the LocalVIP asset host.')
  }
  return url.toString()
}

async function imageBytes(url: string) {
  const response = await fetch(allowedImageUrl(url), { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Could not load flyer image (${response.status}).`)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > 12 * 1024 * 1024) throw new Error('Flyer image exceeds 12 MB.')
  return Buffer.from(bytes)
}

type Context = ReturnType<ReturnType<typeof createCanvas>['getContext']>

function wrap(ctx: Context, value: string, maxWidth: number) {
  const lines: string[] = []
  let current = ''
  for (const word of value.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word
    if (current && ctx.measureText(next).width > maxWidth) { lines.push(current); current = word }
    else current = next
  }
  if (current) lines.push(current)
  return lines
}

function fittedText(ctx: Context, value: string, x: number, y: number, width: number, size: number, minSize = 23) {
  let currentSize = size
  do {
    ctx.font = `900 ${currentSize}px Arial`
    if (ctx.measureText(value).width <= width || currentSize <= minSize) break
    currentSize -= 2
  } while (currentSize > minSize)
  ctx.fillText(value, x, y)
}

function centeredLines(ctx: Context, value: string, x: number, y: number, width: number, lineHeight: number) {
  wrap(ctx, value, width).forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
}

export async function renderCauseCampaignFlyer(input: {
  name: string; locality: string; logoUrl: string; coverUrl: string; joinUrl: string; audience: FlyerAudience
  mission?: string; parentOrganization?: string; colors?: { navy?: string; gold?: string }
}) {
  const [logoBytes, coverBytes] = await Promise.all([imageBytes(input.logoUrl), imageBytes(input.coverUrl)])
  const [logo, cover] = await Promise.all([loadImage(logoBytes), loadImage(coverBytes)])
  const canvas = createCanvas(1275, 1650)
  const ctx = canvas.getContext('2d')
  const validColor = (value: string | undefined, fallback: string) => value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
  const navy = validColor(input.colors?.navy, '#061b3e')
  const gold = validColor(input.colors?.gold, '#e1aa2b')
  const navyRgb = [1, 3, 5].map(index => parseInt(navy.slice(index, index + 2), 16)).join(',')
  const white = '#ffffff'
  const copy = flyers[input.audience]

  const heroHeight = 785
  const imageScale = Math.max(1275 / cover.width, heroHeight / cover.height)
  ctx.drawImage(cover, (1275 - cover.width * imageScale) / 2, (heroHeight - cover.height * imageScale) / 2,
    cover.width * imageScale, cover.height * imageScale)
  const shade = ctx.createLinearGradient(0, 0, 1150, 0)
  shade.addColorStop(0, `rgba(${navyRgb},.98)`)
  shade.addColorStop(.48, `rgba(${navyRgb},.85)`)
  shade.addColorStop(1, `rgba(${navyRgb},.24)`)
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, 1275, heroHeight)
  const topShade = ctx.createLinearGradient(0, 0, 0, 165)
  topShade.addColorStop(0, `rgba(${navyRgb},.95)`)
  topShade.addColorStop(1, `rgba(${navyRgb},.3)`)
  ctx.fillStyle = topShade
  ctx.fillRect(0, 0, 1275, 165)

  ctx.fillStyle = white
  ctx.beginPath(); ctx.roundRect(58, 38, 123, 123, 16); ctx.fill()
  const logoScale = Math.min(103 / logo.width, 103 / logo.height)
  ctx.drawImage(logo, 68 + (103 - logo.width * logoScale) / 2, 48 + (103 - logo.height * logoScale) / 2,
    logo.width * logoScale, logo.height * logoScale)
  ctx.fillStyle = gold
  ctx.fillRect(202, 47, 4, 106)
  ctx.fillStyle = white
  fittedText(ctx, input.name.toUpperCase(), 226, 91, 735, 44, 16)
  ctx.fillStyle = '#ced7e7'
  ctx.font = 'bold 23px Arial'
  ctx.fillText(copy.kicker, 228, 131)
  if (input.parentOrganization?.trim()) {
    ctx.fillStyle = gold
    fittedText(ctx, input.parentOrganization.trim().toUpperCase(), 228, 158, 735, 18, 14)
  }
  ctx.textAlign = 'right'
  ctx.fillStyle = white
  ctx.font = '900 36px Arial'
  ctx.fillText('LOCALVIP', 1212, 80)
  ctx.fillStyle = gold
  ctx.font = 'bold 17px Arial'
  ctx.fillText('LOCAL FAMILIES. LOCAL FUTURES.', 1210, 112)
  ctx.textAlign = 'left'

  let y = 262
  ctx.fillStyle = white
  for (const line of copy.hero) { fittedText(ctx, line, 64, y, 810, 77, 45); y += 83 }
  y += 14
  ctx.fillStyle = gold
  for (const line of copy.gold) { fittedText(ctx, line, 64, y, 805, 88, 50); y += 93 }
  ctx.fillStyle = gold
  ctx.fillRect(65, 655, 460, 5)
  ctx.fillStyle = white
  ctx.font = '27px Arial'
  const intro = input.mission?.trim() ? `Our goal: ${input.mission.trim().slice(0, 140)}` : copy.intro
  wrap(ctx, intro, 690).slice(0, 4).forEach((line, index) => ctx.fillText(line, 65, 700 + index * 34))

  ctx.fillStyle = '#f4f5f7'
  ctx.fillRect(0, 785, 1275, 370)
  ctx.fillStyle = gold
  ctx.fillRect(0, 785, 1275, 5)
  for (let index = 0; index < 4; index++) {
    const x = 45 + index * 310
    if (index) { ctx.fillStyle = '#bec4ce'; ctx.fillRect(x - 15, 830, 2, 280) }
    ctx.fillStyle = navy
    ctx.beginPath(); ctx.arc(x + 27, 838, 29, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = white
    ctx.font = 'bold 29px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(String(index + 1), x + 27, 848)
    ctx.fillStyle = gold
    ctx.font = 'bold 62px Arial'
    ctx.fillText(['1', '2', '3', '4'][index], x + 139, 945)
    ctx.fillStyle = navy
    ctx.font = '900 27px Arial'
    centeredLines(ctx, copy.steps[index][0], x + 139, 1003, 255, 30)
    ctx.fillStyle = '#263246'
    ctx.font = '22px Arial'
    centeredLines(ctx, copy.steps[index][1], x + 139, 1073, 254, 27)
    ctx.textAlign = 'left'
  }

  ctx.fillStyle = white
  ctx.fillRect(0, 1155, 1275, 224)
  ctx.strokeStyle = '#ced2da'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(0, 1156); ctx.lineTo(1275, 1156); ctx.stroke()
  const benefits = [
    { x: 204, title: 'FAMILIES', detail: 'Offers and local connection' },
    { x: 638, title: 'YOUR SCHOOL', detail: 'More community support' },
    { x: 1071, title: 'BUSINESSES', detail: 'Loyal local customers' },
  ]
  ctx.fillStyle = gold
  ctx.font = 'bold 38px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Generosity should go both ways.', 638, 1215)
  benefits.forEach((benefit, index) => {
    ctx.fillStyle = navy
    ctx.beginPath(); ctx.arc(benefit.x, 1273, 31, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = gold
    ctx.font = 'bold 35px Arial'
    ctx.fillText(['+', '*', '+'][index], benefit.x, 1285)
    ctx.fillStyle = navy
    ctx.font = 'bold 25px Arial'
    ctx.fillText(benefit.title, benefit.x, 1327)
    ctx.fillStyle = '#4b5768'
    ctx.font = '20px Arial'
    ctx.fillText(benefit.detail, benefit.x, 1354)
  })
  ctx.textAlign = 'left'

  ctx.fillStyle = navy
  ctx.fillRect(0, 1380, 1275, 222)
  ctx.fillStyle = gold
  ctx.fillRect(0, 1380, 1275, 5)
  ctx.fillStyle = white
  ctx.beginPath(); ctx.roundRect(44, 1404, 177, 177, 8); ctx.fill()
  const qr = await QRCode.toDataURL(input.joinUrl, { margin: 1, width: 156, color: { dark: navy, light: white } })
  const qrImage = await loadImage(Buffer.from(qr.split(',')[1], 'base64'))
  ctx.drawImage(qrImage, 54, 1414, 157, 157)
  ctx.fillStyle = gold
  ctx.fillRect(243, 1410, 4, 165)
  ctx.fillStyle = white
  ctx.font = 'bold 26px Arial'
  ctx.fillText('READY TO MAKE A DIFFERENCE?', 274, 1449)
  ctx.fillStyle = gold
  fittedText(ctx, copy.cta, 274, 1511, 920, 53, 31)
  ctx.fillStyle = white
  ctx.font = '25px Arial'
  ctx.fillText('Scan the code to connect with your community.', 275, 1555)
  ctx.fillStyle = '#e8ebf0'
  ctx.fillRect(0, 1602, 1275, 48)
  ctx.fillStyle = navy
  ctx.font = 'bold 18px Arial'
  ctx.fillText('LOCAL FAMILIES. LOCAL BUSINESSES.', 55, 1633)
  ctx.fillStyle = '#ad7a12'
  ctx.fillText('LOCAL FUTURES.', 772, 1633)
  ctx.textAlign = 'right'
  ctx.fillStyle = navy
  ctx.fillText(input.locality.toUpperCase(), 1225, 1633)

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const image = await pdf.embedPng(await canvas.encode('png'))
  page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 })
  return pdf.save()
}
