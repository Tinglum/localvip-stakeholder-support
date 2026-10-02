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

function hue([r, g, b]: Rgb) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return null
  const delta = max - min
  const value = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return (value * 60 + 360) % 360
}

function hueDistance(a: Rgb, b: Rgb) {
  const first = hue(a), second = hue(b)
  if (first === null || second === null) return 180
  const difference = Math.abs(first - second)
  return Math.min(difference, 360 - difference)
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

  const size = 144
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

  return pickBrandColors(data)
}

/** Keep small, vivid logo details as possible accents even when text dominates. */
export function pickBrandColors(data: Uint8ClampedArray): BrandTriple | null {
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

  // Ignore minor buckets: anti-aliased edges between two brand colours
  // produce in-between shades that are not part of the brand.
  const minCount = ranked[0].count * 0.04
  const picked: Rgb[] = []
  for (const candidate of ranked) {
    if (candidate.count < minCount) break
    if (picked.every((p) => distance(p, candidate.rgb) > 70)) picked.push(candidate.rgb)
    if (picked.length === 4) break
  }

  const primary = picked[0]
  const vivid = ranked.find(({ rgb, count }) => count >= Math.max(2, ranked[0].count * 0.01)
    && saturation(rgb) > 0.5 && Math.max(...rgb) > 110 && distance(rgb, primary) > 70)?.rgb
  const secondary = saturation(primary) < 0.2 ? (vivid || picked[1] || null) : (picked[1] || null)
  // Tiny symbols often span several adjacent buckets because of anti-aliasing.
  // Combine vivid pixels by hue before deciding whether an accent exists.
  const accentGroups = new Map<number, { sum: Rgb; count: number }>()
  for (const { rgb, count } of ranked) {
    if (saturation(rgb) < 0.35 || Math.max(...rgb) < 120 || distance(rgb, primary) < 70
      || (secondary && (distance(rgb, secondary) < 70 || hueDistance(rgb, secondary) < 35))) continue
    const angle = hue(rgb)
    if (angle === null) continue
    const key = Math.round(angle / 30) % 12
    const group = accentGroups.get(key) || { sum: [0, 0, 0] as Rgb, count: 0 }
    group.sum = [group.sum[0] + rgb[0] * count, group.sum[1] + rgb[1] * count, group.sum[2] + rgb[2] * count]
    group.count += count
    accentGroups.set(key, group)
  }
  const accentGroup = [...accentGroups.values()].filter((group) => group.count >= 3).sort((a, b) => b.count - a.count)[0]
  const accent = accentGroup ? accentGroup.sum.map((value) => value / accentGroup.count) as Rgb : null

  const primaryHex = toHex(primary)
  const secondaryHex = secondary ? toHex(secondary) : mix(primaryHex, [255, 255, 255], 0.35)
  return {
    primary: primaryHex,
    secondary: secondaryHex,
    accent: accent ? toHex(accent) : mix(secondaryHex, [0, 0, 0], 0.45),
  }
}
