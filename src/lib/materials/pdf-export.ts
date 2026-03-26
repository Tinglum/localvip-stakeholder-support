import type { QrPlacement } from '@/lib/materials/qr-placement'

let pdfModulePromise: Promise<any> | null = null

async function loadPdfModule() {
  if (!pdfModulePromise) {
    pdfModulePromise = import('pdfjs-dist').then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      }
      return pdfjs
    })
  }

  return pdfModulePromise
}

interface PdfImagePage {
  jpegBytes: Uint8Array
  imageWidth: number
  imageHeight: number
  pageWidth: number
  pageHeight: number
}

function formatPdfNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function mergeUint8Arrays(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0

  chunks.forEach((chunk) => {
    merged.set(chunk, offset)
    offset += chunk.length
  })

  return merged
}

function buildPdfFromJpegPages(pages: PdfImagePage[]) {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0

  const pushBytes = (value: Uint8Array) => {
    chunks.push(value)
    length += value.length
  }

  const pushText = (value: string) => {
    pushBytes(encoder.encode(value))
  }

  pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xff, 0xff, 0xff, 0xff, 0x0a]))

  const pageObjectNumbers = pages.map((_, index) => 3 + index * 3)
  const contentObjectNumbers = pages.map((_, index) => 4 + index * 3)
  const imageObjectNumbers = pages.map((_, index) => 5 + index * 3)
  const objectCount = 2 + pages.length * 3

  offsets[1] = length
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  offsets[2] = length
  pushText(`2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(' ')}] >>\nendobj\n`)

  pages.forEach((page, index) => {
    const pageObjectNumber = pageObjectNumbers[index]
    const contentObjectNumber = contentObjectNumbers[index]
    const imageObjectNumber = imageObjectNumbers[index]
    const pageWidth = formatPdfNumber(page.pageWidth)
    const pageHeight = formatPdfNumber(page.pageHeight)

    offsets[pageObjectNumber] = length
    pushText(
      `${pageObjectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 ${imageObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>\nendobj\n`
    )

    const contentBytes = encoder.encode(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`)
    offsets[contentObjectNumber] = length
    pushText(`${contentObjectNumber} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`)
    pushBytes(contentBytes)
    pushText('\nendstream\nendobj\n')

    offsets[imageObjectNumber] = length
    pushText(
      `${imageObjectNumber} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`
    )
    pushBytes(page.jpegBytes)
    pushText('\nendstream\nendobj\n')
  })

  const xrefOffset = length
  pushText(`xref\n0 ${objectCount + 1}\n`)
  pushText('0000000000 65535 f \n')

  for (let index = 1; index <= objectCount; index += 1) {
    pushText(`${String(offsets[index] || 0).padStart(10, '0')} 00000 n \n`)
  }

  pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  return mergeUint8Arrays(chunks)
}

function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.98) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) {
        resolve(value)
        return
      }

      reject(new Error('JPEG export failed.'))
    }, 'image/jpeg', quality)
  })

  return new Uint8Array(await blob.arrayBuffer())
}

function renderScaleForPage(width: number, height: number) {
  const longestSide = Math.max(width, height)
  return Math.min(3, Math.max(2, 2200 / longestSide))
}

export async function exportPdfWithQrPlacements({
  pdfUrl,
  qrDataUrl,
  placements,
  filename,
}: {
  pdfUrl: string
  qrDataUrl: string
  placements: QrPlacement[]
  filename: string
}) {
  const response = await fetch(pdfUrl)
  if (!response.ok) {
    throw new Error('The PDF file could not be loaded for export.')
  }

  const pdfData = await response.arrayBuffer()
  const pdfjs = await loadPdfModule()
  const loadingTask = pdfjs.getDocument({ data: pdfData })
  const pdfDocument = await loadingTask.promise
  const qrImage = await loadImage(qrDataUrl)
  const pages: PdfImagePage[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = renderScaleForPage(baseViewport.width, baseViewport.height)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Canvas context is not available for PDF export.')
      }

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)

      await page.render({
        canvasContext: context,
        viewport,
      }).promise

      placements
        .filter((placement) => placement.page === pageNumber)
        .forEach((placement) => {
          const qrSize = (placement.size / 100) * canvas.width
          const qrX = (placement.x / 100) * canvas.width - qrSize / 2
          const qrY = (placement.y / 100) * canvas.height - qrSize / 2
          context.drawImage(qrImage, qrX, qrY, qrSize, qrSize)
        })

      pages.push({
        jpegBytes: await canvasToJpegBytes(canvas),
        imageWidth: canvas.width,
        imageHeight: canvas.height,
        pageWidth: baseViewport.width,
        pageHeight: baseViewport.height,
      })
    }
  } finally {
    await pdfDocument.destroy()
  }

  downloadBytes(buildPdfFromJpegPages(pages), filename, 'application/pdf')
}
