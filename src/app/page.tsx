import { QaLoginPage } from '@/components/auth/qa-login-page'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'

export default function Home({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const returnToRaw = searchParams?.returnTo
  const errorRaw = searchParams?.error
  const codeRaw = searchParams?.code
  const stateRaw = searchParams?.state
  const errorDescriptionRaw = searchParams?.error_description

  const returnTo = Array.isArray(returnToRaw) ? returnToRaw[0] : returnToRaw || '/dashboard'
  const error = Array.isArray(errorDescriptionRaw)
    ? errorDescriptionRaw[0]
    : errorDescriptionRaw
      || (Array.isArray(errorRaw) ? errorRaw[0] : errorRaw)
  const code = Array.isArray(codeRaw) ? codeRaw[0] : codeRaw
  const state = Array.isArray(stateRaw) ? stateRaw[0] : stateRaw

  return (
    <QaLoginPage
      returnTo={returnTo}
      error={error}
      code={code}
      state={state}
      qaBaseUrl={QA_AUTH_CONFIG.baseUrl}
      clientId={QA_AUTH_CONFIG.clientId}
      scopes={QA_AUTH_CONFIG.scopes}
    />
  )
}
