import { MaterialEngineStakeholderDetailPage } from '@/components/admin/material-engine-stakeholder-detail-page'

export default function AdminStakeholderDetailRoute({
  params,
}: {
  params: { id: string }
}) {
  return <MaterialEngineStakeholderDetailPage stakeholderId={params.id} />
}
