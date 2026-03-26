import { createClient } from '@/lib/supabase/client'
import type { Material } from '@/lib/types/database'

interface DeleteMaterialOptions {
  manageReferences?: boolean
}

interface DeleteMaterialResult {
  success: boolean
  error?: string
}

const MATERIAL_BUCKET_SEGMENT = '/storage/v1/object/public/materials/'

function extractStoragePath(url: string | null | undefined) {
  if (!url || url.startsWith('data:')) return null

  try {
    const parsed = new URL(url)
    const markerIndex = parsed.pathname.indexOf(MATERIAL_BUCKET_SEGMENT)
    if (markerIndex === -1) return null
    return decodeURIComponent(parsed.pathname.slice(markerIndex + MATERIAL_BUCKET_SEGMENT.length))
  } catch {
    return null
  }
}

export async function deleteMaterial(
  material: Pick<Material, 'id' | 'file_url' | 'thumbnail_url'>,
  options?: DeleteMaterialOptions,
): Promise<DeleteMaterialResult> {
  const supabase = createClient()

  if (options?.manageReferences) {
    const clearMaterialReference = (table: 'businesses' | 'outreach_scripts' | 'outreach_activities') =>
      (supabase.from(table) as any)
        .update({ linked_material_id: null })
        .eq('linked_material_id', material.id)

    const referenceCleanups = await Promise.all([
      clearMaterialReference('businesses'),
      clearMaterialReference('outreach_scripts'),
      clearMaterialReference('outreach_activities'),
    ])

    const cleanupFailure = referenceCleanups.find((result) => result.error)
    if (cleanupFailure?.error) {
      return { success: false, error: cleanupFailure.error.message }
    }
  }

  const { error } = await supabase.from('materials').delete().eq('id', material.id)
  if (error) {
    return { success: false, error: error.message }
  }

  const storagePaths = Array.from(
    new Set([extractStoragePath(material.file_url), extractStoragePath(material.thumbnail_url)].filter(Boolean) as string[])
  )

  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage.from('materials').remove(storagePaths)
    if (storageError) {
      console.warn('Material deleted but file cleanup failed:', storageError.message)
    }
  }

  return { success: true }
}
