import type { createServiceClient } from '@/lib/supabase/server'
import {
  getMaterialAutomationAudienceTags,
  getMaterialAutomationTemplateConfig,
  getMaterialAutomationTemplateOutputFormat,
  materialSupportsAutomationTemplate,
} from '@/lib/materials/automation-template'
import { getQrPlacements, type QrPlacement } from '@/lib/materials/qr-placement'
import type {
  Material,
  MaterialTemplate,
  MaterialTemplateOutputFormat,
  QrCode,
  StakeholderType,
} from '@/lib/types/database'

type ServiceSupabaseClient = ReturnType<typeof createServiceClient>

interface RuntimeCanvasModule {
  createCanvas: (width: number, height: number) => {
    width: number
    height: number
    getContext: (contextId: '2d') => any
    toBuffer: (mimeType: string) => Buffer
  }
  loadImage: (source: string | Buffer | Uint8Array | ArrayBufferLike) => Promise<{
    width: number
    height: number
  }>
  PDFDocument: new (metadata?: {
    title?: string
    author?: string
    creator?: string
    producer?: string
    rasterDPI?: number
    encodingQuality?: number
    compressionLevel?: number
  } | null) => {
    beginPage: (width: number, height: number, rect?: unknown) => any
    endPage: () => void
    close: () => Buffer
  }
  DOMMatrix?: typeof DOMMatrix
  ImageData?: typeof ImageData
  Path2D?: typeof Path2D
}

export async function syncMaterialAssetTemplatesForStakeholder(
  supabase: ServiceSupabaseClient,
  stakeholderType: StakeholderType,
  templateId?: string,
) {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('is_template', true)
    .order('updated_at', { ascending: false })

  if (error) throw error

  const materials = (data || []) as Material[]
  const matchingMaterials = materials.filter((material) => materialMatchesStakeholderType(material, stakeholderType))

  const templates = await Promise.all(
    matchingMaterials.map((material) => syncMaterialAssetTemplateRow(supabase, material)),
  )

  return templates
    .filter((template): template is MaterialTemplate => !!template)
    .filter((template) => !templateId || template.id === templateId)
}

export async function renderMaterialAssetTemplate(
  supabase: ServiceSupabaseClient,
  template: MaterialTemplate,
  qrCode: QrCode,
  qrDataUrl: string,
) {
  const sourceMaterialId = getSourceMaterialId(template)
  if (!sourceMaterialId) {
    throw new Error('This template is missing its source material link.')
  }

  const { data, error } = await supabase.from('materials').select('*').eq('id', sourceMaterialId).single()
  if (error || !data) {
    throw new Error('The source material for this template could not be found.')
  }

  const material = data as Material
  if (!material.file_url) {
    throw new Error('The source material does not have a file URL yet.')
  }

  const placements = getQrPlacements(material.metadata as Record<string, unknown> | null)
  if (placements.length === 0) {
    throw new Error('The source material does not have any saved QR zones.')
  }

  if (material.mime_type === 'application/pdf') {
    const fileBuffer = await renderPdfSourceMaterial(material, qrDataUrl, placements)
    return {
      fileBuffer,
      fileExtension: 'pdf',
      contentType: 'application/pdf',
      materialType: 'pdf' as Material['type'],
      sourceMaterial: material,
      placements,
    }
  }

  const fileBuffer = await renderImageSourceMaterial(material, qrDataUrl, placements)
  return {
    fileBuffer,
    fileExtension: 'png',
    contentType: 'image/png',
    materialType: material.type,
    sourceMaterial: material,
    placements,
  }
}

function materialMatchesStakeholderType(material: Material, stakeholderType: StakeholderType) {
  const config = getMaterialAutomationTemplateConfig(material)
  if (!config.enabled || !config.isActive) return false
  if (!materialSupportsAutomationTemplate(material)) return false

  return config.stakeholderTypes.includes(stakeholderType)
    || (stakeholderType === 'school' && config.stakeholderTypes.includes('community'))
    || (stakeholderType === 'cause' && config.stakeholderTypes.includes('community'))
}

