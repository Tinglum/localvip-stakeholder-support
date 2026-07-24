import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { WelcomeAutoLogin } from '@/components/auth/welcome-auto-login'

/**
 * Landing page for the invite email's auto-login link.
 *
 * Two steps, both handled by the client component:
 *   ?token=…  → hand the token to the QA backend's /account/magic, which signs the
 *               user in and redirects back here with ?ready=1
 *   ?ready=1  → run the normal (now silent) OIDC login, which lands the user in the
 *               dashboard; the layout then forces the set-password step
 *
 * Public (see middleware) because there is no session yet on the first step.
 */
export default function WelcomePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  return (
    <WelcomeAutoLogin
      token={first(searchParams?.token) || null}
      ready={first(searchParams?.ready) === '1'}
      qaBaseUrl={QA_AUTH_CONFIG.baseUrl}
      clientId={QA_AUTH_CONFIG.clientId}
      scopes={QA_AUTH_CONFIG.scopes}
    />
  )
}
