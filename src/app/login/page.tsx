import { redirect } from 'next/navigation'
import { QaLoginPage } from '@/components/auth/qa-login-page'

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const returnToRaw = searchParams?.returnTo
  const errorRaw = searchParams?.error
  const codeRaw = searchParams?.code
  const stateRaw = searchParams?.state
  const errorDescriptionRaw = searchParams?.error_description
  const manualRaw = searchParams?.manual
  const signoutRaw = searchParams?.signout

  const returnTo = Array.isArray(returnToRaw) ? returnToRaw[0] : returnToRaw || '/dashboard'
  const error = Array.isArray(errorDescriptionRaw)
    ? errorDescriptionRaw[0]
    : errorDescriptionRaw
      || (Array.isArray(errorRaw) ? errorRaw[0] : errorRaw)
  const code = Array.isArray(codeRaw) ? codeRaw[0] : codeRaw
  const state = Array.isArray(stateRaw) ? stateRaw[0] : stateRaw
  const manualValue = Array.isArray(manualRaw) ? manualRaw[0] : manualRaw
  const signoutValue = Array.isArray(signoutRaw) ? signoutRaw[0] : signoutRaw
  const manual = manualValue === '1' || manualValue === 'true'
  const signout = signoutValue === '1' || signoutValue === 'true'

  if (code && state && !error) {
    const params = new URLSearchParams({
      code,
      state,
      oauth_redirect_path: '/login',
    })
    redirect(`/api/auth/qa/callback?${params.toString()}`)
  }

  if (!manual && !signout && !error && !code && !state) {
    redirect(`/api/auth/qa/start?returnTo=${encodeURIComponent(returnTo)}`)
  }

  return <QaLoginPage returnTo={returnTo} error={error} code={code} state={state} manual={manual} signout={signout} />
}
