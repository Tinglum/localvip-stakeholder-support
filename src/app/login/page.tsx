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

  const returnTo = Array.isArray(returnToRaw) ? returnToRaw[0] : returnToRaw || '/dashboard'
  const error = Array.isArray(errorDescriptionRaw)
    ? errorDescriptionRaw[0]
    : errorDescriptionRaw
      || (Array.isArray(errorRaw) ? errorRaw[0] : errorRaw)
  const code = Array.isArray(codeRaw) ? codeRaw[0] : codeRaw
  const state = Array.isArray(stateRaw) ? stateRaw[0] : stateRaw

  return <QaLoginPage returnTo={returnTo} error={error} code={code} state={state} />
}
