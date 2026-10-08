import { NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { fetchQaCauseDetail, fetchQaCauseList } from '@/lib/server/qa-dashboard-causes'
import { fetchQaApi } from '@/lib/auth/qa-api'

export const maxDuration = 300

type Draft = { assets?: { mark?: { src?: string }; crowd?: { src?: string } } }

export async function GET() {
  const operator = await getOperatorRouteContext(['admin'])
  if ('error' in operator) return operator.error
  if (!operator.session.qaSession) return NextResponse.json({ error: 'A QA session is required.' }, { status: 401 })

  try {
    const causes = await fetchQaCauseList()
    const items: Array<{ id: number; name: string; ready: boolean; missing: string[]; excluded: boolean }> = []
    for (let offset = 0; offset < causes.length; offset += 8) {
      const batch = await Promise.all(causes.slice(offset, offset + 8).map(async ({ id, name }) => {
        const excluded = name.toLowerCase().replace(/[^a-z0-9]/g, '').includes('olathewest')
        if (excluded) return { id, name, ready: false, missing: [], excluded }
        try {
          const cause = await fetchQaCauseDetail(id)
          const response = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${id}/landing-page`)
          const landing = response.ok ? await response.json() as { draft?: Draft & { slug?: string }; published?: Draft & { slug?: string } } : null
          const draft = landing?.draft || null
          const missing = [
            !cause.referralCode && 'referral code',
            !(cause.imageUrl || draft?.assets?.mark?.src) && 'logo',
            !(cause.coverPhotoUrl || draft?.assets?.crowd?.src) && 'supporters photo',
            !(landing?.draft?.slug || landing?.published?.slug) && 'campaign page setup',
          ].filter((value): value is string => Boolean(value))
          return { id, name, ready: missing.length === 0, missing, excluded }
        } catch (error) {
          return { id, name, ready: false, missing: [error instanceof Error ? error.message : 'Could not check cause'], excluded }
        }
      }))
      items.push(...batch)
    }
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not list causes.' }, { status: 502 })
  }
}