async function syncMaterialAssetTemplateRow(
  supabase: ServiceSupabaseClient,
  material: Material,
) {
  const config = getMaterialAutomationTemplateConfig(material)
  if (!config.enabled || !materialSupportsAutomationTemplate(material) || !material.file_url) {
    return null
  }

  const { data, error } = await supabase
    .from('material_templates')
    .select('*')
    .eq('template_type', 'material_asset')

  if (error) throw error

  const existingTemplate = ((data || []) as MaterialTemplate[]).find((template) => getSourceMaterialId(template) === material.id) || null
  const placements = getQrPlacements(material.metadata as Record<string, unknown> | null)
  const payload = {
    name: material.title,
    source_path: material.file_url,
    template_type: 'material_asset',
    output_format: getMaterialAutomationTemplateOutputFormat(material) as MaterialTemplateOutputFormat,
    audience_tags: getMaterialAutomationAudienceTags(material),
    stakeholder_types: config.stakeholderTypes,
    library_folder: config.libraryFolder,
    qr_position_json: {
      source_material_id: material.id,
      qr_placements: placements,
    },
    is_active: config.isActive,
    created_by: material.created_by,
    metadata: {
      source_material_id: material.id,
      source_material_mime_type: material.mime_type,
      source_material_file_url: material.file_url,
      source_material_title: material.title,
      generated_from_material: true,
      qr_placements: placements,
      target_roles: material.target_roles,
      target_subtypes: material.target_subtypes || [],
    },
  }

  if (existingTemplate) {
    const { data: updated, error: updateError } = await (supabase.from('material_templates') as any)
      .update(payload)
      .eq('id', existingTemplate.id)
      .select()
      .single()
    if (updateError) throw updateError
    return updated as MaterialTemplate
  }

  const { data: inserted, error: insertError } = await (supabase.from('material_templates') as any)
    .insert(payload)
    .select()
    .single()

  if (insertError) throw insertError
  return inserted as MaterialTemplate
}

function getSourceMaterialId(template: MaterialTemplate) {
  const metadata = (template.metadata as Record<string, unknown> | null) || {}
  return typeof metadata.source_material_id === 'string' ? metadata.source_material_id : null
}

async function renderImageSourceMaterial(
  material: Material,
  qrDataUrl: string,
  placements: QrPlacement[],
) {
  const { createCanvas, loadImage } = getRuntimeCanvasModule()
  const sourceBytes = await fetchFileBytes(material.file_url!)
  const sourceImage = await loadImage(sourceBytes)
  const qrImage = await loadImage(qrDataUrl)
  const canvas = createCanvas(sourceImage.width, sourceImage.height)
  const context = canvas.getContext('2d')

  context.drawImage(sourceImage, 0, 0, sourceImage.width, sourceImage.height)
  drawQrPlacementsOnCanvas(context, qrImage, placements, canvas.width, canvas.height, 1)

  return new Uint8Array(canvas.toBuffer('image/png'))
}

