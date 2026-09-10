import { redirect } from 'next/navigation'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

/**
 * CRM is admin tooling and must not be reachable while previewing an account.
 *
 * Reported as "I was able to access this page through a customer's profile":
 * during a view-as preview the admin's own session is still in place, so every
 * admin surface stayed navigable behind what is presented as that customer's
 * dashboard. The data itself was never exposed to the customer — /api/dashboard/
 * nodes is gated to admin/field/launch_partner — but an operator part-way
 * through a preview could not tell whose view they were looking at, which is the
 * same confusion behind the print control showing in preview.
 *
 * Guarded on the server so it cannot be stepped around by navigating client-side.
 * The banner's "Return to admin" control is unaffected and remains the way out.
 */
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthenticatedSession()

  if (session?.viewingAs) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
