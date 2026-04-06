import { QaLoginPage } from '@/components/auth/qa-login-page'

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const returnToRaw = searchParams?.returnTo
  const errorRaw = searchParams?.error

  const returnTo = Array.isArray(returnToRaw) ? returnToRaw[0] : returnToRaw || '/dashboard'
  const error = Array.isArray(errorRaw) ? errorRaw[0] : errorRaw

  return <QaLoginPage returnTo={returnTo} error={error} />
}
