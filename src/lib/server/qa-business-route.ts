import { getQaAccountIdFromLocal } from '@/lib/server/qa-dashboard-shared'
import type { SupabaseClient } from '@supabase/supabase-js'

export function parseQaBusinessRouteId(value: string) {
  const candidate = value.startsWith('qa-') ? value.slice(3) : value
  return /^\d+$/.test(candidate) ? Number(candidate) : null
}

export async function resolveQaBusinessRouteId(
  businessId: string,
  supabase: SupabaseClient,
) {
  const directId = parseQaBusinessRouteId(businessId)
  if (directId !== null) return directId

  const { data: localBusiness } = await supabase
    .from('businesses')
    .select('external_id, metadata')
    .eq('id', businessId)
    .maybeSingle()

  return localBusiness ? getQaAccountIdFromLocal(localBusiness) : null
}
