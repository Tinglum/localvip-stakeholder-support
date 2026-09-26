import { redirect } from 'next/navigation'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { InvitationEmailPage } from '@/components/admin/invitation-email-page'

export default async function AdminInvitationsPage() {
  const session = await getAuthenticatedSession()
  if (!session || !isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    redirect('/dashboard')
  }
  return <InvitationEmailPage />
}
