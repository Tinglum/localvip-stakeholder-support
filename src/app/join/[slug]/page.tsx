import { notFound } from 'next/navigation'
import { Store } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import type { Offer } from '@/lib/types/database'
import {
  getBusinessJoinLogoUrl,
  getBusinessSupportLabel,
} from '@/lib/business-join'
import { getBusinessPortalData } from '@/lib/business-portal'
import { resolveBusinessOffer } from '@/lib/offers'
import { resolveBusinessByJoinIdentifier } from '@/lib/server/business-capture'
import { PublicBusinessJoinForm } from '@/components/business/public-business-join-form'

export const dynamic = 'force-dynamic'

interface QaJoinData {
  name: string
  offerTitle: string | null
  offerValue: string | null
  logoUrl: string | null
}

// QA-only businesses have no Supabase row, so resolve their public join page
// straight from the QA PublicJoin endpoint. This is an UNAUTHENTICATED page, so
// it must use fetchQaPublicApi — fetchQaApi requires a logged-in QA session and
// would throw for public visitors, forcing the page to a false 404.
async function resolveQaBusinessJoin(slug: string): Promise<QaJoinData | null> {
  try {
    const { fetchQaPublicApi, parseQaResponse } = await import('@/lib/auth/qa-api')
    const res = await fetchQaPublicApi(`/api/dashboard/v1/PublicJoin/resolve/${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    const json = await parseQaResponse<{
      kind?: string
      entity?: { id?: number | string; name?: string; headline?: string | null; imageUrl?: string | null }
      offer?: { headline?: string | null; description?: string | null; value?: string | null }
    }>(res, '')
    if (json?.kind !== 'business' || !json.entity?.name) return null

    // Only use an absolute logo URL here. The QA logo proxy route is auth-gated,
    // so on this PUBLIC page a bare storage filename can't be fetched — fall back
    // to the Store icon (logoUrl null) instead of rendering a 403 image.
    const { resolveImageUrl } = await import('@/lib/server/qa-dashboard-shared')
    const logoUrl = resolveImageUrl(json.entity.imageUrl)

    return {
      name: json.entity.name,
      // Prefer the 100-list OFFER's own headline; fall back to the business
      // headline, then (at render) to a generic line.
      offerTitle: json.offer?.headline?.trim() || json.entity.headline?.trim() || null,
      offerValue: json.offer?.value?.trim() || null,
      logoUrl,
    }
  } catch {
    return null
  }
}

export default async function BusinessJoinPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = createServiceClient()
  const business = await resolveBusinessByJoinIdentifier(supabase, params.slug)

  if (!business) {
    const qa = await resolveQaBusinessJoin(params.slug)
    if (!qa) {
      notFound()
    }

    const qaOfferTitle = qa.offerTitle || `Join the ${qa.name} list`

    return (
      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_30%),linear-gradient(180deg,_#0f172a_0%,_#172554_45%,_#1e293b_100%)] px-4 py-8 sm:px-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-[2.25rem] border border-white/15 bg-white/10 p-3 shadow-[0_40px_120px_-45px_rgba(15,23,42,0.7)] backdrop-blur-xl">
            <div className="rounded-[2rem] border border-white/20 bg-white/90 p-5 shadow-xl sm:p-6">
              <div className="rounded-[1.75rem] bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-5 text-white shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-white/25 bg-white/95 shadow-sm">
                    {qa.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={qa.logoUrl} alt={`${qa.name} logo`} className="h-full w-full object-contain p-2" />
                    ) : (
                      <Store className="h-7 w-7 text-brand-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Customer Capture Offer</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{qa.name}</h1>
                    <p className="mt-2 text-sm text-white/80">Join the list and claim your local offer.</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Open from QR</p>
                  <p className="mt-2 text-2xl font-bold leading-tight text-white">{qaOfferTitle}</p>
                  {qa.offerValue && <p className="mt-2 text-base font-semibold text-emerald-100">{qa.offerValue}</p>}
                  <p className="mt-3 text-sm leading-6 text-white/85">
                    Enter your details below to register instantly and claim this pre-launch offer in-store.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <PublicBusinessJoinForm
                  slug={params.slug}
                  businessName={qa.name}
                  offerTitle={qaOfferTitle}
                  offerValue={qa.offerValue}
                  supportLabel="Support local businesses near you."
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const portal = getBusinessPortalData(business)
  const logoUrl = getBusinessJoinLogoUrl(business)
  const causeName = business.linked_cause_id
    ? await getLinkedCauseName(supabase, business.linked_cause_id)
    : null
  const { data: offerRows } = await supabase.from('offers').select('*').eq('business_id', business.id)
  const captureOffer = resolveBusinessOffer(business, (offerRows || []) as Offer[], 'capture')

  const offerTitle = captureOffer.headline
  const offerValue = captureOffer.value_label || null
  const supportLabel = getBusinessSupportLabel(business, causeName)

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_30%),linear-gradient(180deg,_#0f172a_0%,_#172554_45%,_#1e293b_100%)] px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2.25rem] border border-white/15 bg-white/10 p-3 shadow-[0_40px_120px_-45px_rgba(15,23,42,0.7)] backdrop-blur-xl">
          <div className="rounded-[2rem] border border-white/20 bg-white/90 p-5 shadow-xl sm:p-6">
            <div className="rounded-[1.75rem] bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-5 text-white shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-white/25 bg-white/95 shadow-sm">
                  {logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoUrl} alt={`${business.name} logo`} className="h-full w-full object-contain p-2" />
                  ) : (
                    <Store className="h-7 w-7 text-brand-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Customer Capture Offer</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{business.name}</h1>
                  <p className="mt-2 text-sm text-white/80">{supportLabel}</p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Open from QR</p>
                <p className="mt-2 text-2xl font-bold leading-tight text-white">{offerTitle}</p>
                {offerValue && <p className="mt-2 text-base font-semibold text-emerald-100">{offerValue}</p>}
                <p className="mt-3 text-sm leading-6 text-white/85">
                  Enter your details below to register instantly and claim this pre-launch offer in-store.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <PublicBusinessJoinForm
                slug={params.slug}
                businessName={business.name}
                offerTitle={offerTitle}
                offerValue={offerValue}
                supportLabel={supportLabel}
              />
            </div>
          </div>
        </div>
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
