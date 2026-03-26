import QRCode from 'qrcode'

// ─── Types ──────────────────────────────────────────────────

export type DotStyle = 'square' | 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'extra-rounded'
export type CornerStyle = 'square' | 'rounded' | 'dots' | 'extra-rounded'

export interface QRGenerateOptions {
  data: string
  size?: number
  foregroundColor?: string
  backgroundColor?: string
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  dotStyle?: DotStyle
  cornerStyle?: CornerStyle
  cornerDotStyle?: 'square' | 'dot'
}

export interface QRFrameOptions extends QRGenerateOptions {
  frameText?: string
  frameColor?: string
  logoUrl?: string
  logoFile?: File | null
  gradientType?: 'none' | 'linear' | 'radial'
  gradientColors?: [string, string]
}

export type QRDestinationType = 'url' | 'email' | 'phone' | 'sms' | 'wifi' | 'vcard' | 'file'

export interface QRDestination {
  type: QRDestinationType
  // URL
  url?: string
  // Email
  emailTo?: string
  emailSubject?: string
  emailBody?: string
  // Phone / SMS
  phone?: string
  smsBody?: string
  // WiFi
  wifiSsid?: string
  wifiPassword?: string
  wifiEncryption?: 'WPA' | 'WEP' | 'nopass'
  wifiHidden?: boolean
  // vCard
  vcardName?: string
  vcardPhone?: string
  vcardEmail?: string
  vcardOrg?: string
  vcardTitle?: string
  vcardUrl?: string
  // File (generates a URL to uploaded file)
  fileUrl?: string
}

/**
 * Convert a QRDestination to a string that can be encoded in a QR code.
 */
