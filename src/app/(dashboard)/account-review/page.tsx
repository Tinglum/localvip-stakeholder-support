'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { BusinessSetupWizardPage } from '@/components/business/business-setup-wizard-page'
import { CauseSetupPage } from '@/components/community/cause-setup-page'

export default function AccountReviewPage() {
  const { shell } = useAuth()
  const app = process.env.NEXT_PUBLIC_DEPLOY_ENV === 'production' ? 'https://my.localvip.com' : 'https://my-qa.5.252.52.243.sslip.io'
  return <>
    <section className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 p-5">
      <h1 className="text-xl font-semibold text-surface-950">Continue with your existing LocalVIP account</h1>
      <p className="mt-2 text-sm leading-6 text-surface-700">Review your saved details and complete anything missing. Use your existing account; you do not need to register again.</p>
      <p className="mt-2 text-sm leading-6 text-surface-700">If an older image cannot be loaded, try again or upload a replacement in the image step.</p>
    </section>
    {shell === 'business' ? <BusinessSetupWizardPage /> : shell === 'community' ? <CauseSetupPage /> : <Link href={`${app}/account-review`} className="font-semibold text-brand-700 underline">Review your customer profile, causes and payment setup</Link>}
  </>
}
