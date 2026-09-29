import type { LandingColors } from '@/lib/cause-landing-config'

/**
 * Brand-colour helpers for cause setup: pull a palette out of a logo, and
 * expand the three colours a cause chooses into the landing/material palette.
 */

export type BrandTriple = { primary: string; secondary: string; accent: string }

type Rgb = [number, number, number]

const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const n = parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value.trim())
}

function mix(hex: string, target: Rgb, amount: number) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return toHex(rgb.map((v, i) => v + (target[i] - v) * amount) as Rgb)
}

const distance = (a: Rgb, b: Rgb) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

function saturation([r, g, b]: Rgb) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

/** The three chosen colours → the six-slot palette the landing page and materials read. */
export function expandBrandPalette(brand: BrandTriple, current?: LandingColors): LandingColors {
  return {
    navy: brand.primary.toUpperCase(),
    navyDeep: mix(brand.primary, [0, 0, 0], 0.4),
    royal: brand.secondary.toUpperCase(),
    silver: current?.silver || '#C8CBD1',
    silverLight: mix(brand.primary, [255, 255, 255], 0.92),
    gold: brand.accent.toUpperCase(),
  }
}

export function brandFromPalette(colors: LandingColors): BrandTriple {
  return { primary: colors.navy, secondary: colors.royal, accent: colors.gold }
}

/**
 * Read a logo's dominant colours in the browser. Buckets pixels, ignores
 * transparency and near-white background, ranks by frequency, and keeps
 * colours that are visibly different from each other. The image must be
 * same-origin (or CORS-enabled) for the canvas to be readable.
 */
export async function extractBrandColorsFromImage(src: string): Promise<BrandTriple | null> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The logo could not be loaded.'))
    img.src = src
  })

  const size = 72
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight) || 1
  const w = Math.max(1, Math.round(image.naturalWidth * scale))
  const h = Math.max(1, Math.round(image.naturalHeight * scale))
  ctx.drawImage(image, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const buckets = new Map<string, { sum: Rgb; count: number }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 160) continue
    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]]
    if (rgb[0] > 236 && rgb[1] > 236 && rgb[2] > 236) continue // background white
    const key = rgb.map((v) => v >> 4).join(',')
    const bucket = buckets.get(key) || { sum: [0, 0, 0] as Rgb, count: 0 }
    bucket.sum = [bucket.sum[0] + rgb[0], bucket.sum[1] + rgb[1], bucket.sum[2] + rgb[2]]
    bucket.count += 1
    buckets.set(key, bucket)
  }

  const ranked = [...buckets.values()]
    .map((b) => ({ rgb: b.sum.map((v) => v / b.count) as Rgb, count: b.count }))
    .sort((a, b) => b.count - a.count)
  if (ranked.length === 0) return null

  const picked: Rgb[] = []
  for (const candidate of ranked) {
    if (picked.every((p) => distance(p, candidate.rgb) > 70)) picked.push(candidate.rgb)
    if (picked.length === 4) break
  }

  const primary = picked[0]
  const others = picked.slice(1)
  // Accent: the most saturated remaining colour reads best on buttons/highlights.
  const accent = [...others].sort((a, b) => saturation(b) - saturation(a))[0]
  const secondary = others.find((c) => c !== accent)

  const primaryHex = toHex(primary)
  return {
    primary: primaryHex,
    secondary: secondary ? toHex(secondary) : mix(primaryHex, [255, 255, 255], 0.35),
    accent: accent ? toHex(accent) : '#F59E0B',
  }
}
