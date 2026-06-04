import { QaLoginPage } from '@/components/auth/qa-login-page'

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
      qaBaseUrl={process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL || 'https://qa.localvip.com'}
      clientId={process.env.QA_AUTH_CLIENT_ID || 'lvip_dashboard'}
      scopes={process.env.QA_AUTH_SCOPES || 'openid profile email name LVIPDashboardApiV1 roles offline_access'}
    />
  )
}