async function renderPdfSourceMaterial(
  material: Material,
  qrDataUrl: string,
  placements: QrPlacement[],
) {
  const pdfjs = await loadPdfJsServerModule()
  const { createCanvas, loadImage, PDFDocument } = getRuntimeCanvasModule()
  const sourceBytes = await fetchFileBytes(material.file_url!)
  const qrImage = await loadImage(qrDataUrl)
  const pdfDocument = await pdfjs.getDocument({ data: sourceBytes, disableWorker: true } as any).promise
  const output = new PDFDocument({
    title: material.title,
    author: 'LocalVIP Material Engine',
    creator: 'LocalVIP Material Engine',
    producer: 'LocalVIP Material Engine',
    rasterDPI: 144,
    encodingQuality: 101,
    compressionLevel: 6,
  })

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = renderScaleForPage(baseViewport.width, baseViewport.height)
      const viewport = page.getViewport({ scale })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const context = canvas.getContext('2d')
      const canvasFactory = buildNodeCanvasFactory(createCanvas)

      await page.render({
        canvasContext: context,
        viewport,
        canvasFactory,
      } as any).promise

      drawQrPlacementsOnCanvas(context, qrImage, placements, canvas.width, canvas.height, pageNumber)

      const pageImage = await loadImage(canvas.toBuffer('image/png'))
      const pdfContext = output.beginPage(baseViewport.width, baseViewport.height)
      pdfContext.drawImage(pageImage, 0, 0, baseViewport.width, baseViewport.height)
      output.endPage()
    }
  } finally {
    await pdfDocument.destroy()
  }

  return new Uint8Array(output.close())
}

function drawQrPlacementsOnCanvas(
  context: any,
  qrImage: { width: number; height: number },
  placements: QrPlacement[],
  canvasWidth: number,
  canvasHeight: number,
  pageNumber: number,
) {
  placements
    .filter((placement) => placement.page === pageNumber)
    .forEach((placement) => {
      const qrSize = (placement.size / 100) * canvasWidth
      const qrX = (placement.x / 100) * canvasWidth - qrSize / 2
      const qrY = (placement.y / 100) * canvasHeight - qrSize / 2
      context.drawImage(qrImage, qrX, qrY, qrSize, qrSize)
    })
}

function buildNodeCanvasFactory(createCanvas: RuntimeCanvasModule['createCanvas']) {
  return {
    create: (width: number, height: number) => {
      const canvas = createCanvas(width, height)
      const context = canvas.getContext('2d')
      return { canvas, context }
    },
    reset: (canvasAndContext: { canvas: { width: number; height: number } }, width: number, height: number) => {
      canvasAndContext.canvas.width = width
      canvasAndContext.canvas.height = height
    },
    destroy: (_canvasAndContext: unknown) => undefined,
  }
}

function renderScaleForPage(width: number, height: number) {
  const longestSide = Math.max(width, height)
  return Math.min(3, Math.max(2, 2200 / longestSide))
}

async function fetchFileBytes(url: string) {
  if (url.startsWith('data:')) {
    return decodeDataUrl(url)
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('The source material file could not be loaded.')
  }

  return new Uint8Array(await response.arrayBuffer())
}

function decodeDataUrl(value: string) {
  const separatorIndex = value.indexOf(',')
  if (separatorIndex === -1) {
    throw new Error('The source material file is not a valid data URL.')
  }

  const header = value.slice(0, separatorIndex)
  const dataPart = value.slice(separatorIndex + 1)

  if (header.includes(';base64')) {
    return new Uint8Array(Buffer.from(dataPart, 'base64'))
  }

  return new Uint8Array(Buffer.from(decodeURIComponent(dataPart), 'utf8'))
}

function getRuntimeCanvasModule(): RuntimeCanvasModule {
  const runtimeRequire = eval('require') as (id: string) => unknown
  return runtimeRequire('@napi-rs/canvas') as RuntimeCanvasModule
}

async function loadPdfJsServerModule() {
  const canvasModule = getRuntimeCanvasModule()
  if (canvasModule.DOMMatrix && typeof (globalThis as any).DOMMatrix === 'undefined') {
    ;(globalThis as any).DOMMatrix = canvasModule.DOMMatrix
  }
  if (canvasModule.ImageData && typeof (globalThis as any).ImageData === 'undefined') {
    ;(globalThis as any).ImageData = canvasModule.ImageData
  }
  if (canvasModule.Path2D && typeof (globalThis as any).Path2D === 'undefined') {
    ;(globalThis as any).Path2D = canvasModule.Path2D
  }

  return import('pdfjs-dist/legacy/build/pdf.mjs')
}
