import { createCanvas, loadImage } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'

export type FlyerAudience = 'business' | 'families' | 'schools'

const flyers: Record<FlyerAudience, { eyebrow: string; headline: string[]; body: string; points: string[]; action: string }> = {
  business: {
    eyebrow: 'FOR LOCAL BUSINESSES',
    headline: ['Grow your business.', 'Give back locally.'],
    body: 'Join your school community on LocalVIP. Connect with families, share an offer, and support the cause they care about.',
    points: ['Reach families in your community', 'Create an offer that works for your business', 'Support the school with every connection'],
    action: 'SCAN TO JOIN AS A BUSINESS',
  },
  families: {
    eyebrow: 'FOR FAMILIES & SUPPORTERS',
    headline: ['Shop local.', 'Support your school.'],
    body: 'Discover participating businesses and turn everyday purchases into support for your school community.',
    points: ['Explore local offers', 'Choose businesses that give back', 'Help your school grow its impact'],
    action: 'SCAN TO GET STARTED',
  },
  schools: {
    eyebrow: 'FOR SCHOOL LEADERS & BOOSTERS',
    headline: ['Bring your community', 'together.'],
    body: 'Give families and local businesses one clear place to connect around your school and its goals.',
    points: ['Share one campaign page', 'Invite families and businesses', 'Build ongoing local support'],
    action: 'SCAN TO SEE THE CAMPAIGN',
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

function wrap(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, text: string, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = word }
    else line = next
  }
  if (line) lines.push(line)
  return lines
}

export async function renderCauseCampaignFlyer(input: {
  name: string; locality: string; logoUrl: string; coverUrl: string; joinUrl: string; audience: FlyerAudience
}) {
  const [logoBytes, coverBytes] = await Promise.all([imageBytes(input.logoUrl), imageBytes(input.coverUrl)])
  const [logo, cover] = await Promise.all([loadImage(logoBytes), loadImage(coverBytes)])
  const canvas = createCanvas(1275, 1650)
  const ctx = canvas.getContext('2d')
  const navy = '#071a3d'
  const gold = '#c69b26'
  const white = '#ffffff'
  const copy = flyers[input.audience]

  ctx.fillStyle = white
  ctx.fillRect(0, 0, 1275, 1650)
  ctx.fillStyle = navy
  ctx.fillRect(0, 0, 1275, 140)
  ctx.fillStyle = gold
  ctx.fillRect(0, 137, 1275, 8)
  ctx.fillStyle = white
  ctx.font = 'bold 24px Arial'
  ctx.fillText('LOCALVIP  /  COMMUNITY CAMPAIGN', 72, 80)
  ctx.font = '20px Arial'
  ctx.textAlign = 'right'
  ctx.fillText(input.locality.toUpperCase(), 1203, 80)
  ctx.textAlign = 'left'

  const imageTop = 145
  const imageHeight = 520
  const imageScale = Math.max(1275 / cover.width, imageHeight / cover.height)
  ctx.drawImage(cover, (1275 - cover.width * imageScale) / 2, imageTop + (imageHeight - cover.height * imageScale) / 2, cover.width * imageScale, cover.height * imageScale)
  ctx.fillStyle = 'rgba(7,26,61,.72)'
  ctx.fillRect(0, imageTop + 380, 1275, 140)
  ctx.fillStyle = white
  ctx.font = 'bold 52px Arial'
  ctx.fillText(input.name, 72, imageTop + 468)

  ctx.fillStyle = gold
  ctx.font = 'bold 25px Arial'
  ctx.fillText(copy.eyebrow, 72, 735)
  ctx.fillStyle = navy
  ctx.font = 'bold 71px Arial'
  copy.headline.forEach((line, index) => ctx.fillText(line, 72, 820 + index * 82))

  ctx.font = '29px Arial'
  ctx.fillStyle = '#34435b'
  wrap(ctx, copy.body, 1060).forEach((line, index) => ctx.fillText(line, 72, 1040 + index * 42))
  ctx.font = '27px Arial'
  copy.points.forEach((point, index) => {
    const y = 1180 + index * 54
    ctx.fillStyle = gold
    ctx.fillRect(75, y - 20, 13, 13)
    ctx.fillStyle = navy
    ctx.fillText(point, 106, y)
  })

  ctx.fillStyle = navy
  ctx.fillRect(0, 1390, 1275, 260)
  ctx.fillStyle = white
  ctx.font = 'bold 29px Arial'
  ctx.fillText(copy.action, 72, 1475)
  ctx.font = '22px Arial'
  ctx.fillText('See how your community can get involved.', 72, 1520)
  ctx.fillStyle = gold
  ctx.fillRect(72, 1550, 790, 4)

  ctx.fillStyle = white
  ctx.fillRect(980, 1435, 195, 195)
  const qr = await QRCode.toDataURL(input.joinUrl, { margin: 1, width: 175, color: { dark: navy, light: white } })
  const qrImage = await loadImage(Buffer.from(qr.split(',')[1], 'base64'))
  ctx.drawImage(qrImage, 990, 1445, 175, 175)

  // The uploaded logo is kept separate from the photo and printed at its natural ratio.
  const logoWidth = Math.min(185, logo.width * Math.min(185 / logo.width, 100 / logo.height))
  const logoHeight = logo.height * logoWidth / logo.width
  ctx.fillStyle = white
  ctx.fillRect(1030 - logoWidth / 2 - 12, 685, logoWidth + 24, 124)
  ctx.drawImage(logo, 1030 - logoWidth / 2, 697 + (100 - logoHeight) / 2, logoWidth, logoHeight)

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const image = await pdf.embedPng(await canvas.encode('png'))
  page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 })
  return pdf.save()
}