export function destinationToString(dest: QRDestination): string {
  switch (dest.type) {
    case 'url':
      return dest.url || 'https://localvip.com'
    case 'email': {
      const parts = [`mailto:${dest.emailTo || ''}`]
      const params: string[] = []
      if (dest.emailSubject) params.push(`subject=${encodeURIComponent(dest.emailSubject)}`)
      if (dest.emailBody) params.push(`body=${encodeURIComponent(dest.emailBody)}`)
      if (params.length) parts.push(`?${params.join('&')}`)
      return parts.join('')
    }
    case 'phone':
      return `tel:${dest.phone || ''}`
    case 'sms': {
      const sms = `sms:${dest.phone || ''}`
      return dest.smsBody ? `${sms}?body=${encodeURIComponent(dest.smsBody)}` : sms
    }
    case 'wifi': {
      const enc = dest.wifiEncryption || 'WPA'
      const hidden = dest.wifiHidden ? 'H:true' : ''
      return `WIFI:T:${enc};S:${dest.wifiSsid || ''};P:${dest.wifiPassword || ''};${hidden};`
    }
    case 'vcard': {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${dest.vcardName || ''}`,
      ]
      if (dest.vcardPhone) lines.push(`TEL:${dest.vcardPhone}`)
      if (dest.vcardEmail) lines.push(`EMAIL:${dest.vcardEmail}`)
      if (dest.vcardOrg) lines.push(`ORG:${dest.vcardOrg}`)
      if (dest.vcardTitle) lines.push(`TITLE:${dest.vcardTitle}`)
      if (dest.vcardUrl) lines.push(`URL:${dest.vcardUrl}`)
      lines.push('END:VCARD')
      return lines.join('\n')
    }
    case 'file':
      return dest.fileUrl || 'https://localvip.com'
    default:
      return 'https://localvip.com'
  }
}

// ─── Data URL Generation ────────────────────────────────────

export async function generateQRDataURL(options: QRGenerateOptions): Promise<string> {
  const {
    data,
    size = 512,
    foregroundColor = '#000000',
    backgroundColor = '#ffffff',
    errorCorrectionLevel = 'H',
  } = options

  const dataUrl = await QRCode.toDataURL(data, {
    width: size,
    margin: 2,
    color: {
      dark: foregroundColor,
      light: backgroundColor,
    },
    errorCorrectionLevel,
  })

  return dataUrl
}

// ─── SVG Generation ─────────────────────────────────────────

export function generateQRSVG(options: QRGenerateOptions): string {
  const {
    data,
    size = 512,
    foregroundColor = '#000000',
    backgroundColor = '#ffffff',
    errorCorrectionLevel = 'H',
  } = options

  let svgString = ''

  QRCode.toString(
    data,
    {
      type: 'svg',
      width: size,
      margin: 2,
      color: {
        dark: foregroundColor,
        light: backgroundColor,
      },
      errorCorrectionLevel,
    },
    (err, str) => {
      if (err) throw err
      svgString = str
    }
  )

  return svgString
}

// ─── Styled QR Code with Canvas ─────────────────────────────

/**
 * Generate a styled QR code using canvas.
 * Supports dot styles, corner styles, logo overlay, frame text, gradients.
 */
export async function generateStyledQR(options: QRFrameOptions): Promise<string> {
  const {
    data,
    size = 512,
    foregroundColor = '#000000',
    backgroundColor = '#ffffff',
    errorCorrectionLevel = 'H',
    dotStyle = 'square',
    cornerStyle = 'square',
    frameText,
    frameColor,
    logoUrl,
    logoFile,
    gradientType = 'none',
    gradientColors = ['#000000', '#333333'],
  } = options

  if (typeof document === 'undefined') {
    return generateQRDataURL(options)
  }

  // Generate QR matrix
  const qrData = QRCode.create(data, { errorCorrectionLevel })
  const modules = qrData.modules
  const moduleCount = modules.size
  const moduleData = modules.data

  const frameHeight = frameText ? 56 : 0
  const totalHeight = size + frameHeight
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = totalHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')

  // Fill background
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, size, totalHeight)

  // Apply gradient background if selected
  if (gradientType !== 'none') {
    let gradient: CanvasGradient
    if (gradientType === 'linear') {
      gradient = ctx.createLinearGradient(0, 0, size, size)
    } else {
      gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    }
    gradient.addColorStop(0, gradientColors[0])
    gradient.addColorStop(1, gradientColors[1])
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }

  // Calculate module size
  const margin = 2
  const qrSize = size - margin * 2 * (size / moduleCount)
  const moduleSize = qrSize / moduleCount
  const offset = (size - moduleCount * moduleSize) / 2

  // Helper: check if module is part of a finder pattern (corner eye)
  function isFinderPattern(row: number, col: number): boolean {
    // Top-left
    if (row < 7 && col < 7) return true
    // Top-right
    if (row < 7 && col >= moduleCount - 7) return true
    // Bottom-left
    if (row >= moduleCount - 7 && col < 7) return true
    return false
  }

  // Helper: check if module is the outer ring of a finder pattern
  function isFinderOuter(row: number, col: number): boolean {
    const corners = [
      { r: 0, c: 0 },
      { r: 0, c: moduleCount - 7 },
      { r: moduleCount - 7, c: 0 },
    ]
    for (const corner of corners) {
      const lr = row - corner.r
      const lc = col - corner.c
      if (lr >= 0 && lr < 7 && lc >= 0 && lc < 7) {
        // Outer ring: first or last row/col of the 7x7
        if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true
        // Inner filled: 3x3 center
        if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true
      }
    }
    return false
  }

  // Get fill style for dots (supports gradient)
  function getDotFill(): string | CanvasGradient {
    if (gradientType !== 'none') {
      return foregroundColor // Use solid for dots over gradient bg
    }
    return foregroundColor
  }

  // Draw data modules (non-finder)
  const fill = getDotFill()
  ctx.fillStyle = fill

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!moduleData[row * moduleCount + col]) continue
      if (isFinderPattern(row, col)) continue

      const x = offset + col * moduleSize
      const y = offset + row * moduleSize
      const s = moduleSize * 0.9
      const gap = moduleSize * 0.05

      ctx.fillStyle = foregroundColor

      switch (dotStyle) {
        case 'rounded':
          ctx.beginPath()
          ctx.roundRect(x + gap, y + gap, s, s, s * 0.3)
          ctx.fill()
          break
        case 'dots':
          ctx.beginPath()
          ctx.arc(x + moduleSize / 2, y + moduleSize / 2, s / 2, 0, Math.PI * 2)
          ctx.fill()
          break
        case 'classy':
          ctx.beginPath()
          ctx.roundRect(x + gap, y + gap, s, s, [s * 0.5, 0, s * 0.5, 0])
          ctx.fill()
          break
        case 'classy-rounded':
          ctx.beginPath()
          ctx.roundRect(x + gap, y + gap, s, s, [s * 0.5, s * 0.1, s * 0.5, s * 0.1])
          ctx.fill()
          break
        case 'extra-rounded':
          ctx.beginPath()
          ctx.roundRect(x + gap, y + gap, s, s, s * 0.5)
          ctx.fill()
          break
        case 'square':
        default:
          ctx.fillRect(x + gap, y + gap, s, s)
          break
      }
    }
  }

  // Draw finder patterns (corner eyes) with selected corner style
  const cornerPositions = [
    { r: 0, c: 0 },
    { r: 0, c: moduleCount - 7 },
    { r: moduleCount - 7, c: 0 },
  ]

  for (const corner of cornerPositions) {
    const cx = offset + corner.c * moduleSize
    const cy = offset + corner.r * moduleSize
    const outerSize = 7 * moduleSize
    const innerSize = 5 * moduleSize
    const coreSize = 3 * moduleSize
    const innerOffset = moduleSize
    const coreOffset = 2 * moduleSize

    ctx.fillStyle = foregroundColor

    switch (cornerStyle) {
      case 'rounded': {
        // Outer rounded rect
        ctx.beginPath()
        ctx.roundRect(cx, cy, outerSize, outerSize, outerSize * 0.15)
        ctx.fill()
        // Inner cutout
        ctx.fillStyle = backgroundColor
        ctx.beginPath()
        ctx.roundRect(cx + innerOffset, cy + innerOffset, innerSize, innerSize, innerSize * 0.1)
        ctx.fill()
        // Core
        ctx.fillStyle = foregroundColor
        ctx.beginPath()
        ctx.roundRect(cx + coreOffset, cy + coreOffset, coreSize, coreSize, coreSize * 0.15)
        ctx.fill()
        break
      }
      case 'dots': {
        // Outer circle
        ctx.beginPath()
        ctx.arc(cx + outerSize / 2, cy + outerSize / 2, outerSize / 2, 0, Math.PI * 2)
        ctx.fill()
        // Inner cutout circle
        ctx.fillStyle = backgroundColor
        ctx.beginPath()
        ctx.arc(cx + outerSize / 2, cy + outerSize / 2, innerSize / 2, 0, Math.PI * 2)
        ctx.fill()
        // Core circle
        ctx.fillStyle = foregroundColor
        ctx.beginPath()
        ctx.arc(cx + outerSize / 2, cy + outerSize / 2, coreSize / 2, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'extra-rounded': {
        ctx.beginPath()
        ctx.roundRect(cx, cy, outerSize, outerSize, outerSize * 0.35)
        ctx.fill()
        ctx.fillStyle = backgroundColor
        ctx.beginPath()
        ctx.roundRect(cx + innerOffset, cy + innerOffset, innerSize, innerSize, innerSize * 0.3)
        ctx.fill()
        ctx.fillStyle = foregroundColor
        ctx.beginPath()
        ctx.roundRect(cx + coreOffset, cy + coreOffset, coreSize, coreSize, coreSize * 0.35)
        ctx.fill()
        break
      }
      case 'square':
      default: {
        // Standard square finder
        ctx.fillRect(cx, cy, outerSize, outerSize)
        ctx.fillStyle = backgroundColor
        ctx.fillRect(cx + innerOffset, cy + innerOffset, innerSize, innerSize)
        ctx.fillStyle = foregroundColor
        ctx.fillRect(cx + coreOffset, cy + coreOffset, coreSize, coreSize)
        break
      }
    }
  }

  // Overlay logo in the center
  const logoSrc = logoFile ? URL.createObjectURL(logoFile) : logoUrl
  if (logoSrc) {
    try {
      const logo = await loadImage(logoSrc)
      const logoSize = Math.floor(size * 0.22)
      const logoX = Math.floor((size - logoSize) / 2)
      const logoY = Math.floor((size - logoSize) / 2)

      const logoBackgroundFill = backgroundColor === 'transparent' ? '#ffffff' : backgroundColor

      // White background behind logo
      const padding = 6
      ctx.fillStyle = logoBackgroundFill
      ctx.beginPath()
      ctx.roundRect(
        logoX - padding,
        logoY - padding,
        logoSize + padding * 2,
        logoSize + padding * 2,
        8
      )
      ctx.fill()

      drawImageContained(ctx, logo, logoX, logoY, logoSize, logoSize)

      if (logoFile) URL.revokeObjectURL(logoSrc)
    } catch {
      console.warn('QR logo failed to load, generating without logo')
    }
  }

  // Draw frame text below the QR code
  if (frameText) {
    const frameY = size
    ctx.fillStyle = foregroundColor
    ctx.fillRect(0, frameY, size, frameHeight)

    ctx.fillStyle = (frameColor && frameColor !== foregroundColor) ? frameColor : backgroundColor
    ctx.font = `bold ${Math.max(14, Math.floor(size / 24))}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const maxWidth = size - 32
    let displayText = frameText
    let metrics = ctx.measureText(displayText)
    while (metrics.width > maxWidth && displayText.length > 3) {
      displayText = displayText.slice(0, -4) + '...'
      metrics = ctx.measureText(displayText)
    }

    ctx.fillText(displayText, size / 2, frameY + frameHeight / 2)
  }

  return canvas.toDataURL('image/png')
}

// ─── Legacy function (backward compat) ──────────────────────

export async function generateQRWithFrame(options: QRFrameOptions): Promise<string> {
  return generateStyledQR(options)
}

// ─── Helpers ────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

function drawImageContained(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 0,
) {
  const safeWidth = Math.max(1, width - padding * 2)
  const safeHeight = Math.max(1, height - padding * 2)
  const scale = Math.min(safeWidth / image.naturalWidth, safeHeight / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  const drawX = x + (width - drawWidth) / 2
  const drawY = y + (height - drawHeight) / 2

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
}

// ─── Download Helpers ───────────────────────────────────────

export function downloadDataURL(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function downloadSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
