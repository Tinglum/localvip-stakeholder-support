'use client'

export type QrLogoFitMode = 'contain' | 'crop'

export interface QrLogoEditSettings {
  fitMode: QrLogoFitMode
  zoom: number
  offsetX: number
  offsetY: number
  removeBackground: boolean
  backgroundTolerance: number
}

export const DEFAULT_QR_LOGO_EDIT_SETTINGS: QrLogoEditSettings = {
  fitMode: 'contain',
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  removeBackground: false,
  backgroundTolerance: 28,
}

export async function loadQrLogoImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

export async function generateProcessedQrLogoDataUrl({
  src,
  settings,
  size = 512,
}: {
  src: string
  settings: QrLogoEditSettings
  size?: number
}) {
  if (typeof document === 'undefined') return src

  const image = await loadQrLogoImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas context not available')

  context.clearRect(0, 0, size, size)

  const workAreaSize = size * 0.84
  const workAreaX = (size - workAreaSize) / 2
  const workAreaY = (size - workAreaSize) / 2
  const containScale = Math.min(workAreaSize / image.naturalWidth, workAreaSize / image.naturalHeight)
  const coverScale = Math.max(workAreaSize / image.naturalWidth, workAreaSize / image.naturalHeight)
  const baseScale = settings.fitMode === 'crop' ? coverScale : containScale
  const scale = baseScale * settings.zoom
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  const maxShiftX = Math.max(0, (drawWidth - workAreaSize) / 2)
  const maxShiftY = Math.max(0, (drawHeight - workAreaSize) / 2)
  const drawX = size / 2 - drawWidth / 2 + maxShiftX * settings.offsetX
  const drawY = size / 2 - drawHeight / 2 + maxShiftY * settings.offsetY

  context.save()
  context.beginPath()
  context.rect(workAreaX, workAreaY, workAreaSize, workAreaSize)
  context.clip()
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  context.restore()

  if (settings.removeBackground) {
    removeLightBackground(canvas, settings.backgroundTolerance)
  }

  return canvas.toDataURL('image/png')
}

function removeLightBackground(canvas: HTMLCanvasElement, tolerance: number) {
  const context = canvas.getContext('2d')
  if (!context) return

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const alpha = pixels[index + 3]

    if (alpha === 0) continue

    const distanceFromWhite = 255 - Math.min(red, green, blue)
    if (distanceFromWhite >= tolerance) continue

    const opacityFactor = distanceFromWhite / Math.max(tolerance, 1)
    pixels[index + 3] = Math.max(0, Math.round(alpha * opacityFactor))
  }

  context.putImageData(imageData, 0, 0)
}
