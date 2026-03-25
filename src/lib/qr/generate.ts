import QRCode from 'qrcode'

// ─── Types ──────────────────────────────────────────────────

export interface QRGenerateOptions {
  data: string
  size?: number
  foregroundColor?: string
  backgroundColor?: string
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

export interface QRFrameOptions extends QRGenerateOptions {
  frameText?: string
  frameColor?: string
  logoUrl?: string
}

// ─── Data URL Generation ────────────────────────────────────

/**
 * Generate a QR code as a PNG data URL.
 * Returns a base64-encoded data:image/png string.
 */
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

/**
 * Generate a QR code as an SVG string.
 * Returns a raw <svg> element string.
 */
export function generateQRSVG(options: QRGenerateOptions): string {
  const {
    data,
    size = 512,
    foregroundColor = '#000000',
    backgroundColor = '#ffffff',
    errorCorrectionLevel = 'H',
  } = options

  // QRCode.toString with type 'svg' is synchronous when used with callback,
  // but we use the sync version via the segments API
  let svgString = ''

  // Use the synchronous toString approach
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

// ─── Framed QR Code with Logo and CTA ───────────────────────

/**
 * Generate a QR code with optional frame text (CTA) and logo overlay.
 * Uses an offscreen canvas to composite the QR code, logo, and frame.
 * Returns a data:image/png string.
 *
 * For server-side usage this requires a canvas polyfill (e.g. `canvas` npm package).
 * For client-side usage this works natively in the browser.
 */
export async function generateQRWithFrame(options: QRFrameOptions): Promise<string> {
  const {
    data,
    size = 512,
    foregroundColor = '#000000',
    backgroundColor = '#ffffff',
    errorCorrectionLevel = 'H',
    frameText,
    frameColor = '#000000',
    logoUrl,
  } = options

  // We work in the browser — use HTMLCanvasElement
  if (typeof document === 'undefined') {
    // Fallback: return plain QR data URL on the server
    return generateQRDataURL(options)
  }

  const frameHeight = frameText ? 56 : 0
  const totalHeight = size + frameHeight
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = totalHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')

  // Fill background for the entire canvas
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, size, totalHeight)

  // Generate the base QR code as a data URL
  const qrDataUrl = await QRCode.toDataURL(data, {
    width: size,
    margin: 2,
    color: {
      dark: foregroundColor,
      light: backgroundColor,
    },
    errorCorrectionLevel,
  })

  // Draw the QR code onto the canvas
  const qrImage = await loadImage(qrDataUrl)
  ctx.drawImage(qrImage, 0, 0, size, size)

  // Overlay logo in the center if provided
  if (logoUrl) {
    try {
      const logo = await loadImage(logoUrl)
      const logoSize = Math.floor(size * 0.22) // ~22% of QR size for H-level correction
      const logoX = Math.floor((size - logoSize) / 2)
      const logoY = Math.floor((size - logoSize) / 2)

      // White background circle behind logo for contrast
      const padding = 6
      ctx.fillStyle = backgroundColor
      ctx.beginPath()
      ctx.roundRect(
        logoX - padding,
        logoY - padding,
        logoSize + padding * 2,
        logoSize + padding * 2,
        8
      )
      ctx.fill()

      // Draw logo
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
    } catch {
      // Logo failed to load — continue without it
      console.warn('QR logo failed to load, generating without logo')
    }
  }

  // Draw frame text below the QR code
  if (frameText) {
    const frameY = size
    ctx.fillStyle = foregroundColor
    ctx.fillRect(0, frameY, size, frameHeight)

    ctx.fillStyle = frameColor === foregroundColor ? backgroundColor : frameColor
    ctx.font = `bold ${Math.max(14, Math.floor(size / 24))}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Truncate frame text if too long
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

// ─── Download Helpers ───────────────────────────────────────

/**
 * Trigger a browser download of a data URL.
 */
export function downloadDataURL(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Trigger a browser download of an SVG string.
 */
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
