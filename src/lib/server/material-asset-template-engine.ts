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
  // Fetch both materials and existing asset templates in parallel (avoid N+1)
  const [materialsResult, existingTemplatesResult] = await Promise.all([
    supabase.from('materials').select('*').eq('is_template', true).order('updated_at', { ascending: false }),
    supabase.from('material_templates').select('*').eq('template_type', 'material_asset'),
  ])

  if (materialsResult.error) throw materialsResult.error
  if (existingTemplatesResult.error) throw existingTemplatesResult.error

  const materials = (materialsResult.data || []) as Material[]
  const existingAssetTemplates = (existingTemplatesResult.data || []) as MaterialTemplate[]
  const matchingMaterials = materials.filter((material) => materialMatchesStakeholderType(material, stakeholderType))

  // Skip sync entirely if no matching materials
  if (matchingMaterials.length === 0) return []

  const templates = await Promise.all(
    matchingMaterials.map((material) => syncMaterialAssetTemplateRow(supabase, material, existingAssetTemplates)),
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
  existingAssetTemplates: MaterialTemplate[],
) {
  const config = getMaterialAutomationTemplateConfig(material)
  if (!config.enabled || !materialSupportsAutomationTemplate(material) || !material.file_url) {
    return null
  }

  const existingTemplate = existingAssetTemplates.find((template) => getSourceMaterialId(template) === material.id) || null
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
  let canvasModule: RuntimeCanvasModule
  try {
    canvasModule = getRuntimeCanvasModule()
  } catch {
    throw new Error(
      `Image-based material "${material.title}" requires @napi-rs/canvas which is not available in this environment. `
      + `Upload the source material as a PDF instead — PDF rendering works everywhere.`
    )
  }
  const { createCanvas, loadImage } = canvasModule
  const sourceBytes = await fetchFileBytes(material.file_url!)
  const sourceImage = await loadImage(sourceBytes)
  const qrImage = await loadImage(qrDataUrl)
  const canvas = createCanvas(sourceImage.width, sourceImage.height)
  const context = canvas.getContext('2d')

  context.drawImage(sourceImage, 0, 0, sourceImage.width, sourceImage.height)

  placements
    .filter((p) => p.page === 1)
    .forEach((placement) => {
      const qrSize = (placement.size / 100) * canvas.width
      const qrX = (placement.x / 100) * canvas.width - qrSize / 2
      const qrY = (placement.y / 100) * canvas.height - qrSize / 2
      context.drawImage(qrImage, qrX, qrY, qrSize, qrSize)
    })

  return new Uint8Array(canvas.toBuffer('image/png'))
}

async function renderPdfSourceMaterial(
  material: Material,
  qrDataUrl: string,
  placements: QrPlacement[],
) {
  const { PDFDocument } = await import('pdf-lib')
  const sourceBytes = await fetchFileBytes(material.file_url!)
  const pdfDoc = await PDFDocument.load(sourceBytes)

  // Convert the QR data URL to a PNG image embeddable in the PDF
  const qrPngBytes = dataUrlToBytes(qrDataUrl)
  const qrImage = await pdfDoc.embedPng(qrPngBytes)

  const pages = pdfDoc.getPages()
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]
    const pageNumber = pageIndex + 1
    const { width: pageWidth, height: pageHeight } = page.getSize()

    const pagePlacements = placements.filter((p) => p.page === pageNumber)
    for (const placement of pagePlacements) {
      const qrSize = (placement.size / 100) * pageWidth
      const qrX = (placement.x / 100) * pageWidth - qrSize / 2
      // pdf-lib uses bottom-left origin, so flip Y
      const qrY = pageHeight - ((placement.y / 100) * pageHeight) - qrSize / 2

      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      })
    }
  }

  pdfDoc.setTitle(material.title)
  pdfDoc.setAuthor('LocalVIP Material Engine')
  pdfDoc.setCreator('LocalVIP Material Engine')
  pdfDoc.setProducer('LocalVIP Material Engine')

  return new Uint8Array(await pdfDoc.save())
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const separatorIndex = dataUrl.indexOf(',')
  if (separatorIndex === -1) throw new Error('Invalid data URL for QR image.')
  const header = dataUrl.slice(0, separatorIndex)
  const dataPart = dataUrl.slice(separatorIndex + 1)
  if (header.includes(';base64')) {
    return new Uint8Array(Buffer.from(dataPart, 'base64'))
  }
  return new Uint8Array(Buffer.from(decodeURIComponent(dataPart), 'utf8'))
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
