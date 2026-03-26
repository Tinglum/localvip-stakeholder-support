import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getBusinessJoinLogoUrl,
  getBusinessSupportLabel,
} from '@/lib/business-join'
import {
  getBusinessOfferTitle,
  getBusinessPortalData,
} from '@/lib/business-portal'
import { resolveBusinessByJoinIdentifier } from '@/lib/server/business-capture'
import { PublicBusinessJoinForm } from '@/components/business/public-business-join-form'

export const dynamic = 'force-dynamic'

export default async function BusinessJoinPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = createServiceClient()
  const business = await resolveBusinessByJoinIdentifier(supabase, params.slug)

  if (!business) {
    notFound()
  }

  const portal = getBusinessPortalData(business)
  const logoUrl = getBusinessJoinLogoUrl(business)
  const causeName = business.linked_cause_id
    ? await getLinkedCauseName(supabase, business.linked_cause_id)
    : null

  const offerTitle = getBusinessOfferTitle(business)
  const offerDescription = portal.offer_description || 'Join our list and be part of something local.'
  const offerValue = portal.offer_value || null
  const supportLabel = getBusinessSupportLabel(business, causeName)

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#fff7ed_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.02fr,0.98fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-sm">
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt={`${business.name} logo`} className="h-full w-full object-contain p-2" />
              ) : (
                <span className="text-lg font-bold text-brand-600">{business.name.slice(0, 1)}</span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-surface-500">LocalVIP Offer</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">{business.name}</h1>
              <p className="mt-2 text-sm text-surface-500">{supportLabel}</p>
            </div>
          </div>

          <div className="mt-8 rounded-[2rem] bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-6 text-white shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Get your offer</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight">{offerTitle}</h2>
            {offerValue && <p className="mt-2 text-lg font-semibold text-white/90">{offerValue}</p>}
            <p className="mt-4 max-w-lg text-base leading-7 text-white/90">{offerDescription}</p>
          </div>

          <div className="mt-8 rounded-[2rem] border border-surface-200 bg-surface-50 p-5">
            <p className="text-sm font-semibold text-surface-900">Scan, enter, done.</p>
            <p className="mt-2 text-sm leading-6 text-surface-600">
              Add your details to get the offer and stay connected to what this local business is doing in the community.
            </p>
          </div>
        </section>

        <section className="self-center">
          <PublicBusinessJoinForm slug={params.slug} offerTitle={offerTitle} />
        </section>
      </div>
    </main>
  )
}

async function getLinkedCauseName(supabase: ReturnType<typeof createServiceClient>, causeId: string) {
  const { data } = await supabase
    .from('causes')
    .select('name')
    .eq('id', causeId)
    .single()

  return (data as { name?: string } | null)?.name || null
}
