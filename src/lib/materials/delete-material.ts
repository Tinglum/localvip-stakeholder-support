import type { Material } from '@/lib/types/database'

interface DeleteMaterialOptions {
  manageReferences?: boolean
}

interface DeleteMaterialResult {
  success: boolean
  error?: string
}

/**
 * Delete a material via the QA dashboard proxy. The backend handles dependency
 * cleanup; the optional `manageReferences` flag is preserved for API parity
 * (it's a no-op on QA — the backend cascade-clears references).
 */
export async function deleteMaterial(
  material: Pick<Material, 'id' | 'file_url' | 'thumbnail_url'>,
  _options?: DeleteMaterialOptions,
): Promise<DeleteMaterialResult> {
  try {
    const res = await fetch(`/api/qa/dashboard/materials/${encodeURIComponent(material.id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { success: false, error: (body as { error?: string }).error || `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
