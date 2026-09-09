export type MaterialAudienceTagDimension = 'audience' | 'scope'

export interface MaterialAudienceTag {
  id: number
  slug: string
  label: string
  dimension: MaterialAudienceTagDimension
  description: string | null
  matchesBusinessType: string | null
  matchesAllCauses: boolean
  matchesAllBusinesses: boolean
  sortOrder: number
  isActive: boolean
  isSystem: boolean
  materialCount: number
}

export interface MaterialAudienceTagInput {
  label: string
  slug?: string
  dimension: MaterialAudienceTagDimension
  description?: string | null
  matchesBusinessType?: string | null
  matchesAllCauses: boolean
  matchesAllBusinesses: boolean
  sortOrder: number
  isActive: boolean
}

export interface MaterialAudienceTagListResponse {
  items: MaterialAudienceTag[]
}

export interface MaterialTagsForMaterialResponse {
  materialId: string | number
  items: Pick<MaterialAudienceTag, 'id' | 'slug' | 'label' | 'dimension'>[]
}

export const DIMENSION_LABELS: Record<MaterialAudienceTagDimension, string> = {
  audience: 'Audience — who receives it',
  scope: 'Scope — where it applies',
}
