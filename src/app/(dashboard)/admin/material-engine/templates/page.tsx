import { MaterialEngineTemplatesPage } from '@/components/admin/material-engine-templates-page'
import { TemplateRepublishPanel } from '@/components/admin/template-republish-panel'

export default function AdminMaterialEngineTemplatesRoute() {
  return (
    <div className="space-y-6">
      <MaterialEngineTemplatesPage />
      {/* Cascade republish sits under the template list: you edit a design
          above, then push the fix out to every account that already has a copy. */}
      <TemplateRepublishPanel />
    </div>
  )
}
