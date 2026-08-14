'use client'

import { PageHeader } from '@/components/ui/page-header'
import { EnablerMaterialsPage } from '@/components/materials/enabler-materials'

/**
 * The Materials tab in the Field / Launch Partner / Influencer shells.
 *
 * Kept off `/materials/library` deliberately: that page is the admin library
 * (uploading, QR-zone editing, bulk delete, and an unscoped listing that has no
 * account to generate against). Role-gating it into a second personality would
 * have put those operator controls one boolean away from an Enabler.
 */
export default function EnablerMaterialsRoute() {
  return (
    <div>
      <PageHeader
        title="Materials"
        description="Generate materials for the businesses and causes you are assigned to, and see what has already been made for them."
      />
      <EnablerMaterialsPage />
    </div>
  )
}
